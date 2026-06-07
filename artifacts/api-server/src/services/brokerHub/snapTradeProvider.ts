import { createHmac } from "node:crypto";
import type {
  BrokerAccount,
  BrokerCapabilities,
  BrokerMetrics,
  BrokerOrder,
  BrokerPosition,
  BrokerSnapshot,
} from "./types.js";
import type { BrokerProviderRegistry, BrokerProviderVerification, BrokerAccountCredentials } from "./providerRegistry.js";

type Fetch = typeof fetch;

interface SnapTradeProviderOptions {
  clientId?: string;
  consumerKey?: string;
  baseUrl?: string;
  timestamp?: () => number;
  fetch?: Fetch;
}

interface SnapTradePortalInput {
  userId: string;
  connectionType?: "read" | "trade" | "trade-if-available";
  broker?: string;
  customRedirect?: string;
}

interface SnapTradeSnapshotInput {
  userId: string;
  userSecret: string;
  accountId: string;
  brokerName: string;
  profileId: string;
  tradingEnabled: boolean;
}

interface SnapTradeAccount {
  id?: string;
  name?: string;
  number?: string;
  brokerage_authorization?: string;
  institution_name?: string;
}

interface SnapTradeBalance {
  currency?: { code?: string } | string;
  cash?: number;
  buying_power?: number;
  total?: number;
}

interface SnapTradePosition {
  symbol?: { symbol?: string; description?: string } | string;
  units?: number;
  quantity?: number;
  price?: number;
  average_purchase_price?: number;
  market_value?: number;
  unrealized_pnl?: number;
}

interface SnapTradeOrder {
  id?: string;
  symbol?: { symbol?: string } | string;
  action?: string;
  order_type?: string;
  quantity?: number;
  status?: string;
  time_placed?: string;
}

const SNAPTRADE_KIND = "snaptrade-brokerage" as const;
const DEFAULT_BASE = "https://api.snaptrade.com/api/v1";

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function currencyCode(balance: SnapTradeBalance | undefined): string {
  const currency = balance?.currency;
  if (typeof currency === "string" && currency) return currency;
  if (typeof currency === "object" && currency?.code) return currency.code;
  return "USD";
}

function symbolName(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && typeof (value as { symbol?: unknown }).symbol === "string") {
    return String((value as { symbol: string }).symbol);
  }
  return "";
}

function capabilities(tradingEnabled: boolean): BrokerCapabilities {
  return {
    readAccount: true,
    readPositions: true,
    readHistory: true,
    placeOrders: tradingEnabled,
    closePositions: false,
  };
}

function mapMetrics(balance: SnapTradeBalance | undefined): BrokerMetrics {
  return {
    balance: number(balance?.cash ?? balance?.total),
    equity: number(balance?.total ?? balance?.cash),
    margin: 0,
    freeMargin: number(balance?.buying_power ?? balance?.cash),
    currency: currencyCode(balance),
    dailyProfit: 0,
  };
}

function mapPosition(position: SnapTradePosition): BrokerPosition {
  const symbol = symbolName(position.symbol);
  const quantity = number(position.units ?? position.quantity);
  return {
    id: `snaptrade-position-${symbol}`,
    brokerPositionId: symbol,
    symbol,
    side: quantity < 0 ? "sell" : "buy",
    volume: Math.abs(quantity),
    entryPrice: typeof position.average_purchase_price === "number" ? position.average_purchase_price : undefined,
    markPrice: typeof position.price === "number" ? position.price : undefined,
    profit: typeof position.unrealized_pnl === "number" ? position.unrealized_pnl : undefined,
    source: SNAPTRADE_KIND,
  };
}

function mapOrder(order: SnapTradeOrder): BrokerOrder {
  const id = String(order.id ?? crypto.randomUUID());
  const type = String(order.order_type ?? "").toLowerCase();
  return {
    id: `snaptrade-order-${id}`,
    brokerOrderId: id,
    symbol: symbolName(order.symbol),
    side: String(order.action ?? "").toLowerCase().includes("sell") ? "sell" : "buy",
    type: type.includes("limit") ? "limit" : type.includes("stop") ? "stop" : "market",
    volume: number(order.quantity),
    status: String(order.status ?? "").toLowerCase().includes("filled") ? "filled" : "pending",
    createdAt: typeof order.time_placed === "string" ? order.time_placed : new Date().toISOString(),
  };
}

export function createSnapTradeProvider(options: SnapTradeProviderOptions = {}) {
  const clientId = options.clientId ?? process.env.SNAPTRADE_CLIENT_ID ?? "";
  const consumerKey = options.consumerKey ?? process.env.SNAPTRADE_CONSUMER_KEY ?? "";
  const baseUrl = (options.baseUrl ?? process.env.SNAPTRADE_BASE_URL ?? DEFAULT_BASE).replace(/\/$/, "");
  const doFetch = options.fetch ?? fetch;
  const now = options.timestamp ?? (() => Math.floor(Date.now() / 1000));

  function sign(path: string, query: string, body: unknown): string {
    const signaturePayload = canonicalJson({
      content: body == null || (typeof body === "object" && Object.keys(body as Record<string, unknown>).length === 0) ? null : body,
      path: `/api/v1${path}`,
      query,
    });
    return createHmac("sha256", consumerKey).update(signaturePayload).digest("base64");
  }

  async function request(path: string, init: { method?: string; query?: Record<string, string>; body?: unknown } = {}): Promise<unknown> {
    if (!clientId || !consumerKey) throw new Error("Collegamento SnapTrade non configurato sul server.");
    const query = new URLSearchParams(init.query);
    query.set("clientId", clientId);
    query.set("timestamp", String(now()));
    const queryString = query.toString();
    const body = init.body;
    const response = await doFetch(`${baseUrl}${path}?${queryString}`, {
      method: init.method ?? "GET",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        Signature: sign(path, queryString, body),
      },
      body: body == null ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : {};
    if (!response.ok) {
      const message =
        typeof data === "object" && data !== null && typeof (data as { detail?: unknown }).detail === "string"
          ? String((data as { detail: string }).detail)
          : "SnapTrade non ha completato la richiesta.";
      throw new Error(message);
    }
    return data;
  }

  async function ensureUser(userId: string): Promise<{ userId: string; userSecret: string }> {
    return (await request("/snapTrade/registerUser", { method: "POST", body: { userId } })) as { userId: string; userSecret: string };
  }

  async function createConnectionPortal(input: SnapTradePortalInput): Promise<{ userId: string; userSecret: string; redirectURI: string; sessionId: string }> {
    const user = await ensureUser(input.userId);
    const body = {
      ...(input.broker ? { broker: input.broker } : {}),
      ...(input.customRedirect ? { customRedirect: input.customRedirect } : {}),
      connectionType: input.connectionType ?? "trade-if-available",
      connectionPortalVersion: "v4",
      showCloseButton: true,
    };
    const data = (await request("/snapTrade/login", {
      method: "POST",
      query: { userId: user.userId, userSecret: user.userSecret },
      body,
    })) as { redirectURI?: string; sessionId?: string };
    if (!data.redirectURI || !data.sessionId) throw new Error("SnapTrade non ha restituito il portale di collegamento.");
    return { userId: user.userId, userSecret: user.userSecret, redirectURI: data.redirectURI, sessionId: data.sessionId };
  }

  async function listAccounts(userId: string, userSecret: string): Promise<SnapTradeAccount[]> {
    const data = await request("/accounts", { query: { userId, userSecret } });
    return Array.isArray(data) ? (data as SnapTradeAccount[]) : [];
  }

  async function getSnapshot(input: SnapTradeSnapshotInput): Promise<BrokerSnapshot> {
    const [accounts, balances, positions, orders] = await Promise.all([
      listAccounts(input.userId, input.userSecret),
      request(`/accounts/${encodeURIComponent(input.accountId)}/balances`, { query: { userId: input.userId, userSecret: input.userSecret } }),
      request(`/accounts/${encodeURIComponent(input.accountId)}/positions`, { query: { userId: input.userId, userSecret: input.userSecret } }),
      request(`/accounts/${encodeURIComponent(input.accountId)}/orders`, {
        query: { userId: input.userId, userSecret: input.userSecret, state: "all", days: "30" },
      }),
    ]);
    const account = accounts.find((item) => item.id === input.accountId) ?? { id: input.accountId, name: input.brokerName };
    const balance = Array.isArray(balances) ? (balances[0] as SnapTradeBalance | undefined) : undefined;
    const brokerAccount: BrokerAccount = {
      id: input.accountId,
      label: account.name ?? account.number ?? input.brokerName,
      brokerName: input.brokerName,
      currency: currencyCode(balance),
      environment: "live",
    };
    return {
      profileId: input.profileId,
      status: "connected",
      kind: SNAPTRADE_KIND,
      providerKind: SNAPTRADE_KIND,
      brokerName: input.brokerName,
      tradingEnabled: input.tradingEnabled,
      accounts: [brokerAccount],
      metrics: mapMetrics(balance),
      positions: Array.isArray(positions) ? (positions as SnapTradePosition[]).map(mapPosition) : [],
      orders: Array.isArray(orders) ? (orders as SnapTradeOrder[]).map(mapOrder) : [],
      lastUpdated: new Date().toISOString(),
    };
  }

  async function completeAuthorization(input: {
    userId: string;
    userSecret: string;
    brokerName: string;
    profileId: string;
    tradingEnabled: boolean;
  }): Promise<BrokerProviderVerification & { userSecret: string }> {
    const accounts = await listAccounts(input.userId, input.userSecret);
    const account = accounts[0];
    if (!account?.id) throw new Error("Completa il collegamento nel portale sicuro prima di continuare.");
    const snapshot = await getSnapshot({
      userId: input.userId,
      userSecret: input.userSecret,
      accountId: account.id,
      brokerName: input.brokerName,
      profileId: input.profileId,
      tradingEnabled: input.tradingEnabled,
    });
    return {
      providerKind: SNAPTRADE_KIND,
      providerUserId: input.userId,
      providerAccountId: account.id,
      accountId: account.id,
      label: account.name ?? input.brokerName,
      connectionStatus: "connected",
      userDisplayStatus: "Conto broker trovato.",
      capabilities: capabilities(input.tradingEnabled),
      snapshot,
      userSecret: input.userSecret,
    };
  }

  return { createConnectionPortal, completeAuthorization, getSnapshot };
}

export function createStaticSnapTradeRegistry(): BrokerProviderRegistry {
  return {
    async startAuthorization() {
      return {
        providerKind: SNAPTRADE_KIND,
        providerUserId: "snap-user-1",
        authorizationUrl: "https://portal.snaptrade.test/session",
        sessionId: "session-1",
        userSecret: "snap-secret-1",
        displayStatus: "Apri il portale sicuro e collega il conto broker.",
      };
    },
    async completeAuthorization(input) {
      return {
        providerKind: SNAPTRADE_KIND,
        providerUserId: input.providerUserId,
        providerAccountId: "snap-account-1",
        accountId: "snap-account-1",
        label: "Brokerage Margin",
        connectionStatus: "connected",
        userDisplayStatus: "Conto broker trovato.",
        capabilities: capabilities(input.tradingEnabled),
        snapshot: {
          profileId: "pending",
          status: "connected",
          kind: SNAPTRADE_KIND,
          providerKind: SNAPTRADE_KIND,
          brokerName: input.brokerName,
          tradingEnabled: input.tradingEnabled,
          accounts: [{ id: "snap-account-1", label: "Brokerage Margin", brokerName: input.brokerName, currency: "USD", environment: "live" }],
          metrics: { balance: 1250, equity: 1250, margin: 0, freeMargin: 2400, currency: "USD", dailyProfit: 0 },
          positions: [],
          orders: [],
          lastUpdated: new Date().toISOString(),
        },
        userSecret: input.userSecret,
      };
    },
    async verifyAccount(_input: BrokerAccountCredentials) {
      throw new Error("SnapTrade usa il portale sicuro, non numero conto e password.");
    },
  };
}
