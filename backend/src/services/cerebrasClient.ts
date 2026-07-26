import { withRetry } from "../utils/retry";

const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
const MODEL = "gpt-oss-120b";

type ReasoningEffort = "low" | "medium" | "high";

interface ChatCompletionChoice {
  message: {
    content: string;
    // Some reasoning-model responses separate the thinking trace out of `content`.
    reasoning?: string;
  };
}

interface ChatCompletionResponse {
  choices: ChatCompletionChoice[];
}

/**
 * Calls Cerebras's OpenAI-compatible chat completions endpoint.
 * Returns only the final answer content — any reasoning/thinking trace is
 * discarded here so callers never accidentally try to parse it as JSON.
 */
async function chatCompletion(params: {
  systemPrompt: string;
  userPrompt: string;
  reasoningEffort: ReasoningEffort;
}): Promise<string> {
  const apiKey = process.env.CEREBRAS_API_KEY;
  if (!apiKey) throw new Error("CEREBRAS_API_KEY is not set");

  const response = await fetch(`${CEREBRAS_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: params.reasoningEffort,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Cerebras API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const message = data.choices?.[0]?.message;
  if (!message?.content) throw new Error("Cerebras response missing message content");

  return stripReasoningArtifacts(message.content);
}

/**
 * Defensive cleanup: some reasoning models emit a <think>...</think> block
 * or markdown fences inline in `content` instead of a separate field.
 * Strip both before JSON.parse is attempted by callers.
 */
function stripReasoningArtifacts(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

/**
 * Runs a chat completion and returns the plain-text answer, unparsed.
 * Used for the narration call, which is prose rather than JSON.
 */
export async function chatCompletionText(params: {
  systemPrompt: string;
  userPrompt: string;
  reasoningEffort: ReasoningEffort;
  label: string;
}): Promise<string> {
  return withRetry(() => chatCompletion(params), { retries: 1, label: params.label, timeoutMs: 20_000 });
}

/**
 * Runs a chat completion and parses the result as JSON, retrying once with
 * a stricter reminder if parsing fails (per spec: LLM calls must be
 * defensively validated since JSON-only compliance from a reasoning model
 * is not guaranteed).
 */
export async function chatCompletionJson<T>(params: {
  systemPrompt: string;
  userPrompt: string;
  reasoningEffort: ReasoningEffort;
  label: string;
}): Promise<T> {
  return withRetry(
    async () => {
      const raw = await chatCompletion(params);
      try {
        return JSON.parse(raw) as T;
      } catch {
        const strictPrompt = `${params.systemPrompt}\n\nIMPORTANT: Your previous response could not be parsed as JSON. Output ONLY the raw JSON value — no prose, no markdown code fences, no explanation before or after.`;
        const retryRaw = await chatCompletion({ ...params, systemPrompt: strictPrompt });
        return JSON.parse(retryRaw) as T;
      }
    },
    { retries: 1, label: params.label, timeoutMs: 20_000 }
  );
}
