/** Interactive usability fixture: actual app and handlers, disposable database. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { Client } = require("pg") as typeof import("pg");
const origin = process.env.PROCESS_AUDIT_DATABASE_URL ?? "postgres://trader:trader@127.0.0.1:55432/traderloadings";
assert.ok(["localhost", "127.0.0.1", "::1"].includes(new URL(origin).hostname));
const bin = process.env.AUDIT_PG_BIN ?? "/Users/gazz/Applications/Postgres.app/Contents/Versions/16/bin";
const name = `tl_journey_${Date.now()}`;
const admin = new Client({ connectionString: origin });
await admin.connect();
await admin.query(`CREATE DATABASE "${name}"`);
const target = new URL(origin);
target.pathname = `/${name}`;
process.env.DATABASE_URL = target.toString();
const dumped = spawnSync(`${bin}/pg_dump`, ["--dbname", origin, "--schema-only", "--no-owner", "--no-privileges"], { encoding: "utf8" });
assert.equal(dumped.status, 0, "Cannot read the development database schema");
const restored = spawnSync(`${bin}/psql`, ["--dbname", target.toString(), "-v", "ON_ERROR_STOP=1"], { input: dumped.stdout, encoding: "utf8" });
assert.equal(restored.status, 0, restored.stderr);
const { pool, closeDbPool } = await import("../../lib/db/src/index.js");
for (const migration of ["0036_market_intelligence", "0037_trader_process", "0038_backtest_economics", "0039_process_session_drafts", "0040_process_method_draft_revisions", "0041_process_quick_check", "0042_process_guidance_reviews", "0043_account_trade_environment"])
  await pool.query(await readFile(new URL(`../../lib/db/drizzle/${migration}.sql`, import.meta.url), "utf8"));
const apiRequire = createRequire(new URL("../../artifacts/api-server/package.json", import.meta.url));
const { default: express } = await import(pathToFileURL(apiRequire.resolve("express")).href);
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.user = { id: "audit-local" } as typeof req.user; next(); });
app.use("/api", (await import("../../artifacts/api-server/src/routes/trader-process.js")).default);
app.use("/api", (await import("../../artifacts/api-server/src/routes/journal.js")).default);
app.use("/api", (await import("../../artifacts/api-server/src/routes/market-decisions.js")).default);
app.use((error: unknown, _req: unknown, res: import("express").Response, _next: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  res.status(500).json({ error: "experience fixture handler error" });
});
const api = app.listen(0, "127.0.0.1");
await new Promise<void>(resolve => api.once("listening", resolve));
const port = (api.address() as import("node:net").AddressInfo).port;
const uiRequire = createRequire(new URL("../../artifacts/trader-dashboard/package.json", import.meta.url));
const { createServer } = await import(pathToFileURL(uiRequire.resolve("vite")).href);
process.env.VITE_CLERK_PUBLISHABLE_KEY = "pk_test_aXNvbGF0ZWQuZXhhbXBsZSQ=";
process.env.PORT = "5189";
const vite = await createServer({
  configFile: fileURLToPath(new URL("../../artifacts/trader-dashboard/vite.config.ts", import.meta.url)),
  cacheDir: fileURLToPath(new URL("../../.local-logs/journey-vite", import.meta.url)),
  server: { host: "127.0.0.1", port: 5189, strictPort: true },
  resolve: { alias: [{ find: "@clerk/react", replacement: fileURLToPath(new URL("./clerk-fixture.js", import.meta.url)) }] },
});
await vite.listen();
const out = new URL("../../artifacts.local/trader-experience/", import.meta.url);
await mkdir(out, { recursive: true });
await writeFile(new URL("session.json", out), JSON.stringify({ port, frontendPort: 5189, database: name, pid: process.pid }));
console.log(`Experience fixture ready at http://127.0.0.1:5189; API port ${port}; disposable database ${name}`);
let closing = false;
async function cleanup() {
  if (closing) return;
  closing = true;
  await vite.close();
  await new Promise<void>(resolve => api.close(() => resolve()));
  await closeDbPool();
  await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()", [name]);
  await admin.query(`DROP DATABASE "${name}"`);
  await admin.end();
}
process.once("SIGINT", () => { void cleanup().then(() => process.exit(0)); });
process.once("SIGTERM", () => { void cleanup().then(() => process.exit(0)); });
