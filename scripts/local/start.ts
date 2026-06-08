import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnvLocal, repoRoot } from "./lib/env.js";
import { checkTcp, describePortOwners, waitForHttp, waitForTcp } from "./lib/health.js";
import { runCommand, spawnLongRunning } from "./lib/process.js";
import { resolveDatabaseTarget, type DatabaseTarget } from "./startDatabase.js";
import { buildApiDevEnv, buildFrontendDevArgs, buildFrontendDevEnv } from "./startEnv.js";

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
  const owners = await describePortOwners(port);
  if (!owners.startsWith("No Windows TCP owner")) {
    throw new Error(`Port ${port} is already in use: ${owners}`);
  }
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

loadEnvLocal();

let api: ReturnType<typeof spawnLongRunning> | undefined;
let frontend: ReturnType<typeof spawnLongRunning> | undefined;

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

  console.log("\n> ensuring Docker Postgres container");
  if (database.managed) {
    await ensureDatabaseContainer(database.port);
  }

  console.log(`\n> waiting for TCP ${database.host}:${database.port}`);
  await waitForTcp(database.host, database.port, 60_000);

  console.log("\n> pnpm install");
  await runCommand("pnpm", ["install"]);

  console.log("\n> pnpm --filter @workspace/api-spec run codegen");
  await runCommand("pnpm", ["--filter", "@workspace/api-spec", "run", "codegen"]);

  console.log("\n> pnpm --filter @workspace/db run push");
  await runCommand("pnpm", ["--filter", "@workspace/db", "run", "push"], {
    env: { DATABASE_URL: database.url },
  });

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

  const shutdown = () => {
    api?.kill();
    frontend?.kill();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} catch (error) {
  api?.kill();
  frontend?.kill();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
