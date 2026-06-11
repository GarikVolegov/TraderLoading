# FX Blue Account Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only FX Blue Account Sync route to Broker Hub, with guided setup, profile verification, normalized snapshots/history, and disabled trading.

**Architecture:** Extend the existing Broker Hub provider model with `fxblue-account-sync`, then add a focused FX Blue connector and setup-intent API. The frontend gets a dedicated wizard path inside `ConnectAccountWizard`, while all FX Blue parsing and public/feed assumptions stay isolated in `fxBlueConnector.ts`.

**Tech Stack:** TypeScript, Express 5, React/Vite, existing Broker Hub runtime/store, Node `assert` tests executed with `tsx`.

---

## File Structure

- Modify: `artifacts/api-server/src/services/brokerHub/types.ts`
  - Adds provider, route, and health literals for FX Blue.
- Modify: `artifacts/api-server/src/services/brokerHub/profileStore.ts`
  - Sanitizes and persists FX Blue profile metadata safely.
- Create: `artifacts/api-server/src/services/brokerHub/fxBlueConnector.ts`
  - Parses FX Blue usernames/URLs, maps feed payloads into Broker Hub snapshots and deals, rejects trading actions.
- Create: `artifacts/api-server/src/services/brokerHub/fxBlueConnector.test.ts`
  - Test-first coverage for parsing, mapping, waiting/private states, and read-only order rejection.
- Modify: `artifacts/api-server/src/services/brokerHub/runtime.ts`
  - Routes FX Blue profiles to the FX Blue connector.
- Create: `artifacts/api-server/src/services/brokerHub/fxBlueSetupIntentStore.ts`
  - Small in-memory setup intent store for guided FX Blue setup state.
- Modify: `artifacts/api-server/src/routes/brokers.ts`
  - Adds `/brokers/fxblue/setup-intents` routes.
- Create: `artifacts/api-server/src/routes/broker-fxblue.test.ts`
  - Route tests for setup intent, verify-profile, complete, and non-persistence of investor password.
- Modify: `artifacts/trader-dashboard/src/components/broker-hub/types.ts`
  - Adds frontend FX Blue provider/route/health types.
- Modify: `artifacts/trader-dashboard/src/components/broker-hub/brokerHubApi.ts`
  - Adds FX Blue setup client functions.
- Modify: `artifacts/trader-dashboard/src/components/broker-hub/brokerHubApi.test.ts`
  - Adds client API tests.
- Modify: `artifacts/trader-dashboard/src/components/broker-hub/useBrokerHub.ts`
  - Exposes FX Blue setup helpers to the wizard.
- Create: `artifacts/trader-dashboard/src/components/broker-hub/FxBlueAccountSyncWizard.tsx`
  - Dedicated wizard component for the FX Blue guided setup.
- Modify: `artifacts/trader-dashboard/src/components/broker-hub/ConnectAccountWizard.tsx`
  - Adds FX Blue as a broker route and renders the dedicated wizard.
- Create: `artifacts/trader-dashboard/src/components/broker-hub/FxBlueAccountSyncWizard.static.test.ts`
  - Static tests for read-only copy, FX Blue URL, password warning, and disabled trading language.

## Task 1: FX Blue Connector Contract And Parsing Tests

**Files:**
- Create: `artifacts/api-server/src/services/brokerHub/fxBlueConnector.test.ts`
- Create later in Task 2: `artifacts/api-server/src/services/brokerHub/fxBlueConnector.ts`

- [ ] **Step 1: Write the failing connector test**

Create `artifacts/api-server/src/services/brokerHub/fxBlueConnector.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  createFxBlueBrokerConnector,
  parseFxBlueProfileRef,
  type FxBlueFetchPayload,
} from "./fxBlueConnector.js";
import type { BrokerAccountProfile } from "./types.js";

const profile: BrokerAccountProfile = {
  id: "profile-fxblue",
  label: "FX Blue EURUSD",
  brokerName: "FX Blue",
  kind: "fxblue-account-sync",
  providerKind: "fxblue-account-sync",
  providerUserId: "trader-one",
  providerAccountId: "trader-one",
  accountId: "123456",
  environment: "live",
  route: "fxblue_account_sync",
  health: "waiting_for_fxblue_sync",
  tradingEnabled: false,
  capabilities: {
    readAccount: true,
    readPositions: true,
    readHistory: true,
    placeOrders: false,
    closePositions: false,
    realtimeUpdates: false,
    requiresTerminal: false,
  },
  connectionStatus: "offline",
  createdAt: "2026-06-08T00:00:00.000Z",
  updatedAt: "2026-06-08T00:00:00.000Z",
};

assert.equal(parseFxBlueProfileRef("trader-one"), "trader-one");
assert.equal(parseFxBlueProfileRef(" https://www.fxblue.com/users/trader-one/stats "), "trader-one");
assert.equal(parseFxBlueProfileRef("https://www.fxblue.com/users/trader-one,other/publication"), "trader-one");
assert.throws(() => parseFxBlueProfileRef("https://example.com/users/trader-one"), /Inserisci username o URL FX Blue valido/);

const payload: FxBlueFetchPayload = {
  account: {
    id: "123456",
    label: "FP Trading 123456",
    brokerName: "FP Trading",
    currency: "USD",
    environment: "live",
  },
  metrics: {
    balance: 10000.5,
    equity: 10042.25,
    margin: 120,
    freeMargin: 9922.25,
    dailyProfit: 42.25,
    currency: "USD",
  },
  positions: [
    {
      id: "pos-1",
      symbol: "eurusd",
      side: "BUY",
      volume: 0.1,
      entryPrice: 1.08,
      markPrice: 1.083,
      profit: 30,
      openedAt: "2026-06-08T10:00:00.000Z",
    },
  ],
  deals: [
    {
      id: "deal-1",
      symbol: "xauusd",
      side: "sell",
      volume: 0.2,
      entryPrice: 2340,
      exitPrice: 2330,
      profit: 20,
      openedAt: "2026-06-07T10:00:00.000Z",
      closedAt: "2026-06-07T11:00:00.000Z",
    },
  ],
};

const connector = createFxBlueBrokerConnector(profile, {
  fetchProfile: async (username) => {
    assert.equal(username, "trader-one");
    return payload;
  },
});

const snapshot = await connector.connect();
assert.equal(snapshot.status, "connected");
assert.equal(snapshot.kind, "fxblue-account-sync");
assert.equal(snapshot.providerKind, "fxblue-account-sync");
assert.equal(snapshot.tradingEnabled, false);
assert.equal(snapshot.accounts[0]?.id, "123456");
assert.equal(snapshot.metrics.equity, 10042.25);
assert.equal(snapshot.positions[0]?.symbol, "EURUSD");
assert.equal(snapshot.positions[0]?.source, "fxblue-account-sync");

const history = await connector.getDealsHistory();
assert.equal(history.length, 1);
assert.equal(history[0]?.symbol, "XAUUSD");
assert.equal(history[0]?.source, "fxblue-account-sync");

const rejectedOrder = await connector.placeOrder({
  symbol: "EURUSD",
  side: "buy",
  type: "market",
  volume: 0.1,
  timeInForce: "gtc",
  clientRequestId: "order-1",
});
assert.equal(rejectedOrder.accepted, false);
assert.match(rejectedOrder.reason ?? "", /sola lettura/i);

const rejectedClose = await connector.closePosition("pos-1");
assert.equal(rejectedClose.accepted, false);
assert.match(rejectedClose.reason ?? "", /sola lettura/i);

const waiting = createFxBlueBrokerConnector(
  { ...profile, providerUserId: "waiting-user" },
  { fetchProfile: async () => ({ status: "waiting" }) },
);
const waitingSnapshot = await waiting.connect();
assert.equal(waitingSnapshot.status, "connecting");
assert.equal(waitingSnapshot.error, "FX Blue non ha ancora pubblicato il primo sync leggibile.");

const privateProfile = createFxBlueBrokerConnector(
  { ...profile, providerUserId: "private-user" },
  { fetchProfile: async () => ({ status: "private" }) },
);
const privateSnapshot = await privateProfile.connect();
assert.equal(privateSnapshot.status, "error");
assert.equal(privateSnapshot.error, "Profilo FX Blue privato o feed non accessibile.");

console.log("fx blue connector checks passed");
```

- [ ] **Step 2: Run the connector test and verify RED**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/brokerHub/fxBlueConnector.test.ts
```

Expected: FAIL with a module resolution error for `./fxBlueConnector.js`.

- [ ] **Step 3: Commit the failing test**

```bash
git add artifacts/api-server/src/services/brokerHub/fxBlueConnector.test.ts
git commit -m "test: cover fx blue broker connector contract"
```

## Task 2: Backend Types, Store Sanitization, And Connector Implementation

**Files:**
- Modify: `artifacts/api-server/src/services/brokerHub/types.ts`
- Modify: `artifacts/api-server/src/services/brokerHub/profileStore.ts`
- Create: `artifacts/api-server/src/services/brokerHub/fxBlueConnector.ts`
- Modify: `artifacts/api-server/src/services/brokerHub/runtime.ts`
- Test: `artifacts/api-server/src/services/brokerHub/fxBlueConnector.test.ts`
- Test: `artifacts/api-server/src/services/brokerHub/brokerHub.test.ts`

- [ ] **Step 1: Extend Broker Hub backend literal types**

In `artifacts/api-server/src/services/brokerHub/types.ts`, add the new literals:

```ts
export type BrokerProviderKind =
  | "traderloading-mt5-smartlink"
  | "metatrader-local-companion"
  | "metaapi-metatrader"
  | "snaptrade-brokerage"
  | "ctrader-open-api"
  | "mt5-vps-bridge"
  | "fxblue-account-sync"
  | "demo";
```

```ts
export type ConnectorRoute =
  | "smartlink_mt5"
  | "official_oauth"
  | "local_companion"
  | "broker_portal"
  | "file_import"
  | "manual"
  | "optional_cloud"
  | "advanced_ea"
  | "fxblue_account_sync";
```

```ts
export type ConnectionHealth =
  | "connected"
  | "stale"
  | "waiting_for_companion"
  | "waiting_for_fxblue_sync"
  | "import_only"
  | "error";
```

- [ ] **Step 2: Update profile store sanitizer**

In `artifacts/api-server/src/services/brokerHub/profileStore.ts`, update `readKind`, `defaultRoute`, `readRoute`, `readHealth`, `isProfile`, and `defaultCapabilities`.

Use these exact branches:

```ts
function readKind(value: unknown): BrokerKind {
  return value === "traderloading-mt5-smartlink" ||
    value === "metatrader-local-companion" ||
    value === "metaapi-metatrader" ||
    value === "snaptrade-brokerage" ||
    value === "ctrader-open-api" ||
    value === "mt5-vps-bridge" ||
    value === "fxblue-account-sync" ||
    value === "demo"
    ? value
    : "demo";
}
```

```ts
function defaultRoute(kind: BrokerProviderKind): ConnectorRoute {
  if (kind === "traderloading-mt5-smartlink") return "smartlink_mt5";
  if (kind === "metatrader-local-companion") return "local_companion";
  if (kind === "ctrader-open-api") return "official_oauth";
  if (kind === "snaptrade-brokerage") return "broker_portal";
  if (kind === "metaapi-metatrader") return "optional_cloud";
  if (kind === "fxblue-account-sync") return "fxblue_account_sync";
  if (kind === "demo") return "manual";
  return "local_companion";
}
```

```ts
function readRoute(value: unknown, kind: BrokerProviderKind): ConnectorRoute {
  return value === "smartlink_mt5" ||
    value === "official_oauth" ||
    value === "local_companion" ||
    value === "broker_portal" ||
    value === "file_import" ||
    value === "manual" ||
    value === "optional_cloud" ||
    value === "advanced_ea" ||
    value === "fxblue_account_sync"
    ? value
    : defaultRoute(kind);
}
```

```ts
function readHealth(value: unknown, route: ConnectorRoute, connectionStatus: BrokerAccountProfile["connectionStatus"]): ConnectionHealth {
  if (
    value === "connected" ||
    value === "stale" ||
    value === "waiting_for_companion" ||
    value === "waiting_for_fxblue_sync" ||
    value === "import_only" ||
    value === "error"
  ) {
    return value;
  }
  if (route === "smartlink_mt5" || route === "local_companion") return connectionStatus === "connected" ? "connected" : "waiting_for_companion";
  if (route === "fxblue_account_sync") return connectionStatus === "connected" ? "connected" : "waiting_for_fxblue_sync";
  if (route === "file_import" || route === "manual") return "import_only";
  return connectionStatus === "connected" ? "connected" : "stale";
}
```

```ts
function defaultCapabilities(kind: BrokerProviderKind): BrokerCapabilities {
  if (kind === "demo") {
    return { readAccount: true, readPositions: true, readHistory: true, placeOrders: true, closePositions: true, realtimeUpdates: false, requiresTerminal: false };
  }
  if (kind === "snaptrade-brokerage" || kind === "fxblue-account-sync") {
    return { readAccount: true, readPositions: true, readHistory: true, placeOrders: false, closePositions: false, realtimeUpdates: false, requiresTerminal: false };
  }
  if (kind === "traderloading-mt5-smartlink" || kind === "metatrader-local-companion") {
    return { readAccount: true, readPositions: true, readHistory: true, placeOrders: true, closePositions: true, realtimeUpdates: true, requiresTerminal: true };
  }
  return { readAccount: true, readPositions: true, readHistory: true, placeOrders: true, closePositions: true, realtimeUpdates: true, requiresTerminal: false };
}
```

In `isProfile`, include:

```ts
profile.kind === "fxblue-account-sync" ||
```

- [ ] **Step 3: Implement the FX Blue connector**

Create `artifacts/api-server/src/services/brokerHub/fxBlueConnector.ts`:

```ts
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
  const usersIndex = url.pathname.split("/").filter(Boolean).findIndex((part) => part.toLowerCase() === "users");
  const slug = usersIndex >= 0 ? url.pathname.split("/").filter(Boolean)[usersIndex + 1] : "";
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

function snapshotFrom(profile: BrokerAccountProfile, payload: FxBlueFetchPayload, now: Date): BrokerSnapshot {
  if (payload.status === "waiting") {
    return {
      profileId: profile.id,
      status: "connecting",
      kind: "fxblue-account-sync",
      providerKind: "fxblue-account-sync",
      brokerName: profile.brokerName,
      tradingEnabled: false,
      accounts: [],
      metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
      positions: [],
      orders: [],
      lastUpdated: now.toISOString(),
      error: "FX Blue non ha ancora pubblicato il primo sync leggibile.",
    };
  }
  if (payload.status === "private") {
    return {
      profileId: profile.id,
      status: "error",
      kind: "fxblue-account-sync",
      providerKind: "fxblue-account-sync",
      brokerName: profile.brokerName,
      tradingEnabled: false,
      accounts: [],
      metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
      positions: [],
      orders: [],
      lastUpdated: now.toISOString(),
      error: "Profilo FX Blue privato o feed non accessibile.",
    };
  }
  if (payload.status === "error") {
    return {
      profileId: profile.id,
      status: "error",
      kind: "fxblue-account-sync",
      providerKind: "fxblue-account-sync",
      brokerName: profile.brokerName,
      tradingEnabled: false,
      accounts: [],
      metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
      positions: [],
      orders: [],
      lastUpdated: now.toISOString(),
      error: payload.error ?? "Dati FX Blue non disponibili.",
    };
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
```

- [ ] **Step 4: Wire the connector into runtime**

In `artifacts/api-server/src/services/brokerHub/runtime.ts`, import:

```ts
import { createFxBlueBrokerConnector } from "./fxBlueConnector.js";
```

In `createConnector`, before the final demo fallback, add:

```ts
if (profile.providerKind === "fxblue-account-sync" || profile.kind === "fxblue-account-sync" || profile.route === "fxblue_account_sync") {
  return createFxBlueBrokerConnector(profile);
}
```

- [ ] **Step 5: Add store coverage to brokerHub test**

In `artifacts/api-server/src/services/brokerHub/brokerHub.test.ts`, after the MT5 profile save block, add:

```ts
const fxBlueProfile = await store.saveProfile({
  label: "FX Blue account",
  brokerName: "FX Blue",
  kind: "fxblue-account-sync",
  providerKind: "fxblue-account-sync",
  providerUserId: "trader-one",
  accountId: "123456",
  environment: "live",
  tradingEnabled: true,
  investorPassword: "must-not-persist",
});
assert.equal(fxBlueProfile.kind, "fxblue-account-sync");
assert.equal(fxBlueProfile.route, "fxblue_account_sync");
assert.equal(fxBlueProfile.health, "waiting_for_fxblue_sync");
assert.equal(fxBlueProfile.tradingEnabled, true);
assert.equal(fxBlueProfile.capabilities.placeOrders, false);
assert.equal("investorPassword" in (fxBlueProfile as object), false);
```

The existing expected profile count changes from `2` to `3`.

- [ ] **Step 6: Run connector and broker hub tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/brokerHub/fxBlueConnector.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/brokerHub/brokerHub.test.ts
```

Expected: both PASS and print `fx blue connector checks passed` and `broker hub checks passed`.

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/services/brokerHub/types.ts artifacts/api-server/src/services/brokerHub/profileStore.ts artifacts/api-server/src/services/brokerHub/fxBlueConnector.ts artifacts/api-server/src/services/brokerHub/runtime.ts artifacts/api-server/src/services/brokerHub/fxBlueConnector.test.ts artifacts/api-server/src/services/brokerHub/brokerHub.test.ts
git commit -m "feat: add fx blue broker connector"
```

## Task 3: FX Blue Setup Intent Store

**Files:**
- Create: `artifacts/api-server/src/services/brokerHub/fxBlueSetupIntentStore.ts`
- Create: `artifacts/api-server/src/services/brokerHub/fxBlueSetupIntentStore.test.ts`

- [ ] **Step 1: Write the failing setup-intent store test**

Create `artifacts/api-server/src/services/brokerHub/fxBlueSetupIntentStore.test.ts`:

```ts
import assert from "node:assert/strict";
import { createFxBlueSetupIntentStore } from "./fxBlueSetupIntentStore.js";

const store = createFxBlueSetupIntentStore({
  now: () => new Date("2026-06-08T10:00:00.000Z"),
  id: () => "fxblue-intent-1",
});

const intent = await store.createIntent({
  platform: "MT5",
  brokerName: "FP Trading",
  server: "FPTrading-Live",
  accountNumber: "123456",
  environment: "live",
  investorPassword: "read-only-secret",
});

assert.equal(intent.id, "fxblue-intent-1");
assert.equal(intent.status, "created");
assert.equal(intent.accountNumber, "123456");
assert.equal(intent.server, "FPTrading-Live");
assert.equal("investorPassword" in (intent as object), false);
assert.equal(intent.displayStatus, "Apri FX Blue Account Sync e avvia la raccolta in sola lettura.");

const verified = await store.updateIntent(intent.id, {
  status: "profile_verified",
  fxBlueProfileRef: "trader-one",
  displayStatus: "Profilo FX Blue verificato.",
});
assert.equal(verified.status, "profile_verified");
assert.equal(verified.fxBlueProfileRef, "trader-one");

const fetched = await store.getIntent(intent.id);
assert.equal(fetched?.status, "profile_verified");

await assert.rejects(
  store.createIntent({
    platform: "MT5",
    brokerName: "FP Trading",
    server: "",
    accountNumber: "123456",
    environment: "live",
    investorPassword: "secret",
  }),
  /Server broker richiesto/,
);

console.log("fx blue setup intent store checks passed");
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/brokerHub/fxBlueSetupIntentStore.test.ts
```

Expected: FAIL with a module resolution error for `./fxBlueSetupIntentStore.js`.

- [ ] **Step 3: Implement setup-intent store**

Create `artifacts/api-server/src/services/brokerHub/fxBlueSetupIntentStore.ts`:

```ts
export type FxBluePlatform = "MT4" | "MT5";
export type FxBlueSetupStatus = "created" | "profile_verified" | "waiting_for_sync" | "completed" | "error";

export interface FxBlueSetupIntent {
  id: string;
  platform: FxBluePlatform;
  brokerName: string;
  server: string;
  accountNumber: string;
  environment: "demo" | "live";
  status: FxBlueSetupStatus;
  displayStatus: string;
  fxBlueProfileRef?: string;
  profileId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FxBlueSetupIntentDraft {
  platform: unknown;
  brokerName: unknown;
  server: unknown;
  accountNumber: unknown;
  environment?: unknown;
  investorPassword?: unknown;
}

export interface FxBlueSetupIntentStore {
  createIntent(input: FxBlueSetupIntentDraft): Promise<FxBlueSetupIntent>;
  getIntent(id: string): Promise<FxBlueSetupIntent | null>;
  updateIntent(id: string, patch: Partial<FxBlueSetupIntent>): Promise<FxBlueSetupIntent>;
}

interface StoreOptions {
  now?: () => Date;
  id?: () => string;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizePlatform(value: unknown): FxBluePlatform {
  return value === "MT4" ? "MT4" : "MT5";
}

function sanitizeEnvironment(value: unknown): "demo" | "live" {
  return value === "demo" ? "demo" : "live";
}

function requireSetupInput(input: FxBlueSetupIntentDraft): Omit<FxBlueSetupIntent, "id" | "status" | "displayStatus" | "createdAt" | "updatedAt"> {
  const brokerName = readString(input.brokerName) || "FX Blue";
  const server = readString(input.server);
  const accountNumber = readString(input.accountNumber);
  const investorPassword = readString(input.investorPassword);
  if (!accountNumber) throw new Error("Numero conto richiesto.");
  if (!server) throw new Error("Server broker richiesto.");
  if (!investorPassword) throw new Error("Password investor/read-only richiesta per completare il setup su FX Blue.");
  return {
    platform: sanitizePlatform(input.platform),
    brokerName,
    server,
    accountNumber,
    environment: sanitizeEnvironment(input.environment),
  };
}

export function createFxBlueSetupIntentStore(options: StoreOptions = {}): FxBlueSetupIntentStore {
  const now = options.now ?? (() => new Date());
  const createId = options.id ?? (() => `fxblue-${crypto.randomUUID()}`);
  const intents = new Map<string, FxBlueSetupIntent>();

  return {
    async createIntent(input) {
      const safe = requireSetupInput(input);
      const timestamp = now().toISOString();
      const intent: FxBlueSetupIntent = {
        id: createId(),
        ...safe,
        status: "created",
        displayStatus: "Apri FX Blue Account Sync e avvia la raccolta in sola lettura.",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      intents.set(intent.id, intent);
      return { ...intent };
    },
    async getIntent(id) {
      const intent = intents.get(id);
      return intent ? { ...intent } : null;
    },
    async updateIntent(id, patch) {
      const current = intents.get(id);
      if (!current) throw new Error("FX Blue setup intent non trovato.");
      const next: FxBlueSetupIntent = {
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: now().toISOString(),
      };
      intents.set(id, next);
      return { ...next };
    },
  };
}
```

- [ ] **Step 4: Run store test and verify GREEN**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/brokerHub/fxBlueSetupIntentStore.test.ts
```

Expected: PASS and print `fx blue setup intent store checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/services/brokerHub/fxBlueSetupIntentStore.ts artifacts/api-server/src/services/brokerHub/fxBlueSetupIntentStore.test.ts
git commit -m "feat: add fx blue setup intent store"
```

## Task 4: FX Blue Broker Routes

**Files:**
- Modify: `artifacts/api-server/src/routes/brokers.ts`
- Create: `artifacts/api-server/src/routes/broker-fxblue.test.ts`

- [ ] **Step 1: Write failing route test**

Create `artifacts/api-server/src/routes/broker-fxblue.test.ts`:

```ts
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createBrokerVault } from "../services/brokerHub/brokerVault.js";
import { createBrokerProfileStore } from "../services/brokerHub/profileStore.js";
import { createBrokerHubRuntime } from "../services/brokerHub/runtime.js";
import { createBrokersRouter } from "./brokers.js";

const tempDir = await mkdtemp(join(tmpdir(), "broker-fxblue-route-"));

try {
  const runtime = createBrokerHubRuntime({
    store: createBrokerProfileStore(join(tempDir, "profiles.json")),
    vault: createBrokerVault({
      path: join(tempDir, "vault.json"),
      key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    }),
    connectorFactory: (profile) => ({
      async connect() {
        return {
          profileId: profile.id,
          status: "connected",
          kind: "fxblue-account-sync",
          providerKind: "fxblue-account-sync",
          brokerName: profile.brokerName,
          tradingEnabled: false,
          accounts: [{ id: profile.accountId, label: profile.label, brokerName: profile.brokerName, currency: "USD", environment: "live" }],
          metrics: { balance: 10000, equity: 10050, margin: 0, freeMargin: 10050, currency: "USD", dailyProfit: 50 },
          positions: [],
          orders: [],
          lastUpdated: "2026-06-08T10:00:00.000Z",
        };
      },
      async disconnect() {},
      async getAccounts() { return []; },
      async getSnapshot() { return this.connect(); },
      async getPositions() { return []; },
      async getOrders() { return []; },
      async getDealsHistory() { return []; },
      async placeOrder() { return { accepted: false, reason: "read only" }; },
      async modifyOrder() { return { accepted: false, reason: "read only" }; },
      async closePosition() { return { accepted: false, reason: "read only" }; },
      onEvent() { return () => {}; },
    }),
  });

  const app = express();
  app.use(express.json());
  app.use("/api", createBrokersRouter(runtime));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}/api/brokers`;

  const createRes = await fetch(`${base}/fxblue/setup-intents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      platform: "MT5",
      brokerName: "FP Trading",
      server: "FPTrading-Live",
      accountNumber: "123456",
      environment: "live",
      investorPassword: "read-only-secret",
    }),
  });
  assert.equal(createRes.status, 201);
  const created = (await createRes.json()) as { intent: { id: string; accountNumber: string }; fxBlueUrl: string };
  assert.equal(created.intent.accountNumber, "123456");
  assert.equal(created.fxBlueUrl, "https://diagnostics.fxblue.com/accountsync.aspx");

  const verifyRes = await fetch(`${base}/fxblue/setup-intents/${created.intent.id}/verify-profile`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fxBlueProfileRef: "trader-one" }),
  });
  assert.equal(verifyRes.status, 200);
  const verified = (await verifyRes.json()) as { intent: { status: string }; snapshot: { status: string } };
  assert.equal(verified.intent.status, "profile_verified");
  assert.equal(verified.snapshot.status, "connected");

  const completeRes = await fetch(`${base}/fxblue/setup-intents/${created.intent.id}/complete`, { method: "POST" });
  assert.equal(completeRes.status, 201);
  const completed = (await completeRes.json()) as { profile: { id: string; providerKind: string; tradingEnabled: boolean; capabilities: { placeOrders: boolean } }; snapshot: { status: string } };
  assert.equal(completed.profile.providerKind, "fxblue-account-sync");
  assert.equal(completed.profile.tradingEnabled, false);
  assert.equal(completed.profile.capabilities.placeOrders, false);
  assert.equal(completed.snapshot.status, "connected");

  const profilesRes = await fetch(`${base}/profiles`);
  const profiles = (await profilesRes.json()) as { profiles: unknown[] };
  assert.equal(JSON.stringify(profiles).includes("read-only-secret"), false);

  const missingRes = await fetch(`${base}/fxblue/setup-intents/missing/complete`, { method: "POST" });
  assert.equal(missingRes.status, 404);

  await new Promise<void>((resolve) => server.close(() => resolve()));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

console.log("fx blue broker route checks passed");
```

- [ ] **Step 2: Run route test and verify RED**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/routes/broker-fxblue.test.ts
```

Expected: FAIL with `404` on `/fxblue/setup-intents`.

- [ ] **Step 3: Add route dependencies**

In `artifacts/api-server/src/routes/brokers.ts`, add imports:

```ts
import {
  createFxBlueSetupIntentStore,
  type FxBlueSetupIntentStore,
} from "../services/brokerHub/fxBlueSetupIntentStore.js";
import { parseFxBlueProfileRef } from "../services/brokerHub/fxBlueConnector.js";
```

Extend `BrokersRouterOptions`:

```ts
fxBlueSetupIntentStore?: FxBlueSetupIntentStore;
```

Inside `createBrokersRouter`, add:

```ts
const fxBlueSetupIntentStore = options.fxBlueSetupIntentStore ?? createFxBlueSetupIntentStore();
```

- [ ] **Step 4: Add the setup-intent create route**

Inside `createBrokersRouter`, near other connection-intent routes, add:

```ts
router.post("/brokers/fxblue/setup-intents", async (req, res) => {
  try {
    const intent = await fxBlueSetupIntentStore.createIntent({
      platform: req.body?.platform,
      brokerName: req.body?.brokerName,
      server: req.body?.server,
      accountNumber: req.body?.accountNumber,
      environment: req.body?.environment,
      investorPassword: req.body?.investorPassword,
    });
    res.status(201).json({
      intent,
      fxBlueUrl: "https://diagnostics.fxblue.com/accountsync.aspx",
      instructions: [
        "Accedi o registrati su FX Blue.",
        "Seleziona Account Sync e scegli MT4 o MT5.",
        "Inserisci numero conto, server e password investor/read-only.",
        "Avvia la raccolta e torna nel Broker Hub.",
      ],
    });
  } catch (error) {
    res.status(400).json({ error: message(error) });
  }
});
```

- [ ] **Step 5: Add verify-profile route**

Add:

```ts
router.post("/brokers/fxblue/setup-intents/:id/verify-profile", async (req, res) => {
  try {
    const intent = await fxBlueSetupIntentStore.getIntent(req.params.id);
    if (!intent) {
      res.status(404).json({ error: "FX Blue setup intent non trovato." });
      return;
    }
    const fxBlueProfileRef = parseFxBlueProfileRef(readString(req.body?.fxBlueProfileRef));
    const tempProfile = await runtime.saveProfile({
      label: `${intent.brokerName} FX Blue`,
      brokerName: intent.brokerName,
      kind: "fxblue-account-sync",
      providerKind: "fxblue-account-sync",
      providerUserId: fxBlueProfileRef,
      providerAccountId: fxBlueProfileRef,
      accountId: intent.accountNumber,
      environment: intent.environment,
      route: "fxblue_account_sync",
      health: "waiting_for_fxblue_sync",
      tradingEnabled: false,
      capabilities: {
        readAccount: true,
        readPositions: true,
        readHistory: true,
        placeOrders: false,
        closePositions: false,
        realtimeUpdates: false,
        requiresTerminal: false,
      },
      connectionStatus: "offline",
      setupProgress: "fxblue_profile_verifying",
      server: intent.server,
    });
    const connected = await runtime.connectProfile(tempProfile.id);
    const verified = await fxBlueSetupIntentStore.updateIntent(intent.id, {
      status: connected.snapshot.status === "connected" ? "profile_verified" : "waiting_for_sync",
      fxBlueProfileRef,
      profileId: tempProfile.id,
      displayStatus:
        connected.snapshot.status === "connected"
          ? "Profilo FX Blue verificato."
          : connected.snapshot.error ?? "In attesa del primo sync FX Blue.",
    });
    res.json({ intent: verified, profile: connected.profile, snapshot: connected.snapshot });
  } catch (error) {
    res.status(400).json({ error: message(error) });
  }
});
```

- [ ] **Step 6: Add complete route**

Add:

```ts
router.post("/brokers/fxblue/setup-intents/:id/complete", async (req, res) => {
  try {
    const intent = await fxBlueSetupIntentStore.getIntent(req.params.id);
    if (!intent) {
      res.status(404).json({ error: "FX Blue setup intent non trovato." });
      return;
    }
    if (!intent.profileId || !intent.fxBlueProfileRef) {
      res.status(400).json({ error: "Verifica prima il profilo FX Blue." });
      return;
    }
    const connected = await runtime.connectProfile(intent.profileId);
    const completed = await fxBlueSetupIntentStore.updateIntent(intent.id, {
      status: "completed",
      displayStatus: "Account Sync FX Blue collegato al Broker Hub.",
      profileId: intent.profileId,
    });
    const profile = await runtime.saveProfile({
      ...connected.profile,
      tradingEnabled: false,
      capabilities: {
        ...connected.profile.capabilities,
        placeOrders: false,
        closePositions: false,
        realtimeUpdates: false,
        requiresTerminal: false,
      },
      health: connected.snapshot.status === "connected" ? "connected" : "waiting_for_fxblue_sync",
      setupProgress: connected.snapshot.status === "connected" ? "fxblue_connected" : "waiting_for_fxblue_sync",
      lastSnapshotAt: connected.snapshot.lastUpdated,
      connectionStatus: connected.snapshot.status,
    });
    res.status(201).json({ intent: completed, profile, snapshot: connected.snapshot });
  } catch (error) {
    res.status(400).json({ error: message(error) });
  }
});
```

- [ ] **Step 7: Run route tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/routes/broker-fxblue.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/brokers.test.ts
```

Expected: both PASS and print `fx blue broker route checks passed` and `brokers route checks passed`.

- [ ] **Step 8: Commit**

```bash
git add artifacts/api-server/src/routes/brokers.ts artifacts/api-server/src/routes/broker-fxblue.test.ts
git commit -m "feat: add fx blue broker setup routes"
```

## Task 5: Frontend API Client And Hook

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/broker-hub/types.ts`
- Modify: `artifacts/trader-dashboard/src/components/broker-hub/brokerHubApi.ts`
- Modify: `artifacts/trader-dashboard/src/components/broker-hub/brokerHubApi.test.ts`
- Modify: `artifacts/trader-dashboard/src/components/broker-hub/useBrokerHub.ts`

- [ ] **Step 1: Write failing API client tests**

Append to `artifacts/trader-dashboard/src/components/broker-hub/brokerHubApi.test.ts` before the `finally` block:

```ts
  {
    const payload = {
      platform: "MT5" as const,
      brokerName: "FP Trading",
      server: "FPTrading-Live",
      accountNumber: "123456",
      environment: "live" as const,
      investorPassword: "read-only-secret",
    };
    const calls = mockFetch(() =>
      Response.json({
        intent: { id: "fxblue-i1", status: "created" },
        fxBlueUrl: "https://diagnostics.fxblue.com/accountsync.aspx",
        instructions: ["Open FX Blue"],
      }, { status: 201 }),
    );

    const result = await createFxBlueSetupIntent(payload, { baseUrl: "https://api.example.test" });

    assert.equal(result.intent.id, "fxblue-i1");
    assert.equal(result.fxBlueUrl, "https://diagnostics.fxblue.com/accountsync.aspx");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/fxblue/setup-intents");
    assert.equal(calls[0]?.init?.body, JSON.stringify(payload));
  }

  {
    const calls = mockFetch(() => Response.json({ intent: { id: "fxblue-i1", status: "profile_verified" }, snapshot: { status: "connected" } }));

    const result = await verifyFxBlueProfile("fxblue-i1", { fxBlueProfileRef: "trader-one" }, { baseUrl: "https://api.example.test" });

    assert.equal(result.ok, true);
    assert.equal(result.data.intent?.status, "profile_verified");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/fxblue/setup-intents/fxblue-i1/verify-profile");
    assert.equal(calls[0]?.init?.body, JSON.stringify({ fxBlueProfileRef: "trader-one" }));
  }

  {
    const calls = mockFetch(() => Response.json({ intent: { id: "fxblue-i1", status: "completed" }, profile: { id: "p1" }, snapshot: { status: "connected" } }, { status: 201 }));

    const result = await completeFxBlueSetupIntent("fxblue-i1", { baseUrl: "https://api.example.test" });

    assert.equal(result.ok, true);
    assert.equal(result.data.profile?.id, "p1");
    assert.equal(calls[0]?.url, "https://api.example.test/api/brokers/fxblue/setup-intents/fxblue-i1/complete");
    assert.equal(calls[0]?.init?.method, "POST");
  }
```

Also add the new imports at the top:

```ts
  completeFxBlueSetupIntent,
  createFxBlueSetupIntent,
  verifyFxBlueProfile,
```

- [ ] **Step 2: Run client test and verify RED**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/broker-hub/brokerHubApi.test.ts
```

Expected: FAIL because the new exported functions do not exist.

- [ ] **Step 3: Extend frontend types**

In `artifacts/trader-dashboard/src/components/broker-hub/types.ts`, add:

```ts
  | "fxblue-account-sync"
```

to `BrokerKind`, add:

```ts
  | "fxblue_account_sync"
```

to `ConnectorRoute`, and add:

```ts
  | "waiting_for_fxblue_sync"
```

to `ConnectionHealth`.

- [ ] **Step 4: Add API client types and functions**

In `artifacts/trader-dashboard/src/components/broker-hub/brokerHubApi.ts`, add:

```ts
export type FxBlueSetupIntent = {
  id: string;
  platform: "MT4" | "MT5";
  brokerName: string;
  server: string;
  accountNumber: string;
  environment: "demo" | "live";
  status: "created" | "profile_verified" | "waiting_for_sync" | "completed" | "error";
  displayStatus: string;
  fxBlueProfileRef?: string;
  profileId?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type FxBlueSetupPayload = {
  platform: "MT4" | "MT5";
  brokerName: string;
  server: string;
  accountNumber: string;
  environment: "demo" | "live";
  investorPassword: string;
};

export type FxBlueSetupIntentResponse = {
  intent: FxBlueSetupIntent;
  fxBlueUrl: string;
  instructions: string[];
};

export type FxBlueVerifyPayload = {
  fxBlueProfileRef: string;
};
```

Add functions after `createBrokerConnectionIntent`:

```ts
export async function createFxBlueSetupIntent(
  payload: FxBlueSetupPayload,
  options?: BrokerHubApiOptions,
): Promise<FxBlueSetupIntentResponse> {
  return readJson<FxBlueSetupIntentResponse>(
    await fetch(createBrokerHubUrl("/brokers/fxblue/setup-intents", options), jsonPost(payload)),
  );
}

export async function verifyFxBlueProfile(
  intentId: string,
  payload: FxBlueVerifyPayload,
  options?: BrokerHubApiOptions,
): Promise<{ ok: boolean; data: BrokerConnectionSoftResponse & { intent?: FxBlueSetupIntent; error?: string } }> {
  return readJsonSoft<BrokerConnectionSoftResponse & { intent?: FxBlueSetupIntent }>(
    await fetch(createBrokerHubUrl(`/brokers/fxblue/setup-intents/${encodeURIComponent(intentId)}/verify-profile`, options), jsonPost(payload)),
  );
}

export async function completeFxBlueSetupIntent(
  intentId: string,
  options?: BrokerHubApiOptions,
): Promise<{ ok: boolean; data: BrokerConnectionSoftResponse & { intent?: FxBlueSetupIntent; error?: string } }> {
  return readJsonSoft<BrokerConnectionSoftResponse & { intent?: FxBlueSetupIntent }>(
    await fetch(createBrokerHubUrl(`/brokers/fxblue/setup-intents/${encodeURIComponent(intentId)}/complete`, options), {
      method: "POST",
      credentials: "include",
    }),
  );
}
```

- [ ] **Step 5: Expose helpers in `useBrokerHub`**

In `artifacts/trader-dashboard/src/components/broker-hub/useBrokerHub.ts`, import:

```ts
  completeFxBlueSetupIntent as completeFxBlueSetupIntentRequest,
  createFxBlueSetupIntent as createFxBlueSetupIntentRequest,
  verifyFxBlueProfile as verifyFxBlueProfileRequest,
  type FxBlueSetupPayload,
  type FxBlueVerifyPayload,
```

Add callbacks:

```ts
  const createFxBlueSetupIntent = useCallback(async (payload: FxBlueSetupPayload) => {
    const data = await createFxBlueSetupIntentRequest(payload);
    setMessage(data.intent.displayStatus);
    return data;
  }, []);

  const verifyFxBlueProfile = useCallback(async (intentId: string, payload: FxBlueVerifyPayload) => {
    const result = await verifyFxBlueProfileRequest(intentId, payload);
    const data = result.data;
    if (data.snapshot) setSnapshot(data.snapshot);
    setMessage(data.intent?.displayStatus ?? data.error ?? "Profilo FX Blue non verificato");
    return data;
  }, []);

  const completeFxBlueSetupIntent = useCallback(
    async (intentId: string) => {
      const result = await completeFxBlueSetupIntentRequest(intentId);
      const data = result.data;
      if (data.snapshot) setSnapshot(data.snapshot);
      await refreshProfiles();
      setMessage(data.intent?.displayStatus ?? data.error ?? "Account Sync FX Blue non completato");
      return data;
    },
    [refreshProfiles],
  );
```

Add them to the returned object and `useMemo` dependency list.

- [ ] **Step 6: Run client test**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/broker-hub/brokerHubApi.test.ts
```

Expected: PASS and print `broker hub api checks passed`.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/components/broker-hub/types.ts artifacts/trader-dashboard/src/components/broker-hub/brokerHubApi.ts artifacts/trader-dashboard/src/components/broker-hub/brokerHubApi.test.ts artifacts/trader-dashboard/src/components/broker-hub/useBrokerHub.ts
git commit -m "feat: add fx blue broker hub client api"
```

## Task 6: FX Blue Wizard Component

**Files:**
- Create: `artifacts/trader-dashboard/src/components/broker-hub/FxBlueAccountSyncWizard.static.test.ts`
- Create: `artifacts/trader-dashboard/src/components/broker-hub/FxBlueAccountSyncWizard.tsx`

- [ ] **Step 1: Write failing static test**

Create `artifacts/trader-dashboard/src/components/broker-hub/FxBlueAccountSyncWizard.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./FxBlueAccountSyncWizard.tsx", import.meta.url), "utf8");

assert.match(source, /FX Blue Account Sync/);
assert.match(source, /https:\/\/diagnostics\.fxblue\.com\/accountsync\.aspx/);
assert.match(source, /password investor\/read-only/i);
assert.match(source, /Non inserire la password master/);
assert.match(source, /Sola lettura/);
assert.match(source, /createFxBlueSetupIntent/);
assert.match(source, /verifyFxBlueProfile/);
assert.match(source, /completeFxBlueSetupIntent/);
assert.equal(source.includes("placeOrder("), false);
assert.equal(source.includes("tradingEnabled: true"), false);

console.log("fx blue account sync wizard static checks passed");
```

- [ ] **Step 2: Run static test and verify RED**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/broker-hub/FxBlueAccountSyncWizard.static.test.ts
```

Expected: FAIL because `FxBlueAccountSyncWizard.tsx` does not exist.

- [ ] **Step 3: Create wizard component**

Create `artifacts/trader-dashboard/src/components/broker-hub/FxBlueAccountSyncWizard.tsx`:

```tsx
import { useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, LockKeyhole, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { useBrokerHub } from "./useBrokerHub";

type FxBlueStep = "details" | "fxblue" | "profile" | "done";

const FXBLUE_ACCOUNT_SYNC_URL = "https://diagnostics.fxblue.com/accountsync.aspx";

export function FxBlueAccountSyncWizard({
  hub,
  onConnected,
  onBack,
}: {
  hub: ReturnType<typeof useBrokerHub>;
  onConnected: () => void;
  onBack: () => void;
}) {
  const [step, setStep] = useState<FxBlueStep>("details");
  const [platform, setPlatform] = useState<"MT4" | "MT5">("MT5");
  const [brokerName, setBrokerName] = useState("FX Blue");
  const [server, setServer] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [environment, setEnvironment] = useState<"demo" | "live">("live");
  const [investorPassword, setInvestorPassword] = useState("");
  const [fxBlueProfileRef, setFxBlueProfileRef] = useState("");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailsReady = accountNumber.trim() && server.trim() && investorPassword;

  const createIntent = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await hub.createFxBlueSetupIntent({
        platform,
        brokerName: brokerName.trim() || "FX Blue",
        server: server.trim(),
        accountNumber: accountNumber.trim(),
        environment,
        investorPassword,
      });
      setInvestorPassword("");
      setIntentId(created.intent.id);
      setStep("fxblue");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup FX Blue non avviato");
    } finally {
      setBusy(false);
    }
  };

  const verifyProfile = async () => {
    if (!intentId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await hub.verifyFxBlueProfile(intentId, { fxBlueProfileRef: fxBlueProfileRef.trim() });
      if (data.snapshot?.status === "connected") setStep("done");
      if (data.error) setError(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profilo FX Blue non verificato");
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    if (!intentId) return;
    setBusy(true);
    setError(null);
    try {
      const data = await hub.completeFxBlueSetupIntent(intentId);
      if (data.profile) {
        setStep("done");
        onConnected();
      }
      if (data.error) setError(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account Sync FX Blue non completato");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/40 bg-secondary/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold">FX Blue Account Sync</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Configura FX Blue dal Broker Hub e collega i dati sincronizzati in Sola lettura.
          </p>
        </div>
        <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase text-primary">
          Sola lettura
        </span>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {step === "details" && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Piattaforma</Label>
              <select value={platform} onChange={(event) => setPlatform(event.target.value as "MT4" | "MT5")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="MT5">MT5</option>
                <option value="MT4">MT4</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <select value={environment} onChange={(event) => setEnvironment(event.target.value as "demo" | "live")} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="live">Live</option>
                <option value="demo">Demo</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Broker</Label>
            <Input value={brokerName} onChange={(event) => setBrokerName(event.target.value)} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Numero conto</Label>
              <Input value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Server broker</Label>
              <Input value={server} onChange={(event) => setServer(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <LockKeyhole className="h-3.5 w-3.5" />
              password investor/read-only
            </Label>
            <Input type="password" autoComplete="off" value={investorPassword} onChange={(event) => setInvestorPassword(event.target.value)} />
            <p className="text-xs text-amber-400">Non inserire la password master del conto. Usa solo la password investor/read-only per FX Blue.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={onBack}>Indietro</Button>
            <Button className="gap-2" disabled={busy || !detailsReady} onClick={createIntent}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Prepara setup FX Blue
            </Button>
          </div>
        </div>
      )}

      {step === "fxblue" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-border/40 bg-background/40 p-3 text-sm text-muted-foreground">
            <p>1. Accedi o registrati su FX Blue.</p>
            <p>2. Apri Account Sync e seleziona {platform}.</p>
            <p>3. Inserisci numero conto, server e password investor/read-only.</p>
            <p>4. Avvia la raccolta e torna qui.</p>
          </div>
          <Button asChild className="w-full gap-2">
            <a href={FXBLUE_ACCOUNT_SYNC_URL} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Apri FX Blue Account Sync
            </a>
          </Button>
          <Button variant="outline" className="w-full" onClick={() => setStep("profile")}>
            Ho completato il setup su FX Blue
          </Button>
        </div>
      )}

      {step === "profile" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Username o URL profilo FX Blue</Label>
            <Input value={fxBlueProfileRef} onChange={(event) => setFxBlueProfileRef(event.target.value)} placeholder="trader-one oppure https://www.fxblue.com/users/trader-one" />
          </div>
          <Button className="w-full gap-2" disabled={busy || !fxBlueProfileRef.trim()} onClick={verifyProfile}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Verifica dati FX Blue
          </Button>
        </div>
      )}

      {step === "done" && (
        <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-primary">
          <div className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="h-5 w-5" />
            Profilo FX Blue verificato
          </div>
          <p className="text-sm text-primary/80">Completa il collegamento per visualizzare il conto nel Broker Hub.</p>
          <Button className="w-full" onClick={complete} disabled={busy}>
            Completa collegamento
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run static test and typecheck component**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/broker-hub/FxBlueAccountSyncWizard.static.test.ts
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: static test PASS and typecheck PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/broker-hub/FxBlueAccountSyncWizard.tsx artifacts/trader-dashboard/src/components/broker-hub/FxBlueAccountSyncWizard.static.test.ts
git commit -m "feat: add fx blue account sync wizard"
```

## Task 7: Integrate FX Blue Route Into Connect Wizard

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/broker-hub/ConnectAccountWizard.tsx`
- Create: `artifacts/trader-dashboard/src/components/broker-hub/ConnectAccountWizard.fxblue.static.test.ts`

- [ ] **Step 1: Write failing integration static test**

Create `artifacts/trader-dashboard/src/components/broker-hub/ConnectAccountWizard.fxblue.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./ConnectAccountWizard.tsx", import.meta.url), "utf8");

assert.match(source, /FxBlueAccountSyncWizard/);
assert.match(source, /FX Blue Account Sync/);
assert.match(source, /fxblue/);
assert.match(source, /Sola lettura/);

console.log("connect account wizard fx blue static checks passed");
```

- [ ] **Step 2: Run and verify RED**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/broker-hub/ConnectAccountWizard.fxblue.static.test.ts
```

Expected: FAIL because the wizard does not yet reference FX Blue.

- [ ] **Step 3: Import the FX Blue wizard**

In `artifacts/trader-dashboard/src/components/broker-hub/ConnectAccountWizard.tsx`, add:

```ts
import { FxBlueAccountSyncWizard } from "./FxBlueAccountSyncWizard";
```

Change route type:

```ts
type RouteChoice = "smartlink" | "oauth" | "portal" | "import" | "fxblue";
```

Add broker choice before `Altro broker`:

```ts
  {
    id: "FX Blue Account Sync",
    title: "FX Blue Account Sync",
    detail: "Setup guidato FX Blue e import dati in Sola lettura.",
    route: "fxblue",
  },
```

Update `BrokerChoice`:

```ts
type BrokerChoice =
  | "FP Trading"
  | "Qualsiasi broker MetaTrader"
  | "cTrader"
  | "Broker azioni/crypto supportati"
  | "FX Blue Account Sync"
  | "Altro broker";
```

- [ ] **Step 4: Render the dedicated FX Blue wizard**

After `const selected = ...`, add an early render inside the component body before the main return:

```tsx
  if (selected.route === "fxblue" && step === "connect") {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <FxBlueAccountSyncWizard hub={hub} onConnected={onConnected} onBack={() => setStep("broker")} />
        <div className="rounded-xl border border-border/40 bg-secondary/20 p-4 text-sm">
          <p className="font-bold">Sicurezza e compatibilita'</p>
          <div className="mt-3 grid gap-2 text-muted-foreground">
            <p>FX Blue Account Sync resta una connessione in Sola lettura.</p>
            <p>Usa solo password investor/read-only su FX Blue.</p>
            <p>La frequenza di aggiornamento dipende da FX Blue, piattaforma e broker.</p>
            <p>Gli ordini live non sono disponibili su questa rotta.</p>
          </div>
        </div>
      </div>
    );
  }
```

Update the connect-step heading branch:

```tsx
: selected.route === "fxblue"
  ? "Configura FX Blue"
```

This branch is not normally reached because of the early render, but it keeps copy exhaustive.

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/broker-hub/ConnectAccountWizard.fxblue.static.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/components/broker-hub/FxBlueAccountSyncWizard.static.test.ts
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: tests PASS and typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add artifacts/trader-dashboard/src/components/broker-hub/ConnectAccountWizard.tsx artifacts/trader-dashboard/src/components/broker-hub/ConnectAccountWizard.fxblue.static.test.ts
git commit -m "feat: add fx blue route to broker wizard"
```

## Task 8: End-To-End Verification And Polish

**Files:**
- Modify as needed from previous tasks only if verification finds issues.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/brokerHub/fxBlueConnector.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/brokerHub/fxBlueSetupIntentStore.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/broker-fxblue.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/brokers.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/brokerHub/brokerHub.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Run focused frontend tests**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/broker-hub/brokerHubApi.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/components/broker-hub/FxBlueAccountSyncWizard.static.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/components/broker-hub/ConnectAccountWizard.fxblue.static.test.ts
```

Expected: all PASS.

- [ ] **Step 3: Run package typechecks**

Run:

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: both PASS.

- [ ] **Step 4: Run workspace verification**

Run:

```bash
pnpm test
pnpm typecheck
```

Expected: both PASS. If unrelated pre-existing dirty-worktree failures appear, capture the failing command and exact failing test names in the final handoff.

- [ ] **Step 5: Manual browser check**

Run the app:

```bash
pnpm start:local
```

Open `/broker`, then verify:

- `FX Blue Account Sync` appears in the broker selection grid.
- The FX Blue flow shows `Sola lettura`.
- The FX Blue flow shows the official Account Sync URL.
- The password helper says `Non inserire la password master del conto`.
- After a mocked/working backend response, the created profile has `placeOrders: false`.
- The order tab remains disabled for FX Blue profiles.

- [ ] **Step 6: Final commit if verification fixes were needed**

If Task 8 required fixes, commit them:

```bash
git add artifacts/api-server/src artifacts/trader-dashboard/src
git commit -m "fix: polish fx blue account sync integration"
```

If no fixes were needed, skip this commit.

## Self-Review

- Spec coverage: provider type, read-only connector, guided setup, no partner API, no login automation, no password persistence, sync/waiting states, frontend wizard, and tests are covered by Tasks 1-8.
- Placeholder scan: the plan contains concrete file paths, commands, expected outcomes, and code snippets for every implementation step.
- Type consistency: provider literal is consistently `fxblue-account-sync`; route literal is consistently `fxblue_account_sync`; health literal is consistently `waiting_for_fxblue_sync`; client function names are consistently `createFxBlueSetupIntent`, `verifyFxBlueProfile`, and `completeFxBlueSetupIntent`.
