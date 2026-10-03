import assert from "node:assert/strict";

import { consumeQuota } from "./userQuota.js";

// In-memory fallback (no Redis): enforces the limit per window on a single
// instance, then resets once the window elapses.
{
  const store = new Map<string, { count: number; resetAt: number }>();
  let t = 1_000_000;
  const opts = { getClient: () => null, memoryStore: store, now: () => t };

  assert.deepEqual(await consumeQuota("u1", 2, 60, opts), { allowed: true, remaining: 1, limit: 2 });
  assert.deepEqual(await consumeQuota("u1", 2, 60, opts), { allowed: true, remaining: 0, limit: 2 });
  assert.deepEqual(await consumeQuota("u1", 2, 60, opts), { allowed: false, remaining: 0, limit: 2 });

  t += 60_001; // window elapsed
  assert.deepEqual(await consumeQuota("u1", 2, 60, opts), { allowed: true, remaining: 1, limit: 2 });
}

// Redis path: INCR drives the count; EXPIRE is set once, on the first increment.
{
  let count = 0;
  const expireCalls: Array<[string, number]> = [];
  const client = {
    incr: async () => {
      count += 1;
      return count;
    },
    expire: async (key: string, seconds: number) => {
      expireCalls.push([key, seconds]);
      return true;
    },
  };
  const opts = { getClient: () => Promise.resolve(client) };

  assert.deepEqual(await consumeQuota("k", 2, 30, opts), { allowed: true, remaining: 1, limit: 2 });
  assert.deepEqual(expireCalls, [["k", 30]]);
  assert.deepEqual(await consumeQuota("k", 2, 30, opts), { allowed: true, remaining: 0, limit: 2 });
  assert.deepEqual(await consumeQuota("k", 2, 30, opts), { allowed: false, remaining: 0, limit: 2 });
  assert.equal(expireCalls.length, 1);
}

// Redis error → fail open (allow the request rather than block a paying user).
{
  const client = {
    incr: async () => {
      throw new Error("redis down");
    },
    expire: async () => true,
  };
  const result = await consumeQuota("k", 1, 30, { getClient: () => Promise.resolve(client) });
  assert.equal(result.allowed, true);
}

console.log("user quota checks passed");
