# Account Bridge and TradingView Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a working personal account bridge tool with demo/MT5 socket adapters, live WebSocket updates, protected order submission, journal/statistics import, and a selectable-timeframe TradingView monitor.

**Architecture:** Add a focused account bridge subsystem under the API server, backed by a new `account_trades` Drizzle schema. The server owns broker adapters and WebSocket events; the dashboard consumes those events through a hook and renders a compact widget plus a workspace drawer with the TradingView Advanced Chart widget.

**Tech Stack:** TypeScript, Express, `ws`, Drizzle ORM/PostgreSQL, React/Vite, localStorage, TradingView embed script, Node `assert` checks executed with `tsx`, existing `pnpm` workspace scripts.

**Workspace Note:** This folder is not currently a git repository, so commit steps are replaced with verification checkpoints. If a `.git` repository is added before execution, commit after each completed task with the task title.

---

## File Structure

Create or modify these files:

- Create `lib/db/src/schema/account.ts`: Drizzle table for imported account trades.
- Modify `lib/db/src/schema/index.ts`: export the account schema.
- Create `artifacts/api-server/src/services/accountBridge/types.ts`: server account bridge domain types.
- Create `artifacts/api-server/src/services/accountBridge/validation.ts`: order validation and config parsing.
- Create `artifacts/api-server/src/services/accountBridge/validation.test.ts`: executable checks for validation.
- Create `artifacts/api-server/src/services/accountBridge/journalImport.ts`: pure conversion from account trade to journal entry payload.
- Create `artifacts/api-server/src/services/accountBridge/journalImport.test.ts`: executable checks for journal import conversion.
- Create `artifacts/api-server/src/services/accountBridge/demoAdapter.ts`: deterministic demo account adapter.
- Create `artifacts/api-server/src/services/accountBridge/demoAdapter.test.ts`: executable checks for demo adapter behavior.
- Create `artifacts/api-server/src/services/accountBridge/mt5LocalSocketAdapter.ts`: MT5 local socket adapter.
- Create `artifacts/api-server/src/services/accountBridge/mt5Protocol.test.ts`: executable checks for MT5 message framing/parsing helpers.
- Create `artifacts/api-server/src/services/accountBridge/accountBridgeService.ts`: adapter orchestration, DB persistence, journal import.
- Create `artifacts/api-server/src/services/accountBridge/socketServer.ts`: `/api/account/ws` WebSocket server.
- Modify `artifacts/api-server/src/index.ts`: create HTTP server explicitly and attach the account WebSocket server.
- Create `artifacts/trader-dashboard/src/components/account-bridge/types.ts`: frontend account bridge types.
- Create `artifacts/trader-dashboard/src/components/account-bridge/useAccountBridgeSocket.ts`: WebSocket hook.
- Create `artifacts/trader-dashboard/src/components/account-bridge/tradingViewConfig.ts`: TradingView symbol/timeframe helpers.
- Create `artifacts/trader-dashboard/src/components/account-bridge/TradingViewMonitor.tsx`: TradingView embed component.
- Create `artifacts/trader-dashboard/src/components/account-bridge/AccountBridgeWidget.tsx`: compact dashboard widget.
- Create `artifacts/trader-dashboard/src/components/account-bridge/AccountBridgeWorkspace.tsx`: drawer workspace with account details, ticket, imports, and chart.
- Modify `artifacts/trader-dashboard/src/pages/Dashboard.tsx`: register the account widget.
- Modify `artifacts/trader-dashboard/src/components/dashboard-workspaces/WidgetWorkspaceContent.tsx`: render the account workspace.

---

### Task 1: Database Schema for Account Trades

**Files:**
- Create: `lib/db/src/schema/account.ts`
- Modify: `lib/db/src/schema/index.ts`

- [ ] **Step 1: Add the account trade schema**

Create `lib/db/src/schema/account.ts`:

```ts
import { integer, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { journalEntriesTable } from "./journal";

export const accountTradesTable = pgTable(
  "account_trades",
  {
    id: serial("id").primaryKey(),
    ticket: text("ticket").notNull(),
    source: text("source").notNull(),
    symbol: text("symbol").notNull(),
    direction: text("direction").notNull(),
    volume: numeric("volume", { precision: 12, scale: 2 }).notNull(),
    openTime: text("open_time").notNull(),
    closeTime: text("close_time"),
    entryPrice: numeric("entry_price", { precision: 14, scale: 5 }).notNull(),
    exitPrice: numeric("exit_price", { precision: 14, scale: 5 }),
    stopLoss: numeric("stop_loss", { precision: 14, scale: 5 }),
    takeProfit: numeric("take_profit", { precision: 14, scale: 5 }),
    profit: numeric("profit", { precision: 14, scale: 2 }),
    commission: numeric("commission", { precision: 14, scale: 2 }),
    swap: numeric("swap", { precision: 14, scale: 2 }),
    status: text("status").notNull().default("open"),
    journalEntryId: integer("journal_entry_id").references(() => journalEntriesTable.id, { onDelete: "set null" }),
    userId: text("user_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    accountTradeUnique: uniqueIndex("account_trades_source_ticket_user_unique").on(
      table.source,
      table.ticket,
      table.userId,
    ),
  }),
);

export type AccountTradeRecord = typeof accountTradesTable.$inferSelect;
export type InsertAccountTradeRecord = typeof accountTradesTable.$inferInsert;
```

- [ ] **Step 2: Export the schema**

Modify `lib/db/src/schema/index.ts`:

```ts
export * from "./auth";
export * from "./profile";
export * from "./missions";
export * from "./journal";
export * from "./extras";
export * from "./chat";
export * from "./backtest";
export * from "./social";
export * from "./community";
export * from "./milestones";
export * from "./brain";
export * from "./account";
```

- [ ] **Step 3: Verify schema typecheck**

Run:

```bash
pnpm run typecheck:libs
```

Expected: command exits `0` with no TypeScript errors.

- [ ] **Step 4: Apply the schema locally when a database is available**

Run only when `DATABASE_URL` is set for the local database:

```bash
pnpm --filter @workspace/db run push
```

Expected: Drizzle confirms the `account_trades` table diff is applied or the schema is already up to date.

---

### Task 2: Account Bridge Types and Order Validation

**Files:**
- Create: `artifacts/api-server/src/services/accountBridge/types.ts`
- Create: `artifacts/api-server/src/services/accountBridge/validation.ts`
- Create: `artifacts/api-server/src/services/accountBridge/validation.test.ts`

- [ ] **Step 1: Write validation checks first**

Create `artifacts/api-server/src/services/accountBridge/validation.test.ts`:

```ts
import assert from "node:assert/strict";
import { parseBridgeConfig, validateOrderRequest } from "./validation.js";

assert.deepEqual(parseBridgeConfig({}), {
  adapter: "demo",
  mode: "demo",
  host: "127.0.0.1",
  port: 8765,
  importJournal: true,
  orderEnabled: false,
});

const demoOrder = validateOrderRequest(
  { symbol: "EURUSD", direction: "buy", volume: 0.1, stopLoss: 1.08, takeProfit: 1.1 },
  { mode: "demo", orderEnabled: false },
);
assert.equal(demoOrder.ok, true);

const liveDisabled = validateOrderRequest(
  { symbol: "EURUSD", direction: "sell", volume: 0.1 },
  { mode: "live", orderEnabled: false },
);
assert.deepEqual(liveDisabled, { ok: false, reason: "Live order sending is disabled" });

const badVolume = validateOrderRequest(
  { symbol: "EURUSD", direction: "buy", volume: 0 },
  { mode: "demo", orderEnabled: false },
);
assert.deepEqual(badVolume, { ok: false, reason: "Volume must be greater than zero" });

console.log("account bridge validation checks passed");
```

- [ ] **Step 2: Run validation checks and confirm failure**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/validation.test.ts
```

Expected: FAIL because `validation.ts` does not exist.

- [ ] **Step 3: Add domain types**

Create `artifacts/api-server/src/services/accountBridge/types.ts`:

```ts
export type AccountConnectionMode = "demo" | "live";
export type AccountConnectionStatus = "offline" | "connecting" | "connected" | "error";
export type AccountTradeDirection = "buy" | "sell";
export type AccountTradeStatus = "open" | "closed";
export type AccountTradeSource = "demo" | "mt5";

export interface AccountBridgeConfig {
  adapter: "demo" | "mt5-local-socket";
  mode: AccountConnectionMode;
  host: string;
  port: number;
  importJournal: boolean;
  orderEnabled: boolean;
}

export interface AccountMetrics {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
  dailyProfit: number;
}

export interface AccountTrade {
  ticket: string;
  symbol: string;
  direction: AccountTradeDirection;
  volume: number;
  openTime: string;
  closeTime?: string;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  profit?: number;
  commission?: number;
  swap?: number;
  status: AccountTradeStatus;
  source: AccountTradeSource;
}

export interface AccountSnapshot {
  status: AccountConnectionStatus;
  mode: AccountConnectionMode;
  adapter: AccountBridgeConfig["adapter"];
  orderEnabled: boolean;
  metrics: AccountMetrics;
  openTrades: AccountTrade[];
  closedTrades: AccountTrade[];
  lastUpdated: string;
  error?: string;
}

export interface AccountOrderRequest {
  symbol: string;
  direction: AccountTradeDirection;
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface AccountOrderResult {
  accepted: boolean;
  ticket?: string;
  reason?: string;
}

export type AccountBridgeEvent =
  | { type: "snapshot"; snapshot: AccountSnapshot }
  | { type: "account_update"; metrics: AccountMetrics }
  | { type: "positions_update"; openTrades: AccountTrade[] }
  | { type: "trade_closed"; trade: AccountTrade }
  | { type: "order_ack"; requestId?: string; result: AccountOrderResult }
  | { type: "order_rejected"; requestId?: string; reason: string }
  | { type: "journal_imported"; ticket: string; journalEntryId: number }
  | { type: "error"; message: string };

export interface AccountAdapter {
  readonly id: AccountBridgeConfig["adapter"];
  readonly mode: AccountConnectionMode;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getSnapshot(): Promise<AccountSnapshot>;
  placeOrder(order: AccountOrderRequest): Promise<AccountOrderResult>;
  onEvent(listener: (event: AccountBridgeEvent) => void): () => void;
}
```

- [ ] **Step 4: Add validation implementation**

Create `artifacts/api-server/src/services/accountBridge/validation.ts`:

```ts
import type { AccountBridgeConfig, AccountOrderRequest } from "./types.js";

export function parseBridgeConfig(env: NodeJS.ProcessEnv): AccountBridgeConfig {
  const adapter = env.ACCOUNT_BRIDGE_ADAPTER === "mt5-local-socket" ? "mt5-local-socket" : "demo";
  const mode = env.ACCOUNT_BRIDGE_MODE === "live" ? "live" : "demo";
  const portValue = Number(env.ACCOUNT_BRIDGE_PORT ?? "8765");

  return {
    adapter,
    mode,
    host: env.ACCOUNT_BRIDGE_HOST ?? "127.0.0.1",
    port: Number.isFinite(portValue) && portValue > 0 ? portValue : 8765,
    importJournal: env.ACCOUNT_BRIDGE_IMPORT_JOURNAL !== "false",
    orderEnabled: env.ACCOUNT_BRIDGE_ORDER_ENABLED === "true",
  };
}

export function validateOrderRequest(
  raw: unknown,
  capability: { mode: "demo" | "live"; orderEnabled: boolean },
): { ok: true; order: AccountOrderRequest } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: "Order payload must be an object" };

  const data = raw as Record<string, unknown>;
  const symbol = typeof data.symbol === "string" ? data.symbol.trim().toUpperCase() : "";
  const direction = data.direction;
  const volume = typeof data.volume === "number" ? data.volume : Number(data.volume);
  const stopLoss = data.stopLoss == null || data.stopLoss === "" ? undefined : Number(data.stopLoss);
  const takeProfit = data.takeProfit == null || data.takeProfit === "" ? undefined : Number(data.takeProfit);
  const comment = typeof data.comment === "string" ? data.comment.trim().slice(0, 120) : undefined;

  if (!symbol) return { ok: false, reason: "Symbol is required" };
  if (direction !== "buy" && direction !== "sell") return { ok: false, reason: "Direction must be buy or sell" };
  if (!Number.isFinite(volume) || volume <= 0) return { ok: false, reason: "Volume must be greater than zero" };
  if (stopLoss !== undefined && (!Number.isFinite(stopLoss) || stopLoss <= 0)) return { ok: false, reason: "Stop loss must be a positive price" };
  if (takeProfit !== undefined && (!Number.isFinite(takeProfit) || takeProfit <= 0)) return { ok: false, reason: "Take profit must be a positive price" };
  if (capability.mode === "live" && !capability.orderEnabled) return { ok: false, reason: "Live order sending is disabled" };

  return { ok: true, order: { symbol, direction, volume, stopLoss, takeProfit, comment } };
}
```

- [ ] **Step 5: Run validation checks and confirm pass**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/validation.test.ts
```

Expected: prints `account bridge validation checks passed` and exits `0`.

---

### Task 3: Journal Import Conversion

**Files:**
- Create: `artifacts/api-server/src/services/accountBridge/journalImport.ts`
- Create: `artifacts/api-server/src/services/accountBridge/journalImport.test.ts`

- [ ] **Step 1: Write import conversion checks first**

Create `artifacts/api-server/src/services/accountBridge/journalImport.test.ts`:

```ts
import assert from "node:assert/strict";
import { buildJournalEntryFromAccountTrade, getTradeResult } from "./journalImport.js";
import type { AccountTrade } from "./types.js";

const baseTrade: AccountTrade = {
  ticket: "T-100",
  source: "demo",
  symbol: "EURUSD",
  direction: "buy",
  volume: 0.1,
  openTime: "2026-06-06T08:00:00.000Z",
  closeTime: "2026-06-06T09:00:00.000Z",
  entryPrice: 1.08,
  exitPrice: 1.091,
  profit: 42.5,
  status: "closed",
};

assert.equal(getTradeResult({ ...baseTrade, profit: 10 }), "win");
assert.equal(getTradeResult({ ...baseTrade, profit: -1 }), "loss");
assert.equal(getTradeResult({ ...baseTrade, profit: 0 }), "breakeven");

const draft = buildJournalEntryFromAccountTrade(baseTrade);
assert.equal(draft.title, "EURUSD BUY account trade");
assert.equal(draft.tradeDate, "2026-06-06");
assert.equal(draft.result, "win");
assert.equal(draft.tags, "account-import,demo,EURUSD,buy");
assert.match(draft.content, /Ticket: T-100/);
assert.match(draft.content, /Profit: 42.50/);

console.log("account bridge journal import checks passed");
```

- [ ] **Step 2: Run import conversion checks and confirm failure**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/journalImport.test.ts
```

Expected: FAIL because `journalImport.ts` does not exist.

- [ ] **Step 3: Add journal import conversion implementation**

Create `artifacts/api-server/src/services/accountBridge/journalImport.ts`:

```ts
import type { AccountTrade } from "./types.js";

export interface JournalEntryDraft {
  title: string;
  content: string;
  tradeDate: string;
  result: "win" | "loss" | "breakeven";
  tags: string;
}

export function getTradeResult(trade: Pick<AccountTrade, "profit">): JournalEntryDraft["result"] {
  const profit = trade.profit ?? 0;
  if (profit > 0) return "win";
  if (profit < 0) return "loss";
  return "breakeven";
}

function fmt(value: number | undefined, digits: number): string {
  return value == null ? "-" : value.toFixed(digits);
}

export function buildJournalEntryFromAccountTrade(trade: AccountTrade): JournalEntryDraft {
  const dateSource = trade.closeTime ?? trade.openTime;
  const tradeDate = new Date(dateSource).toISOString().slice(0, 10);
  const direction = trade.direction.toUpperCase();

  return {
    title: `${trade.symbol} ${direction} account trade`,
    tradeDate,
    result: getTradeResult(trade),
    tags: `account-import,${trade.source},${trade.symbol},${trade.direction}`,
    content: [
      `Imported account trade`,
      `Ticket: ${trade.ticket}`,
      `Source: ${trade.source}`,
      `Symbol: ${trade.symbol}`,
      `Direction: ${direction}`,
      `Volume: ${trade.volume}`,
      `Open: ${trade.openTime}`,
      `Close: ${trade.closeTime ?? "-"}`,
      `Entry: ${fmt(trade.entryPrice, 5)}`,
      `Exit: ${fmt(trade.exitPrice, 5)}`,
      `Stop Loss: ${fmt(trade.stopLoss, 5)}`,
      `Take Profit: ${fmt(trade.takeProfit, 5)}`,
      `Profit: ${fmt(trade.profit, 2)}`,
      `Commission: ${fmt(trade.commission, 2)}`,
      `Swap: ${fmt(trade.swap, 2)}`,
    ].join("\n"),
  };
}
```

- [ ] **Step 4: Run import conversion checks and confirm pass**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/journalImport.test.ts
```

Expected: prints `account bridge journal import checks passed` and exits `0`.

---

### Task 4: Demo Account Adapter

**Files:**
- Create: `artifacts/api-server/src/services/accountBridge/demoAdapter.ts`
- Create: `artifacts/api-server/src/services/accountBridge/demoAdapter.test.ts`

- [ ] **Step 1: Write demo adapter checks first**

Create `artifacts/api-server/src/services/accountBridge/demoAdapter.test.ts`:

```ts
import assert from "node:assert/strict";
import { createDemoAccountAdapter } from "./demoAdapter.js";

const adapter = createDemoAccountAdapter();
await adapter.connect();

const initial = await adapter.getSnapshot();
assert.equal(initial.status, "connected");
assert.equal(initial.mode, "demo");
assert.equal(initial.orderEnabled, true);
assert.equal(initial.metrics.currency, "USD");

const result = await adapter.placeOrder({ symbol: "EURUSD", direction: "buy", volume: 0.1 });
assert.equal(result.accepted, true);
assert.ok(result.ticket);

const afterOrder = await adapter.getSnapshot();
assert.equal(afterOrder.openTrades.length, 1);

await adapter.disconnect();
const disconnected = await adapter.getSnapshot();
assert.equal(disconnected.status, "offline");

console.log("demo account adapter checks passed");
```

- [ ] **Step 2: Run demo adapter checks and confirm failure**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/demoAdapter.test.ts
```

Expected: FAIL because `demoAdapter.ts` does not exist.

- [ ] **Step 3: Add demo adapter implementation**

Create `artifacts/api-server/src/services/accountBridge/demoAdapter.ts`:

```ts
import type { AccountAdapter, AccountBridgeEvent, AccountOrderRequest, AccountOrderResult, AccountSnapshot, AccountTrade } from "./types.js";

type Listener = (event: AccountBridgeEvent) => void;

export function createDemoAccountAdapter(): AccountAdapter {
  const listeners = new Set<Listener>();
  let status: AccountSnapshot["status"] = "offline";
  let ticketCounter = 1000;
  let openTrades: AccountTrade[] = [];
  const closedTrades: AccountTrade[] = [];

  const metrics = {
    balance: 10_000,
    equity: 10_000,
    margin: 0,
    freeMargin: 10_000,
    currency: "USD",
    dailyProfit: 0,
  };

  function snapshot(): AccountSnapshot {
    return {
      status,
      mode: "demo",
      adapter: "demo",
      orderEnabled: true,
      metrics,
      openTrades,
      closedTrades,
      lastUpdated: new Date().toISOString(),
    };
  }

  function emit(event: AccountBridgeEvent) {
    for (const listener of listeners) listener(event);
  }

  return {
    id: "demo",
    mode: "demo",
    async connect() {
      status = "connected";
      emit({ type: "snapshot", snapshot: snapshot() });
    },
    async disconnect() {
      status = "offline";
      emit({ type: "snapshot", snapshot: snapshot() });
    },
    async getSnapshot() {
      return snapshot();
    },
    async placeOrder(order: AccountOrderRequest): Promise<AccountOrderResult> {
      if (status !== "connected") return { accepted: false, reason: "Demo adapter is offline" };
      const ticket = `DEMO-${++ticketCounter}`;
      const trade: AccountTrade = {
        ticket,
        source: "demo",
        symbol: order.symbol,
        direction: order.direction,
        volume: order.volume,
        openTime: new Date().toISOString(),
        entryPrice: order.direction === "buy" ? 1.085 : 1.095,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        status: "open",
      };
      openTrades = [trade, ...openTrades];
      emit({ type: "positions_update", openTrades });
      emit({ type: "order_ack", result: { accepted: true, ticket } });
      return { accepted: true, ticket };
    },
    onEvent(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

- [ ] **Step 4: Run demo adapter checks and confirm pass**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/demoAdapter.test.ts
```

Expected: prints `demo account adapter checks passed` and exits `0`.

---

### Task 5: MT5 Local Socket Adapter

**Files:**
- Create: `artifacts/api-server/src/services/accountBridge/mt5LocalSocketAdapter.ts`
- Create: `artifacts/api-server/src/services/accountBridge/mt5Protocol.test.ts`

- [ ] **Step 1: Write MT5 protocol checks first**

Create `artifacts/api-server/src/services/accountBridge/mt5Protocol.test.ts`:

```ts
import assert from "node:assert/strict";
import { buildMt5Message, parseMt5Line } from "./mt5LocalSocketAdapter.js";

assert.equal(
  buildMt5Message("snapshot", { requestId: "r1" }),
  JSON.stringify({ type: "snapshot", payload: { requestId: "r1" } }) + "\n",
);

assert.deepEqual(parseMt5Line('{"type":"account","payload":{"balance":100}}'), {
  type: "account",
  payload: { balance: 100 },
});

assert.equal(parseMt5Line("not json"), null);

console.log("mt5 protocol checks passed");
```

- [ ] **Step 2: Run MT5 protocol checks and confirm failure**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/mt5Protocol.test.ts
```

Expected: FAIL because `mt5LocalSocketAdapter.ts` does not exist.

- [ ] **Step 3: Add MT5 socket adapter**

Create `artifacts/api-server/src/services/accountBridge/mt5LocalSocketAdapter.ts`:

```ts
import net from "node:net";
import type { AccountAdapter, AccountBridgeConfig, AccountBridgeEvent, AccountOrderRequest, AccountOrderResult, AccountSnapshot } from "./types.js";

type Listener = (event: AccountBridgeEvent) => void;

export function buildMt5Message(type: string, payload: Record<string, unknown>): string {
  return JSON.stringify({ type, payload }) + "\n";
}

export function parseMt5Line(line: string): { type: string; payload: unknown } | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.type !== "string") return null;
    return { type: obj.type, payload: obj.payload };
  } catch {
    return null;
  }
}

export function createMt5LocalSocketAdapter(config: AccountBridgeConfig): AccountAdapter {
  const listeners = new Set<Listener>();
  let socket: net.Socket | null = null;
  let status: AccountSnapshot["status"] = "offline";
  let lastSnapshot: AccountSnapshot = {
    status,
    mode: config.mode,
    adapter: "mt5-local-socket",
    orderEnabled: config.mode === "live" && config.orderEnabled,
    metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
    openTrades: [],
    closedTrades: [],
    lastUpdated: new Date().toISOString(),
  };

  function emit(event: AccountBridgeEvent) {
    for (const listener of listeners) listener(event);
  }

  function setError(message: string) {
    status = "error";
    lastSnapshot = { ...lastSnapshot, status, error: message, lastUpdated: new Date().toISOString() };
    emit({ type: "error", message });
    emit({ type: "snapshot", snapshot: lastSnapshot });
  }

  function handleLine(line: string) {
    const msg = parseMt5Line(line);
    if (!msg) return;
    if (msg.type === "snapshot") {
      const payload = msg.payload as Partial<AccountSnapshot>;
      lastSnapshot = {
        ...lastSnapshot,
        ...payload,
        status: "connected",
        mode: config.mode,
        adapter: "mt5-local-socket",
        orderEnabled: config.mode === "live" && config.orderEnabled,
        lastUpdated: new Date().toISOString(),
      };
      emit({ type: "snapshot", snapshot: lastSnapshot });
    }
  }

  return {
    id: "mt5-local-socket",
    mode: config.mode,
    async connect() {
      status = "connecting";
      await new Promise<void>((resolve) => {
        const client = net.createConnection({ host: config.host, port: config.port }, () => {
          socket = client;
          status = "connected";
          client.write(buildMt5Message("snapshot", {}));
          resolve();
        });
        let buffer = "";
        client.on("data", (chunk) => {
          buffer += chunk.toString("utf8");
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) if (line.trim()) handleLine(line.trim());
        });
        client.on("error", (err) => {
          setError(err.message);
          resolve();
        });
        client.on("close", () => {
          if (status !== "error") status = "offline";
          socket = null;
        });
      });
    },
    async disconnect() {
      socket?.destroy();
      socket = null;
      status = "offline";
      lastSnapshot = { ...lastSnapshot, status, lastUpdated: new Date().toISOString() };
    },
    async getSnapshot() {
      return { ...lastSnapshot, status, lastUpdated: new Date().toISOString() };
    },
    async placeOrder(order: AccountOrderRequest): Promise<AccountOrderResult> {
      if (!socket || status !== "connected") return { accepted: false, reason: "MT5 bridge is not connected" };
      if (config.mode !== "live" || !config.orderEnabled) return { accepted: false, reason: "Live order sending is disabled" };
      socket.write(buildMt5Message("place_order", order as unknown as Record<string, unknown>));
      return { accepted: true };
    },
    onEvent(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

- [ ] **Step 4: Run MT5 protocol checks and confirm pass**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/mt5Protocol.test.ts
```

Expected: prints `mt5 protocol checks passed` and exits `0`.

---

### Task 6: Account Bridge Service and Persistence

**Files:**
- Create: `artifacts/api-server/src/services/accountBridge/accountBridgeService.ts`

- [ ] **Step 1: Add the bridge service**

Create `artifacts/api-server/src/services/accountBridge/accountBridgeService.ts`:

```ts
import { and, eq, isNull } from "drizzle-orm";
import { db, accountTradesTable, journalEntriesTable } from "@workspace/db";
import { createDemoAccountAdapter } from "./demoAdapter.js";
import { createMt5LocalSocketAdapter } from "./mt5LocalSocketAdapter.js";
import { buildJournalEntryFromAccountTrade } from "./journalImport.js";
import { parseBridgeConfig } from "./validation.js";
import type { AccountAdapter, AccountBridgeConfig, AccountBridgeEvent, AccountOrderRequest, AccountSnapshot, AccountTrade } from "./types.js";

type Listener = (event: AccountBridgeEvent) => void;

function createAdapter(config: AccountBridgeConfig): AccountAdapter {
  return config.adapter === "mt5-local-socket"
    ? createMt5LocalSocketAdapter(config)
    : createDemoAccountAdapter();
}

export class AccountBridgeService {
  private readonly listeners = new Set<Listener>();
  private readonly config = parseBridgeConfig(process.env);
  private readonly adapter = createAdapter(this.config);
  private unsubscribe: (() => void) | null = null;

  async start() {
    if (!this.unsubscribe) {
      this.unsubscribe = this.adapter.onEvent((event) => {
        this.handleAdapterEvent(event).catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.broadcast({ type: "error", message });
        });
      });
    }
    await this.adapter.connect();
  }

  async getSnapshot(): Promise<AccountSnapshot> {
    return this.adapter.getSnapshot();
  }

  async placeOrder(order: AccountOrderRequest) {
    return this.adapter.placeOrder(order);
  }

  onEvent(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async importClosedTrade(trade: AccountTrade, userId: string | null) {
    const existing = await db
      .select()
      .from(accountTradesTable)
      .where(and(
        eq(accountTradesTable.source, trade.source),
        eq(accountTradesTable.ticket, trade.ticket),
        userId ? eq(accountTradesTable.userId, userId) : isNull(accountTradesTable.userId),
      ))
      .limit(1);

    if (existing[0]?.journalEntryId) {
      return { alreadyImported: true, journalEntryId: existing[0].journalEntryId };
    }

    const draft = buildJournalEntryFromAccountTrade(trade);
    const [journalEntry] = await db.insert(journalEntriesTable).values({ ...draft, userId }).returning();

    if (existing[0]) {
      await db.update(accountTradesTable)
        .set({ journalEntryId: journalEntry.id, updatedAt: new Date() })
        .where(eq(accountTradesTable.id, existing[0].id));
    } else {
      await db.insert(accountTradesTable).values({
        ticket: trade.ticket,
        source: trade.source,
        symbol: trade.symbol,
        direction: trade.direction,
        volume: String(trade.volume),
        openTime: trade.openTime,
        closeTime: trade.closeTime ?? null,
        entryPrice: String(trade.entryPrice),
        exitPrice: trade.exitPrice == null ? null : String(trade.exitPrice),
        stopLoss: trade.stopLoss == null ? null : String(trade.stopLoss),
        takeProfit: trade.takeProfit == null ? null : String(trade.takeProfit),
        profit: trade.profit == null ? null : String(trade.profit),
        commission: trade.commission == null ? null : String(trade.commission),
        swap: trade.swap == null ? null : String(trade.swap),
        status: trade.status,
        journalEntryId: journalEntry.id,
        userId,
      });
    }

    this.broadcast({ type: "journal_imported", ticket: trade.ticket, journalEntryId: journalEntry.id });
    return { alreadyImported: false, journalEntryId: journalEntry.id };
  }

  private async handleAdapterEvent(event: AccountBridgeEvent) {
    if (event.type === "trade_closed" && this.config.importJournal) {
      await this.importClosedTrade(event.trade, null);
    }
    this.broadcast(event);
  }

  private broadcast(event: AccountBridgeEvent) {
    for (const listener of this.listeners) listener(event);
  }
}

export const accountBridgeService = new AccountBridgeService();
```

- [ ] **Step 2: Run API server typecheck**

Run:

```bash
pnpm --filter @workspace/api-server run typecheck
```

Expected: command exits `0` with no TypeScript errors.

---

### Task 7: WebSocket Server

**Files:**
- Create: `artifacts/api-server/src/services/accountBridge/socketServer.ts`
- Modify: `artifacts/api-server/src/index.ts`

- [ ] **Step 1: Add WebSocket server**

Create `artifacts/api-server/src/services/accountBridge/socketServer.ts`:

```ts
import type http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { accountBridgeService } from "./accountBridgeService.js";
import { validateOrderRequest } from "./validation.js";
import type { AccountBridgeEvent, AccountTrade } from "./types.js";

type ClientMessage =
  | { type: "subscribe"; requestId?: string }
  | { type: "refresh"; requestId?: string }
  | { type: "place_order"; requestId?: string; payload: unknown }
  | { type: "import_trade"; requestId?: string; payload: AccountTrade };

function send(ws: WebSocket, event: AccountBridgeEvent | { type: "snapshot"; requestId?: string; snapshot: unknown }) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ ...event, timestamp: new Date().toISOString() }));
  }
}

function parseClientMessage(raw: WebSocket.RawData): ClientMessage | null {
  try {
    const parsed = JSON.parse(raw.toString()) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const msg = parsed as Record<string, unknown>;
    if (typeof msg.type !== "string") return null;
    return msg as ClientMessage;
  } catch {
    return null;
  }
}

export function attachAccountBridgeWebSocket(server: http.Server) {
  const wss = new WebSocketServer({ server, path: "/api/account/ws" });

  accountBridgeService.start().catch((error: unknown) => {
    console.warn("[account-bridge] start failed", error);
  });

  wss.on("connection", (ws) => {
    const unsubscribe = accountBridgeService.onEvent((event) => send(ws, event));

    accountBridgeService.getSnapshot()
      .then((snapshot) => send(ws, { type: "snapshot", snapshot }))
      .catch((error: unknown) => send(ws, { type: "error", message: error instanceof Error ? error.message : String(error) }));

    ws.on("message", async (raw) => {
      const message = parseClientMessage(raw);
      if (!message) {
        send(ws, { type: "error", message: "Invalid account bridge message" });
        return;
      }

      if (message.type === "subscribe" || message.type === "refresh") {
        const snapshot = await accountBridgeService.getSnapshot();
        send(ws, { type: "snapshot", requestId: message.requestId, snapshot });
        return;
      }

      if (message.type === "place_order") {
        const snapshot = await accountBridgeService.getSnapshot();
        const validated = validateOrderRequest(message.payload, { mode: snapshot.mode, orderEnabled: snapshot.orderEnabled });
        if (!validated.ok) {
          send(ws, { type: "order_rejected", requestId: message.requestId, reason: validated.reason });
          return;
        }
        const result = await accountBridgeService.placeOrder(validated.order);
        send(ws, result.accepted
          ? { type: "order_ack", requestId: message.requestId, result }
          : { type: "order_rejected", requestId: message.requestId, reason: result.reason ?? "Order rejected" });
        return;
      }

      if (message.type === "import_trade") {
        const result = await accountBridgeService.importClosedTrade(message.payload, null);
        send(ws, {
          type: "journal_imported",
          ticket: message.payload.ticket,
          journalEntryId: result.journalEntryId,
        });
      }
    });

    ws.on("close", unsubscribe);
  });

  return wss;
}
```

- [ ] **Step 2: Attach WebSocket server in API entrypoint**

Modify `artifacts/api-server/src/index.ts`:

```ts
import http from "node:http";
import app from "./app";
import { startSessionScheduler } from "./routes/push.js";
import { startBrainScanner } from "./services/brainScanner.js";
import { attachAccountBridgeWebSocket } from "./services/accountBridge/socketServer.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);
attachAccountBridgeWebSocket(server);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  startSessionScheduler();
  startBrainScanner();
});
```

- [ ] **Step 3: Run API server typecheck**

Run:

```bash
pnpm --filter @workspace/api-server run typecheck
```

Expected: command exits `0` with no TypeScript errors.

---

### Task 8: Frontend Socket Hook and TradingView Config Helpers

**Files:**
- Create: `artifacts/trader-dashboard/src/components/account-bridge/types.ts`
- Create: `artifacts/trader-dashboard/src/components/account-bridge/useAccountBridgeSocket.ts`
- Create: `artifacts/trader-dashboard/src/components/account-bridge/tradingViewConfig.ts`

- [ ] **Step 1: Add frontend types**

Create `artifacts/trader-dashboard/src/components/account-bridge/types.ts`:

```ts
export type AccountConnectionMode = "demo" | "live";
export type AccountConnectionStatus = "offline" | "connecting" | "connected" | "error";
export type AccountTradeDirection = "buy" | "sell";

export interface AccountMetrics {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  currency: string;
  dailyProfit: number;
}

export interface AccountTrade {
  ticket: string;
  symbol: string;
  direction: AccountTradeDirection;
  volume: number;
  openTime: string;
  closeTime?: string;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  profit?: number;
  commission?: number;
  swap?: number;
  status: "open" | "closed";
  source: "demo" | "mt5";
}

export interface AccountSnapshot {
  status: AccountConnectionStatus;
  mode: AccountConnectionMode;
  adapter: "demo" | "mt5-local-socket";
  orderEnabled: boolean;
  metrics: AccountMetrics;
  openTrades: AccountTrade[];
  closedTrades: AccountTrade[];
  lastUpdated: string;
  error?: string;
}

export interface AccountOrderDraft {
  symbol: string;
  direction: AccountTradeDirection;
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}
```

- [ ] **Step 2: Add TradingView config helper**

Create `artifacts/trader-dashboard/src/components/account-bridge/tradingViewConfig.ts`:

```ts
export const TRADING_VIEW_TIMEFRAMES = ["1", "5", "15", "30", "60", "240", "D", "W"] as const;

export const DEFAULT_TRADING_VIEW_SYMBOL = "FX:EURUSD";
export const DEFAULT_TRADING_VIEW_TIMEFRAME = "60";
export const TRADING_VIEW_PREF_KEY = "tl_account_bridge_tradingview_v1";

export interface TradingViewPreferences {
  symbol: string;
  timeframe: string;
}

export function mapBrokerSymbolToTradingView(symbol: string): string {
  const clean = symbol.replace("/", "").toUpperCase();
  if (clean === "XAUUSD") return "OANDA:XAUUSD";
  if (clean === "XAGUSD") return "OANDA:XAGUSD";
  if (clean === "BTCUSD") return "COINBASE:BTCUSD";
  if (/^[A-Z]{6}$/.test(clean)) return `FX:${clean}`;
  return clean || DEFAULT_TRADING_VIEW_SYMBOL;
}

export function normalizeTradingViewPreferences(raw: unknown): TradingViewPreferences {
  if (typeof raw !== "object" || raw === null) {
    return { symbol: DEFAULT_TRADING_VIEW_SYMBOL, timeframe: DEFAULT_TRADING_VIEW_TIMEFRAME };
  }
  const data = raw as Record<string, unknown>;
  const symbol = typeof data.symbol === "string" && data.symbol.trim()
    ? data.symbol.trim().toUpperCase()
    : DEFAULT_TRADING_VIEW_SYMBOL;
  const timeframe = typeof data.timeframe === "string" && TRADING_VIEW_TIMEFRAMES.includes(data.timeframe as never)
    ? data.timeframe
    : DEFAULT_TRADING_VIEW_TIMEFRAME;
  return { symbol, timeframe };
}
```

- [ ] **Step 3: Add WebSocket hook**

Create `artifacts/trader-dashboard/src/components/account-bridge/useAccountBridgeSocket.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AccountOrderDraft, AccountSnapshot, AccountTrade } from "./types";

const EMPTY_SNAPSHOT: AccountSnapshot = {
  status: "connecting",
  mode: "demo",
  adapter: "demo",
  orderEnabled: false,
  metrics: { balance: 0, equity: 0, margin: 0, freeMargin: 0, currency: "USD", dailyProfit: 0 },
  openTrades: [],
  closedTrades: [],
  lastUpdated: new Date(0).toISOString(),
};

function getWsUrl(): string {
  const base = import.meta.env.VITE_API_BASE || "";
  const origin = base ? new URL(base, window.location.origin).origin : window.location.origin;
  const url = new URL("/api/account/ws", origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function useAccountBridgeSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [snapshot, setSnapshot] = useState<AccountSnapshot>(EMPTY_SNAPSHOT);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastOrderMessage, setLastOrderMessage] = useState<string | null>(null);

  const connect = useCallback(() => {
    wsRef.current?.close();
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    setSnapshot((prev) => ({ ...prev, status: "connecting" }));

    ws.onopen = () => ws.send(JSON.stringify({ type: "subscribe" }));
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as Record<string, unknown>;
      if (message.type === "snapshot" && message.snapshot) setSnapshot(message.snapshot as AccountSnapshot);
      if (message.type === "positions_update" && Array.isArray(message.openTrades)) {
        setSnapshot((prev) => ({ ...prev, openTrades: message.openTrades as AccountTrade[] }));
      }
      if (message.type === "order_ack") setLastOrderMessage("Ordine accettato dal bridge");
      if (message.type === "order_rejected") setLastOrderMessage(String(message.reason ?? "Ordine rifiutato"));
      if (message.type === "error") setLastError(String(message.message ?? "Errore account bridge"));
    };
    ws.onerror = () => setLastError("Connessione account bridge non disponibile");
    ws.onclose = () => setSnapshot((prev) => ({ ...prev, status: "offline" }));
  }, []);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const sendOrder = useCallback((order: AccountOrderDraft) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      setLastOrderMessage("Socket account non connesso");
      return;
    }
    wsRef.current.send(JSON.stringify({ type: "place_order", requestId: crypto.randomUUID(), payload: order }));
  }, []);

  return useMemo(() => ({
    snapshot,
    lastError,
    lastOrderMessage,
    reconnect: connect,
    sendOrder,
  }), [snapshot, lastError, lastOrderMessage, connect, sendOrder]);
}
```

- [ ] **Step 4: Run dashboard typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: command exits `0` with no TypeScript errors.

---

### Task 9: TradingView Monitor Component

**Files:**
- Create: `artifacts/trader-dashboard/src/components/account-bridge/TradingViewMonitor.tsx`

- [ ] **Step 1: Add TradingView monitor**

Create `artifacts/trader-dashboard/src/components/account-bridge/TradingViewMonitor.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  DEFAULT_TRADING_VIEW_SYMBOL,
  DEFAULT_TRADING_VIEW_TIMEFRAME,
  TRADING_VIEW_PREF_KEY,
  TRADING_VIEW_TIMEFRAMES,
  mapBrokerSymbolToTradingView,
  normalizeTradingViewPreferences,
} from "./tradingViewConfig";

declare global {
  interface Window {
    TradingView?: {
      widget: new (config: Record<string, unknown>) => unknown;
    };
  }
}

function loadPrefs() {
  try {
    return normalizeTradingViewPreferences(JSON.parse(localStorage.getItem(TRADING_VIEW_PREF_KEY) ?? "null"));
  } catch {
    return { symbol: DEFAULT_TRADING_VIEW_SYMBOL, timeframe: DEFAULT_TRADING_VIEW_TIMEFRAME };
  }
}

export function TradingViewMonitor({ brokerSymbol }: { brokerSymbol?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [prefs, setPrefs] = useState(loadPrefs);
  const [loadError, setLoadError] = useState(false);

  const selectedSymbol = useMemo(
    () => prefs.symbol || mapBrokerSymbolToTradingView(brokerSymbol ?? "EURUSD"),
    [brokerSymbol, prefs.symbol],
  );

  useEffect(() => {
    localStorage.setItem(TRADING_VIEW_PREF_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    setLoadError(false);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => {
      if (!containerRef.current || !window.TradingView) return;
      containerRef.current.innerHTML = "";
      const targetId = `tradingview-account-${Date.now()}`;
      const target = document.createElement("div");
      target.id = targetId;
      target.style.height = "100%";
      containerRef.current.appendChild(target);
      new window.TradingView.widget({
        autosize: true,
        symbol: selectedSymbol,
        interval: prefs.timeframe,
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "it",
        enable_publishing: false,
        allow_symbol_change: true,
        container_id: targetId,
      });
    };
    script.onerror = () => setLoadError(true);
    document.body.appendChild(script);
    return () => {
      script.remove();
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [selectedSymbol, prefs.timeframe]);

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/30 px-3 py-2">
        <input
          value={prefs.symbol}
          onChange={(event) => setPrefs((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))}
          className="h-8 min-w-[140px] flex-1 rounded-lg border border-border bg-secondary/50 px-2 text-xs font-mono"
          aria-label="TradingView symbol"
        />
        <div className="flex gap-1 overflow-x-auto">
          {TRADING_VIEW_TIMEFRAMES.map((timeframe) => (
            <button
              key={timeframe}
              type="button"
              onClick={() => setPrefs((prev) => ({ ...prev, timeframe }))}
              className={`h-8 min-w-9 rounded-lg border px-2 text-[11px] font-bold ${
                prefs.timeframe === timeframe
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {timeframe}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPrefs({ symbol: mapBrokerSymbolToTradingView(brokerSymbol ?? "EURUSD"), timeframe: DEFAULT_TRADING_VIEW_TIMEFRAME })}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 text-muted-foreground hover:text-primary"
          title="Reset chart"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="relative h-[420px] min-h-[320px]">
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-destructive">
            TradingView non disponibile. Riprova tra poco.
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run dashboard typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: command exits `0` with no TypeScript errors.

---

### Task 10: Account Widget and Workspace UI

**Files:**
- Create: `artifacts/trader-dashboard/src/components/account-bridge/AccountBridgeWidget.tsx`
- Create: `artifacts/trader-dashboard/src/components/account-bridge/AccountBridgeWorkspace.tsx`

- [ ] **Step 1: Add compact widget**

Create `artifacts/trader-dashboard/src/components/account-bridge/AccountBridgeWidget.tsx`:

```tsx
import { Activity, Wallet, Wifi, WifiOff } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAccountBridgeSocket } from "./useAccountBridgeSocket";

export function AccountBridgeWidget() {
  const { snapshot } = useAccountBridgeSocket();
  const connected = snapshot.status === "connected";

  return (
    <Card className="relative overflow-hidden bg-card/60 backdrop-blur-sm border-border/30">
      <div className="widget-header">
        <div className="flex items-center gap-2.5">
          <div className="widget-icon bg-primary/10 border border-primary/20">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="widget-title">Conto Live</p>
            <p className="widget-subtitle">{snapshot.mode === "live" ? "Modalita live" : "Modalita demo"}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${
          connected ? "border-primary/30 bg-primary/10 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"
        }`}>
          {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {snapshot.status}
        </div>
      </div>
      <CardContent className="grid grid-cols-2 gap-2 p-4">
        <div className="metric-card">
          <span className="metric-label">Balance</span>
          <span className="metric-value">{snapshot.metrics.balance.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          <span className="metric-unit">{snapshot.metrics.currency}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Equity</span>
          <span className="metric-value">{snapshot.metrics.equity.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          <span className="metric-unit">{snapshot.metrics.currency}</span>
        </div>
        <div className="col-span-2 flex items-center justify-between rounded-xl border border-border/40 bg-secondary/30 px-3 py-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground"><Activity className="h-3.5 w-3.5" /> Posizioni aperte</span>
          <span className="font-mono font-bold">{snapshot.openTrades.length}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add workspace**

Create `artifacts/trader-dashboard/src/components/account-bridge/AccountBridgeWorkspace.tsx`:

```tsx
import { useMemo, useState } from "react";
import { AlertTriangle, Send, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccountBridgeSocket } from "./useAccountBridgeSocket";
import { TradingViewMonitor } from "./TradingViewMonitor";
import type { AccountOrderDraft } from "./types";

export function AccountBridgeWorkspace() {
  const { snapshot, lastError, lastOrderMessage, reconnect, sendOrder } = useAccountBridgeSocket();
  const [draft, setDraft] = useState<AccountOrderDraft>({ symbol: "EURUSD", direction: "buy", volume: 0.1 });
  const canSend = snapshot.status === "connected" && (snapshot.mode === "demo" || snapshot.orderEnabled);
  const primarySymbol = useMemo(() => snapshot.openTrades[0]?.symbol ?? draft.symbol, [snapshot.openTrades, draft.symbol]);

  const submit = () => {
    const label = snapshot.mode === "live" ? "Inviare ordine LIVE?" : "Inviare ordine demo?";
    if (!confirm(label)) return;
    sendOrder(draft);
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border px-4 py-3 text-sm ${
        snapshot.mode === "live" ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary/10 text-primary"
      }`}>
        {snapshot.mode === "live" ? "Conto live: ogni invio ordine richiede conferma." : "Demo adapter attivo: gli ordini sono simulati."}
      </div>

      {(lastError || snapshot.status !== "connected") && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span className="flex items-center gap-2"><WifiOff className="h-4 w-4" /> {lastError ?? snapshot.error ?? "Account bridge non connesso"}</span>
          <Button variant="outline" size="sm" onClick={reconnect}>Riconnetti</Button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Balance", snapshot.metrics.balance],
          ["Equity", snapshot.metrics.equity],
          ["Free margin", snapshot.metrics.freeMargin],
          ["Daily P/L", snapshot.metrics.dailyProfit],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border/40 bg-secondary/25 p-3">
            <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
            <p className="mt-1 font-mono text-lg font-bold">{Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-3 rounded-xl border border-border/40 bg-card/60 p-4">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Send className="h-4 w-4 text-primary" />
            Ticket ordine
          </div>
          <Input value={draft.symbol} onChange={(event) => setDraft((prev) => ({ ...prev, symbol: event.target.value.toUpperCase() }))} />
          <div className="grid grid-cols-2 gap-2">
            {(["buy", "sell"] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, direction }))}
                className={`h-10 rounded-xl border text-sm font-bold uppercase ${
                  draft.direction === direction
                    ? direction === "buy" ? "border-primary bg-primary/15 text-primary" : "border-destructive bg-destructive/15 text-destructive"
                    : "border-border/40 text-muted-foreground"
                }`}
              >
                {direction}
              </button>
            ))}
          </div>
          <Input type="number" step="0.01" value={draft.volume} onChange={(event) => setDraft((prev) => ({ ...prev, volume: Number(event.target.value) }))} />
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" step="any" placeholder="SL" onChange={(event) => setDraft((prev) => ({ ...prev, stopLoss: event.target.value ? Number(event.target.value) : undefined }))} />
            <Input type="number" step="any" placeholder="TP" onChange={(event) => setDraft((prev) => ({ ...prev, takeProfit: event.target.value ? Number(event.target.value) : undefined }))} />
          </div>
          <Button className="w-full gap-2" disabled={!canSend} onClick={submit}>
            <Send className="h-4 w-4" />
            {snapshot.mode === "live" ? "Invia live" : "Invia demo"}
          </Button>
          {lastOrderMessage && <p className="text-xs text-muted-foreground">{lastOrderMessage}</p>}
          {!snapshot.orderEnabled && snapshot.mode === "live" && (
            <p className="flex items-center gap-1.5 text-xs text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> Ordini live disabilitati dal server.</p>
          )}
        </div>

        <TradingViewMonitor brokerSymbol={primarySymbol} />
      </div>

      <div className="rounded-xl border border-border/40 bg-card/60 p-4">
        <p className="mb-3 text-sm font-bold">Posizioni aperte</p>
        <div className="space-y-2">
          {snapshot.openTrades.length === 0 && <p className="text-sm text-muted-foreground">Nessuna posizione aperta.</p>}
          {snapshot.openTrades.map((trade) => (
            <div key={trade.ticket} className="grid grid-cols-5 gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-xs">
              <span className="font-mono">{trade.symbol}</span>
              <span className={trade.direction === "buy" ? "text-primary" : "text-destructive"}>{trade.direction.toUpperCase()}</span>
              <span>{trade.volume}</span>
              <span>{trade.entryPrice}</span>
              <span className="truncate text-muted-foreground">{trade.ticket}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run dashboard typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: command exits `0` with no TypeScript errors.

---

### Task 11: Dashboard Integration

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx`
- Modify: `artifacts/trader-dashboard/src/components/dashboard-workspaces/WidgetWorkspaceContent.tsx`

- [ ] **Step 1: Register the account widget**

Modify `artifacts/trader-dashboard/src/pages/Dashboard.tsx`:

- Add `Wallet` to the `lucide-react` import list.
- Add `import { AccountBridgeWidget } from "@/components/account-bridge/AccountBridgeWidget";`.
- Add this widget definition to `WIDGET_DEFS`:

```ts
{ id: "account", label: "Conto Live", icon: Wallet, component: AccountBridgeWidget, colSpan: "sm:col-span-2 lg:col-span-2", workspaceSubtitle: "Connessione conto, ordini, import trade e monitor TradingView" },
```

- Add `"account"` near the start of `DEFAULT_ORDER` after `"clock"`.
- Add a desktop span:

```ts
account: "lg:col-span-4",
```

- [ ] **Step 2: Register workspace content**

Modify `artifacts/trader-dashboard/src/components/dashboard-workspaces/WidgetWorkspaceContent.tsx`:

- Add `import { AccountBridgeWorkspace } from "@/components/account-bridge/AccountBridgeWorkspace";`.
- Add this switch case:

```tsx
case "account":
  return <AccountBridgeWorkspace />;
```

- [ ] **Step 3: Run dashboard typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: command exits `0` with no TypeScript errors.

---

### Task 12: Verification and Runtime Smoke Test

**Files:**
- Verify existing workspace scripts and runtime behavior.

- [ ] **Step 1: Run targeted executable checks**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/validation.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/journalImport.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/demoAdapter.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/accountBridge/mt5Protocol.test.ts
```

Expected: each command prints its `checks passed` line and exits `0`.

- [ ] **Step 2: Run full typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: command exits `0` with no TypeScript errors.

- [ ] **Step 3: Run build**

Run:

```bash
pnpm -r --if-present run build
```

Expected: command exits `0`; Vite produces a dashboard build and API server build completes.

- [ ] **Step 4: Start local app**

Run:

```bash
pnpm run start:local
```

Expected: local API and dashboard start. Keep the process running for the browser smoke test.

- [ ] **Step 5: Browser smoke test**

In the dashboard:

- open the dashboard page;
- confirm `Conto Live` appears;
- open the account workspace drawer;
- confirm the socket state becomes demo/connected;
- send a demo `EURUSD` buy order with volume `0.1`;
- confirm an order acknowledgement appears;
- confirm the open positions section shows the demo ticket;
- change TradingView timeframe from `60` to `15`;
- refresh the page and confirm the selected timeframe persists.

- [ ] **Step 6: Database smoke test when `DATABASE_URL` is available**

Run:

```bash
pnpm --filter @workspace/db run push
```

Expected: Drizzle applies or confirms the `account_trades` schema.

Then trigger a demo closed-trade import from the workspace when that UI action is wired. Confirm:

- an `account_trades` row exists for the ticket;
- a journal entry exists with `account-import` tag;
- re-importing the same ticket reports already imported and does not create a duplicate journal entry.

---

## Plan Self-Review

Spec coverage:

- Account widget and workspace: Tasks 10 and 11.
- Server WebSocket endpoint: Task 7.
- Broker adapter interface and demo adapter: Tasks 2 and 4.
- MT5 local socket adapter: Task 5.
- Account trades table: Task 1.
- Journal import: Tasks 3 and 6.
- TradingView widget with symbol/timeframe controls: Tasks 8 and 9.
- Safety validation for live order sending: Task 2 and Task 7.
- Verification: Task 12.

Placeholder scan:

- The plan avoids placeholder tokens and gives concrete file paths, commands, and code blocks for each code-producing task.

Type consistency:

- Server domain types are defined in Task 2 and reused by Tasks 3 through 7.
- Frontend account types are defined in Task 8 and reused by Tasks 9 through 11.
- TradingView preference constants are defined in Task 8 and reused by Task 9.

