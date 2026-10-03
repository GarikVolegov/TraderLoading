import assert from "node:assert/strict";

import { tryAcquireLock } from "./distributedLock.js";

// No Redis configured (getClient returns null) → the single instance owns every
// lock, so acquisition always succeeds.
assert.equal(await tryAcquireLock("k", 1_000, () => null), true);

// Redis grants the lock: SET NX returns "OK".
const okClient = { set: async () => "OK" as const };
assert.equal(await tryAcquireLock("k", 1_000, () => Promise.resolve(okClient)), true);

// Another instance already holds it: SET NX returns null → we did NOT win.
const heldClient = { set: async () => null };
assert.equal(await tryAcquireLock("k", 1_000, () => Promise.resolve(heldClient)), false);

// Redis error → fail OPEN (true): for cron work, running and risking a duplicate
// during an outage beats silently skipping the job forever.
const errClient = {
  set: async () => {
    throw new Error("redis down");
  },
};
assert.equal(await tryAcquireLock("k", 1_000, () => Promise.resolve(errClient)), true);

// Passes the NX flag and PX ttl through verbatim.
let captured: { key: string; value: string; options: unknown } | null = null;
const capturingClient = {
  set: async (key: string, value: string, options: unknown) => {
    captured = { key, value, options };
    return "OK" as const;
  },
};
await tryAcquireLock("session:42", 55_000, () => Promise.resolve(capturingClient));
assert.deepEqual(captured, {
  key: "session:42",
  value: "1",
  options: { NX: true, PX: 55_000 },
});

console.log("distributed lock checks passed");
