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
 * Fail-fast guard for horizontally-scaled deploys. Without REDIS_URL the rate
 * limiter, cron leader-election and cross-instance dedup all silently fall back
 * to per-process state — which over-counts limits, double-runs cron jobs and
 * loses dedup once more than one instance is live. In production we refuse to
 * boot instead of degrading silently; single-instance dev/test is unaffected.
 */
export function assertRedisConfigured(
  env: { NODE_ENV?: string | undefined; REDIS_URL?: string | undefined } = process.env,
): void {
  if (env.NODE_ENV === "production" && !env.REDIS_URL) {
    throw new Error(
      "REDIS_URL is required when NODE_ENV=production: rate limiting, cron " +
        "leader-election and cross-instance dedup degrade to per-process state " +
        "without it. Provision Redis and set REDIS_URL.",
    );
  }
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
