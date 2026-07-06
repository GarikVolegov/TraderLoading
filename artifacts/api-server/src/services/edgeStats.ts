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

export interface EquityPoint {
  /** 1-based trade index. */
  atTrade: number;
  /** Cumulative net P&L after this trade (account currency). */
  equity: number;
}

/** Canonical equity curve = running cumulative P&L over chronologically-ordered
 *  trade profits (idea 5D — reusable server-side series for charts). */
export function equityCurve(profits: readonly number[]): EquityPoint[] {
  const out: EquityPoint[] = [];
  let cumulative = 0;
  for (let i = 0; i < profits.length; i += 1) {
    cumulative += profits[i];
    out.push({ atTrade: i + 1, equity: round(cumulative, 2) });
  }
  return out;
}

export interface RBucket {
  from: number;
  to: number;
  count: number;
}

/** R-multiple distribution histogram with contiguous buckets across the observed
 *  range (empty in-range buckets kept so the chart draws continuous bars). */
export function rHistogram(rValues: readonly number[], bucketSize = 0.5): RBucket[] {
  if (rValues.length === 0 || !(bucketSize > 0)) return [];
  const indices = rValues.map((r) => Math.floor(r / bucketSize));
  const kMin = Math.min(...indices);
  const kMax = Math.max(...indices);
  const buckets: RBucket[] = [];
  for (let k = kMin; k <= kMax; k += 1) {
    buckets.push({
      from: round(k * bucketSize),
      to: round((k + 1) * bucketSize),
      count: indices.filter((x) => x === k).length,
    });
  }
  return buckets;
}

export interface RiskOfRuinResult {
  /** Fraction of simulated paths that hit the ruin threshold (0..1). */
  riskOfRuin: number;
  medianFinalEquity: number;
  p5: number;
  p95: number;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/**
 * Monte Carlo risk-of-ruin bootstrapped from the trader's OWN R-multiples (idea 5B):
 * resample real outcomes with replacement instead of hand-set parameters. Each
 * simulated trade multiplies equity by (1 + r·riskFraction); a path "ruins" if equity
 * falls to/through ruinThreshold. `rng` is injectable for deterministic tests.
 * Returns null with no trades.
 */
export function bootstrapRiskOfRuin(
  rValues: readonly number[],
  opts: {
    trades: number;
    riskFraction: number;
    ruinThreshold: number;
    sims: number;
    rng?: () => number;
  },
): RiskOfRuinResult | null {
  if (rValues.length === 0 || opts.trades <= 0 || opts.sims <= 0) return null;
  const rng = opts.rng ?? Math.random;
  const finals: number[] = [];
  let ruined = 0;
  for (let s = 0; s < opts.sims; s += 1) {
    let equity = 1;
    let isRuined = false;
    for (let t = 0; t < opts.trades; t += 1) {
      const r = rValues[Math.min(rValues.length - 1, Math.floor(rng() * rValues.length))];
      equity *= 1 + r * opts.riskFraction;
      if (equity <= opts.ruinThreshold) {
        isRuined = true;
        equity = Math.max(0, equity);
        break;
      }
    }
    if (isRuined) ruined += 1;
    finals.push(equity);
  }
  finals.sort((a, b) => a - b);
  return {
    riskOfRuin: round(ruined / opts.sims),
    medianFinalEquity: round(percentile(finals, 0.5), 6),
    p5: round(percentile(finals, 0.05), 6),
    p95: round(percentile(finals, 0.95), 6),
  };
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
