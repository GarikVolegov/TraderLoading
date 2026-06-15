import { getHistoricalRates } from "dukascopy-node";
import { SOURCE_ID } from "../candleRegistry.js";
import type { CandleSource } from "./types.js";

// Warehouse symbol → Dukascopy instrument id. FX/metals are stable; the index
// CFD ids should be re-checked against dukascopy-node's instrument list if a
// fetch ever returns empty for them.
const INSTRUMENT: Record<string, string> = {
  EURUSD: "eurusd", GBPUSD: "gbpusd", USDJPY: "usdjpy", USDCHF: "usdchf",
  AUDUSD: "audusd", NZDUSD: "nzdusd", USDCAD: "usdcad", EURGBP: "eurgbp",
  EURJPY: "eurjpy", GBPJPY: "gbpjpy", AUDJPY: "audjpy", XAUUSD: "xauusd",
  US30: "usa30idxusd", NAS100: "usatechidxusd", SPX500: "usa500idxusd",
};

type DukascopyBar = { timestamp: number; open: number; high: number; low: number; close: number; volume: number };

export const dukascopySource: CandleSource = {
  id: SOURCE_ID.dukascopy,
  name: "dukascopy",
  supports: (symbol) => symbol in INSTRUMENT,
  async fetchRange(symbol, fromTs, toTs) {
    const instrument = INSTRUMENT[symbol];
    if (!instrument) throw new Error(`dukascopy: unsupported symbol ${symbol}`);

    const raw = (await getHistoricalRates({
      instrument,
      dates: { from: new Date(fromTs * 1000), to: new Date(toTs * 1000) },
      timeframe: "m1",
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
  },
};
