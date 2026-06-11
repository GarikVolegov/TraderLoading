import assert from "node:assert/strict";
import { calculateBacktestStats } from "./backtestStats.js";

const stats = calculateBacktestStats([
  {
    direction: "buy",
    entryPrice: "1.1000",
    exitPrice: "1.1100",
    stopLoss: "1.0950",
    result: "win",
    pips: "100.0",
  },
  {
    direction: "sell",
    entryPrice: "1.2000",
    exitPrice: "1.2100",
    stopLoss: "1.2050",
    result: "loss",
    pips: "-100.0",
  },
  {
    direction: "buy",
    entryPrice: "1.3000",
    exitPrice: "1.3000",
    result: "breakeven",
    pips: "0",
  },
]);

assert.deepEqual(stats, {
  total: 3,
  wins: 1,
  losses: 1,
  breakevens: 1,
  winRate: 33,
  avgRR: "0.00",
  totalPips: "0.0",
});

assert.equal(calculateBacktestStats([]), null);
assert.equal(calculateBacktestStats(undefined), null);

assert.deepEqual(
  calculateBacktestStats([
    {
      direction: "buy",
      entryPrice: "1.0000",
      exitPrice: "0.9950",
      result: "loss",
      pips: "-50.0",
    },
    {
      direction: "sell",
      entryPrice: "1.1000",
      exitPrice: "1.0980",
      result: "win",
      pips: "20.0",
    },
  ]),
  {
    total: 2,
    wins: 1,
    losses: 1,
    breakevens: 0,
    winRate: 50,
    avgRR: null,
    totalPips: "-30.0",
  },
);

console.log("backtest stats checks passed");
