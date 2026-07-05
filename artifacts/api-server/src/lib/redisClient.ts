import { createClient, type RedisClientType } from "redis";
import logger from "./logger.js";

/**
 * Shared Redis connection for cross-instance coordination (rate limiting, and
 * any future distributed primitive). Kept separate from the cache store in
 * `cache.ts` so cache and coordination concerns can evolve independently; node
 * happily multiplexes a couple of connections per process.
 *
 * Returns `null` when REDIS_URL is unset so callers can degrade to a
 * single-instance in-memory fallback (correct for local dev).
 */
/**
 * Guard for horizontally-scaled deploys. Without REDIS_URL the rate limiter,
 * cron leader-election and cross-instance dedup all fall back to per-process
 * state — which over-counts limits, double-runs cron jobs and loses dedup once
 * more than one instance is live.
 *
 * The primary Railway deploy is a *single* service where that in-memory fallback
 * is correct and documented (see .env.railway.example), so we must NOT refuse to
 * boot there — a fatal check crash-looped it under restartPolicyType=ALWAYS. We
 * only fail fast when the deploy is genuinely scaled out, signalled by
 * `EXPECTED_REPLICAS > 1`; otherwise we warn and run single-instance.
 */
export function assertRedisConfigured(
  env: {
    NODE_ENV?: string | undefined;
    REDIS_URL?: string | undefined;
    EXPECTED_REPLICAS?: string | undefined;
  } = process.env,
): void {
  if (env.NODE_ENV !== "production" || env.REDIS_URL) return;

  const replicas = Number.parseInt(env.EXPECTED_REPLICAS ?? "", 10);
  if (Number.isFinite(replicas) && replicas > 1) {
    throw new Error(
      "REDIS_URL is required when EXPECTED_REPLICAS>1: rate limiting, cron " +
        "leader-election and cross-instance dedup degrade to per-process state " +
        "across replicas without it. Provision Redis and set REDIS_URL.",
    );
  }

  logger.warn(
    "REDIS_URL is unset in production: running single-instance with in-memory rate " +
      "limiting and cron. Set EXPECTED_REPLICAS>1 and REDIS_URL before scaling out.",
  );
}

let clientPromise: Promise<RedisClientType> | null = null;

export function getSharedRedisClient(
  redisUrl: string | undefined = process.env.REDIS_URL,
): Promise<RedisClientType> | null {
  if (!redisUrl) return null;
  if (!clientPromise) {
    const client = createClient({ url: redisUrl }) as RedisClientType;
    client.on("error", (err) => logger.warn({ err }, "Shared Redis client error"));
    clientPromise = client
      .connect()
      .then(() => client)
      .catch((err) => {
        // Reset so the next call retries instead of caching a rejected promise.
        clientPromise = null;
        logger.warn({ err }, "Shared Redis connect failed");
        throw err;
      });
  }
  return clientPromise;
}

export async function closeSharedRedisClient(): Promise<void> {
  if (!clientPromise) return;
  try {
    const client = await clientPromise;
    await client.quit();
  } catch (err) {
    logger.warn({ err }, "Shared Redis quit failed");
  } finally {
    clientPromise = null;
  }
}
