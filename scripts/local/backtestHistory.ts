import { loadEnvLocal, repoRoot } from "./lib/env.js";
import { checkTcp } from "./lib/health.js";
import { runCommand } from "./lib/process.js";
import { resolveDatabaseTarget } from "./startDatabase.js";

loadEnvLocal();

const rawUrl = process.env["LOCAL_DATABASE_URL"] ?? process.env["DATABASE_URL"];
if (!rawUrl) throw new Error("DATABASE_URL is missing. Configure .env.local before synchronizing history.");
const parsed = new URL(rawUrl);
const database = process.env["LOCAL_DATABASE_URL"] ? { url: rawUrl, host: parsed.hostname, port: Number(parsed.port || 5432) } : resolveDatabaseTarget(rawUrl, {
  localDefaultPortOccupied: ["localhost", "127.0.0.1"].includes(parsed.hostname) && (parsed.port || "5432") === "5432" && await checkTcp("127.0.0.1", 5432),
  managedPort: Number(process.env["LOCAL_POSTGRES_PORT"] ?? 55432),
});
if (!await checkTcp(database.host, database.port)) throw new Error("The configured database is unavailable. Start the local database first.");

const args = process.argv.slice(2);
const mode = args[0] === "tail" ? "tail" : args[0] === "import" ? "import" : "seed";
if (args[0] === "seed" || args[0] === "tail" || args[0] === "import") args.shift();
if (mode !== "import" && !args.some(arg => arg.startsWith("--symbols="))) args.unshift("--symbols=XAUUSD,EURUSD,USOIL,BTCUSD,ETHUSD");
console.log(`[history] ${mode}; durable PostgreSQL storage; ${database.host}:${database.port}`);
await runCommand("pnpm", ["--filter", "@workspace/api-server", "exec", "tsx", "src/ingest.ts", mode, ...args], {
  cwd: repoRoot,
  env: { DATABASE_URL: database.url },
  label: "backtest history synchronization",
});
