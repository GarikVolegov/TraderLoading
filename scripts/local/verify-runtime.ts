import { loadEnvLocal } from "./lib/env.js";
import { checkHttp, checkTcp } from "./lib/health.js";
import { readRuntimeSessionStart, scanRuntimeErrorsSince } from "./lib/runtimeLogs.js";

loadEnvLocal();

async function databaseProbe(): Promise<{ name: string; host: string; port: number }> {
  const rawUrl = process.env["LOCAL_DATABASE_URL"] ?? process.env["DATABASE_URL"];
  if (!rawUrl) {
    return { name: "Postgres TCP 127.0.0.1:5432", host: "127.0.0.1", port: 5432 };
  }

  const parsed = new URL(rawUrl);
  const host = parsed.hostname || "127.0.0.1";
  const port = Number(parsed.port || "5432");
  const managedPort = Number(process.env["LOCAL_POSTGRES_PORT"] ?? "55432");

  if ((host === "127.0.0.1" || host === "localhost") && port === 5432 && (await checkTcp("127.0.0.1", managedPort))) {
    return { name: `Managed Postgres TCP 127.0.0.1:${managedPort}`, host: "127.0.0.1", port: managedPort };
  }

  return { name: `Postgres TCP ${host}:${port}`, host, port };
}

const db = await databaseProbe();

const checks = [
  {
    name: db.name,
    run: async () => ((await checkTcp(db.host, db.port)) ? "ok" : "unreachable"),
  },
  {
    name: "API health http://127.0.0.1:3001/api/healthz",
    run: async () => {
      const result = await checkHttp("http://127.0.0.1:3001/api/healthz");
      return result.ok ? `ok (${result.status})` : `failed (${result.status ?? result.error ?? "unknown"})`;
    },
  },
  {
    name: "Frontend http://127.0.0.1:5173",
    run: async () => {
      const result = await checkHttp("http://127.0.0.1:5173");
      return result.ok ? `ok (${result.status})` : `failed (${result.status ?? result.error ?? "unknown"})`;
    },
  },
  {
    name: "Frontend API proxy http://127.0.0.1:5173/api/checklist",
    run: async () => {
      const result = await checkHttp("http://127.0.0.1:5173/api/checklist", 5_000, (body) => {
        try {
          return Array.isArray(JSON.parse(body));
        } catch {
          return false;
        }
      });
      return result.ok ? `ok (${result.status})` : `failed (${result.status ?? result.error ?? "invalid JSON array"})`;
    },
  },
  {
    name: "Runtime error log scan",
    run: async () => {
      const startedAtMs = readRuntimeSessionStart();
      if (startedAtMs === null) {
        return "ok (no runtime session marker found)";
      }

      const errors = scanRuntimeErrorsSince(startedAtMs);
      if (errors.length === 0) {
        return "ok (0 runtime errors)";
      }

      return `failed (${errors
        .slice(0, 3)
        .map((error) => `${error.sourceFile}: ${error.message}${error.location ? ` at ${error.location}` : ""}`)
        .join("; ")})`;
    },
  },
];

let failed = false;

for (const check of checks) {
  const result = await check.run();
  const ok = result.startsWith("ok");
  failed ||= !ok;
  console.log(`${ok ? "PASS" : "FAIL"} ${check.name}: ${result}`);
}

if (failed) {
  process.exitCode = 1;
}
