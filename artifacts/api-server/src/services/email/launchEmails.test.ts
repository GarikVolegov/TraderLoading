import assert from "node:assert/strict";
import { launchEmailRetry } from "./launchEmails.js";
const created = new Date("2026-10-20T08:00:00Z");
assert.equal(launchEmailRetry(1, created, created)?.toISOString(), "2026-10-20T08:02:00.000Z");
assert.equal(launchEmailRetry(5, created, created)?.toISOString(), "2026-10-20T08:32:00.000Z");
assert.equal(launchEmailRetry(12, created, created), null);
assert.equal(launchEmailRetry(4, created, new Date("2026-10-21T06:55:00Z")), null);
console.log("Launch retry window remains inside provider idempotency retention");
