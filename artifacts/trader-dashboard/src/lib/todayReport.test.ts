import assert from "node:assert/strict";
import { buildTodayReport } from "./todayReport.js";
import { getLocalDateKey } from "./marketSessions.js";

const today = getLocalDateKey();

function tradeContent(profit: number): string {
  return [
    "Ticket: 1",
    "Source: FX Blue Account Sync",
    "Symbol: XAUUSD.R",
    "Direction: BUY",
    "Volume: 0.01",
    `Profit: ${profit.toFixed(2)} EUR`,
    "Commission: -0.10 EUR",
    "Swap: 0.00 EUR",
  ].join("\n");
}

const entries = [
  { tradeDate: today, result: "win", content: tradeContent(50) },
  { tradeDate: today, result: "loss", content: tradeContent(-20) },
  { tradeDate: today, result: "breakeven", content: null },
  { tradeDate: "2020-01-01", result: "win", content: tradeContent(999) }, // non di oggi
];

const report = buildTodayReport(entries, "🧘", 2, 3);
assert.equal(report.win, 1);
assert.equal(report.loss, 1);
assert.equal(report.be, 1);
// 50-0.1 + (-20-0.1) = 29.8
assert.equal(report.netPnl, 29.8);
assert.equal(report.currency, "EUR");
assert.equal(report.mood, "🧘");
assert.equal(report.missionsCompleted, 2);
assert.equal(report.missionsTotal, 3);

// Giornata senza trade
const empty = buildTodayReport([], null, 0, 0);
assert.equal(empty.win + empty.loss + empty.be, 0);
assert.equal(empty.netPnl, null);

console.log("evening trade report checks passed");
