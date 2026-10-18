// Keep standalone VS Code startup consistent with the full local stack.
// Vite's app root does not automatically load the repository's .env.local.
import { loadEnvLocal } from "./lib/env.js";
import { spawnLongRunning } from "./lib/process.js";
import { buildFrontendDevArgs, buildFrontendDevEnv } from "./startEnv.js";

loadEnvLocal();
const frontend = spawnLongRunning("pnpm", buildFrontendDevArgs(), {
  env: buildFrontendDevEnv(),
  label: "frontend dev server",
});
process.on("SIGINT", () => frontend.kill("SIGINT"));
process.on("SIGTERM", () => frontend.kill("SIGTERM"));
frontend.on("exit", (code) => { process.exitCode = code ?? 0; });
