export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  label?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Retries a failing async operation with exponential backoff.
 * Defaults: 2 retries (3 attempts total), 500ms base delay, 10s per-attempt timeout.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { retries = 2, baseDelayMs = 500, timeoutMs = 10_000, label = "operation" } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs, label);
    } catch (err) {
      lastError = err;
      const isLastAttempt = attempt === retries;
      console.error(
        `[retry] ${label} failed on attempt ${attempt + 1}/${retries + 1}:`,
        err instanceof Error ? err.message : err
      );
      if (isLastAttempt) break;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}
