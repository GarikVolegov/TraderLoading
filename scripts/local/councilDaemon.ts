import { existsSync, mkdirSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "./lib/env.js";
import { runCommand } from "./lib/process.js";

const now = new Date().toISOString();
const isCompact = process.argv.includes("--compact") || process.env.AUREUS_DAEMON_COMPACT !== "false";
const auditLogDir = resolve(repoRoot, ".agents/audit-logs");

if (!existsSync(auditLogDir)) {
  mkdirSync(auditLogDir, { recursive: true });
}

console.log(`[${now}] ⏳ [aureus-daemon] Avvio audit periodico schedulato d'integrità (Modalità Alta Densità)...`);

try {
  // 1. Controllo dello stato del repository distillato
  const gitStatus = await runCommand("git", ["status", "--porcelain"], { stdio: "pipe" });
  const rawLines = gitStatus.stdout.trim().split("\n").filter(Boolean);
  const staged = rawLines.filter((l) => l.startsWith("M ") || l.startsWith("A "));
  const untracked = rawLines.filter((l) => l.startsWith("??"));
  const modified = rawLines.filter((l) => l.startsWith(" M") || l.startsWith(" D"));

  const driftCount = rawLines.length;
  if (driftCount > 0) {
    console.log(`[aureus-daemon] Drift rilevato: ${driftCount} file (mod: ${modified.length}, staged: ${staged.length}, untracked: ${untracked.length}).`);
  } else {
    console.log(`[aureus-daemon] Workspace git in perfetto ordine (zero drift).`);
  }

  // 2. Health check rapido TypeScript
  console.log(`[aureus-daemon] Verifica integrità TypeScript monorepo...`);
  await runCommand("pnpm", ["typecheck"], { stdio: "pipe" });
  console.log(`[aureus-daemon] ✓ Integrità TypeScript 100% verde.`);

  // 3. Registrazione differenziale ad alta densità (Compattazione)
  const logEntry = JSON.stringify({
    timestamp: now,
    driftCount,
    typecheck: "OK",
    status: "HEALTHY",
  });
  appendFileSync(resolve(auditLogDir, "daemon-heartbeat.jsonl"), logEntry + "\n");

  console.log(`[${new Date().toISOString()}] ⏳ [aureus-daemon] Audit periodico completato con successo. Nessuna anomalia bloccante.\n`);
} catch (error) {
  const errMsg = error instanceof Error ? error.message : String(error);
  console.error(`[aureus-daemon] ✗ ALLARME INTEGRITÀ: rilevata anomalia durante l'audit periodico!`);
  console.error(errMsg);

  const errorEntry = JSON.stringify({
    timestamp: now,
    status: "CRITICAL_DRIFT",
    error: errMsg.slice(0, 300),
  });
  appendFileSync(resolve(auditLogDir, "daemon-heartbeat.jsonl"), errorEntry + "\n");
  process.exitCode = 1;
}
