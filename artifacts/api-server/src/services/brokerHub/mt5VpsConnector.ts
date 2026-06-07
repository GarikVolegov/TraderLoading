import { createConnection, type Socket } from "node:net";
import type {
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
import { mapMt5Trade } from "./mappers.js";
import type { BrokerVault } from "./brokerVault.js";

type Mt5Message = { type: string; payload?: unknown };

function emptySnapshot(profile: BrokerAccountProfile, status: BrokerSnapshot["status"], error?: string): BrokerSnapshot {
  return {
    profileId: profile.id,
    status,
    kind: "mt5-vps-bridge",
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseLine(line: string): Mt5Message | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    return isObject(parsed) && typeof parsed.type === "string" ? (parsed as Mt5Message) : null;
  } catch {
    return null;
  }
}

function message(type: string, payload: Record<string, unknown>): string {
  return `${JSON.stringify({ type, payload })}\n`;
}

export function createMt5VpsBrokerConnector(profile: BrokerAccountProfile, vault: BrokerVault): BrokerConnector {
  const listeners = new Set<(event: BrokerEvent) => void>();
  let socket: Socket | null = null;
  let buffer = "";
  let snapshot = emptySnapshot(profile, "offline");
  let orders: BrokerOrder[] = [];
  let deals: BrokerDeal[] = [];

  function emit(event: BrokerEvent): void {
    for (const listener of Array.from(listeners)) listener(event);
  }

  function updateSnapshotFromPayload(payload: unknown): void {
    const data = isObject(payload) ? payload : {};
    const metrics = isObject(data.metrics) ? data.metrics : {};
    const openTrades = Array.isArray(data.openTrades) ? data.openTrades : [];
    const account = isObject(data.account) ? data.account : {};
    const currency = typeof metrics.currency === "string" ? metrics.currency : "USD";
    const accountId = account.login == null ? profile.accountId : String(account.login);

    snapshot = {
      ...snapshot,
      status: "connected",
      accounts: accountId
        ? [{ id: accountId, label: profile.label, brokerName: profile.brokerName, currency, environment: profile.environment }]
        : [],
      metrics: {
        balance: typeof metrics.balance === "number" ? metrics.balance : 0,
        equity: typeof metrics.equity === "number" ? metrics.equity : 0,
        margin: typeof metrics.margin === "number" ? metrics.margin : 0,
        freeMargin: typeof metrics.freeMargin === "number" ? metrics.freeMargin : 0,
        currency,
        dailyProfit: typeof metrics.dailyProfit === "number" ? metrics.dailyProfit : 0,
      },
      positions: openTrades.map(mapMt5Trade),
      lastUpdated: new Date().toISOString(),
      error: undefined,
    };
    emit({ type: "snapshot", snapshot });
  }

  function handleMessage(line: string): void {
    const parsed = parseLine(line);
    if (!parsed) return;
    if (parsed.type === "snapshot" || parsed.type === "positions_update") {
      updateSnapshotFromPayload(parsed.payload);
      return;
    }
    if (parsed.type === "trade_closed" && isObject(parsed.payload) && isObject(parsed.payload.trade)) {
      const position = mapMt5Trade(parsed.payload.trade);
      const deal: BrokerDeal = {
        id: position.id,
        symbol: position.symbol,
        side: position.side,
        volume: position.volume,
        entryPrice: position.entryPrice,
        profit: position.profit,
        openedAt: position.openedAt,
        closedAt: new Date().toISOString(),
        source: "mt5-vps-bridge",
      };
      deals = [deal, ...deals];
      emit({ type: "deal_closed", profileId: profile.id, deal });
    }
    if (parsed.type === "error" && isObject(parsed.payload) && typeof parsed.payload.message === "string") {
      snapshot = { ...snapshot, status: "error", error: parsed.payload.message };
      emit({ type: "broker_error", profileId: profile.id, message: parsed.payload.message });
    }
  }

  async function send(type: string, payload: Record<string, unknown>): Promise<void> {
    if (!socket || snapshot.status !== "connected") throw new Error("MT5 VPS bridge is not connected");
    const token = await vault.getSecret(profile.id, "bridgeToken");
    socket.write(message(type, { ...payload, token }));
  }

  return {
    async connect(): Promise<BrokerSnapshot> {
      snapshot = emptySnapshot(profile, "connecting");
      const host = profile.host ?? "127.0.0.1";
      const port = profile.port ?? 8765;
      const token = await vault.getSecret(profile.id, "bridgeToken");
      if (!token) {
        snapshot = emptySnapshot(profile, "error", "MT5 VPS bridge token is missing");
        return snapshot;
      }

      await new Promise<void>((resolve) => {
        const client = createConnection({ host, port }, () => {
          socket = client;
          snapshot = emptySnapshot(profile, "connected");
          client.write(message("snapshot", { token }));
          resolve();
        });
        client.on("data", (chunk) => {
          buffer += chunk.toString("utf8");
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed) handleMessage(trimmed);
          }
        });
        client.on("error", (error) => {
          snapshot = emptySnapshot(profile, "error", error.message);
          emit({ type: "broker_error", profileId: profile.id, message: error.message });
          resolve();
        });
        client.on("close", () => {
          if (snapshot.status !== "error") snapshot = emptySnapshot(profile, "offline");
        });
      });
      emit({ type: "snapshot", snapshot });
      return snapshot;
    },

    async disconnect(): Promise<void> {
      socket?.destroy();
      socket = null;
      snapshot = emptySnapshot(profile, "offline");
      emit({ type: "snapshot", snapshot });
    },

    async getAccounts() {
      return snapshot.accounts;
    },
    async getSnapshot() {
      return snapshot;
    },
    async getPositions(): Promise<BrokerPosition[]> {
      return snapshot.positions;
    },
    async getOrders(): Promise<BrokerOrder[]> {
      return orders;
    },
    async getDealsHistory(): Promise<BrokerDeal[]> {
      return deals;
    },
    async placeOrder(order: NormalizedBrokerOrderRequest): Promise<BrokerOrderResult> {
      try {
        await send("place_order", { requestId: order.clientRequestId, order });
        const brokerOrder: BrokerOrder = {
          id: order.clientRequestId,
          symbol: order.symbol,
          side: order.side,
          type: order.type,
          volume: order.volume,
          status: "accepted",
          createdAt: new Date().toISOString(),
        };
        orders = [brokerOrder, ...orders];
        emit({ type: "order_update", profileId: profile.id, order: brokerOrder });
        return { accepted: true, orderId: brokerOrder.id };
      } catch (error) {
        return { accepted: false, reason: error instanceof Error ? error.message : "MT5 VPS order failed" };
      }
    },
    async modifyOrder(): Promise<BrokerOrderResult> {
      return { accepted: false, reason: "MT5 VPS order modification is not available in this bridge version" };
    },
    async closePosition(positionId: string): Promise<BrokerOrderResult> {
      try {
        await send("close_position", { positionId });
        return { accepted: true, orderId: `close-${positionId}` };
      } catch (error) {
        return { accepted: false, reason: error instanceof Error ? error.message : "MT5 VPS close failed" };
      }
    },
    onEvent(listener: (event: BrokerEvent) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
