// ─── Replay cursor math ──────────────────────────────────────────────────────
// The cursor is the index of the last revealed bar in the active-timeframe
// series. Pure helpers for stepping, scrubber mapping and date seeking; the
// timeframe-switch anchor math lives in components/chartReplayWindow.ts and is
// composed by the engine hook.
import type { ReplayCandle } from "./types";

/** Bars revealed before the user can rewind further (indicator warm-up). */
export const MIN_REVEALED_BARS = 30;

export function clampCursor(cursor: number, length: number, minIndex: number): number {
  if (length <= 0) return 0;
  const lo = Math.min(Math.max(0, minIndex), length - 1);
  return Math.min(length - 1, Math.max(lo, Math.floor(cursor)));
}

export function stepCursor(cursor: number, delta: number, length: number, minIndex: number): number {
  return clampCursor(cursor + delta, length, minIndex);
}

/** Scrubber position in [0, 1] for a cursor. */
export function cursorFraction(cursor: number, length: number, minIndex: number): number {
  if (length <= 0) return 0;
  const lo = Math.min(Math.max(0, minIndex), length - 1);
  const span = length - 1 - lo;
  if (span <= 0) return 1;
  return (clampCursor(cursor, length, minIndex) - lo) / span;
}

/** Cursor for a scrubber position in [0, 1] (clamped). */
export function cursorFromFraction(fraction: number, length: number, minIndex: number): number {
  if (length <= 0) return 0;
  const lo = Math.min(Math.max(0, minIndex), length - 1);
  const span = length - 1 - lo;
  const f = Math.min(1, Math.max(0, fraction));
  return clampCursor(lo + Math.round(f * span), length, minIndex);
}

/** First bar at/after `targetTime` (binary search), clamped to [minIndex, end]. */
export function seekCursorToTime(candles: ReplayCandle[], targetTime: number, minIndex: number): number {
  if (candles.length === 0) return 0;
  let lo = 0;
  let hi = candles.length - 1;
  let found = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (candles[mid].time >= targetTime) {
      found = mid;
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  return clampCursor(found, candles.length, minIndex);
}
