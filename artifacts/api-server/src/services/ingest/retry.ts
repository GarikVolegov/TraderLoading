// ─── Retry with exponential backoff ──────────────────────────────────────────
// Wraps a flaky async operation (Dukascopy chunk fetches rate-limit hard under
// load) with bounded retries and growing pauses, so a transient failure re-tries
// after a cool-off instead of dropping the whole chunk. `sleep` is injectable so
// the unit tests don't wait real time.

export interface RetryOptions {
  /** Total attempts including the first (must be ≥ 1). */
  attempts: number;
  /** Delay before the 2nd attempt; grows by `factor` each subsequent retry. */
  baseDelayMs: number;
  /** Backoff multiplier (default 2). */
  factor?: number;
  /** Upper bound on any single delay. */
  maxDelayMs?: number;
  /** Notified with (error, attemptIndex) before each backoff (1-based attempt). */
  onRetry?: (error: unknown, attempt: number) => void;
  /** Injectable delay (real setTimeout in prod, no-op in tests). */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { attempts, baseDelayMs, factor = 2, maxDelayMs = Infinity, onRetry, sleep = defaultSleep } = options;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts) break;
      onRetry?.(error, attempt);
      const delay = Math.min(maxDelayMs, baseDelayMs * factor ** (attempt - 1));
      await sleep(delay);
    }
  }
  throw lastError;
}
