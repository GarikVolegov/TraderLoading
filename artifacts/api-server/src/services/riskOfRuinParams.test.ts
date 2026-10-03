import assert from "node:assert/strict";
import { parseRiskOfRuinParams } from "./riskOfRuinParams.js";

// Idea 5B: bound the risk-of-ruin bootstrap request so `sims`/`trades` can't spin
// the CPU (same DoS class as monteCarloParams). Pure clamp/validate.

// Empty body → sane defaults.
assert.deepEqual(parseRiskOfRuinParams({}), {
  riskFraction: 0.01,
  ruinThreshold: 0.5,
  trades: 100,
  sims: 500,
});

// Non-object → defaults, never throws.
assert.deepEqual(parseRiskOfRuinParams(null), parseRiskOfRuinParams({}));
assert.deepEqual(parseRiskOfRuinParams("nope"), parseRiskOfRuinParams({}));

// Out-of-range values are clamped, not rejected.
{
  const p = parseRiskOfRuinParams({ riskFraction: 5, ruinThreshold: 2, trades: 999999, sims: -5 });
  assert.equal(p.riskFraction, 1, "riskFraction capped at 1");
  assert.equal(p.ruinThreshold, 0.99, "ruinThreshold capped below 1");
  assert.equal(p.trades, 1000, "trades capped at 1000 (DoS guard)");
  assert.equal(p.sims, 1, "sims floored at 1");
}

// riskPercent (0..100 UI input) is accepted as a fallback and converted to a fraction.
assert.equal(parseRiskOfRuinParams({ riskPercent: 2 }).riskFraction, 0.02);
// …but an explicit riskFraction wins over riskPercent.
assert.equal(parseRiskOfRuinParams({ riskFraction: 0.005, riskPercent: 50 }).riskFraction, 0.005);

// String inputs are coerced.
{
  const p = parseRiskOfRuinParams({ riskFraction: "0.02", trades: "250", sims: "800" });
  assert.equal(p.riskFraction, 0.02);
  assert.equal(p.trades, 250);
  assert.equal(p.sims, 800);
}

// trades / sims are integers.
{
  const p = parseRiskOfRuinParams({ trades: 100.7, sims: 500.4 });
  assert.equal(p.trades, 101);
  assert.equal(p.sims, 500);
}

console.log("risk-of-ruin params checks passed");
