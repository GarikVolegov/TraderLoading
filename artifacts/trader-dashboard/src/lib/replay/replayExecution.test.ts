import assert from "node:assert/strict";
import { simulateReplayExecution } from "./replayExecution";
import { openPosition } from "./tradeEngine";
import type { PendingOrder, ReplayCandle } from "./types";

const position = openPosition({ direction: "buy", entryPrice: 70, entryTime: 120,
  slPips: 20, tpPips: 40, lots: 0.5, riskAmount: 100, symbol: "USOIL" });
const bar = (time: number, low: number, high: number): ReplayCandle => ({ time, open: 70, low, high, close: 70.1 });
const rules = { breakevenAtR: null, trailingPips: null };
let loadedPages = 0;
async function* history() {
  loadedPages++;
  yield [bar(120, 69.9, 70.2), bar(180, 69.7, 70.2)];
  loadedPages++;
  yield [bar(240, 68, 72)];
}

// Chart interval never enters execution: H4 and M1 transports with the same
// market cutoff stop at the same observed minute and never fetch later pages.
const result = await simulateReplayExecution({ pages: history(), position, pendingOrder: null, symbol: "USOIL", targetTime: 14400, rules });
assert.equal(result.exit?.exitReason, "sl");
assert.equal(result.exit?.exitPrice, 69.8);
assert.equal(result.finalTime, 240);
assert.equal(loadedPages, 1, "a stop short-circuits a long scrub without loading all future data");
assert.equal(position.bestPips, 0, "caller-owned position remains unchanged");

const order: PendingOrder = { direction: "buy", kind: "limit", price: 70, placedTime: 120,
  slPips: 20, tpPips: 40, lots: 0.5, riskAmount: 100 };
async function* pendingHistory() { yield [{ ...bar(120, 69, 70.5), open: 70.2 }, bar(180, 69.9, 70.2)]; }
const filled = await simulateReplayExecution({ pages: pendingHistory(), position: null, pendingOrder: order, symbol: "USOIL", targetTime: 240, rules });
assert.equal(filled.position?.entryTime, 180);
assert.equal(filled.exit, null, "pre-fill extrema of the fill minute cannot stop a position retroactively");
assert.equal(filled.pendingOrder, null);

async function* gapHistory() { yield [{ time: 120, open: 69, low: 68, high: 69.5, close: 69 }]; }
const gap = await simulateReplayExecution({ pages: gapHistory(), position: null, pendingOrder: order, symbol: "USOIL", targetTime: 240, rules });
assert.equal(gap.position?.entryTime, 120);
assert.equal(gap.exit?.exitReason, "sl", "a known gap fill at the open is protected during the same minute");
assert.equal(gap.exit?.exitPrice, 68.8);
assert.equal(gap.finalTime, 180);

async function* failingHistory() { yield [bar(120, 69.9, 70.2)]; throw new Error("network offline"); }
await assert.rejects(simulateReplayExecution({ pages: failingHistory(), position, pendingOrder: null, symbol: "USOIL", targetTime: 240, rules }), /network offline/);
assert.equal(position.bestPips, 0, "a failed page cannot persist half of a transport move");

const controller = new AbortController();
async function* abortedHistory() { controller.abort(); yield [bar(120, 68, 72)]; }
await assert.rejects(simulateReplayExecution({ pages: abortedHistory(), position, pendingOrder: null, symbol: "USOIL", targetTime: 240, rules, signal: controller.signal }), /aborted/i);
assert.equal(position.bestPips, 0);

// Multi-position execution: two positions (one stopped, one survives)
async function* multiHistory() {
  yield [bar(120, 69.9, 70.2), bar(180, 69.7, 70.2)];
  yield [bar(240, 69.6, 70.5)];
}
const p1 = openPosition({ id: "pos-1", direction: "buy", entryPrice: 70, entryTime: 120, slPips: 20, tpPips: 40, lots: 0.5, riskAmount: 100, symbol: "USOIL" });
const p2 = openPosition({ id: "pos-2", direction: "buy", entryPrice: 70, entryTime: 120, slPips: 50, tpPips: 100, lots: 0.2, riskAmount: 100, symbol: "USOIL" });
const multiResult = await simulateReplayExecution({ pages: multiHistory(), positions: [p1, p2], symbol: "USOIL", targetTime: 14400, rules });
assert.equal(multiResult.exits.length, 1);
assert.equal(multiResult.exits[0].exitReason, "sl");
assert.equal(multiResult.positions.length, 1, "p2 survived because its wider SL was not hit");
assert.equal(multiResult.positions[0].id, "pos-2");

// Fallback candles check: when M1 stream is empty, pending orders fill against fallbackCandles
async function* emptyPages() { /* yields nothing */ }
const pendingFallbackOrder: PendingOrder = {
  id: "ord-fallback",
  direction: "buy",
  kind: "limit",
  price: 69.5,
  placedTime: 100,
  slPips: 20,
  tpPips: 60,
  lots: 1,
  riskAmount: 100,
};
const fallbackCandle: ReplayCandle = { time: 160, open: 70, high: 70.2, low: 69.2, close: 69.8 };
const fallbackResult = await simulateReplayExecution({
  pages: emptyPages(),
  fallbackCandles: [fallbackCandle],
  pendingOrders: [pendingFallbackOrder],
  symbol: "USOIL",
  targetTime: 180,
  rules,
});
assert.equal(fallbackResult.positions.length, 1, "pending order filled via fallback candle");
assert.equal(fallbackResult.pendingOrders.length, 0, "no remaining pending orders");
assert.equal(fallbackResult.event?.kind, "fill");

// Auto-cancellation test: Pending Sell Limit order cancelled when price reaches Take Profit without retest
const sellLimitOrder: PendingOrder = {
  id: "ord-missed-sell",
  direction: "sell",
  kind: "limit",
  price: 72.0, // resting above
  takeProfit: 68.0, // target below
  stopLoss: 73.0,
  placedTime: 100,
  slPips: 10,
  tpPips: 40,
  lots: 1,
  riskAmount: 100,
};

// Candle drops straight from 70.0 to 67.5 (hits TP at 68.0, never bounces up to 72.0)
const missedCandle: ReplayCandle = { time: 160, open: 70.0, high: 70.5, low: 67.5, close: 67.8 };
const missedResult = await simulateReplayExecution({
  pages: emptyPages(),
  fallbackCandles: [missedCandle],
  pendingOrders: [sellLimitOrder],
  symbol: "USOIL",
  targetTime: 180,
  rules,
});

assert.equal(missedResult.pendingOrders.length, 0, "pending order cancelled because TP reached before retest");
assert.equal(missedResult.positions.length, 0, "no position opened");
assert.equal(missedResult.event?.kind, "cancel_tp", "event kind is cancel_tp");

console.log("replayExecution checks passed");
