import type {
  BrokerAccount,
  BrokerAccountProfile,
  BrokerConnector,
  BrokerDeal,
  BrokerEvent,
  BrokerMetrics,
  BrokerOrder,
  BrokerOrderResult,
  BrokerPosition,
  BrokerSnapshot,
  NormalizedBrokerOrderRequest,
} from "./types.js";

const INITIAL_METRICS: BrokerMetrics = {
  balance: 25_000,
  equity: 25_000,
  margin: 0,
  freeMargin: 25_000,
  currency: "USD",
  dailyProfit: 0,
};

function now(): string {
  return new Date().toISOString();
}

function estimatePrice(symbol: string): number {
  if (symbol.includes("XAU")) return 2350;
  if (symbol.includes("BTC")) return 68000;
  if (symbol.endsWith("JPY")) return 155;
  return 1.1;
}

export function createDemoBrokerConnector(profile: BrokerAccountProfile): BrokerConnector {
  const listeners = new Set<(event: BrokerEvent) => void>();
  const account: BrokerAccount = {
    id: profile.accountId || "DEMO-1",
    label: profile.label,
    brokerName: profile.brokerName,
    currency: "USD",
    environment: "demo",
  };
  let nextOrder = 1;
  let positions: BrokerPosition[] = [];
  let orders: BrokerOrder[] = [];
  let deals: BrokerDeal[] = [];
  let status: BrokerSnapshot["status"] = "offline";

  function snapshot(): BrokerSnapshot {
    return {
      profileId: profile.id,
      status,
      kind: "demo",
      brokerName: profile.brokerName,
      tradingEnabled: profile.tradingEnabled,
      accounts: [account],
      metrics: { ...INITIAL_METRICS, margin: positions.length * 100, freeMargin: INITIAL_METRICS.freeMargin - positions.length * 100 },
      positions: positions.map((position) => ({ ...position })),
      orders: orders.map((order) => ({ ...order })),
      lastUpdated: now(),
    };
  }

  function emit(event: BrokerEvent): void {
    for (const listener of Array.from(listeners)) listener(event);
  }

  return {
    async connect(): Promise<BrokerSnapshot> {
      status = "connected";
      const next = snapshot();
      emit({ type: "snapshot", snapshot: next });
      return next;
    },

    async disconnect(): Promise<void> {
      status = "offline";
      emit({ type: "snapshot", snapshot: snapshot() });
    },

    async getAccounts(): Promise<BrokerAccount[]> {
      return [account];
    },

    async getSnapshot(): Promise<BrokerSnapshot> {
      return snapshot();
    },

    async getPositions(): Promise<BrokerPosition[]> {
      return positions.map((position) => ({ ...position }));
    },

    async getOrders(): Promise<BrokerOrder[]> {
      return orders.map((order) => ({ ...order }));
    },

    async getDealsHistory(): Promise<BrokerDeal[]> {
      return deals.map((deal) => ({ ...deal }));
    },

    async placeOrder(order: NormalizedBrokerOrderRequest): Promise<BrokerOrderResult> {
      if (status !== "connected") return { accepted: false, reason: "Broker profile is not connected" };
      const orderId = `DEMO-ORDER-${String(nextOrder).padStart(6, "0")}`;
      nextOrder += 1;
      const createdAt = now();
      const brokerOrder: BrokerOrder = {
        id: order.clientRequestId,
        brokerOrderId: orderId,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        volume: order.volume,
        status: "filled",
        createdAt,
      };
      const position: BrokerPosition = {
        id: orderId,
        brokerPositionId: orderId,
        symbol: order.symbol,
        side: order.side,
        volume: order.volume,
        entryPrice: estimatePrice(order.symbol),
        profit: 0,
        openedAt: createdAt,
        source: "demo",
      };
      orders = [brokerOrder, ...orders];
      positions = [position, ...positions];
      deals = [{
        id: orderId,
        symbol: order.symbol,
        side: order.side,
        volume: order.volume,
        entryPrice: position.entryPrice,
        openedAt: createdAt,
        source: "demo",
      }, ...deals];
      emit({ type: "order_update", profileId: profile.id, order: brokerOrder });
      emit({ type: "position_update", profileId: profile.id, positions });
      return { accepted: true, orderId: brokerOrder.id, brokerOrderId: orderId };
    },

    async modifyOrder(): Promise<BrokerOrderResult> {
      return { accepted: false, reason: "Demo order modification is not implemented" };
    },

    async closePosition(positionId: string): Promise<BrokerOrderResult> {
      const position = positions.find((item) => item.id === positionId);
      if (!position) return { accepted: false, reason: "Position not found" };
      positions = positions.filter((item) => item.id !== positionId);
      const deal: BrokerDeal = { ...position, id: `CLOSE-${position.id}`, closedAt: now() };
      deals = [deal, ...deals];
      emit({ type: "deal_closed", profileId: profile.id, deal });
      emit({ type: "position_update", profileId: profile.id, positions });
      return { accepted: true, orderId: deal.id, brokerOrderId: deal.id };
    },

    onEvent(listener: (event: BrokerEvent) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
