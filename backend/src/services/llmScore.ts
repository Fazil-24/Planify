import { chatCompletionJson } from "./cerebrasClient";
import type { ParsedTask } from "../types";

const SYSTEM_PROMPT = `You are an urgency-scoring engine for a daily errand planner. Given a JSON
array of tasks, assign each one an urgency_score from 0 to 100 and a short
one-sentence reason. Fixed time-window tasks should generally score high
(80-100) since they cannot be moved. Flexible tasks should be scored based
on common-sense reasoning about the task type (e.g. picking up a prescription
is more urgent than picking up dry cleaning; grocery shopping before dinner
is more urgent late in the day). Output ONLY a valid JSON array, no prose,
no markdown fences.

Each output object must have exactly these fields:
- id: matching the input task id
- urgency_score: integer 0-100
- urgency_reason: one short sentence

Return ONLY the JSON array, nothing else.`;

export interface UrgencyScore {
  id: string;
  urgency_score: number;
  urgency_reason: string;
}

/**
 * Call 2: scores urgency per task. Low reasoning effort — this is a
 * classification task, not one that benefits from deliberation.
 */
export async function scoreTaskUrgency(tasks: ParsedTask[], currentTimeOfDay: string): Promise<UrgencyScore[]> {
  const userPrompt = JSON.stringify({ tasks, current_time: currentTimeOfDay });

  const result = await chatCompletionJson<UrgencyScore[]>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    reasoningEffort: "low",
    label: "llmScore",
  });

  if (!Array.isArray(result)) throw new Error("llmScore: expected a JSON array of scores");
  return result;
}
