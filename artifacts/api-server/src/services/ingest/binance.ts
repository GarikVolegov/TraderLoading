import type { Candle } from "../candles.js";
import { SOURCE_ID } from "../candleRegistry.js";
import { fetchWithRetry } from "../../lib/httpRetry.js";
import type { CandleSource } from "./types.js";

// Warehouse symbol → Binance spot pair. Binance quotes in USDT, used here as the
// USD proxy (documented limitation in the warehouse spec).
const PAIR: Record<string, string> = {
  BTCUSD: "BTCUSDT",
  ETHUSD: "ETHUSDT",
};

// Public market-data mirror: no auth, no geo restrictions, same kline payload.
const BASE_URL = "https://data-api.binance.vision/api/v3/klines";
const PAGE_LIMIT = 1000;

/**
 * Parse Binance kline rows into normalized candles. A kline row is
 * `[openTime(ms), open, high, low, close, volume, closeTime, ...]` with prices
 * and volume as strings. Pure and ascending; exported for unit testing.
 */
export function parseBinanceKlines(rows: unknown[]): Candle[] {
  const out: Candle[] = [];
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const candle: Candle = {
      time: Math.floor(Number(row[0]) / 1000),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    };
    const finite =
      Number.isFinite(candle.time) &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close);
    if (finite && candle.high >= candle.low) out.push(candle);
  }
  return out.sort((a, b) => a.time - b.time);
}

export const binanceSource: CandleSource = {
  id: SOURCE_ID.binance,
  name: "binance",
  supports: (symbol) => symbol in PAIR,
  async fetchRange(symbol, fromTs, toTs) {
    const pair = PAIR[symbol];
    if (!pair) throw new Error(`binance: unsupported symbol ${symbol}`);

    const endMs = toTs * 1000;
    let cursor = fromTs * 1000;
    const all: Candle[] = [];

    // Klines are capped at 1000 rows/call; page forward by the last bar's time.
    while (cursor < endMs) {
      const url = `${BASE_URL}?symbol=${pair}&interval=1m&startTime=${cursor}&endTime=${endMs}&limit=${PAGE_LIMIT}`;
      // Retry transient 429/5xx so one blip doesn't abort a month-long ingestion run.
      const response = await fetchWithRetry(url, { timeoutMs: 15000 });
      if (!response.ok) throw new Error(`binance HTTP ${response.status}`);

      const rows = (await response.json()) as unknown[];
      if (!Array.isArray(rows) || rows.length === 0) break;

      all.push(...parseBinanceKlines(rows));
      const lastOpenMs = Number((rows[rows.length - 1] as unknown[])[0]);
      if (!Number.isFinite(lastOpenMs)) break;
      cursor = lastOpenMs + 60_000; // next minute
      if (rows.length < PAGE_LIMIT) break; // final page
    }

    return all;
  },
};
