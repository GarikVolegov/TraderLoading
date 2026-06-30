// ─── Candle data service ───────────────────────────────────────────────────────
// Fetch logica condivisa fra la route HTTP (/api/backtest/candles) e il "cervello"
// vision (analisi on-demand + scanner autonomo). Estratta da routes/candles.ts.
import { getJsonCache, setJsonCache } from "../lib/cache.js";
import { aggregateInterval, mergeTail } from "./aggregate.js";
import { INTERVAL_SECONDS, symbolId } from "./candleRegistry.js";

const YAHOO_SYMBOLS: Record<string, string> = {
  EURUSD: "EURUSD=X", GBPUSD: "GBPUSD=X", USDJPY: "USDJPY=X",
  USDCHF: "USDCHF=X", AUDUSD: "AUDUSD=X", NZDUSD: "NZDUSD=X",
  USDCAD: "USDCAD=X", EURGBP: "EURGBP=X", EURJPY: "EURJPY=X",
  GBPJPY: "GBPJPY=X", AUDJPY: "AUDJPY=X", XAUUSD: "GC=F",
  US30: "YM=F", NAS100: "NQ=F", SPX500: "ES=F",
  BTCUSD: "BTC-USD", ETHUSD: "ETH-USD",
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

const TWELVE_SYMBOLS: Record<string, string> = {
  EURUSD: "EUR/USD", GBPUSD: "GBP/USD", USDJPY: "USD/JPY",
  USDCHF: "USD/CHF", AUDUSD: "AUD/USD", NZDUSD: "NZD/USD",
  USDCAD: "USD/CAD", EURGBP: "EUR/GBP", EURJPY: "EUR/JPY",
  GBPJPY: "GBP/JPY", AUDJPY: "AUD/JPY", XAUUSD: "XAU/USD",
  XAGUSD: "XAG/USD", USDMXN: "USD/MXN", USDZAR: "USD/ZAR",
};

const COINGECKO_IDS: Record<string, string> = {
  BTCUSD: "bitcoin",
  ETHUSD: "ethereum",
};

const YAHOO_INTERVAL: Record<string, string> = {
  M5: "5m", M15: "15m", M30: "30m", H1: "1h", H4: "4h", D1: "1d", W1: "1wk",
};

const YAHOO_RANGE: Record<string, string> = {
  M5: "60d", M15: "60d", M30: "60d", H1: "2y", H4: "2y", D1: "2y", W1: "2y",
};

const TWELVE_INTERVAL: Record<string, string> = {
  M5: "5min", M15: "15min", M30: "30min", H1: "1h", H4: "4h", D1: "1day", W1: "1week",
};

const TWELVE_OUTPUTSIZE: Record<string, number> = {
  M5: 5000, M15: 5000, M30: 5000, H1: 5000, H4: 5000, D1: 5000, W1: 5000,
};

const MIN_REPLAY_CANDLES: Record<string, number> = {
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
const CACHE_TTL = 60 * 60 * 1000;

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export type CandlesRequestOptions = {
  startDate?: string;
};

export interface CandlesResult {
  symbol: string;
  interval: string;
  source: string;
  candles: Candle[];
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

function hasEnoughReplayCandles(result: CandlesResult, interval: string): boolean {
  return result.candles.length >= getMinReplayCandles(interval);
}

function insufficientCandlesMessage(symbol: string, interval: string, count: number): string {
  return `Servono almeno ${getMinReplayCandles(interval)} candele per avviare il replay ${symbol} ${interval}. Disponibili: ${count}. Prova una data piu recente, un timeframe piu alto o configura TwelveData per storico intraday piu profondo.`;
}

function candleCacheKey(symbol: string, interval: string, startDate: string | null): string {
  return `candles:v2:${symbol}:${interval}:${startDate ?? "latest"}`;
}

function candleCacheTtlSeconds(interval: string, startDate: string | null): number {
  if (startDate) return 24 * 60 * 60;
  if (isIntradayReplayInterval(interval)) return 15 * 60;
  if (interval === "H1" || interval === "H4") return 60 * 60;
  return 6 * 60 * 60;
}

function isIntradayReplayInterval(interval: string): boolean {
  return interval === "M5" || interval === "M15" || interval === "M30";
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
  if (startDate) {
    params.set("period1", String(unixDayStart(startDate)));
    params.set("period2", String(Math.floor(Date.now() / 1000)));
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
  const candles: Candle[] = [];

  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (o != null && h != null && l != null && c != null) {
      candles.push({
        time: ts[i],
        open: parseFloat(o.toFixed(5)),
        high: parseFloat(h.toFixed(5)),
        low: parseFloat(l.toFixed(5)),
        close: parseFloat(c.toFixed(5)),
        volume: q.volume?.[i] ?? undefined,
      });
    }
  }

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
  if (startDate) params.set("start_date", `${startDate} 00:00:00`);
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

  const candles: Candle[] = json.values
    .map((v) => ({
      time: Math.floor(new Date(v.datetime).getTime() / 1000),
      open: parseFloat(parseFloat(v.open).toFixed(5)),
      high: parseFloat(parseFloat(v.high).toFixed(5)),
      low: parseFloat(parseFloat(v.low).toFixed(5)),
      close: parseFloat(parseFloat(v.close).toFixed(5)),
    }))
    .filter((c) => !isNaN(c.time) && !isNaN(c.open))
    .sort((a, b) => a.time - b.time);

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
async function fetchDukascopyLive(symbol: string, interval: string): Promise<Candle[]> {
  if (!isDailyInterval(interval)) throw new Error(`dukascopy live: unsupported interval ${interval}`);
  const { fetchDukascopyDaily } = await import("./ingest/dukascopy.js");
  const now = Math.floor(Date.now() / 1000);
  const daily = await fetchDukascopyDaily(symbol, now - dailyLookbackSeconds(interval), now);
  return interval === "W1" ? aggregateInterval(daily, "W1") : daily;
}

/** Live D1/W1 fetch via Binance's public mirror (crypto), reachable from Railway. */
async function fetchBinanceLive(symbol: string, interval: string): Promise<Candle[]> {
  if (!isDailyInterval(interval)) throw new Error(`binance live: unsupported interval ${interval}`);
  const { fetchBinanceDaily } = await import("./ingest/binance.js");
  const now = Math.floor(Date.now() / 1000);
  const daily = await fetchBinanceDaily(symbol, now - dailyLookbackSeconds(interval), now);
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
  const span = WAREHOUSE_MAX_CANDLES * intervalSeconds * WAREHOUSE_OVERFETCH;
  const startDate = normalizeStartDate(options.startDate);

  if (startDate) {
    const fromTs = unixDayStart(startDate);
    const toTs = Math.min(now, fromTs + span);
    return readAggregated(sid, intervalSeconds, fromTs, toTs, {
      limit: WAREHOUSE_MAX_CANDLES,
      fromStart: true,
    });
  }
  return readAggregated(sid, intervalSeconds, now - span, now, {
    limit: WAREHOUSE_MAX_CANDLES,
    fromStart: false,
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
  if (!isCandleWarehouseEnabled()) return fetchLiveCandles(symbol, interval, options);

  const startDate = normalizeStartDate(options.startDate);
  const warehouseCacheKey = `candles:wh:v1:${symbol}:${interval}:${startDate ?? "latest"}`;
  try {
    const cached = await getJsonCache<CandlesResult>(warehouseCacheKey);
    if (cached && hasEnoughReplayCandles(cached, interval)) return cached;

    const warehouse = await readWarehouseSeries(symbol, interval, options);
    if (warehouse && warehouse.length >= getMinReplayCandles(interval)) {
      let result: CandlesResult;
      if (startDate) {
        // Deep history is fully covered by the warehouse — no live call needed.
        result = { symbol, interval, source: "warehouse", candles: warehouse };
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
      await setJsonCache(warehouseCacheKey, result, startDate ? 24 * 60 * 60 : 60);
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
  const startDate = normalizeStartDate(options.startDate);
  const requestOptions = startDate ? { ...options, startDate } : options;
  const cacheKey = candleCacheKey(symbol, interval, startDate);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL && hasEnoughReplayCandles(cached.data, interval)) {
    return cached.data;
  }

  const distributedCached = await getJsonCache<CandlesResult>(cacheKey);
  if (distributedCached && hasEnoughReplayCandles(distributedCached, interval)) {
    cache.set(cacheKey, { data: distributedCached, timestamp: Date.now() });
    return distributedCached;
  }

  const errors: string[] = [];
  let bestCandlesCount = 0;
  const chain = getFallbackChain(symbol, interval, Boolean(startDate));

  for (const { name, fn } of chain) {
    try {
      const candles = await fn(symbol, interval, requestOptions);
      bestCandlesCount = Math.max(bestCandlesCount, candles.length);
      const minCandles = getMinReplayCandles(interval);
      if (candles.length < minCandles) {
        throw new Error(`insufficient candles (${candles.length}/${minCandles})`);
      }
      console.log(`[candles] ${name} OK: ${symbol} ${interval} → ${candles.length} candles`);
      const responseData: CandlesResult = { symbol, interval, source: name.toLowerCase(), candles };
      cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
      await setJsonCache(cacheKey, responseData, candleCacheTtlSeconds(interval, startDate));
      return responseData;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${name}: ${msg}`);
      console.warn(`[candles] ${name} failed for ${symbol} ${interval}: ${msg}`);
    }
  }

  const stale = cache.get(cacheKey);
  if (stale && hasEnoughReplayCandles(stale.data, interval)) {
    console.log(`[candles] Serving stale cache for ${symbol} ${interval}`);
    return stale.data;
  }

  if (bestCandlesCount > 0 && bestCandlesCount < getMinReplayCandles(interval)) {
    throw new Error(insufficientCandlesMessage(symbol, interval, bestCandlesCount));
  }

  if (startDate && isIntradayReplayInterval(interval) && errors.some((error) => error.includes("Yahoo HTTP 422"))) {
    throw new Error(unavailableIntradayHistoryMessage(symbol, interval, startDate));
  }

  throw new Error(`All data sources failed for ${symbol} ${interval}: ${errors.join("; ")}`);
}
