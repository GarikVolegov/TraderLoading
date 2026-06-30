import { getHistoricalRates } from "dukascopy-node";
import type { Candle } from "../candles.js";
import { SOURCE_ID } from "../candleRegistry.js";
import type { CandleSource } from "./types.js";

// Warehouse symbol → Dukascopy instrument id. FX/metals are stable; the index
// CFD ids should be re-checked against dukascopy-node's instrument list if a
// fetch ever returns empty for them. These are the symbols ingested into the M1
// warehouse (they must each have a SYMBOL_ID in candleRegistry).
const INSTRUMENT: Record<string, string> = {
  EURUSD: "eurusd", GBPUSD: "gbpusd", USDJPY: "usdjpy", USDCHF: "usdchf",
  AUDUSD: "audusd", NZDUSD: "nzdusd", USDCAD: "usdcad", EURGBP: "eurgbp",
  EURJPY: "eurjpy", GBPJPY: "gbpjpy", AUDJPY: "audjpy", XAUUSD: "xauusd",
  US30: "usa30idxusd", NAS100: "usatechidxusd", SPX500: "usa500idxusd",
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

type DukascopyBar = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };

type DukascopyTimeframe = "m1" | "d1";

async function fetchDukascopyTimeframe(
  instrument: string,
  fromTs: number,
  toTs: number,
  timeframe: DukascopyTimeframe,
): Promise<Candle[]> {
  const raw = (await getHistoricalRates({
    instrument,
    dates: { from: new Date(fromTs * 1000), to: new Date(toTs * 1000) },
    timeframe,
    priceType: "bid",
    format: "json",
    volumes: true,
    retryCount: 5,
    pauseBetweenRetriesMs: 1500,
    batchSize: 6,
    batchPauseMs: 500,
  } as Parameters<typeof getHistoricalRates>[0])) as unknown as DukascopyBar[];

  if (!Array.isArray(raw)) throw new Error("dukascopy: unexpected response shape");

  return raw
    .map((r) => ({
      time: Math.floor(r.timestamp / 1000),
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      volume: r.volume,
    }))
    .filter(
      (c) =>
        Number.isFinite(c.time) &&
        Number.isFinite(c.open) &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close) &&
        c.high >= c.low,
    )
    .sort((a, b) => a.time - b.time);
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
export async function fetchDukascopyDaily(symbol: string, fromTs: number, toTs: number): Promise<Candle[]> {
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
