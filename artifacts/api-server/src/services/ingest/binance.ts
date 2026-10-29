import type { Candle } from "../candles.js";
import { SOURCE_ID } from "../candleRegistry.js";
import { fetchWithRetry } from "../../lib/httpRetry.js";
import type { CandleSource } from "./types.js";
import { fetchBinanceMonthlyZip, isFullCalendarMonth } from "./binanceArchive.js";

// Warehouse symbol → Binance spot pair. Binance quotes in USDT, used here as the
// USD proxy (documented limitation in the warehouse spec).
const PAIR: Record<string, string> = {
  BTCUSD: "BTCUSDT",
  ETHUSD: "ETHUSDT",
};

// Public market-data mirror: no auth, no geo restrictions, same kline payload.
const BASE_URL = "https://data-api.binance.vision/api/v3/klines";
const PAGE_LIMIT = 1000;

// Step (ms) used to advance the paging cursor past the last returned bar.
const INTERVAL_STEP_MS: Record<string, number> = {
  "1m": 60_000,
  "1d": 86_400_000,
};

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

async function fetchBinanceRange(
  pair: string,
  binanceInterval: string,
  fromTs: number,
  toTs: number,
): Promise<Candle[]> {
  const stepMs = INTERVAL_STEP_MS[binanceInterval];
  if (!stepMs) throw new Error(`binance: unsupported interval ${binanceInterval}`);

  const endMs = toTs * 1000 - 1;
  let cursor = fromTs * 1000;
  const all: Candle[] = [];

  // Klines are capped at 1000 rows/call; page forward by the last bar's time.
  while (cursor <= endMs) {
    const url = `${BASE_URL}?symbol=${pair}&interval=${binanceInterval}&startTime=${cursor}&endTime=${endMs}&limit=${PAGE_LIMIT}`;
    // Retry transient 429/5xx so one blip doesn't abort a month-long ingestion run.
    const response = await fetchWithRetry(url, { timeoutMs: 15000 });
    if (!response.ok) throw new Error(`binance HTTP ${response.status}`);

    const rows = (await response.json()) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) break;

    all.push(...parseBinanceKlines(rows));
    const lastOpenMs = Number((rows[rows.length - 1] as unknown[])[0]);
    if (!Number.isFinite(lastOpenMs)) break;
    cursor = lastOpenMs + stepMs; // next bar
    if (rows.length < PAGE_LIMIT) break; // final page
  }

  // Strictly enforce upper bound < toTs and deduplicate on timestamps
  const seen = new Set<number>();
  const out: Candle[] = [];
  for (const c of all) {
    if (c.time < toTs && !seen.has(c.time)) {
      seen.add(c.time);
      out.push(c);
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Whether the live daily fetcher can serve this symbol. */
export function binanceSupportsDaily(symbol: string): boolean {
  return symbol in PAIR;
}

/**
 * Fetch daily (D1) candles for the live serving layer. Uses Binance's public
 * data mirror, which (unlike Yahoo) is reachable from Railway's datacenter IP.
 * Ascending, UTC unix-second open-times.
 */
export async function fetchBinanceDaily(symbol: string, fromTs: number, toTs: number): Promise<Candle[]> {
  const pair = PAIR[symbol];
  if (!pair) throw new Error(`binance: unsupported symbol ${symbol}`);
  return fetchBinanceRange(pair, "1d", fromTs, toTs);
}

export const binanceSource: CandleSource = {
  id: SOURCE_ID.binance,
  name: "binance",
  supports: (symbol) => symbol in PAIR,
  async fetchRange(symbol, fromTs, toTs) {
    const pair = PAIR[symbol];
    if (!pair) throw new Error(`binance: unsupported symbol ${symbol}`);

    // Fast-path: monthly static archive download (1.2s per 44k M1 candles, zero rate-limit)
    if (isFullCalendarMonth(fromTs, toTs)) {
      const date = new Date(fromTs * 1000);
      try {
        const zipCandles = await fetchBinanceMonthlyZip(pair, date.getUTCFullYear(), date.getUTCMonth() + 1);
        if (zipCandles && zipCandles.length > 0) {
          return zipCandles.filter((c) => c.time >= fromTs && c.time < toTs);
        }
      } catch (err) {
        console.warn(`[binance] Archive zip fallback for ${pair} ${date.toISOString().slice(0, 7)}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return fetchBinanceRange(pair, "1m", fromTs, toTs);
  },
};
