import assert from "node:assert/strict";

import { createLoggerOptions } from "./logger.js";

const options = createLoggerOptions({ NODE_ENV: "production", LOG_LEVEL: "warn" });

assert.equal(options.level, "warn");
assert.equal(options.transport, undefined);
assert.deepEqual(options.redact, {
  paths: [
    "authorization",
    "cookie",
    "headers.authorization",
    "headers.cookie",
    "*.authorization",
    "*.cookie",
    "*.token",
    "*.password",
    "*.access_token",
    "*.refresh_token",
    "*.clientSecret",
    "err.config.headers.Authorization",
    "err.response.config.headers.Authorization",
  ],
  censor: "[REDACTED]",
});

console.log("logger redaction checks passed");
