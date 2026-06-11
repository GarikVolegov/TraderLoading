import * as Sentry from "@sentry/node";
import logger from "./logger";

type ObservabilityEnv = Partial<Record<string, string>>;

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

export async function flushObservability(timeoutMs = 2_000): Promise<boolean> {
  return Sentry.flush(timeoutMs);
}
