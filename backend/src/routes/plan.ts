import { Router, type Request, type Response } from "express";
import { parseTasksFromText } from "../services/llmParse";
import { scoreTaskUrgency } from "../services/llmScore";
import { explainPlan } from "../services/llmExplain";
import { geocodePlace, GeocodeFailedError } from "../services/geocode";
import { buildTravelTimeMatrix, buildRouteGeometry } from "../services/matrix";
import { optimizeRoute } from "../services/optimizer";
import type { PlanResponse, RawTaskInput, ScoredTask } from "../types";

export const planRouter = Router();

function currentServerTimeHHMM(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

planRouter.post("/plan", async (req: Request, res: Response) => {
  const body = req.body as RawTaskInput;

  if (!body?.freeText?.trim()) {
    return res.status(400).json({ error: "freeText is required" });
  }
  if (!body?.startLocation || typeof body.startLocation.lat !== "number" || typeof body.startLocation.lng !== "number") {
    return res.status(400).json({ error: "startLocation with lat/lng is required" });
  }

  const planStartTime = body.planStartTime ?? currentServerTimeHHMM();

  try {
    // 1. Parse free text into structured tasks
    const rawParsedTasks = await parseTasksFromText(body.freeText);

    // Defensive normalization: the optimizer's fixed/flexible split keys off
    // time_window, not the flexibility label. If the LLM ever emits
    // flexibility "fixed" with a null time_window (a contradiction — seen in
    // practice for single-instant time mentions the model failed to expand
    // into a window), downgrade it to "flexible" so the two fields stay
    // consistent rather than silently losing a time constraint the user
    // actually stated.
    const parsedTasks = rawParsedTasks.map((task) =>
      task.flexibility === "fixed" && task.time_window === null ? { ...task, flexibility: "flexible" as const } : task
    );

    if (parsedTasks.length === 0) {
      return res.status(422).json({
        error: "Couldn't identify any tasks with a place name in that description. Try naming a specific place for each task.",
      });
    }

    // 2. Geocode each place — surface exactly which place failed, don't fail silently
    const geocodeResults = await Promise.allSettled(
      parsedTasks.map(async (task) => ({
        task,
        location: await geocodePlace(task.place_name, body.startLocation),
      }))
    );

    const geocodeFailures = geocodeResults
      .map((r, i) => ({ r, task: parsedTasks[i] }))
      .filter(({ r }) => r.status === "rejected");

    if (geocodeFailures.length > 0) {
      return res.status(422).json({
        error: "One or more places couldn't be found.",
        failures: geocodeFailures.map(({ r, task }) => ({
          task_id: task.id,
          place_name: task.place_name,
          message: r.status === "rejected" && r.reason instanceof GeocodeFailedError ? r.reason.message : `Couldn't find "${task.place_name}".`,
        })),
      });
    }

    const geocoded = geocodeResults
      .filter((r): r is PromiseFulfilledResult<{ task: (typeof parsedTasks)[number]; location: { lat: number; lng: number } }> => r.status === "fulfilled")
      .map((r) => r.value);

    // 3. Build the live travel-time matrix (start location + all task locations)
    const locations = [body.startLocation, ...geocoded.map((g) => g.location)];
    const matrix = await buildTravelTimeMatrix(locations);

    // 4. Score urgency per task
    const urgencyScores = await scoreTaskUrgency(
      geocoded.map((g) => g.task),
      planStartTime
    );
    const urgencyById = new Map(urgencyScores.map((s) => [s.id, s]));

    const scoredTasks: ScoredTask[] = geocoded.map(({ task, location }) => {
      const score = urgencyById.get(task.id);
      return {
        ...task,
        location,
        urgency_score: score?.urgency_score ?? 50,
        urgency_reason: score?.urgency_reason ?? "No specific urgency signal available.",
      };
    });

    // 5. Deterministic route ordering — no LLM involved
    const { stops, conflicts, totalDurationMin } = optimizeRoute({
      tasks: scoredTasks,
      matrix,
      startLocation: body.startLocation,
      planStartTime,
    });

    // Actual road-route geometry through the final stop order, for the map
    const orderedLocations = [body.startLocation, ...stops.map((s) => s.location)];
    const routeGeometry = await buildRouteGeometry(orderedLocations);

    // 6. Plain-language narration of the final order
    const explanation = await explainPlan(stops, totalDurationMin, conflicts);

    const response: PlanResponse = {
      stops,
      route_geometry: routeGeometry,
      total_duration_min: totalDurationMin,
      explanation,
      conflicts,
      generated_at: new Date().toISOString(),
    };

    return res.json(response);
  } catch (err) {
    console.error("[POST /plan] pipeline failure:", err);
    return res.status(502).json({
      error: "Something went wrong generating your plan. Please try again.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});
