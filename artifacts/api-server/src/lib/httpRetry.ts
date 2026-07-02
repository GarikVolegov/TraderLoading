/** Transient HTTP statuses worth retrying: rate limit (429) and 5xx server errors. */
export function isRetriableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

interface FetchWithRetryOptions {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * fetch() with bounded exponential-backoff retries for transient failures, so a
 * single 429/5xx or dropped connection doesn't abort a long ingestion run. Each
 * attempt gets a fresh AbortSignal.timeout (a reused signal would already be
 * aborted on retry). Non-transient responses (e.g. 400/404) and the final attempt
 * are returned as-is for the caller to handle; a thrown network error on the final
 * attempt is rethrown.
 */
export async function fetchWithRetry(url: string, options: FetchWithRetryOptions = {}): Promise<Response> {
  const { retries = 3, baseDelayMs = 500, timeoutMs = 15_000, headers, fetchImpl = fetch, sleep = defaultSleep } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers });
      if (response.ok || !isRetriableHttpStatus(response.status) || attempt === retries) {
        return response;
      }
    } catch (err) {
      lastError = err;
      if (attempt === retries) throw err;
    }
    await sleep(baseDelayMs * 2 ** attempt);
  }
  // Unreachable in practice (the loop returns or throws), but satisfies the type.
  throw lastError ?? new Error("fetchWithRetry: exhausted retries");
}
