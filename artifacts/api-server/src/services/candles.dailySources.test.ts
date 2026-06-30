import assert from "node:assert/strict";
import { getCandles, getFallbackChain } from "./candles.js";

// ── Chain ordering: Railway-friendly D1/W1 sources lead, Yahoo demoted ────────
// (Yahoo blocks Railway's IP, so Dukascopy/Binance must be tried first for the
// latest window. Deep history from a startDate keeps the legacy Yahoo-first chain.)
const originalTwelveDataApiKey = process.env.TWELVEDATA_API_KEY;
delete process.env.TWELVEDATA_API_KEY; // keep TwelveData out of the ordering

const names = (symbol: string, interval: string, hasStartDate = false): string[] =>
  getFallbackChain(symbol, interval, hasStartDate).map((entry) => entry.name);

assert.deepEqual(names("EURUSD", "D1"), ["Dukascopy", "Yahoo"], "FX D1 → Dukascopy first");
assert.deepEqual(names("XAGUSD", "D1"), ["Dukascopy", "Yahoo"], "silver D1 → Dukascopy first");
assert.deepEqual(names("EURUSD", "W1"), ["Dukascopy", "Yahoo"], "FX W1 → Dukascopy first");
assert.deepEqual(names("BTCUSD", "D1"), ["Binance", "Yahoo", "CoinGecko"], "crypto D1 → Binance first");
assert.deepEqual(names("EURUSD", "D1", true), ["Yahoo"], "D1 with startDate → legacy Yahoo-first");
assert.deepEqual(names("EURUSD", "M15"), ["Yahoo"], "intraday chain unchanged");
assert.deepEqual(names("EURUSD", "H1"), ["Yahoo"], "H1 is not a daily source interval");

// With a TwelveData key, the fast single-call source leads FX/metals D1 ahead of
// the slow no-key Dukascopy fallback.
process.env.TWELVEDATA_API_KEY = "td_live_key";
assert.deepEqual(names("EURUSD", "D1"), ["TwelveData", "Dukascopy", "Yahoo"], "FX D1 with key → TwelveData first");
assert.deepEqual(names("XAGUSD", "D1"), ["TwelveData", "Dukascopy", "Yahoo"], "silver D1 with key → TwelveData first");
assert.deepEqual(names("BTCUSD", "D1"), ["Binance", "Yahoo", "CoinGecko"], "crypto D1 stays Binance-first");
delete process.env.TWELVEDATA_API_KEY;

// ── Integration: getCandles("BTCUSD","D1") is served by Binance, not Yahoo ────
const originalFetch = globalThis.fetch;
const originalWarehouse = process.env.CANDLE_WAREHOUSE;
delete process.env.CANDLE_WAREHOUSE; // warehouse off → live chain

try {
  const calls: string[] = [];
  // 130 daily klines: [openTime(ms), open, high, low, close, volume, closeTime].
  const dayMs = 86_400_000;
  const startMs = 1_700_000_000_000;
  const klines = Array.from({ length: 130 }, (_, i) => {
    const open = 40_000 + i * 10;
    return [startMs + i * dayMs, String(open), String(open + 50), String(open - 30), String(open + 20), "12.5", startMs + i * dayMs + dayMs - 1];
  });

  globalThis.fetch = (async (url: Parameters<typeof fetch>[0]) => {
    const raw = String(url);
    calls.push(raw);
    if (raw.includes("data-api.binance.vision")) return Response.json(klines);
    throw new Error(`unexpected fetch in test: ${raw}`);
  }) as typeof fetch;

  const result = await getCandles("BTCUSD", "D1");
  assert.equal(result.source, "binance", "crypto D1 served by Binance");
  assert.equal(result.candles.length, 130, "all daily klines returned");
  assert.ok(calls.length > 0 && calls.every((c) => c.includes("data-api.binance.vision")), "only Binance was hit");
  assert.match(calls[0] ?? "", /interval=1d/, "daily klines requested");
} finally {
  globalThis.fetch = originalFetch;
  if (originalWarehouse == null) delete process.env.CANDLE_WAREHOUSE;
  else process.env.CANDLE_WAREHOUSE = originalWarehouse;
  if (originalTwelveDataApiKey == null) delete process.env.TWELVEDATA_API_KEY;
  else process.env.TWELVEDATA_API_KEY = originalTwelveDataApiKey;
}

console.log("candles daily-source checks passed");
