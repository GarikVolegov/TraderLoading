import type {
  AccountAdapter,
  AccountBridgeEvent,
  AccountConnectionStatus,
  AccountMetrics,
  AccountOrderRequest,
  AccountOrderResult,
  AccountSnapshot,
  AccountTrade,
} from "./types.js";

const INITIAL_METRICS: AccountMetrics = {
  balance: 10_000,
  equity: 10_000,
  margin: 0,
  freeMargin: 10_000,
  currency: "USD",
  dailyProfit: 0,
};

function nowIso(): string {
  return new Date().toISOString();
}

function cloneTrade(trade: AccountTrade): AccountTrade {
  return { ...trade };
}

function cloneSnapshot(snapshot: AccountSnapshot): AccountSnapshot {
  return {
    ...snapshot,
    metrics: { ...snapshot.metrics },
    openTrades: snapshot.openTrades.map(cloneTrade),
    closedTrades: snapshot.closedTrades.map(cloneTrade),
  };
}

function cloneOrderResult(result: AccountOrderResult): AccountOrderResult {
  return { ...result };
}

function cloneEvent(event: AccountBridgeEvent): AccountBridgeEvent {
  switch (event.type) {
    case "snapshot":
      return { type: "snapshot", snapshot: cloneSnapshot(event.snapshot) };
    case "positions_update":
      return { type: "positions_update", openTrades: event.openTrades.map(cloneTrade) };
    case "order_ack":
      return { ...event, result: cloneOrderResult(event.result) };
    default:
      return event;
  }
}

function estimateEntryPrice(symbol: string): number {
  if (symbol.endsWith("JPY")) return 155;
  if (symbol.includes("XAU")) return 2_350;
  if (symbol.includes("BTC")) return 68_000;
  return 1.1;
}

export function createDemoAccountAdapter(): AccountAdapter {
  const listeners = new Set<(event: AccountBridgeEvent) => void>();
  let nextTicket = 1;
  let snapshot: AccountSnapshot = {
    status: "offline",
    mode: "demo",
    adapter: "demo",
    orderEnabled: true,
    account: {
      login: "DEMO",
      name: "Demo Account",
      server: "TraderLoading Demo",
      broker: "TraderLoading",
      tradeMode: "demo",
    },
    metrics: { ...INITIAL_METRICS },
    openTrades: [],
    closedTrades: [],
    lastUpdated: nowIso(),
  };

  function emit(event: AccountBridgeEvent): void {
    for (const listener of Array.from(listeners)) {
      try {
        listener(cloneEvent(event));
      } catch (error) {
        console.error("[accountBridge:demo] listener error", error);
      }
    }
  }

  function setStatus(status: AccountConnectionStatus): void {
    snapshot = { ...snapshot, status, lastUpdated: nowIso() };
    emit({ type: "snapshot", snapshot: cloneSnapshot(snapshot) });
  }

  return {
    id: "demo",
    mode: "demo",

    async connect(): Promise<void> {
      setStatus("connected");
    },

    async disconnect(): Promise<void> {
      setStatus("offline");
    },

    async getSnapshot(): Promise<AccountSnapshot> {
      return cloneSnapshot(snapshot);
    },

    async placeOrder(order: AccountOrderRequest): Promise<AccountOrderResult> {
      if (snapshot.status !== "connected") {
        return { accepted: false, reason: "Demo account is offline" };
      }

      const ticket = `DEMO-${String(nextTicket).padStart(6, "0")}`;
      nextTicket += 1;

      const trade: AccountTrade = {
        ticket,
        source: "demo",
        symbol: order.symbol.toUpperCase(),
        direction: order.direction,
        volume: order.volume,
        openTime: nowIso(),
        entryPrice: estimateEntryPrice(order.symbol.toUpperCase()),
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        status: "open",
      };
      const result: AccountOrderResult = { accepted: true, ticket };
      const ackResult = cloneOrderResult(result);

      snapshot = {
        ...snapshot,
        openTrades: [...snapshot.openTrades, trade],
        lastUpdated: nowIso(),
      };

      emit({ type: "positions_update", openTrades: snapshot.openTrades.map(cloneTrade) });
      emit({ type: "order_ack", result: ackResult });

      return cloneOrderResult(result);
    },

    onEvent(listener: (event: AccountBridgeEvent) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
