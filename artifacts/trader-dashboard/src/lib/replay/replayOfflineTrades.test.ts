import test from "node:test";
import assert from "node:assert/strict";
import {
  createPendingTradesStorageKey,
  parsePendingTrades,
  serializePendingTrades,
} from "./replayOfflineTrades.js";
import type { ClosedTrade } from "./types.js";

const sampleTrade: ClosedTrade = {
  id: 1,
  direction: "buy",
  entryPrice: 1.085,
  entryTime: 1700000000,
  exitPrice: 1.09,
  exitTime: 1700003600,
  stopLoss: 1.08,
  takeProfit: 1.095,
  lots: 1.0,
  pips: 50,
  profit: 500,
  result: "win",
  exitReason: "tp",
  slPips: 50,
  tpPips: 100,
  syncId: "req-12345",
};

test("createPendingTradesStorageKey generates deterministic keys per session", () => {
  assert.equal(
    createPendingTradesStorageKey(42),
    "traderloading:backtest-pending-trades:42",
  );
  assert.equal(
    createPendingTradesStorageKey("alpha"),
    "traderloading:backtest-pending-trades:alpha",
  );
});

test("parsePendingTrades handles null, empty string and corrupt data gracefully", () => {
  assert.equal(parsePendingTrades(null).size, 0);
  assert.equal(parsePendingTrades("").size, 0);
  assert.equal(parsePendingTrades("not-json").size, 0);
  assert.equal(parsePendingTrades("{}").size, 0);
  assert.equal(parsePendingTrades("123").size, 0);
});

test("serializePendingTrades and parsePendingTrades round-trip accurately", () => {
  const map = new Map<string, ClosedTrade>();
  map.set("req-12345", sampleTrade);

  const serialized = serializePendingTrades(map);
  const parsed = parsePendingTrades(serialized);

  assert.equal(parsed.size, 1);
  const retrieved = parsed.get("req-12345");
  assert.ok(retrieved);
  assert.equal(retrieved.id, 1);
  assert.equal(retrieved.direction, "buy");
  assert.equal(retrieved.entryPrice, 1.085);
  assert.equal(retrieved.profit, 500);
});
