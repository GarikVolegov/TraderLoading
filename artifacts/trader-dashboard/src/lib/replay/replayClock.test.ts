import assert from "node:assert/strict";
import { cursorAtReplayTime, logicalIndexAtTime, revealAtReplayTime, timeAtLogicalIndex } from "./replayClock";
import type { ReplayCandle } from "./types";

const origin = Date.UTC(2022, 0, 3) / 1000;
const bars = (seconds: number): ReplayCandle[] => Array.from({ length: 2200 }, (_, index) => ({
  time: origin + index * seconds, open: 1, high: 9, low: 0.1, close: 5,
}));
const logicalClock = origin + 30 * 3600 + 17 * 60;

// Switching M1→H4→D1→H1→M1 uses one exact instant, rather than recomputing
// the new interval's close and drifting forward or clamping into recent data.
for (const seconds of [60, 4 * 3600, 86400, 3600, 60]) {
  const series = bars(seconds);
  const current = cursorAtReplayTime(series, logicalClock);
  assert.equal(current, Math.min(2199, Math.ceil((logicalClock - origin) / seconds) - 1));
  const at = series[current];
  const partial = { ...at, high: 1.2, low: 1, close: 1.1 };
  const shown = revealAtReplayTime(series, logicalClock, seconds, partial);
  if (at.time + seconds > logicalClock) assert.equal(shown.at(-1)?.high, 1.2, "future high 9 must never leak");
  assert.ok(shown.every((bar) => bar.time < logicalClock));
}
assert.equal(cursorAtReplayTime(bars(60), origin), -1, "exclusive cutoff before first observation");
assert.equal(revealAtReplayTime(bars(60), origin, 60, null).length, 0);
assert.equal(revealAtReplayTime(bars(60), origin + 60, 60, null).length, 1, "next from dataset start reveals the first M1 without requiring warm-up bars");
assert.equal(cursorAtReplayTime(bars(60), origin + 60), 0, "exact boundary excludes next bar");
assert.deepEqual(revealAtReplayTime(bars(3600), origin + 17 * 60, 3600, null), [], "missing partial never reveals complete future candle");
assert.equal(logicalIndexAtTime(bars(3600), origin + 90 * 60, 3600), 1.5, "M1 drawings stay anchored on H1");
assert.equal(logicalIndexAtTime([], origin, 3600), null);
const shortSeries = bars(3600).slice(0, 10);
assert.equal(timeAtLogicalIndex(shortSeries, 12, 3600), shortSeries[9].time + 3 * 3600, "future whitespace extrapolates time beyond last bar");
// Sub-bar continuous fractional resolution (TradingView & FX Replay multi-timeframe exactness)
const fractionalLogical = 3.25; // 15 mins into bar 3
const reconstructedTime = timeAtLogicalIndex(shortSeries, fractionalLogical, 3600);
assert.equal(reconstructedTime, shortSeries[3].time + 900, "fractional logical index 3.25 must resolve to +900s");
assert.equal(logicalIndexAtTime(shortSeries, reconstructedTime!, 3600), 3.25, "roundtrip logical index must be exact 3.25");
assert.equal(timeAtLogicalIndex([], 5, 3600), null);
console.log("replayClock checks passed");
