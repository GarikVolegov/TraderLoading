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
    profit?: number;
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

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function side(value: unknown): "buy" | "sell" {
  return String(value).toLowerCase() === "sell" ? "sell" : "buy";
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
    profit: typeof raw.profit === "number" ? raw.profit : undefined,
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

async function defaultFetchProfile(username: string): Promise<FxBlueFetchPayload> {
  const url = `https://www.fxblue.com/users/${encodeURIComponent(username)}`;
  const response = await fetch(url, { headers: { accept: "text/html,application/json" } });
  if (response.status === 404) return { status: "waiting" };
  if (response.status === 401 || response.status === 403) return { status: "private" };
  if (!response.ok) return { status: "error", error: `FX Blue HTTP ${response.status}` };
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
