import * as Sentry from "@sentry/node";
import type { Event } from "@sentry/node";
import logger from "./logger";

type ObservabilityEnv = Partial<Record<string, string>>;

// Any property whose name matches this is a secret we must never ship to Sentry —
// the same classes the pino logger redacts (see logger.ts `redact.paths`).
const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|api[_-]?key)/i;
const REDACTED = "[REDACTED]";

function redactDeep(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value === null || typeof value !== "object" || depth > 8) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map((entry) => redactDeep(entry, seen, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactDeep(entry, seen, depth + 1);
  }
  return out;
}

/**
 * Redacts secrets from a Sentry event before it leaves the process. Walks the
 * request/extra/contexts branches by key name (Authorization, Cookie, token,
 * password, secret, api key) and collapses the parsed cookie map — whose values
 * are secrets regardless of the (non-sensitive) cookie names. Pure: mutates and
 * returns the event so it can be used directly as Sentry's `beforeSend`.
 */
export function scrubSentryEvent<T extends Event>(event: T): T {
  const seen = new WeakSet<object>();
  if (event.request) {
    if (event.request.headers) {
      event.request.headers = redactDeep(event.request.headers, seen, 0) as typeof event.request.headers;
    }
    if (event.request.cookies) {
      // Cookie names aren't sensitive by key, but the values are — redact them all.
      event.request.cookies = Object.fromEntries(
        Object.keys(event.request.cookies).map((name) => [name, REDACTED]),
      );
    }
    if (event.request.data !== undefined) event.request.data = redactDeep(event.request.data, seen, 0);
  }
  if (event.extra) event.extra = redactDeep(event.extra, seen, 0) as typeof event.extra;
  if (event.contexts) event.contexts = redactDeep(event.contexts, seen, 0) as typeof event.contexts;
  return event;
}

function parseSampleRate(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number(raw);
  if (Number.isFinite(value) && value >= 0 && value <= 1) return value;
  logger.warn({ value: raw }, "Invalid SENTRY_TRACES_SAMPLE_RATE; tracing disabled");
  return undefined;
}

export function initObservability(env: ObservabilityEnv = process.env): void {
  if (!env.SENTRY_DSN) {
    logger.info("Sentry disabled because SENTRY_DSN is not configured");
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV ?? "production",
    release: env.APP_VERSION,
    tracesSampleRate: parseSampleRate(env.SENTRY_TRACES_SAMPLE_RATE),
    beforeSend: scrubSentryEvent,
  });

  logger.info(
    {
      environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV ?? "production",
      release: env.APP_VERSION,
    },
    "Sentry observability initialized",
  );
}

export function captureError(
  err: unknown,
  context: Record<string, unknown> = {},
): void {
  if (context && Object.keys(context).length > 0) {
    Sentry.withScope((scope) => {
      for (const [key, value] of Object.entries(context)) {
        scope.setExtra(key, value);
      }
      Sentry.captureException(err);
    });
    return;
  }

  Sentry.captureException(err);
}

/**
 * Report a background/cron job failure to BOTH the log and Sentry. Critical cron
 * jobs (tornei settle touches XP/Pro/mint, push scheduler, broker auto-sync) used
 * to only `console.error`, so their failures never surfaced in Sentry. Always tags
 * the event `surface: "background"` with the job name so it's filterable. The
 * `capture` seam defaults to captureError and exists for tests.
 */
export function reportJobError(
  err: unknown,
  context: { job: string } & Record<string, unknown>,
  capture: (err: unknown, ctx: Record<string, unknown>) => void = captureError,
): void {
  logger.error({ err, ...context }, `Background job failed: ${context.job}`);
  capture(err, { surface: "background", ...context });
}

export async function flushObservability(timeoutMs = 2_000): Promise<boolean> {
  return Sentry.flush(timeoutMs);
}
