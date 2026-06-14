// ─── Candle warehouse registry ───────────────────────────────────────────────
// Single source of truth for the numeric ids stored in the `candle` table and the
// canonical timeframe → seconds mapping. Keeping ids in code (mirroring the
// existing YAHOO_SYMBOLS-style maps) keeps warehouse rows narrow (smallint) and
// avoids a join on the hot serving path. See
// docs/superpowers/specs/2026-06-14-candle-warehouse-design.md.

/** Instrument id stored in `candle.symbol`. Stable: never renumber existing ids. */
export const SYMBOL_ID = {
  EURUSD: 1,
  GBPUSD: 2,
  USDJPY: 3,
  USDCHF: 4,
  AUDUSD: 5,
  NZDUSD: 6,
  USDCAD: 7,
  EURGBP: 8,
  EURJPY: 9,
  GBPJPY: 10,
  AUDJPY: 11,
  XAUUSD: 12,
  US30: 13,
  NAS100: 14,
  SPX500: 15,
  BTCUSD: 16,
  ETHUSD: 17,
} as const;

export type WarehouseSymbol = keyof typeof SYMBOL_ID;

/** Data source id stored in `candle.source`. */
export const SOURCE_ID = {
  dukascopy: 1,
  binance: 2,
  stooq: 3,
  yahoo: 4,
  twelvedata: 5,
} as const;

export type WarehouseSource = keyof typeof SOURCE_ID;

/** Stored base resolution in minutes (`candle.res`). */
export const RES = {
  M1: 1,
  D1: 1440,
} as const;

/** Canonical timeframe → seconds. Drives bucketing and aggregation. */
export const INTERVAL_SECONDS: Record<string, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
  D1: 86400,
  W1: 604800,
};

const SYMBOL_BY_ID: Record<number, WarehouseSymbol> = Object.fromEntries(
  Object.entries(SYMBOL_ID).map(([symbol, id]) => [id, symbol as WarehouseSymbol]),
) as Record<number, WarehouseSymbol>;

export function symbolId(symbol: string): number | undefined {
  return (SYMBOL_ID as Record<string, number>)[symbol];
}

export function symbolForId(id: number): WarehouseSymbol | undefined {
  return SYMBOL_BY_ID[id];
}

export function intervalSeconds(interval: string): number | undefined {
  return INTERVAL_SECONDS[interval];
}
