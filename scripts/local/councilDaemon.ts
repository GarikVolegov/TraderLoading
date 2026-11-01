import { repoRoot } from "./lib/env.js";
import { runCommand } from "./lib/process.js";

const now = new Date().toISOString();
console.log(`[${now}] ⏳ [aureus-daemon] Avvio audit periodico schedulato d'integrità...`);

try {
  // 1. Controllo dello stato del repository
  const gitStatus = await runCommand("git", ["status", "--porcelain"], { stdio: "pipe" });
  const changedFiles = gitStatus.stdout.trim().split("\n").filter(Boolean);

  if (changedFiles.length > 0) {
    console.log(`[aureus-daemon] Attenzione: ${changedFiles.length} file modificati/non tracciati nel workspace.`);
  } else {
    console.log(`[aureus-daemon] Workspace git in perfetto ordine (nessun file non tracciato o in conflitto).`);
  }

  // 2. Health check rapido dei tipi
  console.log(`[aureus-daemon] Verifica integrità TypeScript monorepo...`);
  await runCommand("pnpm", ["typecheck"], { stdio: "pipe" });
  console.log(`[aureus-daemon] ✓ Integrità TypeScript 100% verde.`);

  console.log(`[${new Date().toISOString()}] ⏳ [aureus-daemon] Audit periodico completato con successo. Nessuna anomalia bloccante.\n`);
} catch (error) {
  console.error(`[aureus-daemon] ✗ ALLARME INTEGRITÀ: rilevata anomalia durante l'audit periodico!`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
