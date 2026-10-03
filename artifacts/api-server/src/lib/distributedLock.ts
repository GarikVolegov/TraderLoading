import { getSharedRedisClient } from "./redisClient.js";
import logger from "./logger.js";

/** Minimal slice of the Redis client used for locking (SET key val NX PX ttl). */
export interface LockRedisClient {
  set(
    key: string,
    value: string,
    options: { NX: true; PX: number },
  ): Promise<string | null>;
}

type GetLockClient = () => Promise<LockRedisClient> | null;

/**
 * Acquire a one-shot distributed lock via `SET key 1 NX PX <ttl>`. Returns true
 * when THIS instance won the lock for the TTL window, so callers can run work
 * exactly once across a horizontally-scaled fleet (cron leader-election, etc.).
 *
 * Degradation, by design:
 * - No Redis configured → returns true. There is no peer to coordinate with, so
 *   the single instance owns every lock (correct for vertical/dev deploys).
 * - Redis error → returns true (fail OPEN). For periodic jobs, running and
 *   risking a duplicate during a Redis outage beats silently skipping the job.
 */
export async function tryAcquireLock(
  key: string,
  ttlMs: number,
  getClient: GetLockClient = getSharedRedisClient as unknown as GetLockClient,
): Promise<boolean> {
  const pending = getClient();
  if (!pending) return true;
  try {
    const client = await pending;
    const result = await client.set(key, "1", { NX: true, PX: ttlMs });
    return result === "OK";
  } catch (err) {
    logger.warn({ err, key }, "Distributed lock acquire failed; proceeding without it");
    return true;
  }
}
