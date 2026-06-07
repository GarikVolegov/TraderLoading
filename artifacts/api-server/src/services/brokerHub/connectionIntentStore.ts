import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { BrokerConnectionIntent, BrokerConnectionRequiredAction, BrokerKind, BrokerProviderKind, ConnectorRoute } from "./types.js";

export interface ConnectionIntentStore {
  createIntent(raw: unknown): Promise<BrokerConnectionIntent>;
  getIntent(id: string): Promise<BrokerConnectionIntent | null>;
  updateIntent(id: string, patch: Partial<BrokerConnectionIntent>): Promise<BrokerConnectionIntent>;
  listIntents(): Promise<BrokerConnectionIntent[]>;
}

type IntentFile = { intents: BrokerConnectionIntent[] };

const DEFAULT_FILE: IntentFile = { intents: [] };

function defaultPath(): string {
  return join(process.cwd(), ".local", "broker-connect-intents.json");
}

function id(): string {
  return globalThis.crypto?.randomUUID?.() ?? `intent-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function isIntent(value: unknown): value is BrokerConnectionIntent {
  if (typeof value !== "object" || value === null) return false;
  const intent = value as Partial<BrokerConnectionIntent>;
  return typeof intent.id === "string" && typeof intent.brokerName === "string";
}

function clean(raw: unknown): IntentFile {
  if (typeof raw !== "object" || raw === null) return DEFAULT_FILE;
  const data = raw as Partial<IntentFile>;
  return { intents: Array.isArray(data.intents) ? data.intents.filter(isIntent) : [] };
}

async function readStore(path: string): Promise<IntentFile> {
  try {
    return clean(JSON.parse(await readFile(path, "utf8")));
  } catch {
    return DEFAULT_FILE;
  }
}

async function writeStore(path: string, data: IntentFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temp, path);
}

export function publicIntent(
  intent: BrokerConnectionIntent,
): Omit<BrokerConnectionIntent, "detectedConnectorKind" | "providerKind" | "providerUserId" | "providerAccountId" | "lastProviderError" | "capabilities"> {
  const {
    detectedConnectorKind: _hiddenConnector,
    providerKind: _hiddenProvider,
    providerUserId: _hiddenProviderUser,
    providerAccountId: _hiddenProviderAccount,
    lastProviderError: _hiddenProviderError,
    capabilities: _hiddenCapabilities,
    ...visible
  } = intent;
  return visible;
}

export function createConnectionIntentStore(path = defaultPath()): ConnectionIntentStore {
  return {
    async createIntent(raw: unknown): Promise<BrokerConnectionIntent> {
      const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
      const now = new Date().toISOString();
      const brokerName = readString(data.brokerName, "FP Trading") || "FP Trading";
      const intent: BrokerConnectionIntent = {
        id: id(),
        brokerName,
        status: "created",
        displayStatus: `Pronto a collegare il conto ${brokerName}`,
        requiredAction: "start_authorization",
        createdAt: now,
        updatedAt: now,
      };
      const file = await readStore(path);
      await writeStore(path, { intents: [intent, ...file.intents] });
      return { ...intent };
    },

    async getIntent(id: string): Promise<BrokerConnectionIntent | null> {
      const file = await readStore(path);
      const intent = file.intents.find((item) => item.id === id);
      return intent ? { ...intent } : null;
    },

    async updateIntent(id: string, patch: Partial<BrokerConnectionIntent>): Promise<BrokerConnectionIntent> {
      const file = await readStore(path);
      const existing = file.intents.find((item) => item.id === id);
      if (!existing) throw new Error("Connection intent not found");
      const next: BrokerConnectionIntent = {
        ...existing,
        ...patch,
        status: (patch.status ?? existing.status) as BrokerConnectionIntent["status"],
        requiredAction: (patch.requiredAction ?? existing.requiredAction) as BrokerConnectionRequiredAction,
        detectedConnectorKind: patch.detectedConnectorKind as BrokerKind | undefined ?? existing.detectedConnectorKind,
        providerKind: (patch.providerKind as BrokerProviderKind | undefined) ?? existing.providerKind,
        providerUserId: patch.providerUserId ?? existing.providerUserId,
        providerAccountId: patch.providerAccountId ?? existing.providerAccountId,
        authorizationUrl: patch.authorizationUrl ?? existing.authorizationUrl,
        sessionId: patch.sessionId ?? existing.sessionId,
        lastProviderError: patch.lastProviderError ?? existing.lastProviderError,
        capabilities: patch.capabilities ?? existing.capabilities,
        recommendedRoute: (patch.recommendedRoute as ConnectorRoute | undefined) ?? existing.recommendedRoute,
        availableRoutes: patch.availableRoutes ?? existing.availableRoutes,
        userAction: patch.userAction ?? existing.userAction,
        safeDisplayStatus: patch.safeDisplayStatus ?? existing.safeDisplayStatus,
        updatedAt: new Date().toISOString(),
      };
      await writeStore(path, {
        intents: file.intents.map((item) => (item.id === id ? next : item)),
      });
      return { ...next };
    },

    async listIntents(): Promise<BrokerConnectionIntent[]> {
      const file = await readStore(path);
      return file.intents.map((intent) => ({ ...intent }));
    },
  };
}
