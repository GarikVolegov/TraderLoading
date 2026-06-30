import assert from "node:assert/strict";
import {
  calculateVolatilityMetrics,
  candlesToVolatilityInput,
  getVolatilityUnit,
  trimToRecentDays,
} from "./volatility.js";

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

// ── trimToRecentDays keeps only bars within `days` of the latest bar ─────────
{
  const T = 1_800_000_000;
  const day = 86_400;
  const series = [
    { time: T - 400 * day, high: 2, low: 1, close: 1.5 },
    { time: T - 100 * day, high: 2, low: 1, close: 1.5 },
    { time: T, high: 2, low: 1, close: 1.5 },
  ];
  const trimmed = trimToRecentDays(series, 366);
  assert.equal(trimmed.length, 2, "drops the bar older than 366 days");
  assert.equal(trimmed[0].time, T - 100 * day);
  assert.deepEqual(trimToRecentDays([], 366), [], "empty input is a no-op");
}

// ── candlesToVolatilityInput maps OHLC arrays, no meta ───────────────────────
{
  const input = candlesToVolatilityInput([
    { time: 1, high: 1.2, low: 1.0, close: 1.1 },
    { time: 2, high: 1.3, low: 1.1, close: 1.2 },
  ]);
  assert.deepEqual(input.timestamps, [1, 2]);
  assert.deepEqual(input.high, [1.2, 1.3]);
  assert.deepEqual(input.low, [1.0, 1.1]);
  assert.deepEqual(input.close, [1.1, 1.2]);
  assert.equal(input.meta, undefined);
}

// ── end-to-end: candle series → input → metrics (no Yahoo meta) ──────────────
{
  const day = 86_400;
  // 30 daily bars, each with a 10-pip (0.0010) range for EURUSD.
  const dailySeries = Array.from({ length: 30 }, (_, i) => {
    const base = 1.1 + i * 0.0005;
    return { time: 1_780_000_000 + i * day, high: base + 0.001, low: base, close: base + 0.0005 };
  });
  const metrics = calculateVolatilityMetrics("EURUSD", candlesToVolatilityInput(dailySeries));
  assert.equal(metrics.y1, 10, "1Y average range is 10 pips");
  assert.equal(metrics.w1, 10, "5d average range is 10 pips");
  assert.equal(metrics.todayPips, 10, "todayPips falls back to the last bar's range");
  assert.equal(metrics.pipUnit, "pip");
  assert.equal(metrics.label, "Nella norma");
  assert.equal(metrics.dataPoints.length, 30);
}

console.log("volatility metric checks passed");
