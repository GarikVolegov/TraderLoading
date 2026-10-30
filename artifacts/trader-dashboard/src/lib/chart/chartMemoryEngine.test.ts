import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CHART_MEMORY,
  computeDailyChangeTelemetry,
  computeLiveAtrPips,
  formatRelativeHorizonDelta,
  intervalToSeconds,
} from "./chartMemoryEngine";
import type { ReplayCandle as Candle } from "@/lib/replay/types";

test("chartMemoryEngine: intervalToSeconds calcola i passi temporali esatti", () => {
  assert.equal(intervalToSeconds("1m"), 60);
  assert.equal(intervalToSeconds("5m"), 300);
  assert.equal(intervalToSeconds("15m"), 900);
  assert.equal(intervalToSeconds("1h"), 3600);
  assert.equal(intervalToSeconds("4h"), 14400);
  assert.equal(intervalToSeconds("1d"), 86400);
});

test("chartMemoryEngine: computeDailyChangeTelemetry calcola delta percentuale e pips stile Revolut", () => {
  // Candele con timestamp UTC garantito nello stesso giorno
  const baseTime = 1700006400; // 2023-11-14T20:00:00Z
  const candles: Candle[] = [
    { time: baseTime, open: 2000.0, high: 2010.0, low: 1995.0, close: 2005.0, volume: 100 },
    { time: baseTime + 3600, open: 2005.0, high: 2025.0, low: 2000.0, close: 2020.0, volume: 150 },
  ];

  const telemetry = computeDailyChangeTelemetry(candles, "XAUUSD");
  assert.ok(telemetry != null);
  // Diff price: 2020 - 2000 = 20
  assert.equal(telemetry.diffPrice, 20.0);
  // Diff pct: (20 / 2000) * 100 = 1%
  assert.equal(telemetry.diffPct, 1.0);
  // XAUUSD pip size è 1.0 => 20 / 1.0 = 20 pips/punti
  assert.equal(telemetry.diffPips, 20.0);
  assert.equal(telemetry.dayHigh, 2025.0);
  assert.equal(telemetry.dayLow, 1995.0);
});

test("chartMemoryEngine: computeLiveAtrPips calcola ATR(14) in pips", () => {
  const candles: Candle[] = [];
  const baseTime = 1700000000;
  for (let i = 0; i < 20; i++) {
    candles.push({
      time: baseTime + i * 3600,
      open: 1.1000 + i * 0.0005,
      high: 1.1020 + i * 0.0005,
      low: 1.0990 + i * 0.0005,
      close: 1.1010 + i * 0.0005,
      volume: 50,
    });
  }

  const atrPips = computeLiveAtrPips(candles, "EURUSD", 14);
  assert.ok(atrPips != null);
  // High - Low è 0.0030 = 30 pips (EURUSD pipSize = 0.0001)
  assert.ok(atrPips >= 25 && atrPips <= 35, `ATR atteso attorno a 30 pips, ottenuto ${atrPips}`);
});

test("chartMemoryEngine: formatRelativeHorizonDelta formatta orizzonti futuri e passati con precisione", () => {
  const deltaFutureSec = 3600 * 3 + 120; // +3 ore e 2 minuti nel futuro
  const textFuture = formatRelativeHorizonDelta(deltaFutureSec);
  assert.equal(textFuture, "Tra 3h 2m");

  const deltaPastSec = -3600 * 2; // -2 ore nel passato
  const textPast = formatRelativeHorizonDelta(deltaPastSec);
  assert.equal(textPast, "2h fa");

  const deltaImmediate = 10;
  assert.equal(formatRelativeHorizonDelta(deltaImmediate), "Adesso");
});
