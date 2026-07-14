// ─── Technical indicator engine ──────────────────────────────────────────────
// Pure, tested implementations of the standard indicators the backtest replay
// was missing. Each returns an array aligned to the input length, with `null`
// during the warm-up period, so the chart layer can zip them against candle
// times and skip the nulls. Formulas use the conventional (Wilder where
// applicable) definitions.

export type OhlcInput = { high: number; low: number; close: number };

/** Simple moving average. */
export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Linearly-weighted moving average (most recent value weighs `period`). */
export function wma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0) return out;
  const denominator = (period * (period + 1)) / 2;
  for (let i = period - 1; i < values.length; i++) {
    let weighted = 0;
    for (let j = 0; j < period; j++) weighted += values[i - j] * (period - j);
    out[i] = weighted / denominator;
  }
  return out;
}

/** Exponential moving average, seeded with the SMA of the first `period` values. */
export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder's RSI. First value at index `period`. */
export function rsi(values: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gain += delta;
    else loss -= delta;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + (delta > 0 ? delta : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (delta < 0 ? -delta : 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export type BollingerBand = { middle: number; upper: number; lower: number };

/** Bollinger Bands: SMA middle ± `mult` standard deviations (population). */
export function bollinger(values: number[], period = 20, mult = 2): (BollingerBand | null)[] {
  const middle = sma(values, period);
  const out: (BollingerBand | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const mid = middle[i];
    if (mid == null) continue;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (values[j] - mid) ** 2;
    const sd = Math.sqrt(variance / period);
    out[i] = { middle: mid, upper: mid + mult * sd, lower: mid - mult * sd };
  }
  return out;
}

/** Wilder's Average True Range. First value at index `period`. */
export function atr(candles: OhlcInput[], period = 14): (number | null)[] {
  const n = candles.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < period + 1) return out;

  const tr = new Array(n).fill(0);
  tr[0] = candles[0].high - candles[0].low;
  for (let i = 1; i < n; i++) {
    const prevClose = candles[i - 1].close;
    tr[i] = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prevClose),
      Math.abs(candles[i].low - prevClose),
    );
  }

  let prev = 0;
  for (let i = 1; i <= period; i++) prev += tr[i];
  prev /= period;
  out[period] = prev;
  for (let i = period + 1; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export type MacdPoint = { macd: number | null; signal: number | null; histogram: number | null };

/** MACD line (EMA fast − EMA slow), its signal EMA, and the histogram. */
export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdPoint[] {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);

  const macdLine: (number | null)[] = values.map((_, i) => {
    const f = emaFast[i];
    const s = emaSlow[i];
    return f != null && s != null ? f - s : null;
  });

  // Signal EMA over the contiguous non-null tail of the MACD line.
  const indices: number[] = [];
  const compact: number[] = [];
  for (let i = 0; i < macdLine.length; i++) {
    const v = macdLine[i];
    if (v != null) {
      indices.push(i);
      compact.push(v);
    }
  }
  const signalCompact = ema(compact, signalPeriod);
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  for (let j = 0; j < indices.length; j++) {
    if (signalCompact[j] != null) signalLine[indices[j]] = signalCompact[j];
  }

  return values.map((_, i) => {
    const m = macdLine[i];
    const sig = signalLine[i];
    return { macd: m, signal: sig, histogram: m != null && sig != null ? m - sig : null };
  });
}

export type StochasticPoint = { k: number | null; d: number | null };

/** Stochastic oscillator: %K and its %D moving average. */
export function stochastic(candles: OhlcInput[], kPeriod = 14, dPeriod = 3): StochasticPoint[] {
  const n = candles.length;
  const kArr: (number | null)[] = new Array(n).fill(null);
  for (let i = kPeriod - 1; i < n; i++) {
    let highest = -Infinity;
    let lowest = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      highest = Math.max(highest, candles[j].high);
      lowest = Math.min(lowest, candles[j].low);
    }
    kArr[i] = highest === lowest ? 50 : (100 * (candles[i].close - lowest)) / (highest - lowest);
  }

  const dArr: (number | null)[] = new Array(n).fill(null);
  for (let i = kPeriod - 1 + dPeriod - 1; i < n; i++) {
    let sum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) sum += kArr[j] as number;
    dArr[i] = sum / dPeriod;
  }

  return candles.map((_, i) => ({ k: kArr[i], d: dArr[i] }));
}
