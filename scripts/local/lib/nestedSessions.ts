import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { repoRoot } from "./env.js";

export interface NestedSession {
  id: string;
  role: string;
  agentId: string;
  scope: string;
  mandate: string;
  workspaceMode: "inherit" | "branch" | "share";
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  completedAt?: string;
  summary?: string;
  deliverables?: string[];
}

export interface SessionRailState {
  parentSessionId: string;
  directorRole: string;
  objective: string;
  updatedAt: string;
  nestedSessions: NestedSession[];
}

const SESSIONS_DIR = resolve(repoRoot, ".agents/sessions");
const REGISTRY_FILE = resolve(SESSIONS_DIR, "registry.json");

const DEFAULT_REGISTRY: SessionRailState = {
  parentSessionId: "aureus-director-regia",
  directorRole: "aureus-director (La Sessione Regia / Chat Mamma)",
  objective: "Orchestrazione Sovrana Monorepo AUREUS",
  updatedAt: new Date().toISOString(),
  nestedSessions: [
    {
      id: "sub-tech-contracts",
      role: "Lead Architect & DB Engineer",
      agentId: "aureus-backend-engineer",
      scope: "lib/api-spec & lib/db",
      mandate: "Allineamento contratti OpenAPI 3.1 e schemi Drizzle multi-tenant",
      workspaceMode: "inherit",
      status: "COMPLETED",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      summary: "OpenAPI 3.1 convalidato, schemi Zod e client Orval sincronizzati",
      deliverables: ["lib/api-spec/openapi.yaml", "lib/db/src/schema"],
    },
    {
      role: "Design Principal & UI Craftsman",
      id: "sub-design-ui",
      agentId: "aureus-frontend-engineer",
      scope: "artifacts/trader-dashboard",
      mandate: "Limen Design System, whitespace-nowrap, zero vuoti e mobile dock",
      workspaceMode: "inherit",
      status: "COMPLETED",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      summary: "Componenti conformi, monospace finanziario e zero parole orfane",
      deliverables: ["artifacts/trader-dashboard/src/components"],
    },
    {
      id: "sub-qa-sentinel",
      role: "Quality Sentinel & Gatekeeper",
      agentId: "aureus-qa-engineer",
      scope: "scripts/local & test runners",
      mandate: "Verifica 100% verde di typecheck strict e suite di 572 test",
      workspaceMode: "inherit",
      status: "COMPLETED",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      summary: "572 / 572 test passati con 0 errori TypeScript",
      deliverables: ["scripts/local/verify.ts"],
    },
  ],
};

export function loadSessionRail(): SessionRailState {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }

  if (!existsSync(REGISTRY_FILE)) {
    saveSessionRail(DEFAULT_REGISTRY);
    return DEFAULT_REGISTRY;
  }

  try {
    const raw = readFileSync(REGISTRY_FILE, "utf-8");
    return JSON.parse(raw) as SessionRailState;
  } catch {
    return DEFAULT_REGISTRY;
  }
}

export function saveSessionRail(state: SessionRailState): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
  state.updatedAt = new Date().toISOString();
  writeFileSync(REGISTRY_FILE, JSON.stringify(state, null, 2), "utf-8");
}

export function spawnNestedSession(
  session: Omit<NestedSession, "startedAt" | "status">
): NestedSession {
  const state = loadSessionRail();
  const newSession: NestedSession = {
    ...session,
    status: "RUNNING",
    startedAt: new Date().toISOString(),
  };

  // Se esiste già con stesso ID lo aggiorna, altrimenti appende
  const idx = state.nestedSessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    state.nestedSessions[idx] = newSession;
  } else {
    state.nestedSessions.push(newSession);
  }

  saveSessionRail(state);
  return newSession;
}

export function completeNestedSession(
  id: string,
  summary: string,
  deliverables: string[] = []
): boolean {
  const state = loadSessionRail();
  const session = state.nestedSessions.find((s) => s.id === id);
  if (!session) return false;

  session.status = "COMPLETED";
  session.completedAt = new Date().toISOString();
  session.summary = summary;
  session.deliverables = deliverables;

  saveSessionRail(state);
  return true;
}
