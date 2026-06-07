import { WebSocket } from "ws";
import type {
  BrokerCapabilities,
  BrokerDeal,
  BrokerEnvironment,
  BrokerMetrics,
  BrokerOrder,
  BrokerOrderResult,
  BrokerPosition,
  BrokerSnapshot,
  NormalizedBrokerOrderRequest,
} from "./types.js";

export interface CTraderMessage {
  clientMsgId?: string;
  payloadType: number;
  payload?: Record<string, unknown>;
  errorCode?: string;
  description?: string;
}

export interface CTraderTransport {
  request(payloadType: number, payload: Record<string, unknown>): Promise<CTraderMessage>;
  close(): void;
}

export const CTRADER_PAYLOAD_TYPES = {
  APPLICATION_AUTH_REQ: 2100,
  APPLICATION_AUTH_RES: 2101,
  ACCOUNT_AUTH_REQ: 2102,
  ACCOUNT_AUTH_RES: 2103,
  NEW_ORDER_REQ: 2106,
  CLOSE_POSITION_REQ: 2111,
  SYMBOLS_LIST_REQ: 2114,
  SYMBOLS_LIST_RES: 2115,
  TRADER_REQ: 2121,
  TRADER_RES: 2122,
  RECONCILE_REQ: 2124,
  RECONCILE_RES: 2125,
  EXECUTION_EVENT: 2126,
  DEAL_LIST_REQ: 2133,
  DEAL_LIST_RES: 2134,
  ERROR_RES: 2142,
  GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ: 2149,
  GET_ACCOUNTS_BY_ACCESS_TOKEN_RES: 2150,
} as const;

const CTRADER_KIND = "ctrader-open-api" as const;
const LIVE_URL = "wss://live1.p.ctrader.com:5035";
const DEMO_URL = "wss://demo1.p.ctrader.com:5035";

interface CTraderProviderOptions {
  transportFactory?: (environment: BrokerEnvironment) => CTraderTransport;
  liveUrl?: string;
  demoUrl?: string;
}

interface CTraderSnapshotInput {
  profileId: string;
  brokerName: string;
  accountId: string;
  environment: BrokerEnvironment;
  tradingEnabled: boolean;
  accessToken: string;
  clientId: string;
  clientSecret: string;
}

interface CTraderOrderInput {
  accountId: string;
  order: NormalizedBrokerOrderRequest;
}

interface CTraderCloseInput {
  accountId: string;
  positionId: string;
}

interface CTraderSession {
  accountId: number;
  environment: BrokerEnvironment;
  transport: CTraderTransport;
  symbolsByName: Map<string, number>;
  symbolsById: Map<number, string>;
  positionVolumes: Map<string, number>;
  moneyDigits: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function array(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function number(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function optionalNumber(value: unknown): number | undefined {
  const parsed = number(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeSymbol(value: string): string {
  return value.replaceAll("/", "").replaceAll(" ", "").toUpperCase();
}

function money(value: unknown, digits: number): number {
  return number(value) / 10 ** digits;
}

function volumeToProtocol(value: number): number {
  return Math.round(value * 100);
}

function volumeFromProtocol(value: unknown): number {
  return number(value) / 100;
}

function timestamp(value: unknown): string | undefined {
  const parsed = number(value, Number.NaN);
  return Number.isFinite(parsed) && parsed > 0 ? new Date(parsed).toISOString() : undefined;
}

function messageError(message: CTraderMessage): string | null {
  if (message.payloadType === CTRADER_PAYLOAD_TYPES.ERROR_RES) {
    const payload = message.payload ?? {};
    return String(payload.description ?? payload.errorCode ?? message.description ?? message.errorCode ?? "Richiesta cTrader rifiutata.");
  }
  const payload = message.payload ?? {};
  if (typeof payload.errorCode === "string" || typeof message.errorCode === "string") {
    return String(payload.description ?? payload.errorCode ?? message.description ?? message.errorCode);
  }
  return null;
}

function assertResponse(message: CTraderMessage, acceptedTypes: number[]): Record<string, unknown> {
  const error = messageError(message);
  if (error) throw new Error(mapCTraderError(error));
  if (!acceptedTypes.includes(message.payloadType)) {
    throw new Error(`Risposta cTrader inattesa: ${message.payloadType}`);
  }
  return message.payload ?? {};
}

function mapCTraderError(error: string): string {
  if (error.includes("CH_ACCESS_TOKEN_INVALID")) return "Accesso cTrader non valido o scaduto. Ricollega il conto.";
  if (error.includes("CH_CTID_TRADER_ACCOUNT_NOT_FOUND")) return "Conto cTrader non trovato per questo accesso.";
  if (error.includes("CH_OA_CLIENT_NOT_FOUND")) return "Applicazione cTrader non configurata correttamente sul server.";
  if (error.includes("TRADING_NOT_ALLOWED")) return "Questo conto cTrader e' in sola lettura.";
  if (error.includes("TRADING_BAD_VOLUME")) return "Volume ordine non valido per questo simbolo.";
  if (error.includes("NOT_ENOUGH_MONEY")) return "Margine insufficiente per aprire l'operazione.";
  if (error.includes("POSITION_NOT_FOUND")) return "Posizione cTrader non trovata.";
  return error || "Richiesta cTrader non riuscita.";
}

function capabilities(accessRights: unknown): BrokerCapabilities {
  const rights = number(accessRights, 0);
  return {
    readAccount: rights !== 3,
    readPositions: rights !== 3,
    readHistory: rights !== 3,
    placeOrders: rights === 0,
    closePositions: rights === 0 || rights === 1,
  };
}

function orderType(type: NormalizedBrokerOrderRequest["type"]): number {
  if (type === "limit") return 2;
  if (type === "stop") return 3;
  return 1;
}

function orderStatus(value: unknown): BrokerOrder["status"] {
  const status = number(value, 1);
  if (status === 2) return "filled";
  if (status === 3) return "rejected";
  if (status === 5) return "cancelled";
  return "pending";
}

function accountEnvironment(value: BrokerEnvironment): BrokerEnvironment {
  return value === "demo" ? "demo" : "live";
}

function executionResult(message: CTraderMessage): BrokerOrderResult {
  const payload = assertResponse(message, [CTRADER_PAYLOAD_TYPES.EXECUTION_EVENT]);
  if (payload.errorCode) return { accepted: false, reason: mapCTraderError(String(payload.errorCode)) };
  const order = isRecord(payload.order) ? payload.order : {};
  const position = isRecord(payload.position) ? payload.position : {};
  const id = String(order.orderId ?? position.positionId ?? crypto.randomUUID());
  return { accepted: true, orderId: id, brokerOrderId: id };
}

function makeMetrics(trader: Record<string, unknown>, moneyDigits: number): BrokerMetrics {
  const balance = money(trader.balance, moneyDigits);
  const equity = optionalNumber(trader.equity) === undefined ? balance : money(trader.equity, moneyDigits);
  const margin = money(trader.usedMargin ?? trader.margin, moneyDigits);
  const freeMargin =
    optionalNumber(trader.freeMargin) === undefined ? Math.max(equity - margin, 0) : money(trader.freeMargin, moneyDigits);
  return { balance, equity, margin, freeMargin, currency: String(trader.depositAssetName ?? "USD"), dailyProfit: 0 };
}

function mapPosition(position: Record<string, unknown>, session: CTraderSession): BrokerPosition {
  const tradeData = isRecord(position.tradeData) ? position.tradeData : {};
  const positionId = String(position.positionId ?? crypto.randomUUID());
  const symbolId = number(tradeData.symbolId);
  const volume = number(tradeData.volume);
  session.positionVolumes.set(positionId, volume);
  return {
    id: `ctrader-position-${positionId}`,
    brokerPositionId: positionId,
    symbol: session.symbolsById.get(symbolId) ?? String(symbolId),
    side: number(tradeData.tradeSide, 1) === 2 ? "sell" : "buy",
    volume: volumeFromProtocol(volume),
    entryPrice: optionalNumber(position.price ?? position.entryPrice),
    markPrice: optionalNumber(position.markPrice),
    profit: optionalNumber(position.unrealizedPnL) === undefined ? undefined : money(position.unrealizedPnL, session.moneyDigits),
    openedAt: timestamp(tradeData.openTimestamp),
    source: CTRADER_KIND,
  };
}

function mapOrder(order: Record<string, unknown>, session: CTraderSession): BrokerOrder {
  const tradeData = isRecord(order.tradeData) ? order.tradeData : {};
  const orderId = String(order.orderId ?? crypto.randomUUID());
  const type = number(order.orderType, 1);
  return {
    id: `ctrader-order-${orderId}`,
    brokerOrderId: orderId,
    symbol: session.symbolsById.get(number(tradeData.symbolId)) ?? String(tradeData.symbolId ?? ""),
    side: number(tradeData.tradeSide, 1) === 2 ? "sell" : "buy",
    type: type === 2 ? "limit" : type === 3 ? "stop" : "market",
    volume: volumeFromProtocol(tradeData.volume),
    status: orderStatus(order.orderStatus),
    createdAt: timestamp(tradeData.openTimestamp) ?? new Date().toISOString(),
  };
}

function mapDeal(deal: Record<string, unknown>, session: CTraderSession): BrokerDeal {
  const tradeData = isRecord(deal.tradeData) ? deal.tradeData : {};
  const dealId = String(deal.dealId ?? deal.executionTimestamp ?? crypto.randomUUID());
  return {
    id: `ctrader-deal-${dealId}`,
    symbol: session.symbolsById.get(number(tradeData.symbolId)) ?? String(tradeData.symbolId ?? ""),
    side: number(tradeData.tradeSide, 1) === 2 ? "sell" : "buy",
    volume: volumeFromProtocol(tradeData.volume ?? deal.volume),
    exitPrice: optionalNumber(deal.executionPrice),
    profit: optionalNumber(deal.pnl) === undefined ? undefined : money(deal.pnl, session.moneyDigits),
    openedAt: timestamp(tradeData.openTimestamp),
    closedAt: timestamp(deal.executionTimestamp ?? tradeData.closeTimestamp),
    source: CTRADER_KIND,
  };
}

function urlFor(environment: BrokerEnvironment, options: CTraderProviderOptions): string {
  if (environment === "demo") return options.demoUrl ?? process.env.CTRADER_DEMO_URL ?? DEMO_URL;
  return options.liveUrl ?? process.env.CTRADER_LIVE_URL ?? LIVE_URL;
}

export function createJsonWebSocketCTraderTransport(url: string, timeoutMs = 15000): CTraderTransport {
  const socket = new WebSocket(url);
  const opened = new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
  const pending = new Map<string, { resolve: (message: CTraderMessage) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

  socket.on("message", (raw) => {
    let parsed: CTraderMessage | null = null;
    try {
      parsed = JSON.parse(String(raw)) as CTraderMessage;
    } catch {
      return;
    }
    if (!parsed.clientMsgId) return;
    const request = pending.get(parsed.clientMsgId);
    if (!request) return;
    clearTimeout(request.timer);
    pending.delete(parsed.clientMsgId);
    request.resolve(parsed);
  });

  socket.on("error", (error) => {
    for (const [key, request] of pending) {
      clearTimeout(request.timer);
      pending.delete(key);
      request.reject(error instanceof Error ? error : new Error("Connessione cTrader non riuscita."));
    }
  });

  return {
    async request(payloadType: number, payload: Record<string, unknown>): Promise<CTraderMessage> {
      await opened;
      const clientMsgId = crypto.randomUUID();
      return new Promise<CTraderMessage>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(clientMsgId);
          reject(new Error("Timeout risposta cTrader."));
        }, timeoutMs);
        pending.set(clientMsgId, { resolve, reject, timer });
        socket.send(JSON.stringify({ clientMsgId, payloadType, payload }), (error) => {
          if (!error) return;
          clearTimeout(timer);
          pending.delete(clientMsgId);
          reject(error);
        });
      });
    },
    close(): void {
      socket.close();
    },
  };
}

export function createCTraderProvider(options: CTraderProviderOptions = {}) {
  const sessions = new Map<string, CTraderSession>();
  const transportFactory =
    options.transportFactory ??
    ((environment: BrokerEnvironment) => createJsonWebSocketCTraderTransport(urlFor(environment, options)));

  function requireConfig(input: Pick<CTraderSnapshotInput, "accessToken" | "clientId" | "clientSecret">): void {
    if (!input.accessToken || !input.clientId || !input.clientSecret) {
      throw new Error("Configurazione cTrader incompleta. Ricollega il conto o configura l'applicazione cTrader sul server.");
    }
  }

  async function authenticate(input: CTraderSnapshotInput): Promise<CTraderSession> {
    requireConfig(input);
    const sessionKey = `${input.environment}:${input.accountId}`;
    const existing = sessions.get(sessionKey);
    if (existing) return existing;

    const transport = transportFactory(input.environment);
    assertResponse(
      await transport.request(CTRADER_PAYLOAD_TYPES.APPLICATION_AUTH_REQ, {
        clientId: input.clientId,
        clientSecret: input.clientSecret,
      }),
      [CTRADER_PAYLOAD_TYPES.APPLICATION_AUTH_RES],
    );
    const accountsPayload = assertResponse(
      await transport.request(CTRADER_PAYLOAD_TYPES.GET_ACCOUNTS_BY_ACCESS_TOKEN_REQ, { accessToken: input.accessToken }),
      [CTRADER_PAYLOAD_TYPES.GET_ACCOUNTS_BY_ACCESS_TOKEN_RES],
    );
    const requestedAccount = number(input.accountId, Number.NaN);
    const accounts = array(accountsPayload.ctidTraderAccount);
    const account =
      accounts.find((item) => number(item.ctidTraderAccountId) === requestedAccount) ??
      accounts.find((item) => String(item.ctidTraderAccountId) === input.accountId) ??
      accounts[0];
    const accountId = number(account?.ctidTraderAccountId ?? input.accountId, Number.NaN);
    if (!Number.isFinite(accountId)) throw new Error("Conto cTrader non trovato per questo accesso.");
    assertResponse(
      await transport.request(CTRADER_PAYLOAD_TYPES.ACCOUNT_AUTH_REQ, {
        ctidTraderAccountId: accountId,
        accessToken: input.accessToken,
      }),
      [CTRADER_PAYLOAD_TYPES.ACCOUNT_AUTH_RES],
    );
    const session: CTraderSession = {
      accountId,
      environment: input.environment,
      transport,
      symbolsByName: new Map(),
      symbolsById: new Map(),
      positionVolumes: new Map(),
      moneyDigits: 2,
    };
    sessions.set(sessionKey, session);
    return session;
  }

  async function loadSymbols(session: CTraderSession): Promise<void> {
    const symbolPayload = assertResponse(
      await session.transport.request(CTRADER_PAYLOAD_TYPES.SYMBOLS_LIST_REQ, {
        ctidTraderAccountId: session.accountId,
        includeArchivedSymbols: false,
      }),
      [CTRADER_PAYLOAD_TYPES.SYMBOLS_LIST_RES],
    );
    for (const symbol of array(symbolPayload.symbol)) {
      const id = number(symbol.symbolId, Number.NaN);
      const name = String(symbol.symbolName ?? symbol.name ?? "");
      if (!Number.isFinite(id) || !name) continue;
      session.symbolsById.set(id, normalizeSymbol(name));
      session.symbolsByName.set(normalizeSymbol(name), id);
    }
  }

  async function ensureSymbol(session: CTraderSession, symbol: string): Promise<number> {
    if (session.symbolsByName.size === 0) await loadSymbols(session);
    const symbolId = session.symbolsByName.get(normalizeSymbol(symbol));
    if (!symbolId) throw new Error(`Simbolo ${symbol} non disponibile su questo conto cTrader.`);
    return symbolId;
  }

  return {
    async snapshot(input: CTraderSnapshotInput): Promise<BrokerSnapshot> {
      const session = await authenticate(input);
      const traderPayload = assertResponse(
        await session.transport.request(CTRADER_PAYLOAD_TYPES.TRADER_REQ, { ctidTraderAccountId: session.accountId }),
        [CTRADER_PAYLOAD_TYPES.TRADER_RES],
      );
      const trader = isRecord(traderPayload.trader) ? traderPayload.trader : {};
      session.moneyDigits = number(trader.moneyDigits, 2);
      await loadSymbols(session);
      const reconcilePayload = assertResponse(
        await session.transport.request(CTRADER_PAYLOAD_TYPES.RECONCILE_REQ, {
          ctidTraderAccountId: session.accountId,
          returnProtectionOrders: true,
        }),
        [CTRADER_PAYLOAD_TYPES.RECONCILE_RES],
      );
      const caps = capabilities(trader.accessRights);
      return {
        profileId: input.profileId,
        status: "connected",
        kind: CTRADER_KIND,
        providerKind: CTRADER_KIND,
        brokerName: input.brokerName,
        tradingEnabled: input.tradingEnabled,
        accounts: [
          {
            id: String(session.accountId),
            label: `${input.brokerName} ${String(trader.traderLogin ?? session.accountId)}`.trim(),
            brokerName: input.brokerName,
            currency: "USD",
            environment: accountEnvironment(input.environment),
          },
        ],
        metrics: makeMetrics(trader, session.moneyDigits),
        positions: array(reconcilePayload.position).map((position) => mapPosition(position, session)),
        orders: array(reconcilePayload.order).map((order) => mapOrder(order, session)),
        lastUpdated: new Date().toISOString(),
      };
    },

    async history(input: CTraderSnapshotInput): Promise<BrokerDeal[]> {
      const session = await authenticate(input);
      if (session.symbolsByName.size === 0) await loadSymbols(session);
      const now = Date.now();
      const payload = assertResponse(
        await session.transport.request(CTRADER_PAYLOAD_TYPES.DEAL_LIST_REQ, {
          ctidTraderAccountId: session.accountId,
          fromTimestamp: now - 1000 * 60 * 60 * 24 * 90,
          toTimestamp: now,
        }),
        [CTRADER_PAYLOAD_TYPES.DEAL_LIST_RES],
      );
      return array(payload.deal).map((deal) => mapDeal(deal, session));
    },

    async placeOrder(input: CTraderOrderInput): Promise<BrokerOrderResult> {
      const sessionsForAccount = Array.from(sessions.values()).filter((session) => String(session.accountId) === input.accountId);
      const session = sessionsForAccount[0];
      if (!session) return { accepted: false, reason: "Snapshot cTrader non sincronizzato. Aggiorna il conto prima di inviare ordini." };
      const symbolId = await ensureSymbol(session, input.order.symbol);
      const payload: Record<string, unknown> = {
        ctidTraderAccountId: session.accountId,
        symbolId,
        orderType: orderType(input.order.type),
        tradeSide: input.order.side === "sell" ? 2 : 1,
        volume: volumeToProtocol(input.order.volume),
      };
      if (input.order.limitPrice !== undefined) payload.limitPrice = input.order.limitPrice;
      if (input.order.stopPrice !== undefined) payload.stopPrice = input.order.stopPrice;
      if (input.order.stopLoss !== undefined) payload.stopLoss = input.order.stopLoss;
      if (input.order.takeProfit !== undefined) payload.takeProfit = input.order.takeProfit;
      const message = await session.transport.request(CTRADER_PAYLOAD_TYPES.NEW_ORDER_REQ, payload);
      return executionResult(message);
    },

    async closePosition(input: CTraderCloseInput): Promise<BrokerOrderResult> {
      const sessionsForAccount = Array.from(sessions.values()).filter((session) => String(session.accountId) === input.accountId);
      const session = sessionsForAccount[0];
      if (!session) return { accepted: false, reason: "Snapshot cTrader non sincronizzato. Aggiorna il conto prima di chiudere posizioni." };
      const volume = session.positionVolumes.get(input.positionId);
      if (!volume) return { accepted: false, reason: "Posizione cTrader non trovata nello snapshot sincronizzato." };
      const message = await session.transport.request(CTRADER_PAYLOAD_TYPES.CLOSE_POSITION_REQ, {
        ctidTraderAccountId: session.accountId,
        positionId: number(input.positionId),
        volume,
      });
      return executionResult(message);
    },

    close(): void {
      for (const session of sessions.values()) session.transport.close();
      sessions.clear();
    },
  };
}
