import assert from "node:assert/strict";
import { z } from "zod";
import { classifyApiError } from "./apiError.js";

// Finding 2.8: a ZodError from malformed input is a client error → 400, not a 500
// (which also spammed Sentry). The body names the failed fields.
let zodErr: unknown;
try {
  z.object({ email: z.string().email() }).parse({ email: 123 });
} catch (e) {
  zodErr = e;
}
const zodResult = classifyApiError(zodErr);
assert.equal(zodResult.status, 400);
assert.equal(zodResult.capture, false);
assert.equal(zodResult.body.error, "Invalid request");
assert.ok(Array.isArray(zodResult.body.details));
assert.ok((zodResult.body.details as unknown[]).length > 0);

// The monorepo can hold multiple zod copies, so `instanceof ZodError` is unreliable
// across module instances. A ZodError-shaped object is still recognized structurally.
const foreignZod = { name: "ZodError", issues: [{ path: ["x"], message: "Required" }] };
const foreignResult = classifyApiError(foreignZod);
assert.equal(foreignResult.status, 400);
assert.equal(foreignResult.capture, false);

// Any other error stays a 500 and is captured.
const result500 = classifyApiError(new Error("boom"));
assert.equal(result500.status, 500);
assert.equal(result500.capture, true);
assert.equal(result500.body.error, "Internal server error");
assert.equal(result500.body.details, undefined);

console.log("apiError classification checks passed");
