import { chatCompletionText } from "./cerebrasClient";
import type { PlannedStop } from "../types";

const SYSTEM_PROMPT = `You are a friendly assistant explaining a day's errand plan to the person
who will follow it. Given the final ordered list of stops (with travel
times and any noted conflicts), write a short, warm, plain-language
explanation (3-5 sentences) of why the stops are in this order. Mention
any hard time constraints that anchored the plan, and any flexible stops
that were placed to minimize backtracking or account for traffic
conditions if that data is provided. Do not invent facts not present in
the input, and do not reference crowd levels or busy-time data — this
version of the app does not use that signal. Output
plain text only, no JSON, no markdown headers.`;

/**
 * Call 3: narrates the final order in plain language. Slightly higher
 * reasoning effort than calls 1/2 — a bit of deliberation improves
 * coherence, and this call isn't latency-critical since it can render
 * last, after the map/timeline animation has already settled.
 */
export async function explainPlan(
  stops: PlannedStop[],
  totalDurationMin: number,
  conflicts: string[]
): Promise<string> {
  const userPrompt = JSON.stringify({ stops, total_duration_min: totalDurationMin, conflicts });

  const text = await chatCompletionText({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    reasoningEffort: "medium",
    label: "llmExplain",
  });

  return text.trim();
}
