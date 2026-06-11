import type { CandlestickData, LineData, Time } from "lightweight-charts";
import type { VolumeProfileSettings } from "./chartAnalysisTypes";
import { getEuropeRomeDayRangeForTime, isTimeInsideRange, type TimeRange } from "./chartSessionTime";

export type AnalysisCandle = CandlestickData<Time> & { volume?: number };

export interface VolumeProfileBucket {
  priceLow: number;
  priceHigh: number;
  volume: number;
  inValueArea: boolean;
}

export interface VolumeProfileResult {
  buckets: VolumeProfileBucket[];
  poc: VolumeProfileBucket;
  valueAreaHigh: number;
  valueAreaLow: number;
  totalVolume: number;
  estimatedVolume: boolean;
}

function typicalPrice(candle: Pick<CandlestickData<Time>, "high" | "low" | "close">): number {
  return (candle.high + candle.low + candle.close) / 3;
}

function candleVolume(candle: { volume?: number }): number {
  return typeof candle.volume === "number" && Number.isFinite(candle.volume) && candle.volume > 0 ? candle.volume : 1;
}

export function hasEstimatedVolume(candles: Array<{ volume?: number }>): boolean {
  return candles.some((candle) => !(typeof candle.volume === "number" && Number.isFinite(candle.volume) && candle.volume > 0));
}

export function calculateDailyVwap(candles: AnalysisCandle[]): LineData<Time>[] {
  const result: LineData<Time>[] = [];
  let activeRange: TimeRange | null = null;
  let priceVolume = 0;
  let volume = 0;

  for (const candle of candles) {
    const ts = candle.time as number;
    if (!activeRange || !isTimeInsideRange(ts, activeRange)) {
      activeRange = getEuropeRomeDayRangeForTime(ts);
      priceVolume = 0;
      volume = 0;
    }
    const weight = candleVolume(candle);
    priceVolume += typicalPrice(candle) * weight;
    volume += weight;
    result.push({ time: candle.time, value: priceVolume / volume });
  }

  return result;
}

export function calculateVolumeProfile(
  candles: AnalysisCandle[],
  range: TimeRange,
  settings: Pick<VolumeProfileSettings, "rows" | "valueAreaPercent">,
): VolumeProfileResult {
  const selected = candles.filter((candle) => isTimeInsideRange(candle.time as number, range));
  const rows = Math.max(4, Math.min(100, Math.floor(settings.rows)));
  const fallbackBucket: VolumeProfileBucket = { priceLow: 0, priceHigh: 0, volume: 0, inValueArea: false };

  if (selected.length === 0) {
    return {
      buckets: [fallbackBucket],
      poc: fallbackBucket,
      valueAreaHigh: 0,
      valueAreaLow: 0,
      totalVolume: 0,
      estimatedVolume: false,
    };
  }

  const low = Math.min(...selected.map((candle) => candle.low));
  const high = Math.max(...selected.map((candle) => candle.high));
  const span = Math.max(high - low, Number.EPSILON);
  const step = span / rows;
  const buckets: VolumeProfileBucket[] = Array.from({ length: rows }, (_, index) => ({
    priceLow: low + index * step,
    priceHigh: index === rows - 1 ? high : low + (index + 1) * step,
    volume: 0,
    inValueArea: false,
  }));

  for (const candle of selected) {
    const price = typicalPrice(candle);
    const index = Math.max(0, Math.min(rows - 1, Math.floor((price - low) / step)));
    buckets[index].volume += candleVolume(candle);
  }

  const totalVolume = buckets.reduce((sum, bucket) => sum + bucket.volume, 0);
  const poc = buckets.reduce((best, bucket) => (bucket.volume > best.volume ? bucket : best), buckets[0]);
  const targetVolume = totalVolume * Math.max(1, Math.min(100, settings.valueAreaPercent)) / 100;
  let collected = 0;
  const valueBuckets = [...buckets].sort((a, b) => b.volume - a.volume);
  for (const bucket of valueBuckets) {
    if (collected >= targetVolume) break;
    bucket.inValueArea = true;
    collected += bucket.volume;
  }
  const selectedValueBuckets = buckets.filter((bucket) => bucket.inValueArea);

  return {
    buckets,
    poc,
    valueAreaHigh: Math.max(...selectedValueBuckets.map((bucket) => bucket.priceHigh), poc.priceHigh),
    valueAreaLow: Math.min(...selectedValueBuckets.map((bucket) => bucket.priceLow), poc.priceLow),
    totalVolume,
    estimatedVolume: hasEstimatedVolume(selected),
  };
}
