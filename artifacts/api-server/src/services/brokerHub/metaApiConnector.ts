import type {
  BrokerAccountProfile,
  BrokerConnector,
  BrokerDeal,
  BrokerEvent,
  BrokerOrder,
  BrokerOrderResult,
  BrokerSnapshot,
  NormalizedBrokerOrderRequest,
} from "./types.js";
import { createMetaApiProvider } from "./metaApiProvider.js";

function offline(profile: BrokerAccountProfile, error?: string): BrokerSnapshot {
  return {
    profileId: profile.id,
    status: error ? "error" : "offline",
    kind: "metaapi-metatrader",
    providerKind: "metaapi-metatrader",
    brokerName: profile.brokerName,
    tradingEnabled: profile.tradingEnabled,
    accounts: [],
    metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
    positions: [],
    orders: [],
    lastUpdated: new Date().toISOString(),
    error,
  };
}

export function createMetaApiBrokerConnector(profile: BrokerAccountProfile): BrokerConnector {
  const provider = createMetaApiProvider();
  const listeners = new Set<(event: BrokerEvent) => void>();
  let snapshot = offline(profile);
  let history: BrokerDeal[] = [];

  function emit(event: BrokerEvent): void {
    for (const listener of Array.from(listeners)) listener(event);
  }

  function providerAccountId(): string {
    if (!profile.providerAccountId) throw new Error("Account provider non configurato.");
    return profile.providerAccountId;
  }

  return {
    async connect(): Promise<BrokerSnapshot> {
      try {
        snapshot = await provider.snapshot(providerAccountId(), profile.brokerName, profile.id, profile.tradingEnabled);
        history = await provider.history(providerAccountId()).catch(() => []);
      } catch (error) {
        snapshot = offline(profile, error instanceof Error ? error.message : "Collegamento broker non riuscito.");
      }
      emit({ type: "snapshot", snapshot });
      return snapshot;
    },
    async disconnect(): Promise<void> {
      snapshot = offline(profile);
      emit({ type: "snapshot", snapshot });
    },
    async getAccounts() {
      return snapshot.accounts;
    },
    async getSnapshot() {
      if (snapshot.status === "connected") {
        try {
          snapshot = await provider.snapshot(providerAccountId(), profile.brokerName, profile.id, profile.tradingEnabled);
          emit({ type: "snapshot", snapshot });
        } catch {
          return snapshot;
        }
      }
      return snapshot;
    },
    async getPositions() {
      return snapshot.positions;
    },
    async getOrders(): Promise<BrokerOrder[]> {
      return snapshot.orders;
    },
    async getDealsHistory(): Promise<BrokerDeal[]> {
      if (snapshot.status === "connected") history = await provider.history(providerAccountId()).catch(() => history);
      return history;
    },
    async placeOrder(order: NormalizedBrokerOrderRequest): Promise<BrokerOrderResult> {
      return provider.placeOrder(providerAccountId(), order);
    },
    async modifyOrder(): Promise<BrokerOrderResult> {
      return { accepted: false, reason: "Modifica ordine non ancora supportata da questo provider." };
    },
    async closePosition(positionId: string): Promise<BrokerOrderResult> {
      return provider.closePosition(providerAccountId(), positionId);
    },
    onEvent(listener: (event: BrokerEvent) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
