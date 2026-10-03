import assert from "node:assert/strict";
import {
  computeLots,
  pipSize,
  pipValuePerLot,
  riskAmountFor,
  riskRewardRatio,
} from "./lotSizing";

// pipValuePerLot mirrors the legacy getPipDollarValue semantics (per 1.00 lot)
assert.equal(pipValuePerLot("EUR/USD"), 10);
assert.equal(pipValuePerLot("USDJPY"), 10);
assert.equal(pipValuePerLot("XAUUSD"), 10);
assert.equal(pipValuePerLot("US30"), 1);
assert.equal(pipValuePerLot("NAS100"), 1);
assert.equal(pipValuePerLot("BTC/USD"), 1);
assert.equal(pipValuePerLot("ETHUSD"), 1);

// pipSize is the price increment of one pip (inverse of the pip multiplier)
assert.equal(pipSize("EURUSD"), 1 / 10000);
assert.equal(pipSize("USDJPY"), 1 / 100);
assert.equal(pipSize("XAUUSD"), 1 / 10);
assert.equal(pipSize("US30"), 1);
assert.equal(pipSize("BTCUSD"), 1);

// mockup formula: lots = riskAmount / (slPips · pipValuePerLot), floored to 0.01
assert.equal(computeLots({ riskAmount: 100, slPips: 20, symbol: "EURUSD" }), 0.5);
assert.equal(computeLots({ riskAmount: 100, slPips: 30, symbol: "EURUSD" }), 0.33);
assert.equal(computeLots({ riskAmount: 250, slPips: 50, symbol: "US30" }), 5);
// floor, never round up (risk must not exceed the requested amount)
assert.equal(computeLots({ riskAmount: 99, slPips: 100, symbol: "EURUSD" }), 0.09);
// degenerate inputs → 0 lots
assert.equal(computeLots({ riskAmount: 100, slPips: 0, symbol: "EURUSD" }), 0);
assert.equal(computeLots({ riskAmount: 100, slPips: -5, symbol: "EURUSD" }), 0);
assert.equal(computeLots({ riskAmount: 0, slPips: 20, symbol: "EURUSD" }), 0);
assert.equal(computeLots({ riskAmount: NaN, slPips: 20, symbol: "EURUSD" }), 0);

// risk amount: percent of balance vs fixed
assert.equal(riskAmountFor({ mode: "percent", value: 1, balance: 10_000 }), 100);
assert.equal(riskAmountFor({ mode: "percent", value: 2.5, balance: 8_000 }), 200);
assert.equal(riskAmountFor({ mode: "fixed", value: 150, balance: 10_000 }), 150);
assert.equal(riskAmountFor({ mode: "percent", value: -1, balance: 10_000 }), 0);
assert.equal(riskAmountFor({ mode: "fixed", value: NaN, balance: 10_000 }), 0);

// R:R
assert.equal(riskRewardRatio(20, 40), 2);
assert.equal(riskRewardRatio(20, 30), 1.5);
assert.equal(riskRewardRatio(0, 40), null);
assert.equal(riskRewardRatio(20, 0), 0);

console.log("lotSizing checks passed");
