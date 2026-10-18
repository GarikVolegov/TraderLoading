import type { ReplayCandle } from "./types";

/** Replay time is an exclusive market-data cutoff, never a timeframe label. */
export function cursorAtReplayTime(candles: ReplayCandle[], replayTime: number): number {
  let lo = 0;
  let hi = candles.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time < replayTime) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** Hide the future portion of a higher-timeframe candle after an exact seek. */
export function revealAtReplayTime(
  candles: ReplayCandle[],
  replayTime: number | null,
  intervalSeconds: number,
  partialCandle: ReplayCandle | null,
): ReplayCandle[] {
  if (replayTime == null) return [];
  const cursor = cursorAtReplayTime(candles, replayTime);
  if (cursor < 0) return [];
  const revealed = candles.slice(0, cursor + 1);
  const last = revealed[revealed.length - 1];
  if (last.time + intervalSeconds > replayTime) {
    // Never substitute the complete candle if the partial request had no bars.
    if (!partialCandle || partialCandle.time !== last.time) revealed.pop();
    else revealed[revealed.length - 1] = partialCandle;
  }
  return revealed;
}

/** New v3 stores exact cutoff; v2 stored the last bar's opening timestamp. */
export function migrateReplayTime(cursorTime: number | null, intervalSeconds: number): number | null {
  return cursorTime == null ? null : cursorTime + intervalSeconds;
}

/** Project time-based drawings onto any timeframe, including between bars. */
export function logicalIndexAtTime(candles: ReplayCandle[], time: number, intervalSeconds: number): number | null {
  if (!candles.length) return null;
  const before = cursorAtReplayTime(candles, time + 0.001);
  if (before < 0) return (time - candles[0].time) / intervalSeconds;
  const bar = candles[before];
  const nextTime = candles[before + 1]?.time ?? bar.time + intervalSeconds;
  return before + (time - bar.time) / Math.max(1, nextTime - bar.time);
}
