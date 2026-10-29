import test from "node:test";
import assert from "node:assert/strict";
import { warmupCache } from "./cacheWarmup.js";

test("cacheWarmup: skips when explicitly disabled", async () => {
  const result = await warmupCache({ enabled: false });
  assert.deepEqual(result.warmed, []);
  assert.deepEqual(result.errors, []);
});

test("cacheWarmup: executes injected tasks and aggregates successes and failures", async () => {
  const mockTasks = [
    {
      label: "Task Success",
      fn: async () => ({ ok: true }),
    },
    {
      label: "Task Failure",
      fn: async () => {
        throw new Error("Simulated provider outage");
      },
    },
  ];

  const result = await warmupCache({ enabled: true, tasks: mockTasks });
  assert.deepEqual(result.warmed, ["Task Success"]);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Simulated provider outage/);
});
