import assert from "node:assert/strict";
import { discoverTestFiles } from "./testDiscovery.js";

const files = discoverTestFiles();

assert.ok(files.length >= 35, `expected existing test files to be discovered, got ${files.length}`);
assert.ok(files.some((file) => file.relativePath === "scripts/local/lib/health.test.ts"));
assert.ok(files.some((file) => file.relativePath === "artifacts/api-server/src/routes/account-bridge.test.ts"));
assert.ok(files.some((file) => file.relativePath === "artifacts/trader-dashboard/src/components/ChartReplay.mobile-layout.test.ts"));
assert.ok(!files.some((file) => file.relativePath.endsWith("src/pages/Backtest.tsx")));
assert.ok(!files.some((file) => file.relativePath.endsWith("src/routes/backtest.ts")));
assert.ok(files.every((file) => file.packageRoot.endsWith("scripts") || file.packageRoot.includes("artifacts") || file.packageRoot.includes("lib")));

console.log("test discovery checks passed");
