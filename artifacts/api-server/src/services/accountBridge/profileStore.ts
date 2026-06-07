import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { AccountBridgeConfig } from "./types.js";

export interface AccountConnectionProfile {
  id: string;
  label: string;
  adapter: AccountBridgeConfig["adapter"];
  mode: AccountBridgeConfig["mode"];
  host: string;
  port: number;
  terminalPath?: string;
  importJournal: boolean;
  orderEnabled: boolean;
  orderAckTimeoutMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccountProfileList {
  activeProfileId: string | null;
  profiles: AccountConnectionProfile[];
}

export interface AccountProfileStore {
  listProfiles(): Promise<AccountProfileList>;
  saveProfile(raw: unknown): Promise<AccountConnectionProfile>;
  activateProfile(id: string): Promise<AccountConnectionProfile>;
  deleteProfile(id: string): Promise<void>;
}

type StoreFile = AccountProfileList;

const DEFAULT_STORE: StoreFile = {
  activeProfileId: null,
  profiles: [],
};

function storePath(): string {
  return join(process.cwd(), ".local", "account-connections.json");
}

function id(): string {
  return globalThis.crypto?.randomUUID?.() ?? `account-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readPort(value: unknown): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 8765;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function cleanStore(raw: unknown): StoreFile {
  if (typeof raw !== "object" || raw === null) return DEFAULT_STORE;

  const data = raw as Partial<StoreFile>;
  const profiles = Array.isArray(data.profiles)
    ? data.profiles.filter((profile): profile is AccountConnectionProfile => {
        return (
          typeof profile === "object" &&
          profile !== null &&
          typeof profile.id === "string" &&
          typeof profile.label === "string" &&
          (profile.adapter === "demo" || profile.adapter === "mt5-local-socket") &&
          (profile.mode === "demo" || profile.mode === "live")
        );
      })
    : [];

  const activeProfileId =
    typeof data.activeProfileId === "string" && profiles.some((profile) => profile.id === data.activeProfileId)
      ? data.activeProfileId
      : null;

  return { activeProfileId, profiles };
}

function sanitizeProfile(raw: unknown, existing?: AccountConnectionProfile): AccountConnectionProfile {
  const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const now = new Date().toISOString();
  const mode = data.mode === "live" ? "live" : "demo";
  const adapter =
    data.adapter === "mt5-local-socket" ? "mt5-local-socket" : mode === "live" ? "mt5-local-socket" : "demo";
  const label = readString(data.label, existing?.label ?? (mode === "live" ? "Conto MT5" : "Conto demo"));
  const terminalPath = readString(data.terminalPath, existing?.terminalPath);

  return {
    id: readString(data.id, existing?.id ?? id()),
    label: label || "Conto",
    adapter,
    mode,
    host: readString(data.host, existing?.host ?? "127.0.0.1") || "127.0.0.1",
    port: readPort(data.port ?? existing?.port),
    terminalPath: terminalPath || undefined,
    importJournal: readBoolean(data.importJournal, existing?.importJournal ?? true),
    orderEnabled: readBoolean(data.orderEnabled, existing?.orderEnabled ?? false),
    orderAckTimeoutMs: readPositiveInteger(data.orderAckTimeoutMs, existing?.orderAckTimeoutMs ?? 10_000),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

async function readStore(path: string): Promise<StoreFile> {
  try {
    return cleanStore(JSON.parse(await readFile(path, "utf8")));
  } catch {
    return DEFAULT_STORE;
  }
}

async function writeStore(path: string, data: StoreFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temp, path);
}

export function profileToBridgeConfig(profile: AccountConnectionProfile): AccountBridgeConfig {
  return {
    adapter: profile.adapter,
    mode: profile.mode,
    host: profile.host,
    port: profile.port,
    importJournal: profile.importJournal,
    orderEnabled: profile.orderEnabled,
    orderAckTimeoutMs: profile.orderAckTimeoutMs,
  };
}

export function createAccountProfileStore(path = storePath()): AccountProfileStore {
  return {
    async listProfiles(): Promise<AccountProfileList> {
      const data = await readStore(path);
      return {
        activeProfileId: data.activeProfileId,
        profiles: data.profiles.map((profile) => ({ ...profile })),
      };
    },

    async saveProfile(raw: unknown): Promise<AccountConnectionProfile> {
      const data = await readStore(path);
      const incoming = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
      const existing =
        typeof incoming.id === "string" ? data.profiles.find((profile) => profile.id === incoming.id) : undefined;
      const profile = sanitizeProfile(raw, existing);
      const profiles = existing
        ? data.profiles.map((item) => (item.id === profile.id ? profile : item))
        : [...data.profiles, profile];

      await writeStore(path, {
        activeProfileId: data.activeProfileId,
        profiles,
      });

      return { ...profile };
    },

    async activateProfile(id: string): Promise<AccountConnectionProfile> {
      const data = await readStore(path);
      const profile = data.profiles.find((item) => item.id === id);
      if (!profile) throw new Error("Account profile not found");

      await writeStore(path, {
        activeProfileId: profile.id,
        profiles: data.profiles,
      });

      return { ...profile };
    },

    async deleteProfile(id: string): Promise<void> {
      const data = await readStore(path);
      const profiles = data.profiles.filter((profile) => profile.id !== id);
      await writeStore(path, {
        activeProfileId: data.activeProfileId === id ? null : data.activeProfileId,
        profiles,
      });
    },
  };
}
