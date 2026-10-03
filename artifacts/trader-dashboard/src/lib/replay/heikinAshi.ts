// ─── Heikin-Ashi transform ───────────────────────────────────────────────────
// Standard smoothing: haClose = OHLC mean, haOpen chains off the previous HA
// bar. Fed to the candlestick series when the terminal's chart type is "heikin".
import type { ReplayCandle } from "./types";

export function toHeikinAshi(candles: ReplayCandle[]): ReplayCandle[] {
  const out: ReplayCandle[] = new Array(candles.length);
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0 ? (c.open + c.close) / 2 : (out[i - 1].open + out[i - 1].close) / 2;
    out[i] = {
      time: c.time,
      open: haOpen,
      high: Math.max(c.high, haOpen, haClose),
      low: Math.min(c.low, haOpen, haClose),
      close: haClose,
      volume: c.volume,
    };
  }
  return out;
}
