import assert from "node:assert/strict";
import { parseBinanceKlines } from "./binance.js";

// Binance kline: [openTime(ms), open, high, low, close, volume, closeTime, ...]
const rows: unknown[] = [
  [1704067200000, "42000.0", "42100.5", "41950.0", "42080.0", "12.345", 1704067259999],
  [1704067260000, "42080.0", "42090.0", "41990.0", "42010.0", "8.5", 1704067319999],
];

{
  const candles = parseBinanceKlines(rows);
  assert.equal(candles.length, 2, "parses both klines");
  assert.equal(candles[0].time, 1704067200, "ms → seconds");
  assert.equal(candles[0].open, 42000, "open parsed from string");
  assert.equal(candles[0].high, 42100.5, "high parsed");
  assert.equal(candles[0].low, 41950, "low parsed");
  assert.equal(candles[0].close, 42080, "close parsed");
  assert.equal(candles[0].volume, 12.345, "fractional base volume preserved");
}

// Out-of-order input is sorted; malformed rows are dropped.
{
  const messy: unknown[] = [
    [1704067260000, "2", "3", "1", "2.5", "5"],
    "not-an-array",
    [1704067200000, "1", "2", "0", "1.5", "9"],
    [1704067320000, "9", "8", "9", "9", "1"], // high < low → dropped
  ];
  const candles = parseBinanceKlines(messy);
  assert.equal(candles.length, 2, "drops non-array and high<low rows");
  assert.ok(candles[0].time < candles[1].time, "ascending by time");
}

console.log("binance.test.ts: all assertions passed");
