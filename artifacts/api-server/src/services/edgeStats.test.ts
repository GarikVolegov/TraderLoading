import assert from "node:assert/strict";
import {
  wilsonInterval,
  kellyFraction,
  rollingExpectancy,
  equityCurve,
  rHistogram,
  bootstrapRiskOfRuin,
  maxDrawdown,
  drawdownSeries,
} from "./edgeStats.js";

// ── Wilson score interval on the win rate (idea 5B: "is my edge statistically real?") ──
assert.equal(wilsonInterval(0, 0), null); // no trades → no interval
{
  const ci = wilsonInterval(8, 10)!;
  assert.equal(ci.point, 0.8);
  assert.ok(ci.lower < 0.8 && 0.8 < ci.upper, "interval brackets the point");
  assert.ok(ci.lower >= 0 && ci.upper <= 1, "bounded to [0,1]");
  // Known 95% Wilson for 8/10 ≈ [0.490, 0.943].
  assert.ok(Math.abs(ci.lower - 0.49) < 0.02, `lower ~0.49, got ${ci.lower}`);
  assert.ok(Math.abs(ci.upper - 0.943) < 0.02, `upper ~0.943, got ${ci.upper}`);
}
{
  // More samples at the same rate → a tighter interval.
  const wide = wilsonInterval(8, 10)!;
  const tight = wilsonInterval(80, 100)!;
  assert.ok(tight.upper - tight.lower < wide.upper - wide.lower, "more data ⇒ narrower CI");
}

// ── Kelly fraction (idea 5B: optimal sizing from your own edge) ──
{
  // W=0.6, payoff R = avgWin/|avgLoss| = 1.5 → f* = 0.6 - 0.4/1.5 = 0.3333.
  const k = kellyFraction(0.6, 1.5, -1)!;
  assert.ok(Math.abs(k.full - 0.3333) < 0.001, `full kelly ~0.333, got ${k.full}`);
  assert.ok(Math.abs(k.half - 0.1667) < 0.001, "half kelly is full/2");
}
{
  // No edge (W=0.5, R=1) → Kelly 0. Negative edge → clamped to 0 (never bet negative).
  assert.equal(kellyFraction(0.5, 1, -1)!.full, 0);
  assert.equal(kellyFraction(0.4, 1, -1)!.full, 0);
}
// Degenerate inputs → null.
assert.equal(kellyFraction(0.6, 1.5, 0), null); // no loss magnitude
assert.equal(kellyFraction(null, 1.5, -1), null);

// ── Rolling expectancy (idea 5B: edge decay — when a setup stops working) ──
assert.deepEqual(rollingExpectancy([], 3), []);
assert.deepEqual(rollingExpectancy([1, 1], 3), []); // fewer than the window → no points
{
  const series = rollingExpectancy([1, 1, 1, -1, -1, -1], 3);
  assert.equal(series.length, 4);
  assert.deepEqual(series.map((p) => p.atTrade), [3, 4, 5, 6]);
  assert.ok(Math.abs(series[0].mean - 1) < 1e-9);
  assert.ok(Math.abs(series[1].mean - (1 / 3)) < 1e-9);
  assert.ok(Math.abs(series[3].mean - -1) < 1e-9);
}

// ── Equity curve (idea 5D: canonical server-side equity/drawdown) ──
assert.deepEqual(equityCurve([]), []);
{
  const curve = equityCurve([100, -50, 30]);
  assert.deepEqual(curve.map((p) => p.atTrade), [1, 2, 3]);
  assert.deepEqual(curve.map((p) => p.equity), [100, 50, 80]); // cumulative P&L
}

// ── R distribution histogram (idea 5D) — contiguous buckets over the range ──
assert.deepEqual(rHistogram([], 1), []);
{
  const h = rHistogram([-1.2, -0.5, 0.3, 1.1, 2.4], 1);
  assert.deepEqual(h.map((b) => [b.from, b.to, b.count]), [
    [-2, -1, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [1, 2, 1],
    [2, 3, 1],
  ]);
}
{
  // Empty in-range buckets are kept (contiguous bars) and counts stack.
  const h = rHistogram([0.1, 0.2, 2.1], 1);
  assert.deepEqual(h.map((b) => [b.from, b.to, b.count]), [
    [0, 1, 2],
    [1, 2, 0],
    [2, 3, 1],
  ]);
}

// ── Monte Carlo bootstrap risk-of-ruin (idea 5B: risk-of-ruin from YOUR real R) ──
assert.equal(bootstrapRiskOfRuin([], { trades: 10, riskFraction: 0.01, ruinThreshold: 0.5, sims: 10 }), null);
{
  // Deterministic RNG (always index 0). A −1R streak at full risk ruins immediately.
  const ruined = bootstrapRiskOfRuin([-1], { trades: 5, riskFraction: 1, ruinThreshold: 0, sims: 8, rng: () => 0 })!;
  assert.equal(ruined.riskOfRuin, 1, "a full-loss path at 100% risk always ruins");
  assert.equal(ruined.medianFinalEquity, 0);
}
{
  // A steady +0.5R at 10% risk never ruins; equity compounds 1.05^trades.
  const safe = bootstrapRiskOfRuin([0.5], { trades: 2, riskFraction: 0.1, ruinThreshold: 0.5, sims: 8, rng: () => 0 })!;
  assert.equal(safe.riskOfRuin, 0);
  assert.ok(Math.abs(safe.medianFinalEquity - 1.1025) < 1e-6, `1.05^2, got ${safe.medianFinalEquity}`);
  assert.equal(safe.p5, safe.p95, "identical paths ⇒ collapsed percentiles");
}

// ── Max drawdown & underwater series (idea 5D: canonical drawdown, sign-safe) ──
assert.equal(maxDrawdown([]), 0, "no equity ⇒ no drawdown");
assert.equal(maxDrawdown([1, 2, 3]), 0, "monotonic-up curve never draws down");
// Peaks 0,5,5,8,8 → drawdowns 0,0,3,0,5 → worst is 5.
assert.equal(maxDrawdown([0, 5, 2, 8, 3]), 5);
// Absolute (currency) decline, so it works on a cumulative-P&L curve that goes negative.
assert.equal(maxDrawdown([0, -2, -5, -1]), 5, "peak 0 → trough −5");

assert.deepEqual(drawdownSeries([0, 5, 2, 8, 3]), [
  { atTrade: 1, drawdown: 0 },
  { atTrade: 2, drawdown: 0 },
  { atTrade: 3, drawdown: 3 },
  { atTrade: 4, drawdown: 0 },
  { atTrade: 5, drawdown: 5 },
]);
assert.deepEqual(drawdownSeries([]), []);
// maxDrawdown is the worst point of the series.
{
  const equity = [10, 4, 7, 1, 9];
  const worst = Math.max(...drawdownSeries(equity).map((p) => p.drawdown));
  assert.equal(maxDrawdown(equity), worst);
}

console.log("edge stats checks passed");
