import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { attachBacktestSessionStats } = await import("./backtest.js");
const backtestRoute = readFileSync(new URL("./backtest.ts", import.meta.url), "utf8");

const sessions = [
  {
    id: 1,
    name: "London breakout",
    pair: "EUR/USD",
    timeframe: "H1",
    strategy: "Breakout + FVG",
    notes: null,
    userId: "user_1",
    createdAt: new Date("2026-06-01T08:00:00.000Z"),
  },
  {
    id: 2,
    name: "Empty session",
    pair: "GBP/USD",
    timeframe: "M15",
    strategy: null,
    notes: null,
    userId: "user_1",
    createdAt: new Date("2026-06-02T08:00:00.000Z"),
  },
];

const enriched = attachBacktestSessionStats(sessions, [
  {
    sessionId: 1,
    direction: "buy",
    entryPrice: "1.10000",
    exitPrice: "1.11000",
    stopLoss: "1.09500",
    result: "win",
    pips: "100.0",
  },
  {
    sessionId: 1,
    direction: "sell",
    entryPrice: "1.20000",
    exitPrice: "1.21000",
    stopLoss: "1.20500",
    result: "loss",
    pips: "-100.0",
  },
  {
    sessionId: 1,
    direction: "buy",
    entryPrice: "1.30000",
    exitPrice: "1.30000",
    stopLoss: null,
    result: "breakeven",
    pips: "0.0",
  },
]);

assert.deepEqual(enriched[0].stats, {
  total: 3,
  wins: 1,
  losses: 1,
  breakevens: 1,
  winRate: 33,
  avgRR: "0.00",
  totalPips: "0.0",
});

assert.deepEqual(enriched[1].stats, {
  total: 0,
  wins: 0,
  losses: 0,
  breakevens: 0,
  winRate: 0,
  avgRR: null,
  totalPips: "0.0",
});

assert.match(backtestRoute, /res\.json\(attachBacktestSessionStats\(\[session\], \[\]\)\[0\]\)/);

console.log("backtest session stats checks passed");
