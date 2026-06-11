import { runCommand } from "./lib/process.js";

const steps: Array<[string, string[]]> = [
  ["pnpm", ["--filter", "@workspace/api-spec", "run", "codegen"]],
  ["pnpm", ["run", "typecheck:libs"]],
  ["pnpm", ["-r", "--workspace-concurrency", "1", "--filter", "./artifacts/**", "--filter", "./scripts", "--if-present", "run", "typecheck"]],
];

try {
  for (const [command, args] of steps) {
    console.log(`\n> ${[command, ...args].join(" ")}`);
    await runCommand(command, args);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
