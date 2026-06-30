import assert from "node:assert/strict";
import { shouldSendPushNotification } from "./pushDedupe.js";

const cache = new Map<string, number>();

assert.equal(shouldSendPushNotification(cache, "u1:session-london", 1_000, 30_000), true);
assert.equal(shouldSendPushNotification(cache, "u1:session-london", 2_000, 30_000), false);
assert.equal(shouldSendPushNotification(cache, "u1:session-london", 31_001, 30_000), true);
assert.equal(shouldSendPushNotification(cache, "u2:session-london", 31_500, 30_000), true);

// The cache must not grow for the process lifetime: entries older than the window
// are swept out on any later call, so its size is bounded by recently-seen keys.
const sweepCache = new Map<string, number>();
shouldSendPushNotification(sweepCache, "old1", 1_000, 30_000);
shouldSendPushNotification(sweepCache, "old2", 1_000, 30_000);
assert.equal(sweepCache.size, 2);
shouldSendPushNotification(sweepCache, "fresh", 100_000, 30_000);
assert.equal(sweepCache.has("old1"), false);
assert.equal(sweepCache.has("old2"), false);
assert.equal(sweepCache.has("fresh"), true);
assert.equal(sweepCache.size, 1);

console.log("push dedupe checks passed");
