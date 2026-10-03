import assert from "node:assert/strict";
import { buildAccountState } from "./accountTracker";
import type { ClosedTrade } from "./types";

function trade(profit: number, id: number): ClosedTrade {
  return {
    id,
    direction: "buy",
    entryPrice: 1,
    exitPrice: 1,
    entryTime: id,
    exitTime: id + 1,
    stopLoss: 0.9,
    takeProfit: 1.2,
    lots: 0.1,
    pips: profit / 1,
    profit,
    rMultiple: null,
    exitReason: "manual",
    result: profit > 0 ? "win" : profit < 0 ? "loss" : "breakeven",
  };
}

// empty account
const empty = buildAccountState(10_000, []);
assert.equal(empty.balance, 10_000);
assert.equal(empty.equity, 10_000);
assert.equal(empty.peakEquity, 10_000);
assert.equal(empty.maxDrawdownPct, 0);
assert.equal(empty.returnPct, 0);
assert.deepEqual(empty.equityCurve, [10_000]);

// trades fold oldest-first regardless of input order (journal lists newest-first)
const state = buildAccountState(10_000, [trade(-500, 3), trade(1_000, 2), trade(200, 1)]);
assert.equal(state.balance, 10_700);
assert.deepEqual(state.equityCurve, [10_000, 10_200, 11_200, 10_700]);
assert.equal(state.peakEquity, 11_200);
// max drawdown: from 11 200 down to 10 700 → 500/11 200
assert.ok(Math.abs(state.maxDrawdownPct - (500 / 11_200) * 100) < 1e-9);
assert.ok(Math.abs(state.returnPct - 7) < 1e-9);

// open P&L affects equity (and can deepen the drawdown) but not balance
const marked = buildAccountState(10_000, [trade(-500, 1)], -300);
assert.equal(marked.balance, 9_500);
assert.equal(marked.equity, 9_200);
assert.ok(Math.abs(marked.maxDrawdownPct - 8) < 1e-9); // 800/10 000
assert.equal(marked.peakEquity, 10_000);

console.log("accountTracker checks passed");
