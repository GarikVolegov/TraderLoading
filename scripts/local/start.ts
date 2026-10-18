import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadEnvLocal, repoRoot } from "./lib/env.js";
import { checkTcp, describePortOwners, waitForHttp, waitForTcp } from "./lib/health.js";
import { runCommand, spawnLongRunning } from "./lib/process.js";
import { resolveDatabaseTarget, type DatabaseTarget } from "./startDatabase.js";
import { buildApiDevEnv, buildFrontendDevArgs, buildFrontendDevEnv } from "./startEnv.js";

loadEnvLocal();

const containerName = "traderloadings-db";
const postgresEnv = ["POSTGRES_USER=trader", "POSTGRES_PASSWORD=trader", "POSTGRES_DB=traderloadings"];
const managedPostgresPort = Number(process.env["LOCAL_POSTGRES_PORT"] ?? "55432");
const localLogsDir = new URL("../../.local-logs/", import.meta.url);

async function chooseDatabaseUrl(): Promise<DatabaseTarget> {
  const rawUrl = process.env["LOCAL_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  if (!rawUrl) {
    throw new Error("DATABASE_URL is missing. Add it to .env.local before starting the app.");
  }

  const parsed = new URL(rawUrl);
  const host = parsed.hostname;
  const port = Number(parsed.port || "5432");
  const localDefaultPortOccupied = (host === "127.0.0.1" || host === "localhost") && port === 5432 && (await checkTcp("127.0.0.1", 5432));
  const target = resolveDatabaseTarget(rawUrl, {
    localDefaultPortOccupied,
    managedPort: managedPostgresPort,
  });

  if (target.managed && localDefaultPortOccupied) {
    console.log(
      `Port 5432 is already occupied; using managed TraderLoadings Postgres on 127.0.0.1:${managedPostgresPort}.`,
    );
  }

  return target;
}

async function assertPortFree(port: number): Promise<void> {
  if (!(await checkTcp("127.0.0.1", port))) return;
  const owners = await describePortOwners(port);
  throw new Error(`Port ${port} is already in use. Stop the previous local server first. ${owners}`);
}

async function startExistingMacDatabase(database: DatabaseTarget): Promise<void> {
  if (process.platform !== "darwin" || !["localhost", "127.0.0.1"].includes(database.host) ||
      database.port !== managedPostgresPort || await checkTcp(database.host, database.port)) return;
  const pgCtl = path.join(homedir(), "Applications/Postgres.app/Contents/Versions/16/bin/pg_ctl");
  const dataDir = path.join(repoRoot, ".local-postgres");
  if (!existsSync(pgCtl) || !existsSync(path.join(dataDir, "PG_VERSION"))) return;
  console.log(`Starting the existing Postgres.app database on ${database.host}:${database.port}.`);
  await runCommand(pgCtl, ["-D", dataDir, "-o", `-p ${database.port}`, "-l", path.join(repoRoot, ".local-logs/postgres.log"), "start", "-w", "-t", "30"]);
}

async function dockerAvailable(): Promise<boolean> {
  try {
    await runCommand("docker", ["info"], { stdio: "pipe", label: "docker info" });
    return true;
  } catch {
    return false;
  }
}

async function ensureDatabaseContainer(port: number): Promise<void> {
  if (await checkTcp("127.0.0.1", port)) {
    console.log(`Postgres is already reachable on 127.0.0.1:${port}; reusing it.`);
    return;
  }

  if (!(await dockerAvailable())) {
    throw new Error("Docker daemon is not responding. Open Docker Desktop, wait until it is running, then retry.");
  }

  const effectiveContainerName = port === 5432 ? containerName : `${containerName}-${port}`;
  const inspect = await runCommand("docker", ["container", "inspect", effectiveContainerName], {
    stdio: "pipe",
    label: `docker container inspect ${effectiveContainerName}`,
  }).catch(() => undefined);

  if (inspect) {
    await runCommand("docker", ["start", effectiveContainerName]);
    return;
  }

  await runCommand("docker", [
    "run",
    "--name",
    effectiveContainerName,
    "-e",
    postgresEnv[0],
    "-e",
    postgresEnv[1],
    "-e",
    postgresEnv[2],
    "-p",
    `${port}:5432`,
    "-d",
    "postgres:16-alpine",
  ]);
}

let api: ReturnType<typeof spawnLongRunning> | undefined;
let frontend: ReturnType<typeof spawnLongRunning> | undefined;
let historyWorker: ReturnType<typeof spawnLongRunning> | undefined;

try {
  mkdirSync(localLogsDir, { recursive: true });
  writeFileSync(
    new URL("runtime-session.json", localLogsDir),
    JSON.stringify({ startedAtMs: Date.now(), startedAt: new Date().toISOString() }, null, 2),
  );

  await assertPortFree(3001);
  await assertPortFree(5173);
  const database = await chooseDatabaseUrl();
  process.env["DATABASE_URL"] = database.url;

  await startExistingMacDatabase(database);
  if (database.managed) {
    await ensureDatabaseContainer(database.port);
  }

  console.log(`\n> waiting for TCP ${database.host}:${database.port}`);
  await waitForTcp(database.host, database.port, 60_000);

  console.log("\n> pnpm install");
  await runCommand("pnpm", ["install"]);

  console.log("\n> pnpm --filter @workspace/api-spec run codegen");
  await runCommand("pnpm", ["--filter", "@workspace/api-spec", "run", "codegen"]);

  console.log("\n> reusing the database schema unchanged (migrations are a separate operation)");

  console.log("\n> starting API on http://127.0.0.1:3001");
  api = spawnLongRunning("pnpm", ["--filter", "@workspace/api-server", "exec", "tsx", "./src/index.ts"], {
    cwd: repoRoot,
    env: buildApiDevEnv(process.env, database.url),
    label: "api server",
  });
  await waitForHttp("http://127.0.0.1:3001/api/healthz", 30_000);

  console.log("\n> starting frontend on http://127.0.0.1:5173");
  frontend = spawnLongRunning("pnpm", buildFrontendDevArgs(), {
    cwd: repoRoot,
    env: buildFrontendDevEnv({ ...process.env, BASE_PATH: "/", PORT: "5173" }),
    label: "frontend dev server",
  });
  await waitForHttp("http://127.0.0.1:5173", 30_000);
  console.log("\nTraderLoadings is running at http://localhost:5173");

  if (process.env["CANDLE_WAREHOUSE"] === "1" && process.env["BACKTEST_HISTORY_SYNC"] !== "0") {
    console.log("\n> synchronizing durable backtest history in the background (XAUUSD, EURUSD, USOIL)");
    historyWorker = spawnLongRunning(process.execPath, ["--import", createRequire(import.meta.url).resolve("tsx"), fileURLToPath(new URL("./backtestHistoryWorker.ts", import.meta.url))], {
      cwd: repoRoot,
      env: { DATABASE_URL: database.url },
      label: "backtest history worker",
    });
  }

  const shutdown = () => {
    api?.kill();
    frontend?.kill();
    historyWorker?.kill();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  api?.kill();
  frontend?.kill();
  historyWorker?.kill();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
