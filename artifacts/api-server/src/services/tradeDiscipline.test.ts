import assert from "node:assert/strict";
import { computeDisciplineReport } from "./tradeDiscipline.js";
import { type EdgeTrade } from "./tradeAnalytics.js";

function trade(overrides: Partial<EdgeTrade>): EdgeTrade {
  return {
    symbol: "EURUSD",
    direction: "buy",
    openTime: "2026-06-01T09:00:00Z",
    closeTime: "2026-06-01T09:30:00Z",
    entryPrice: 1.1,
    exitPrice: 1.2,
    stopLoss: 1.05,
    profit: 100,
    ...overrides,
  };
}

// ── Stop discipline: losses worse than -1R mean the stop was widened ─────────
{
  const report = computeDisciplineReport([
    trade({}), // winner, ignored
    // loser at exactly -1R: risk 0.05, move 0.05
    trade({ exitPrice: 1.05, profit: -50 }),
    // loser at -2R: risk 0.05, move 0.10 → stop blown through
    trade({ exitPrice: 1.0, profit: -100 }),
  ]);
  assert.ok(report.stopDiscipline);
  assert.equal(report.stopDiscipline.losses, 2);
  assert.equal(report.stopDiscipline.lossesBeyond1R, 1, "only the -2R loss is beyond -1R");
  assert.equal(report.stopDiscipline.pct, 50);
}

// ── Disposition effect: winners cut early, losers held ───────────────────────
{
  const report = computeDisciplineReport([
    trade({ openTime: "2026-06-01T09:00:00Z", closeTime: "2026-06-01T09:30:00Z", profit: 100 }), // 30m winner
    trade({ openTime: "2026-06-01T09:00:00Z", closeTime: "2026-06-01T10:00:00Z", profit: 80 }), // 60m winner
    trade({ openTime: "2026-06-01T09:00:00Z", closeTime: "2026-06-01T11:00:00Z", profit: -50, exitPrice: 1.05 }), // 120m loser
    trade({ openTime: "2026-06-01T09:00:00Z", closeTime: "2026-06-01T13:00:00Z", profit: -30, exitPrice: 1.05 }), // 240m loser
  ]);
  assert.ok(report.holdTime);
  assert.equal(report.holdTime.avgWinnerMinutes, 45, "mean(30, 60)");
  assert.equal(report.holdTime.avgLoserMinutes, 180, "mean(120, 240)");
}

// ── Overtrading: do busy days pay? ───────────────────────────────────────────
{
  const calmA = trade({ openTime: "2026-06-01T09:00:00Z", profit: 100 }); // +R, calm day
  const calmB = trade({ openTime: "2026-06-02T09:00:00Z", profit: 100 }); // +R, calm day
  const busy = Array.from({ length: 4 }, () =>
    trade({ openTime: "2026-06-03T09:00:00Z", exitPrice: 1.0, profit: -100 }), // -2R, busy day
  );
  const report = computeDisciplineReport([calmA, calmB, ...busy]);
  assert.ok(report.overtrading);
  assert.equal(report.overtrading.medianTradesPerDay, 1, "days are [1, 1, 4] → median 1");
  assert.equal(report.overtrading.busiestDayTrades, 4);
  assert.ok((report.overtrading.busyExpectancyR ?? 0) < 0, "busy day is a string of losers");
  assert.ok((report.overtrading.calmExpectancyR ?? 0) > 0, "calm days are winners");
}

// ── Drawdown + losing streak over the equity curve ───────────────────────────
{
  const profits = [100, -50, -30, -40, 20];
  const trades = profits.map((profit, i) =>
    trade({
      profit,
      openTime: `2026-06-0${i + 1}T09:00:00Z`,
      closeTime: `2026-06-0${i + 1}T10:00:00Z`,
    }),
  );
  const report = computeDisciplineReport(trades);
  assert.ok(report.drawdown);
  // cumulative: 100, 50, 20, -20, 0 ; peak stays 100 → max drop = 120
  assert.equal(report.drawdown.maxDrawdown, 120);
  assert.equal(report.drawdown.longestLossStreak, 3, "the -50/-30/-40 run");
}

// ── Empty input degrades to all-null, no crash ───────────────────────────────
{
  const report = computeDisciplineReport([]);
  assert.equal(report.stopDiscipline, null);
  assert.equal(report.holdTime, null);
  assert.equal(report.overtrading, null);
  assert.equal(report.drawdown, null);
}

console.log("tradeDiscipline.test.ts: all assertions passed");
