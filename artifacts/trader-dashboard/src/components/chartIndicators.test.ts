import assert from "node:assert/strict";
import type { Time } from "lightweight-charts";
import {
  calculateDailyVwap,
  calculateVolumeProfile,
  hasEstimatedVolume,
} from "./chartIndicators.js";
import { getEuropeRomeDayRangeForTime } from "./chartSessionTime.js";
import { DEFAULT_VOLUME_PROFILE_SETTINGS } from "./chartAnalysisTypes.js";

const candle = (
  iso: string,
  high: number,
  low: number,
  close: number,
  volume?: number,
) => ({
  time: (Date.parse(iso) / 1000) as Time,
  open: low,
  high,
  low,
  close,
  volume,
});

const vwapCandles = [
  candle("2026-06-14T22:00:00.000Z", 1.12, 1.08, 1.1, 100),
  candle("2026-06-14T23:00:00.000Z", 1.22, 1.18, 1.2, 300),
  candle("2026-06-15T22:00:00.000Z", 1.32, 1.28, 1.3, 200),
];

const vwap = calculateDailyVwap(vwapCandles);
assert.equal(vwap.length, 3);
assert.equal(vwap[0]?.value.toFixed(5), "1.10000");
assert.equal(vwap[1]?.value.toFixed(5), "1.17500");
assert.equal(vwap[2]?.value.toFixed(5), "1.30000");

const fallbackCandles = [
  candle("2026-06-14T22:00:00.000Z", 11, 9, 10),
  candle("2026-06-14T23:00:00.000Z", 21, 19, 20),
];
const fallbackVwap = calculateDailyVwap(fallbackCandles);
assert.equal(fallbackVwap[1]?.value.toFixed(2), "15.00");
assert.equal(hasEstimatedVolume(fallbackCandles), true);
assert.equal(hasEstimatedVolume(vwapCandles), false);

const dayRange = getEuropeRomeDayRangeForTime(Date.parse("2026-06-15T12:00:00.000Z") / 1000);
const profile = calculateVolumeProfile(vwapCandles, dayRange, {
  ...DEFAULT_VOLUME_PROFILE_SETTINGS,
  rows: 4,
  valueAreaPercent: 70,
});
assert.equal(profile.estimatedVolume, false);
assert.equal(profile.buckets.length, 4);
assert.equal(profile.poc.volume, 300);
assert.ok(profile.valueAreaHigh >= profile.poc.priceLow);
assert.ok(profile.valueAreaLow <= profile.poc.priceHigh);

const fallbackProfile = calculateVolumeProfile(fallbackCandles, dayRange, {
  ...DEFAULT_VOLUME_PROFILE_SETTINGS,
  rows: 2,
});
assert.equal(fallbackProfile.estimatedVolume, true);
assert.equal(fallbackProfile.totalVolume, 2);

console.log("chart indicator checks passed");
