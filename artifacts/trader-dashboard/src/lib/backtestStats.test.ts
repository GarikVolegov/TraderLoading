import assert from "node:assert/strict";
import { calculateBacktestStats, calculateDetailedBacktestStats } from "./backtestStats.js";

const stats = calculateBacktestStats([
  {
    direction: "buy",
    entryPrice: "1.1000",
    exitPrice: "1.1100",
    stopLoss: "1.0950",
    result: "win",
    pips: "100.0",
    netPnl: "100.00",
    currency: "EUR",
  },
  {
    direction: "sell",
    entryPrice: "1.2000",
    exitPrice: "1.2100",
    stopLoss: "1.2050",
    result: "loss",
    pips: "-100.0",
    netPnl: "-100.00",
    currency: "EUR",
  },
  {
    direction: "buy",
    entryPrice: "1.3000",
    exitPrice: "1.3000",
    result: "breakeven",
    pips: "0",
    netPnl: "0.00",
    currency: "EUR",
  },
]);

assert.ok(stats);
assert.equal(stats.total, 3);
assert.equal(stats.wins, 1);
assert.equal(stats.losses, 1);
assert.equal(stats.breakevens, 1);
assert.equal(stats.winRate, 33);
assert.equal(stats.avgRR, "0.00");
assert.equal(stats.totalPips, "0.0");
assert.equal(stats.totalPnl, 0);
assert.equal(stats.roiPct, 0);
assert.equal(stats.currency, "EUR");

assert.equal(calculateBacktestStats([]), null);
assert.equal(calculateBacktestStats(undefined), null);

const stats2 = calculateBacktestStats([
  {
    direction: "buy",
    entryPrice: "1.0000",
    exitPrice: "0.9950",
    result: "loss",
    pips: "-50.0",
    netPnl: "-50.00",
    currency: "EUR",
  },
  {
    direction: "sell",
    entryPrice: "1.1000",
    exitPrice: "1.0980",
    result: "win",
    pips: "20.0",
    netPnl: "20.00",
    currency: "EUR",
  },
]);

assert.ok(stats2);
assert.equal(stats2.total, 2);
assert.equal(stats2.wins, 1);
assert.equal(stats2.losses, 1);
assert.equal(stats2.breakevens, 0);
assert.equal(stats2.winRate, 50);
assert.equal(stats2.avgRR, null);
assert.equal(stats2.totalPips, "-30.0");
assert.equal(stats2.totalPnl, -30);
assert.equal(stats2.roiPct, -0.3); // -30 / 10000 * 100

// Detailed backtest stats checks
const detailed = calculateDetailedBacktestStats([
  {
    id: 1,
    direction: "buy",
    entryPrice: "2700.00",
    exitPrice: "2720.00",
    stopLoss: "2690.00",
    result: "win",
    pips: "200.0",
    netPnl: "200.00",
    currency: "EUR",
    tradeDate: "2026-10-01",
    createdAt: "2026-10-01T10:00:00Z",
  },
  {
    id: 2,
    direction: "sell",
    entryPrice: "2720.00",
    exitPrice: "2730.00",
    stopLoss: "2725.00",
    result: "loss",
    pips: "-100.0",
    netPnl: "-100.00",
    currency: "EUR",
    tradeDate: "2026-10-02",
    createdAt: "2026-10-02T10:00:00Z",
  },
  {
    id: 3,
    direction: "buy",
    entryPrice: "2710.00",
    exitPrice: "2740.00",
    stopLoss: "2700.00",
    result: "win",
    pips: "300.0",
    netPnl: "300.00",
    currency: "EUR",
    tradeDate: "2026-10-03",
    createdAt: "2026-10-03T10:00:00Z",
  },
]);

assert.ok(detailed);
assert.equal(detailed.total, 3);
assert.equal(detailed.wins, 2);
assert.equal(detailed.losses, 1);
assert.equal(detailed.profitFactor, "5.00"); // 500 / 100
assert.equal(detailed.bestTradePips, "300.0");
assert.equal(detailed.worstTradePips, "-100.0");
assert.equal(detailed.bestTradePnl, 300);
assert.equal(detailed.worstTradePnl, -100);
assert.equal(detailed.totalPnl, 400);
assert.equal(detailed.roiPct, 4); // 400 / 10000 * 100 = 4%
assert.equal(detailed.maxConsecutiveWins, 1); // win -> loss -> win
assert.equal(detailed.maxConsecutiveLosses, 1);
assert.equal(detailed.longStats.total, 2);
assert.equal(detailed.longStats.wins, 2);
assert.equal(detailed.longStats.winRate, 100);
assert.equal(detailed.longStats.totalPnl, 500);
assert.equal(detailed.shortStats.total, 1);
assert.equal(detailed.shortStats.losses, 1);
assert.equal(detailed.shortStats.winRate, 0);
assert.equal(detailed.shortStats.totalPnl, -100);
assert.equal(detailed.equityCurve.length, 4); // initial 0 + 3 trades
assert.equal(detailed.equityCurve[3].cumulativePips, 400.0);
assert.equal(detailed.equityCurve[3].cumulativePnl, 400.0);
assert.equal(detailed.equityCurve[3].roiPct, 4.0);

console.log("backtest stats checks passed");
