import assert from "node:assert/strict";
import { shouldRetryQuery } from "./queryRetry.js";

// Finding 2.7: retry was globally off, so a transient blip left widgets broken. Enable
// a smart retry that backs off transient/server/network errors but NEVER retries a 4xx
// (deterministic client error — retrying won't help and hammers auth on a 401).

// 4xx client errors: never retry, regardless of attempt count.
for (const status of [400, 401, 403, 404, 429]) {
  assert.equal(shouldRetryQuery(0, { status }, 2), false, `must not retry ${status}`);
}

// 5xx server errors and network errors (no status): retry up to maxRetries.
assert.equal(shouldRetryQuery(0, { status: 500 }, 2), true);
assert.equal(shouldRetryQuery(1, { status: 503 }, 2), true);
assert.equal(shouldRetryQuery(2, { status: 500 }, 2), false); // exhausted
assert.equal(shouldRetryQuery(0, new Error("network down"), 2), true);
assert.equal(shouldRetryQuery(0, null, 2), true);
assert.equal(shouldRetryQuery(2, new Error("network down"), 2), false);

// A non-numeric status is treated as unknown (retryable, not a 4xx).
assert.equal(shouldRetryQuery(0, { status: "oops" }, 2), true);

console.log("query retry checks passed");
