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

// Production without REDIS_URL must fail fast rather than silently degrade to
// per-process rate limits / cron double-runs / lost cross-instance dedup.
assert.throws(
  () => assertRedisConfigured({ NODE_ENV: "production" }),
  /REDIS_URL is required/,
);
assert.throws(
  () => assertRedisConfigured({ NODE_ENV: "production", REDIS_URL: "" }),
  /REDIS_URL is required/,
);

console.log("redis requirement checks passed");
