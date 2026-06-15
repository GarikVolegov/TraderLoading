import type { CandlestickData, Time } from "lightweight-charts";
import {
  applyFormingCandleForAnchor,
  DEFAULT_REPLAY_VISIBLE_CANDLES,
  getReplayIntervalSeconds,
  resolveReplayWindowForCloseAnchor,
} from "./chartReplayWindow";

// Default higher-timeframe context shown alongside each main timeframe. The
// warehouse guarantees the context series is consistent with the main one (an
// HTF bar is the exact aggregate of its LTF bars), so the two charts stay locked
// to the same replay moment.
const HTF_CONTEXT: Record<string, string> = {
  M1: "M15",
  M5: "H1",
  M15: "H4",
  M30: "H4",
  H1: "D1",
  H4: "W1",
  D1: "W1",
  W1: "W1",
};

export function getContextTimeframe(mainInterval: string): string {
  return HTF_CONTEXT[mainInterval.toUpperCase()] ?? mainInterval;
}

export interface MtfContextView<T> {
  /** Higher-timeframe candles up to the cursor; the last is the forming bar. */
  candles: T[];
  /** Index of the forming (in-progress) bar within `candles`, or -1 if none. */
  formingIndex: number;
}

/**
 * Synchronize a higher-timeframe context window to the main replay cursor.
 *
 * Given the main chart's cursor (the close-time of its current bar) and the full
 * HTF series, returns the HTF candles up to that moment, with the bar that
 * contains the cursor shown forming at the cursor price. Reuses the same anchor
 * logic the single-chart timeframe switch uses, so the two charts agree exactly.
 */
export function computeMtfContext<T extends CandlestickData<Time>>(
  htfSeries: T[],
  htfInterval: string,
  cursorCloseTime: number,
  cursorPrice: number,
  visibleCount: number = DEFAULT_REPLAY_VISIBLE_CANDLES,
): MtfContextView<T> {
  if (htfSeries.length === 0 || !Number.isFinite(cursorCloseTime)) {
    return { candles: [], formingIndex: -1 };
  }

  const withForming = applyFormingCandleForAnchor(htfSeries, cursorCloseTime, htfInterval, cursorPrice);
  const { startIndex, revealedCount } = resolveReplayWindowForCloseAnchor(
    withForming,
    cursorCloseTime,
    htfInterval,
    visibleCount,
  );
  const candles = withForming.slice(startIndex, startIndex + revealedCount);

  const intervalSeconds = getReplayIntervalSeconds(htfInterval);
  let formingIndex = -1;
  for (let i = candles.length - 1; i >= 0; i--) {
    const openTime = candles[i].time as number;
    if (openTime < cursorCloseTime && openTime + intervalSeconds >= cursorCloseTime) {
      formingIndex = i;
      break;
    }
  }

  return { candles, formingIndex };
}
