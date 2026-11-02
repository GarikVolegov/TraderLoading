import assert from "node:assert/strict";
import { test } from "node:test";
import { synthesizeIntradayCandles } from "./intradaySynthesizer.js";
import type { Candle } from "./candles.js";

test("intradaySynthesizer satisfies mathematical boundaries and lore precision", () => {
  const day1: Candle = {
    time: 1704153600, // 2024-01-02 00:00:00 UTC
    open: 1.10387,
    high: 1.10461,
    low: 1.09420,
    close: 1.09550,
    volume: 54000,
  };

  const day2: Candle = {
    time: 1704240000, // 2024-01-03 00:00:00 UTC
    open: 1.09550,
    high: 1.09980,
    low: 1.09110,
    close: 1.09840,
    volume: 48000,
  };

  // Test M15 (96 bars per day)
  const m15 = synthesizeIntradayCandles([day1, day2], "M15", "EURUSD");
  assert.equal(m15.length, 192, "Two days of M15 must yield 192 bars");

  // Day 1 checks
  const day1Bars = m15.slice(0, 96);
  assert.equal(day1Bars[0].open, day1.open, "Day 1 first bar open must equal day.open");
  assert.equal(day1Bars[95].close, day1.close, "Day 1 last bar close must equal day.close");
  const maxHigh1 = Math.max(...day1Bars.map((b) => b.high));
  const minLow1 = Math.min(...day1Bars.map((b) => b.low));
  assert.equal(maxHigh1, day1.high, "Day 1 max high must equal day.high");
  assert.equal(minLow1, day1.low, "Day 1 min low must equal day.low");

  // Day 2 checks
  const day2Bars = m15.slice(96);
  assert.equal(day2Bars[0].open, day2.open, "Day 2 first bar open must equal day.open");
  assert.equal(day2Bars[95].close, day2.close, "Day 2 last bar close must equal day.close");
  const maxHigh2 = Math.max(...day2Bars.map((b) => b.high));
  const minLow2 = Math.min(...day2Bars.map((b) => b.low));
  assert.equal(maxHigh2, day2.high, "Day 2 max high must equal day.high");
  assert.equal(minLow2, day2.low, "Day 2 min low must equal day.low");

  // Continuity check: each bar's high >= low and bounds open/close
  for (const bar of m15) {
    assert.ok(bar.high >= bar.low, `Bar high ${bar.high} must be >= low ${bar.low}`);
    assert.ok(bar.high >= bar.open && bar.high >= bar.close, "High must be >= open and close");
    assert.ok(bar.low <= bar.open && bar.low <= bar.close, "Low must be <= open and close");
    assert.ok(bar.volume && bar.volume > 0, "Volume must be positive");
  }

  // Determinism check: identical seed generates identical bars
  const m15Again = synthesizeIntradayCandles([day1], "M15", "EURUSD");
  assert.deepEqual(m15Again, day1Bars, "Synthesis must be 100% deterministic");
});
