import assert from "node:assert/strict";
import { calculateVolatilityMetrics, getVolatilityUnit } from "./volatility.js";

const timestamps = [
  1_780_000_000,
  1_780_086_400,
  1_780_172_800,
  1_780_259_200,
  1_780_345_600,
  1_780_432_000,
];

assert.deepEqual(getVolatilityUnit("XAUUSD"), {
  multiplier: 10,
  pipUnit: "punti",
});

assert.deepEqual(getVolatilityUnit("XAGUSD"), {
  multiplier: 100,
  pipUnit: "punti",
});

const goldMetrics = calculateVolatilityMetrics("XAUUSD", {
  timestamps,
  high: [4300, 4312, 4320, 4333, 4348, 4360],
  low: [4270, 4300, 4305, 4311, 4320, 4330],
  close: [4285, 4308, 4312, 4324, 4335, 4348],
  meta: {
    regularMarketPrice: 4348,
    regularMarketDayHigh: 4365.5,
    regularMarketDayLow: 4324.2,
  },
});

assert.equal(goldMetrics.todayPips, 413);
assert.equal(goldMetrics.w1, 214);
assert.equal(goldMetrics.y1, 228.3);
assert.equal(goldMetrics.pipUnit, "punti");

assert.deepEqual(getVolatilityUnit("EURUSD"), {
  multiplier: 10000,
  pipUnit: "pip",
});

const eurMetrics = calculateVolatilityMetrics("EURUSD", {
  timestamps,
  high: [1.1012, 1.1025, 1.1031, 1.1044, 1.1050, 1.1062],
  low: [1.1000, 1.1010, 1.1018, 1.1030, 1.1036, 1.1050],
  close: [1.1008, 1.1018, 1.1025, 1.1036, 1.1042, 1.1056],
  meta: {
    regularMarketPrice: 1.1056,
    regularMarketDayHigh: 1.1064,
    regularMarketDayLow: 1.1051,
  },
});

assert.equal(eurMetrics.todayPips, 13);
assert.equal(eurMetrics.w1, 13.6);
assert.equal(eurMetrics.pipUnit, "pip");

console.log("volatility metric checks passed");
