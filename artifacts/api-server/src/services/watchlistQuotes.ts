// ─── Watchlist quotes (pure helpers) ─────────────────────────────────────────
// Pure logic behind GET /tools/watchlist: parse the requested pairs and shape a
// D1 candle series into the sparkline-row payload the dashboard widget renders.
// IO (candle fetch + SWR caching) lives in routes/tools.ts, volatility-style.

import type { Candle } from "./candles.js";

export const WATCHLIST_MAX_PAIRS = 12;
export const WATCHLIST_SPARK_POINTS = 30;

/** Plausible canonical ticker: 2–12 uppercase letters/digits (EURUSD, US30, BTCUSD). */
const TICKER_RE = /^[A-Z0-9]{2,12}$/;

export interface WatchlistItem {
  pair: string;
  /** Close of the last D1 bar (the developing daily candle when the source provides it). */
  price: number | null;
  /** Daily change %: last close vs previous close. */
  changePct: number | null;
  /** Last ≤WATCHLIST_SPARK_POINTS D1 closes, oldest → newest. */
  spark: number[];
  /** Epoch seconds of the last bar. */
  time: number | null;
  /** Whether the candle chain can serve this pair. */
  supported: boolean;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
}

/**
 * Canonicalize the `pairs` query param: split on commas, uppercase, strip "/",
 * drop junk, dedupe preserving order, cap at WATCHLIST_MAX_PAIRS. Unsupported
 * pairs are kept — the route marks them `supported: false` so the client can
 * still render the row (label + deep link, no data).
 */
export function parseWatchlistPairsParam(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  const seen = new Set<string>();
  const pairs: string[] = [];
  for (const part of raw.split(",")) {
    const symbol = part.trim().toUpperCase().replaceAll("/", "");
    if (!TICKER_RE.test(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    pairs.push(symbol);
    if (pairs.length >= WATCHLIST_MAX_PAIRS) break;
  }
  return pairs;
}

/** Shape a pair's D1 series into a watchlist item; null-safe for missing data. */
export function buildWatchlistItem(
  pair: string,
  candles: Candle[] | null,
  supported: boolean,
): WatchlistItem {
  if (!candles || candles.length === 0) {
    return { pair, price: null, changePct: null, spark: [], time: null, supported };
  }
  const spark = candles.slice(-WATCHLIST_SPARK_POINTS).map((candle) => candle.close);
  const last = candles[candles.length - 1];
  const prev = candles.length >= 2 ? candles[candles.length - 2] : null;
  const changePct =
    prev && prev.close !== 0 ? ((last.close - prev.close) / prev.close) * 100 : null;
  return { pair, price: last.close, changePct, spark, time: last.time, supported };
}
