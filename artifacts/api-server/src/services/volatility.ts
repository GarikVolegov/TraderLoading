export const YAHOO_VOLATILITY_PAIRS: Record<string, string> = {
  EURUSD: "EURUSD=X",
  GBPUSD: "GBPUSD=X",
  USDJPY: "JPY=X",
  USDCHF: "CHF=X",
  AUDUSD: "AUDUSD=X",
  USDCAD: "CAD=X",
  NZDUSD: "NZDUSD=X",
  EURGBP: "EURGBP=X",
  EURJPY: "EURJPY=X",
  GBPJPY: "GBPJPY=X",
  XAUUSD: "GC=F",
  XAGUSD: "SI=F",
  USDMXN: "MXN=X",
  USDZAR: "ZAR=X",
};

type YahooMeta = {
  regularMarketPrice?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
};

export type VolatilityInput = {
  timestamps: number[];
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
  meta?: YahooMeta;
};

/** Minimal daily-candle shape consumed by the adapters below (structurally
 * satisfied by the candle service's `Candle`). */
export type DailyCandle = { time: number; high: number; low: number; close: number };

const DAY_SECONDS = 86_400;

/**
 * Keep only candles within the last `days` of the most recent bar. Used to hold
 * the 1-year `y1` semantics when the underlying source returns more history.
 * Reference is the last bar's time (deterministic), not wall-clock.
 */
export function trimToRecentDays(candles: DailyCandle[], days: number): DailyCandle[] {
  if (candles.length === 0) return candles;
  const cutoff = candles[candles.length - 1].time - days * DAY_SECONDS;
  return candles.filter((candle) => candle.time >= cutoff);
}

/** Adapt a daily OHLC candle series into the shape `calculateVolatilityMetrics`
 * expects. No `meta` — `todayPips`/`currentPrice` fall back to the last bar. */
export function candlesToVolatilityInput(candles: DailyCandle[]): VolatilityInput {
  return {
    timestamps: candles.map((candle) => candle.time),
    high: candles.map((candle) => candle.high),
    low: candles.map((candle) => candle.low),
    close: candles.map((candle) => candle.close),
  };
}

export type VolatilityMetricResponse = {
  pair: string;
  currentPrice: number;
  todayPips: number;
  w1: number;
  m1: number;
  m3: number;
  m6: number;
  y1: number;
  w1Pct: number | null;
  m1Pct: number | null;
  m3Pct: number | null;
  m6Pct: number | null;
  y1Pct: number | null;
  label: string;
  peakDay: string;
  pipUnit: string;
  last30: Array<{ day: number; date: string; weekday: string; pips: number }>;
  daily5: number;
  daily21: number;
  daily63: number;
  dailyAll: number;
  dataPoints: Array<{ day: number; value: number }>;
};

const JPY_PIP_MULTIPLIER = 100;
const XAU_POINT_MULTIPLIER = 10;
const XAG_POINT_MULTIPLIER = 100;
const DEFAULT_PIP_MULTIPLIER = 10000;

export function getVolatilityUnit(pair: string): { multiplier: number; pipUnit: string } {
  const normalized = pair.toUpperCase();
  if (normalized === "XAUUSD") {
    return { multiplier: XAU_POINT_MULTIPLIER, pipUnit: "punti" };
  }
  if (normalized === "XAGUSD") {
    return { multiplier: XAG_POINT_MULTIPLIER, pipUnit: "punti" };
  }
  if (normalized.endsWith("JPY")) {
    return { multiplier: JPY_PIP_MULTIPLIER, pipUnit: "pip (JPY)" };
  }
  return { multiplier: DEFAULT_PIP_MULTIPLIER, pipUnit: "pip" };
}

function avg(values: number[]): number {
  return values.length
    ? parseFloat((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
    : 0;
}

function round1(value: number): number {
  return parseFloat(value.toFixed(1));
}

function isUsablePrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function calculateVolatilityMetrics(pair: string, input: VolatilityInput): VolatilityMetricResponse {
  const { multiplier, pipUnit } = getVolatilityUnit(pair);
  const ranges: { ts: number; pips: number; close: number }[] = [];

  for (let i = 0; i < input.timestamps.length; i++) {
    const high = input.high?.[i];
    const low = input.low?.[i];
    const close = input.close?.[i];
    if (isUsablePrice(high) && isUsablePrice(low) && isUsablePrice(close) && high >= low) {
      ranges.push({ ts: input.timestamps[i], pips: round1((high - low) * multiplier), close });
    }
  }

  if (ranges.length < 5) throw new Error("Storico insufficiente");

  const currentPrice = input.meta?.regularMarketPrice ?? ranges[ranges.length - 1].close;
  const todayHigh = input.meta?.regularMarketDayHigh;
  const todayLow = input.meta?.regularMarketDayLow;
  const todayPips = isUsablePrice(todayHigh) && isUsablePrice(todayLow) && todayHigh >= todayLow
    ? round1((todayHigh - todayLow) * multiplier)
    : ranges[ranges.length - 1].pips;

  const pipValues = ranges.map((range) => range.pips);
  const w1 = avg(pipValues.slice(-5));
  const m1 = avg(pipValues.slice(-22));
  const m3 = avg(pipValues.slice(-66));
  const m6 = avg(pipValues.slice(-132));
  const y1 = avg(pipValues);

  const ratio = w1 / (y1 || 1);
  const label = ratio > 1.3 ? "Alta volatilita" : ratio < 0.7 ? "Bassa volatilita" : "Nella norma";

  const closePrices = ranges.map((range) => range.close);
  const latestClose = closePrices[closePrices.length - 1];
  const pricePct = (period: number): number | null => {
    if (closePrices.length <= period) return null;
    const past = closePrices[closePrices.length - 1 - period];
    return past > 0 ? parseFloat(((latestClose / past - 1) * 100).toFixed(2)) : null;
  };

  const dayNames = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
  const last30 = ranges.slice(-30).map((range, index) => {
    const date = new Date(range.ts * 1000);
    return {
      day: index + 1,
      date: date.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
      weekday: dayNames[date.getDay()],
      pips: range.pips,
    };
  });

  const byDay: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  ranges.forEach((range) => {
    const day = new Date(range.ts * 1000).getDay();
    if (byDay[day]) byDay[day].push(range.pips);
  });
  const peakDay = Object.entries(byDay)
    .map(([day, values]) => ({ day: dayNames[+day], avg: avg(values) }))
    .sort((left, right) => right.avg - left.avg)[0]?.day ?? "Mer";

  return {
    pair,
    currentPrice,
    todayPips,
    w1,
    m1,
    m3,
    m6,
    y1,
    w1Pct: pricePct(5),
    m1Pct: pricePct(22),
    m3Pct: pricePct(66),
    m6Pct: pricePct(132),
    y1Pct: pricePct(closePrices.length - 1),
    label,
    peakDay,
    pipUnit,
    last30,
    daily5: w1,
    daily21: m1,
    daily63: m3,
    dailyAll: y1,
    dataPoints: last30.map((range) => ({ day: range.day, value: range.pips })),
  };
}
