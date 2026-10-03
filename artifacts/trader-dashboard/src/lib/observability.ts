import * as Sentry from "@sentry/react";

function parseSampleRate(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
}

/**
 * Initialise client-side Sentry. No-ops unless VITE_SENTRY_DSN is set, so local
 * dev and preview builds stay silent. Mirrors the backend lib/observability.ts so
 * client-side errors land in the same project the server already reports to —
 * previously the frontend had no error reporting at all.
 */
export function initObservability(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment:
      (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ??
      import.meta.env.MODE ??
      "production",
    release: import.meta.env.VITE_APP_VERSION as string | undefined,
    tracesSampleRate: parseSampleRate(
      import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE as string | undefined,
    ),
  });
}

/** Report a caught error (e.g. from the root error boundary) to Sentry. */
export function captureError(error: unknown, context: Record<string, unknown> = {}): void {
  Sentry.captureException(error, Object.keys(context).length ? { extra: context } : undefined);
}
