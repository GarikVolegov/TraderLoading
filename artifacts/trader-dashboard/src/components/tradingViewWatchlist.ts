import { PAIR_CATALOG, getPairEntry } from "@workspace/pair-catalog";
import { deriveEffectiveFilterItems } from "../lib/toolPairFilters";

export const TRADING_VIEW_MINI_SYMBOL_SCRIPT =
  "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";

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

export interface TradingViewMiniSymbolConfig {
  symbol: string;
  width: string;
  height: string;
  locale: string;
  dateRange: string;
  colorTheme: "dark";
  isTransparent: boolean;
  autosize: boolean;
  largeChartUrl: string;
  chartOnly: boolean;
  noTimeScale: boolean;
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

export function buildTradingViewMiniSymbolConfig(symbol: string): TradingViewMiniSymbolConfig {
  return {
    symbol,
    width: "100%",
    height: "100%",
    locale: "it",
    dateRange: "1D",
    colorTheme: "dark",
    isTransparent: true,
    autosize: true,
    largeChartUrl: "",
    chartOnly: false,
    noTimeScale: true,
  };
}

export interface WatchlistItem {
  pair: string;
  supported: boolean;
  price: number | null;
  changePct: number | null;
  spark: number[];
  latestBarMs: number | null;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
}

export function formatWatchlistPrice(pair: string, price: number): string {
  const sym = pair.trim().toUpperCase();
  const entry = getPairEntry(sym);
  if (sym.includes("JPY")) return price.toFixed(3);
  if (entry?.category === "index" || entry?.category === "crypto" || entry?.category === "metal") {
    return price.toFixed(2);
  }
  return price.toFixed(price >= 100 ? 2 : 5);
}

const WATCHLIST_LIVE_MAX_AGE_MS = 36 * 60 * 60 * 1000;

export function watchlistFreshness(
  items: WatchlistItem[],
  nowMs: number,
): { isLive: boolean; latestBarMs: number | null } {
  let latestBarMs: number | null = null;
  for (const item of items) {
    if (typeof item.latestBarMs === "number" && (latestBarMs === null || item.latestBarMs > latestBarMs)) {
      latestBarMs = item.latestBarMs;
    }
  }
  return {
    isLive: latestBarMs !== null && nowMs - latestBarMs <= WATCHLIST_LIVE_MAX_AGE_MS,
    latestBarMs,
  };
}
