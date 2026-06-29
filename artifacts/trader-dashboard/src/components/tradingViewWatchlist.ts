import { getPairEntry } from "@workspace/pair-catalog";

export const TRADING_VIEW_MINI_SYMBOL_SCRIPT =
  "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";

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
