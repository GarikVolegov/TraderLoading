import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { runCommand } from "./process.js";
import type { TestFile } from "./testDiscovery.js";

const require = createRequire(import.meta.url);
const tsxLoaderUrl = pathToFileURL(require.resolve("tsx")).href;

export type TestRunItem = {
  command: string;
  cwd: string;
  args: string[];
  displayPath: string;
};

export type TestRunResult = {
  passed: number;
  failed: Array<{ path: string; error: string }>;
};

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

export function createTestRunPlan(files: TestFile[]): TestRunItem[] {
  return files.map((file) => ({
    command: "node",
    cwd: file.packageRoot,
    args: ["--import", tsxLoaderUrl, toPosixPath(path.relative(file.packageRoot, file.absolutePath))],
    displayPath: file.relativePath,
  }));
}

export async function runTests(plan: TestRunItem[]): Promise<TestRunResult> {
  const failed: TestRunResult["failed"] = [];
  let passed = 0;

  for (const item of plan) {
    console.log(`\n> ${item.displayPath}`);
    try {
      await runCommand(item.command, item.args, {
        cwd: item.cwd,
        label: `${item.command} ${item.args.join(" ")} (${item.displayPath})`,
      });
      passed += 1;
    } catch (error) {
      failed.push({
        path: item.displayPath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { passed, failed };
}
