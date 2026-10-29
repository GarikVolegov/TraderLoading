type SentryModule = typeof import("@sentry/react");

let sentryModule: SentryModule | null = null;
let sentryPromise: Promise<SentryModule | null> | null = null;
const pendingCaptures: Array<{ error: unknown; context: Record<string, unknown> }> = [];

function parseSampleRate(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
}

function loadSentry(dsn: string): Promise<SentryModule | null> {
  if (sentryPromise) return sentryPromise;
  sentryPromise = import("@sentry/react")
    .then((Sentry) => {
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
      sentryModule = Sentry;
      while (pendingCaptures.length > 0) {
        const item = pendingCaptures.shift()!;
        Sentry.captureException(
          item.error,
          Object.keys(item.context).length ? { extra: item.context } : undefined,
        );
      }
      return Sentry;
    })
    .catch(() => null);
  return sentryPromise;
}

/**
 * Initialise client-side Sentry lazily so the ~230 kB SDK is excluded from the
 * critical initial bundle and never loaded at all when VITE_SENTRY_DSN is unset.
 */
export function initObservability(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  void loadSentry(dsn);
}

/** Report a caught error (e.g. from the root error boundary) to Sentry. */
export function captureError(error: unknown, context: Record<string, unknown> = {}): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  if (sentryModule) {
    sentryModule.captureException(error, Object.keys(context).length ? { extra: context } : undefined);
    return;
  }
  if (pendingCaptures.length < 25) {
    pendingCaptures.push({ error, context });
  }
  void loadSentry(dsn);
}
