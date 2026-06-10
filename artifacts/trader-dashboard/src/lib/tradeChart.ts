// Helper per lo snapshot grafico dei trade importati: normalizzazione simbolo,
// scelta del timeframe in base alla durata e selezione della finestra candele.

export interface ChartCandle {
  time: number; // epoch secondi
  open: number;
  high: number;
  low: number;
  close: number;
}

// Simboli serviti da /api/backtest/candles (vedi api-server/src/services/candles.ts).
const SUPPORTED_SYMBOLS = new Set([
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "NZDUSD", "USDCAD",
  "EURGBP", "EURJPY", "GBPJPY", "AUDJPY", "XAUUSD",
  "US30", "NAS100", "SPX500", "BTCUSD", "ETHUSD",
]);

/** "XAUUSD.R" / "xauusd" / "XAU/USD" → "XAUUSD"; null se non supportato dal feed candele. */
export function normalizeTradeSymbol(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace("/", "").split(".")[0].trim();
  return SUPPORTED_SYMBOLS.has(cleaned) ? cleaned : null;
}

const HOUR = 3600;
const DAY = 24 * HOUR;

/** Timeframe adatto alla durata del trade (abbastanza candele per leggere il contesto). */
export function pickChartInterval(openTime: string, closeTime: string): "M15" | "H1" | "H4" | "D1" {
  const open = new Date(openTime).getTime();
  const close = new Date(closeTime).getTime();
  if (Number.isNaN(open) || Number.isNaN(close)) return "H1";
  const seconds = Math.max(0, (close - open) / 1000);
  if (seconds <= 3 * HOUR) return "M15";
  if (seconds <= DAY) return "H1";
  if (seconds <= 5 * DAY) return "H4";
  return "D1";
}

/**
 * Estrae la finestra di candele attorno al trade con un margine di contesto
 * (`padCandles` per lato). Ritorna [] se il trade è fuori dal range disponibile.
 */
export function selectTradeWindow(
  candles: ChartCandle[],
  openTime: string,
  closeTime: string,
  padCandles = 12,
): ChartCandle[] {
  if (candles.length === 0) return [];
  const openSec = Math.floor(new Date(openTime).getTime() / 1000);
  const closeSec = Math.floor(new Date(closeTime).getTime() / 1000);
  if (Number.isNaN(openSec) || Number.isNaN(closeSec)) return [];

  const firstIdx = candles.findIndex((c) => c.time >= openSec);
  if (firstIdx === -1) return [];
  let lastIdx = candles.length - 1;
  for (let i = firstIdx; i < candles.length; i++) {
    if (candles[i].time > closeSec) { lastIdx = Math.max(firstIdx, i - 1); break; }
  }

  const start = Math.max(0, firstIdx - padCandles);
  const end = Math.min(candles.length, lastIdx + padCandles + 1);
  const window = candles.slice(start, end);
  // Senza nessuna candela dentro la durata del trade il contesto è inutile.
  return window.some((c) => c.time >= openSec - DAY && c.time <= closeSec + DAY) ? window : [];
}
