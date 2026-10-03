import type {
  BrokerAccount,
  BrokerCapabilities,
  BrokerMetrics,
  BrokerOrder,
  BrokerPosition,
  BrokerProviderKind,
  BrokerSnapshot,
  NormalizedBrokerOrderRequest,
  BrokerOrderResult,
  BrokerDeal,
} from "./types.js";
import type { BrokerAccountCredentials, BrokerProviderVerification } from "./providerRegistry.js";

type Fetch = typeof fetch;

// A hung MetaApi endpoint must not stall the sync/verify cycle: every request is
// bounded by an AbortSignal timeout (Node's default fetch has no request timeout).
const BROKER_FETCH_TIMEOUT_MS = 15_000;

interface MetaApiProviderOptions {
  token?: string;
  apiUrl?: string;
  provisioningBaseUrl?: string;
  clientBaseUrl?: string;
  provisioningMaxAttempts?: number;
  provisioningRetryDelayMs?: number;
  fetch?: Fetch;
}

interface MetaApiAccountInfo {
  broker?: string;
  currency?: string;
  balance?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  tradeAllowed?: boolean;
  login?: number | string;
  type?: string;
}

interface MetaApiPosition {
  id?: string;
  ticket?: string | number;
  positionId?: string | number;
  symbol?: string;
  type?: string;
  volume?: number;
  openPrice?: number;
  currentPrice?: number;
  profit?: number;
  openTime?: string;
}

interface MetaApiOrder {
  id?: string;
  ticket?: string | number;
  symbol?: string;
  type?: string;
  volume?: number;
  currentVolume?: number;
  state?: string;
  time?: string;
}

interface MetaApiDeal {
  id?: string;
  ticket?: string | number;
  symbol?: string;
  type?: string;
  volume?: number;
  profit?: number;
  price?: number;
  time?: string;
}

const DEFAULT_PROVISIONING_BASE = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai";
const DEFAULT_CLIENT_BASE = "https://mt-client-api-v1.new-york.agiliumtrade.ai";
const METAAPI_KIND: BrokerProviderKind = "metaapi-metatrader";

function deriveRegionalUrls(rawUrl: string | undefined): { provisioningBaseUrl?: string; clientBaseUrl?: string } {
  if (!rawUrl?.trim()) return {};
  try {
    const url = new URL(rawUrl.trim());
    const host = url.host;
    if (host.startsWith("mt-provisioning-api-v1.")) {
      return {
        provisioningBaseUrl: `${url.protocol}//${host}`,
        clientBaseUrl: `${url.protocol}//${host.replace(/^mt-provisioning-api-v1\./, "mt-client-api-v1.")}`,
      };
    }
    if (host.startsWith("mt-client-api-v1.")) {
      return {
        provisioningBaseUrl: `${url.protocol}//${host.replace(/^mt-client-api-v1\./, "mt-provisioning-api-v1.")}`,
        clientBaseUrl: `${url.protocol}//${host}`,
      };
    }
    if (host.startsWith("mt-client-api-")) {
      return { clientBaseUrl: `${url.protocol}//${host}` };
    }
    if (host.startsWith("mt-provisioning-api-")) {
      return { provisioningBaseUrl: `${url.protocol}//${host}` };
    }
    return { provisioningBaseUrl: `${url.protocol}//${host}` };
  } catch {
    return {};
  }
}

export function mapMetaApiError(error: unknown): string {
  const value = typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const details = value.details;
  const code =
    typeof details === "string"
      ? details
      : typeof details === "object" && details !== null && typeof (details as Record<string, unknown>).code === "string"
        ? String((details as Record<string, unknown>).code)
        : typeof value.error === "string"
          ? value.error
          : "";
  if (code === "E_AUTH") return "Credenziali conto non valide. Controlla numero conto, password e server.";
  if (code === "E_SRV_NOT_FOUND") return "Server broker non trovato. Controlla il nome server indicato dal broker.";
  if (code === "ERR_OTP_REQUIRED") return "Questo conto richiede una verifica OTP non supportata dal collegamento automatico.";
  if (code === "E_PASSWORD_CHANGE_REQUIRED") return "Il broker richiede il cambio password prima del collegamento.";
  if (code === "E_TRADING_ACCOUNT_DISABLED") return "Il conto risulta disabilitato dal broker.";
  if (typeof value.message === "string" && value.message.trim()) return value.message.trim();
  return "Conto non collegabile automaticamente. Verifica server, password o contatta supporto.";
}

function tokenFromEnv(): string {
  return process.env.METAAPI_TOKEN ?? "";
}

function jsonHeaders(token: string): Record<string, string> {
  return { accept: "application/json", "content-type": "application/json", "auth-token": token };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

async function assertOk(response: Response): Promise<unknown> {
  const data = await readJson(response);
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "MetaApi ha rifiutato l'header auth-token su questo endpoint. Il token e' presente: copia dalla pagina https://app.metaapi.cloud/token anche l'URL della MT account management / Provisioning API e impostalo come METAAPI_PROVISIONING_BASE_URL.",
    );
  }
  if (!response.ok) throw new Error(mapMetaApiError(data));
  return data;
}

function retryDelayFromHeader(response: Response, fallbackMs: number): number {
  const raw = response.headers.get("retry-after");
  if (!raw) return fallbackMs;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const dateMs = Date.parse(raw);
  if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
  return fallbackMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function number(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sideFromType(type: unknown): "buy" | "sell" {
  return String(type ?? "").toUpperCase().includes("SELL") ? "sell" : "buy";
}

function accountEnvironment(type: unknown): "demo" | "live" {
  return String(type ?? "").toUpperCase().includes("DEMO") ? "demo" : "live";
}

export function mapMetaApiMetrics(info: MetaApiAccountInfo): BrokerMetrics {
  return {
    balance: number(info.balance),
    equity: number(info.equity),
    margin: number(info.margin),
    freeMargin: number(info.freeMargin),
    currency: typeof info.currency === "string" && info.currency ? info.currency : "USD",
    dailyProfit: 0,
  };
}

export function mapMetaApiPosition(position: MetaApiPosition): BrokerPosition {
  const ticket = String(position.id ?? position.positionId ?? position.ticket ?? crypto.randomUUID());
  return {
    id: `metaapi-position-${ticket}`,
    brokerPositionId: ticket,
    symbol: String(position.symbol ?? ""),
    side: sideFromType(position.type),
    volume: number(position.volume),
    entryPrice: typeof position.openPrice === "number" ? position.openPrice : undefined,
    markPrice: typeof position.currentPrice === "number" ? position.currentPrice : undefined,
    profit: typeof position.profit === "number" ? position.profit : undefined,
    openedAt: typeof position.openTime === "string" ? position.openTime : undefined,
    source: METAAPI_KIND,
  };
}

function mapMetaApiOrder(order: MetaApiOrder): BrokerOrder {
  const ticket = String(order.id ?? order.ticket ?? crypto.randomUUID());
  return {
    id: `metaapi-order-${ticket}`,
    brokerOrderId: ticket,
    symbol: String(order.symbol ?? ""),
    side: sideFromType(order.type),
    type: String(order.type ?? "").includes("LIMIT") ? "limit" : String(order.type ?? "").includes("STOP") ? "stop" : "market",
    volume: number(order.currentVolume ?? order.volume),
    status: String(order.state ?? "").toUpperCase().includes("FILLED") ? "filled" : "pending",
    createdAt: typeof order.time === "string" ? order.time : new Date().toISOString(),
  };
}

function mapMetaApiDeal(deal: MetaApiDeal): BrokerDeal {
  const ticket = String(deal.id ?? deal.ticket ?? crypto.randomUUID());
  return {
    id: `metaapi-deal-${ticket}`,
    symbol: String(deal.symbol ?? ""),
    side: sideFromType(deal.type),
    volume: number(deal.volume),
    exitPrice: typeof deal.price === "number" ? deal.price : undefined,
    profit: typeof deal.profit === "number" ? deal.profit : undefined,
    closedAt: typeof deal.time === "string" ? deal.time : undefined,
    source: METAAPI_KIND,
  };
}

function capabilities(info: MetaApiAccountInfo): BrokerCapabilities {
  const tradeAllowed = info.tradeAllowed !== false;
  return {
    readAccount: true,
    readPositions: true,
    readHistory: true,
    placeOrders: tradeAllowed,
    closePositions: tradeAllowed,
  };
}

export function createMetaApiProvider(options: MetaApiProviderOptions = {}) {
  const token = options.token ?? tokenFromEnv();
  const regionalUrls = deriveRegionalUrls(options.apiUrl ?? process.env.METAAPI_API_URL ?? process.env.METAAPI_REGION_URL);
  const provisioningBaseUrl = (
    options.provisioningBaseUrl ??
    process.env.METAAPI_PROVISIONING_BASE_URL ??
    regionalUrls.provisioningBaseUrl ??
    DEFAULT_PROVISIONING_BASE
  ).replace(/\/$/, "");
  const clientBaseUrl = (
    options.clientBaseUrl ??
    process.env.METAAPI_CLIENT_BASE_URL ??
    regionalUrls.clientBaseUrl ??
    DEFAULT_CLIENT_BASE
  ).replace(/\/$/, "");
  const doFetch = options.fetch ?? fetch;
  const provisioningMaxAttempts = Math.max(1, options.provisioningMaxAttempts ?? Number(process.env.METAAPI_PROVISIONING_MAX_ATTEMPTS ?? 6));
  const provisioningRetryDelayMs = Math.max(0, options.provisioningRetryDelayMs ?? Number(process.env.METAAPI_PROVISIONING_RETRY_DELAY_MS ?? 3000));

  async function request(url: string, init: RequestInit = {}): Promise<unknown> {
    if (!token) throw new Error("Collegamento reale non configurato sul server. Configura METAAPI_TOKEN.");
    const response = await doFetch(url, {
      ...init,
      headers: { ...jsonHeaders(token), ...(init.headers as Record<string, string> | undefined) },
      signal: init.signal ?? AbortSignal.timeout(BROKER_FETCH_TIMEOUT_MS),
    });
    return assertOk(response);
  }

  async function createAccountWithRetry(body: Record<string, unknown>): Promise<{ id?: string; state?: string }> {
    if (!token) throw new Error("Collegamento reale non configurato sul server. Configura METAAPI_TOKEN.");
    const transactionId = crypto.randomUUID().replaceAll("-", "").slice(0, 32);
    let lastMessage = "MetaApi sta preparando il collegamento del conto.";
    for (let attempt = 1; attempt <= provisioningMaxAttempts; attempt += 1) {
      const response = await doFetch(`${provisioningBaseUrl}/users/current/accounts`, {
        method: "POST",
        headers: { ...jsonHeaders(token), "transaction-id": transactionId },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(BROKER_FETCH_TIMEOUT_MS),
      });
      const data = (await assertOk(response)) as { id?: string; state?: string; message?: string };
      if (response.status !== 202) return data;
      if (typeof data.message === "string" && data.message.trim()) lastMessage = data.message.trim();
      if (attempt < provisioningMaxAttempts) {
        const retryMs = provisioningRetryDelayMs === 0 ? 0 : Math.min(retryDelayFromHeader(response, provisioningRetryDelayMs), provisioningRetryDelayMs);
        await sleep(retryMs);
      }
    }
    throw new Error(`${lastMessage} Riprova tra poco: MetaApi non ha ancora completato la verifica broker.`);
  }

  async function getSnapshot(providerAccountId: string, brokerName: string, profileId: string, tradingEnabled: boolean): Promise<BrokerSnapshot> {
    const accountInfo = (await request(
      `${clientBaseUrl}/users/current/accounts/${encodeURIComponent(providerAccountId)}/account-information?refreshTerminalState=true`,
    )) as MetaApiAccountInfo;
    const positions = (await request(`${clientBaseUrl}/users/current/accounts/${encodeURIComponent(providerAccountId)}/positions`)) as MetaApiPosition[];
    const orders = (await request(`${clientBaseUrl}/users/current/accounts/${encodeURIComponent(providerAccountId)}/orders`)) as MetaApiOrder[];
    const account: BrokerAccount = {
      id: String(accountInfo.login ?? providerAccountId),
      label: `${brokerName} ${String(accountInfo.login ?? "")}`.trim(),
      brokerName,
      currency: typeof accountInfo.currency === "string" && accountInfo.currency ? accountInfo.currency : "USD",
      environment: accountEnvironment(accountInfo.type),
    };
    return {
      profileId,
      status: "connected",
      kind: METAAPI_KIND,
      providerKind: METAAPI_KIND,
      brokerName,
      tradingEnabled,
      accounts: [account],
      metrics: mapMetaApiMetrics(accountInfo),
      positions: Array.isArray(positions) ? positions.map(mapMetaApiPosition) : [],
      orders: Array.isArray(orders) ? orders.map(mapMetaApiOrder) : [],
      lastUpdated: new Date().toISOString(),
    };
  }

  function acceptedTradeResponse(response: { orderId?: string; stringCode?: string; message?: string }): BrokerOrderResult {
    const accepted = !response.stringCode || response.stringCode === "TRADE_RETCODE_DONE" || response.stringCode === "TRADE_RETCODE_PLACED";
    return {
      accepted,
      brokerOrderId: response.orderId,
      orderId: response.orderId,
      reason: accepted ? undefined : response.message ?? "Richiesta rifiutata dal broker.",
    };
  }

  return {
    async verifyAccount(input: BrokerAccountCredentials): Promise<BrokerProviderVerification> {
      const body = {
        login: input.accountNumber,
        password: input.accountPassword,
        name: `${input.brokerName} ${input.accountNumber}`,
        server: input.server,
        platform: "mt5",
        magic: 0,
        manualTrades: true,
        keywords: [input.brokerName],
      };
      const data = await createAccountWithRetry(body);
      if (!data.id) throw new Error("MetaApi non ha restituito un account collegato.");
      const accountInfo = (await request(
        `${clientBaseUrl}/users/current/accounts/${encodeURIComponent(data.id)}/account-information?refreshTerminalState=true`,
      )) as MetaApiAccountInfo;
      const positions = (await request(`${clientBaseUrl}/users/current/accounts/${encodeURIComponent(data.id)}/positions`)) as MetaApiPosition[];
      const orders = (await request(`${clientBaseUrl}/users/current/accounts/${encodeURIComponent(data.id)}/orders`)) as MetaApiOrder[];
      const snapshot: BrokerSnapshot = {
        profileId: "pending",
        status: "connected",
        kind: METAAPI_KIND,
        providerKind: METAAPI_KIND,
        brokerName: input.brokerName,
        tradingEnabled: input.tradingEnabled,
        accounts: [
          {
            id: String(accountInfo.login ?? data.id),
            label: `${input.brokerName} ${String(accountInfo.login ?? "")}`.trim(),
            brokerName: input.brokerName,
            currency: typeof accountInfo.currency === "string" && accountInfo.currency ? accountInfo.currency : "USD",
            environment: accountEnvironment(accountInfo.type),
          },
        ],
        metrics: mapMetaApiMetrics(accountInfo),
        positions: Array.isArray(positions) ? positions.map(mapMetaApiPosition) : [],
        orders: Array.isArray(orders) ? orders.map(mapMetaApiOrder) : [],
        lastUpdated: new Date().toISOString(),
      };
      const account = snapshot.accounts[0];
      const caps = capabilities(accountInfo);
      return {
        providerKind: METAAPI_KIND,
        providerAccountId: data.id,
        accountId: input.accountNumber,
        label: account?.label || `${input.brokerName} ${input.accountNumber}`,
        connectionStatus: snapshot.status,
        userDisplayStatus: caps.placeOrders ? "Conto trovato. Trading disponibile." : "Conto trovato. Accesso in sola lettura.",
        capabilities: caps,
        snapshot,
      };
    },

    async snapshot(providerAccountId: string, brokerName: string, profileId: string, tradingEnabled: boolean): Promise<BrokerSnapshot> {
      return getSnapshot(providerAccountId, brokerName, profileId, tradingEnabled);
    },

    async history(providerAccountId: string): Promise<BrokerDeal[]> {
      const started = new Date(Date.now() - 1000 * 60 * 60 * 24 * 90).toISOString();
      const ended = new Date().toISOString();
      const data = (await request(
        `${clientBaseUrl}/users/current/accounts/${encodeURIComponent(providerAccountId)}/history-deals/time/${encodeURIComponent(started)}/${encodeURIComponent(ended)}`,
      )) as MetaApiDeal[];
      return Array.isArray(data) ? data.map(mapMetaApiDeal) : [];
    },

    async placeOrder(providerAccountId: string, order: NormalizedBrokerOrderRequest): Promise<BrokerOrderResult> {
      const actionType =
        order.type === "limit"
          ? order.side === "buy"
            ? "ORDER_TYPE_BUY_LIMIT"
            : "ORDER_TYPE_SELL_LIMIT"
          : order.type === "stop"
            ? order.side === "buy"
              ? "ORDER_TYPE_BUY_STOP"
              : "ORDER_TYPE_SELL_STOP"
            : order.side === "buy"
              ? "ORDER_TYPE_BUY"
              : "ORDER_TYPE_SELL";
      const response = (await request(`${clientBaseUrl}/users/current/accounts/${encodeURIComponent(providerAccountId)}/trade`, {
        method: "POST",
        body: JSON.stringify({
          actionType,
          symbol: order.symbol,
          volume: order.volume,
          openPrice: order.limitPrice ?? order.stopPrice,
          stopLoss: order.stopLoss,
          takeProfit: order.takeProfit,
        }),
      })) as { orderId?: string; stringCode?: string; message?: string };
      return acceptedTradeResponse(response);
    },

    async closePosition(providerAccountId: string, positionId: string): Promise<BrokerOrderResult> {
      const response = (await request(`${clientBaseUrl}/users/current/accounts/${encodeURIComponent(providerAccountId)}/trade`, {
        method: "POST",
        body: JSON.stringify({ actionType: "POSITION_CLOSE_ID", positionId }),
      })) as { orderId?: string; stringCode?: string; message?: string };
      return acceptedTradeResponse(response);
    },
  };
}
