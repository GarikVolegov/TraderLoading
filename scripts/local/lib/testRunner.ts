import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
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
    const sandbox = await mkdtemp(path.join(tmpdir(), "traderloading-unit-"));
    try {
      const env: NodeJS.ProcessEnv = Object.fromEntries(
        ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "LC_CTYPE", "PNPM_HOME", "CI", "SYSTEMROOT", "ComSpec", "VITE_CLERK_PUBLISHABLE_KEY"]
          .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]),
      );
      Object.assign(env, {
        NODE_ENV: "test",
        // Imports may construct a pg Pool. Accidental queries must fail, never
        // use a developer's database; integration runners have their own DB.
        DATABASE_URL: "postgres://unit:unit@127.0.0.1:1/tl_unit_no_database",
        LOCAL_DATABASE_URL: "postgres://unit:unit@127.0.0.1:1/tl_unit_no_database",
        BROKER_LOCAL_STORE_DIR: path.join(sandbox, "broker"),
        UPLOADS_DIR: path.join(sandbox, "uploads"),
      });
      await runCommand(item.command, item.args, {
        cwd: item.cwd,
        env,
        inheritEnv: false,
        label: `${item.command} ${item.args.join(" ")} (${item.displayPath})`,
      });
      passed += 1;
    } catch (error) {
      failed.push({
        path: item.displayPath,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await rm(sandbox, { recursive: true, force: true });
    }
  }

  return { passed, failed };
}
