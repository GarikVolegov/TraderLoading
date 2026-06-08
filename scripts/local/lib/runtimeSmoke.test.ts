import assert from "node:assert/strict";
import { createRuntimeSmokePlan, getPostCodegenSettleDelayMs } from "./runtimeSmoke.js";

assert.deepEqual(
  createRuntimeSmokePlan({ apiReachable: false, frontendReachable: false }).map((service) => service.name),
  ["api", "frontend"],
);

assert.deepEqual(
  createRuntimeSmokePlan({ apiReachable: true, frontendReachable: false }).map((service) => service.name),
  ["frontend"],
);

assert.deepEqual(createRuntimeSmokePlan({ apiReachable: true, frontendReachable: true }), []);

assert.equal(getPostCodegenSettleDelayMs({ frontendReachableBeforeCodegen: true }), 1_500);
assert.equal(getPostCodegenSettleDelayMs({ frontendReachableBeforeCodegen: false }), 0);

console.log("runtime smoke plan checks passed");
