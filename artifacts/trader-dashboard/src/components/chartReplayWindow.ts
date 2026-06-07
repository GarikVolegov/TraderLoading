import type { CandlestickData, Time } from "lightweight-charts";

export const DEFAULT_REPLAY_VISIBLE_CANDLES = 120;

export function getReplayIntervalSeconds(interval: string): number {
  const normalized = interval.toUpperCase();
  const table: Record<string, number> = {
    M1: 60,
    M5: 5 * 60,
    M15: 15 * 60,
    M30: 30 * 60,
    H1: 60 * 60,
    H4: 4 * 60 * 60,
    D1: 24 * 60 * 60,
    W1: 7 * 24 * 60 * 60,
  };
  return table[normalized] ?? 60 * 60;
}

export function resolveReplayStartIndex(
  candles: Array<Pick<CandlestickData<Time>, "time">>,
  startDate: string,
  visibleCount: number,
): number {
  if (!startDate || candles.length === 0) return 0;

  const targetTs = new Date(startDate).getTime() / 1000;
  let startIndex = candles.findIndex((c) => (c.time as number) >= targetTs);
  if (startIndex === -1) startIndex = Math.max(0, candles.length - visibleCount);

  const maxFullWindowStart = Math.max(0, candles.length - visibleCount);
  return Math.min(startIndex, maxFullWindowStart);
}

export function resolveReplayWindowForAnchor(
  candles: Array<Pick<CandlestickData<Time>, "time">>,
  anchorTime: number,
  visibleCount: number,
): { startIndex: number; revealedCount: number } {
  if (candles.length === 0) return { startIndex: 0, revealedCount: 0 };

  const revealedCount = Math.min(Math.max(1, visibleCount), candles.length);
  let anchorIndex = candles.findIndex((c) => (c.time as number) >= anchorTime);
  if (anchorIndex === -1) anchorIndex = candles.length - 1;

  const startIndex = Math.max(0, anchorIndex - revealedCount + 1);
  return { startIndex, revealedCount };
}

export function resolveReplayWindowForCloseAnchor(
  candles: Array<Pick<CandlestickData<Time>, "time">>,
  anchorCloseTime: number,
  targetInterval: string,
  visibleCount: number,
): { startIndex: number; revealedCount: number } {
  if (candles.length === 0) return { startIndex: 0, revealedCount: 0 };

  const intervalSeconds = getReplayIntervalSeconds(targetInterval);
  let anchorIndex = candles.findIndex((c) => ((c.time as number) + intervalSeconds) >= anchorCloseTime);
  if (anchorIndex === -1) anchorIndex = candles.length - 1;

  const revealedCount = Math.min(Math.max(1, visibleCount), anchorIndex + 1, candles.length);
  const startIndex = Math.max(0, anchorIndex - revealedCount + 1);
  return { startIndex, revealedCount };
}

export function resolveReplayPointCloseTime(
  candle: Pick<CandlestickData<Time>, "time"> | undefined,
  interval: string,
): number | null {
  if (!candle) return null;
  return (candle.time as number) + getReplayIntervalSeconds(interval);
}

export function applyFormingCandleForAnchor<T extends CandlestickData<Time>>(
  candles: T[],
  anchorCloseTime: number,
  targetInterval: string,
  anchorPrice: number,
): T[] {
  if (candles.length === 0 || !Number.isFinite(anchorPrice)) return candles;

  const intervalSeconds = getReplayIntervalSeconds(targetInterval);
  const anchorIndex = candles.findIndex((c) => {
    const openTime = c.time as number;
    const closeTime = openTime + intervalSeconds;
    return openTime < anchorCloseTime && closeTime >= anchorCloseTime;
  });
  if (anchorIndex === -1) return candles;

  return candles.map((candle, index) => {
    if (index !== anchorIndex) return candle;
    return {
      ...candle,
      close: anchorPrice,
      high: Math.max(candle.open, anchorPrice),
      low: Math.min(candle.open, anchorPrice),
    };
  });
}
