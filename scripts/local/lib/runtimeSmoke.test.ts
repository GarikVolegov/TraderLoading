import assert from "node:assert/strict";
import { createRuntimeSmokePlan } from "./runtimeSmoke.js";

assert.deepEqual(
  createRuntimeSmokePlan({ apiReachable: false, frontendReachable: false }).map((service) => service.name),
  ["api", "frontend"],
);

assert.deepEqual(
  createRuntimeSmokePlan({ apiReachable: true, frontendReachable: false }).map((service) => service.name),
  ["frontend"],
);

assert.deepEqual(createRuntimeSmokePlan({ apiReachable: true, frontendReachable: true }), []);

console.log("runtime smoke plan checks passed");
