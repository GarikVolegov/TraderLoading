import assert from "node:assert/strict";
import { shouldSendPushNotification } from "./pushDedupe.js";

const cache = new Map<string, number>();

assert.equal(shouldSendPushNotification(cache, "u1:session-london", 1_000, 30_000), true);
assert.equal(shouldSendPushNotification(cache, "u1:session-london", 2_000, 30_000), false);
assert.equal(shouldSendPushNotification(cache, "u1:session-london", 31_001, 30_000), true);
assert.equal(shouldSendPushNotification(cache, "u2:session-london", 31_500, 30_000), true);

console.log("push dedupe checks passed");
