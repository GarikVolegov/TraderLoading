import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import { loadEnvLocal, repoRoot } from "./lib/env.js";
import { checkHttp, waitForHttp } from "./lib/health.js";
import { scanRuntimeErrorsSince } from "./lib/runtimeLogs.js";
import { createRuntimeSmokePlan, getPostCodegenSettleDelayMs, type RuntimeSmokeService } from "./lib/runtimeSmoke.js";
import { runCommand } from "./lib/process.js";
import { buildFrontendDevEnv } from "./startEnv.js";

type StartedProcess = {
  name: RuntimeSmokeService["name"];
  child: ChildProcess;
};

const logsDir = path.join(repoRoot, ".local-logs");
const markerPath = path.join(logsDir, "runtime-session.json");

function spawnLogged(service: RuntimeSmokeService): StartedProcess {
  const isApi = service.name === "api";
  const logPrefix = `runtime-smoke-${service.name}`;
  const out = createWriteStream(path.join(logsDir, `${logPrefix}.out.log`), { flags: "a" });
  const err = createWriteStream(path.join(logsDir, `${logPrefix}.err.log`), { flags: "a" });
  const command = "pnpm";
  const args = isApi
    ? ["--filter", "@workspace/api-server", "exec", "tsx", "./src/index.ts"]
    : ["--filter", "@workspace/trader-dashboard", "run", "dev"];
  const env = isApi
    ? { ...process.env, BASE_PATH: "/", NODE_ENV: "development", PORT: "3001" }
    : buildFrontendDevEnv({ ...process.env, BASE_PATH: "/", PORT: "5173" });

  const resolved = resolveSpawnCommand(command, args);
  const child = spawn(resolved.command, resolved.args, {
    cwd: repoRoot,
    env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  child.stdout?.pipe(out);
  child.stderr?.pipe(err);
  child.on("exit", () => {
    out.end();
    err.end();
  });

  return { name: service.name, child };
}

function quoteWindowsPart(value: string): string {
  if (!/[\s"&|<>^]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function resolveSpawnCommand(command: string, args: string[]): { command: string; args: string[] } {
  if (process.platform !== "win32") {
    return { command, args };
  }

  return {
    command: process.env["ComSpec"] ?? "cmd.exe",
    args: ["/d", "/c", [command, ...args].map(quoteWindowsPart).join(" ")],
  };
}

function stopStarted(started: StartedProcess[]): void {
  for (const service of [...started].reverse()) {
    const pid = service.child.pid;
    if (pid && process.platform === "win32") {
      spawnSync("taskkill.exe", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
    } else if (!service.child.killed) {
      service.child.kill("SIGTERM");
    }
  }
}

async function main(): Promise<void> {
  mkdirSync(logsDir, { recursive: true });
  loadEnvLocal();

  const frontendReachableBeforeCodegen = (await checkHttp("http://127.0.0.1:5173")).ok;

  console.log("> pnpm --filter @workspace/api-spec run codegen");
  await runCommand("pnpm", ["--filter", "@workspace/api-spec", "run", "codegen"]);

  const settleDelayMs = getPostCodegenSettleDelayMs({ frontendReachableBeforeCodegen });
  if (settleDelayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, settleDelayMs));
  }

  const startedAtMs = Date.now();
  writeFileSync(markerPath, JSON.stringify({ startedAtMs, startedAt: new Date(startedAtMs).toISOString() }, null, 2));

  const apiReachable = (await checkHttp("http://127.0.0.1:3001/api/healthz")).ok;
  const frontendReachable = (await checkHttp("http://127.0.0.1:5173")).ok;
  const plan = createRuntimeSmokePlan({ apiReachable, frontendReachable });
  const started = plan.map(spawnLogged);

  try {
    if (plan.length > 0) {
      console.log(`Started ${plan.map((service) => service.name).join(", ")} for runtime smoke.`);
    } else {
      console.log("Reusing already running API and frontend for runtime smoke.");
    }

    console.log("> waiting for API health");
    await waitForHttp("http://127.0.0.1:3001/api/healthz", 30_000);
    console.log("> waiting for frontend");
    await waitForHttp("http://127.0.0.1:5173", 45_000);
    console.log("> waiting for frontend API proxy");
    await waitForHttp("http://127.0.0.1:5173/api/checklist", 15_000);
    console.log("> scanning fresh runtime errors");
    await new Promise((resolve) => setTimeout(resolve, 2_000));

    const errors = scanRuntimeErrorsSince(startedAtMs);
    if (errors.length > 0) {
      for (const error of errors.slice(0, 10)) {
        console.error(
          `Runtime error in ${error.sourceFile}: ${error.message}${error.location ? ` at ${error.location}` : ""}`,
        );
      }
      throw new Error(`${errors.length} runtime error(s) found after smoke start`);
    }

    console.log("Runtime smoke passed.");
  } finally {
    stopStarted(started);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
