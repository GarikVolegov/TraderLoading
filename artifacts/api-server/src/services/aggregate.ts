// ─── Candle aggregation ──────────────────────────────────────────────────────
// Pure, deterministic roll-up of a base series (M1) into a higher timeframe.
// This is the reference implementation that the SQL-side aggregation in the
// serving layer is validated against, and the helper used to roll up the live
// M1 tail when merging recent bars. See
// docs/superpowers/specs/2026-06-14-candle-warehouse-design.md.
import type { Candle } from "./candles.js";
import { INTERVAL_SECONDS } from "./candleRegistry.js";

const DAY_SECONDS = 86400;
const WEEK_SECONDS = 604800;

/**
 * Returns the UTC-aligned open-time of the bucket that `ts` falls into.
 *
 * - intraday + daily timeframes all divide a UTC day evenly, so a simple floor
 *   aligns them to UTC boundaries (D1 → 00:00 UTC);
 * - weekly buckets are aligned to Monday 00:00 UTC (the Unix epoch is a
 *   Thursday, so a naive floor would start weeks on Thursday).
 */
export function bucketStart(ts: number, intervalSeconds: number): number {
  if (intervalSeconds === WEEK_SECONDS) {
    const dayIndex = Math.floor(ts / DAY_SECONDS);
    const dayOfWeek = (dayIndex + 4) % 7; // 0 = Sunday … 6 = Saturday
    const daysFromMonday = (dayOfWeek + 6) % 7; // Monday → 0 … Sunday → 6
    return (dayIndex - daysFromMonday) * DAY_SECONDS;
  }
  return Math.floor(ts / intervalSeconds) * intervalSeconds;
}

/**
 * Aggregate an ascending, time-sorted base series into `intervalSeconds` candles.
 *
 * open = first bar's open, close = last bar's close, high/low = extremes,
 * volume = sum (left `undefined` when no source bar in the bucket carried volume),
 * time = bucket open-time. Input is assumed sorted ascending by `time`, which is
 * what both the DB query and the source adapters guarantee.
 */
export function aggregate(base: Candle[], intervalSeconds: number): Candle[] {
  if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
    throw new Error(`aggregate: intervalSeconds must be a positive number, got ${intervalSeconds}`);
  }

  const out: Candle[] = [];
  let current: Candle | null = null;
  let currentBucket = Number.NaN;
  let volumeSum = 0;
  let hasVolume = false;

  const flush = () => {
    if (!current) return;
    out.push(hasVolume ? { ...current, volume: volumeSum } : { ...current, volume: undefined });
  };

  for (const candle of base) {
    const bucket = bucketStart(candle.time, intervalSeconds);
    if (current === null || bucket !== currentBucket) {
      flush();
      currentBucket = bucket;
      current = {
        time: bucket,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      };
      volumeSum = 0;
      hasVolume = false;
    } else {
      current.high = Math.max(current.high, candle.high);
      current.low = Math.min(current.low, candle.low);
      current.close = candle.close;
    }
    if (typeof candle.volume === "number" && Number.isFinite(candle.volume)) {
      volumeSum += candle.volume;
      hasVolume = true;
    }
  }
  flush();

  return out;
}

/** Convenience wrapper that resolves a timeframe name (e.g. "H1") to seconds. */
export function aggregateInterval(base: Candle[], interval: string): Candle[] {
  const seconds = INTERVAL_SECONDS[interval];
  if (!seconds) throw new Error(`aggregateInterval: unknown interval ${interval}`);
  return aggregate(base, seconds);
}

/**
 * Splice a fresh live tail onto the warehouse series. Live bars at or after the
 * warehouse's last bar win (they carry the forming/most-recent candle), older
 * live bars are ignored. Both inputs must be ascending by `time`; the result is
 * ascending and de-duplicated by bucket time.
 */
export function mergeTail(warehouse: Candle[], live: Candle[]): Candle[] {
  if (warehouse.length === 0) return [...live];
  if (live.length === 0) return [...warehouse];

  const cutoff = warehouse[warehouse.length - 1].time;
  const byTime = new Map<number, Candle>();
  for (const candle of warehouse) byTime.set(candle.time, candle);
  for (const candle of live) {
    if (candle.time >= cutoff) byTime.set(candle.time, candle);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}
