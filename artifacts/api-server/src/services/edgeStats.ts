// Quant edge statistics (audit Phase 5B — "the edge measured"). Pure math over the
// same closed-trade R-multiples the coach already computes, so a trader learns not
// just their expectancy but whether it's statistically real, how to size it, and
// whether it's decaying. Deterministic and unit-tested.

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export interface ConfidenceInterval {
  /** Observed win rate (0..1). */
  point: number;
  lower: number;
  upper: number;
}

/**
 * Wilson score interval for the win rate — "is my edge statistically real?". Better
 * than the naive normal interval for small samples and near 0/1. z defaults to 1.96
 * (95%). Returns null with no trades.
 */
export function wilsonInterval(wins: number, total: number, z = 1.96): ConfidenceInterval | null {
  if (total <= 0) return null;
  const p = wins / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / denom;
  return {
    point: round(p),
    lower: round(Math.max(0, center - margin)),
    upper: round(Math.min(1, center + margin)),
  };
}

export interface KellyResult {
  /** Full Kelly fraction of capital to risk (0 when there's no positive edge). */
  full: number;
  /** Half Kelly — the pragmatic default (lower variance). */
  half: number;
}

/**
 * Kelly-optimal risk fraction from the trader's own edge: f* = W − (1−W)/R, where
 * W is the win rate and R = avgWin / |avgLoss| (payoff ratio in R). Clamped at 0 so
 * a losing edge never suggests betting. Returns null on degenerate inputs.
 */
export function kellyFraction(
  winRate: number | null,
  avgWinR: number | null,
  avgLossR: number | null,
): KellyResult | null {
  if (winRate === null || avgWinR === null || avgLossR === null) return null;
  const lossMagnitude = Math.abs(avgLossR);
  if (!(lossMagnitude > 0) || !(avgWinR > 0)) return null;
  const payoff = avgWinR / lossMagnitude;
  const full = Math.max(0, round(winRate - (1 - winRate) / payoff));
  return { full, half: round(full / 2) };
}

export interface RollingPoint {
  /** 1-based index of the last trade in this window. */
  atTrade: number;
  /** Mean R over the window ending at this trade. */
  mean: number;
}

/**
 * Rolling expectancy over the last `window` trades — edge decay: surfaces when a
 * setup stops working instead of hiding it in the lifetime average. Returns one
 * point per full window; empty when there are fewer trades than the window.
 */
export function rollingExpectancy(rValues: readonly number[], window: number): RollingPoint[] {
  if (window <= 0 || rValues.length < window) return [];
  const out: RollingPoint[] = [];
  for (let i = window - 1; i < rValues.length; i += 1) {
    let sum = 0;
    for (let j = i - window + 1; j <= i; j += 1) sum += rValues[j];
    out.push({ atTrade: i + 1, mean: sum / window });
  }
  return out;
}
