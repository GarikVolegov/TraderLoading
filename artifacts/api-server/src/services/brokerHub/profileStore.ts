import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  BrokerAccountProfile,
  BrokerCapabilities,
  BrokerEnvironment,
  BrokerKind,
  BrokerProviderKind,
  ConnectionHealth,
  ConnectorRoute,
} from "./types.js";
import { createDatabaseBrokerProfileStore } from "./databaseProfileStore.js";

export interface BrokerProfileList {
  /** Legacy single pointer (kept for back-compat); `activeByUser` is authoritative. */
  activeProfileId: string | null;
  /** Per-user active profile: userId -> profileId they own. Prevents one user's
   *  activation from clobbering another's in this shared, multi-tenant store. */
  activeByUser: Record<string, string>;
  profiles: BrokerAccountProfile[];
}

export interface BrokerProfileStore {
  listProfiles(): Promise<BrokerProfileList>;
  saveProfile(raw: unknown): Promise<BrokerAccountProfile>;
  activateProfile(id: string): Promise<BrokerAccountProfile>;
  deleteProfile(id: string): Promise<void>;
  getProfile(id: string): Promise<BrokerAccountProfile | null>;
}

export interface BrokerProfileStoreBackend {
  read(): Promise<unknown>;
  write(data: BrokerProfileList): Promise<void>;
  update?<T>(
    mutate: (current: unknown) => Promise<{ data: BrokerProfileList; result: T }> | { data: BrokerProfileList; result: T },
  ): Promise<T>;
}

const DEFAULT_STORE: BrokerProfileList = { activeProfileId: null, activeByUser: {}, profiles: [] };
const backendLocks = new WeakMap<BrokerProfileStoreBackend, Promise<void>>();

function defaultPath(): string {
  return join(process.cwd(), ".local", "broker-profiles.json");
}

function id(): string {
  return globalThis.crypto?.randomUUID?.() ?? `broker-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readPort(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : undefined;
}

function readKind(value: unknown): BrokerKind {
  return value === "traderloading-mt5-smartlink" ||
    value === "metatrader-local-companion" ||
    value === "metaapi-metatrader" ||
    value === "snaptrade-brokerage" ||
    value === "ctrader-open-api" ||
    value === "mt5-vps-bridge" ||
    value === "fxblue-account-sync" ||
    value === "demo"
    ? value
    : "demo";
}

function readProviderKind(value: unknown, kind: BrokerKind): BrokerProviderKind {
  return readKind(value ?? kind);
}

function readEnvironment(value: unknown, kind: BrokerKind): BrokerEnvironment {
  if (value === "live") return "live";
  if (value === "demo") return "demo";
  return kind === "demo" ? "demo" : "live";
}

function defaultRoute(kind: BrokerProviderKind): ConnectorRoute {
  if (kind === "traderloading-mt5-smartlink") return "smartlink_mt5";
  if (kind === "metatrader-local-companion") return "local_companion";
  if (kind === "ctrader-open-api") return "official_oauth";
  if (kind === "snaptrade-brokerage") return "broker_portal";
  if (kind === "metaapi-metatrader") return "optional_cloud";
  if (kind === "fxblue-account-sync") return "fxblue_account_sync";
  if (kind === "demo") return "manual";
  return "local_companion";
}

function readRoute(value: unknown, kind: BrokerProviderKind): ConnectorRoute {
  return value === "smartlink_mt5" ||
    value === "official_oauth" ||
    value === "local_companion" ||
    value === "broker_portal" ||
    value === "file_import" ||
    value === "manual" ||
    value === "optional_cloud" ||
    value === "advanced_ea" ||
    value === "fxblue_account_sync"
    ? value
    : defaultRoute(kind);
}

function readHealth(value: unknown, route: ConnectorRoute, connectionStatus: BrokerAccountProfile["connectionStatus"]): ConnectionHealth {
  if (
    value === "connected" ||
    value === "stale" ||
    value === "waiting_for_companion" ||
    value === "waiting_for_fxblue_sync" ||
    value === "import_only" ||
    value === "error"
  ) {
    return value;
  }
  if (route === "smartlink_mt5" || route === "local_companion") return connectionStatus === "connected" ? "connected" : "waiting_for_companion";
  if (route === "fxblue_account_sync") return connectionStatus === "connected" ? "connected" : "waiting_for_fxblue_sync";
  if (route === "file_import" || route === "manual") return "import_only";
  return connectionStatus === "connected" ? "connected" : "stale";
}

function isProfile(value: unknown): value is BrokerAccountProfile {
  if (typeof value !== "object" || value === null) return false;
  const profile = value as Partial<BrokerAccountProfile>;
  return (
    typeof profile.id === "string" &&
    typeof profile.label === "string" &&
    typeof profile.brokerName === "string" &&
    (profile.kind === "metatrader-local-companion" ||
      profile.kind === "traderloading-mt5-smartlink" ||
      profile.kind === "metaapi-metatrader" ||
      profile.kind === "snaptrade-brokerage" ||
      profile.kind === "ctrader-open-api" ||
      profile.kind === "mt5-vps-bridge" ||
      profile.kind === "fxblue-account-sync" ||
      profile.kind === "demo")
  );
}

function defaultCapabilities(kind: BrokerProviderKind): BrokerCapabilities {
  if (kind === "demo") {
    return { readAccount: true, readPositions: true, readHistory: true, placeOrders: true, closePositions: true, realtimeUpdates: false, requiresTerminal: false };
  }
  if (kind === "snaptrade-brokerage" || kind === "fxblue-account-sync") {
    return { readAccount: true, readPositions: true, readHistory: true, placeOrders: false, closePositions: false, realtimeUpdates: false, requiresTerminal: false };
  }
  if (kind === "traderloading-mt5-smartlink" || kind === "metatrader-local-companion") {
    return { readAccount: true, readPositions: true, readHistory: true, placeOrders: true, closePositions: true, realtimeUpdates: true, requiresTerminal: true };
  }
  return { readAccount: true, readPositions: true, readHistory: true, placeOrders: true, closePositions: true, realtimeUpdates: true, requiresTerminal: false };
}

function readCapabilities(value: unknown, kind: BrokerProviderKind, existing?: BrokerCapabilities): BrokerCapabilities {
  const fallback = existing ?? defaultCapabilities(kind);
  if (typeof value !== "object" || value === null) return fallback;
  const data = value as Partial<BrokerCapabilities>;
  return {
    readAccount: readBoolean(data.readAccount, fallback.readAccount),
    readPositions: readBoolean(data.readPositions, fallback.readPositions),
    readHistory: readBoolean(data.readHistory, fallback.readHistory),
    placeOrders: readBoolean(data.placeOrders, fallback.placeOrders),
    closePositions: readBoolean(data.closePositions, fallback.closePositions),
    realtimeUpdates: readBoolean(data.realtimeUpdates, fallback.realtimeUpdates ?? false),
    requiresTerminal: readBoolean(data.requiresTerminal, fallback.requiresTerminal ?? false),
  };
}

function cleanStore(raw: unknown): BrokerProfileList {
  if (typeof raw !== "object" || raw === null) return { activeProfileId: null, activeByUser: {}, profiles: [] };
  const data = raw as Partial<BrokerProfileList>;
  const profiles = Array.isArray(data.profiles) ? data.profiles.filter(isProfile).map((profile) => sanitize(profile)) : [];
  const byId = new Map(profiles.map((profile) => [profile.id, profile]));

  const activeProfileId =
    typeof data.activeProfileId === "string" && byId.has(data.activeProfileId) ? data.activeProfileId : null;

  // Keep only per-user entries that point to a profile that still exists AND is
  // actually owned by that user (drops stale/tampered mappings).
  const activeByUser: Record<string, string> = {};
  if (data.activeByUser && typeof data.activeByUser === "object") {
    for (const [userId, profileId] of Object.entries(data.activeByUser)) {
      if (typeof profileId !== "string") continue;
      const profile = byId.get(profileId);
      if (profile && profile.ownerUserId === userId) activeByUser[userId] = profileId;
    }
  }
  // Migrate a legacy single active pointer into the per-user map.
  if (activeProfileId) {
    const owner = byId.get(activeProfileId)?.ownerUserId;
    if (owner && !(owner in activeByUser)) activeByUser[owner] = activeProfileId;
  }

  return { activeProfileId, activeByUser, profiles };
}

function sanitize(raw: unknown, existing?: BrokerAccountProfile): BrokerAccountProfile {
  const data = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const now = new Date().toISOString();
  const kind = readKind(data.kind ?? existing?.kind);
  const providerKind = readProviderKind(data.providerKind ?? existing?.providerKind, kind);
  const environment = readEnvironment(data.environment ?? existing?.environment, kind);
  const connectionStatus =
    data.connectionStatus === "connected" ||
    data.connectionStatus === "connecting" ||
    data.connectionStatus === "error" ||
    data.connectionStatus === "offline"
      ? data.connectionStatus
      : existing?.connectionStatus ?? "offline";
  const route = readRoute(data.route ?? existing?.route, providerKind);
  const brokerName = readString(data.brokerName, existing?.brokerName ?? (kind === "demo" ? "TraderLoading" : "FP Trading"));
  const label = readString(data.label, existing?.label ?? `${brokerName} ${environment}`);

  return {
    id: readString(data.id, existing?.id ?? id()),
    label: label || "Broker account",
    brokerName: brokerName || "Broker",
    kind,
    providerKind,
    ownerUserId:
      typeof data.ownerUserId === "string"
        ? data.ownerUserId
        : data.ownerUserId === null
          ? null
          : existing?.ownerUserId,
    providerUserId: readString(data.providerUserId, existing?.providerUserId) || undefined,
    providerAccountId: readString(data.providerAccountId, existing?.providerAccountId) || undefined,
    accountId: readString(data.accountId, existing?.accountId ?? (kind === "demo" ? "DEMO-1" : "")),
    environment,
    route,
    health: readHealth(data.health ?? existing?.health, route, connectionStatus),
    tradingEnabled: readBoolean(data.tradingEnabled, existing?.tradingEnabled ?? false),
    capabilities: readCapabilities(data.capabilities, providerKind, existing?.capabilities),
    connectionStatus,
    lastHeartbeatAt: readString(data.lastHeartbeatAt, existing?.lastHeartbeatAt) || undefined,
    lastBridgeHeartbeatAt: readString(data.lastBridgeHeartbeatAt, existing?.lastBridgeHeartbeatAt) || undefined,
    lastSnapshotAt: readString(data.lastSnapshotAt, existing?.lastSnapshotAt) || undefined,
    setupProgress: readString(data.setupProgress, existing?.setupProgress) || undefined,
    terminalPath: readString(data.terminalPath, existing?.terminalPath) || undefined,
    terminalDetected: readBoolean(data.terminalDetected, existing?.terminalDetected ?? false),
    accountLoginMode:
      data.accountLoginMode === "credentials" || data.accountLoginMode === "terminal_session"
        ? data.accountLoginMode
        : existing?.accountLoginMode ?? "terminal_session",
    host: readString(data.host, existing?.host) || undefined,
    port: readPort(data.port ?? existing?.port),
    bridgeTokenRef: readString(data.bridgeTokenRef, existing?.bridgeTokenRef) || undefined,
    cTraderClientId: readString(data.cTraderClientId, existing?.cTraderClientId) || undefined,
    cTraderRedirectUri: readString(data.cTraderRedirectUri, existing?.cTraderRedirectUri) || undefined,
    server: readString(data.server, existing?.server) || undefined,
    createdAt: readString(data.createdAt, existing?.createdAt ?? now),
    updatedAt: readString(data.updatedAt, now),
  };
}

async function readStore(path: string): Promise<BrokerProfileList> {
  try {
    return cleanStore(JSON.parse(await readFile(path, "utf8")));
  } catch {
    return DEFAULT_STORE;
  }
}

async function writeStore(path: string, data: BrokerProfileList): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  await writeFile(temp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await rename(temp, path);
}

function createFileBackend(path: string): BrokerProfileStoreBackend {
  return {
    read: () => readStore(path),
    write: (data) => writeStore(path, data),
  };
}

async function updateBackend<T>(
  backend: BrokerProfileStoreBackend,
  mutate: (current: BrokerProfileList) => Promise<{ data: BrokerProfileList; result: T }> | { data: BrokerProfileList; result: T },
): Promise<T> {
  if (backend.update) {
    return backend.update((current) => mutate(cleanStore(current)));
  }

  const previous = backendLocks.get(backend) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  backendLocks.set(
    backend,
    previous.catch(() => undefined).then(() => current),
  );

  await previous.catch(() => undefined);
  try {
    const currentData = cleanStore(await backend.read());
    const next = await mutate(currentData);
    await backend.write(next.data);
    return next.result;
  } finally {
    release();
  }
}

export function createBrokerProfileStoreFromBackend(backend: BrokerProfileStoreBackend): BrokerProfileStore {
  return {
    async listProfiles(): Promise<BrokerProfileList> {
      const data = cleanStore(await backend.read());
      return {
        activeProfileId: data.activeProfileId,
        activeByUser: { ...data.activeByUser },
        profiles: data.profiles.map((profile) => ({ ...profile })),
      };
    },

    async getProfile(id: string): Promise<BrokerAccountProfile | null> {
      const data = cleanStore(await backend.read());
      const profile = data.profiles.find((item) => item.id === id);
      return profile ? { ...profile } : null;
    },

    async saveProfile(raw: unknown): Promise<BrokerAccountProfile> {
      return updateBackend(backend, (data) => {
        const incoming = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
        const existing =
          typeof incoming.id === "string" ? data.profiles.find((profile) => profile.id === incoming.id) : undefined;
        const profile = sanitize(raw, existing);
        const profiles = existing
          ? data.profiles.map((item) => (item.id === profile.id ? profile : item))
          : [...data.profiles, profile];
        return {
          data: { activeProfileId: data.activeProfileId, activeByUser: data.activeByUser, profiles },
          result: { ...profile },
        };
      });
    },

    async activateProfile(id: string): Promise<BrokerAccountProfile> {
      return updateBackend(backend, (data) => {
        const profile = data.profiles.find((item) => item.id === id);
        if (!profile) throw new Error("Broker profile not found");
        const activeByUser = { ...data.activeByUser };
        // Track the active profile per owner so activating one user's account
        // doesn't change another user's active pointer.
        if (profile.ownerUserId) activeByUser[profile.ownerUserId] = id;
        return {
          data: { activeProfileId: id, activeByUser, profiles: data.profiles },
          result: { ...profile },
        };
      });
    },

    async deleteProfile(id: string): Promise<void> {
      await updateBackend(backend, (data) => {
        const activeByUser = { ...data.activeByUser };
        for (const [userId, profileId] of Object.entries(activeByUser)) {
          if (profileId === id) delete activeByUser[userId];
        }
        return {
          data: {
            activeProfileId: data.activeProfileId === id ? null : data.activeProfileId,
            activeByUser,
            profiles: data.profiles.filter((profile) => profile.id !== id),
          },
          result: undefined,
        };
      });
    },
  };
}

export function createBrokerProfileStore(path = defaultPath()): BrokerProfileStore {
  return createBrokerProfileStoreFromBackend(createFileBackend(path));
}

interface DefaultBrokerProfileStoreOptions {
  filePath?: string;
  env?: Record<string, string | undefined>;
}

export function createDefaultBrokerProfileStore(options: DefaultBrokerProfileStoreOptions = {}): BrokerProfileStore {
  const env = options.env ?? process.env;
  const fileStore = createBrokerProfileStore(options.filePath);
  let storePromise: Promise<BrokerProfileStore> | null = null;

  async function resolveStore(): Promise<BrokerProfileStore> {
    if (!storePromise) {
      storePromise = env.DATABASE_URL
        ? createDatabaseBrokerProfileStore()
        : Promise.resolve(fileStore);
    }
    return storePromise;
  }

  return {
    async listProfiles() {
      return (await resolveStore()).listProfiles();
    },
    async saveProfile(raw: unknown) {
      return (await resolveStore()).saveProfile(raw);
    },
    async activateProfile(id: string) {
      return (await resolveStore()).activateProfile(id);
    },
    async deleteProfile(id: string) {
      return (await resolveStore()).deleteProfile(id);
    },
    async getProfile(id: string) {
      return (await resolveStore()).getProfile(id);
    },
  };
}
