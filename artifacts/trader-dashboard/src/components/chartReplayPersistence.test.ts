import assert from "node:assert/strict";
import { DEFAULT_CHART_ANALYSIS_STATE } from "./chartAnalysisTypes.js";
import {
  createReplaySavedTradeIdsStorageKey,
  createReplayStorageKey,
  parsePersistedReplayState,
  parseReplaySavedTradeIds,
  serializeReplaySavedTradeIds,
  serializeReplayState,
} from "./chartReplayPersistence.js";

const payload = serializeReplayState({
  symbol: "EUR/USD",
  activeInterval: "H1",
  startDate: "2026-02-01",
  revealedCount: 150,
  startIndex: 12,
  balance: 10042.5,
  lotSize: "0.10",
  trades: [
    { id: 1, direction: "buy", entryPrice: 1.1, entryIndex: 120, exitPrice: 1.105, exitIndex: 130, result: "win", pips: 50 },
  ],
  openTrade: { id: 2, direction: "sell", entryPrice: 1.2, entryIndex: 145 },
  analysisState: {
    ...DEFAULT_CHART_ANALYSIS_STATE,
    indicators: {
      ...DEFAULT_CHART_ANALYSIS_STATE.indicators,
      vwap: { ...DEFAULT_CHART_ANALYSIS_STATE.indicators.vwap, enabled: false },
    },
  },
});

assert.equal(createReplayStorageKey("session-7"), "traderloading:chart-replay:session-7");
assert.equal(createReplaySavedTradeIdsStorageKey("session-7"), "traderloading:chart-replay:saved-trades:session-7");

const restored = parsePersistedReplayState(payload, "EUR/USD");
assert.equal(restored?.symbol, "EUR/USD");
assert.equal(restored?.activeInterval, "H1");
assert.equal(restored?.revealedCount, 150);
assert.equal(restored?.trades.length, 1);
assert.equal(restored?.openTrade?.direction, "sell");
assert.equal(restored?.analysisState?.indicators.vwap.enabled, false);

assert.equal(parsePersistedReplayState(payload, "GBP/USD"), null);
assert.equal(parsePersistedReplayState("{bad json", "EUR/USD"), null);
assert.equal(parsePersistedReplayState(JSON.stringify({ version: 999 }), "EUR/USD"), null);

assert.deepEqual(parseReplaySavedTradeIds(serializeReplaySavedTradeIds(new Set([3, 2, 3, 1]))), new Set([1, 2, 3]));
assert.deepEqual(parseReplaySavedTradeIds("{bad json"), new Set());
assert.deepEqual(parseReplaySavedTradeIds(JSON.stringify(["1", 2, -1, 0, 2.5])), new Set([2]));

console.log("chart replay persistence checks passed");
