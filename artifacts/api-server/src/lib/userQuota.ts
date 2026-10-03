import { getSharedRedisClient } from "./redisClient.js";
import logger from "./logger.js";

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/** Minimal slice of the Redis client used for fixed-window counting. */
export interface QuotaRedisClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

interface ConsumeQuotaOptions {
  getClient?: () => Promise<QuotaRedisClient> | null;
  memoryStore?: Map<string, { count: number; resetAt: number }>;
  now?: () => number;
}

// Per-process fallback counter, used only when Redis is not configured (i.e. a
// single-instance/dev deploy — production requires Redis, see assertRedisConfigured).
const defaultMemoryStore = new Map<string, { count: number; resetAt: number }>();

function consumeFromMemory(
  key: string,
  limit: number,
  windowSeconds: number,
  store: Map<string, { count: number; resetAt: number }>,
  now: number,
): QuotaResult {
  const entry = store.get(key);
  if (!entry || now >= entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: 1 <= limit, remaining: Math.max(0, limit - 1), limit };
  }
  entry.count += 1;
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count), limit };
}

/**
 * Fixed-window per-key quota (e.g. "this user may generate 10 AI recaps/day").
 * Backed by Redis INCR + EXPIRE so the count is shared across instances; the first
 * increment in a window arms the TTL. Degrades deliberately:
 * - No Redis configured → a per-process in-memory counter (correct for a single
 *   instance; production requires Redis anyway).
 * - Redis error → fail OPEN (allow): a counting outage must not lock paying users
 *   out of a feature they are entitled to.
 */
export async function consumeQuota(
  key: string,
  limit: number,
  windowSeconds: number,
  options: ConsumeQuotaOptions = {},
): Promise<QuotaResult> {
  const getClient = options.getClient ?? (getSharedRedisClient as unknown as () => Promise<QuotaRedisClient> | null);
  const pending = getClient();
  if (!pending) {
    const now = (options.now ?? Date.now)();
    return consumeFromMemory(key, limit, windowSeconds, options.memoryStore ?? defaultMemoryStore, now);
  }
  try {
    const client = await pending;
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, windowSeconds);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count), limit };
  } catch (err) {
    logger.warn({ err, key }, "Quota check failed; allowing the request");
    return { allowed: true, remaining: limit, limit };
  }
}
