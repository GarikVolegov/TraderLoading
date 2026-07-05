import assert from "node:assert/strict";
import {
  computeEdgeReport,
  minSliceTradesFor,
  netProfit,
  normalizeDirection,
  rMultiple,
  sessionForTrade,
  type EdgeTrade,
} from "./tradeAnalytics.js";

function trade(overrides: Partial<EdgeTrade>): EdgeTrade {
  return {
    symbol: "EURUSD",
    direction: "buy",
    openTime: "2026-06-01T09:00:00Z",
    closeTime: "2026-06-01T10:00:00Z",
    entryPrice: 1.1,
    exitPrice: 1.2,
    stopLoss: 1.05,
    profit: 100,
    ...overrides,
  };
}

// ── R-multiple matches the client convention ─────────────────────────────────
{
  // risk = 0.05, move = 0.10, profit > 0 → +2R
  assert.equal(rMultiple(trade({})), 2, "winner: (move/risk)*+1");
  // risk = 0.05, move = 0.025, profit < 0 → -0.5R
  assert.equal(
    rMultiple(trade({ exitPrice: 1.075, profit: -50 })),
    -0.5,
    "loser: (move/risk)*-1",
  );
  assert.equal(rMultiple(trade({ stopLoss: null })), null, "no stop → R uncomputable");
  assert.equal(rMultiple(trade({ exitPrice: 1.1 })), null, "no move → R uncomputable");
}

// ── Direction + session bucketing ────────────────────────────────────────────
{
  assert.equal(normalizeDirection("buy"), "long");
  assert.equal(normalizeDirection("SELL"), "short");
  assert.equal(normalizeDirection("short"), "short");
  assert.equal(normalizeDirection("?"), null);

  assert.equal(sessionForTrade("2026-06-01T03:00:00Z"), "Asia");
  assert.equal(sessionForTrade("2026-06-01T09:00:00Z"), "Londra");
  assert.equal(sessionForTrade("2026-06-01T14:00:00Z"), "Londra–NY");
  assert.equal(sessionForTrade("2026-06-01T20:00:00Z"), "Sera/USA");
  assert.equal(sessionForTrade("not-a-date"), null);
}

// ── Overall stats over a winner + a loser ────────────────────────────────────
{
  const report = computeEdgeReport([
    trade({}), // +2R, +100
    trade({ exitPrice: 1.075, profit: -50 }), // -0.5R, -50
  ]);
  const o = report.overall;
  assert.equal(o.closedTrades, 2);
  assert.equal(o.tradesWithR, 2);
  assert.equal(o.winRate, 50, "1 of 2 in profit");
  assert.equal(o.expectancyR, 0.75, "mean(2, -0.5)");
  assert.equal(o.avgWinR, 2);
  assert.equal(o.avgLossR, -0.5);
  assert.equal(o.profitFactor, 2, "100 gross win / 50 gross loss");
  assert.equal(o.netProfit, 50);
  assert.equal(o.avgWin, 100);
  assert.equal(o.avgLoss, -50);
}

// ── R coverage: trades without a stop still count for win rate, not for R ─────
{
  const report = computeEdgeReport([
    trade({}), // has R
    trade({ stopLoss: null, profit: 20 }), // no R, but a win
  ]);
  assert.equal(report.overall.closedTrades, 2);
  assert.equal(report.overall.tradesWithR, 1, "only one trade has a computable R");
  assert.equal(report.overall.winRate, 100, "both in profit");
  assert.equal(report.overall.expectancyR, 2, "expectancy ignores R-less trades");
}

// ── Post-loss (revenge) signal ───────────────────────────────────────────────
{
  const report = computeEdgeReport([
    // a loss closing at 10:00
    trade({ exitPrice: 1.075, profit: -50, openTime: "2026-06-01T09:00:00Z", closeTime: "2026-06-01T10:00:00Z" }),
    // opened 30 min after the loss closed → revenge
    trade({ openTime: "2026-06-01T10:30:00Z", closeTime: "2026-06-01T11:00:00Z", profit: -30, exitPrice: 1.075 }),
    // opened 6h after → baseline
    trade({ openTime: "2026-06-01T16:00:00Z", closeTime: "2026-06-01T17:00:00Z" }),
  ]);
  const postLoss = report.highlights.postLoss;
  assert.ok(postLoss, "post-loss signal present");
  assert.equal(postLoss.trades, 1, "one trade opened inside the revenge window");
  assert.equal(postLoss.expectancyR, -0.5, "the revenge trade is the -0.5R one");
}

// ── Highlights pick the best and worst slice (min sample enforced) ───────────
{
  const winners = Array.from({ length: 5 }, () =>
    trade({ openTime: "2026-06-01T09:00:00Z" }), // Londra, +2R each
  );
  const losers = Array.from({ length: 5 }, () =>
    trade({ openTime: "2026-06-01T20:00:00Z", stopLoss: 1.0, exitPrice: 0.9, profit: -100 }), // Sera/USA, -2R
  );
  const report = computeEdgeReport([...winners, ...losers]);
  assert.ok(report.highlights.bestSlice, "best slice present");
  assert.ok(report.highlights.worstSlice, "worst slice present");
  assert.equal(report.highlights.bestSlice.dimension, "session");
  assert.equal(report.highlights.bestSlice.label, "Londra");
  assert.equal(report.highlights.bestSlice.expectancyR, 2);
  assert.equal(report.highlights.worstSlice.label, "Sera/USA");
  assert.equal(report.highlights.worstSlice.expectancyR, -2);
}

// ── Highlight threshold scales with sample size ──────────────────────────────
{
  assert.equal(minSliceTradesFor(6), 3, "small sample → floor of 3");
  assert.equal(minSliceTradesFor(20), 3, "ceil(20*0.15)=3");
  assert.equal(minSliceTradesFor(40), 5, "large sample → cap of 5");

  // 3 winning longs + 1 losing short: the "long" slice (3 trades) now surfaces.
  const report = computeEdgeReport([
    trade({ direction: "buy" }),
    trade({ direction: "buy" }),
    trade({ direction: "buy" }),
    trade({ direction: "sell", exitPrice: 1.075, profit: -50 }),
  ]);
  assert.ok(report.highlights.bestSlice, "a 3-trade slice surfaces under the adaptive floor");
  assert.equal(report.highlights.bestSlice.label, "long");
  assert.equal(report.highlights.bestSlice.trades, 3);
}

// ── Empty input is well-formed, not a crash ──────────────────────────────────
{
  const report = computeEdgeReport([]);
  assert.equal(report.overall.closedTrades, 0);
  assert.equal(report.overall.winRate, null);
  assert.equal(report.overall.expectancyR, null);
  assert.equal(report.highlights.bestSlice, null);
  assert.equal(report.highlights.postLoss, null);
  assert.deepEqual(report.breakdowns.bySymbol, []);
}

// A stop of 0 means "no stop set" (MT4/MT5 report 0 when absent), not a real
// price at 0. Without guarding it, riskDistance = |entry - 0| = |entry| produces
// a fake ~0 R that pollutes expectancy. Treat it as no-R (null), like the client.
assert.equal(rMultiple(trade({ stopLoss: 0 })), null);
assert.equal(rMultiple(trade({ stopLoss: -1 })), null);
// A real stop still yields a real R.
assert.ok(typeof rMultiple(trade({ entryPrice: 1.1, stopLoss: 1.05, exitPrice: 1.2, profit: 100 })) === "number");

// netProfit: the coach must classify on NET P&L (gross + commission + swap) so a
// trade that grosses +10 but pays -12 in commission is the loss (-2) the diario
// already shows, and the cash guard sees the real loss.
assert.equal(netProfit(10, -12, 0), -2);
assert.equal(netProfit(100, -3, -5), 92);
// Missing costs count as zero, not as discarding the trade.
assert.equal(netProfit(10, null, null), 10);
assert.equal(netProfit(10, -2, null), 8);
// Unknown gross stays unknown.
assert.equal(netProfit(null, -1, -1), null);

console.log("tradeAnalytics.test.ts: all assertions passed");
