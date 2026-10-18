import { calculateVolatilityMetrics, candlesToVolatilityInput, trimToRecentDays, type DailyCandle, type VolatilityMetricResponse } from "./volatility.js";

export type VolatilitySnapshot = VolatilityMetricResponse & {
  source: string;
  /** Provider retrieval time, retained when the candle response is cached. */
  fetchedAt: string;
  /** Opening time of the last daily bar, NOT the time of its last price update. */
  observedAt: string;
  observationStart: string;
  timeframe: "D1";
};

export function buildVolatilitySnapshot(pair: string, candles: DailyCandle[], source: string, now = new Date()): VolatilitySnapshot {
  const valid = candles.filter((c) => Number.isFinite(c.time) && c.time * 1000 <= now.getTime() &&
    Number.isFinite(c.high) && Number.isFinite(c.low) && Number.isFinite(c.close) && c.high >= c.low && c.low > 0 && c.close > 0)
    .sort((a, b) => a.time - b.time);
  const series = trimToRecentDays(valid, 366);
  const metrics = calculateVolatilityMetrics(pair, candlesToVolatilityInput(series));
  return {
    ...metrics, source, fetchedAt: now.toISOString(), timeframe: "D1",
    observedAt: new Date(series[series.length - 1].time * 1000).toISOString(),
    observationStart: new Date(series[0].time * 1000).toISOString(),
  };
}

export function volatilityResponse(snapshot: VolatilitySnapshot, cacheExpired: boolean, now = new Date()) {
  // An old daily bar must never be presented as today's range, even after a fresh retrieval.
  const oldObservation = snapshot.observedAt.slice(0, 10) !== now.toISOString().slice(0, 10);
  const age = now.getTime() - Date.parse(snapshot.fetchedAt);
  const stale = cacheExpired || oldObservation || !Number.isFinite(age) || age < 0 || age > 30 * 60_000;
  return { ...snapshot, status: stale ? "stale" as const : "available" as const, cached: stale };
}
