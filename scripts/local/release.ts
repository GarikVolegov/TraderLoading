/** Update the already integrated local app. Never creates a project or migrates a database. */
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { loadEnvLocal, repoRoot } from "./lib/env.js";
import { checkTcp, waitForHttp } from "./lib/health.js";
import { runCommand } from "./lib/process.js";
import {
  assertLocalReleaseTarget,
  assertOwnedListener,
  assertReleasedApi,
  releaseGateEnv,
} from "./releaseChecks.js";
import { resolveDatabaseTarget } from "./startDatabase.js";

const exec = (command: string, args: string[]) =>
  execFileSync(command, args, { cwd: repoRoot, encoding: "utf8" }).trim();
const readJson = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const outputRoot = path.join(repoRoot, ".local-logs/process-integration");
const markerPath = path.join(outputRoot, "current-api.json");
const lockPath = path.join(outputRoot, "release.lock");
const sourceSnapshot = () => {
  const hash = createHash("sha256");
  const files = [
    ...new Set(exec("git", ["ls-files", "-co", "--exclude-standard", "-z"]).split("\0")),
  ]
    .filter(
      (file) =>
        /^(?:artifacts|contracts|lib|scripts)\//.test(file) ||
        /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|eslint\.config\.[^/]+)$/.test(
          file,
        ),
    )
    .filter((file) => /\.(?:tsx?|jsx?|mjs|cjs|json|yaml|yml|sql|css|html)$/.test(file))
    .sort();
  for (const file of files) {
    hash.update(file + "\0");
    if (existsSync(path.join(repoRoot, file))) hash.update(readFileSync(path.join(repoRoot, file)));
    else hash.update("deleted");
    hash.update("\0");
  }
  return hash.digest("hex");
};
const listener = (port: number, packageName: string) => {
  const pids = exec("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"])
    .split(/\s+/)
    .map(Number);
  const cwdLine = exec("lsof", ["-a", "-p", String(pids[0]), "-d", "cwd", "-Fn"])
    .split("\n")
    .find((line) => line.startsWith("n"));
  assert.ok(cwdLine, "Cannot establish the listener workspace");
  return assertOwnedListener(
    pids,
    realpathSync(cwdLine.slice(1)),
    realpathSync(path.join(repoRoot, "artifacts", packageName)),
  );
};
const jsonProbe = async (route: string) => {
  const response = await fetch(`http://127.0.0.1:3001${route}`, {
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(response.status, 200, `Unexpected status for ${route}`);
  return response.json();
};

let locked = false;
let reportPath: string | undefined;
const report: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  status: "checking",
  scope: "existing local app",
};
try {
  assert.equal(process.argv.length, 2, "release:local accepts no bypass flags");
  assert.ok(
    process.platform === "darwin" || process.platform === "linux",
    "This release command requires lsof on macOS or Linux",
  );
  loadEnvLocal();
  assert.ok(existsSync(markerPath), "Integrate the existing local app before releasing it");
  mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
  closeSync(openSync(lockPath, "wx", 0o600));
  locked = true;
  const marker = readJson(markerPath);
  assert.equal(marker.source, "scripts/local/startApiDev.ts", "Unknown API launcher");
  assert.equal(marker.port, 3001, "Unexpected API port");
  const backup = path.resolve(marker.backup);
  assert.ok(existsSync(backup), "Verified integration backup is missing");
  const integration = readJson(path.join(path.dirname(backup), "integration.json"));
  const rehearsal = readJson(path.join(path.dirname(backup), "restore-rehearsal/verified.json"));
  assert.equal(integration.existingRowsUnchanged, true, "Data preservation was not verified");
  assert.equal(path.resolve(integration.backup), backup, "Integration backup differs");
  assert.equal(path.resolve(rehearsal.originalBackup), backup, "Restore rehearsal backup differs");
  assert.equal(rehearsal.fullRestoreSucceeded, true, "Full backup restore was not verified");
  assert.equal(
    rehearsal.additiveIntegrationSucceeded,
    true,
    "Integration rehearsal was not verified",
  );
  const raw = process.env.LOCAL_DATABASE_URL ?? process.env.DATABASE_URL;
  assert.ok(raw, "Local database configuration is missing");
  const target = resolveDatabaseTarget(raw, {
    localDefaultPortOccupied: await checkTcp("127.0.0.1", 5432),
    managedPort: Number(process.env.LOCAL_POSTGRES_PORT ?? "55432"),
  });
  const database = decodeURIComponent(new URL(target.url).pathname.slice(1));
  assertLocalReleaseTarget(target.host, database, integration.database);
  const oldApiPid = listener(3001, "api-server");
  const frontendPid = listener(5173, "trader-dashboard");
  const existing = await jsonProbe("/api/readyz");
  assertReleasedApi(existing);
  const connections = exec("lsof", [
    "-nP",
    "-a",
    "-p",
    String(oldApiPid),
    "-iTCP",
    "-sTCP:ESTABLISHED",
    "-Fn",
  ]);
  assert.ok(
    connections
      .split("\n")
      .some(
        (line) =>
          /^n.*->(?:127\.0\.0\.1|localhost|\[::1\]):/.test(line) &&
          line.endsWith(`:${target.port}`),
      ),
    "Existing API is not connected to the configured local database port",
  );
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const releaseDir = path.join(outputRoot, "releases", stamp);
  mkdirSync(releaseDir, { recursive: true, mode: 0o700 });
  reportPath = path.join(releaseDir, "release.json");
  Object.assign(report, {
    database,
    host: target.host,
    databasePort: target.port,
    backup,
    oldApiPid,
    frontendPid,
    frontendUrl: "http://localhost:5173",
    gates: [],
  });
  // No secrets are inherited by tests. Runtime fixture reads only the configured local schema.
  const gateEnv = releaseGateEnv(process.env);
  const verifiedSource = sourceSnapshot();
  for (const [name, args, extraEnv] of [
    [
      "schema",
      [
        "--filter",
        "./scripts",
        "exec",
        "tsx",
        "local/integrateTraderProcess.ts",
        "--require-ready",
      ],
      { LOCAL_DATABASE_URL: target.url },
    ],
    ["verify", ["verify"], {}],
    ["lint:ci", ["lint:ci"], {}],
    [
      "process runtime + browser",
      ["--filter", "./scripts", "exec", "tsx", "verify-trader-process/runtime.ts"],
      { PROCESS_AUDIT_DATABASE_URL: target.url, PROCESS_AUDIT_BROWSER: "1" },
    ],
  ] as const) {
    console.log(`Local release: ${name}`);
    await runCommand("pnpm", [...args], { env: { ...gateEnv, ...extraEnv }, inheritEnv: false });
    (report.gates as string[]).push(name);
  }
  const evidence: Record<string, number> = {};
  for (const name of ["runtime", "browser"]) {
    const contents = readFileSync(
      path.join(repoRoot, "artifacts.local/trader-process", `${name}.json`),
      "utf8",
    );
    const result = JSON.parse(contents) as { checks?: unknown[]; errors?: unknown[] };
    assert.ok(
      Array.isArray(result.checks) && result.checks.length > 0,
      "Process verification report is empty",
    );
    assert.ok(!result.errors?.length, "Process verification report contains errors");
    writeFileSync(path.join(releaseDir, `${name}.json`), contents, { mode: 0o600 });
    evidence[name] = result.checks.length;
  }
  report.processChecks = evidence;
  const sourceHash = sourceSnapshot();
  assert.equal(
    sourceHash,
    verifiedSource,
    "Source changed during verification; run release:local again",
  );
  const version = `local-${sourceHash.slice(0, 16)}`;
  Object.assign(report, { sourceHash, version, gitHead: exec("git", ["rev-parse", "HEAD"]) });
  // Recheck ownership after the gates; never terminate a replacement listener.
  assert.equal(listener(3001, "api-server"), oldApiPid, "API listener changed during verification");
  assert.equal(
    listener(5173, "trader-dashboard"),
    frontendPid,
    "Frontend listener changed during verification",
  );
  assert.equal(sourceSnapshot(), sourceHash, "Source changed before restart");
  report.status = "restarting";
  writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  process.kill(oldApiPid, "SIGTERM");
  const deadline = Date.now() + 15_000;
  while (await checkTcp("127.0.0.1", 3001)) {
    assert.ok(Date.now() < deadline, "Existing API did not stop; no second API was launched");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const log = openSync(path.join(releaseDir, "api.log"), "wx", 0o600);
  const child = spawn(
    process.execPath,
    [
      createRequire(import.meta.url).resolve("tsx/cli"),
      path.join(repoRoot, "scripts/local/startApiDev.ts"),
    ],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        LOCAL_DATABASE_URL: target.url,
        DATABASE_URL: target.url,
        APP_VERSION: version,
        LOCAL_BACKGROUND_TASKS: "0",
      },
      detached: true,
      stdio: ["ignore", log, log],
    },
  );
  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve);
    child.once("error", reject);
  });
  child.unref();
  closeSync(log);
  const newMarker = {
    launcherPid: child.pid,
    source: "scripts/local/startApiDev.ts",
    port: 3001,
    backgroundTasks: false,
    backup,
    version,
    releaseReport: reportPath,
  };
  writeFileSync(markerPath, JSON.stringify(newMarker, null, 2), { mode: 0o600 });
  await waitForHttp("http://127.0.0.1:3001/api/readyz", 30_000);
  assertReleasedApi(await jsonProbe("/api/readyz"), version);
  assert.equal(
    (await fetch("http://127.0.0.1:3001/api/process", { signal: AbortSignal.timeout(5_000) }))
      .status,
    401,
    "Process must require authentication",
  );
  for (const route of [
    "/",
    "/method",
    "/journal",
    "/resources",
    "/?vista=mercati&pair=EURUSD",
    "/?unlock=success&channel=1",
  ]) {
    const response = await fetch(`http://127.0.0.1:5173${route}`, {
      signal: AbortSignal.timeout(5_000),
    });
    assert.equal(response.status, 200, `Frontend route failed: ${route}`);
    assert.match(await response.text(), /\/src\/main\.tsx/, "Frontend must serve the existing app");
  }
  assert.equal(listener(5173, "trader-dashboard"), frontendPid, "Existing frontend was replaced");
  assert.equal(sourceSnapshot(), sourceHash, "Source changed during release; repeat verification");
  Object.assign(report, {
    status: "complete",
    completedAt: new Date().toISOString(),
    apiPid: listener(3001, "api-server"),
    checks: [
      "version + database readiness",
      "anonymous process denied",
      "four roots + legacy context + checkout SPA routes",
      "same frontend process",
      "source unchanged",
    ],
    backgroundTasks: false,
    schemaWrites: false,
  });
  writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log(
    `Local release complete: ${version}. Existing app: http://localhost:5173. Report: ${reportPath}`,
  );
} catch (error) {
  report.status = "failed";
  report.failedAt = new Date().toISOString();
  if (reportPath) writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (locked) unlinkSync(lockPath);
}
