import type { Candle } from "./candles.js";
import { INTERVAL_SECONDS } from "./candleRegistry.js";

function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function createRng(seed: number) {
  let a = seed >>> 0;
  return function nextFloat(): number {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDecimals(symbol: string): number {
  if (symbol.includes("JPY")) return 3;
  if (symbol === "BTCUSD" || symbol === "ETHUSD" || symbol === "USOIL" || symbol === "XAUUSD" || symbol === "XAGUSD") return 2;
  if (symbol === "US30" || symbol === "NAS100" || symbol === "SPX500") return 1;
  return 5;
}

/**
 * Synthesize granular intraday bars (H4, H1, M30, M15, M5, M1) from real Daily (D1) bars.
 * 
 * Guarantee:
 * 1. The first bar of each day opens at exactly day.open.
 * 2. The last bar of each day closes at exactly day.close.
 * 3. The maximum high across all bars of that day equals day.high.
 * 4. The minimum low across all bars of that day equals day.low.
 * 5. Price action is continuous across bars within each trading day.
 * 6. Intraday volatility curve reflects institutional session liquidity (Asia range, London manipulation/sweep, NY expansion & close).
 * 7. Fully deterministic: identical input generates the exact same bars every time.
 */
export function synthesizeIntradayCandles(
  dailyCandles: Candle[],
  targetInterval: string,
  symbol: string,
): Candle[] {
  const intervalSecs = INTERVAL_SECONDS[targetInterval] ?? 3600;
  if (intervalSecs >= 86400) return dailyCandles;

  const decimals = getDecimals(symbol);
  const barsPerDay = Math.floor(86400 / intervalSecs);
  const result: Candle[] = [];

  for (const day of dailyCandles) {
    if (!Number.isFinite(day.open) || !Number.isFinite(day.high) || !Number.isFinite(day.low) || !Number.isFinite(day.close)) {
      continue;
    }

    const dayTime = Math.floor(day.time / 86400) * 86400;
    const rng = createRng(hashString(`${symbol}:${dayTime}:${targetInterval}`));
    const isBullish = day.close >= day.open;
    const dayRange = Math.max(10 ** -decimals, day.high - day.low);

    // Timing of the day extremes:
    // Bullish day: Low formed in early session (London open ~08:00 UTC), High formed in NY expansion (~15:00 UTC)
    // Bearish day: High formed in early London Judas swing (~08:00 UTC), Low formed in NY (~16:00 UTC)
    const lowFraction = isBullish ? 0.22 + rng() * 0.16 : 0.60 + rng() * 0.18;
    const highFraction = isBullish ? 0.60 + rng() * 0.18 : 0.22 + rng() * 0.16;

    const lowBarIdx = Math.max(1, Math.min(barsPerDay - 2, Math.floor(barsPerDay * lowFraction)));
    let highBarIdx = Math.max(1, Math.min(barsPerDay - 2, Math.floor(barsPerDay * highFraction)));
    if (highBarIdx === lowBarIdx) {
      highBarIdx = (lowBarIdx + 1) % barsPerDay;
    }

    const firstExtremeIdx = Math.min(lowBarIdx, highBarIdx);
    const secondExtremeIdx = Math.max(lowBarIdx, highBarIdx);
    const firstExtremePrice = firstExtremeIdx === lowBarIdx ? day.low : day.high;
    const secondExtremePrice = secondExtremeIdx === lowBarIdx ? day.low : day.high;

    // Anchor points: [0: Day Open] -> [firstExtreme] -> [secondExtreme] -> [barsPerDay: Day Close]
    const anchors = [
      { idx: 0, price: day.open },
      { idx: firstExtremeIdx, price: firstExtremePrice },
      { idx: secondExtremeIdx, price: secondExtremePrice },
      { idx: barsPerDay, price: day.close },
    ];

    const skeleton = new Float64Array(barsPerDay + 1);
    for (let s = 0; s < anchors.length - 1; s++) {
      const a1 = anchors[s];
      const a2 = anchors[s + 1];
      const len = a2.idx - a1.idx;
      for (let k = 0; k <= len; k++) {
        const t = len > 0 ? k / len : 0;
        const smoothT = (1 - Math.cos(t * Math.PI)) / 2;
        skeleton[a1.idx + k] = a1.price + (a2.price - a1.price) * smoothT;
      }
    }

    let currentOpen = day.open;
    const dayVolume = day.volume && day.volume > 0 ? day.volume : 50_000;

    for (let i = 0; i < barsPerDay; i++) {
      const barTime = dayTime + i * intervalSecs;
      const targetClose = skeleton[i + 1];
      const noise = (rng() - 0.5) * (dayRange / Math.sqrt(barsPerDay)) * 0.75;
      let barClose = i === barsPerDay - 1 ? day.close : targetClose + noise;

      barClose = Math.max(day.low, Math.min(day.high, barClose));

      const wick1 = rng() * (dayRange / Math.sqrt(barsPerDay)) * 0.55;
      const wick2 = rng() * (dayRange / Math.sqrt(barsPerDay)) * 0.55;

      let barHigh = Math.max(currentOpen, barClose) + wick1;
      let barLow = Math.min(currentOpen, barClose) - wick2;

      if (i === lowBarIdx) barLow = day.low;
      if (i === highBarIdx) barHigh = day.high;

      barHigh = Math.max(barHigh, Math.max(currentOpen, barClose));
      barLow = Math.min(barLow, Math.min(currentOpen, barClose));
      barHigh = Math.min(day.high, barHigh);
      barLow = Math.max(day.low, barLow);

      const hourOfDay = ((i * intervalSecs) / 3600) % 24;
      const sessionFactor = hourOfDay >= 7 && hourOfDay <= 17 ? 1.6 : 0.65;
      const barVol = Math.round((dayVolume / barsPerDay) * sessionFactor * (0.85 + rng() * 0.3));

      result.push({
        time: barTime,
        open: Number(currentOpen.toFixed(decimals)),
        high: Number(barHigh.toFixed(decimals)),
        low: Number(barLow.toFixed(decimals)),
        close: Number(barClose.toFixed(decimals)),
        volume: barVol,
      });

      currentOpen = barClose;
    }
  }

  return result.sort((a, b) => a.time - b.time);
}
