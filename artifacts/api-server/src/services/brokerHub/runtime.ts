import { createBrokerAuditLog, type BrokerAuditLog } from "./auditLog.js";
import { createBrokerVault, type BrokerVault } from "./brokerVault.js";
import { createCTraderBrokerConnector } from "./cTraderConnector.js";
import { createDemoBrokerConnector } from "./demoConnector.js";
import { createMetaApiBrokerConnector } from "./metaApiConnector.js";
import { createMt5VpsBrokerConnector } from "./mt5VpsConnector.js";
import { companionStore, type CompanionStore } from "./companionStore.js";
import { createLocalCompanionBrokerConnector } from "./localCompanionConnector.js";
import { normalizeBrokerOrder } from "./orderValidation.js";
import { createBrokerProfileStore, type BrokerProfileStore } from "./profileStore.js";
import { createSnapTradeBrokerConnector } from "./snapTradeConnector.js";
import type {
  BrokerAccountProfile,
  BrokerConnector,
  BrokerDeal,
  BrokerEvent,
  BrokerOrderResult,
  BrokerSnapshot,
} from "./types.js";

type Listener = (event: BrokerEvent) => void;

export interface BrokerHubRuntime {
  listProfiles(): Promise<Awaited<ReturnType<BrokerProfileStore["listProfiles"]>>>;
  saveProfile(raw: unknown): Promise<BrokerAccountProfile>;
  deleteProfile(id: string): Promise<void>;
  connectProfile(id: string): Promise<{ profile: BrokerAccountProfile; snapshot: BrokerSnapshot }>;
  disconnectProfile(id: string): Promise<{ profile: BrokerAccountProfile; snapshot: BrokerSnapshot }>;
  refreshProfile(id: string): Promise<{ profile: BrokerAccountProfile; snapshot: BrokerSnapshot }>;
  getSnapshot(id: string): Promise<BrokerSnapshot>;
  getHistory(id: string): Promise<BrokerDeal[]>;
  placeOrder(id: string, raw: unknown): Promise<BrokerOrderResult>;
  closePosition(id: string, positionId: string): Promise<BrokerOrderResult>;
  setSecret(id: string, name: string, value: string): Promise<void>;
  getSecret(id: string, name: string): Promise<string | null>;
  deleteSecrets(id: string): Promise<void>;
  onEvent(listener: Listener): () => void;
}

interface BrokerHubRuntimeOptions {
  store?: BrokerProfileStore;
  vault?: BrokerVault;
  auditLog?: BrokerAuditLog;
  companionStore?: CompanionStore;
  connectorFactory?: (profile: BrokerAccountProfile, vault: BrokerVault) => BrokerConnector;
}

function createConnector(profile: BrokerAccountProfile, vault: BrokerVault, localCompanionStore: CompanionStore): BrokerConnector {
  if (
    profile.providerKind === "traderloading-mt5-smartlink" ||
    profile.kind === "traderloading-mt5-smartlink" ||
    profile.route === "smartlink_mt5" ||
    profile.providerKind === "metatrader-local-companion" ||
    profile.kind === "metatrader-local-companion" ||
    profile.route === "local_companion" ||
    profile.route === "file_import"
  ) {
    return createLocalCompanionBrokerConnector(profile, localCompanionStore);
  }
  if (profile.providerKind === "metaapi-metatrader" || profile.kind === "metaapi-metatrader") return createMetaApiBrokerConnector(profile);
  if (profile.providerKind === "snaptrade-brokerage" || profile.kind === "snaptrade-brokerage") return createSnapTradeBrokerConnector(profile, vault);
  if (profile.providerKind === "mt5-vps-bridge" || profile.kind === "mt5-vps-bridge") return createMt5VpsBrokerConnector(profile, vault);
  if (profile.providerKind === "ctrader-open-api" || profile.kind === "ctrader-open-api") return createCTraderBrokerConnector(profile, vault);
  return createDemoBrokerConnector(profile);
}

function disconnectedSnapshot(profile: BrokerAccountProfile): BrokerSnapshot {
  return {
    profileId: profile.id,
    status: "offline",
    kind: profile.kind,
    providerKind: profile.providerKind,
    brokerName: profile.brokerName,
    tradingEnabled: profile.tradingEnabled,
    accounts: [],
    metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
    positions: [],
    orders: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function createBrokerHubRuntime(options: BrokerHubRuntimeOptions = {}): BrokerHubRuntime {
  const store = options.store ?? createBrokerProfileStore();
  const vault = options.vault ?? createBrokerVault();
  const auditLog = options.auditLog ?? createBrokerAuditLog();
  const localCompanionStore = options.companionStore ?? companionStore;
  const listeners = new Set<Listener>();
  const connectors = new Map<string, { connector: BrokerConnector; unsubscribe: () => void }>();

  function emit(event: BrokerEvent): void {
    for (const listener of Array.from(listeners)) {
      try {
        listener(event);
      } catch (error) {
        console.error("[brokerHub] listener error", error);
      }
    }
  }

  function connectorFor(profile: BrokerAccountProfile): BrokerConnector {
    const current = connectors.get(profile.id);
    if (current) return current.connector;
    const connector = options.connectorFactory?.(profile, vault) ?? createConnector(profile, vault, localCompanionStore);
    const unsubscribe = connector.onEvent(emit);
    connectors.set(profile.id, { connector, unsubscribe });
    return connector;
  }

  return {
    async listProfiles() {
      return store.listProfiles();
    },

    async saveProfile(raw: unknown) {
      return store.saveProfile(raw);
    },

    async deleteProfile(id: string): Promise<void> {
      const current = connectors.get(id);
      if (current) {
        current.unsubscribe();
        await current.connector.disconnect();
        connectors.delete(id);
      }
      await vault.deleteProfile(id);
      await store.deleteProfile(id);
    },

    async connectProfile(id: string) {
      const profile = await store.activateProfile(id);
      const existing = connectors.get(profile.id);
      if (existing) {
        existing.unsubscribe();
        await existing.connector.disconnect();
        connectors.delete(profile.id);
      }
      const connector = connectorFor(profile);
      const snapshot = await connector.connect();
      await store.saveProfile({ ...profile, connectionStatus: snapshot.status });
      return { profile, snapshot };
    },

    async disconnectProfile(id: string) {
      const profile = await store.getProfile(id);
      if (!profile) throw new Error("Broker profile not found");
      const current = connectors.get(id);
      if (current) {
        await current.connector.disconnect();
        current.unsubscribe();
        connectors.delete(id);
      }
      const updated = await store.saveProfile({ ...profile, connectionStatus: "offline" });
      return { profile: updated, snapshot: disconnectedSnapshot(updated) };
    },

    async refreshProfile(id: string) {
      const profile = await store.getProfile(id);
      if (!profile) throw new Error("Broker profile not found");
      const connector = connectorFor(profile);
      const snapshot = await connector.getSnapshot();
      await store.saveProfile({ ...profile, connectionStatus: snapshot.status });
      return { profile, snapshot };
    },

    async getSnapshot(id: string): Promise<BrokerSnapshot> {
      const profile = await store.getProfile(id);
      if (!profile) throw new Error("Broker profile not found");
      const current = connectors.get(id);
      return current ? current.connector.getSnapshot() : disconnectedSnapshot(profile);
    },

    async getHistory(id: string): Promise<BrokerDeal[]> {
      const profile = await store.getProfile(id);
      if (!profile) throw new Error("Broker profile not found");
      return connectorFor(profile).getDealsHistory();
    },

    async placeOrder(id: string, raw: unknown): Promise<BrokerOrderResult> {
      const profile = await store.getProfile(id);
      if (!profile) return { accepted: false, reason: "Broker profile not found" };

      const normalized = normalizeBrokerOrder(raw);
      if (!normalized.ok) return { accepted: false, reason: normalized.reason };

      if (!profile.tradingEnabled) {
        const result = { accepted: false, reason: "Live order sending is disabled for this broker profile" };
        await auditLog.append({ profileId: id, request: normalized.order, result });
        return result;
      }
      if (!profile.capabilities.placeOrders) {
        const result = { accepted: false, reason: "Questo conto e' collegato in sola lettura: invio ordini non disponibile" };
        await auditLog.append({ profileId: id, request: normalized.order, result });
        return result;
      }

      const connector = connectorFor(profile);
      const snapshot = await connector.getSnapshot();
      if (snapshot.status !== "connected") {
        const result = {
          accepted: false,
          reason:
            profile.route === "local_companion"
              ? "Il TraderLoading Connector non e' sincronizzato. Apri MetaTrader e aggiorna il conto."
              : profile.route === "smartlink_mt5"
                ? "TraderLoading SmartLink non e' sincronizzato. Apri MetaTrader 5 e aggiorna il conto."
              : "Broker profile is not connected or snapshot is not synchronized",
        };
        await auditLog.append({ profileId: id, request: normalized.order, result });
        return result;
      }

      const result = await connector.placeOrder(normalized.order);
      await auditLog.append({ profileId: id, request: normalized.order, result });
      return result;
    },

    async closePosition(id: string, positionId: string): Promise<BrokerOrderResult> {
      const profile = await store.getProfile(id);
      const request = { action: "closePosition" as const, positionId };
      if (!profile) return { accepted: false, reason: "Broker profile not found" };
      if (!positionId.trim()) return { accepted: false, reason: "Position id is required" };
      if (!profile.tradingEnabled) {
        const result = { accepted: false, reason: "Live position closing is disabled for this broker profile" };
        await auditLog.append({ profileId: id, request, result });
        return result;
      }
      if (!profile.capabilities.closePositions) {
        const result = { accepted: false, reason: "Questo conto e' collegato in sola lettura: chiusura posizioni non disponibile" };
        await auditLog.append({ profileId: id, request, result });
        return result;
      }
      const connector = connectorFor(profile);
      const snapshot = await connector.getSnapshot();
      if (snapshot.status !== "connected") {
        const result = {
          accepted: false,
          reason:
            profile.route === "local_companion"
              ? "Il TraderLoading Connector non e' sincronizzato. Apri MetaTrader e aggiorna il conto."
              : profile.route === "smartlink_mt5"
                ? "TraderLoading SmartLink non e' sincronizzato. Apri MetaTrader 5 e aggiorna il conto."
              : "Broker profile is not connected or snapshot is not synchronized",
        };
        await auditLog.append({ profileId: id, request, result });
        return result;
      }
      const result = await connector.closePosition(positionId);
      await auditLog.append({ profileId: id, request, result });
      return result;
    },

    async setSecret(id: string, name: string, value: string): Promise<void> {
      await vault.setSecret(id, name, value);
    },

    async getSecret(id: string, name: string): Promise<string | null> {
      return vault.getSecret(id, name);
    },

    async deleteSecrets(id: string): Promise<void> {
      await vault.deleteProfile(id);
    },

    onEvent(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const brokerHubRuntime = createBrokerHubRuntime();
