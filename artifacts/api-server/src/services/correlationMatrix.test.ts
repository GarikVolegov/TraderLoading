import assert from "node:assert/strict";
import {
  dailyReturns,
  pearson,
  correlationMatrix,
  concentrationSignals,
  type SymbolSeries,
  type Position,
} from "./correlationMatrix.js";

// Idea 5B (portfolio concentration risk): pure correlation math over D1 closes, then
// direction-aware concentration detection — "long EURUSD + long GBPUSD = double short
// USD". Fully unit-testable, no I/O.

// ── dailyReturns ──────────────────────────────────────────────────────────────
assert.deepEqual(dailyReturns([100, 110, 99]), [0.1, -0.1]);
assert.deepEqual(dailyReturns([100]), [], "need at least two closes");
assert.deepEqual(dailyReturns([]), []);
assert.deepEqual(dailyReturns([0, 50]), [0], "a zero prior close yields 0, not Infinity");

// ── pearson ───────────────────────────────────────────────────────────────────
assert.equal(pearson([0.1, -0.1], [0.1, -0.1]), 1, "identical → +1");
assert.equal(pearson([0.1, -0.1], [-0.1, 0.1]), -1, "mirrored → −1");
assert.equal(pearson([1, 1, 1], [1, 2, 3]), null, "zero variance → null");
assert.equal(pearson([1, 2], [1, 2, 3]), null, "length mismatch → null");
assert.equal(pearson([1], [1]), null, "need at least two points → null");

// ── correlationMatrix ─────────────────────────────────────────────────────────
const series: SymbolSeries[] = [
  { symbol: "EURUSD", closes: [100, 110, 99] }, // returns  [0.1, -0.1]
  { symbol: "GBPUSD", closes: [100, 110, 99] }, // returns  [0.1, -0.1]  → +1 with EUR
  { symbol: "USDCHF", closes: [100, 90, 99] }, //  returns [-0.1, 0.1]  → −1 with EUR
];
const cm = correlationMatrix(series);
assert.deepEqual(cm.symbols, ["EURUSD", "GBPUSD", "USDCHF"], "symbol order preserved");
assert.equal(cm.window, 2, "window = shared return count");
assert.equal(cm.matrix[0][0], 1, "self-correlation is 1");
assert.equal(cm.matrix[0][1], 1, "EURUSD vs GBPUSD");
assert.equal(cm.matrix[0][2], -1, "EURUSD vs USDCHF");
assert.equal(cm.matrix[1][2], cm.matrix[2][1], "matrix is symmetric");

// ── concentrationSignals (direction-aware) ────────────────────────────────────
// Two longs on positively-correlated pairs compound into one bigger bet.
{
  const positions: Position[] = [
    { symbol: "EURUSD", direction: "long" },
    { symbol: "GBPUSD", direction: "long" },
  ];
  const signals = concentrationSignals(positions, cm);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].effect, "compounding");
  assert.equal(signals[0].correlation, 1);
}
// Long EURUSD + short USDCHF (which is anti-correlated to EURUSD) is also one bet.
{
  const positions: Position[] = [
    { symbol: "EURUSD", direction: "long" },
    { symbol: "USDCHF", direction: "short" },
  ];
  const signals = concentrationSignals(positions, cm);
  assert.equal(signals[0].effect, "compounding", "long EUR + short CHF (anti-corr) = same bet");
}
// Long both anti-correlated pairs actually hedges.
{
  const positions: Position[] = [
    { symbol: "EURUSD", direction: "long" },
    { symbol: "USDCHF", direction: "long" },
  ];
  const signals = concentrationSignals(positions, cm);
  assert.equal(signals[0].effect, "hedging");
}
// Below the threshold, nothing is flagged. (Need ≥3 returns for an intermediate
// correlation — with 2 returns any two series are collinear at ±1.) These closes
// give returns [0.1,-0.1,0.1] and [0.1,0.1,-0.2], correlation exactly −0.5.
{
  const weak = correlationMatrix([
    { symbol: "AAA", closes: [100, 110, 99, 108.9] },
    { symbol: "BBB", closes: [100, 110, 121, 96.8] },
  ]);
  assert.equal(weak.matrix[0][1], -0.5, "constructed correlation is exactly −0.5");
  const signals = concentrationSignals(
    [
      { symbol: "AAA", direction: "long" },
      { symbol: "BBB", direction: "long" },
    ],
    weak,
    0.9,
  );
  assert.equal(signals.length, 0, "|−0.5| below the 0.9 threshold is not a concentration");
}
// Positions not in the matrix are ignored, not crashed on.
{
  const signals = concentrationSignals([{ symbol: "NOPE", direction: "long" }], cm);
  assert.deepEqual(signals, []);
}

console.log("correlation matrix checks passed");
