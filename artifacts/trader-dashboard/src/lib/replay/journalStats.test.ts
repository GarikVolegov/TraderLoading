import assert from "node:assert/strict";
import { computeJournalStats } from "./journalStats";
import type { ClosedTrade, TradeResult } from "./types";

function trade(input: { pips: number; profit: number; r: number | null; id: number }): ClosedTrade {
  const result: TradeResult = input.pips > 0 ? "win" : input.pips < 0 ? "loss" : "breakeven";
  return {
    id: input.id,
    direction: "buy",
    entryPrice: 1,
    exitPrice: 1,
    entryTime: input.id,
    exitTime: input.id + 1,
    stopLoss: 0.9,
    takeProfit: 1.2,
    lots: 0.1,
    pips: input.pips,
    profit: input.profit,
    rMultiple: input.r,
    exitReason: "manual",
    result,
  };
}

// empty journal
const empty = computeJournalStats([]);
assert.deepEqual(empty, {
  total: 0,
  wins: 0,
  losses: 0,
  breakevens: 0,
  winRate: 0,
  netR: 0,
  expectancy: null,
  totalPips: 0,
  totalProfit: 0,
});

const stats = computeJournalStats([
  trade({ pips: 40, profit: 200, r: 2, id: 1 }),
  trade({ pips: -20, profit: -100, r: -1, id: 2 }),
  trade({ pips: 0, profit: 0, r: 0, id: 3 }),
  trade({ pips: 15, profit: 75, r: null, id: 4 }), // unsized: excluded from R aggregates
]);
assert.equal(stats.total, 4);
assert.equal(stats.wins, 2);
assert.equal(stats.losses, 1);
assert.equal(stats.breakevens, 1);
assert.equal(stats.winRate, 50); // 2/4
assert.equal(stats.netR, 1); // 2 − 1 + 0
assert.ok(Math.abs((stats.expectancy ?? NaN) - 1 / 3) < 1e-9); // mean over the 3 sized trades
assert.equal(stats.totalPips, 35);
assert.equal(stats.totalProfit, 175);

// journal with only unsized trades has no expectancy
const unsized = computeJournalStats([trade({ pips: 10, profit: 10, r: null, id: 1 })]);
assert.equal(unsized.expectancy, null);
assert.equal(unsized.netR, 0);

console.log("journalStats checks passed");
