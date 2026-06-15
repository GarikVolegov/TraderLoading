import type { CandleSource } from "./types.js";
import { dukascopySource } from "./dukascopy.js";
import { binanceSource } from "./binance.js";

// Source priority: the first source that supports a symbol wins. Dukascopy covers
// FX/metals/indices (with real tick-volume); Binance covers crypto.
export const ALL_SOURCES: CandleSource[] = [dukascopySource, binanceSource];

export function sourceForSymbol(symbol: string): CandleSource | undefined {
  return ALL_SOURCES.find((source) => source.supports(symbol));
}

export { binanceSource, dukascopySource };
