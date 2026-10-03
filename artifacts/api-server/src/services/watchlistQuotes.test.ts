import assert from "node:assert/strict";
import {
  WATCHLIST_MAX_PAIRS,
  WATCHLIST_SPARK_POINTS,
  buildWatchlistItem,
  parseWatchlistPairsParam,
} from "./watchlistQuotes.js";
import type { Candle } from "./candles.js";

// ── parseWatchlistPairsParam ─────────────────────────────────────────────────

// Canonicalizes case and separators, keeps request order
assert.deepEqual(parseWatchlistPairsParam("eurusd,GBP/USD, usdjpy "), [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
]);

// Dedupes while preserving first occurrence
assert.deepEqual(parseWatchlistPairsParam("EURUSD,eurusd,GBPUSD,EUR/USD"), [
  "EURUSD",
  "GBPUSD",
]);

// Unsupported pairs are kept (the route marks them supported: false)
assert.deepEqual(parseWatchlistPairsParam("EURUSD,USDNOK"), ["EURUSD", "USDNOK"]);

// Junk and empties dropped; non-string input → empty list
assert.deepEqual(parseWatchlistPairsParam(",, ,"), []);
assert.deepEqual(parseWatchlistPairsParam(undefined), []);
assert.deepEqual(parseWatchlistPairsParam(42 as unknown as string), []);
// Symbols that aren't plausible tickers are dropped
assert.deepEqual(parseWatchlistPairsParam("EURUSD,<script>,US30!"), ["EURUSD"]);

// Capped at WATCHLIST_MAX_PAIRS
const many = Array.from({ length: WATCHLIST_MAX_PAIRS + 5 }, (_, i) => `PAIR${String(i).padStart(2, "0")}`).join(",");
assert.equal(parseWatchlistPairsParam(many).length, WATCHLIST_MAX_PAIRS);

// ── buildWatchlistItem ───────────────────────────────────────────────────────

function mkCandles(closes: number[]): Candle[] {
  return closes.map((close, i) => ({
    time: 1_750_000_000 + i * 86_400,
    open: close - 0.001,
    high: close + 0.002,
    low: close - 0.002,
    close,
  }));
}

// Normal series: price = last close, changePct vs previous close, spark = closes
{
  const item = buildWatchlistItem("EURUSD", mkCandles([1.08, 1.09, 1.1]), true);
  assert.equal(item.pair, "EURUSD");
  assert.equal(item.supported, true);
  assert.equal(item.price, 1.1);
  assert.ok(item.changePct !== null && Math.abs(item.changePct - ((1.1 - 1.09) / 1.09) * 100) < 1e-9);
  assert.deepEqual(item.spark, [1.08, 1.09, 1.1]);
  assert.equal(item.time, 1_750_000_000 + 2 * 86_400);
}

// Spark windows to the last WATCHLIST_SPARK_POINTS closes
{
  const closes = Array.from({ length: WATCHLIST_SPARK_POINTS + 10 }, (_, i) => 1 + i * 0.01);
  const item = buildWatchlistItem("EURUSD", mkCandles(closes), true);
  assert.equal(item.spark.length, WATCHLIST_SPARK_POINTS);
  assert.equal(item.spark[item.spark.length - 1], closes[closes.length - 1]);
  assert.equal(item.spark[0], closes[closes.length - WATCHLIST_SPARK_POINTS]);
}

// Single bar: price known, changePct null
{
  const item = buildWatchlistItem("EURUSD", mkCandles([1.5]), true);
  assert.equal(item.price, 1.5);
  assert.equal(item.changePct, null);
  assert.deepEqual(item.spark, [1.5]);
}

// Flat series: changePct 0, not null
{
  const item = buildWatchlistItem("EURUSD", mkCandles([1.2, 1.2]), true);
  assert.equal(item.changePct, 0);
}

// Zero previous close: changePct null (no divide-by-zero)
{
  const item = buildWatchlistItem("EURUSD", mkCandles([0, 1.2]), true);
  assert.equal(item.changePct, null);
}

// No data: nulls + empty spark
{
  const item = buildWatchlistItem("USDNOK", null, false);
  assert.deepEqual(item, {
    pair: "USDNOK",
    price: null,
    changePct: null,
    spark: [],
    time: null,
    supported: false,
  });
}

// Empty candle array behaves like no data
{
  const item = buildWatchlistItem("EURUSD", [], true);
  assert.equal(item.price, null);
  assert.deepEqual(item.spark, []);
}

console.log("watchlist quotes helper checks passed");
