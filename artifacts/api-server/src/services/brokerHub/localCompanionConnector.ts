import type {
  BrokerAccount,
  BrokerAccountProfile,
  BrokerConnector,
  BrokerDeal,
  BrokerEvent,
  BrokerOrder,
  BrokerOrderResult,
  BrokerPosition,
  BrokerSnapshot,
  NormalizedBrokerOrderRequest,
} from "./types.js";
import type { CompanionStore } from "./companionStore.js";

function waitingSnapshot(profile: BrokerAccountProfile, error = "In attesa del TraderLoading Connector."): BrokerSnapshot {
  return {
    profileId: profile.id,
    status: "connecting",
    kind: profile.kind,
    providerKind: profile.providerKind,
    brokerName: profile.brokerName,
    tradingEnabled: profile.tradingEnabled,
    accounts: profile.accountId
      ? [{ id: profile.accountId, label: profile.label, brokerName: profile.brokerName, currency: "USD", environment: profile.environment }]
      : [],
    metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
    positions: [],
    orders: [],
    lastUpdated: new Date().toISOString(),
    error,
  };
}

export function createLocalCompanionBrokerConnector(profile: BrokerAccountProfile, store: CompanionStore): BrokerConnector {
  const listeners = new Set<(event: BrokerEvent) => void>();
  let snapshot: BrokerSnapshot = waitingSnapshot(profile);

  function emit(event: BrokerEvent): void {
    for (const listener of Array.from(listeners)) listener(event);
  }

  async function synchronizedSnapshot(): Promise<BrokerSnapshot> {
    const health = await store.getHealth(profile.id);
    const stored = await store.getSnapshot(profile.id);
    if (!stored) {
      const waitingMessage =
        profile.route === "smartlink_mt5" ? "In attesa di TraderLoading SmartLink." : "In attesa del TraderLoading Connector.";
      snapshot = waitingSnapshot(profile, health === "stale" ? "MetaTrader non sta inviando dati aggiornati." : waitingMessage);
      return snapshot;
    }
    snapshot = {
      ...stored,
      status: health === "connected" || health === "import_only" ? "connected" : "connecting",
      error: health === "connected" || health === "import_only" ? undefined : "MetaTrader non sta inviando dati aggiornati.",
    };
    return snapshot;
  }

  return {
    async connect(): Promise<BrokerSnapshot> {
      const next = await synchronizedSnapshot();
      emit({ type: "snapshot", snapshot: next });
      return next;
    },

    async disconnect(): Promise<void> {
      snapshot = { ...waitingSnapshot(profile, "Connector scollegato."), status: "offline" };
      emit({ type: "snapshot", snapshot });
    },

    async getAccounts(): Promise<BrokerAccount[]> {
      return (await synchronizedSnapshot()).accounts;
    },

    async getSnapshot(): Promise<BrokerSnapshot> {
      return synchronizedSnapshot();
    },

    async getPositions(): Promise<BrokerPosition[]> {
      return (await synchronizedSnapshot()).positions;
    },

    async getOrders(): Promise<BrokerOrder[]> {
      return (await synchronizedSnapshot()).orders;
    },

    async getDealsHistory(): Promise<BrokerDeal[]> {
      return store.getHistory(profile.id);
    },

    async placeOrder(order: NormalizedBrokerOrderRequest): Promise<BrokerOrderResult> {
      const next = await synchronizedSnapshot();
      if (next.status !== "connected") {
        return {
          accepted: false,
          reason:
            profile.route === "smartlink_mt5"
              ? "TraderLoading SmartLink non e' sincronizzato. Apri MetaTrader 5 e aggiorna il conto."
              : "Il TraderLoading Connector non e' sincronizzato. Apri MetaTrader e aggiorna il conto.",
        };
      }
      const pending = await store.enqueueOrder(profile.id, order);
      const brokerOrder: BrokerOrder = {
        id: pending.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        volume: order.volume,
        status: "pending",
        createdAt: pending.createdAt,
      };
      emit({ type: "order_update", profileId: profile.id, order: brokerOrder });
      return { accepted: true, orderId: pending.id };
    },

    async modifyOrder(): Promise<BrokerOrderResult> {
      return { accepted: false, reason: "Modifica ordine non disponibile nel Connector locale." };
    },

    async closePosition(positionId: string): Promise<BrokerOrderResult> {
      const next = await synchronizedSnapshot();
      if (next.status !== "connected") {
        return {
          accepted: false,
          reason:
            profile.route === "smartlink_mt5"
              ? "TraderLoading SmartLink non e' sincronizzato. Apri MetaTrader 5 e aggiorna il conto."
              : "Il TraderLoading Connector non e' sincronizzato. Apri MetaTrader e aggiorna il conto.",
        };
      }
      const position = next.positions.find((candidate) => candidate.brokerPositionId === positionId || candidate.id === positionId);
      if (!position) {
        return { accepted: false, reason: "Posizione non trovata nello snapshot sincronizzato." };
      }
      const order: NormalizedBrokerOrderRequest = {
        symbol: position.symbol,
        side: position.side === "buy" ? "sell" : "buy",
        type: "market",
        volume: position.volume,
        timeInForce: "gtc",
        clientRequestId: `close-${positionId}-${Date.now()}`,
        closePositionId: position.brokerPositionId,
      };
      const pending = await store.enqueueOrder(profile.id, order);
      return { accepted: true, orderId: pending.id };
    },

    onEvent(listener: (event: BrokerEvent) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
