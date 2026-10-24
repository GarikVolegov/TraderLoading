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
  syncId: "b9f78dab-1e8f-4d30-9411-b24a6ce81a45",
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
  tags: ["breakout", "london"],
  note: "clean retest",
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
  hasStop: true,
};

const drawings: ReplayDrawing[] = [
  { id: "d1", kind: "hline", price: 1.15, color: "#3b82f6", width: 2 },
  { id: "d2", kind: "trend", a: { time: 100, price: 1.1 }, b: { time: 200, price: 1.2 }, color: "#f59e0b", width: 1 },
  { id: "d3", kind: "ray", a: { time: 150, price: 1.12 }, b: { time: 250, price: 1.22 }, color: "#10b981", width: 2 },
  { id: "d4", kind: "arrow", a: { time: 180, price: 1.14 }, b: { time: 220, price: 1.18 }, color: "#ec4899", width: 2 },
  { id: "d5", kind: "vline", time: 190, color: "#8b5cf6", width: 1 },
  { id: "d6", kind: "hray", at: { time: 195, price: 1.16 }, color: "#22d3ee", width: 2 },
  { id: "d7", kind: "arrowUp", at: { time: 196, price: 1.13 }, color: "#089981", width: 2, text: "Buy" },
  { id: "d8", kind: "arrowDown", at: { time: 198, price: 1.19 }, color: "#f23645", width: 2, text: "Sell" },
  { id: "d9", kind: "path", points: [{ time: 120, price: 1.11 }, { time: 160, price: 1.15 }, { time: 210, price: 1.13 }], color: "#a855f7", width: 2 },
  { id: "d10", kind: "highlighter", points: [{ time: 130, price: 1.12 }, { time: 170, price: 1.14 }], color: "#eab308", width: 4 },
  { id: "d11", kind: "frvp", a: { time: 100, price: 1.1 }, b: { time: 220, price: 1.2 }, color: "#3b82f6", width: 2 },
  { id: "d12", kind: "rect", a: { time: 100, price: 1.1 }, b: { time: 200, price: 1.2 }, color: "#3b82f6", width: 1, showMidline: true, extendRight: true, fillOpacity: 0.25 },
];

const draft: TerminalStateDraft = {
  symbol: "EURUSD",
  interval: "H1",
  cursorTime: 1_700_000_000,
  indicators: defaultIndicators(),
  drawings,
  trades: [trade],
  openPosition: position,
  pendingOrder: null,
  ticket: { riskMode: "fixed", riskValue: 150, slPips: 25, tpPips: 50, breakevenAtR: null, trailingPips: null },
  settings: { ...DEFAULT_TERMINAL_SETTINGS, chartType: "heikin", magnet: false },
  initialBalance: 10_000,
};

// storage key namespaced per session
assert.equal(createTerminalStorageKey("42"), "traderloading:backtest-terminal:42");

// round-trip
const parsed = parseTerminalState(serializeTerminalState(draft), "EURUSD");
assert.ok(parsed);
assert.equal(parsed?.version, 3);
assert.equal(parsed?.interval, "H1");
assert.equal(parsed?.cursorTime, 1_700_000_000);
assert.equal(parsed?.replayTime, 1_700_003_600, "v2-style cursor input migrates from bar open to observation cutoff");
const exactDraft = { ...draft, replayTime: 1_700_001_200, startTime: 1_600_000_000 };
const exact = parseTerminalState(serializeTerminalState(exactDraft), "EURUSD");
assert.equal(exact?.replayTime, 1_700_001_200, "v3 exact clock must never add the current timeframe");
assert.equal(exact?.startTime, 1_600_000_000);
const legacyV2 = JSON.parse(serializeTerminalState(draft));
legacyV2.version = 2;
delete legacyV2.replayTime;
delete legacyV2.startTime;
assert.equal(parseTerminalState(JSON.stringify(legacyV2), "EURUSD")?.replayTime, 1_700_003_600);
assert.deepEqual(parsed?.trades, [trade]);
assert.deepEqual(parsed?.openPosition, position);
assert.deepEqual(parsed?.drawings, drawings);
assert.deepEqual(parsed?.ticket, draft.ticket);
assert.equal(parsed?.settings.chartType, "heikin");
assert.equal(parsed?.settings.magnet, false);
assert.equal(parsed?.settings.showTradesOnChart, true);
assert.equal(parsed?.settings.tradeLineMode, "hover_or_latest");
assert.equal(parsed?.settings.candleUpColor, "#c5a059");
assert.equal(parsed?.settings.showOhlcLegend, true);
assert.equal(parsed?.settings.priceScaleMode, "normal");
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

// pending order round-trips; malformed → null
const withPending: TerminalStateDraft = {
  ...draft,
  openPosition: null,
  pendingOrder: {
    direction: "buy",
    kind: "limit",
    price: 1.085,
    slPips: 20,
    tpPips: 40,
    lots: 0.5,
    riskAmount: 100,
    placedTime: 1_700_000_000,
  },
};
const pendingParsed = parseTerminalState(serializeTerminalState(withPending), "EURUSD");
assert.deepEqual(pendingParsed?.pendingOrder, withPending.pendingOrder);
const badPending = JSON.parse(serializeTerminalState(withPending)) as Record<string, unknown>;
(badPending.pendingOrder as Record<string, unknown>).kind = "bogus";
assert.equal(parseTerminalState(JSON.stringify(badPending), "EURUSD")?.pendingOrder, null);
assert.equal(flat?.pendingOrder, null);

console.log("terminalPersistence checks passed");

// ── ticket rules + named profiles + chart templates ─────────────────────────
{
  const {
    parseTerminalState: parseState,
    serializeTerminalState: serializeState,
    parseTicketProfiles,
    serializeTicketProfiles,
    parseChartTemplates,
    serializeChartTemplates,
    createTicketProfilesStorageKey,
    createChartTemplateStorageKey,
    DEFAULT_TICKET: DT,
  } = await import("./terminalPersistence");

  // ticket BE/trailing rules round-trip (and default to null = off)
  assert.equal(DT.breakevenAtR, null);
  assert.equal(DT.trailingPips, null);
  const withRules = {
    ...draft,
    ticket: { ...draft.ticket, breakevenAtR: 1.5, trailingPips: 25 },
  };
  const parsedRules = parseState(serializeState(withRules), "EURUSD");
  assert.equal(parsedRules?.ticket.breakevenAtR, 1.5);
  assert.equal(parsedRules?.ticket.trailingPips, 25);
  // legacy state without the fields → null
  const legacy = JSON.parse(serializeState(draft)) as Record<string, unknown>;
  delete (legacy.ticket as Record<string, unknown>).breakevenAtR;
  delete (legacy.ticket as Record<string, unknown>).trailingPips;
  const parsedLegacy = parseState(JSON.stringify(legacy), "EURUSD");
  assert.equal(parsedLegacy?.ticket.breakevenAtR, null);

  // named ticket profiles (Scalper / Swing …): global, validated per entry
  assert.equal(createTicketProfilesStorageKey(), "traderloading:backtest-terminal:ticket-profiles");
  const profiles = {
    Scalper: { riskMode: "percent" as const, riskValue: 0.5, slPips: 8, tpPips: 12, breakevenAtR: 1, trailingPips: 6 },
    Swing: { riskMode: "fixed" as const, riskValue: 200, slPips: 60, tpPips: 180, breakevenAtR: null, trailingPips: null },
  };
  const roundTripped = parseTicketProfiles(serializeTicketProfiles(profiles));
  assert.deepEqual(roundTripped, profiles);
  assert.deepEqual(parseTicketProfiles(null), {});
  assert.deepEqual(parseTicketProfiles("boom"), {});
  const dirty = JSON.parse(serializeTicketProfiles(profiles)) as { profiles: Record<string, unknown> };
  dirty.profiles.Broken = { riskMode: 42 };
  const rescuedProfiles = parseTicketProfiles(JSON.stringify(dirty));
  assert.deepEqual(Object.keys(rescuedProfiles).sort(), ["Broken", "Scalper", "Swing"]);
  assert.equal(rescuedProfiles.Broken.riskMode, "percent", "malformed entries degrade to defaults");

  // chart templates: indicators + settings, session-independent
  assert.equal(createChartTemplateStorageKey(), "traderloading:backtest-terminal:chart-templates");
  const templates = {
    "Momentum": { indicators: draft.indicators, settings: draft.settings },
  };
  const parsedTemplates = parseChartTemplates(serializeChartTemplates(templates));
  assert.deepEqual(parsedTemplates.Momentum.indicators, draft.indicators);
  assert.equal(parsedTemplates.Momentum.settings.chartType, draft.settings.chartType);
  assert.deepEqual(parseChartTemplates(null), {});
  const dirtyTemplates = JSON.parse(serializeChartTemplates(templates)) as { templates: Record<string, unknown> };
  dirtyTemplates.templates.Bad = { indicators: "nope", settings: 7 };
  const rescuedTemplates = parseChartTemplates(JSON.stringify(dirtyTemplates));
  assert.deepEqual(rescuedTemplates.Bad.indicators, []);
  assert.equal(rescuedTemplates.Bad.settings.chartType, "candles");
}
