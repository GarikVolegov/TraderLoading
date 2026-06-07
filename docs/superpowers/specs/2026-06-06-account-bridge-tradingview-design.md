# Account Bridge and TradingView Monitor Design

## Context

TraderLoadings currently has:

- a React/Vite dashboard with draggable widgets and workspace drawers;
- an Express API server;
- `ws` already available in the API server dependencies;
- journal entries stored through `/api/journal`;
- backtest trades and candle tooling;
- dashboard widgets that can be extended through the existing widget registry.

The goal is to add a personal account connection tool that can read account/trade data, send operations, feed journal/statistics, and show a TradingView chart with a selectable timeframe for continuous monitoring.

## Scope

This feature adds an Account Bridge system with:

- a dashboard widget called `Conto Live`;
- a workspace drawer for account status, positions, order entry, imported trades, and the TradingView chart;
- a server-side WebSocket endpoint for live account state and order events;
- a broker adapter interface, with `mt5-local-socket` as the first real adapter target;
- an explicit demo adapter used when no real bridge is configured;
- import of closed account trades into journal-compatible data;
- a TradingView Advanced Chart widget with symbol and timeframe controls.

This design does not implement an undocumented TradingView socket for trading or data scraping. TradingView is used through the official embeddable widget pattern for chart monitoring. The account socket is owned by this app and by the broker bridge.

## User Experience

The dashboard gains a `Conto Live` widget.

The compact widget shows:

- connection state: demo, offline, connecting, connected, error;
- account mode: demo or live;
- balance, equity, free margin, and daily P/L when available;
- number of open positions;
- selected chart symbol and timeframe.

Opening the widget drawer shows:

- account connection banner;
- account metrics;
- open positions table;
- protected order ticket;
- recent closed trades and import state;
- TradingView chart panel with symbol and timeframe selectors.

The order ticket requires an explicit confirmation before sending any live order. In demo mode, the UI labels every order as simulated.

## Architecture

### Server Components

`accountBridgeService`

- owns the active account adapter;
- exposes current account snapshot;
- broadcasts snapshot and events to WebSocket clients;
- receives order requests from WebSocket clients;
- normalizes broker trade payloads into app-level account trades;
- imports closed trades into journal entries when import is enabled.

`AccountAdapter`

The adapter interface is the boundary between the app and a broker/terminal bridge.

```ts
type AccountConnectionMode = "demo" | "live";
type AccountConnectionStatus = "offline" | "connecting" | "connected" | "error";

interface AccountAdapter {
  readonly id: string;
  readonly mode: AccountConnectionMode;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getSnapshot(): Promise<AccountSnapshot>;
  placeOrder(order: AccountOrderRequest): Promise<AccountOrderResult>;
  onEvent(listener: (event: AccountBridgeEvent) => void): () => void;
}
```

`demoAccountAdapter`

- provides deterministic account data for development;
- simulates account updates, positions, order acknowledgement, and closed trade events;
- never represents itself as live.

`mt5LocalSocketAdapter`

- connects to a local MT5 bridge through host/port environment variables;
- sends JSON messages for account snapshot, positions, history, and order commands;
- handles reconnects and bridge errors;
- is disabled unless explicit environment configuration exists.

Environment variables:

- `ACCOUNT_BRIDGE_ADAPTER=demo | mt5-local-socket`;
- `ACCOUNT_BRIDGE_MODE=demo | live`;
- `ACCOUNT_BRIDGE_HOST`, default `127.0.0.1`;
- `ACCOUNT_BRIDGE_PORT`, default `8765`;
- `ACCOUNT_BRIDGE_IMPORT_JOURNAL=true | false`;
- `ACCOUNT_BRIDGE_ORDER_ENABLED=true | false`.

Live order sending requires both `ACCOUNT_BRIDGE_MODE=live` and `ACCOUNT_BRIDGE_ORDER_ENABLED=true`.

### WebSocket Endpoint

The API server will create an HTTP server explicitly, then attach a WebSocket server to it.

Endpoint:

- `/api/account/ws`

Client to server messages:

- `subscribe`: request the current account snapshot;
- `refresh`: force adapter snapshot refresh;
- `place_order`: submit a protected order request;
- `import_trade`: manually import a closed trade into journal;
- `set_preferences`: update per-client symbol/timeframe/import preferences where applicable.

Server to client messages:

- `snapshot`: full account state;
- `account_update`: account metric update;
- `positions_update`: open positions update;
- `trade_closed`: closed trade event;
- `order_ack`: order accepted by adapter;
- `order_rejected`: order rejected by validation or adapter;
- `journal_imported`: journal entry created from a closed trade;
- `error`: recoverable socket or adapter error.

Messages are JSON and include a `type`, `requestId` when relevant, and a server timestamp.

### Data Model

The implementation adds an `account_trades` table as the authoritative store for imported broker trades. This prevents duplicate imports and gives statistics a stable source of account-linked data.

`account_trades` fields:

- `id`: local primary key;
- `ticket`: broker ticket or adapter-generated trade id;
- `source`: `demo` or `mt5`;
- `symbol`;
- `direction`: `buy` or `sell`;
- `volume`;
- `openTime`;
- `closeTime`;
- `entryPrice`;
- `exitPrice`;
- `stopLoss`;
- `takeProfit`;
- `profit`;
- `commission`;
- `swap`;
- `status`: `open` or `closed`;
- `journalEntryId`: nullable reference to the journal entry created from this trade;
- `userId`;
- `createdAt`;
- `updatedAt`.

The unique key is `(source, ticket, userId)`. A repeated broker event updates the existing row instead of creating a duplicate.

Closed account trades can create journal entries. The imported entry uses:

- `title`: `${symbol} ${direction.toUpperCase()} account trade`;
- `tradeDate`: close time date if available, otherwise open time date;
- `result`: `win`, `loss`, or `breakeven` based on realized P/L;
- `tags`: `account-import,MT5,<symbol>,<direction>`;
- `content`: structured readable summary with ticket, volume, entry, exit, SL, TP, P/L, commission, swap, and source adapter.

The `journalEntryId` on `account_trades` prevents duplicate journal entries. Re-importing an already-linked closed trade reports it as already imported.

The normalized account trade shape:

```ts
interface AccountTrade {
  ticket: string;
  symbol: string;
  direction: "buy" | "sell";
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
```

### Frontend Components

`AccountBridgeWidget`

- compact dashboard widget;
- subscribes to account WebSocket;
- displays connection status and key account metrics;
- opens the account workspace drawer through the existing dashboard widget system.

`AccountBridgeWorkspace`

- larger operational view inside `DashboardWorkspaceDrawer`;
- includes metrics, positions, order ticket, recent imports, and TradingView monitor;
- handles reconnect and visible error states.

`TradingViewMonitor`

- embeds the TradingView Advanced Chart widget;
- allows selecting symbol and timeframe;
- persists preferences in localStorage;
- remounts the widget when symbol or timeframe changes.

Default chart preferences:

- symbol: `FX:EURUSD`;
- timeframe: `60`;
- available timeframes: `1`, `5`, `15`, `30`, `60`, `240`, `D`, `W`.

Symbol mapping is intentionally separate from broker symbols. For example, broker `EURUSD` maps to TradingView `FX:EURUSD`; broker `XAUUSD` maps to `OANDA:XAUUSD` or another configured default.

## Validation and Safety

Order validation happens on both frontend and server:

- symbol is required;
- direction must be `buy` or `sell`;
- volume must be positive;
- SL and TP are optional but must be positive prices when present;
- live orders are rejected unless live mode and order enabled are both configured;
- every order request receives an acknowledgement or rejection.

The frontend must not show a live-enabled order button unless the server snapshot confirms live order capability.

The demo adapter must be visually distinct from live mode.

## Error Handling

Connection errors:

- frontend shows offline/error state and a reconnect action;
- server attempts reconnects for the MT5 socket adapter;
- demo adapter can be selected to keep the UI testable.

Order errors:

- invalid input returns `order_rejected`;
- adapter failure returns `order_rejected` with a readable reason;
- socket disconnect disables order submission until connected again.

Journal import errors:

- failed imports are shown in the workspace;
- existing journal entries remain unchanged;
- duplicate imports are skipped and reported as already imported.

TradingView errors:

- if script/widget loading fails, the chart area shows a retry state;
- symbol/timeframe controls remain available.

## Testing Strategy

Server tests:

- adapter validation rejects live orders when live mode is not enabled;
- demo adapter emits snapshots and order events;
- closed demo trade can be transformed into a journal entry payload;
- duplicate import detection prevents repeated journal entries;
- WebSocket message validation rejects malformed order requests.

Frontend tests or focused type checks:

- widget renders demo/offline/connected states;
- order ticket disables send when server says orders are disabled;
- TradingView monitor computes widget config from symbol/timeframe preferences;
- dashboard registry includes the new account widget.

Manual verification:

- start local app;
- open dashboard;
- confirm `Conto Live` appears;
- open drawer and observe account snapshot updates;
- change TradingView timeframe and confirm the widget remounts;
- place demo order and observe acknowledgement;
- close/import demo trade and confirm journal receives the entry;
- run typecheck/build.

## Implementation Notes

The feature should be implemented incrementally:

1. Add shared account bridge types and pure validation/import helpers.
2. Add server service and demo adapter.
3. Attach `/api/account/ws` to the API server HTTP server.
4. Add dashboard widget and workspace UI.
5. Add TradingView monitor with symbol/timeframe controls.
6. Wire closed trade import into journal.
7. Add MT5 local socket adapter behind environment flags.

No production order flow should default to live. The first runnable state should be demo by default, with live sending requiring explicit environment configuration.
