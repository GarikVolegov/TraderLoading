import assert from "node:assert/strict";
import path from "node:path";

export function assertOwnedListener(pids: number[], cwd: string, expectedCwd: string): number {
  const owners = [...new Set(pids)];
  assert.equal(owners.length, 1, "Expected exactly one listener; refusing to replace another app");
  assert.ok(Number.isSafeInteger(owners[0]) && owners[0]! > 0, "Invalid listener PID");
  assert.equal(
    path.resolve(cwd),
    path.resolve(expectedCwd),
    "Listener belongs to another workspace",
  );
  return owners[0]!;
}

export function assertLocalReleaseTarget(
  host: string,
  database: string,
  integratedDatabase: string,
): void {
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]"].includes(host),
    "Local release requires a loopback database",
  );
  assert.ok(database.length > 0, "Database name is missing");
  assert.equal(database, integratedDatabase, "Database differs from the verified integration");
}

/** Gates receive public build configuration, never personal integration credentials. */
export function releaseGateEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of [
    "PATH",
    "HOME",
    "TMPDIR",
    "TEMP",
    "TMP",
    "LANG",
    "LC_ALL",
    "SHELL",
    "SystemRoot",
    "AUDIT_PG_BIN",
  ]) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  env.VITE_CLERK_PUBLISHABLE_KEY =
    source.VITE_CLERK_PUBLISHABLE_KEY ?? source.CLERK_PUBLISHABLE_KEY;
  env.LOCAL_BACKGROUND_TASKS = "0";
  return env;
}

export function assertReleasedApi(body: unknown, version?: string): void {
  assert.ok(body && typeof body === "object", "Invalid API readiness response");
  const status = body as {
    status?: string;
    service?: string;
    version?: string;
    checks?: { database?: { status?: string } };
  };
  assert.equal(status.status, "ok", "API is not ready");
  assert.equal(status.service, "api", "Unexpected service");
  assert.ok(
    typeof status.version === "string" && status.version.length > 0,
    "API version is missing",
  );
  if (version !== undefined)
    assert.equal(status.version, version, "Running API differs from the verified release");
  assert.equal(status.checks?.database?.status, "ok", "Database is not ready");
}
