import assert from "node:assert/strict";
import { initRumTelemetry } from "./rumTelemetry.js";

// Verify initialization safely degrades in node environment
const cleanup = initRumTelemetry((metric) => {
  assert.ok(["LCP", "INP", "CLS", "FCP"].includes(metric.name));
});

assert.equal(typeof cleanup, "function");
cleanup();

console.log("RUM telemetry unit tests passed successfully!");
