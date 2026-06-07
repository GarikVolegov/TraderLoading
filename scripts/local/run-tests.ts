import { discoverTestFiles } from "./lib/testDiscovery.js";
import { createTestRunPlan, runTests } from "./lib/testRunner.js";

const files = discoverTestFiles();

if (files.length === 0) {
  console.error("No test files found.");
  process.exitCode = 1;
} else {
  console.log(`Discovered ${files.length} test file(s).`);
  const result = await runTests(createTestRunPlan(files));

  console.log(`\nTest summary: ${result.passed} passed, ${result.failed.length} failed.`);

  if (result.failed.length > 0) {
    for (const failure of result.failed) {
      console.error(`\nFAIL ${failure.path}`);
      console.error(failure.error);
    }
    process.exitCode = 1;
  }
}
