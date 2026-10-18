import { createBrokerAuditLog, type BrokerAuditLog } from "./auditLog.js";
import { importBrokerAccountData, type BrokerAccountDataSyncResult } from "./accountDataSync.js";
import { createBrokerVault, type BrokerVault } from "./brokerVault.js";
import { createCTraderBrokerConnector } from "./cTraderConnector.js";
import { createDemoBrokerConnector } from "./demoConnector.js";
import { createFxBlueBrokerConnector } from "./fxBlueConnector.js";
import { createMetaApiBrokerConnector } from "./metaApiConnector.js";
import { createMt5VpsBrokerConnector } from "./mt5VpsConnector.js";
import { companionStore, type CompanionStore } from "./companionStore.js";
import { createLocalCompanionBrokerConnector } from "./localCompanionConnector.js";
import { normalizeBrokerOrder } from "./orderValidation.js";
import { createDefaultBrokerProfileStore, type BrokerProfileStore } from "./profileStore.js";
import { createSnapTradeBrokerConnector } from "./snapTradeConnector.js";
import { reportJobError } from "../../lib/observability.js";
import { singleFlight } from "../../lib/singleFlight.js";
import { createDatabaseOrderReceiptStore, createMemoryOrderReceiptStore, type OrderReceiptStore, type ReceiptRequest } from "./orderReceiptStore.js";
import { submitAuthorizedBrokerOpening, processOrderRejection, type BrokerOpeningAuthorizer } from "./processOrderAuthorization.js";
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
  close(): Promise<void>;
}

interface BrokerHubRuntimeOptions {
  store?: BrokerProfileStore;
  vault?: BrokerVault;
  auditLog?: BrokerAuditLog;
  orderReceiptStore?: OrderReceiptStore;
  companionStore?: CompanionStore;
  connectorFactory?: (profile: BrokerAccountProfile, vault: BrokerVault) => BrokerConnector;
  accountDataImporter?: (input: { profile: BrokerAccountProfile; snapshot: BrokerSnapshot; deals: BrokerDeal[] }) => Promise<BrokerAccountDataSyncResult>;
  authorizeOpening?: BrokerOpeningAuthorizer;
  autoSyncIntervalMs?: number;
  /** How long a fetched FX Blue snapshot is served from cache before a read
   *  re-fetches. Reads within the window skip the upstream fetch + DB import
   *  (the background autoSync keeps the cache warm). Defaults to 60s. */
  snapshotTtlMs?: number;
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
  if (profile.providerKind === "fxblue-account-sync" || profile.kind === "fxblue-account-sync" || profile.route === "fxblue_account_sync") {
    return createFxBlueBrokerConnector(profile);
  }
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
  const store = options.store ?? createDefaultBrokerProfileStore();
  const vault = options.vault ?? createBrokerVault();
  const auditLog = options.auditLog ?? createBrokerAuditLog();
  const orderReceipts = options.orderReceiptStore ?? createMemoryOrderReceiptStore();
  const localCompanionStore = options.companionStore ?? companionStore;
  const accountDataImporter = options.accountDataImporter ?? importBrokerAccountData;
  const autoSyncIntervalMs = options.autoSyncIntervalMs ?? 10_000;
  const snapshotTtlMs = options.snapshotTtlMs ?? 60_000;
  const listeners = new Set<Listener>();
  const connectors = new Map<string, { connector: BrokerConnector; unsubscribe: () => void }>();
  const syncTimers = new Map<string, ReturnType<typeof setInterval>>();
  const activeSyncs = new Map<string, Promise<void>>();
  // SWR cache of the last FX Blue snapshot per profile: reads within the TTL serve
  // this instead of re-fetching the feed and re-importing every deal.
  const snapshotCache = new Map<string, { snapshot: BrokerSnapshot; at: number }>();
  const snapshotRefreshes = new Map<string, Promise<BrokerSnapshot>>();
  const activeOperations = new Set<Promise<unknown>>();
  let closing = false;
  let closePromise: Promise<void> | null = null;

  function trackOperation<T>(run: () => Promise<T>): Promise<T> {
    if (closing) return Promise.reject(new Error("Broker hub runtime is shutting down"));
    const current = run().finally(() => {
      activeOperations.delete(current);
    });
    activeOperations.add(current);
    return current;
  }

  async function dispatchOnce(id: string, request: ReceiptRequest, send: () => Promise<BrokerOrderResult>): Promise<BrokerOrderResult> {
    let claim;
    try {
      claim = await orderReceipts.claim(id, request);
    } catch {
      console.error("[brokerHub] order receipt unavailable; dispatch blocked");
      return { accepted: false, reason: "Verifica ordini non disponibile. Nessun ordine inviato." };
    }
    if (claim.status === "resolved") return claim.result;
    if (claim.status === "conflict") return { accepted: false, reason: "Questo ID richiesta è già associato a un ordine diverso." };
    if (claim.status === "pending") return { accepted: false, reason: "Operazione già in elaborazione o esito non confermato. Verifica sul broker prima di un nuovo invio." };
    let result: BrokerOrderResult;
    try {
      result = await send();
      await orderReceipts.resolve(id, request, result);
    } catch {
      // A provider may have accepted the order before a timeout, and a DB
      // completion failure has the same ambiguity. Keep the durable pending
      // reservation so a retry or API restart cannot send it a second time.
      console.error("[brokerHub] order outcome unconfirmed; retry dispatch blocked");
      return { accepted: false, reason: "Esito operazione non confermato. Verifica sul broker: un nuovo invio con questo ID è bloccato." };
    }
    try {
      await auditLog.append({ profileId: id, request, result });
    } catch {
      // The database receipt is durable. A secondary file log failure must
      // not turn a confirmed order into a failed HTTP request inviting retry.
      console.error("[brokerHub] secondary order audit log unavailable");
    }
    return result;
  }

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

  function isFxBlueProfile(profile: BrokerAccountProfile): boolean {
    return profile.providerKind === "fxblue-account-sync" || profile.kind === "fxblue-account-sync" || profile.route === "fxblue_account_sync";
  }

  async function importProfileData(profile: BrokerAccountProfile, snapshot: BrokerSnapshot, connector: BrokerConnector): Promise<void> {
    if (!isFxBlueProfile(profile) || snapshot.status !== "connected") return;
    try {
      const deals = await connector.getDealsHistory();
      await accountDataImporter({ profile, snapshot, deals });
    } catch (error) {
      console.error("[brokerHub] failed to import broker account data", error);
    }
  }

  // One upstream fetch + DB import, cached for the read-path. Used by getSnapshot
  // on a cache miss (deduped via singleFlight) so concurrent polls fetch once.
  async function refreshFxBlueSnapshot(profile: BrokerAccountProfile): Promise<BrokerSnapshot> {
    const connector = connectorFor(profile);
    const snapshot = await connector.connect();
    const updated = await store.saveProfile({
      ...profile,
      connectionStatus: snapshot.status,
      health: snapshot.status === "connected" ? "connected" : profile.health,
      lastSnapshotAt: snapshot.lastUpdated,
    });
    await importProfileData(updated, snapshot, connector);
    snapshotCache.set(profile.id, { snapshot, at: Date.now() });
    startAutoSync(updated);
    return snapshot;
  }

  function stopAutoSync(id: string): void {
    const timer = syncTimers.get(id);
    if (!timer) return;
    clearInterval(timer);
    syncTimers.delete(id);
  }

  function trackAutoSync(id: string, run: () => Promise<void>): void {
    if (activeSyncs.has(id)) return;
    const current = run()
      .catch((error) => {
        reportJobError(error, { job: "broker-autosync", profileId: id });
      })
      .finally(() => {
        if (activeSyncs.get(id) === current) {
          activeSyncs.delete(id);
        }
      });
    activeSyncs.set(id, current);
  }

  function startAutoSync(profile: BrokerAccountProfile): void {
    if (closing) return;
    if (!isFxBlueProfile(profile) || autoSyncIntervalMs <= 0 || syncTimers.has(profile.id)) return;
    const timer = setInterval(() => {
      trackAutoSync(profile.id, async () => {
        const currentProfile = await store.getProfile(profile.id);
        if (!currentProfile) {
          stopAutoSync(profile.id);
          return;
        }
        const connector = connectorFor(currentProfile);
        const snapshot = await connector.connect();
        await store.saveProfile({
          ...currentProfile,
          connectionStatus: snapshot.status,
          health: snapshot.status === "connected" ? "connected" : currentProfile.health,
          lastSnapshotAt: snapshot.lastUpdated,
        });
        await importProfileData(currentProfile, snapshot, connector);
        // Keep the read-path cache warm so reads keep serving without re-fetching.
        snapshotCache.set(currentProfile.id, { snapshot, at: Date.now() });
      });
    }, autoSyncIntervalMs);
    timer.unref?.();
    syncTimers.set(profile.id, timer);
  }

  return {
    async listProfiles() {
      return trackOperation(() => store.listProfiles());
    },

    async saveProfile(raw: unknown) {
      return trackOperation(() => store.saveProfile(raw));
    },

    async deleteProfile(id: string): Promise<void> {
      return trackOperation(async () => {
        const current = connectors.get(id);
        if (current) {
          current.unsubscribe();
          await current.connector.disconnect();
          connectors.delete(id);
        }
        stopAutoSync(id);
        snapshotCache.delete(id);
        snapshotRefreshes.delete(id);
        await vault.deleteProfile(id);
        await store.deleteProfile(id);
      });
    },

    async connectProfile(id: string) {
      return trackOperation(async () => {
        const profile = await store.activateProfile(id);
        const existing = connectors.get(profile.id);
        if (existing) {
          existing.unsubscribe();
          await existing.connector.disconnect();
          connectors.delete(profile.id);
        }
        const connector = connectorFor(profile);
        const snapshot = await connector.connect();
        const updated = await store.saveProfile({
          ...profile,
          connectionStatus: snapshot.status,
          health: snapshot.status === "connected" ? "connected" : profile.health,
          lastSnapshotAt: snapshot.lastUpdated,
        });
        await importProfileData(updated, snapshot, connector);
        startAutoSync(updated);
        return { profile: updated, snapshot };
      });
    },

    async disconnectProfile(id: string) {
      return trackOperation(async () => {
        const profile = await store.getProfile(id);
        if (!profile) throw new Error("Broker profile not found");
        const current = connectors.get(id);
        if (current) {
          await current.connector.disconnect();
          current.unsubscribe();
          connectors.delete(id);
        }
        stopAutoSync(id);
        // Drop the cached (connected) snapshot so reads reflect the offline state
        // immediately instead of serving a stale "connected" snapshot for up to the TTL.
        snapshotCache.delete(id);
        snapshotRefreshes.delete(id);
        const updated = await store.saveProfile({ ...profile, connectionStatus: "offline" });
        return { profile: updated, snapshot: disconnectedSnapshot(updated) };
      });
    },

    async refreshProfile(id: string) {
      return trackOperation(async () => {
        const profile = await store.getProfile(id);
        if (!profile) throw new Error("Broker profile not found");
        const connector = connectorFor(profile);
        const snapshot = isFxBlueProfile(profile) ? await connector.connect() : await connector.getSnapshot();
        const updated = await store.saveProfile({
          ...profile,
          connectionStatus: snapshot.status,
          health: snapshot.status === "connected" ? "connected" : profile.health,
          lastSnapshotAt: snapshot.lastUpdated,
        });
        await importProfileData(updated, snapshot, connector);
        startAutoSync(updated);
        return { profile: updated, snapshot };
      });
    },

    async getSnapshot(id: string): Promise<BrokerSnapshot> {
      return trackOperation(async () => {
        const profile = await store.getProfile(id);
        if (!profile) throw new Error("Broker profile not found");
        const current = connectors.get(id);
        if (isFxBlueProfile(profile)) {
          const cached = snapshotCache.get(id);
          if (cached && Date.now() - cached.at < snapshotTtlMs) return cached.snapshot;
          // Dedupe concurrent polls: a single upstream fetch + import serves them all.
          return singleFlight(snapshotRefreshes, id, () => refreshFxBlueSnapshot(profile));
        }
        return current ? current.connector.getSnapshot() : disconnectedSnapshot(profile);
      });
    },

    async getHistory(id: string): Promise<BrokerDeal[]> {
      return trackOperation(async () => {
        const profile = await store.getProfile(id);
        if (!profile) throw new Error("Broker profile not found");
        const connector = connectorFor(profile);
        if (isFxBlueProfile(profile)) {
          // Reuse the snapshot SWR cache: within the TTL the connector already holds
          // freshly-fetched deals, so skip the upstream fetch + re-import and just
          // return them. A cache miss does one deduped refresh (fetch + import).
          const cached = snapshotCache.get(id);
          if (!cached || Date.now() - cached.at >= snapshotTtlMs) {
            await singleFlight(snapshotRefreshes, id, () => refreshFxBlueSnapshot(profile));
          } else {
            startAutoSync(profile);
          }
          return connector.getDealsHistory();
        }
        const snapshot = await connector.getSnapshot();
        const history = await connector.getDealsHistory();
        await importProfileData(profile, snapshot, connector);
        startAutoSync(profile);
        return history;
      });
    },

    async placeOrder(id: string, raw: unknown): Promise<BrokerOrderResult> {
      return trackOperation(async () => {
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

        return dispatchOnce(id, normalized.order, async () => {
          // A resolved receipt returns without resending. A new submission must
          // re-read the current process and connector state immediately before IO.
          let submitted = false;
          const submit = () => { submitted = true; return connector.placeOrder(normalized.order); };
          try {
            const currentProfile = await store.getProfile(id);
            if (!currentProfile?.tradingEnabled || !currentProfile.capabilities.placeOrders) {
              return { accepted: false, reason: "Invio ordini non disponibile per questo conto." };
            }
            const currentSnapshot = await connector.getSnapshot();
            if (options.authorizeOpening) {
              await options.authorizeOpening(currentProfile, currentSnapshot, normalized.order);
              return await submit();
            }
            return await submitAuthorizedBrokerOpening(currentProfile, currentSnapshot, normalized.order,
              submit);
          } catch (error) {
            if (submitted) throw error; // Preserve an uncertain provider reply in the receipt store.
            return { accepted: false, reason: processOrderRejection(error) };
          }
        });
      });
    },

    async closePosition(id: string, positionId: string): Promise<BrokerOrderResult> {
      return trackOperation(async () => {
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
        return dispatchOnce(id, { ...request, clientRequestId: "position-close:" + positionId }, () => connector.closePosition(positionId));
      });
    },

    async setSecret(id: string, name: string, value: string): Promise<void> {
      return trackOperation(() => vault.setSecret(id, name, value));
    },

    async getSecret(id: string, name: string): Promise<string | null> {
      return trackOperation(() => vault.getSecret(id, name));
    },

    async deleteSecrets(id: string): Promise<void> {
      return trackOperation(() => vault.deleteProfile(id));
    },

    onEvent(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async close(): Promise<void> {
      if (closePromise) return closePromise;
      closing = true;
      closePromise = (async () => {
        for (const timer of syncTimers.values()) {
          clearInterval(timer);
        }
        syncTimers.clear();
        await Promise.allSettled(activeSyncs.values());
        activeSyncs.clear();
        await Promise.allSettled(activeOperations.values());
        activeOperations.clear();

        for (const current of connectors.values()) {
          current.unsubscribe();
          await current.connector.disconnect();
        }
        connectors.clear();
        listeners.clear();
      })();
      return closePromise;
    },
  };
}

export const brokerHubRuntime = createBrokerHubRuntime({ orderReceiptStore: createDatabaseOrderReceiptStore() });
