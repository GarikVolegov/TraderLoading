import assert from "node:assert/strict";
import { computeAccountEquity } from "./accountEquity.js";
import type { BrokerDeal } from "./types.js";

function deal(id: string, closedAt: string, profit: number, commission = 0, swap = 0): BrokerDeal {
  return {
    id,
    symbol: "XAUUSD.R",
    side: "buy",
    volume: 0.01,
    profit,
    commission,
    swap,
    closedAt,
    source: "fxblue" as BrokerDeal["source"],
  };
}

// Conto a 1000 oggi, storia: +50 (g1), -20.5 (g1), -30 (g2), +25 (g3)
// Netto totale = 24.5 → balance iniziale 975.5
const history = [
  deal("1", "2026-06-01T10:00:00Z", 50),
  deal("2", "2026-06-01T15:00:00Z", -20, -0.5),
  deal("3", "2026-06-03T11:00:00Z", -30),
  deal("4", "2026-06-05T09:00:00Z", 25),
];

const stats = computeAccountEquity(history, 1000, null);
assert.equal(stats.points.length, 3);
assert.equal(stats.endBalance, 1000);
assert.equal(stats.startBalance, 975.5);
assert.equal(stats.periodPnl, 24.5);
assert.equal(stats.dealCount, 4);

// Balance a fine giornata, ricostruito all'indietro dall'ancora 1000:
// g3: 1000 · g2: 1000-25=975 · g1: 975-(-30)=1005
assert.deepEqual(stats.points.map((p) => [p.date, p.balance, p.pnl]), [
  ["2026-06-01", 1005, 29.5],
  ["2026-06-03", 975, -30],
  ["2026-06-05", 1000, 25],
]);

// Drawdown: picco 1005 → 975 = -30
assert.equal(stats.maxDrawdown, -30);
assert.equal(stats.bestDay?.date, "2026-06-01");
assert.equal(stats.worstDay?.date, "2026-06-03");
assert.equal(stats.periodPct, 2.51); // 24.5 / 975.5

// Finestra che esclude i primi giorni: l'ancora resta il balance attuale
const recent = computeAccountEquity(history, 1000, 0); // solo oggi → nessun deal
assert.equal(recent.points.length, 0);
assert.equal(recent.startBalance, 1000);
assert.equal(recent.periodPnl, 0);

// Deal senza profit o senza data: ignorati
const dirty = [
  ...history,
  { id: "x", symbol: "EURUSD", side: "sell", volume: 1, source: "fxblue" } as BrokerDeal,
];
assert.equal(computeAccountEquity(dirty, 1000, null).dealCount, 4);

// Storico vuoto
const empty = computeAccountEquity([], 500, null);
assert.equal(empty.points.length, 0);
assert.equal(empty.endBalance, 500);

console.log("account equity checks passed");
