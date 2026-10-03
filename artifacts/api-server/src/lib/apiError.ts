// Maps a thrown error to an HTTP response shape for the global Express handler.
// Pure so it can be unit-tested without booting the app.

export interface ClassifiedError {
  status: number;
  body: { error: string; details?: unknown };
  /** Whether this should be reported to Sentry (client errors should not be). */
  capture: boolean;
}

interface ZodLikeIssue {
  path: Array<string | number>;
  message: string;
}

/**
 * Structural ZodError check. The monorepo can hold more than one `zod` copy
 * (api-server, api-zod, …), so `instanceof ZodError` is unreliable across module
 * instances — match on the shape instead.
 */
function isZodError(err: unknown): err is { name: string; issues: ZodLikeIssue[] } {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: unknown }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

export function classifyApiError(err: unknown): ClassifiedError {
  if (isZodError(err)) {
    return {
      status: 400,
      body: {
        error: "Invalid request",
        details: err.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      },
      capture: false,
    };
  }
  return { status: 500, body: { error: "Internal server error" }, capture: true };
}
