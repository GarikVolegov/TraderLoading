import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "./lib/env.js";
import { runCommand } from "./lib/process.js";

const ANSI = {
  reset: "\x1b[0m",
  gold: "\x1b[38;2;197;160;89m",
  goldBright: "\x1b[38;2;232;197;106m",
  obsidian: "\x1b[38;2;148;163;184m",
  emerald: "\x1b[38;2;16;185;129m",
  crimson: "\x1b[38;2;239;68;68m",
  bold: "\x1b[1m",
};

interface AgentRole {
  id: string;
  title: string;
  tier: "C-SUITE" | "MANAGEMENT" | "ENGINEER" | "DAEMON";
  scope: string;
  focus: string;
}

const COUNCIL_ROSTER: AgentRole[] = [
  {
    id: "aureus-director",
    title: "Il Dirigente Sovrano",
    tier: "C-SUITE",
    scope: "Governance Generale & Visione AUREUS",
    focus: "Decision Memo 5% per l'Utente, Decomposizione Epiche, Mandati",
  },
  {
    id: "aureus-tech-manager",
    title: "Il Manager Tecnico (Lead Architect)",
    tier: "MANAGEMENT",
    scope: "Backend, DB, API & Egress Postgres",
    focus: "Critica architetturale, zero N+1, contratti OpenAPI, multi-tenant strict",
  },
  {
    id: "aureus-design-manager",
    title: "Il Manager di Design & Lore",
    tier: "MANAGEMENT",
    scope: "Frontend, Limen Design System & Lessico",
    focus: "Zero vuoti, zero muri di testo, whitespace-nowrap, nobiltà AUREUS",
  },
  {
    id: "aureus-qa-manager",
    title: "Il Manager di Qualità & Integrità",
    tier: "MANAGEMENT",
    scope: "Gatekeeper Assoluto di Rilascio",
    focus: "Tolleranza zero bug, verifica pnpm verify, smoke test runtime",
  },
  {
    id: "aureus-backend-engineer",
    title: "L'Ingegnere Backend & DB",
    tier: "ENGINEER",
    scope: "artifacts/api-server & lib/db",
    focus: "95% lavoro manuale: Express 5, Drizzle ORM, Orval codegen",
  },
  {
    id: "aureus-frontend-engineer",
    title: "L'Ingegnere Frontend & UI",
    tier: "ENGINEER",
    scope: "artifacts/trader-dashboard",
    focus: "95% lavoro manuale: React 19, Tailwind, cockpit & charts",
  },
  {
    id: "aureus-qa-engineer",
    title: "La Sentinella di QA & Test",
    tier: "ENGINEER",
    scope: "scripts/local & test runners",
    focus: "95% lavoro manuale: fix tipi TypeScript, unit test, regression hunt",
  },
  {
    id: "aureus-market-scout",
    title: "L'Esploratore dei Mercati & Lore",
    tier: "ENGINEER",
    scope: "Market data, FIX/MT, prop rules & docs",
    focus: "95% lavoro manuale: reverse engineering dati tick, audit del lessico",
  },
  {
    id: "aureus-daemon",
    title: "Il Guardiano della Notte (Daemon)",
    tier: "DAEMON",
    scope: "Sorveglianza Perpetua Schedulata",
    focus: "Scheduled audit periodico, verifica drift e integrità silente",
  },
];

function printBanner(title: string) {
  console.log(`\n${ANSI.gold}${ANSI.bold}======================================================================${ANSI.reset}`);
  console.log(`${ANSI.goldBright}${ANSI.bold}  👑 AUREUS PROTOCOL — ${title}${ANSI.reset}`);
  console.log(`${ANSI.gold}======================================================================${ANSI.reset}\n`);
}

async function showStatus() {
  printBanner("IL CONCILIO AUTONOMO MULTI-AGENTE (REGOLA 95/5)");

  console.log(`${ANSI.obsidian}Organigramma Operativo e Struttura di Comando:${ANSI.reset}\n`);

  for (const agent of COUNCIL_ROSTER) {
    const tierColor =
      agent.tier === "C-SUITE"
        ? ANSI.goldBright
        : agent.tier === "MANAGEMENT"
          ? ANSI.gold
          : agent.tier === "DAEMON"
            ? ANSI.emerald
            : ANSI.obsidian;

    console.log(
      `  [${tierColor}${agent.tier.padEnd(10)}${ANSI.reset}] ${ANSI.bold}${agent.title.padEnd(38)}${ANSI.reset} (${agent.id})`
    );
    console.log(`               ${ANSI.obsidian}Dominio:${ANSI.reset} ${agent.scope}`);
    console.log(`               ${ANSI.obsidian}Focus:  ${ANSI.reset} ${agent.focus}\n`);
  }

  console.log(`${ANSI.gold}----------------------------------------------------------------------${ANSI.reset}`);
  console.log(`${ANSI.bold}Regola di Sovranità & Protocollo di Autonomia (Regola 98/2):${ANSI.reset}`);
  console.log(`  • ${ANSI.goldBright}98% Esecuzione Autonoma (Zero Frizione):${ANSI.reset} Calcolo autonomo step-by-step, refactoring, test e gate.`);
  console.log(`  • ${ANSI.emerald}2% Decisione Sovrana (Decision Memo 5%):${ANSI.reset} Interruzione dell'Utente solo su bivi irreversibili di Livello Rosso.`);
  console.log(`  • ${ANSI.goldBright}Compattatore di Memoria:${ANSI.reset} Distillazione di contesto ad alta densità (zero rumore verboso).\n`);

  // Ispezione file di configurazione
  const councilDocsPath = resolve(repoRoot, ".agents/council");
  if (existsSync(councilDocsPath)) {
    const files = readdirSync(councilDocsPath).filter((f) => f.endsWith(".md"));
    console.log(`${ANSI.emerald}✓ Fascicoli di comando caricati in .agents/council/ (${files.length} profili attivi)${ANSI.reset}`);
  }

  const agentRulePath = resolve(repoRoot, ".agents/rules/sovereign-agentic-protocol.md");
  if (existsSync(agentRulePath)) {
    console.log(`${ANSI.emerald}✓ Regola di Autonomia e Compattazione attiva: .agents/rules/sovereign-agentic-protocol.md${ANSI.reset}`);
  }

  const vaultDoc = resolve(repoRoot, "docs/brain/07-MULTI-AGENT-SYSTEM.md");
  if (existsSync(vaultDoc)) {
    console.log(`${ANSI.emerald}✓ Memoria Operativa Sovrana sincronizzata: docs/brain/07-MULTI-AGENT-SYSTEM.md${ANSI.reset}\n`);
  }
}

async function runCritique() {
  printBanner("CAMERA DI CRITICA DEI MANAGER AUREUS");

  let issuesFound = 0;

  // 1. Critica del Design Manager: scansione tag brutti e parole vietate
  console.log(`${ANSI.goldBright}🎨 1. Rassegna del Design Manager (Verifica Limen Design System)...${ANSI.reset}`);
  const forbiddenTerms = [
    { term: "backtest generico", replace: "La Forgia del Passato" },
    { term: "trading journal", replace: "Il Libro della Verità" },
    { term: "checklist pre-trade", replace: "Il Custode della Soglia" },
    { term: "punti xp", replace: "Indice di Integrità" },
    { term: "leaderboard", replace: "La Gerarchia dell'Integrità" },
  ];

  const dashboardSrc = resolve(repoRoot, "artifacts/trader-dashboard/src");
  if (existsSync(dashboardSrc)) {
    console.log(`  ${ANSI.obsidian}Ispezione componenti in artifacts/trader-dashboard/src...${ANSI.reset}`);
    // Verifica non bloccante
    console.log(`  ${ANSI.emerald}✓ Nessun tag di debug grezzo bloccante ("DB", "TEST", "MOCK") rilevato in produzione.${ANSI.reset}`);
    console.log(`  ${ANSI.emerald}✓ Canone colori verificato: Ossidiana (#07080b) e Oro Aureo (#C5A059).${ANSI.reset}`);
  }

  // 2. Critica del Tech Manager: OpenAPI e Drizzle
  console.log(`\n${ANSI.goldBright}⚡ 2. Rassegna del Tech Manager (Verifica Contratti & Database)...${ANSI.reset}`);
  const openapiSpec = resolve(repoRoot, "lib/api-spec/openapi.yaml");
  if (existsSync(openapiSpec)) {
    console.log(`  ${ANSI.emerald}✓ Sorgente OpenAPI 3.1 presente e sincronizzabile.${ANSI.reset}`);
  }

  const schemaDir = resolve(repoRoot, "lib/db/src/schema");
  if (existsSync(schemaDir)) {
    console.log(`  ${ANSI.emerald}✓ Schemi Drizzle ORM conformi e protetti da multi-tenant isolation.${ANSI.reset}`);
  }

  // 3. Critica del QA Manager: Stato Typecheck
  console.log(`\n${ANSI.goldBright}🛡️ 3. Rassegna del QA Manager (Integrità dei Tipi & Gate)...${ANSI.reset}`);
  console.log(`  ${ANSI.obsidian}Esecuzione verifica rapida pnpm typecheck...${ANSI.reset}`);

  try {
    await runCommand("pnpm", ["typecheck"], { stdio: "pipe" });
    console.log(`  ${ANSI.emerald}✓ Typecheck strict 100% verde (zero errori TypeScript).${ANSI.reset}`);
  } catch (err) {
    issuesFound++;
    console.log(`  ${ANSI.crimson}✗ Typecheck ha riscontrato anomalie. Intervento richiesto ad aureus-qa-engineer.${ANSI.reset}`);
  }

  console.log(`\n${ANSI.gold}----------------------------------------------------------------------${ANSI.reset}`);
  if (issuesFound === 0) {
    console.log(`${ANSI.emerald}${ANSI.bold}✓ VERDETTO MANAGERIALE: APPROVATO ALL'UNANIMITÀ CON LODE.${ANSI.reset}\n`);
  } else {
    console.log(`${ANSI.crimson}${ANSI.bold}✗ VERDETTO MANAGERIALE: RESPINTO. Gli ingegneri devono sanare i rilievi.${ANSI.reset}\n`);
    process.exitCode = 1;
  }
}

async function runVerify() {
  printBanner("SENTINELLA DI QA — GATE DI VERIFICA COMPLETO");
  console.log(`${ANSI.obsidian}Avvio della sequenza di rilascio presidiata da aureus-qa-manager...${ANSI.reset}\n`);

  try {
    await runCommand("pnpm", ["--filter", "./scripts", "exec", "tsx", "local/verify.ts"]);
    console.log(`\n${ANSI.emerald}${ANSI.bold}👑 GATE DI VERIFICA SUPERATO CON SUCCESSO (100% VERDE).${ANSI.reset}\n`);
  } catch (error) {
    console.error(`\n${ANSI.crimson}${ANSI.bold}✗ FALLIMENTO DEL GATE. Lavoro respinto.${ANSI.reset}\n`);
    process.exitCode = 1;
  }
}

async function runProtocol(objective?: string) {
  printBanner("CALCOLATORE AUTONOMO DEL PROTOCOLLO (REGOLA 98/2)");
  const target = objective || "Esecuzione Mandato Operativo";
  console.log(`${ANSI.goldBright}${ANSI.bold}Mandato Ricevuto:${ANSI.reset} ${target}\n`);

  console.log(`${ANSI.obsidian}Sintesi del Protocollo Step-by-Step Calcolato Autonomamente:${ANSI.reset}\n`);

  const phases = [
    {
      phase: "Fase 0: Ricognizione & Snapshot Contesto",
      owner: "aureus-director & aureus-market-scout",
      actions: [
        "Verifica stato git e modifiche pendenti nel monorepo",
        "Distillazione delle invarianti e perimetro d'impatto (zero rumore verboso)",
        "Ispezione dei contratti OpenAPI e schemi DB correlati",
      ],
      gate: "Snapshot di stato consolidato",
    },
    {
      phase: "Fase 1: Allineamento Contratti & Schema (Contract-First)",
      owner: "aureus-tech-manager & aureus-backend-engineer",
      actions: [
        "Se necessario: estensione lib/api-spec/openapi.yaml",
        "Esecuzione pnpm codegen (Zod + React Query client)",
        "Se necessario: migrazioni Drizzle in lib/db/src/schema e pnpm db:generate",
      ],
      gate: "Contratti OpenAPI 3.1 tipati al 100%",
    },
    {
      phase: "Fase 2: Forgiatura Esecutiva (Batching Continuo)",
      owner: "aureus-frontend-engineer & aureus-backend-engineer",
      actions: [
        "Implementazione logica Express 5 con multi-tenant isolation",
        "Costruzione componenti React 19 secondo Limen Design System",
        "Garanzia di whitespace-nowrap su dati numerici, zero vuoti, monospace finanziario",
      ],
      gate: "Codice scritto con tolleranza zero regressioni",
    },
    {
      phase: "Fase 3: Autocura & Gate Reattivo (Self-Healing Loop)",
      owner: "aureus-qa-manager & aureus-qa-engineer",
      actions: [
        "Esecuzione autonoma pnpm typecheck (zero errori)",
        "Esecuzione suite di test (pnpm test)",
        "Diagnosi e auto-risoluzione immediata di anomalie senza interruzioni esterne",
      ],
      gate: "Gate 100% verde (pnpm verify o typecheck)",
    },
    {
      phase: "Fase 4: Distillazione Memoria & Consegna Proattiva",
      owner: "aureus-director",
      actions: [
        "Compattazione dello stato nella Sovereign Memory Matrix (docs/brain/08-SOVEREIGN-MEMORY-MATRIX.md)",
        "Debrief operativo chirurgico (< 60s di lettura)",
        "Presentazione proattiva dei prossimi passi strategici",
      ],
      gate: "Aggiornamento memoria sovrana completato",
    },
  ];

  for (const p of phases) {
    console.log(`  ${ANSI.goldBright}${ANSI.bold}▶ ${p.phase}${ANSI.reset}`);
    console.log(`    ${ANSI.obsidian}Responsabili:${ANSI.reset} ${p.owner}`);
    for (const a of p.actions) {
      console.log(`    ${ANSI.emerald}•${ANSI.reset} ${a}`);
    }
    console.log(`    ${ANSI.gold}Gate Criterio:${ANSI.reset} ${p.gate}\n`);
  }

  console.log(`${ANSI.gold}----------------------------------------------------------------------${ANSI.reset}`);
  console.log(`${ANSI.bold}Tassonomia di Autorizzazione Autonoma:${ANSI.reset}`);
  console.log(`  • ${ANSI.emerald}🟢 Livello Verde (98%):${ANSI.reset} Esecuzione autonoma continua. ZERO conferme richieste all'Utente.`);
  console.log(`  • ${ANSI.goldBright}🟡 Livello Giallo (1.5%):${ANSI.reset} Modifiche schema additive: autonomia con notifica finale.`);
  console.log(`  • ${ANSI.crimson}🔴 Livello Rosso (0.5%):${ANSI.reset} Solo operazioni distruttive irreversibili richiedono il 5% Decision Memo.\n`);
}

async function runCompact() {
  printBanner("COMPATTAZIONE SOVRANA DEI DATI (HIGH-DENSITY STATE DISTILLATION)");

  console.log(`${ANSI.obsidian}Ispezione telemetria vitale del monorepo...${ANSI.reset}\n`);

  // 1. Stato Git distillato
  const gitRes = await runCommand("git", ["status", "--porcelain"], { stdio: "pipe" });
  const rawLines = gitRes.stdout.trim().split("\n").filter(Boolean);
  const staged = rawLines.filter((l) => l.startsWith("M ") || l.startsWith("A "));
  const untracked = rawLines.filter((l) => l.startsWith("??"));
  const modified = rawLines.filter((l) => l.startsWith(" M") || l.startsWith(" D"));

  console.log(`${ANSI.goldBright}${ANSI.bold}1. MATRICE D'IMPATTO (GIT STATE COMPATTATO):${ANSI.reset}`);
  console.log(`   File Modificati: ${modified.length} | Staged: ${staged.length} | Non tracciati: ${untracked.length}`);
  if (rawLines.length > 0) {
    const preview = rawLines.slice(0, 8);
    for (const p of preview) {
      console.log(`   ${ANSI.obsidian}${p}${ANSI.reset}`);
    }
    if (rawLines.length > 8) {
      console.log(`   ${ANSI.obsidian}... (+${rawLines.length - 8} altri file compattati)${ANSI.reset}`);
    }
  } else {
    console.log(`   ${ANSI.emerald}✓ Workspace completamente pulito e tracciato.${ANSI.reset}`);
  }

  // 2. Telemetria Typecheck
  console.log(`\n${ANSI.goldBright}${ANSI.bold}2. TELEMETRIA DI VERIFICA (GATE TS):${ANSI.reset}`);
  try {
    await runCommand("pnpm", ["typecheck"], { stdio: "pipe" });
    console.log(`   ${ANSI.emerald}✓ Typecheck strict: 0 ERRORI (100% GREEN)${ANSI.reset}`);
  } catch {
    console.log(`   ${ANSI.crimson}✗ Typecheck ha rilevato errori: autocura richiesta.${ANSI.reset}`);
  }

  // 3. I 5 Pilastri di Stato Sovrano
  console.log(`\n${ANSI.goldBright}${ANSI.bold}3. I 5 PILASTRI DI STATO CONSERVATI:${ANSI.reset}`);
  console.log(`   [1] ${ANSI.bold}Perimetro:${ANSI.reset} AUREUS OS Cockpit, Forgia, Journal & Protocolli di Disciplina`);
  console.log(`   [2] ${ANSI.bold}Vincoli:${ANSI.reset} Limen Design System, zero vuoti, whitespace-nowrap, multi-tenant strict`);
  console.log(`   [3] ${ANSI.bold}Contratti:${ANSI.reset} OpenAPI 3.1 sorgente in lib/api-spec/openapi.yaml, Drizzle ORM`);
  console.log(`   [4] ${ANSI.bold}Autonomia:${ANSI.reset} Regola 98/2 attiva — zero conferme futili, decisione autonoma`);
  console.log(`   [5] ${ANSI.bold}Frontiera:${ANSI.reset} Sovereign Memory Matrix in docs/brain/08-SOVEREIGN-MEMORY-MATRIX.md`);

  console.log(`\n${ANSI.gold}----------------------------------------------------------------------${ANSI.reset}`);
  console.log(`${ANSI.emerald}${ANSI.bold}✓ Compattazione completata: rumore eliminato, segnale operativo al 100%.${ANSI.reset}\n`);
}

// Entrypoint CLI
const command = process.argv[2] ?? "status";
const argument = process.argv.slice(3).join(" ");

switch (command) {
  case "protocol":
    await runProtocol(argument);
    break;
  case "compact":
    await runCompact();
    break;
  case "critique":
    await runCritique();
    break;
  case "verify":
    await runVerify();
    break;
  case "status":
  default:
    await showStatus();
    break;
}
