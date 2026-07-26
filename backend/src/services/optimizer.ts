import type { PlannedStop, ScoredTask } from "../types";

/**
 * Deterministic route ordering (constrained TSP with time windows).
 *
 * Architectural note: this module never calls an LLM and never makes a
 * network request. The LLM (see llmParse/llmScore/llmExplain) handles
 * language and judgment under ambiguity; this module handles the actual
 * math of deciding stop order. Keeping that boundary literal — a
 * network-call-free file — is deliberate so the separation is auditable,
 * not just documented.
 */

export interface OptimizeInput {
  tasks: ScoredTask[];
  /** travel time in minutes, matrix[i][j] = time from location i to location j. Index 0 is the start location. */
  matrix: number[][];
  startLocation: { lat: number; lng: number };
  /** "HH:MM" 24hr */
  planStartTime: string;
}

export interface OptimizeResult {
  stops: PlannedStop[];
  conflicts: string[];
  totalDurationMin: number;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(totalMinutes: number): string {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = Math.round(wrapped % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Builds the initial route from fixed (time-windowed) tasks only, sorted by
 * window start. These become anchor points whose relative order is locked;
 * flexible tasks are threaded in later by insertFlexibleTask.
 */
export function buildInitialRoute(tasks: ScoredTask[]): ScoredTask[] {
  const fixed = tasks.filter((t) => t.time_window !== null);
  return [...fixed].sort((a, b) => timeToMinutes(a.time_window!.start) - timeToMinutes(b.time_window!.start));
}

/**
 * Cost (in minutes) of traveling+dwelling through a sequence of task ids in
 * the given order, starting from the start-location matrix index 0.
 * taskIndexOf maps a task id -> its row/column index in the matrix.
 */
function routeCost(order: ScoredTask[], matrix: number[][], taskIndexOf: Map<string, number>): number {
  let cost = 0;
  let prevIdx = 0; // start location
  for (const task of order) {
    const idx = taskIndexOf.get(task.id)!;
    cost += matrix[prevIdx][idx] + task.duration_min;
    prevIdx = idx;
  }
  return cost;
}

/**
 * Inserts each flexible task (processed in descending urgency_score order)
 * into the cheapest gap of the current route — including before the first
 * stop and after the last — subtracting a small urgency bonus so
 * high-priority flexible tasks can justify a slightly costlier placement.
 */
export function insertFlexibleTask(
  route: ScoredTask[],
  flexibleTasks: ScoredTask[],
  matrix: number[][],
  taskIndexOf: Map<string, number>
): ScoredTask[] {
  let working = [...route];
  const remaining = [...flexibleTasks].sort((a, b) => b.urgency_score - a.urgency_score);

  for (const task of remaining) {
    const taskIdx = taskIndexOf.get(task.id)!;
    let bestGap = 0;
    let bestCost = Infinity;

    for (let gap = 0; gap <= working.length; gap++) {
      const prevIdx = gap === 0 ? 0 : taskIndexOf.get(working[gap - 1].id)!;
      const nextIdx = gap < working.length ? taskIndexOf.get(working[gap].id)! : null;

      const removedEdge = nextIdx !== null ? matrix[prevIdx][nextIdx] : 0;
      const addedEdges = matrix[prevIdx][taskIdx] + (nextIdx !== null ? matrix[taskIdx][nextIdx] : 0);
      const addedCost = addedEdges - removedEdge + task.duration_min;

      // Urgency bonus: higher urgency tolerates a costlier placement.
      const urgencyBonus = (task.urgency_score / 100) * 15;
      const effectiveCost = addedCost - urgencyBonus;

      if (effectiveCost < bestCost) {
        bestCost = effectiveCost;
        bestGap = gap;
      }
    }

    working = [...working.slice(0, bestGap), task, ...working.slice(bestGap)];
  }

  return working;
}

/**
 * Local improvement pass: repeatedly try swapping adjacent non-fixed stops,
 * keeping any swap that reduces total route time. Capped at 50 iterations
 * to guarantee termination. Fixed (time-windowed) stops are never moved,
 * preserving their locked relative order.
 */
export function twoOptImprove(
  route: ScoredTask[],
  matrix: number[][],
  taskIndexOf: Map<string, number>,
  maxIterations = 50
): ScoredTask[] {
  let working = [...route];
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < working.length - 1; i++) {
      const a = working[i];
      const b = working[i + 1];
      if (a.time_window !== null || b.time_window !== null) continue; // never move fixed stops

      const candidate = [...working];
      candidate[i] = b;
      candidate[i + 1] = a;

      const currentCost = routeCost(working, matrix, taskIndexOf);
      const candidateCost = routeCost(candidate, matrix, taskIndexOf);

      if (candidateCost < currentCost) {
        working = candidate;
        improved = true;
      }
    }
  }

  return working;
}

/**
 * Walks the final route computing cumulative arrival times against each
 * fixed task's window, producing human-readable conflict strings for any
 * window that cannot be met — never silently dropped.
 */
export function validateWindows(
  route: ScoredTask[],
  matrix: number[][],
  taskIndexOf: Map<string, number>,
  planStartTime: string
): { conflicts: string[]; arrivalTimes: string[]; travelTimes: number[] } {
  const conflicts: string[] = [];
  const arrivalTimes: string[] = [];
  const travelTimes: number[] = [];

  let clock = timeToMinutes(planStartTime);
  let prevIdx = 0;

  for (const task of route) {
    const idx = taskIndexOf.get(task.id)!;
    const travel = matrix[prevIdx][idx];
    clock += travel;

    arrivalTimes.push(minutesToTime(clock));
    travelTimes.push(travel);

    if (task.time_window) {
      const windowStart = timeToMinutes(task.time_window.start);
      const windowEnd = timeToMinutes(task.time_window.end);
      if (clock > windowEnd) {
        conflicts.push(
          `${task.label} at ${task.time_window.start} may be tight — estimated arrival ${minutesToTime(
            clock
          )} is after the ${task.time_window.end} window closes.`
        );
      } else if (clock < windowStart) {
        // Arriving early is fine; wait until the window opens before dwelling.
        clock = windowStart;
        arrivalTimes[arrivalTimes.length - 1] = minutesToTime(clock);
      }
    }

    clock += task.duration_min;
    prevIdx = idx;
  }

  return { conflicts, arrivalTimes, travelTimes };
}

export function optimizeRoute(input: OptimizeInput): OptimizeResult {
  const { tasks, matrix, planStartTime } = input;

  // matrix index 0 = start location, index i+1 = tasks[i] in the ORIGINAL task order
  // passed to the matrix builder. taskIndexOf maps task id -> matrix index.
  const taskIndexOf = new Map<string, number>(tasks.map((t, i) => [t.id, i + 1]));

  const flexible = tasks.filter((t) => t.time_window === null);

  let route = buildInitialRoute(tasks);
  route = insertFlexibleTask(route, flexible, matrix, taskIndexOf);
  route = twoOptImprove(route, matrix, taskIndexOf);

  const { conflicts, arrivalTimes, travelTimes } = validateWindows(route, matrix, taskIndexOf, planStartTime);

  const stops: PlannedStop[] = route.map((task, i) => ({
    ...task,
    order_index: i,
    arrival_time_estimate: arrivalTimes[i],
    travel_time_from_prev_min: travelTimes[i],
  }));

  const totalDurationMin =
    travelTimes.reduce((sum, t) => sum + t, 0) + route.reduce((sum, t) => sum + t.duration_min, 0);

  return { stops, conflicts, totalDurationMin };
}
