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
assert.deepEqual(checkStopHit(buy, bar({ open: 1.1, low: 1.0979, high: 1.1001 })), {
  exitPrice: buy.stopLoss,
  exitReason: "sl",
});
// buy: high touches TP
assert.deepEqual(checkStopHit(buy, bar({ open: 1.1, low: 1.0999, high: 1.1041 })), {
  exitPrice: buy.takeProfit,
  exitReason: "tp",
});
// buy: both in the same bar → conservative SL-first
assert.deepEqual(checkStopHit(buy, bar({ open: 1.1, low: 1.09, high: 1.11 })), {
  exitPrice: buy.stopLoss,
  exitReason: "sl",
});
// no touch
assert.equal(checkStopHit(buy, bar({ open: 1.1, low: 1.0990, high: 1.1030 })), null);
// sell: high touches SL / low touches TP
assert.deepEqual(checkStopHit(sell, bar({ open: 156.5, low: 156.0, high: 156.81 })), {
  exitPrice: sell.stopLoss,
  exitReason: "sl",
});
assert.deepEqual(checkStopHit(sell, bar({ open: 156.3, low: 155.89, high: 156.6 })), {
  exitPrice: sell.takeProfit,
  exitReason: "tp",
});
// gap-aware fills: a bar OPENING beyond the level fills at the open, not at a
// price the market never traded
assert.deepEqual(checkStopHit(buy, bar({ open: 1.09, low: 1.088, high: 1.095 })), {
  exitPrice: 1.09,
  exitReason: "sl",
});
assert.deepEqual(checkStopHit(buy, bar({ open: 1.108, low: 1.106, high: 1.112 })), {
  exitPrice: 1.108,
  exitReason: "tp",
});
assert.deepEqual(checkStopHit(sell, bar({ open: 157.2, low: 156.9, high: 157.5 })), {
  exitPrice: 157.2,
  exitReason: "sl",
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

// ── manageBar: excursion tracking + auto-breakeven + trailing stop ──────────
{
  const { manageBar } = await import("./tradeEngine");
  const base = openPosition({
    direction: "buy",
    entryPrice: 1.1,
    entryTime: 1_000,
    slPips: 20,
    tpPips: 100,
    lots: 0.5,
    riskAmount: 100,
    symbol: "EURUSD",
  });

  // no rules: excursion tracked, no hit, levels untouched
  const step1 = manageBar(base, bar({ open: 1.1, low: 1.099, high: 1.1015, close: 1.101 }), {}, "EURUSD");
  assert.equal(step1.hit, null);
  assert.equal(step1.position.bestPips, 15);
  assert.equal(step1.position.worstPips, -10);
  assert.equal(step1.position.stopLoss, base.stopLoss);

  // auto-breakeven: +1R favorable (20 pips) moves SL to entry, once
  const be1 = manageBar(base, bar({ open: 1.1, low: 1.0999, high: 1.1021, close: 1.102 }), { breakevenAtR: 1 }, "EURUSD");
  assert.equal(be1.hit, null);
  assert.equal(be1.position.stopLoss, 1.1);
  assert.equal(be1.position.breakevenApplied, true);
  // not re-applied nor lowered afterwards
  const be2 = manageBar(be1.position, bar({ open: 1.102, low: 1.1005, high: 1.103, close: 1.1025 }), { breakevenAtR: 1 }, "EURUSD");
  assert.equal(be2.position.stopLoss, 1.1);

  // below the trigger: SL untouched
  const beNo = manageBar(base, bar({ open: 1.1, low: 1.0999, high: 1.1015, close: 1.101 }), { breakevenAtR: 1 }, "EURUSD");
  assert.equal(beNo.position.stopLoss, base.stopLoss);

  // trailing: SL follows the best price at a fixed pip distance, never lowers
  const tr1 = manageBar(base, bar({ open: 1.1, low: 1.0995, high: 1.104, close: 1.1035 }), { trailingPips: 15 }, "EURUSD");
  assert.equal(tr1.hit, null);
  assert.equal(tr1.position.stopLoss.toFixed(5), "1.10250"); // 1.104 − 15 pip
  const tr2 = manageBar(tr1.position, bar({ open: 1.1035, low: 1.103, high: 1.1038, close: 1.1032 }), { trailingPips: 15 }, "EURUSD");
  assert.equal(tr2.position.stopLoss.toFixed(5), "1.10250", "never lowered");

  // the stop check runs BEFORE management (no intra-bar look-ahead): a bar
  // that hits the pre-bar SL closes there even if it also ran far in favor
  const hitFirst = manageBar(base, bar({ open: 1.1, low: 1.0979, high: 1.105, close: 1.104 }), { trailingPips: 5 }, "EURUSD");
  assert.deepEqual(hitFirst.hit, { exitPrice: base.stopLoss, exitReason: "sl" });

  // sell-side trailing lowers the stop toward the lows
  const sellPos = openPosition({
    direction: "sell",
    entryPrice: 156.5,
    entryTime: 2_000,
    slPips: 30,
    tpPips: 120,
    lots: 0.1,
    riskAmount: 30,
    symbol: "USDJPY",
  });
  const trS = manageBar(sellPos, bar({ open: 156.5, low: 156.1, high: 156.55, close: 156.15 }), { trailingPips: 20 }, "USDJPY");
  assert.equal(trS.position.stopLoss.toFixed(3), "156.300"); // 156.10 + 20 pip

  // closePosition carries MAE/MFE in R from the tracked excursion
  const closedWithExcursion = closePosition(
    { ...be1.position, worstPips: -8, bestPips: 42 },
    { exitPrice: 1.103, exitTime: 9_000, exitReason: "manual", id: 99, symbol: "EURUSD" },
  );
  assert.equal(closedWithExcursion.maeR, 0.4); // 8 / 20 (initial risk)
  assert.equal(closedWithExcursion.mfeR, 2.1); // 42 / 20
}

// ── pending orders: limit/stop fill ─────────────────────────────────────────
{
  const { checkPendingFill, fillPendingOrder } = await import("./tradeEngine");
  const mkOrder = (over: Record<string, unknown>) => ({
    direction: "buy" as const,
    kind: "limit" as const,
    price: 1.09,
    slPips: 20,
    tpPips: 40,
    lots: 0.5,
    riskAmount: 100,
    placedTime: 500,
    ...over,
  });

  // BUY LIMIT (below): fills when the low reaches the level
  const buyLimit = mkOrder({ kind: "limit", direction: "buy", price: 1.09 });
  assert.equal(checkPendingFill(buyLimit, bar({ open: 1.1, low: 1.0905, high: 1.101 })), null);
  assert.equal(checkPendingFill(buyLimit, bar({ open: 1.1, low: 1.0895, high: 1.101 })), 1.09);
  // gap through: opens below the limit → fills at the (better) open
  assert.equal(checkPendingFill(buyLimit, bar({ open: 1.088, low: 1.087, high: 1.089 })), 1.088);

  // BUY STOP (above): fills when the high reaches the level
  const buyStop = mkOrder({ kind: "stop", direction: "buy", price: 1.11 });
  assert.equal(checkPendingFill(buyStop, bar({ open: 1.1, low: 1.099, high: 1.1095 })), null);
  assert.equal(checkPendingFill(buyStop, bar({ open: 1.1, low: 1.099, high: 1.111 })), 1.11);
  // gap up through the stop → fills at the (worse) open
  assert.equal(checkPendingFill(buyStop, bar({ open: 1.115, low: 1.114, high: 1.116 })), 1.115);

  // SELL LIMIT (above): fills when the high reaches the level
  const sellLimit = mkOrder({ kind: "limit", direction: "sell", price: 1.11 });
  assert.equal(checkPendingFill(sellLimit, bar({ open: 1.1, low: 1.099, high: 1.111 })), 1.11);
  // SELL STOP (below): fills when the low reaches the level
  const sellStop = mkOrder({ kind: "stop", direction: "sell", price: 1.09 });
  assert.equal(checkPendingFill(sellStop, bar({ open: 1.1, low: 1.0895, high: 1.101 })), 1.09);

  // fillPendingOrder → OpenPosition anchored to the fill bar, SL/TP from pips
  const filled = fillPendingOrder(buyLimit, 1.09, 900, "EURUSD");
  assert.equal(filled.direction, "buy");
  assert.equal(filled.entryPrice, 1.09);
  assert.equal(filled.entryTime, 900);
  assert.equal(filled.stopLoss.toFixed(5), "1.08800"); // 20 pips below
  assert.equal(filled.takeProfit.toFixed(5), "1.09400"); // 40 pips above
  assert.equal(filled.lots, 0.5);
  assert.equal(filled.initialSlPips, 20);
}

// ── execution costs: spread + commission ───────────────────────────────────
{
  const { tradeCost } = await import("./tradeEngine");
  // spread: pips × pipValuePerLot(10 for FX) × lots
  assert.equal(tradeCost({ spreadPips: 1 }, 0.5, "EURUSD"), 5); // 1×10×0.5
  assert.equal(tradeCost({ commissionPerLot: 7 }, 0.5, "EURUSD"), 3.5); // 7×0.5
  assert.equal(tradeCost({ spreadPips: 1, commissionPerLot: 7 }, 1, "EURUSD"), 17); // 10 + 7
  assert.equal(tradeCost(undefined, 1, "EURUSD"), 0);
  assert.equal(tradeCost({}, 1, "EURUSD"), 0);
  // indices/crypto pipValuePerLot = 1
  assert.equal(tradeCost({ spreadPips: 2 }, 3, "US30"), 6);

  // costs deducted from a winning trade: 40 pips × 10 × 0.5 = 200 gross − 17 = 183
  const withCost = closePosition(buy, {
    exitPrice: buy.takeProfit,
    exitTime: 5_000,
    exitReason: "tp",
    id: 20,
    symbol: "EURUSD",
    costs: { spreadPips: 1, commissionPerLot: 7 },
  });
  assert.equal(withCost.cost, 8.5); // buy.lots = 0.5 → 1×10×0.5 + 7×0.5
  assert.equal(withCost.profit, 191.5); // 200 gross − 8.5
  assert.equal(withCost.pips, 40, "gross pips unchanged");
  assert.equal(withCost.rMultiple, 2, "R unchanged (price risk)");
  assert.equal(withCost.result, "win");

  // a marginal winner fully eaten by costs flips to a loss (result follows NET)
  const marginal = openPosition({
    direction: "buy",
    entryPrice: 1.1,
    entryTime: 0,
    slPips: 20,
    tpPips: 1,
    lots: 0.1,
    riskAmount: 20,
    symbol: "EURUSD",
  });
  const eaten = closePosition(marginal, {
    exitPrice: marginal.takeProfit,
    exitTime: 10,
    exitReason: "tp",
    id: 21,
    symbol: "EURUSD",
    costs: { commissionPerLot: 20 },
  });
  assert.equal(eaten.pips, 1);
  assert.ok(eaten.profit < 0, "net negative after commission");
  assert.equal(eaten.result, "loss");

  // no costs → identical to before
  const free = closePosition(buy, { exitPrice: buy.takeProfit, exitTime: 5_000, exitReason: "tp", id: 22, symbol: "EURUSD" });
  assert.equal(free.cost, 0);
  assert.equal(free.profit, 200);
}
