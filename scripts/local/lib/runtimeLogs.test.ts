import assert from "node:assert/strict";
import { parseRuntimeErrors } from "./runtimeLogs.js";

const log = [
  "plain vite line",
  '[RUNTIME_ERROR]{"type":"runtime-error","timestamp":1000,"message":"old error"}',
  '[RUNTIME_ERROR]{"type":"runtime-error","timestamp":2500,"message":"new error","loc":{"file":"src/App.tsx","line":12}}',
  '[RUNTIME_ERROR]{"type":"runtime-error","timestamp":3000,"name":"Error","message":"another error"} trailing text',
  "[RUNTIME_ERROR]{bad json",
].join("\n");

const errors = parseRuntimeErrors(log, 2000, "frontend.err.log");

assert.equal(errors.length, 2);
assert.equal(errors[0]?.message, "new error");
assert.equal(errors[0]?.sourceFile, "frontend.err.log");
assert.equal(errors[0]?.location, "src/App.tsx:12");
assert.equal(errors[1]?.message, "another error");

console.log("runtime log checks passed");
