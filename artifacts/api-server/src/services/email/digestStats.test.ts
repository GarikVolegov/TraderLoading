import assert from "node:assert/strict";
import type { EdgeTrade } from "../tradeAnalytics.js";
import { buildDigestStats } from "./digestStats.js";

// Finding 4.1: pure reducer — a user's closed trades → the weekly DigestStats the
// email builder renders. Reuses tradeAnalytics' rMultiple convention. `now` is
// injected so the 7-day window is deterministic.

const NOW = new Date("2026-07-07T12:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();

function trade(overrides: Partial<EdgeTrade>): EdgeTrade {
  return {
    symbol: "EURUSD",
    direction: "buy",
    openTime: daysAgo(3),
    closeTime: daysAgo(2),
    entryPrice: 100,
    exitPrice: 102,
    stopLoss: 99,
    profit: 2,
    ...overrides,
  };
}

// Empty in → the neutral, no-activity snapshot (not NaN/undefined).
assert.deepEqual(buildDigestStats([], NOW), {
  tradesLogged: 0,
  winRate: null,
  netR: 0,
  streakDays: 0,
  topSymbol: null,
});

// A representative week.
const trades: EdgeTrade[] = [
  trade({ symbol: "EURUSD", exitPrice: 102, profit: 2 }), //   R = +2, win
  trade({ symbol: "EURUSD", exitPrice: 99, profit: -1 }), //   R = -1, loss
  trade({ symbol: "XAUUSD", entryPrice: 2000, stopLoss: 1990, exitPrice: 2010, profit: 40 }), // R = +1, win
  trade({ symbol: "EURUSD", exitPrice: 100, profit: 0 }), //   breakeven: no R, excluded from win rate
  trade({ symbol: "GBPUSD", closeTime: daysAgo(20), profit: 5 }), // outside the 7-day window
  trade({ symbol: "USDJPY", closeTime: null, profit: 9 }), //   still open
];

const stats = buildDigestStats(trades, NOW, { streakDays: 5 });
assert.equal(stats.tradesLogged, 4, "only closed trades inside the window count");
assert.equal(stats.netR, 2, "net R = +2 -1 +1 (breakeven has no R)");
assert.equal(stats.winRate, 0.6667, "2 wins / 3 decided (breakeven excluded), rounded");
assert.equal(stats.topSymbol, "EURUSD", "most-traded symbol in the window");
assert.equal(stats.streakDays, 5, "streak is injected (activity-based, not trade-derived)");

// Tie on trade count breaks alphabetically for determinism.
const tie = buildDigestStats(
  [trade({ symbol: "ZZZ" }), trade({ symbol: "AAA" })],
  NOW,
);
assert.equal(tie.topSymbol, "AAA");

// All-losing week keeps a negative net R and a 0 win rate.
const losing = buildDigestStats(
  [trade({ exitPrice: 99, profit: -1 }), trade({ exitPrice: 98, profit: -2 })],
  NOW,
);
assert.equal(losing.winRate, 0);
assert.ok(losing.netR < 0);

console.log("digest stats reducer checks passed");
