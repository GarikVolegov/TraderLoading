import assert from "node:assert/strict";
import { checkStopHit, closePosition, openPosition, positionPips, unrealizedProfit } from "./tradeEngine";
import type { ReplayCandle } from "./types";

function bar(partial: Partial<ReplayCandle>): ReplayCandle {
  return { time: 0, open: 1.1, high: 1.1, low: 1.1, close: 1.1, ...partial };
}

// ── openPosition: SL/TP prices from pips ─────────────────────────────────────
const buy = openPosition({
  direction: "buy",
  entryPrice: 1.1,
  entryTime: 1_000,
  slPips: 20,
  tpPips: 40,
  lots: 0.5,
  riskAmount: 100,
  symbol: "EURUSD",
});
assert.equal(buy.stopLoss.toFixed(5), "1.09800");
assert.equal(buy.takeProfit.toFixed(5), "1.10400");
assert.equal(buy.lots, 0.5);
assert.equal(buy.entryTime, 1_000);

const sell = openPosition({
  direction: "sell",
  entryPrice: 156.5,
  entryTime: 2_000,
  slPips: 30,
  tpPips: 60,
  lots: 0.1,
  riskAmount: 30,
  symbol: "USDJPY",
});
assert.equal(sell.stopLoss.toFixed(3), "156.800"); // 30 pips × 0.01
assert.equal(sell.takeProfit.toFixed(3), "155.900");

// ── checkStopHit ─────────────────────────────────────────────────────────────
// buy: low touches SL
assert.deepEqual(checkStopHit(buy, bar({ low: 1.0979, high: 1.1001 })), {
  exitPrice: buy.stopLoss,
  exitReason: "sl",
});
// buy: high touches TP
assert.deepEqual(checkStopHit(buy, bar({ low: 1.0999, high: 1.1041 })), {
  exitPrice: buy.takeProfit,
  exitReason: "tp",
});
// buy: both in the same bar → conservative SL-first
assert.deepEqual(checkStopHit(buy, bar({ low: 1.09, high: 1.11 })), {
  exitPrice: buy.stopLoss,
  exitReason: "sl",
});
// no touch
assert.equal(checkStopHit(buy, bar({ low: 1.0990, high: 1.1030 })), null);
// sell: high touches SL / low touches TP
assert.deepEqual(checkStopHit(sell, bar({ low: 156.0, high: 156.81 })), {
  exitPrice: sell.stopLoss,
  exitReason: "sl",
});
assert.deepEqual(checkStopHit(sell, bar({ low: 155.89, high: 156.6 })), {
  exitPrice: sell.takeProfit,
  exitReason: "tp",
});

// ── mark-to-market ───────────────────────────────────────────────────────────
assert.equal(positionPips(buy, 1.1020, "EURUSD"), 20);
assert.equal(positionPips(buy, 1.0980, "EURUSD"), -20);
assert.equal(positionPips(sell, 156.2, "USDJPY"), 30);
// profit = pips · pipValuePerLot · lots → 20 pips × 10 €/pip/lot × 0.5 lots
assert.equal(unrealizedProfit(buy, 1.102, "EURUSD"), 100);

// ── closePosition ────────────────────────────────────────────────────────────
const win = closePosition(buy, { exitPrice: buy.takeProfit, exitTime: 5_000, exitReason: "tp", id: 7, symbol: "EURUSD" });
assert.equal(win.id, 7);
assert.equal(win.pips, 40);
assert.equal(win.profit, 200); // 40 × 10 × 0.5
assert.equal(win.rMultiple, 2); // 40 / 20
assert.equal(win.result, "win");
assert.equal(win.exitReason, "tp");
assert.equal(win.entryTime, 1_000);
assert.equal(win.exitTime, 5_000);

const loss = closePosition(buy, { exitPrice: buy.stopLoss, exitTime: 5_100, exitReason: "sl", id: 8, symbol: "EURUSD" });
assert.equal(loss.pips, -20);
assert.equal(loss.profit, -100);
assert.equal(loss.rMultiple, -1);
assert.equal(loss.result, "loss");

const flat = closePosition(buy, { exitPrice: 1.1, exitTime: 5_200, exitReason: "manual", id: 9, symbol: "EURUSD" });
assert.equal(flat.pips, 0);
assert.equal(flat.result, "breakeven");

// unsized stop → null R
const noStop = openPosition({
  direction: "buy",
  entryPrice: 100,
  entryTime: 0,
  slPips: 0,
  tpPips: 0,
  lots: 0.1,
  riskAmount: 0,
  symbol: "US30",
});
const noStopClosed = closePosition(noStop, { exitPrice: 110, exitTime: 1, exitReason: "manual", id: 1, symbol: "US30" });
assert.equal(noStopClosed.rMultiple, null);
assert.equal(noStopClosed.pips, 10);

// pips are rounded to a tenth to avoid float noise
const noisy = closePosition(buy, { exitPrice: 1.10123, exitTime: 6_000, exitReason: "manual", id: 10, symbol: "EURUSD" });
assert.equal(noisy.pips, 12.3);

console.log("tradeEngine checks passed");
