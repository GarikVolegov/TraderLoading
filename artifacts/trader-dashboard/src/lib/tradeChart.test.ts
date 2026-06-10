import assert from "node:assert/strict";
import { normalizeTradeSymbol, pickChartInterval, selectTradeWindow, type ChartCandle } from "./tradeChart.js";

// Normalizzazione simboli
assert.equal(normalizeTradeSymbol("XAUUSD.R"), "XAUUSD");
assert.equal(normalizeTradeSymbol("xauusd"), "XAUUSD");
assert.equal(normalizeTradeSymbol("XAU/USD"), "XAUUSD");
assert.equal(normalizeTradeSymbol("EURUSD.pro"), "EURUSD");
assert.equal(normalizeTradeSymbol("SCONOSCIUTO"), null);
assert.equal(normalizeTradeSymbol(undefined), null);

// Scelta timeframe per durata
assert.equal(pickChartInterval("2026-06-01T10:00:00Z", "2026-06-01T10:45:00Z"), "M15");
assert.equal(pickChartInterval("2026-06-01T10:00:00Z", "2026-06-01T20:00:00Z"), "H1");
assert.equal(pickChartInterval("2026-06-01T10:00:00Z", "2026-06-03T10:00:00Z"), "H4");
assert.equal(pickChartInterval("2026-06-01T10:00:00Z", "2026-06-20T10:00:00Z"), "D1");
assert.equal(pickChartInterval("invalid", "2026-06-01T10:00:00Z"), "H1");

// Finestra candele: 100 candele orarie a partire dal 1 giugno 00:00 UTC
const base = Math.floor(new Date("2026-06-01T00:00:00Z").getTime() / 1000);
const candles: ChartCandle[] = Array.from({ length: 100 }, (_, i) => ({
  time: base + i * 3600,
  open: 100 + i,
  high: 101 + i,
  low: 99 + i,
  close: 100.5 + i,
}));

// Trade dalle 10:00 alle 14:00 del 1 giugno → candele 10..14, pad 3 → 7..17
const window = selectTradeWindow(candles, "2026-06-01T10:00:00Z", "2026-06-01T14:00:00Z", 3);
assert.equal(window[0].time, base + 7 * 3600);
assert.equal(window[window.length - 1].time, base + 17 * 3600);

// Trade fuori range (molto prima della prima candela) → []
assert.deepEqual(selectTradeWindow(candles, "2020-01-01T00:00:00Z", "2020-01-02T00:00:00Z", 3), []);
// Date invalide → []
assert.deepEqual(selectTradeWindow(candles, "boh", "2026-06-01T14:00:00Z"), []);
assert.deepEqual(selectTradeWindow([], "2026-06-01T10:00:00Z", "2026-06-01T14:00:00Z"), []);

console.log("trade chart helper checks passed");
