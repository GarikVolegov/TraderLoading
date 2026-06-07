export const TRADING_VIEW_PREF_KEY = "tl_account_bridge_tradingview_v1";
export const DEFAULT_TRADING_VIEW_SYMBOL = "FX:EURUSD";
export const DEFAULT_TRADING_VIEW_TIMEFRAME = "60";
export const TRADING_VIEW_TIMEFRAMES = ["1", "5", "15", "30", "60", "240", "D"] as const;

export type TradingViewTimeframe = (typeof TRADING_VIEW_TIMEFRAMES)[number];

export interface TradingViewPreferences {
  symbol: string;
  timeframe: TradingViewTimeframe;
}

export function mapBrokerSymbolToTradingView(symbol: string): string {
  const normalized = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!normalized) return DEFAULT_TRADING_VIEW_SYMBOL;
  if (normalized.startsWith("XAU")) return "OANDA:XAUUSD";
  if (normalized.startsWith("BTC")) return "BINANCE:BTCUSDT";
  if (normalized.length === 6) return `FX:${normalized}`;
  return normalized;
}

export function normalizeTradingViewPreferences(raw: unknown): TradingViewPreferences {
  if (typeof raw !== "object" || raw === null) {
    return { symbol: DEFAULT_TRADING_VIEW_SYMBOL, timeframe: DEFAULT_TRADING_VIEW_TIMEFRAME };
  }

  const value = raw as Partial<TradingViewPreferences>;
  const symbol =
    typeof value.symbol === "string" && value.symbol.trim()
      ? value.symbol.trim().toUpperCase()
      : DEFAULT_TRADING_VIEW_SYMBOL;
  const timeframe = TRADING_VIEW_TIMEFRAMES.includes(value.timeframe as TradingViewTimeframe)
    ? (value.timeframe as TradingViewTimeframe)
    : DEFAULT_TRADING_VIEW_TIMEFRAME;

  return { symbol, timeframe };
}
