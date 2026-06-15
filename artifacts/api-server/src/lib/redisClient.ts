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
