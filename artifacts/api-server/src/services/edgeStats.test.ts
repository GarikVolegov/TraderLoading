import assert from "node:assert/strict";
import { wilsonInterval, kellyFraction, rollingExpectancy, equityCurve, rHistogram } from "./edgeStats.js";

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

console.log("edge stats checks passed");
