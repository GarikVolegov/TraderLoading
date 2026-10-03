import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import { getRateLimitKey } from "./security.js";
import { createRedisRateLimitStore, type RateLimitRedis } from "./rateLimitStore.js";
import { getSharedRedisClient } from "./redisClient.js";

// Per-user (keyed by getRateLimitKey) limiter for money-moving / Stripe-resource-creating
// endpoints — checkout, Connect onboarding, payout, channel unlock. Tighter than the
// global /api limiter so a single account can't spam Stripe or hammer the payout path.
// Reuses the shared Redis store when present (cross-instance), else a per-process store —
// same wiring as app.ts / support.ts.
export function createMoneyRateLimiter(opts: { windowMs: number; limit: number }): RateLimitRequestHandler {
  const store = process.env.REDIS_URL
    ? createRedisRateLimitStore({
        getClient: async () => {
          const pending = getSharedRedisClient();
          return pending ? ((await pending) as unknown as RateLimitRedis) : null;
        },
      })
    : undefined;
  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    keyGenerator: getRateLimitKey,
    legacyHeaders: false,
    standardHeaders: true,
    ...(store ? { store } : {}),
  });
}
