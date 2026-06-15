import assert from "node:assert/strict";

import {
  createRedisRateLimitStore,
  type RateLimitRedis,
} from "./rateLimitStore.js";

const noopWarn = () => undefined;

// ── Fake Redis that mimics the INCR/PEXPIRE/PTTL window the Lua script runs ──
function createFakeRedis(): RateLimitRedis & {
  store: Map<string, { hits: number; ttlMs: number }>;
  evalCalls: number;
} {
  const store = new Map<string, { hits: number; ttlMs: number }>();
  return {
    store,
    evalCalls: 0,
    async eval(_script, options) {
      this.evalCalls += 1;
      const key = options.keys[0];
      const windowMs = Number(options.arguments[0]);
      const entry = store.get(key) ?? { hits: 0, ttlMs: windowMs };
      entry.hits += 1;
      if (entry.hits === 1) entry.ttlMs = windowMs;
      store.set(key, entry);
      return [entry.hits, entry.ttlMs];
    },
    async decr(key) {
      const entry = store.get(key);
      if (entry) entry.hits -= 1;
      return entry?.hits ?? 0;
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
  };
}

// increment counts within the window and reports a future reset time.
{
  const redis = createFakeRedis();
  const store = createRedisRateLimitStore({
    getClient: async () => redis,
    now: () => 1_000,
    warn: noopWarn,
  });
  store.init?.({ windowMs: 60_000 } as never);

  const first = await store.increment("ip:1.1.1.1");
  const second = await store.increment("ip:1.1.1.1");
  assert.equal(first.totalHits, 1);
  assert.equal(second.totalHits, 2);
  assert.equal(first.resetTime?.getTime(), 1_000 + 60_000);
  // Namespaced under the default prefix so it can't clash with cache keys.
  assert.ok(redis.store.has("rl:ip:1.1.1.1"));
  // Distinct keys are independent buckets.
  const other = await store.increment("user:abc");
  assert.equal(other.totalHits, 1);
}

// resetKey clears the bucket; decrement walks the counter back.
{
  const redis = createFakeRedis();
  const store = createRedisRateLimitStore({
    getClient: async () => redis,
    warn: noopWarn,
  });
  store.init?.({ windowMs: 1_000 } as never);
  await store.increment("k");
  await store.increment("k");
  await store.decrement("k");
  assert.equal(redis.store.get("rl:k")?.hits, 1);
  await store.resetKey("k");
  assert.equal(redis.store.has("rl:k"), false);
}

// Fail-open: a Redis outage must never block traffic (single hit, no throw).
{
  const store = createRedisRateLimitStore({
    getClient: async () => {
      throw new Error("redis down");
    },
    now: () => 5_000,
    warn: noopWarn,
  });
  store.init?.({ windowMs: 10_000 } as never);
  const result = await store.increment("k");
  assert.equal(result.totalHits, 1);
  assert.equal(result.resetTime?.getTime(), 5_000 + 10_000);
  // decrement/resetKey swallow errors too.
  await store.decrement("k");
  await store.resetKey("k");
}

// No client (REDIS_URL unset path) also fails open rather than throwing.
{
  const store = createRedisRateLimitStore({
    getClient: async () => null,
    warn: noopWarn,
  });
  store.init?.({ windowMs: 2_000 } as never);
  const result = await store.increment("k");
  assert.equal(result.totalHits, 1);
}

console.log("rate-limit store checks passed");
