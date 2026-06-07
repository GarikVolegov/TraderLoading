import { createConnection, type Socket } from "node:net";
import type {
  AccountAdapter,
  AccountBridgeConfig,
  AccountBridgeEvent,
  AccountIdentity,
  AccountConnectionStatus,
  AccountMetrics,
  AccountOrderRequest,
  AccountOrderResult,
  AccountSnapshot,
  AccountTrade,
} from "./types.js";

type Listener = (event: AccountBridgeEvent) => void;
type Mt5Message = { type: string; payload: unknown };
type PendingOrder = {
  resolve: (result: AccountOrderResult) => void;
  timer: ReturnType<typeof setTimeout>;
};

const EMPTY_METRICS: AccountMetrics = {
  balance: 0,
  equity: 0,
  margin: 0,
  freeMargin: 0,
  currency: "USD",
  dailyProfit: 0,
};

function nowIso(): string {
  return new Date().toISOString();
}

function orderEnabledFor(config: AccountBridgeConfig): boolean {
  return config.mode === "live" && config.orderEnabled;
}

function cloneTrade(trade: AccountTrade): AccountTrade {
  return { ...trade };
}

function cloneSnapshot(snapshot: AccountSnapshot): AccountSnapshot {
  const openTrades = Array.isArray(snapshot.openTrades) ? snapshot.openTrades : [];
  const closedTrades = Array.isArray(snapshot.closedTrades) ? snapshot.closedTrades : [];

  return {
    ...snapshot,
    account: snapshot.account ? { ...snapshot.account } : undefined,
    metrics: { ...(isObject(snapshot.metrics) ? snapshot.metrics : EMPTY_METRICS) },
    openTrades: openTrades.map(cloneTrade),
    closedTrades: closedTrades.map(cloneTrade),
  };
}

function cloneOrderResult(result: AccountOrderResult): AccountOrderResult {
  return { ...result };
}

function cloneEvent(event: AccountBridgeEvent): AccountBridgeEvent {
  switch (event.type) {
    case "snapshot":
      return { type: "snapshot", snapshot: cloneSnapshot(event.snapshot) };
    case "account_update":
      return { type: "account_update", metrics: { ...event.metrics } };
    case "positions_update":
      return { type: "positions_update", openTrades: event.openTrades.map(cloneTrade) };
    case "trade_closed":
      return { type: "trade_closed", trade: cloneTrade(event.trade) };
    case "order_ack":
      return { ...event, result: cloneOrderResult(event.result) };
    default:
      return event;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function buildMt5Message(type: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ type, payload }) + "\n";
}

export function parseMt5Line(line: string): Mt5Message | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isObject(parsed)) return null;
    if (typeof parsed.type !== "string") return null;
    return { type: parsed.type, payload: parsed.payload };
  } catch {
    return null;
  }
}

export function createMt5LocalSocketAdapter(config: AccountBridgeConfig): AccountAdapter {
  const listeners = new Set<Listener>();
  const pendingOrders = new Map<string, PendingOrder>();
  let socket: Socket | null = null;
  let status: AccountConnectionStatus = "offline";
  let connectionGeneration = 0;
  let connectPromise: Promise<void> | null = null;
  let connectPromiseGeneration: number | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let nextOrderRequestId = 1;
  let manuallyDisconnected = true;
  let lastSnapshot: AccountSnapshot = {
    status,
    mode: config.mode,
    adapter: "mt5-local-socket",
    orderEnabled: orderEnabledFor(config),
    metrics: { ...EMPTY_METRICS },
    openTrades: [],
    closedTrades: [],
    lastUpdated: nowIso(),
  };

  function clearReconnectTimer(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function emit(event: AccountBridgeEvent): void {
    for (const listener of Array.from(listeners)) {
      try {
        listener(cloneEvent(event));
      } catch (error) {
        console.error("[accountBridge:mt5-local-socket] listener error", error);
      }
    }
  }

  function updateSnapshot(next: AccountSnapshot): void {
    status = next.status;
    lastSnapshot = {
      ...next,
      mode: config.mode,
      adapter: "mt5-local-socket",
      orderEnabled: orderEnabledFor(config),
      lastUpdated: nowIso(),
    };
    emit({ type: "snapshot", snapshot: cloneSnapshot(lastSnapshot) });
  }

  function setStatus(nextStatus: AccountConnectionStatus, error?: string): void {
    updateSnapshot({
      ...lastSnapshot,
      status: nextStatus,
      error,
    });
  }

  function setError(message: string): void {
    setStatus("error", message);
    emit({ type: "error", message });
  }

  function normalizeTrades(value: unknown, fallback: AccountTrade[]): AccountTrade[] {
    if (!Array.isArray(value)) return fallback.map(cloneTrade);
    return value.filter(isObject).map((trade) => ({ ...trade }) as unknown as AccountTrade);
  }

  function normalizeAccount(value: unknown): AccountIdentity | undefined {
    if (!isObject(value)) return lastSnapshot.account ? { ...lastSnapshot.account } : undefined;

    const account: AccountIdentity = {};
    if (typeof value.login === "string" || typeof value.login === "number") account.login = String(value.login);
    if (typeof value.name === "string") account.name = value.name;
    if (typeof value.server === "string") account.server = value.server;
    if (typeof value.broker === "string") account.broker = value.broker;
    if (typeof value.leverage === "number" && Number.isFinite(value.leverage)) account.leverage = value.leverage;
    if (typeof value.tradeMode === "string") account.tradeMode = value.tradeMode;

    return Object.keys(account).length > 0 ? account : undefined;
  }

  function normalizeMetrics(value: unknown): AccountMetrics {
    if (!isObject(value)) return { ...lastSnapshot.metrics };

    return {
      balance: typeof value.balance === "number" ? value.balance : lastSnapshot.metrics.balance,
      equity: typeof value.equity === "number" ? value.equity : lastSnapshot.metrics.equity,
      margin: typeof value.margin === "number" ? value.margin : lastSnapshot.metrics.margin,
      freeMargin: typeof value.freeMargin === "number" ? value.freeMargin : lastSnapshot.metrics.freeMargin,
      currency: typeof value.currency === "string" ? value.currency : lastSnapshot.metrics.currency,
      dailyProfit: typeof value.dailyProfit === "number" ? value.dailyProfit : lastSnapshot.metrics.dailyProfit,
    };
  }

  function normalizeSnapshotPayload(payload: Record<string, unknown>): Partial<AccountSnapshot> {
    return {
      account: normalizeAccount(payload.account),
      metrics: normalizeMetrics(payload.metrics),
      openTrades: normalizeTrades(payload.openTrades, lastSnapshot.openTrades),
      closedTrades: normalizeTrades(payload.closedTrades, lastSnapshot.closedTrades),
      error: typeof payload.error === "string" ? payload.error : undefined,
    };
  }

  function normalizeOrderResult(value: unknown): AccountOrderResult {
    if (!isObject(value)) return { accepted: false, reason: "Invalid MT5 order acknowledgement" };
    const result: AccountOrderResult = {
      accepted: value.accepted === true,
      ticket: typeof value.ticket === "string" || typeof value.ticket === "number" ? String(value.ticket) : undefined,
      reason: typeof value.reason === "string" ? value.reason : undefined,
    };
    if (result.ticket === undefined) delete result.ticket;
    if (result.reason === undefined) delete result.reason;
    return result;
  }

  function resolvePendingOrder(requestId: string, result: AccountOrderResult): boolean {
    const pending = pendingOrders.get(requestId);
    if (!pending) return false;
    clearTimeout(pending.timer);
    pendingOrders.delete(requestId);
    pending.resolve(result);
    return true;
  }

  function clearPendingOrders(reason: string): void {
    for (const [requestId, pending] of pendingOrders) {
      clearTimeout(pending.timer);
      pending.resolve({ accepted: false, reason });
      pendingOrders.delete(requestId);
    }
  }

  function handleLine(line: string, generation: number): void {
    if (generation !== connectionGeneration) return;

    const message = parseMt5Line(line);
    if (!message || !isObject(message.payload)) return;

    if (message.type === "order_ack") {
      const requestId = typeof message.payload.requestId === "string" ? message.payload.requestId : "";
      const result = normalizeOrderResult(message.payload.result);
      if (!requestId || !resolvePendingOrder(requestId, result)) {
        emit({ type: "order_ack", requestId, result });
      }
      return;
    }

    if (message.type === "error") {
      const errorMessage = typeof message.payload.message === "string" ? message.payload.message : "MT5 bridge error";
      setError(errorMessage);
      return;
    }

    if (message.type === "positions_update") {
      const openTrades = normalizeTrades(message.payload.openTrades, lastSnapshot.openTrades);
      lastSnapshot = { ...lastSnapshot, openTrades, lastUpdated: nowIso() };
      emit({ type: "positions_update", openTrades });
      return;
    }

    if (message.type === "trade_closed" && isObject(message.payload.trade)) {
      emit({ type: "trade_closed", trade: { ...message.payload.trade } as unknown as AccountTrade });
      return;
    }

    if (message.type !== "snapshot") return;
    const payload = normalizeSnapshotPayload(message.payload);

    updateSnapshot({
      ...lastSnapshot,
      ...payload,
      status: "connected",
      mode: config.mode,
      adapter: "mt5-local-socket",
      orderEnabled: orderEnabledFor(config),
    });
  }

  function handleData(chunk: Buffer | string, generation: number, currentBuffer: { value: string }): void {
    if (generation !== connectionGeneration) return;

    currentBuffer.value += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    const lines = currentBuffer.value.split("\n");
    currentBuffer.value = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) handleLine(trimmed, generation);
    }
  }

  function scheduleReconnect(): void {
    if (manuallyDisconnected || reconnectTimer) return;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!manuallyDisconnected) {
        void connectImpl();
      }
    }, 50);
    reconnectTimer.unref?.();
  }

  async function startConnection(generation: number): Promise<void> {
    clearReconnectTimer();
    const currentBuffer = { value: "" };
    status = "connecting";
    lastSnapshot = { ...lastSnapshot, status, error: undefined, lastUpdated: nowIso() };

    if (socket && !socket.destroyed) {
      socket.destroy();
    }

    await new Promise<void>((resolve) => {
      let settled = false;
      const resolveOnce = (): void => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      const client = createConnection({ host: config.host, port: config.port }, () => {
        if (generation !== connectionGeneration) {
          client.destroy();
          resolveOnce();
          return;
        }

        socket = client;
        status = "connected";
        lastSnapshot = { ...lastSnapshot, status, error: undefined, lastUpdated: nowIso() };
        client.write(buildMt5Message("snapshot", {}));
        resolveOnce();
      });

      socket = client;

      client.on("data", (chunk) => {
        handleData(chunk, generation, currentBuffer);
      });
      client.on("error", (error) => {
        if (generation === connectionGeneration) {
          setError(error.message);
        }
        resolveOnce();
      });
      client.on("close", () => {
        if (generation !== connectionGeneration) {
          resolveOnce();
          return;
        }

        if (socket === client) socket = null;
        if (status !== "error") {
          setStatus("offline");
        }
        clearPendingOrders("MT5 bridge disconnected before acknowledging the order");
        scheduleReconnect();
        resolveOnce();
      });
    });
  }

  async function connectImpl(): Promise<void> {
    manuallyDisconnected = false;

    if (status === "connected" && socket && !socket.destroyed) return;
    if (connectPromise && connectPromiseGeneration === connectionGeneration) return connectPromise;

    connectionGeneration += 1;
    const generation = connectionGeneration;
    connectPromiseGeneration = generation;
    connectPromise = startConnection(generation);

    try {
      await connectPromise;
    } finally {
      if (connectPromiseGeneration === generation) {
        connectPromise = null;
        connectPromiseGeneration = null;
      }
    }
  }

  return {
    id: "mt5-local-socket",
    mode: config.mode,

    async connect(): Promise<void> {
      await connectImpl();
    },

    async disconnect(): Promise<void> {
      manuallyDisconnected = true;
      clearReconnectTimer();
      clearPendingOrders("MT5 bridge disconnected before acknowledging the order");
      connectionGeneration += 1;
      connectPromiseGeneration = null;
      const currentSocket = socket;
      socket = null;
      currentSocket?.destroy();
      setStatus("offline");
    },

    async getSnapshot(): Promise<AccountSnapshot> {
      return cloneSnapshot(lastSnapshot);
    },

    async placeOrder(order: AccountOrderRequest): Promise<AccountOrderResult> {
      if (!socket || status !== "connected") {
        return { accepted: false, reason: "MT5 bridge is not connected" };
      }

      if (config.mode !== "live" || !config.orderEnabled) {
        return { accepted: false, reason: "Live order sending is disabled" };
      }

      const activeSocket = socket;
      const requestId = `mt5-${Date.now()}-${nextOrderRequestId++}`;
      return new Promise<AccountOrderResult>((resolve) => {
        const timer = setTimeout(() => {
          pendingOrders.delete(requestId);
          resolve({ accepted: false, reason: "MT5 bridge did not acknowledge the order in time" });
        }, config.orderAckTimeoutMs);
        timer.unref?.();

        pendingOrders.set(requestId, { resolve, timer });
        activeSocket.write(buildMt5Message("place_order", { requestId, order }));
      });
    },

    onEvent(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
