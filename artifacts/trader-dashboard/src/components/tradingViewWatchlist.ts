import { PAIR_CATALOG, getPairEntry } from "@workspace/pair-catalog";
import { deriveEffectiveFilterItems } from "../lib/toolPairFilters";

/** Pairs shown when the user has no (supported) favorites — same idea as the rest of the dashboard. */
export const DEFAULT_WATCHLIST_PAIRS = ["EURUSD", "GBPUSD", "XAUUSD"];

const WATCHLIST_SUPPORTED_PAIRS = PAIR_CATALOG.map((entry) => entry.symbol);

/**
 * Resolve which pairs the watchlist renders: the user's selected favorites when present,
 * otherwise a default set. Mirrors `deriveEffectiveFilterItems` usage across the dashboard
 * (VolatilityWidget, SentimentWidget, …) so the widget is never empty.
 */
export function resolveWatchlistPairs(selectedPairs: string[]): string[] {
  return deriveEffectiveFilterItems({
    requestedItems: selectedPairs,
    supportedItems: WATCHLIST_SUPPORTED_PAIRS,
    defaultItems: DEFAULT_WATCHLIST_PAIRS,
  }).items;
}

const TRADING_VIEW_CHART_URL = "https://www.tradingview.com/chart/";

const TRADING_VIEW_INDEX_SYMBOLS: Record<string, string> = {
  US30: "CAPITALCOM:US30",
  NAS100: "CAPITALCOM:US100",
  SPX500: "CAPITALCOM:US500",
};

const TRADING_VIEW_CRYPTO_SYMBOLS: Record<string, string> = {
  BTCUSD: "COINBASE:BTCUSD",
  ETHUSD: "COINBASE:ETHUSD",
};

/** One row of the /tools/watchlist payload (mirrors the server shape). */
export interface WatchlistItem {
  pair: string;
  price: number | null;
  changePct: number | null;
  spark: number[];
  time: number | null;
  supported: boolean;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
}

/** Map a pair-catalog symbol (e.g. "EURUSD", "XAUUSD", "US30", "BTCUSD") to a TradingView symbol. */
export function mapCatalogPairToTradingViewSymbol(symbol: string): string {
  const sym = symbol.trim().toUpperCase();
  const entry = getPairEntry(sym);
  if (entry) {
    if (entry.category === "metal") return `OANDA:${sym}`;
    if (entry.category === "index") return TRADING_VIEW_INDEX_SYMBOLS[sym] ?? `CAPITALCOM:${sym}`;
    if (entry.category === "crypto") return TRADING_VIEW_CRYPTO_SYMBOLS[sym] ?? `COINBASE:${sym}`;
    return `FX:${sym}`; // forex-major / forex-minor / forex-exotic
  }
  if (/^[A-Z]{6}$/.test(sym)) return `FX:${sym}`; // unknown but forex-shaped
  return sym; // give the raw symbol to the embed, which surfaces its own error state
}

/** TradingView universal chart link. On iOS/Android the OS routes this to the app if installed. */
export function buildTradingViewDeepLink(symbol: string): string {
  const url = new URL(TRADING_VIEW_CHART_URL);
  url.searchParams.set("symbol", symbol);
  return url.toString();
}

/** Decimals by instrument: JPY-quoted 3, metals 2, indices 1, crypto 2 (0 when ≥1000), FX 5. */
export function formatWatchlistPrice(pair: string, price: number): string {
  const sym = pair.trim().toUpperCase();
  if (sym.endsWith("JPY")) return price.toFixed(3);
  const entry = getPairEntry(sym);
  if (entry?.category === "metal") return price.toFixed(2);
  if (entry?.category === "index") return price.toFixed(1);
  if (entry?.category === "crypto") return price.toFixed(price >= 1000 ? 0 : 2);
  return price.toFixed(5);
}
