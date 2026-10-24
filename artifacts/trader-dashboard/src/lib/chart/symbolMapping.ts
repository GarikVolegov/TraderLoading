import { getPairEntry } from "@workspace/pair-catalog";

export const DEFAULT_TRADINGVIEW_SYMBOLS: Record<string, string> = {
  XAUUSD: "OANDA:XAUUSD",
  EURUSD: "OANDA:EURUSD",
  GBPUSD: "OANDA:GBPUSD",
  USDJPY: "OANDA:USDJPY",
  USDCHF: "OANDA:USDCHF",
  AUDUSD: "OANDA:AUDUSD",
  NZDUSD: "OANDA:NZDUSD",
  USDCAD: "OANDA:USDCAD",
  EURJPY: "OANDA:EURJPY",
  GBPJPY: "OANDA:GBPJPY",
  EURGBP: "OANDA:EURGBP",
  AUDJPY: "OANDA:AUDJPY",
  US30: "CAPITALCOM:US30",
  NAS100: "OANDA:NAS100USD",
  SPX500: "OANDA:SPX500USD",
  BTCUSD: "BINANCE:BTCUSDT",
  ETHUSD: "BINANCE:ETHUSDT",
  USOIL: "TVC:USOIL",
  XAGUSD: "OANDA:XAGUSD",
};

/**
 * Normalizza il simbolo LIMEN in un ticker completo per TradingView WebSocket.
 */
export function resolveTradingViewSymbol(rawSymbol: string): string {
  const clean = rawSymbol.trim().toUpperCase().replace(/[\/\-_]/g, "");
  if (DEFAULT_TRADINGVIEW_SYMBOLS[clean]) {
    return DEFAULT_TRADINGVIEW_SYMBOLS[clean];
  }
  const entry = getPairEntry(clean);
  if (entry) {
    if (entry.category === "metal") return `OANDA:${clean}`;
    if (entry.category === "index") return `CAPITALCOM:${clean}`;
    if (entry.category === "crypto") return `BINANCE:${clean}T`;
    return `FX:${clean}`;
  }
  if (/^[A-Z]{6}$/.test(clean)) return `FX:${clean}`;
  return clean;
}

/**
 * Converte i timeframe del Cockpit in risoluzioni accettate da TradingView WebSocket.
 */
export function resolveTradingViewTimeframe(interval: string): string {
  const norm = interval.trim().toUpperCase();
  switch (norm) {
    case "1":
    case "M1":
      return "1";
    case "5":
    case "M5":
      return "5";
    case "15":
    case "M15":
      return "15";
    case "30":
    case "M30":
      return "30";
    case "60":
    case "H1":
      return "60";
    case "240":
    case "H4":
      return "240";
    case "D":
    case "D1":
    case "1D":
      return "1D";
    case "W":
    case "W1":
    case "1W":
      return "1W";
    default:
      return norm;
  }
}

/**
 * Converte il timeframe TradingView in secondi per il calcolo del conto alla rovescia.
 */
export function timeframeToSeconds(interval: string): number {
  const tf = resolveTradingViewTimeframe(interval);
  if (tf === "1") return 60;
  if (tf === "5") return 300;
  if (tf === "15") return 900;
  if (tf === "30") return 1800;
  if (tf === "60") return 3600;
  if (tf === "240") return 14400;
  if (tf === "1D") return 86400;
  if (tf === "1W") return 604800;
  const num = parseInt(tf, 10);
  return Number.isFinite(num) && num > 0 ? num * 60 : 3600;
}
