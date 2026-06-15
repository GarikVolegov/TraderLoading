import type { ClientRateLimitInfo, Options, Store } from "express-rate-limit";
import logger from "./logger.js";

/**
 * Distributed rate-limit store backed by Redis so the limit is enforced across
 * every Fargate task instead of per-process (the default MemoryStore resets on
 * deploy and counts each instance separately).
 *
 * Window accounting is a single atomic fixed window: INCR the counter and, only
 * on the first hit, PEXPIRE it for the configured window. Atomicity via a Lua
 * script removes the INCR/EXPIRE race that would otherwise let a key live
 * forever if the process died between the two commands.
 *
 * Resilience: rate limiting is best-effort abuse protection, not a correctness
 * gate. If Redis is unreachable we **fail open** (count a single hit) so a cache
 * outage never turns into an API-wide 429/500 storm.
 */

/** Minimal slice of the node-redis client this store depends on (for testing). */
export interface RateLimitRedis {
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
  decr(key: string): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

// KEYS[1] = namespaced key, ARGV[1] = window in ms. Returns [hits, ttlMs].
const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {hits, redis.call('PTTL', KEYS[1])}
`;

export interface RedisRateLimitStoreDeps {
  /** Lazily resolves the Redis client, or null when Redis is unavailable. */
  getClient: () => Promise<RateLimitRedis | null>;
  prefix?: string;
  now?: () => number;
  warn?: (err: unknown, message: string) => void;
}

export function createRedisRateLimitStore(
  deps: RedisRateLimitStoreDeps,
): Store {
  const prefix = deps.prefix ?? "rl:";
  const now = deps.now ?? (() => Date.now());
  const warn =
    deps.warn ?? ((err: unknown, message: string) => logger.warn({ err }, message));
  // express-rate-limit calls init() with the resolved options before first use.
  let windowMs = 60_000;

  const namespaced = (key: string) => `${prefix}${key}`;

  const failOpen = (): ClientRateLimitInfo => ({
    totalHits: 1,
    resetTime: new Date(now() + windowMs),
  });

  return {
    init(options: Options): void {
      windowMs = options.windowMs;
    },

    async increment(key: string): Promise<ClientRateLimitInfo> {
      try {
        const client = await deps.getClient();
        if (!client) return failOpen();
        const result = (await client.eval(INCREMENT_SCRIPT, {
          keys: [namespaced(key)],
          arguments: [String(windowMs)],
        })) as [number, number];
        const totalHits = Number(result[0]);
        const ttlMs = Number(result[1]);
        const resetMs = Number.isFinite(ttlMs) && ttlMs >= 0 ? ttlMs : windowMs;
        return { totalHits, resetTime: new Date(now() + resetMs) };
      } catch (err) {
        warn(err, "Redis rate-limit increment failed; failing open");
        return failOpen();
      }
    },

    async decrement(key: string): Promise<void> {
      try {
        const client = await deps.getClient();
        if (client) await client.decr(namespaced(key));
      } catch (err) {
        warn(err, "Redis rate-limit decrement failed");
      }
    },

    async resetKey(key: string): Promise<void> {
      try {
        const client = await deps.getClient();
        if (client) await client.del(namespaced(key));
      } catch (err) {
        warn(err, "Redis rate-limit resetKey failed");
      }
    },
  };
}
