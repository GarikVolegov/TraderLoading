import assert from "node:assert/strict";
import path from "node:path";
import { repoRoot } from "./env.js";
import { createTestRunPlan } from "./testRunner.js";

const plan = createTestRunPlan([
  {
    absolutePath: path.join(repoRoot, "scripts", "local", "lib", "health.test.ts"),
    relativePath: "scripts/local/lib/health.test.ts",
    packageRoot: path.join(repoRoot, "scripts"),
  },
  {
    absolutePath: path.join(repoRoot, "artifacts", "trader-dashboard", "src", "components", "ChartReplay.mobile-layout.test.ts"),
    relativePath: "artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts",
    packageRoot: path.join(repoRoot, "artifacts", "trader-dashboard"),
  },
]);

assert.deepEqual(plan.map((item) => item.displayPath), [
  "scripts/local/lib/health.test.ts",
  "artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts",
]);
assert.deepEqual(plan.map((item) => item.command), ["node", "node"]);
assert.equal(plan[0]?.args[0], "--import");
assert.match(plan[0]?.args[1] ?? "", /^file:\/\/\/.*tsx.*loader\.mjs$/);
assert.equal(plan[1]?.args[0], "--import");
assert.equal(plan[1]?.args[1], plan[0]?.args[1]);
assert.deepEqual(plan.map((item) => item.args), [
  ["--import", plan[0]?.args[1], "local/lib/health.test.ts"],
  ["--import", plan[0]?.args[1], "src/components/ChartReplay.mobile-layout.test.ts"],
]);
assert.equal(plan[0]?.cwd, path.join(repoRoot, "scripts"));
assert.equal(plan[1]?.cwd, path.join(repoRoot, "artifacts", "trader-dashboard"));

console.log("test runner plan checks passed");
