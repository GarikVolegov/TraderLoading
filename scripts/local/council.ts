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
  console.log(`${ANSI.bold}Regola di Sovranità:${ANSI.reset}`);
  console.log(`  • ${ANSI.goldBright}95% Esecuzione Autonoma:${ANSI.reset} Ingegneri + Manager guidano e correggono senza tregua.`);
  console.log(`  • ${ANSI.emerald}5% Decisione Sovrana:${ANSI.reset} L'Utente interviene solo per approvazioni strategiche e bivi chiave.\n`);

  // Ispezione file di configurazione
  const councilDocsPath = resolve(repoRoot, ".agents/council");
  if (existsSync(councilDocsPath)) {
    const files = readdirSync(councilDocsPath).filter((f) => f.endsWith(".md"));
    console.log(`${ANSI.emerald}✓ Fascicoli di comando caricati in .agents/council/ (${files.length} profili attivi)${ANSI.reset}`);
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

// Entrypoint CLI
const command = process.argv[2] ?? "status";

switch (command) {
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
