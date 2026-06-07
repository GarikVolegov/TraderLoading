import type {
  BrokerAccountProfile,
  BrokerConnector,
  BrokerDeal,
  BrokerEvent,
  BrokerOrder,
  BrokerOrderResult,
  BrokerSnapshot,
} from "./types.js";
import type { BrokerVault } from "./brokerVault.js";
import { createSnapTradeProvider } from "./snapTradeProvider.js";

function snapshot(profile: BrokerAccountProfile, error?: string): BrokerSnapshot {
  return {
    profileId: profile.id,
    status: error ? "error" : "offline",
    kind: "snaptrade-brokerage",
    providerKind: "snaptrade-brokerage",
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

export function createSnapTradeBrokerConnector(profile: BrokerAccountProfile, vault: BrokerVault): BrokerConnector {
  const provider = createSnapTradeProvider();
  const listeners = new Set<(event: BrokerEvent) => void>();
  let current = snapshot(profile);

  function emit(event: BrokerEvent): void {
    for (const listener of Array.from(listeners)) listener(event);
  }

  async function secret(): Promise<string> {
    const value = await vault.getSecret(profile.id, "snapTradeUserSecret");
    if (!value) throw new Error("Collegamento SnapTrade incompleto. Riapri il portale sicuro.");
    return value;
  }

  async function readSnapshot(): Promise<BrokerSnapshot> {
    if (!profile.providerUserId || !profile.providerAccountId) {
      throw new Error("Profilo SnapTrade incompleto.");
    }
    return provider.getSnapshot({
      userId: profile.providerUserId,
      userSecret: await secret(),
      accountId: profile.providerAccountId,
      brokerName: profile.brokerName,
      profileId: profile.id,
      tradingEnabled: profile.tradingEnabled,
    });
  }

  return {
    async connect(): Promise<BrokerSnapshot> {
      try {
        current = await readSnapshot();
      } catch (error) {
        current = snapshot(profile, error instanceof Error ? error.message : "SnapTrade non disponibile.");
      }
      emit({ type: "snapshot", snapshot: current });
      return current;
    },
    async disconnect(): Promise<void> {
      current = snapshot(profile);
      emit({ type: "snapshot", snapshot: current });
    },
    async getAccounts() {
      return current.accounts;
    },
    async getSnapshot() {
      if (current.status === "connected") {
        try {
          current = await readSnapshot();
          emit({ type: "snapshot", snapshot: current });
        } catch {
          return current;
        }
      }
      return current;
    },
    async getPositions() {
      return current.positions;
    },
    async getOrders(): Promise<BrokerOrder[]> {
      return current.orders;
    },
    async getDealsHistory(): Promise<BrokerDeal[]> {
      return [];
    },
    async placeOrder(): Promise<BrokerOrderResult> {
      return { accepted: false, reason: "Invio ordini SnapTrade richiede check order impact dedicato prima dell'esecuzione." };
    },
    async modifyOrder(): Promise<BrokerOrderResult> {
      return { accepted: false, reason: "Modifica ordine non disponibile per questo provider." };
    },
    async closePosition(): Promise<BrokerOrderResult> {
      return { accepted: false, reason: "Chiusura posizione diretta non disponibile per questo provider." };
    },
    onEvent(listener: (event: BrokerEvent) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
