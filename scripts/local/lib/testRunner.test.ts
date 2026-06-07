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
assert.deepEqual(plan.map((item) => item.args), [
  ["exec", "tsx", "local/lib/health.test.ts"],
  ["exec", "tsx", "src/components/ChartReplay.mobile-layout.test.ts"],
]);
assert.equal(plan[0]?.cwd, path.join(repoRoot, "scripts"));
assert.equal(plan[1]?.cwd, path.join(repoRoot, "artifacts", "trader-dashboard"));

console.log("test runner plan checks passed");
