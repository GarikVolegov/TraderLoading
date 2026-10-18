import {
  BufferFetcher,
  generateUrls,
  normaliseDates,
  processData,
  validateConfigNode,
} from "dukascopy-node";
import type { Candle } from "../candles.js";
import { SOURCE_ID } from "../candleRegistry.js";
import type { CandleSource } from "./types.js";

// Warehouse symbol → Dukascopy instrument id. FX/metals are stable; the index
// CFD ids should be re-checked against dukascopy-node's instrument list if a
// fetch ever returns empty for them. These are the symbols ingested into the M1
// warehouse (they must each have a SYMBOL_ID in candleRegistry).
const INSTRUMENT: Record<string, string> = {
  EURUSD: "eurusd",
  GBPUSD: "gbpusd",
  USDJPY: "usdjpy",
  USDCHF: "usdchf",
  AUDUSD: "audusd",
  NZDUSD: "nzdusd",
  USDCAD: "usdcad",
  EURGBP: "eurgbp",
  EURJPY: "eurjpy",
  GBPJPY: "gbpjpy",
  AUDJPY: "audjpy",
  XAUUSD: "xauusd",
  US30: "usa30idxusd",
  NAS100: "usatechidxusd",
  SPX500: "usa500idxusd",
  USOIL: "lightcmdusd",
};

// Instruments served by the live daily (D1) fetcher used as a Railway-friendly
// fallback for the serving layer (Yahoo blocks Railway's datacenter IP). This is
// a superset of the warehouse INSTRUMENT map — it adds symbols the volatility
// widget needs that are not (yet) ingested into the warehouse. Kept separate so
// warehouse ingestion (which iterates SYMBOL_ID) is unaffected.
const DAILY_INSTRUMENT: Record<string, string> = {
  ...INSTRUMENT,
  XAGUSD: "xagusd",
  USDMXN: "usdmxn",
  USDZAR: "usdzar",
};

type DukascopyTimeframe = "m1" | "d1";

export async function fetchDukascopyFile(
  url: string,
  fetcher: typeof fetch = fetch,
): Promise<Buffer> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    throw new Error(
      `Dukascopy HTTP ${response.status}${retryAfter ? ` (Retry-After ${retryAfter})` : ""}`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

async function fetchDukascopyTimeframe(
  instrument: string,
  fromTs: number,
  toTs: number,
  timeframe: DukascopyTimeframe,
): Promise<Candle[]> {
  const config = validateConfigNode({
    instrument,
    dates: { from: new Date(fromTs * 1000), to: new Date(toTs * 1000) },
    timeframe,
    priceType: "bid",
    format: "json",
    volumes: true,
  } as Parameters<typeof validateConfigNode>[0]);
  if (!config.isValid) throw new Error("dukascopy: invalid instrument or date range");
  const input = config.input;
  const [startDate, endDate] = normaliseDates({
    instrument: input.instrument,
    startDate: input.dates.from,
    endDate: input.dates.to,
    timeframe: input.timeframe,
    utcOffset: input.utcOffset,
  });
  const urls = generateUrls({
    instrument: input.instrument,
    timeframe: input.timeframe,
    priceType: input.priceType,
    startDate,
    endDate,
  });
  // The SDK's default retry hides HTTP status as "Unknown error" and the old
  // batchPauseMs setting was ignored. A single lane with the actual option
  // avoids simultaneous day-file requests and propagates rate limits.
  const downloader = new BufferFetcher({
    batchSize: 1,
    pauseBetweenBatchesMs: 750,
    fetcherFn: fetchDukascopyFile,
  });
  const files = await downloader.fetch(urls);
  const raw = processData({
    instrument: input.instrument,
    requestedTimeframe: input.timeframe,
    bufferObjects: files,
    priceType: input.priceType,
    volumes: true,
    volumeUnits: input.volumeUnits,
    ignoreFlats: input.ignoreFlats,
  });

  const bars = raw
    .filter((r) => r[0] >= fromTs * 1000 && r[0] < toTs * 1000)
    .map((r) => ({
      time: Math.floor(r[0] / 1000),
      open: r[1],
      high: r[2],
      low: r[3],
      close: r[4],
      volume: r[5],
    }))
    .sort((a, b) => a.time - b.time);
  if (
    bars.some(
      (c) =>
        ![c.time, c.open, c.high, c.low, c.close].every(Number.isFinite) ||
        c.high < Math.max(c.open, c.close) ||
        c.low > Math.min(c.open, c.close),
    )
  ) {
    throw new Error("dukascopy: invalid candle in source response");
  }
  return bars;
}

/** Whether the live daily fetcher can serve this symbol. */
export function dukascopySupportsDaily(symbol: string): boolean {
  return symbol in DAILY_INSTRUMENT;
}

/**
 * Fetch daily (D1) candles for the live serving layer. Uses Dukascopy's own
 * datafeed (not Yahoo), so it works from Railway where Yahoo is IP-blocked.
 * Ascending, UTC unix-second open-times.
 */
export async function fetchDukascopyDaily(
  symbol: string,
  fromTs: number,
  toTs: number,
): Promise<Candle[]> {
  const instrument = DAILY_INSTRUMENT[symbol];
  if (!instrument) throw new Error(`dukascopy: unsupported symbol ${symbol}`);
  return fetchDukascopyTimeframe(instrument, fromTs, toTs, "d1");
}

export const dukascopySource: CandleSource = {
  id: SOURCE_ID.dukascopy,
  name: "dukascopy",
  supports: (symbol) => symbol in INSTRUMENT,
  async fetchRange(symbol, fromTs, toTs) {
    const instrument = INSTRUMENT[symbol];
    if (!instrument) throw new Error(`dukascopy: unsupported symbol ${symbol}`);
    return fetchDukascopyTimeframe(instrument, fromTs, toTs, "m1");
  },
};
