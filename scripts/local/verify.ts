import { runCommand } from "./lib/process.js";

const steps: Array<[string, string[]]> = [
  ["pnpm", ["install"]],
  ["pnpm", ["--filter", "@workspace/api-spec", "run", "codegen"]],
  ["pnpm", ["run", "typecheck:libs"]],
  ["pnpm", ["-r", "--filter", "./artifacts/**", "--filter", "./scripts", "--if-present", "run", "typecheck"]],
  ["pnpm", ["--filter", "./scripts", "exec", "tsx", "local/run-tests.ts"]],
  ["pnpm", ["-r", "--if-present", "run", "build"]],
];

try {
  for (const [command, args] of steps) {
    console.log(`\n> ${[command, ...args].join(" ")}`);
    await runCommand(command, args);
  }

  console.log("\nVerification passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
