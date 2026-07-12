import assert from "node:assert/strict";
import { defaultIndicators } from "./indicatorCatalog";
import {
  createTerminalStorageKey,
  DEFAULT_TERMINAL_SETTINGS,
  DEFAULT_TICKET,
  parseTerminalState,
  serializeTerminalState,
  type TerminalStateDraft,
} from "./terminalPersistence";
import type { ClosedTrade, OpenPosition, ReplayDrawing } from "./types";

const trade: ClosedTrade = {
  id: 3,
  direction: "sell",
  entryPrice: 1.2,
  exitPrice: 1.19,
  entryTime: 100,
  exitTime: 200,
  stopLoss: 1.21,
  takeProfit: 1.18,
  lots: 0.2,
  pips: 100,
  profit: 200,
  rMultiple: 1,
  exitReason: "manual",
  result: "win",
};

const position: OpenPosition = {
  direction: "buy",
  entryPrice: 1.1,
  entryTime: 300,
  stopLoss: 1.098,
  takeProfit: 1.104,
  lots: 0.5,
  riskAmount: 100,
  slPips: 20,
  tpPips: 40,
};

const drawings: ReplayDrawing[] = [
  { id: "d1", kind: "hline", price: 1.15, color: "#3b82f6", width: 2 },
  { id: "d2", kind: "trend", a: { time: 100, price: 1.1 }, b: { time: 200, price: 1.2 }, color: "#f59e0b", width: 1 },
];

const draft: TerminalStateDraft = {
  symbol: "EURUSD",
  interval: "H1",
  cursorTime: 1_700_000_000,
  indicators: defaultIndicators(),
  drawings,
  trades: [trade],
  openPosition: position,
  ticket: { riskMode: "fixed", riskValue: 150, slPips: 25, tpPips: 50 },
  settings: { ...DEFAULT_TERMINAL_SETTINGS, chartType: "heikin", magnet: false },
  initialBalance: 10_000,
};

// storage key namespaced per session
assert.equal(createTerminalStorageKey("42"), "traderloading:backtest-terminal:42");

// round-trip
const parsed = parseTerminalState(serializeTerminalState(draft), "EURUSD");
assert.ok(parsed);
assert.equal(parsed?.version, 2);
assert.equal(parsed?.interval, "H1");
assert.equal(parsed?.cursorTime, 1_700_000_000);
assert.deepEqual(parsed?.trades, [trade]);
assert.deepEqual(parsed?.openPosition, position);
assert.deepEqual(parsed?.drawings, drawings);
assert.deepEqual(parsed?.ticket, draft.ticket);
assert.equal(parsed?.settings.chartType, "heikin");
assert.equal(parsed?.settings.magnet, false);
assert.equal(parsed?.initialBalance, 10_000);
assert.equal(parsed?.indicators.length, 3);

// symbol mismatch → null (state from another instrument must not leak in)
assert.equal(parseTerminalState(serializeTerminalState(draft), "GBPUSD"), null);

// garbage and version mismatches → null
assert.equal(parseTerminalState(null, "EURUSD"), null);
assert.equal(parseTerminalState("not json", "EURUSD"), null);
assert.equal(parseTerminalState(JSON.stringify({ version: 1, symbol: "EURUSD" }), "EURUSD"), null);

// malformed collections are dropped, not fatal
const tampered = JSON.parse(serializeTerminalState(draft)) as Record<string, unknown>;
tampered.trades = [{ nonsense: true }, trade];
tampered.drawings = [{ id: "x" }, ...drawings];
tampered.indicators = "boom";
const rescued = parseTerminalState(JSON.stringify(tampered), "EURUSD");
assert.ok(rescued);
assert.deepEqual(rescued?.trades, [trade]);
assert.deepEqual(rescued?.drawings, drawings);
assert.deepEqual(rescued?.indicators, []);

// defaults are sane
assert.equal(DEFAULT_TICKET.riskMode, "percent");
assert.ok(DEFAULT_TICKET.slPips > 0 && DEFAULT_TICKET.tpPips > 0);
assert.equal(DEFAULT_TERMINAL_SETTINGS.chartType, "candles");
assert.equal(DEFAULT_TERMINAL_SETTINGS.magnet, true);
assert.ok(DEFAULT_TERMINAL_SETTINGS.toolWidth >= 1);

// no open position / empty journal round-trips
const flatDraft: TerminalStateDraft = { ...draft, openPosition: null, trades: [], cursorTime: null };
const flat = parseTerminalState(serializeTerminalState(flatDraft), "EURUSD");
assert.equal(flat?.openPosition, null);
assert.deepEqual(flat?.trades, []);
assert.equal(flat?.cursorTime, null);

console.log("terminalPersistence checks passed");
