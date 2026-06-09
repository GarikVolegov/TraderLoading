import assert from "node:assert/strict";
import { computeEquityStats, filterEntriesByDays } from "./equityStats.js";

function tradeContent(profit: number, commission = 0, swap = 0): string {
  return [
    "Ticket: 1",
    "Source: FX Blue Account Sync",
    "Symbol: XAUUSD.R",
    "Direction: BUY",
    "Volume: 0.01",
    `Profit: ${profit.toFixed(2)} EUR`,
    `Commission: ${commission.toFixed(2)} EUR`,
    `Swap: ${swap.toFixed(2)} EUR`,
  ].join("\n");
}

const entries = [
  { tradeDate: "2026-06-01", tags: "account-import,fxblue", content: tradeContent(50) },
  { tradeDate: "2026-06-01", tags: "account-import,fxblue", content: tradeContent(-20, -0.5) },
  { tradeDate: "2026-06-03", tags: "account-import,fxblue", content: tradeContent(-40) },
  { tradeDate: "2026-06-05", tags: "account-import,fxblue", content: tradeContent(25, 0, -1.5) },
  // Nota manuale: ignorata
  { tradeDate: "2026-06-04", tags: "", content: "Giornata flat, niente setup." },
];

const stats = computeEquityStats(entries);
assert.equal(stats.tradeCount, 4);
assert.equal(stats.currency, "EUR");
assert.equal(stats.points.length, 3, "3 giorni distinti con trade");

// 1 giu: 50 + (-20.5) = 29.5 → cumulativo 29.5
assert.deepEqual(stats.points[0], { date: "2026-06-01", pnl: 29.5, cumulative: 29.5 });
// 3 giu: -40 → cumulativo -10.5
assert.deepEqual(stats.points[1], { date: "2026-06-03", pnl: -40, cumulative: -10.5 });
// 5 giu: 23.5 → cumulativo 13
assert.deepEqual(stats.points[2], { date: "2026-06-05", pnl: 23.5, cumulative: 13 });

assert.equal(stats.totalPnl, 13);
assert.equal(stats.bestDay?.date, "2026-06-01");
assert.equal(stats.worstDay?.date, "2026-06-03");
// Drawdown: picco 29.5 → minimo -10.5 = -40
assert.equal(stats.maxDrawdown, -40);

// Nessun trade importato → stato vuoto
const noTrades = computeEquityStats([
  { tradeDate: "2026-06-01", tags: "", content: "solo note" },
]);
assert.equal(noTrades.tradeCount, 0);
assert.equal(noTrades.points.length, 0);
assert.equal(computeEquityStats(undefined).tradeCount, 0);

// Filtro temporale
const recent = filterEntriesByDays(entries, 2);
assert.ok(recent.length < entries.length);
assert.equal(filterEntriesByDays(entries, null).length, entries.length);

console.log("equity stats checks passed");
