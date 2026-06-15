import type { Candle } from "../candles.js";

/**
 * A bulk historical data source for the candle warehouse. Adapters normalize a
 * provider into ascending, UTC unix-second, bar-open-time candles so the rest of
 * the ingestion pipeline is source-agnostic. See
 * docs/superpowers/specs/2026-06-14-candle-warehouse-design.md.
 */
export interface CandleSource {
  /** SOURCE_ID for the `candle.source` column. */
  readonly id: number;
  readonly name: string;
  /** Whether this source can serve the given warehouse symbol. */
  supports(symbol: string): boolean;
  /**
   * Returns candles in `[fromTs, toTs)`, ascending by `time`, with UTC
   * unix-second open-times. Resolution is the source's native base (M1 for
   * Dukascopy/Binance, D1 for daily-only fallbacks).
   */
  fetchRange(symbol: string, fromTs: number, toTs: number): Promise<Candle[]>;
}
