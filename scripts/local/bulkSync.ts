// ─── AUREUS PROTOCOL — Motore di Ingestione Massiva M1 (2020 — Oggi) ───────────
// Ingestione ultra-veloce, a memoria costante e ad atomicità garantita.
// Supporta Option A (newest first verso il 2020) con telemetria live su terminale.

import { loadEnvLocal, repoRoot } from "./lib/env.js";
import { checkTcp } from "./lib/health.js";
import { runCommand } from "./lib/process.js";
import { resolveDatabaseTarget } from "./startDatabase.js";

loadEnvLocal();

const rawUrl = process.env["LOCAL_DATABASE_URL"] ?? process.env["DATABASE_URL"];
if (!rawUrl) {
  throw new Error("DATABASE_URL mancante. Configura .env.local prima di avviare la sincronizzazione.");
}

const parsed = new URL(rawUrl);
const database = process.env["LOCAL_DATABASE_URL"]
  ? { url: rawUrl, host: parsed.hostname, port: Number(parsed.port || 5432) }
  : resolveDatabaseTarget(rawUrl, {
      localDefaultPortOccupied:
        ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
        (parsed.port || "5432") === "5432" &&
        (await checkTcp("127.0.0.1", 5432)),
      managedPort: Number(process.env["LOCAL_POSTGRES_PORT"] ?? 55432),
    });

if (!(await checkTcp(database.host, database.port))) {
  throw new Error(
    `Il database configurato (${database.host}:${database.port}) non è raggiungibile. Avvia PostgreSQL prima di procedere.`,
  );
}

const args = process.argv.slice(2);
const hasSymbols = args.some((arg) => arg.startsWith("--symbols="));
const hasTier = args.some((arg) => arg.startsWith("--tier="));
const hasFrom = args.some((arg) => arg.startsWith("--from="));

const passArgs = [...args];
if (!hasSymbols && !hasTier) {
  passArgs.unshift("--tier=1");
}
if (!hasFrom) {
  passArgs.push("--from=2020-01-01");
}

console.log("\n========================================================================");
console.log("  🏛️  AUREUS PROTOCOL — BANCO DI FORGIATURA · INGESTIONE MASSIVA M1");
console.log("  Orizzonte Storico Sovrano: 2020-01-01 -> Presente (Opzione A)");
console.log(`  Database Target: ${database.host}:${database.port} (PostgreSQL Partizionato)`);
console.log("========================================================================\n");

const startedAt = Date.now();

try {
  await runCommand(
    "pnpm",
    ["--filter", "@workspace/api-server", "exec", "tsx", "src/ingest.ts", "seed", ...passArgs],
    {
      cwd: repoRoot,
      env: { DATABASE_URL: database.url },
      label: "ingestione massiva M1",
    },
  );

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log("\n------------------------------------------------------------------------");
  console.log(`  ✨ Ingestione completata con successo in ${elapsedSec}s!`);
  console.log("  Tutti i dati storici sono verificati e disponibili nel Banco di Forgiatura.");
  console.log("------------------------------------------------------------------------\n");
} catch (err) {
  console.error(`\n❌ Ingestione interrotta: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
}
