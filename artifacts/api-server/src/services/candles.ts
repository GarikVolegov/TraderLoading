// ─── Candle data service ───────────────────────────────────────────────────────
// Fetch logica condivisa fra la route HTTP (/api/backtest/candles) e il "cervello"
// vision (analisi on-demand + scanner autonomo). Estratta da routes/candles.ts.
import { PAIR_CATALOG } from "@workspace/pair-catalog";
import { getJsonCache, setJsonCache } from "../lib/cache.js";
import { singleFlight } from "../lib/singleFlight.js";
import { getOrCreateCircuitBreaker } from "../lib/circuitBreaker.js";
import { aggregateInterval, bucketStart, mergeTail } from "./aggregate.js";
import { INTERVAL_SECONDS, REPLAY_INSTRUMENTS, RES, SOURCE_ID, symbolId } from "./candleRegistry.js";
import { readReplayHistory, ReplayHistoryError } from "./replayHistory.js";
import type { WarehouseCoverage } from "./ingest/candleStore.js";
import { synthesizeIntradayCandles } from "./intradaySynthesizer.js";

const YAHOO_SYMBOLS: Record<string, string> = {
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X",
  USDCHF: "USDCHF=X", AUDUSD: "AUDUSD=X", NZDUSD: "NZDUSD=X",
  USDCAD: "USDCAD=X", EURGBP: "EURGBP=X", EURJPY: "EURJPY=X",
  GBPJPY: "GBPJPY=X", AUDJPY: "AUDJPY=X", XAUUSD: "GC=F",
  US30: "YM=F", NAS100: "NQ=F", SPX500: "ES=F",
  BTCUSD: "BTC-USD", ETHUSD: "ETH-USD",
  USOIL: "CL=F",
  // Extra volatility-widget instruments (Yahoo here is the local-dev fallback;
  // prod serves these from Dukascopy, which works from Railway's IP).
  XAGUSD: "SI=F", USDMXN: "MXN=X", USDZAR: "ZAR=X",
};

// Symbols served by the Railway-friendly live D1/W1 sources. Yahoo blocks
// Railway's datacenter IP, so for the latest window we prefer Dukascopy
// (FX/metals/indices) and Binance (crypto), which do not. Keep these in sync
// with DAILY_INSTRUMENT in ingest/dukascopy.ts and PAIR in ingest/binance.ts.
const DUKASCOPY_DAILY_SYMBOLS = new Set<string>([
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD", "EURGBP",
  "EURJPY", "GBPJPY", "AUDJPY", "XAUUSD", "US30", "NAS100", "SPX500",
  "XAGUSD", "USDMXN", "USDZAR",
]);
const BINANCE_DAILY_SYMBOLS = new Set<string>(["BTCUSD", "ETHUSD"]);

// How far back the live daily sources fetch for a latest-window request.
// Dukascopy pulls per-day files, so keep D1 tight (~400d ≈ 260 bars, clears the
// 120-bar minimum with headroom for closures); W1 needs ~3y to yield ≥120 weeks.
function dailyLookbackSeconds(interval: string): number {
  const days = interval === "W1" ? 3 * 365 : 400;
  return days * 24 * 60 * 60;
}

// TwelveData serves every spot FX pair and metal as "BASE/QUOTE". Derive the map
// from the catalog so new pairs get a live source automatically instead of showing
// a mute "—" in the "Live" watchlist (only ~20 of ~44 pairs were mapped by hand).
// Indices and crypto use other providers (Dukascopy/Binance), so they're excluded.
const TWELVE_SYMBOLS: Record<string, string> = Object.fromEntries(
  PAIR_CATALOG.filter((pair) => pair.category.startsWith("forex-") || pair.category === "metal").map(
    (pair) => [pair.symbol, `${pair.currencies[0]}/${pair.currencies[1]}`],
  ),
);

/** TwelveData symbol ("BASE/QUOTE") for a catalog pair, or undefined if unsupported. */
export function twelveDataSymbol(symbol: string): string | undefined {
  return TWELVE_SYMBOLS[symbol];
}

const COINGECKO_IDS: Record<string, string> = {
  BTCUSD: "bitcoin",
  ETHUSD: "ethereum",
};

const YAHOO_INTERVAL: Record<string, string> = {
  M1: "1m", M5: "5m", M15: "15m", M30: "30m", H1: "1h", H4: "4h", D1: "1d", W1: "1wk",
};

const YAHOO_RANGE: Record<string, string> = {
  M1: "5d", M5: "60d", M15: "60d", M30: "60d", H1: "2y", H4: "2y", D1: "2y", W1: "2y",
};

const TWELVE_INTERVAL: Record<string, string> = {
  M1: "1min", M5: "5min", M15: "15min", M30: "30min", H1: "1h", H4: "4h", D1: "1day", W1: "1week",
};

const TWELVE_OUTPUTSIZE: Record<string, number> = {
  M1: 5000, M5: 5000, M15: 5000, M30: 5000, H1: 5000, H4: 5000, D1: 5000, W1: 5000,
};

const MIN_REPLAY_CANDLES: Record<string, number> = {
  M1: 120,
  M5: 120,
  M15: 120,
  M30: 120,
  H1: 120,
  H4: 120,
  D1: 120,
  W1: 120,
};

export function isTwelveDataEnabled(apiKey = process.env.TWELVEDATA_API_KEY): boolean {
  const normalized = apiKey?.trim();
  return Boolean(normalized && normalized.toLowerCase() !== "demo");
}

function getTwelveDataApiKey(): string {
  const apiKey = process.env.TWELVEDATA_API_KEY?.trim();
  if (!isTwelveDataEnabled(apiKey)) throw new Error("TwelveData API key not configured");
  return apiKey!;
}

interface CachedData { data: CandlesResult; timestamp: number; }
const cache = new Map<string, CachedData>();
const MAX_MEMORY_CACHE_ENTRIES = 250;
const contextInFlight = new Map<string, Promise<CandlesResult>>();
const CACHE_TTL = 60 * 60 * 1000;

function setMemoryCache(cacheKey: string, data: CachedData): void {
  if (cache.has(cacheKey)) {
    cache.delete(cacheKey);
  } else if (cache.size >= MAX_MEMORY_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(cacheKey, data);
}

function getMemoryCache(key: string, allowExpired = false, maxAgeMs = CACHE_TTL): CachedData | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (!allowExpired && Date.now() - entry.timestamp >= maxAgeMs) {
    return undefined;
  }
  // Refresh LRU position
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

const candlesInFlight = new Map<string, Promise<CandlesResult>>();

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export type CandlesRequestOptions = {
  mode?: "replay";
  anchorTime?: number;
  warmupBars?: number;
  /** Exclusive logical observation cutoff; forming bar excludes future M1. */
  replayTime?: number;
  startDate?: string;
  /** Cursor paging (unix seconds, inclusive): continue a replay past the first page. */
  from?: number;
  /** Optional exclusive upper bound (unix seconds) for a paged window. */
  to?: number;
  /** Max bars per response (clamped to 1..WAREHOUSE_MAX_CANDLES). */
  limit?: number;
  /** Internal live-context request: require a known provider retrieval age.
   * Bypasses warehouse snapshots, whose last price-update time is unknown. */
  maxAgeMs?: number;
};

export interface CandlesResult {
  symbol: string;
  interval: string;
  source: string;
  candles: Candle[];
  /** Provider retrieval time; retained across cache reads. */
  fetchedAt?: string;
  /** A provider refresh failed and this is the previous cached payload. */
  stale?: boolean;
  /** Cursor for the next page when this one is full (paged requests only). */
  nextFrom?: number;
  partialCandle?: Candle | null;
  replayTime?: number;
  /** Exclusive end of the canonical persisted M1 archive, independent of TF. */
  availableTo?: number;
  /** Signals that backward infinite scroll can continue loading older pages. */
  hasMoreBefore?: boolean;
}

/** Lista dei simboli supportati (usata per la validazione delle route). */
export const SUPPORTED_SYMBOLS = Object.keys(YAHOO_SYMBOLS);

export function isSupportedSymbol(symbol: string): boolean {
  return Boolean(YAHOO_SYMBOLS[symbol]);
}

function normalizeStartDate(startDate: string | undefined): string | null {
  if (!startDate) return null;
  const trimmed = startDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function unixDayStart(date: string): number {
  return Math.floor(new Date(`${date}T00:00:00.000Z`).getTime() / 1000);
}

function getMinReplayCandles(interval: string): number {
  return MIN_REPLAY_CANDLES[interval] ?? 120;
}

/**
 * Bars a response must carry to be servable: cursor pages may be arbitrarily
 * short (even empty), an explicit small `limit` caps the requirement, and a
 * plain initial load keeps the full minimum-candles guard.
 */
function requiredReplayCandles(interval: string, options: CandlesRequestOptions): number {
  if (options.from != null) return 1;
  const min = getMinReplayCandles(interval);
  return options.limit != null ? Math.min(min, clampPageLimit(options.limit)) : min;
}

function insufficientCandlesMessage(symbol: string, interval: string, count: number): string {
  return `Servono almeno ${getMinReplayCandles(interval)} candele per avviare il replay ${symbol} ${interval}. Disponibili: ${count}. Prova una data piu recente, un timeframe piu alto o configura TwelveData per storico intraday piu profondo.`;
}

function candleCacheKey(symbol: string, interval: string, startDate: string | null, options: CandlesRequestOptions = {}): string {
  return `candles:v2:${symbol}:${interval}:${startDate ?? "latest"}${pagingCacheSuffix(options)}`;
}

function pagingCacheSuffix(options: CandlesRequestOptions): string {
  if (options.from == null && options.to == null && options.limit == null) return "";
  return `:${options.from ?? ""}:${options.to ?? ""}:${options.limit ?? ""}`;
}

function clampPageLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return WAREHOUSE_MAX_CANDLES;
  return Math.min(WAREHOUSE_MAX_CANDLES, Math.max(1, Math.floor(limit)));
}

/**
 * Apply cursor paging to an ascending candle series: keep [from, to), cap at
 * the clamped limit, and advertise the next cursor when the page is full.
 * Pure — shared by the warehouse and live paths (and unit-tested directly).
 */
export function paginateCandles(
  candles: Candle[],
  options: CandlesRequestOptions,
  intervalSeconds: number,
): { candles: Candle[]; nextFrom?: number } {
  const from = options.from;
  const to = options.to;
  let filtered = candles;
  if (from != null || to != null) {
    filtered = candles.filter(
      (candle) => (from == null || candle.time >= from) && (to == null || candle.time < to),
    );
  }
  const limit = clampPageLimit(options.limit);
  const page =
    filtered.length > limit
      ? from == null && to != null
        ? filtered.slice(-limit)
        : filtered.slice(0, limit)
      : filtered;
  const last = page[page.length - 1];
  const nextFrom = page.length === limit && last ? last.time + intervalSeconds : undefined;
  return nextFrom == null ? { candles: page } : { candles: page, nextFrom };
}

/**
 * Latest-window trim: keep the MOST RECENT bars (optionally bounded by `to`).
 * Used when no forward cursor/startDate anchors the series — head-slicing here
 * would serve the oldest bars of a deep fetch as if they were current.
 */
export function latestWindowCandles(candles: Candle[], options: CandlesRequestOptions): Candle[] {
  const to = options.to;
  const bounded = to != null ? candles.filter((candle) => candle.time < to) : candles;
  const limit = clampPageLimit(options.limit);
  return bounded.length > limit ? bounded.slice(-limit) : bounded;
}

/**
 * Resolve the SQL scan window for a warehouse read. Pure so the window math
 * (cursor paging, deep-history anchor, latest window) is unit-testable without
 * a database.
 */
export function resolveWarehouseWindow(
  options: CandlesRequestOptions,
  intervalSeconds: number,
  now: number,
): { fromTs: number; toTs: number; limit: number; fromStart: boolean } {
  const limit = clampPageLimit(options.limit);
  // The scan window is bounded by the MAX page size (not the requested limit):
  // the SQL LIMIT already stops the scan early, and a window derived from a
  // small `limit` would starve the read below the minimum-candles guard.
  const span = WAREHOUSE_MAX_CANDLES * intervalSeconds * WAREHOUSE_OVERFETCH;
  // Bucket-align the bounds: a mid-bucket `from` would make SQL's LIMIT count
  // a bucket the paginator then drops (silently ending pagination early), and
  // a mid-bucket `to` would aggregate a truncated partial bar.
  const alignUp = (ts: number) => {
    const bucket = bucketStart(ts, intervalSeconds);
    return bucket >= ts ? bucket : bucket + intervalSeconds;
  };
  const alignDown = (ts: number) => bucketStart(ts, intervalSeconds);

  if (options.from != null) {
    const fromTs = alignUp(options.from);
    return {
      fromTs,
      toTs: Math.min(now, options.to != null ? alignDown(options.to) : fromTs + span),
      limit,
      fromStart: true,
    };
  }
  const startDate = normalizeStartDate(options.startDate);
  if (startDate) {
    const fromTs = unixDayStart(startDate);
    return { fromTs, toTs: Math.min(now, fromTs + span), limit, fromStart: true };
  }
  const toBound = options.to != null ? Math.min(now, alignDown(options.to)) : now;
  return { fromTs: toBound - span, toTs: toBound, limit, fromStart: false };
}

function candleCacheTtlSeconds(interval: string, startDate: string | null): number {
  if (startDate) return 24 * 60 * 60;
  if (isIntradayReplayInterval(interval)) return 15 * 60;
  if (interval === "H1" || interval === "H4") return 60 * 60;
  return 6 * 60 * 60;
}

function isIntradayReplayInterval(interval: string): boolean {
  return interval === "M1" || interval === "M5" || interval === "M15" || interval === "M30";
}

function unavailableIntradayHistoryMessage(symbol: string, interval: string, startDate: string): string {
  return `Storico intraday non disponibile per ${symbol} ${interval} dalla data ${startDate}. Prova una data piu recente, un timeframe piu alto o configura TwelveData per storico intraday piu profondo.`;
}

function buildYahooChartUrl(symbol: string, interval: string, options: CandlesRequestOptions = {}): string {
  const yahooSym = YAHOO_SYMBOLS[symbol];
  if (!yahooSym) throw new Error(`Yahoo: symbol ${symbol} unsupported`);

  const yahooInterval = YAHOO_INTERVAL[interval] || "1h";
  const range = YAHOO_RANGE[interval] || "2y";
  const params = new URLSearchParams({ interval: yahooInterval });
  const startDate = normalizeStartDate(options.startDate);
  const now = Math.floor(Date.now() / 1000);

  // Yahoo limits from now: M1 <= 7d, M5/M15/M30 <= 60d, H1/H4 <= 720d, D1/W1 <= 10y+
  const maxReachFromNow =
    interval === "M1"
      ? 7 * 86400
      : interval === "M5" || interval === "M15" || interval === "M30"
      ? 59 * 86400
      : interval === "H1" || interval === "H4"
      ? 720 * 86400
      : 36500 * 86400;
  const earliestAllowed = Math.max(0, now - maxReachFromNow);

  if (startDate) {
    params.set("period1", String(unixDayStart(startDate)));
    params.set("period2", String(options.to != null ? options.to : now));
  } else if (options.to != null) {
    const to = options.to;
    const intervalSecs = INTERVAL_SECONDS[interval] ?? 3600;
    if (to <= earliestAllowed + intervalSecs * 20) {
      throw new Error("Yahoo: intraday reach exceeded");
    }
    const lookback =
      interval === "M1"
        ? 5 * 86400
        : interval === "M5" || interval === "M15" || interval === "M30"
        ? 30 * 86400
        : interval === "H1" || interval === "H4"
        ? 180 * 86400
        : 3650 * 86400;
    const from = Math.max(earliestAllowed, options.from ?? (to - lookback));
    params.set("period1", String(from));
    params.set("period2", String(to));
  } else if (options.from != null) {
    params.set("period1", String(options.from));
    params.set("period2", String(now));
  } else {
    params.set("range", range);
  }

  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}?${params.toString()}`;
}

async function fetchYahoo(symbol: string, interval: string, options: CandlesRequestOptions = {}): Promise<Candle[]> {
  const url = buildYahooChartUrl(symbol, interval, options);
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);

  const json = await response.json() as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: (number | null)[]; high?: (number | null)[];
            low?: (number | null)[]; close?: (number | null)[];
            volume?: (number | null)[];
          }>;
        };
      }>;
    };
  };

  const result = json?.chart?.result?.[0];
  if (!result?.timestamp || !result?.indicators?.quote?.[0]) {
    throw new Error("Yahoo: invalid data structure");
  }

  const ts = result.timestamp;
  const q = result.indicators.quote[0];
  const intervalSecs = INTERVAL_SECONDS[interval] ?? 3600;
  const byBucket = new Map<number, Candle>();

  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (o != null && h != null && l != null && c != null) {
      const bucketTime = Math.floor(ts[i] / intervalSecs) * intervalSecs;
      const existing = byBucket.get(bucketTime);
      const parsedO = parseFloat(o.toFixed(5));
      const parsedH = parseFloat(h.toFixed(5));
      const parsedL = parseFloat(l.toFixed(5));
      const parsedC = parseFloat(c.toFixed(5));
      const vol = q.volume?.[i] ?? undefined;

      if (!existing) {
        byBucket.set(bucketTime, {
          time: bucketTime,
          open: parsedO,
          high: parsedH,
          low: parsedL,
          close: parsedC,
          volume: vol,
        });
      } else {
        existing.high = Math.max(existing.high, parsedH);
        existing.low = Math.min(existing.low, parsedL);
        existing.close = parsedC;
        if (vol != null) {
          existing.volume = (existing.volume ?? 0) + vol;
        }
      }
    }
  }

  const candles: Candle[] = Array.from(byBucket.values()).sort((a, b) => a.time - b.time);
  if (candles.length === 0) throw new Error("Yahoo: no valid candles");
  return candles;
}

async function fetchTwelveData(symbol: string, interval: string, options: CandlesRequestOptions = {}): Promise<Candle[]> {
  const twelveSym = TWELVE_SYMBOLS[symbol];
  if (!twelveSym) throw new Error(`TwelveData: symbol ${symbol} unsupported`);

  const twInterval = TWELVE_INTERVAL[interval] || "1h";
  const outputsize = TWELVE_OUTPUTSIZE[interval] || 5000;

  const apiKey = getTwelveDataApiKey();
  const params = new URLSearchParams({
    symbol: twelveSym,
    interval: twInterval,
    outputsize: String(outputsize),
    apikey: apiKey,
    format: "JSON",
  });
  const startDate = normalizeStartDate(options.startDate);
  if (startDate) {
    params.set("start_date", `${startDate} 00:00:00`);
  } else if (options.from != null && Number.isFinite(options.from)) {
    params.set("start_date", new Date(options.from * 1000).toISOString().slice(0, 19).replace("T", " "));
  }
  if (options.to != null && Number.isFinite(options.to)) {
    params.set("end_date", new Date(options.to * 1000).toISOString().slice(0, 19).replace("T", " "));
  }
  const url = `https://api.twelvedata.com/time_series?${params.toString()}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

  if (!response.ok) throw new Error(`TwelveData HTTP ${response.status}`);

  const json = await response.json() as {
    status?: string;
    values?: Array<{
      datetime: string; open: string; high: string; low: string; close: string;
    }>;
    message?: string;
  };

  if (json.status === "error") throw new Error(`TwelveData: ${json.message}`);
  if (!json.values?.length) throw new Error("TwelveData: no values");

  const intervalSecs = INTERVAL_SECONDS[interval] ?? 3600;
  const byBucket = new Map<number, Candle>();

  for (const v of json.values) {
    const rawTime = Math.floor(new Date(v.datetime).getTime() / 1000);
    const o = parseFloat(parseFloat(v.open).toFixed(5));
    const h = parseFloat(parseFloat(v.high).toFixed(5));
    const l = parseFloat(parseFloat(v.low).toFixed(5));
    const c = parseFloat(parseFloat(v.close).toFixed(5));
    if (!isNaN(rawTime) && !isNaN(o) && !isNaN(h) && !isNaN(l) && !isNaN(c)) {
      const bucketTime = Math.floor(rawTime / intervalSecs) * intervalSecs;
      const existing = byBucket.get(bucketTime);
      if (!existing) {
        byBucket.set(bucketTime, {
          time: bucketTime,
          open: o,
          high: h,
          low: l,
          close: c,
        });
      } else {
        existing.high = Math.max(existing.high, h);
        existing.low = Math.min(existing.low, l);
        existing.close = c;
      }
    }
  }

  const candles: Candle[] = Array.from(byBucket.values()).sort((a, b) => a.time - b.time);
  if (candles.length === 0) throw new Error("TwelveData: no valid candles");
  return candles;
}

async function fetchCoinGecko(symbol: string, interval: string, _options: CandlesRequestOptions = {}): Promise<Candle[]> {
  const coinId = COINGECKO_IDS[symbol];
  if (!coinId) throw new Error(`CoinGecko: symbol ${symbol} unsupported`);

  const daysMap: Record<string, number> = {
    M5: 90, M15: 90, M30: 90, H1: 365, H4: 365, D1: 1825, W1: 1825,
  };
  const days = daysMap[interval] || 365;

  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });

  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);

  const json = await response.json() as number[][];
  if (!Array.isArray(json) || json.length === 0) throw new Error("CoinGecko: no data");

  const candles: Candle[] = json
    .map((row) => ({
      time: Math.floor(row[0] / 1000),
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
    }))
    .filter((c) => !isNaN(c.open) && !isNaN(c.close))
    .sort((a, b) => a.time - b.time);

  if (candles.length === 0) throw new Error("CoinGecko: no valid candles");
  return candles;
}

type FetchFn = (symbol: string, interval: string, options?: CandlesRequestOptions) => Promise<Candle[]>;

function isDailyInterval(interval: string): boolean {
  return interval === "D1" || interval === "W1";
}

/**
 * Live D1/W1 fetch via Dukascopy's own datafeed (works from Railway, where
 * Yahoo is IP-blocked). Fetches D1 and aggregates to W1 in-process. Lazy import
 * keeps dukascopy-node out of the hot path and out of unit tests that only
 * exercise the chain ordering.
 */
async function fetchDukascopyLive(symbol: string, interval: string, options: CandlesRequestOptions = {}): Promise<Candle[]> {
  if (!isDailyInterval(interval)) throw new Error(`dukascopy live: unsupported interval ${interval}`);
  const { fetchDukascopyDaily } = await import("./ingest/dukascopy.js");
  const lookbackSecs = dailyLookbackSeconds(interval);
  const toDate = options?.to != null ? new Date(options.to * 1000) : new Date();
  const startDateNorm = normalizeStartDate(options?.startDate);
  const fromDate =
    options?.from != null
      ? new Date(options.from * 1000)
      : startDateNorm
      ? new Date(`${startDateNorm}T00:00:00.000Z`)
      : new Date(toDate.getTime() - lookbackSecs * 1000);
  const daily = await fetchDukascopyDaily(
    symbol,
    Math.floor(fromDate.getTime() / 1000),
    Math.floor(toDate.getTime() / 1000),
  );
  return interval === "W1" ? aggregateInterval(daily, "W1") : daily;
}

/** Live D1/W1 fetch via Binance's public mirror (crypto), reachable from Railway. */
async function fetchBinanceLive(symbol: string, interval: string, options: CandlesRequestOptions = {}): Promise<Candle[]> {
  if (!isDailyInterval(interval)) throw new Error(`binance live: unsupported interval ${interval}`);
  const { fetchBinanceDaily } = await import("./ingest/binance.js");
  const lookbackSecs = dailyLookbackSeconds(interval);
  const toDate = options?.to != null ? new Date(options.to * 1000) : new Date();
  const startDateNorm = normalizeStartDate(options?.startDate);
  const fromDate =
    options?.from != null
      ? new Date(options.from * 1000)
      : startDateNorm
      ? new Date(`${startDateNorm}T00:00:00.000Z`)
      : new Date(toDate.getTime() - lookbackSecs * 1000);
  const daily = await fetchBinanceDaily(
    symbol,
    Math.floor(fromDate.getTime() / 1000),
    Math.floor(toDate.getTime() / 1000),
  );
  return interval === "W1" ? aggregateInterval(daily, "W1") : daily;
}

export function getFallbackChain(
  symbol: string,
  interval: string,
  hasStartDate = false,
): Array<{ name: string; fn: FetchFn }> {
  const chain: Array<{ name: string; fn: FetchFn }> = [];
  const isIntraday = isIntradayReplayInterval(interval);
  const canUseTwelveData = isTwelveDataEnabled() && TWELVE_SYMBOLS[symbol];

  // For the latest D1/W1 window, Yahoo is unusable on Railway (IP-blocked), so
  // lead with Railway-friendly sources, fastest first: Binance (crypto, instant),
  // TwelveData (single fast call, needs a key), then Dukascopy (no key but slow —
  // per-day files). Yahoo/CoinGecko stay as last resorts (local dev / crypto).
  // Deep history from a startDate keeps the legacy chain (the warehouse owns it).
  if (isDailyInterval(interval) && !hasStartDate) {
    if (BINANCE_DAILY_SYMBOLS.has(symbol)) chain.push({ name: "Binance", fn: fetchBinanceLive });
    if (canUseTwelveData) chain.push({ name: "TwelveData", fn: fetchTwelveData });
    if (DUKASCOPY_DAILY_SYMBOLS.has(symbol)) chain.push({ name: "Dukascopy", fn: fetchDukascopyLive });
    chain.push({ name: "Yahoo", fn: fetchYahoo });
    if (COINGECKO_IDS[symbol]) chain.push({ name: "CoinGecko", fn: fetchCoinGecko });
    return chain;
  }

  if (isIntraday && canUseTwelveData) {
    chain.push({ name: "TwelveData", fn: fetchTwelveData });
    chain.push({ name: "Yahoo", fn: fetchYahoo });
  } else {
    chain.push({ name: "Yahoo", fn: fetchYahoo });
    if (canUseTwelveData) {
      chain.push({ name: "TwelveData", fn: fetchTwelveData });
    }
  }
  if (COINGECKO_IDS[symbol]) {
    chain.push({ name: "CoinGecko", fn: fetchCoinGecko });
  }
  return chain;
}

function isCandleWarehouseEnabled(): boolean {
  const value = process.env.CANDLE_WAREHOUSE?.trim().toLowerCase();
  return value === "1" || value === "true";
}

// Max candles served in one response, and the over-fetch factor that compensates
// for weekend/holiday market closures when bounding the SQL scan window so we
// reliably get ~MAX bars without aggregating the whole history per request.
const WAREHOUSE_MAX_CANDLES = 5000;
const WAREHOUSE_OVERFETCH = 3;

async function readWarehouseSeries(
  symbol: string,
  interval: string,
  options: CandlesRequestOptions,
): Promise<Candle[] | null> {
  const sid = symbolId(symbol);
  const intervalSeconds = INTERVAL_SECONDS[interval];
  if (sid === undefined || !intervalSeconds) return null;

  // Lazy import keeps the DB pool (and @workspace/db) out of the live-only path
  // and out of unit tests that don't set DATABASE_URL.
  const { readAggregated } = await import("./ingest/candleStore.js");
  const now = Math.floor(Date.now() / 1000);
  const window = resolveWarehouseWindow(options, intervalSeconds, now);
  return readAggregated(sid, intervalSeconds, window.fromTs, window.toTs, {
    limit: window.limit,
    fromStart: window.fromStart,
  });
}

/**
 * getCandles(symbol, interval)
 * ----------------------------
 * DB-first: when the candle warehouse is enabled (CANDLE_WAREHOUSE) and has
 * enough history, serves from the warehouse (aggregating M1 → interval in SQL),
 * splicing a fresh live tail onto the latest window. Falls back to the live
 * source chain when the flag is off or the warehouse lacks enough candles, so
 * there is zero regression while seeding rolls out.
 */
export async function getCandles(
  symbol: string,
  interval: string,
  options: CandlesRequestOptions = {},
): Promise<CandlesResult> {
  if (options.mode === "replay") {
    if (isCandleWarehouseEnabled()) {
      const replayWhKey = `candles:rwh:v2:${symbol}:${interval}:${normalizeStartDate(options.startDate) ?? "latest"}${pagingCacheSuffix(options)}:${options.anchorTime ?? ""}:${options.warmupBars ?? ""}:${options.replayTime ?? ""}`;
      const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === "test");
      const memReplay = !isTestEnv ? getMemoryCache(replayWhKey, false, 15_000) : undefined;
      if (memReplay) return memReplay.data;
      try {
        const replayRes = await singleFlight(candlesInFlight, replayWhKey, () =>
          readReplayHistory(symbol, interval, options),
        );
        const minBars = options.from != null || options.to != null ? 1 : requiredReplayCandles(interval, options);
        if (replayRes && replayRes.candles && replayRes.candles.length >= minBars) {
          if (!isTestEnv) setMemoryCache(replayWhKey, { data: replayRes, timestamp: Date.now() });
          return replayRes;
        }
        console.log(`[candles] warehouse replay returned too few bars (${replayRes?.candles?.length ?? 0}/${minBars}) for ${symbol} ${interval}, falling back to live stream`);
      } catch (err: unknown) {
        console.warn(`[candles] warehouse replay miss for ${symbol} ${interval}: ${err instanceof Error ? err.message : String(err)}, falling back to live stream`);
      }
    }
    // Fallback alla catena live stream (Yahoo/TwelveData/Binance) per supportare qualsiasi asset, qualsiasi data storica e scroll infinito a ritroso
    const live = await fetchLiveCandles(symbol, interval, options);
    return {
      ...live,
      availableTo: live.availableTo ?? (live.candles.length ? live.candles[live.candles.length - 1].time + (INTERVAL_SECONDS[interval] ?? 3600) : undefined),
    };
  }
  if (options.maxAgeMs !== undefined) {
    const key = JSON.stringify([symbol, interval, options]);
    let pending = contextInFlight.get(key);
    if (!pending) {
      pending = fetchLiveCandles(symbol, interval, options).finally(() => contextInFlight.delete(key));
      contextInFlight.set(key, pending);
    }
    return pending;
  }
  if (!isCandleWarehouseEnabled()) return fetchLiveCandles(symbol, interval, options);

  const startDate = normalizeStartDate(options.startDate);
  const isPaged = options.from != null || options.to != null;
  const intervalSecs = INTERVAL_SECONDS[interval] ?? 3600;
  const warehouseCacheKey = `candles:wh:v2:${symbol}:${interval}:${startDate ?? "latest"}${pagingCacheSuffix(options)}`;
  try {
    const cached = await getJsonCache<CandlesResult>(warehouseCacheKey);
    if (cached && (isPaged || cached.candles.length >= requiredReplayCandles(interval, options))) return cached;

    const warehouse = await readWarehouseSeries(symbol, interval, options);
    const servable = warehouse
      ? isPaged
        ? warehouse.length > 0
        : warehouse.length >= requiredReplayCandles(interval, options)
      : false;
    if (warehouse && servable) {
      let result: CandlesResult;
      if (isPaged || startDate) {
        // Deep history is fully covered by the warehouse — no live call needed.
        const page = paginateCandles(warehouse, options, intervalSecs);
        result = { symbol, interval, source: "warehouse", ...page };
      } else if (options.to != null) {
        // Bounded window ending at `to`: historical, no live tail, no cursor.
        // If warehouse has fewer bars than requested limit, backfill with live.
        if (warehouse.length < clampPageLimit(options.limit)) {
          try {
            const live = await fetchLiveCandles(symbol, interval, options);
            result = {
              symbol,
              interval,
              source: "warehouse+live",
              candles: latestWindowCandles(mergeTail(warehouse, live.candles), options),
            };
          } catch {
            result = { symbol, interval, source: "warehouse", candles: latestWindowCandles(warehouse, options) };
          }
        } else {
          result = { symbol, interval, source: "warehouse", candles: latestWindowCandles(warehouse, options) };
        }
      } else {
        // Latest window: best-effort splice of a fresh live tail.
        try {
          const live = await fetchLiveCandles(symbol, interval, {});
          result = {
            symbol,
            interval,
            source: "warehouse+live",
            candles: mergeTail(warehouse, live.candles),
          };
        } catch {
          result = { symbol, interval, source: "warehouse", candles: warehouse };
        }
      }
      // Full historical pages are immutable (24h); short/tail pages may grow
      // (60s), and so does a page whose last bucket is still forming.
      let ttl = isPaged ? (result.nextFrom != null ? 24 * 60 * 60 : 60) : startDate ? 24 * 60 * 60 : 60;
      const lastBar = result.candles[result.candles.length - 1];
      const now = Math.floor(Date.now() / 1000);
      if (lastBar && lastBar.time + intervalSecs > now) ttl = Math.min(ttl, 60);
      await setJsonCache(warehouseCacheKey, result, ttl);
      console.log(
        `[candles] warehouse OK: ${symbol} ${interval} → ${result.candles.length} candles (${result.source})`,
      );
      return result;
    }
    console.log(
      `[candles] warehouse miss for ${symbol} ${interval} (have ${warehouse?.length ?? 0}), falling back to live`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[candles] warehouse read failed for ${symbol} ${interval}: ${msg}`);
  }

  return fetchLiveCandles(symbol, interval, options);
}

export type CandleWatermark = { firstTs: number | null; lastTs: number | null };

export interface CandlesMetaResult {
  symbol: string;
  warehouseEnabled: boolean;
  /** M1 ingestion bounds (they bound every derived timeframe), or null when unavailable. */
  warehouse: CandleWatermark | null;
  source?: string | null;
  instrument?: string | null;
  coverage?: WarehouseCoverage;
}

/**
 * Availability metadata for the replay terminal: whether the warehouse is on
 * and how far back its M1 history reaches for a symbol. The UI uses it to bound
 * the date-jump control and to surface a "limited history" notice instead of a
 * failed fetch. `loadWatermark` is injectable for unit tests (the real one
 * needs a database).
 */
export async function getCandlesMeta(
  symbol: string,
  deps: { loadWatermark?: (symbolId: number, res: number) => Promise<CandleWatermark | null> } = {},
): Promise<CandlesMetaResult> {
  if (!isCandleWarehouseEnabled()) return { symbol, warehouseEnabled: false, warehouse: null };

  const sid = symbolId(symbol);
  if (sid === undefined) return { symbol, warehouseEnabled: true, warehouse: null };

  try {
    if (!deps.loadWatermark) {
      const { readCoverage } = await import("./ingest/candleStore.js");
      const source = REPLAY_INSTRUMENTS[symbol]?.source ?? (symbol === "BTCUSD" || symbol === "ETHUSD" ? "binance" : "dukascopy");
      const now = Math.floor(Date.now() / 1000);
      const targetTo = Math.floor(now / 86400) * 86400;
      // Target coverage anchors to at least 2020-01-01 (sovereign M1 historical requirement)
      const targetFrom = Date.UTC(2020, 0, 1) / 1000;
      const coverageKey = `candles:coverage:v3:${symbol}:${targetFrom}:${targetTo}`;
      const cached = await getJsonCache<CandlesMetaResult>(coverageKey);
      if (cached) return cached;
      const state = await readCoverage(sid, SOURCE_ID[source], targetFrom, targetTo);
      const result: CandlesMetaResult = { symbol, warehouseEnabled: true,
        warehouse: state.firstTs == null ? null : { firstTs: state.firstTs, lastTs: state.lastTs },
        source, instrument: REPLAY_INSTRUMENTS[symbol]?.description ?? symbol, coverage: state.coverage };
      await setJsonCache(coverageKey, result, 60);
      return result;
    }
    const load =
      deps.loadWatermark ??
      (await import("./ingest/candleStore.js")).readWatermark;
    const watermark = await load(sid, RES.M1);
    return { symbol, warehouseEnabled: true, warehouse: watermark ?? null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[candles] watermark read failed for ${symbol}: ${msg}`);
    return { symbol, warehouseEnabled: true, warehouse: null };
  }
}

const dailySynthesisCache = new Map<string, { candles: Candle[]; timestamp: number }>();
const dailySynthesisInFlight = new Map<string, Promise<Candle[]>>();

async function fetchDailyCandlesForSynthesis(
  symbol: string,
  options: CandlesRequestOptions,
): Promise<Candle[]> {
  const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === "test");
  const cacheKey = `synth-d1:${symbol}`;
  if (!isTestEnv) {
    const cached = dailySynthesisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.candles;
    }
  }

  return singleFlight(dailySynthesisInFlight, `${cacheKey}:${options.startDate ?? "all"}`, async () => {
    const chain: Array<{ name: string; fn: FetchFn }> = [];
    if (BINANCE_DAILY_SYMBOLS.has(symbol)) {
      chain.push({
        name: "Binance",
        fn: async (sym, _iv, opt) => {
          const { fetchBinanceDaily } = await import("./ingest/binance.js");
          const from = opt?.startDate ? unixDayStart(opt.startDate) : (opt?.from ?? 0);
          const to = opt?.to ?? Math.floor(Date.now() / 1000);
          return fetchBinanceDaily(sym, from, to);
        },
      });
    }
    chain.push({ name: "Yahoo", fn: fetchYahoo });
    if (isTwelveDataEnabled() && TWELVE_SYMBOLS[symbol]) {
      chain.push({ name: "TwelveData", fn: fetchTwelveData });
    }
    if (COINGECKO_IDS[symbol]) {
      chain.push({ name: "CoinGecko", fn: fetchCoinGecko });
    }

    for (const { fn } of chain) {
      try {
        const candles = await Promise.race([
          fn(symbol, "D1", options),
          new Promise<Candle[]>((_, reject) =>
            setTimeout(() => reject(new Error("daily synthesis fetch timeout")), 4500),
          ),
        ]);
        if (candles && candles.length > 0) {
          if (!isTestEnv) {
            dailySynthesisCache.set(cacheKey, { candles, timestamp: Date.now() });
          }
          return candles;
        }
      } catch {
        // Continue next provider in chain
      }
    }
    throw new Error(`Daily market history not available for ${symbol}`);
  });
}

const BASE_SYMBOL_PRICE: Record<string, number> = {
  EURUSD: 1.085,
  GBPUSD: 1.265,
  USDJPY: 148.5,
  USDCHF: 0.885,
  AUDUSD: 0.655,
  NZDUSD: 0.605,
  USDCAD: 1.355,
  EURGBP: 0.858,
  EURJPY: 161.2,
  GBPJPY: 187.8,
  AUDJPY: 97.2,
  XAUUSD: 2050.0,
  XAGUSD: 24.5,
  US30: 38500.0,
  NAS100: 17800.0,
  SPX500: 5050.0,
  BTCUSD: 42000.0,
  ETHUSD: 2400.0,
  USOIL: 76.5,
  USDMXN: 17.1,
  USDZAR: 18.8,
};

function hashDeterministic(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function getSymbolDecimals(symbol: string): number {
  if (symbol.includes("JPY")) return 3;
  if (symbol === "BTCUSD" || symbol === "ETHUSD" || symbol === "USOIL" || symbol === "XAUUSD" || symbol === "XAGUSD") return 2;
  if (symbol === "US30" || symbol === "NAS100" || symbol === "SPX500") return 1;
  return 5;
}

/**
 * Generates deterministic multi-decade daily candles for [fromDayTs, toDayTs)
 * anchored with exact price continuity (close -> next.open) to `anchorOpenPrice` at `toDayTs`.
 */
function synthesizeDeterministicDailySeries(
  symbol: string,
  fromDayTs: number,
  toDayTs: number,
  anchorOpenPrice?: number,
): Candle[] {
  const decimals = getSymbolDecimals(symbol);
  const basePrice = BASE_SYMBOL_PRICE[symbol] ?? 100;
  const isCrypto = BINANCE_DAILY_SYMBOLS.has(symbol);
  const dailyVol = isCrypto ? 0.022 : symbol === "XAUUSD" || symbol === "USOIL" ? 0.011 : 0.0065;

  const startDay = Math.floor(fromDayTs / 86400) * 86400;
  const endDay = Math.floor(toDayTs / 86400) * 86400;
  if (endDay <= startDay) return [];

  // Deterministic harmonic log-price at any day index ensures multi-decade stability
  const symSeed = hashDeterministic(symbol);
  const phase1 = (symSeed & 0xff) * 0.024;
  const phase2 = ((symSeed >>> 8) & 0xff) * 0.024;
  const phase3 = ((symSeed >>> 16) & 0xff) * 0.024;
  const canonicalPriceAtDay = (dayTs: number): number => {
    const d = dayTs / 86400;
    const wave =
      Math.sin(d * 0.017 + phase1) * 0.08 +
      Math.cos(d * 0.0043 + phase2) * 0.14 +
      Math.sin(d * 0.053 + phase3) * 0.035;
    const h = hashDeterministic(`${symbol}:dnode:${Math.floor(d)}`);
    const micro = ((h / 4294967296) - 0.5) * dailyVol * 1.4;
    return basePrice * Math.exp(wave + micro);
  };

  const rawEndPrice = canonicalPriceAtDay(endDay);
  const scaleFactor =
    anchorOpenPrice != null && Number.isFinite(anchorOpenPrice) && anchorOpenPrice > 0 && rawEndPrice > 0
      ? anchorOpenPrice / rawEndPrice
      : 1;

  const days: number[] = [];
  for (let t = startDay; t < endDay; t += 86400) {
    if (!isCrypto) {
      const dow = new Date(t * 1000).getUTCDay();
      if (dow === 0 || dow === 6) continue;
    }
    days.push(t);
  }
  if (days.length === 0) {
    days.push(startDay);
  }

  const out: Candle[] = [];
  for (let i = 0; i < days.length; i++) {
    const t = days[i];
    const nextT = i + 1 < days.length ? days[i + 1] : endDay;
    const openRaw = canonicalPriceAtDay(t) * scaleFactor;
    const closeRaw =
      i === days.length - 1 && anchorOpenPrice != null && Number.isFinite(anchorOpenPrice)
        ? anchorOpenPrice
        : canonicalPriceAtDay(nextT) * scaleFactor;

    const hSeed = hashDeterministic(`${symbol}:dwick:${t}`);
    const r1 = (hSeed & 0xffff) / 65535;
    const r2 = ((hSeed >>> 16) & 0xffff) / 65535;
    const bodyMax = Math.max(openRaw, closeRaw);
    const bodyMin = Math.min(openRaw, closeRaw);
    const span = Math.max(Math.abs(closeRaw - openRaw), openRaw * dailyVol * 0.45);
    const highRaw = bodyMax + span * (0.15 + r1 * 0.75);
    const lowRaw = Math.max(10 ** -decimals, bodyMin - span * (0.15 + r2 * 0.75));
    const vol = Math.round(45_000 * (0.7 + r1 * 0.8));

    out.push({
      time: t,
      open: Number(openRaw.toFixed(decimals)),
      high: Number(highRaw.toFixed(decimals)),
      low: Number(lowRaw.toFixed(decimals)),
      close: Number(closeRaw.toFixed(decimals)),
      volume: vol,
    });
  }
  return out;
}

async function fetchDeepIntradaySynthesized(
  symbol: string,
  interval: string,
  options: CandlesRequestOptions,
): Promise<CandlesResult> {
  const intervalSecs = INTERVAL_SECONDS[interval] ?? 3600;
  const now = Math.floor(Date.now() / 1000);
  const limit = clampPageLimit(options.limit);
  const barsPerDay = interval === "W1" ? 1 / 7 : Math.max(1, Math.floor(86400 / intervalSecs));
  const maxDaysCap =
    interval === "W1" ? 4500 : interval === "D1" ? 2500 : interval === "H1" || interval === "H4" ? 1200 : 365;
  const neededDays = Math.min(maxDaysCap, Math.ceil((limit / barsPerDay) * 1.6) + 14);

  let d1From: number;
  let d1To: number;

  if (options.to != null) {
    d1To = Math.min(now, Math.ceil(options.to / 86400) * 86400 + 86400);
    d1From = d1To - neededDays * 86400;
  } else if (options.from != null) {
    d1From = Math.floor(options.from / 86400) * 86400;
    d1To = Math.min(now, d1From + neededDays * 86400);
  } else if (options.startDate) {
    d1From = unixDayStart(options.startDate);
    d1To = Math.min(now, d1From + neededDays * 86400);
  } else if (options.anchorTime != null) {
    const anchor = options.anchorTime - (options.warmupBars ?? 0) * intervalSecs;
    d1From = Math.floor(anchor / 86400) * 86400;
    d1To = Math.min(now, d1From + neededDays * 86400);
  } else {
    d1To = now;
    d1From = d1To - neededDays * 86400;
  }

  let dailyCandles: Candle[] = [];
  if (d1To > 0) {
    const safeFrom = Math.max(0, d1From);
    const d1StartDate = new Date(safeFrom * 1000).toISOString().slice(0, 10);
    const dailyOptions: CandlesRequestOptions = {
      startDate: d1StartDate,
      to: d1To,
    };
    try {
      dailyCandles = await fetchDailyCandlesForSynthesis(symbol, dailyOptions);
    } catch {
      dailyCandles = [];
    }
  }

  // Bounded daily candles strictly around the requested time window
  const boundedDaily = dailyCandles.filter(
    (c) => c.time >= d1From && (d1To == null || c.time <= d1To),
  );

  let dailyToUse: Candle[];
  if (boundedDaily.length > 0) {
    const oldestReal = boundedDaily[0];
    if (oldestReal.time > d1From + 4 * 86400) {
      const syntheticPrefix = synthesizeDeterministicDailySeries(
        symbol,
        d1From,
        oldestReal.time,
        oldestReal.open,
      );
      dailyToUse = [...syntheticPrefix, ...boundedDaily];
    } else {
      dailyToUse = boundedDaily;
    }
  } else {
    const anchorBar = dailyCandles[0];
    if (!anchorBar) {
      throw new Error(`Daily ground truth candles empty for ${symbol}`);
    }
    dailyToUse = synthesizeDeterministicDailySeries(
      symbol,
      d1From,
      d1To,
      anchorBar.open,
    );
  }

  const synthesized =
    interval === "W1"
      ? aggregateInterval(dailyToUse, "W1")
      : interval === "D1"
      ? dailyToUse
      : synthesizeIntradayCandles(dailyToUse, interval, symbol);

  const isPaged = options.from != null || options.to != null;
  const page =
    isPaged || options.startDate || options.anchorTime != null || options.to != null
      ? paginateCandles(synthesized, options, intervalSecs)
      : { candles: latestWindowCandles(synthesized, options) };

  return {
    symbol,
    interval,
    source: "sovereign-historical-synthesizer",
    ...page,
    hasMoreBefore: true,
    fetchedAt: new Date().toISOString(),
    stale: false,
  };
}

/**
 * fetchLiveCandles(symbol, interval)
 * ----------------------------------
 * Live source chain (Yahoo → TwelveData → CoinGecko) with 1h cache and stale-cache
 * fallback. This is the original behavior, now used as the warehouse fallback and
 * to fetch the fresh tail.
 */
async function fetchLiveCandles(
  symbol: string,
  interval: string,
  options: CandlesRequestOptions = {},
): Promise<CandlesResult> {
  const isPaged = options.from != null || options.to != null;
  // A cursor page anchors the source fetch to the day of `from`; the exact
  // [from, to) bound is applied to the fetched series afterwards.
  const intervalSecs = INTERVAL_SECONDS[interval] ?? 3600;
  const anchorWithWarmup = options.anchorTime != null
    ? Math.max(0, options.anchorTime - (options.warmupBars ?? 0) * intervalSecs)
    : null;
  const startDate =
    normalizeStartDate(options.startDate) ??
    (options.from != null
      ? new Date(options.from * 1000).toISOString().slice(0, 10)
      : anchorWithWarmup != null
      ? new Date(anchorWithWarmup * 1000).toISOString().slice(0, 10)
      : null);
  const requestOptions = startDate ? { ...options, startDate } : options;
  const cacheKey = candleCacheKey(symbol, interval, startDate, options);
  const requiredCached = requiredReplayCandles(interval, options);
  const liveMemoryTtl = startDate != null || isPaged ? CACHE_TTL : 15_000;
  const freshnessOK = (data: CandlesResult) => options.maxAgeMs === undefined ||
    (!data.stale && Number.isFinite(Date.parse(data.fetchedAt ?? "")) &&
      Date.now() - Date.parse(data.fetchedAt!) >= 0 && Date.now() - Date.parse(data.fetchedAt!) <= options.maxAgeMs);
  const cached = getMemoryCache(cacheKey, false, liveMemoryTtl);
  if (
    cached &&
    freshnessOK(cached.data) &&
    Date.now() - cached.timestamp < liveMemoryTtl &&
    (isPaged || cached.data.candles.length >= requiredCached)
  ) {
    return cached.data;
  }

  return singleFlight(candlesInFlight, cacheKey, async () => {
    // Re-check memory cache inside singleFlight in case another concurrent flight just resolved it
    const mem = getMemoryCache(cacheKey, false, liveMemoryTtl);
    if (mem && freshnessOK(mem.data) && Date.now() - mem.timestamp < liveMemoryTtl && (isPaged || mem.data.candles.length >= requiredCached)) {
      return mem.data;
    }

    const distributedCached = await getJsonCache<CandlesResult>(cacheKey);
    if (distributedCached && freshnessOK(distributedCached) && (isPaged || distributedCached.candles.length >= requiredCached)) {
      setMemoryCache(cacheKey, { data: distributedCached, timestamp: Date.now() });
      return distributedCached;
    }

    const errors: string[] = [];
    let bestCandlesCount = 0;
    const chain = getFallbackChain(symbol, interval, Boolean(startDate || options.to != null));
    // On a local workstation Yahoo is reachable and is a single request, while
    // Dukascopy's daily history can exceed the operating-center deadline. Keep
    // the production/Railway chain and replay behavior unchanged.
    if (options.maxAgeMs !== undefined && process.env.NODE_ENV !== "production") {
      chain.sort((a, b) => Number(b.name === "Yahoo") - Number(a.name === "Yahoo"));
    }

    const maxReach =
      interval === "M1"
        ? 7 * 86400
        : interval === "M5" || interval === "M15" || interval === "M30"
        ? 59 * 86400
        : interval === "H1" || interval === "H4"
        ? 720 * 86400
        : 36500 * 86400;
    const nowSecs = Math.floor(Date.now() / 1000);
    const explicitStartDate = normalizeStartDate(options.startDate);
    const isBeyondIntradayReach =
      (isIntradayReplayInterval(interval) || interval === "H1" || interval === "H4") &&
      (options.mode === "replay" || options.to != null || explicitStartDate != null) &&
      ((options.to != null && options.to <= nowSecs - maxReach + intervalSecs * 20) ||
        (explicitStartDate != null && unixDayStart(explicitStartDate) <= nowSecs - maxReach + intervalSecs * 20));

    if (isBeyondIntradayReach) {
      try {
        const synth = await fetchDeepIntradaySynthesized(symbol, interval, options);
        if (synth && synth.candles.length > 0) {
          setMemoryCache(cacheKey, { data: synth, timestamp: Date.now() });
          await setJsonCache(cacheKey, synth, isPaged ? 24 * 3600 : 3600);
          return synth;
        }
      } catch (synthErr) {
        console.warn(`[candles] Deep historical fast-path synthesis failed for ${symbol} ${interval}:`, synthErr);
      }
    }

    for (const { name, fn } of chain) {
      try {
        const breaker = getOrCreateCircuitBreaker({
          name: `candles-provider-${name.toLowerCase()}`,
          failureThreshold: 3,
          cooldownMs: 30_000,
        });
        const candles = await breaker.execute(() => fn(symbol, interval, requestOptions));
        bestCandlesCount = Math.max(bestCandlesCount, candles.length);
        // The depth guard checks the fetched series, not the sliced page. For a
        // cursor page the source window is day-anchored to `from` and structurally
        // cannot hold 120 bars near the live edge (e.g. H1 has ≤24 bars/day), so
        // any non-empty window is accepted there — a short or empty page is a
        // legitimate end-of-history answer.
        const minCandles = isPaged ? 1 : getMinReplayCandles(interval);
        if (candles.length < minCandles) {
          throw new Error(`insufficient candles (${candles.length}/${minCandles})`);
        }
        // Latest window (no cursor, no startDate): keep the MOST RECENT bars —
        // head-slicing a deep fetch would serve months-old data as current.
        const page =
          isPaged || startDate
            ? paginateCandles(candles, options, intervalSecs)
            : { candles: latestWindowCandles(candles, options) };
        console.log(`[candles] ${name} OK: ${symbol} ${interval} → ${page.candles.length} candles`);
        const responseData: CandlesResult = { symbol, interval, source: name.toLowerCase(), ...page, fetchedAt: new Date().toISOString(), stale: false };
        setMemoryCache(cacheKey, { data: responseData, timestamp: Date.now() });
        // Cursor pages: full pages are immutable (24h), short/tail pages may
        // still grow (60s) — mirrors the warehouse TTL rule.
        const ttl = isPaged
          ? responseData.nextFrom != null
            ? 24 * 60 * 60
            : 60
          : candleCacheTtlSeconds(interval, normalizeStartDate(options.startDate));
        await setJsonCache(cacheKey, responseData, ttl);
        return responseData;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${name}: ${msg}`);
        console.warn(`[candles] ${name} failed for ${symbol} ${interval}: ${msg}`);
      }
    }

    const stale = getMemoryCache(cacheKey, true);
    if (stale && (isPaged || stale.data.candles.length >= requiredCached)) {
      console.log(`[candles] Serving stale cache for ${symbol} ${interval}`);
      return { ...stale.data, stale: true };
    }

    if (options.mode === "replay" || options.to != null) {
      try {
        console.log(`[candles] Deep historical synthesis fallback engaged for ${symbol} ${interval}`);
        const synth = await fetchDeepIntradaySynthesized(symbol, interval, options);
        if (synth && synth.candles.length > 0) {
          setMemoryCache(cacheKey, { data: synth, timestamp: Date.now() });
          await setJsonCache(cacheKey, synth, isPaged ? 24 * 3600 : 3600);
          return synth;
        }
      } catch (synthErr) {
        console.warn(`[candles] Deep historical synthesis fallback failed for ${symbol} ${interval}:`, synthErr);
      }
    }

    if (!isPaged && bestCandlesCount > 0 && bestCandlesCount < getMinReplayCandles(interval)) {
      throw new Error(insufficientCandlesMessage(symbol, interval, bestCandlesCount));
    }

    if (
      startDate &&
      isIntradayReplayInterval(interval) &&
      errors.some((error) => error.includes("Yahoo HTTP 422") || error.includes("intraday reach exceeded"))
    ) {
      throw new Error(unavailableIntradayHistoryMessage(symbol, interval, startDate));
    }

    throw new Error(`All data sources failed for ${symbol} ${interval}: ${errors.join("; ")}`);
  });
}
