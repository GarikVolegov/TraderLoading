// Portfolio correlation & concentration risk (audit idea 5B). Pure math over D1
// close series: daily returns → Pearson correlation matrix → direction-aware
// concentration signals ("long EURUSD + long GBPUSD = double short USD"). No I/O;
// the caller supplies the closes (warehouse/candle chain) and open positions.

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** Simple period-over-period returns. A non-positive prior close yields 0 (rather
 *  than Infinity/NaN) so a bad tick can't poison the correlation. */
export function dailyReturns(closes: readonly number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    out.push(prev > 0 ? (closes[i] - prev) / prev : 0);
  }
  return out;
}

/** Pearson correlation coefficient. null on length mismatch, fewer than two
 *  points, or zero variance in either series. */
export function pearson(a: readonly number[], b: readonly number[]): number | null {
  const n = a.length;
  if (n < 2 || b.length !== n) return null;
  let meanA = 0;
  let meanB = 0;
  for (let i = 0; i < n; i += 1) {
    meanA += a[i];
    meanB += b[i];
  }
  meanA /= n;
  meanB /= n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i += 1) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (!(varA > 0) || !(varB > 0)) return null;
  return round(cov / Math.sqrt(varA * varB));
}

export interface SymbolSeries {
  symbol: string;
  /** Chronological D1 closes (oldest → newest). */
  closes: number[];
}

export interface CorrelationMatrix {
  symbols: string[];
  /** matrix[i][j] = correlation of symbols[i] vs symbols[j]; null when undefined. */
  matrix: (number | null)[][];
  /** Number of overlapping returns used (the shortest series wins). */
  window: number;
}

/**
 * Pairwise Pearson matrix over aligned daily returns. All series are trimmed to
 * their most-recent `window` returns (window = the shortest series' return count)
 * so every correlation is measured over the same horizon.
 */
export function correlationMatrix(series: SymbolSeries[]): CorrelationMatrix {
  const symbols = series.map((s) => s.symbol);
  const returns = series.map((s) => dailyReturns(s.closes));
  const window = returns.length === 0 ? 0 : Math.min(...returns.map((r) => r.length));
  const aligned = returns.map((r) => r.slice(r.length - window));

  const matrix: (number | null)[][] = symbols.map((_, i) =>
    symbols.map((__, j) => {
      if (i === j) return window >= 1 ? 1 : null;
      return pearson(aligned[i], aligned[j]);
    }),
  );
  return { symbols, matrix, window };
}

export interface TimedBar {
  time: number;
  close: number;
}

export interface TimedSeries {
  symbol: string;
  bars: TimedBar[];
}

/**
 * Align closes across symbols by the timestamps present in EVERY series, so that
 * daily returns are measured over the same calendar days (FX and crypto don't
 * share a calendar). Returns closes ordered by ascending shared timestamp; empty
 * when there is no common timestamp.
 */
export function alignSeriesByTime(series: TimedSeries[]): SymbolSeries[] {
  if (series.length === 0) return [];
  const maps = series.map((s) => new Map(s.bars.map((b) => [b.time, b.close])));
  let shared: number[] | null = null;
  for (const map of maps) {
    const times = [...map.keys()];
    shared = shared === null ? times : shared.filter((t) => map.has(t));
  }
  const orderedTimes = (shared ?? []).sort((a, b) => a - b);
  return series.map((s, i) => ({
    symbol: s.symbol,
    closes: orderedTimes.map((t) => maps[i].get(t) as number),
  }));
}

export interface Position {
  symbol: string;
  direction: "long" | "short";
}

export interface ConcentrationPair {
  a: string;
  b: string;
  correlation: number;
  /** "compounding" = the two positions stack into a bigger single bet;
   *  "hedging" = they partly offset. */
  effect: "compounding" | "hedging";
}

function directionSign(direction: "long" | "short"): number {
  return direction === "long" ? 1 : -1;
}

/**
 * Direction-aware concentration risk: for every pair of open positions whose
 * correlation magnitude clears `threshold`, decide whether they compound (add to
 * the same directional bet) or hedge. A high positive correlation between two
 * longs compounds; long + short on an anti-correlated pair also compounds.
 */
export function concentrationSignals(
  positions: Position[],
  matrix: CorrelationMatrix,
  threshold = 0.6,
): ConcentrationPair[] {
  const index = new Map(matrix.symbols.map((s, i) => [s, i]));
  const out: ConcentrationPair[] = [];
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      const pa = positions[i];
      const pb = positions[j];
      const ia = index.get(pa.symbol);
      const ib = index.get(pb.symbol);
      if (ia === undefined || ib === undefined) continue;
      const corr = matrix.matrix[ia][ib];
      if (corr === null || Math.abs(corr) < threshold) continue;
      const effectiveSign = Math.sign(corr) * directionSign(pa.direction) * directionSign(pb.direction);
      out.push({
        a: pa.symbol,
        b: pb.symbol,
        correlation: corr,
        effect: effectiveSign > 0 ? "compounding" : "hedging",
      });
    }
  }
  return out;
}
