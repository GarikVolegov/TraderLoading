import assert from "node:assert/strict";

import { sanitizeRequestLogPath } from "./loggingMiddleware.js";

assert.equal(
  sanitizeRequestLogPath({
    path: "/api/companion/orders/pending",
    originalUrl:
      "/api/companion/orders/pending?profileId=profile-1&token=secret-token",
  }),
  "/api/companion/orders/pending",
);

assert.equal(
  sanitizeRequestLogPath({
    path: "/api/brokers/companion/downloads/mt5-settings",
    originalUrl:
      "/api/brokers/companion/downloads/mt5-settings?token=secret-token",
  }),
  "/api/brokers/companion/downloads/mt5-settings",
);

console.log("logging middleware security checks passed");
