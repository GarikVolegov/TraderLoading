// Smart React Query retry: back off transient server/network errors, but never
// retry a 4xx — a client error is deterministic (retrying won't fix a 400/404 and
// hammers auth on a 401). Reads the numeric `status` that ApiError (custom-fetch)
// and apiFetch attach to thrown errors.
export function shouldRetryQuery(failureCount: number, error: unknown, maxRetries = 2): boolean {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status: unknown }).status)
      : Number.NaN;
  if (Number.isFinite(status) && status >= 400 && status < 500) return false;
  return failureCount < maxRetries;
}
