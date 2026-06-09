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

type RawSide = "buy" | "sell" | "BUY" | "SELL";

export interface FxBlueFetchPayload {
  status?: "waiting" | "private" | "error";
  error?: string;
  account?: Partial<BrokerAccount> & { id?: string };
  metrics?: Partial<BrokerSnapshot["metrics"]>;
  positions?: Array<{
    id?: string;
    brokerPositionId?: string;
    symbol?: string;
    side?: RawSide;
    volume?: number;
    entryPrice?: number;
    markPrice?: number;
    profit?: number;
    openedAt?: string;
  }>;
  orders?: BrokerOrder[];
  deals?: Array<{
    id?: string;
    symbol?: string;
    side?: RawSide;
    volume?: number;
    entryPrice?: number;
    exitPrice?: number;
    stopLoss?: number;
    takeProfit?: number;
    profit?: number;
    commission?: number;
    swap?: number;
    openedAt?: string;
    closedAt?: string;
  }>;
}

export interface FxBlueConnectorDependencies {
  fetchProfile(username: string): Promise<FxBlueFetchPayload>;
  now?: () => Date;
}

export function parseFxBlueProfileRef(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Inserisci username o URL FX Blue valido.");
  if (!/^https?:\/\//i.test(trimmed)) {
    if (/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(trimmed)) return trimmed;
    throw new Error("Inserisci username o URL FX Blue valido.");
  }
  const url = new URL(trimmed);
  if (!/(^|\.)fxblue\.com$/i.test(url.hostname)) throw new Error("Inserisci username o URL FX Blue valido.");
  const parts = url.pathname.split("/").filter(Boolean);
  const usersIndex = parts.findIndex((part) => part.toLowerCase() === "users");
  const slug = usersIndex >= 0 ? parts[usersIndex + 1] : "";
  const first = (slug ?? "").split(",")[0]?.trim();
  if (first && /^[a-z0-9][a-z0-9_-]{1,63}$/i.test(first)) return first;
  throw new Error("Inserisci username o URL FX Blue valido.");
}

function readTag(xml: string, tagName: string): string {
  const escaped = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function side(value: unknown): "buy" | "sell" {
  return String(value).toLowerCase() === "sell" ? "sell" : "buy";
}

function currencyFromSummary(xml: string): string {
  const description = decodeXml(readTag(xml, "description"));
  const match = description.match(/Balance:\s*<\/td>\s*<td>\s*([^0-9+\-.<]+)/i);
  const raw = (match?.[1] ?? "").replace(/\s/g, "");
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  if (raw === "€") return "EUR";
  if (raw === "£") return "GBP";
  if (raw === "$" || raw === "US$") return "USD";
  return "USD";
}

function isEpochPlaceholder(value: string): boolean {
  return !value || /1 Jan 1970/i.test(value);
}

function mergeFxBluePayloads(left: FxBlueFetchPayload, right: FxBlueFetchPayload): FxBlueFetchPayload {
  return {
    account: { ...(left.account ?? {}), ...(right.account ?? {}) },
    metrics: { ...(left.metrics ?? {}), ...(right.metrics ?? {}) },
    positions: right.positions ?? left.positions,
    orders: right.orders && right.orders.length > 0 ? right.orders : left.orders,
    deals: right.deals && right.deals.length > 0 ? right.deals : left.deals,
  };
}

export function parseFxBlueOverviewScript(script: string, username: string): FxBlueFetchPayload {
  const match = script.match(/MTIntelligenceAccounts\.push\(\s*(\{[\s\S]*?\})\s*\)\s*;?/i);
  if (!match?.[1]) return { status: "waiting" };
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return { status: "error", error: "Overview FX Blue non leggibile." };
  }
  return {
    account: {
      id: str(data.userid, username),
      label: `FX Blue ${str(data.userid, username)}`,
      brokerName: "FX Blue",
    },
    metrics: {
      balance: num(data.balance),
      equity: num(data.equity),
      margin: 0,
      freeMargin: num(data.freeMargin),
      dailyProfit: num(data.floatingProfit),
    },
  };
}

export function parseFxBlueRss(xml: string, username: string): FxBlueFetchPayload {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const summary = items.find((item) => /Account summary/i.test(readTag(item, "title"))) ?? "";
  const currency = summary ? currencyFromSummary(summary) : "USD";
  const payload: FxBlueFetchPayload = {
    account: {
      id: username,
      label: `FX Blue ${username}`,
      brokerName: "FX Blue",
      currency,
      environment: "live",
    },
    metrics: {
      balance: num(readTag(summary, "account:balance")),
      equity: num(readTag(summary, "account:equity")),
      margin: 0,
      freeMargin: num(readTag(summary, "account:freeMargin")),
      currency,
      dailyProfit: num(readTag(summary, "account:floatingProfit")),
    },
    positions: [],
    orders: [],
    deals: [],
  };

  for (const item of items) {
    const ticket = readTag(item, "position:ticket");
    if (!ticket) continue;
    const type = readTag(item, "position:type").toLowerCase();
    const action = readTag(item, "position:action");
    const symbol = readTag(item, "position:symbol");
    const lots = num(readTag(item, "position:lots"));
    const openPrice = num(readTag(item, "position:openPrice"));
    const closePrice = num(readTag(item, "position:closePrice"));
    const openTime = readTag(item, "position:openTime");
    const closeTime = readTag(item, "position:closeTime");
    const profit = num(readTag(item, "position:totalProfit"), num(readTag(item, "position:profit")));

    if (type.includes("open") || isEpochPlaceholder(closeTime)) {
      payload.positions?.push({
        id: ticket,
        brokerPositionId: ticket,
        symbol,
        side: side(action),
        volume: lots,
        entryPrice: openPrice,
        markPrice: closePrice,
        profit,
        openedAt: openTime,
      });
      continue;
    }

    if (type.includes("pending")) {
      payload.orders?.push({
        id: ticket,
        brokerOrderId: ticket,
        symbol: symbol.toUpperCase(),
        side: side(action),
        type: "limit",
        volume: lots,
        status: "pending",
        createdAt: openTime || new Date(0).toISOString(),
      });
      continue;
    }

    payload.deals?.push({
      id: ticket,
      symbol,
      side: side(action),
      volume: lots,
      entryPrice: openPrice,
      exitPrice: closePrice,
      stopLoss: num(readTag(item, "position:stopLoss")),
      takeProfit: num(readTag(item, "position:takeProfit")),
      profit,
      commission: num(readTag(item, "position:commission")),
      swap: num(readTag(item, "position:swap")),
      openedAt: openTime,
      closedAt: closeTime,
    });
  }

  return payload;
}

function readJsField(record: string, name: string): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = record.match(new RegExp(`${escaped}\\s*:\\s*(?:"([^"]*)"|([^,}]*))`, "i"));
  return (match?.[1] ?? match?.[2] ?? "").trim();
}

function readJsNumber(record: string, name: string): number {
  return num(readJsField(record, name));
}

function orderSide(value: string): "buy" | "sell" {
  return value.toLowerCase().includes("sell") ? "sell" : "buy";
}

function orderType(value: string): BrokerOrder["type"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("stop")) return "stop";
  return "limit";
}

export function parseFxBlueOrderList(value: string, username: string): FxBlueFetchPayload {
  const ordersBlock =
    value.match(/orders\s*:\s*\[([\s\S]*?)\]\s*,\s*[a-zA-Z_][a-zA-Z0-9_]*\s*:/i)?.[1] ??
    value.match(/orders\s*:\s*\[([\s\S]*?)\]\s*\}\s*\)?\s*$/i)?.[1] ??
    "";
  const records = ordersBlock.match(/\{[\s\S]*?\}(?=\s*,|\s*$)/g) ?? [];
  const payload: FxBlueFetchPayload = {
    account: {
      id: username,
      label: `FX Blue ${username}`,
      brokerName: "FX Blue",
      environment: "live",
    },
    orders: [],
    deals: [],
  };

  for (const record of records) {
    const type = readJsField(record, "type");
    const ticket = readJsField(record, "ticket");
    const symbol = readJsField(record, "symbol");
    const action = readJsField(record, "action");
    if (!ticket || !symbol) continue;

    if (/pending order/i.test(type)) {
      payload.orders?.push({
        id: ticket,
        brokerOrderId: ticket,
        symbol: symbol.toUpperCase(),
        side: orderSide(action),
        type: orderType(action),
        volume: readJsNumber(record, "lots"),
        status: "pending",
        createdAt: readJsField(record, "openDate") || new Date(0).toISOString(),
      });
      continue;
    }

    if (!/closed position/i.test(type)) continue;
    payload.deals?.push({
      id: ticket,
      symbol,
      side: orderSide(action),
      volume: readJsNumber(record, "lots"),
      entryPrice: readJsNumber(record, "openPrice"),
      exitPrice: readJsNumber(record, "closePrice"),
      stopLoss: readJsNumber(record, "sl"),
      takeProfit: readJsNumber(record, "tp"),
      profit: readJsNumber(record, "totalProfit") || readJsNumber(record, "profit"),
      commission: readJsNumber(record, "commission"),
      swap: readJsNumber(record, "swap"),
      openedAt: readJsField(record, "openDate"),
      closedAt: readJsField(record, "closeDate"),
    });
  }

  return payload;
}

function accountFrom(profile: BrokerAccountProfile, payload: FxBlueFetchPayload): BrokerAccount {
  const account = payload.account ?? {};
  const id = str(account.id, profile.accountId || profile.providerAccountId || profile.providerUserId || "FXBLUE");
  return {
    id,
    label: str(account.label, `${profile.brokerName} ${id}`.trim()),
    brokerName: str(account.brokerName, profile.brokerName),
    currency: str(account.currency, "USD"),
    environment: account.environment === "demo" ? "demo" : "live",
  };
}

function mapPosition(raw: NonNullable<FxBlueFetchPayload["positions"]>[number]): BrokerPosition {
  const brokerPositionId = str(raw.brokerPositionId, str(raw.id, crypto.randomUUID()));
  return {
    id: str(raw.id, brokerPositionId),
    brokerPositionId,
    symbol: str(raw.symbol, "UNKNOWN").toUpperCase(),
    side: side(raw.side),
    volume: num(raw.volume),
    entryPrice: typeof raw.entryPrice === "number" ? raw.entryPrice : undefined,
    markPrice: typeof raw.markPrice === "number" ? raw.markPrice : undefined,
    profit: typeof raw.profit === "number" ? raw.profit : undefined,
    openedAt: str(raw.openedAt) || undefined,
    source: "fxblue-account-sync",
  };
}

function mapDeal(raw: NonNullable<FxBlueFetchPayload["deals"]>[number]): BrokerDeal {
  return {
    id: str(raw.id, crypto.randomUUID()),
    symbol: str(raw.symbol, "UNKNOWN").toUpperCase(),
    side: side(raw.side),
    volume: num(raw.volume),
    entryPrice: typeof raw.entryPrice === "number" ? raw.entryPrice : undefined,
    exitPrice: typeof raw.exitPrice === "number" ? raw.exitPrice : undefined,
    stopLoss: typeof raw.stopLoss === "number" ? raw.stopLoss : undefined,
    takeProfit: typeof raw.takeProfit === "number" ? raw.takeProfit : undefined,
    profit: typeof raw.profit === "number" ? raw.profit : undefined,
    commission: typeof raw.commission === "number" ? raw.commission : undefined,
    swap: typeof raw.swap === "number" ? raw.swap : undefined,
    openedAt: str(raw.openedAt) || undefined,
    closedAt: str(raw.closedAt) || undefined,
    source: "fxblue-account-sync",
  };
}

function readOnlyResult(): BrokerOrderResult {
  return { accepted: false, reason: "Questo conto FX Blue e' collegato in sola lettura." };
}

function emptySnapshot(profile: BrokerAccountProfile, status: BrokerSnapshot["status"], error: string, now: Date): BrokerSnapshot {
  return {
    profileId: profile.id,
    status,
    kind: "fxblue-account-sync",
    providerKind: "fxblue-account-sync",
    brokerName: profile.brokerName,
    tradingEnabled: false,
    accounts: [],
    metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
    positions: [],
    orders: [],
    lastUpdated: now.toISOString(),
    error,
  };
}

function snapshotFrom(profile: BrokerAccountProfile, payload: FxBlueFetchPayload, now: Date): BrokerSnapshot {
  if (payload.status === "waiting") {
    return emptySnapshot(profile, "connecting", "FX Blue non ha ancora pubblicato il primo sync leggibile.", now);
  }
  if (payload.status === "private") {
    return emptySnapshot(profile, "error", "Profilo FX Blue privato o feed non accessibile.", now);
  }
  if (payload.status === "error") {
    return emptySnapshot(profile, "error", payload.error ?? "Dati FX Blue non disponibili.", now);
  }

  const account = accountFrom(profile, payload);
  const metrics = payload.metrics ?? {};
  return {
    profileId: profile.id,
    status: "connected",
    kind: "fxblue-account-sync",
    providerKind: "fxblue-account-sync",
    brokerName: account.brokerName,
    tradingEnabled: false,
    accounts: [account],
    metrics: {
      balance: num(metrics.balance),
      equity: num(metrics.equity),
      margin: num(metrics.margin),
      freeMargin: num(metrics.freeMargin),
      currency: str(metrics.currency, account.currency),
      dailyProfit: num(metrics.dailyProfit),
    },
    positions: (payload.positions ?? []).map(mapPosition),
    orders: payload.orders ?? [],
    lastUpdated: now.toISOString(),
  };
}

type FxBlueFetchResult =
  | { kind: "ok"; text: string }
  | { kind: "waiting" }
  | { kind: "private" }
  | { kind: "error"; error: string };

async function fetchFxBlueText(url: string): Promise<FxBlueFetchResult> {
  const response = await fetch(url, { headers: { accept: "text/html,application/json" } });
  if (response.status === 404) return { kind: "waiting" };
  if (response.status === 401 || response.status === 403) return { kind: "private" };
  if (!response.ok) return { kind: "error", error: `FX Blue HTTP ${response.status}` };
  return { kind: "ok", text: await response.text() };
}

async function defaultFetchProfile(username: string): Promise<FxBlueFetchPayload> {
  const baseUrl = `https://www.fxblue.com/users/${encodeURIComponent(username)}`;
  const [overviewResult, rssResult, orderListResult] = await Promise.allSettled([
    fetchFxBlueText(`${baseUrl}/overviewscript`),
    fetchFxBlueText(`${baseUrl}/rss`),
    fetchFxBlueText(`https://api.fxblue.com/wl/data/_orderlist.aspx?id=${encodeURIComponent(username)}&start=0&limit=999999`),
  ]);
  const results = [overviewResult, rssResult, orderListResult].map((result): FxBlueFetchResult =>
    result.status === "fulfilled" ? result.value : { kind: "error", error: result.reason instanceof Error ? result.reason.message : "FX Blue non raggiungibile." },
  );
  const payloads: FxBlueFetchPayload[] = [];
  const [overview, rss, orderList] = results;
  if (overview.kind === "ok") payloads.push(parseFxBlueOverviewScript(overview.text, username));
  if (rss.kind === "ok") payloads.push(parseFxBlueRss(rss.text, username));
  if (orderList.kind === "ok") payloads.push(parseFxBlueOrderList(orderList.text, username));
  const readable = payloads.filter((payload) => payload.status !== "waiting" && payload.status !== "error" && payload.status !== "private");
  if (readable.length > 0) return readable.reduce(mergeFxBluePayloads);
  if (results.some((result) => result.kind === "private")) return { status: "private" };
  const error = results.find((result): result is Extract<FxBlueFetchResult, { kind: "error" }> => result.kind === "error");
  if (error) return { status: "error", error: error.error };
  return { status: "waiting" };
}

export function createFxBlueBrokerConnector(
  profile: BrokerAccountProfile,
  dependencies: FxBlueConnectorDependencies = { fetchProfile: defaultFetchProfile },
): BrokerConnector {
  const listeners = new Set<(event: BrokerEvent) => void>();
  const now = dependencies.now ?? (() => new Date());
  let lastSnapshot: BrokerSnapshot | null = null;
  let lastDeals: BrokerDeal[] = [];

  async function refresh(): Promise<BrokerSnapshot> {
    const username = parseFxBlueProfileRef(profile.providerUserId || profile.providerAccountId || profile.accountId);
    const payload = await dependencies.fetchProfile(username);
    lastDeals = (payload.deals ?? []).map(mapDeal);
    lastSnapshot = snapshotFrom(profile, payload, now());
    for (const listener of Array.from(listeners)) listener({ type: "snapshot", snapshot: lastSnapshot });
    return lastSnapshot;
  }

  return {
    connect: refresh,
    async disconnect() {
      lastSnapshot = null;
    },
    async getAccounts() {
      const snapshot = lastSnapshot ?? (await refresh());
      return snapshot.accounts;
    },
    async getSnapshot() {
      return lastSnapshot ?? refresh();
    },
    async getPositions() {
      const snapshot = lastSnapshot ?? (await refresh());
      return snapshot.positions;
    },
    async getOrders() {
      const snapshot = lastSnapshot ?? (await refresh());
      return snapshot.orders;
    },
    async getDealsHistory() {
      if (!lastSnapshot) await refresh();
      return lastDeals.map((deal) => ({ ...deal }));
    },
    async placeOrder(_order: NormalizedBrokerOrderRequest) {
      return readOnlyResult();
    },
    async modifyOrder(_orderId: string, _patch: Partial<NormalizedBrokerOrderRequest>) {
      return readOnlyResult();
    },
    async closePosition(_positionId: string) {
      return readOnlyResult();
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
