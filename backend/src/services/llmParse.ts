import { chatCompletionJson } from "./cerebrasClient";
import type { ParsedTask } from "../types";

const SYSTEM_PROMPT = `You are a task-parsing engine for a daily errand planner. Convert the user's
free-text description of their day's tasks into a JSON array of structured
tasks. Output ONLY valid JSON — no prose, no markdown code fences, no
explanation.

Each task object must have exactly these fields:
- id: a short string like "t1", "t2", incrementing
- label: a short human-readable name for the task (a few words)
- place_name: the specific place name the user mentioned for this task,
  exactly as they wrote it. Every task the user describes should include a
  place name — if one task genuinely has no identifiable place mentioned,
  omit that task from the output array entirely rather than guessing or
  returning null (the frontend will separately prompt the user to add a
  place for anything that doesn't come back in the parsed list).
- duration_min: your best reasonable estimate of how long this task takes
  in minutes, if not stated by the user (e.g. dry cleaning pickup ~10,
  dentist visit ~45, grocery shopping ~30, gym session ~60)
- time_window: if the user gave or implied a specific time or deadline,
  return {"start": "HH:MM", "end": "HH:MM"} in 24-hour format. If no
  specific time was mentioned, return null.
  IMPORTANT: a single point-in-time mention (e.g. "at 4:20pm", "around 6",
  "by 7pm sharp") still counts as a specific time — do not return null for
  these. For an exact/appointment time like "at 4:20pm sharp", set both
  start and end to that time (e.g. {"start": "16:20", "end": "16:20"}). For
  a vaguer mention like "around 6" or "by 7pm", use your judgment to build
  a reasonable window (e.g. "around 6" -> {"start": "17:45", "end": "18:15"};
  "by 7pm" -> a window ending at 19:00). Only return null when the user
  truly gave no time information at all for that task.
- flexibility: "fixed" if there's a real time constraint, otherwise
  "flexible". A task cannot be "fixed" while time_window is null — if you
  set flexibility to "fixed", time_window must be non-null.

Return ONLY the JSON array, nothing else.`;

/**
 * Call 1: parses free text into structured tasks. Low reasoning effort —
 * this is simple extraction, and latency matters since the user is
 * waiting on a live plan.
 */
export async function parseTasksFromText(freeText: string): Promise<ParsedTask[]> {
  const result = await chatCompletionJson<ParsedTask[]>({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: freeText,
    reasoningEffort: "low",
    label: "llmParse",
  });

  if (!Array.isArray(result)) throw new Error("llmParse: expected a JSON array of tasks");
  return result;
}
