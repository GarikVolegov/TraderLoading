import assert from "node:assert/strict";

import { resolveLlmTimeoutConfig } from "./llmClient.js";

// Defaults: 30s per-attempt timeout, 1 retry — keeps timeout*(1+retries) under the
// platform's ~100s request cutoff so a slow/stuck LLM call fails fast instead of
// hanging the request (the SDK default is 600s).
assert.deepEqual(resolveLlmTimeoutConfig({}), { timeout: 30_000, maxRetries: 1 });

// Valid overrides are parsed (0 retries is a legitimate choice).
assert.deepEqual(
  resolveLlmTimeoutConfig({ BRAIN_LLM_TIMEOUT_MS: "45000", BRAIN_LLM_MAX_RETRIES: "0" }),
  { timeout: 45_000, maxRetries: 0 },
);

// Non-positive timeout and negative/garbage retries fall back to the safe defaults.
assert.deepEqual(
  resolveLlmTimeoutConfig({ BRAIN_LLM_TIMEOUT_MS: "0", BRAIN_LLM_MAX_RETRIES: "-1" }),
  { timeout: 30_000, maxRetries: 1 },
);
assert.deepEqual(
  resolveLlmTimeoutConfig({ BRAIN_LLM_TIMEOUT_MS: "abc", BRAIN_LLM_MAX_RETRIES: "x" }),
  { timeout: 30_000, maxRetries: 1 },
);

console.log("llm timeout config checks passed");
