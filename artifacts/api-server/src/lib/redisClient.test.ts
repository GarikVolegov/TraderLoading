import assert from "node:assert/strict";

import { assertRedisConfigured } from "./redisClient.js";

// Non-production never refuses to boot, with or without REDIS_URL — single-instance
// dev/test is allowed to use the in-memory fallbacks.
assert.doesNotThrow(() => assertRedisConfigured({ NODE_ENV: "development" }));
assert.doesNotThrow(() => assertRedisConfigured({ NODE_ENV: "test" }));
assert.doesNotThrow(() => assertRedisConfigured({}));
assert.doesNotThrow(() => assertRedisConfigured({ NODE_ENV: "development", REDIS_URL: "" }));

// Production with a Redis URL boots normally.
assert.doesNotThrow(() =>
  assertRedisConfigured({ NODE_ENV: "production", REDIS_URL: "redis://localhost:6379" }),
);

// Production on a SINGLE instance without REDIS_URL must boot: the primary Railway
// deploy is one service and the rate limiter falls back to in-memory by design
// (see .env.railway.example). Regression guard: a fatal check here crash-looped the
// documented single-instance deploy under restartPolicyType=ALWAYS.
assert.doesNotThrow(() => assertRedisConfigured({ NODE_ENV: "production" }));
assert.doesNotThrow(() => assertRedisConfigured({ NODE_ENV: "production", REDIS_URL: "" }));
assert.doesNotThrow(() =>
  assertRedisConfigured({ NODE_ENV: "production", REDIS_URL: "", EXPECTED_REPLICAS: "1" }),
);
// A non-numeric replica hint is treated as single-instance, not a crash.
assert.doesNotThrow(() =>
  assertRedisConfigured({ NODE_ENV: "production", EXPECTED_REPLICAS: "" }),
);

// Production genuinely scaled to >1 replica without REDIS_URL must fail fast: per-process
// rate limits over-count, cron leader-election double-runs and cross-instance dedup is lost.
assert.throws(
  () => assertRedisConfigured({ NODE_ENV: "production", EXPECTED_REPLICAS: "2" }),
  /REDIS_URL is required/,
);
assert.throws(
  () => assertRedisConfigured({ NODE_ENV: "production", REDIS_URL: "", EXPECTED_REPLICAS: "3" }),
  /REDIS_URL is required/,
);

console.log("redis requirement checks passed");
