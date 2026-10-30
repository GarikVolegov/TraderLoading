import type { ReplayCandle as Candle } from "@/lib/replay/types";
import type { IndicatorConfig } from "@/lib/replay/indicatorCatalog";

export function intervalToSeconds(interval: string): number {
  const normalized = interval.trim().toLowerCase();
  if (normalized === "1m") return 60;
  if (normalized === "5m") return 300;
  if (normalized === "15m") return 900;
  if (normalized === "30m") return 1800;
  if (normalized === "1h" || normalized === "60m") return 3600;
  if (normalized === "4h" || normalized === "240m") return 14400;
  if (normalized === "1d" || normalized === "d" || normalized === "d1") return 86400;
  if (normalized === "1wk" || normalized === "1w" || normalized === "w1") return 604800;
  return 900;
}

export type ChartLayoutMode = "1x1" | "1x2" | "2x1" | "2x2";

export interface PersistedChartMemory {
  version: number;
  showSessions: boolean;
  showLiquidityLevels: boolean;
  showWyckoff: boolean;
  showEma: boolean;
  showAutoFvg: boolean;
  showVolume: boolean;
  showRedNews: boolean;
  indicators: IndicatorConfig[];
  layout: ChartLayoutMode;
  riskValue: number;
  slPips: number;
  tpPips: number;
  replayCapitalSize: number;
  updatedAt: number;
}

const CHART_MEMORY_KEY = "limen:varco:chart-memory:v2";
const CANDLE_CACHE_PREFIX = "limen:varco:candle-cache:v1:";
const MAX_CACHED_CANDLES = 450;

export const DEFAULT_CHART_MEMORY: PersistedChartMemory = {
  version: 2,
  showSessions: false,
  showLiquidityLevels: false,
  showWyckoff: false,
  showEma: false,
  showAutoFvg: false,
  showVolume: false,
  showRedNews: true,
  indicators: [],
  layout: "1x1",
  riskValue: 1.0,
  slPips: 15,
  tpPips: 30,
  replayCapitalSize: 100000,
  updatedAt: 0,
};

export function loadChartMemory(): PersistedChartMemory {
  if (typeof window === "undefined") return DEFAULT_CHART_MEMORY;
  try {
    const raw = window.localStorage.getItem(CHART_MEMORY_KEY);
    if (!raw) return DEFAULT_CHART_MEMORY;
    const parsed = JSON.parse(raw) as Partial<PersistedChartMemory>;
    return {
      ...DEFAULT_CHART_MEMORY,
      showSessions:
        typeof parsed.showSessions === "boolean"
          ? parsed.showSessions
          : DEFAULT_CHART_MEMORY.showSessions,
      showLiquidityLevels:
        typeof parsed.showLiquidityLevels === "boolean"
          ? parsed.showLiquidityLevels
          : DEFAULT_CHART_MEMORY.showLiquidityLevels,
      showWyckoff:
        typeof parsed.showWyckoff === "boolean"
          ? parsed.showWyckoff
          : DEFAULT_CHART_MEMORY.showWyckoff,
      showEma:
        typeof parsed.showEma === "boolean"
          ? parsed.showEma
          : DEFAULT_CHART_MEMORY.showEma,
      showAutoFvg:
        typeof parsed.showAutoFvg === "boolean"
          ? parsed.showAutoFvg
          : DEFAULT_CHART_MEMORY.showAutoFvg,
      showVolume:
        typeof parsed.showVolume === "boolean"
          ? parsed.showVolume
          : DEFAULT_CHART_MEMORY.showVolume,
      showRedNews:
        typeof parsed.showRedNews === "boolean"
          ? parsed.showRedNews
          : DEFAULT_CHART_MEMORY.showRedNews,
      indicators: Array.isArray(parsed.indicators)
        ? parsed.indicators
        : DEFAULT_CHART_MEMORY.indicators,
      layout:
        parsed.layout === "1x1" ||
        parsed.layout === "1x2" ||
        parsed.layout === "2x1" ||
        parsed.layout === "2x2"
          ? parsed.layout
          : DEFAULT_CHART_MEMORY.layout,
      riskValue:
        typeof parsed.riskValue === "number" &&
        Number.isFinite(parsed.riskValue) &&
        parsed.riskValue > 0
          ? parsed.riskValue
          : DEFAULT_CHART_MEMORY.riskValue,
      slPips:
        typeof parsed.slPips === "number" &&
        Number.isFinite(parsed.slPips) &&
        parsed.slPips > 0
          ? parsed.slPips
          : DEFAULT_CHART_MEMORY.slPips,
      tpPips:
        typeof parsed.tpPips === "number" &&
        Number.isFinite(parsed.tpPips) &&
        parsed.tpPips > 0
          ? parsed.tpPips
          : DEFAULT_CHART_MEMORY.tpPips,
      replayCapitalSize:
        typeof parsed.replayCapitalSize === "number" &&
        Number.isFinite(parsed.replayCapitalSize) &&
        parsed.replayCapitalSize >= 1000
          ? parsed.replayCapitalSize
          : DEFAULT_CHART_MEMORY.replayCapitalSize,
      updatedAt:
        typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return DEFAULT_CHART_MEMORY;
  }
}

export function saveChartMemory(patch: Partial<PersistedChartMemory>): void {
  if (typeof window === "undefined") return;
  try {
    const current = loadChartMemory();
    const next: PersistedChartMemory = {
      ...current,
      ...patch,
      version: 2,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(CHART_MEMORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

function normalizeSymbolKey(symbol: string): string {
  const clean = symbol.includes(":") ? symbol.split(":").pop()! : symbol;
  return clean.toUpperCase().replace(/[^A-Z0-9._-]/g, "");
}

export function loadCachedCandles(
  symbol: string,
  interval: string,
): Candle[] | null {
  if (typeof window === "undefined") return null;
  try {
    const key = `${CANDLE_CACHE_PREFIX}${normalizeSymbolKey(symbol)}:${interval}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; candles: Candle[] };
    if (!parsed || !Array.isArray(parsed.candles) || parsed.candles.length < 5) {
      return null;
    }
    // Keep cache valid for up to 14 days for instant first-frame mount
    if (Date.now() - (parsed.ts || 0) > 14 * 86400 * 1000) {
      return null;
    }
    return parsed.candles;
  } catch {
    return null;
  }
}

export function saveCachedCandles(
  symbol: string,
  interval: string,
  candles: Candle[],
): void {
  if (typeof window === "undefined" || !candles || candles.length < 5) return;
  try {
    const key = `${CANDLE_CACHE_PREFIX}${normalizeSymbolKey(symbol)}:${interval}`;
    const trimmed = candles.slice(-MAX_CACHED_CANDLES);
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ts: Date.now(),
        candles: trimmed,
      }),
    );
  } catch {
    // Ignore quota errors
  }
}

/**
 * Generates future whitespace bars so lightweight-charts knows the exact timestamp
 * of every future logical index in the empty space to the right of the last candle,
 * and allows panning into the future to see macro news & countdown telemetry.
 */
export function buildFutureHorizonWhitespace(
  lastBarTimeSec: number,
  interval: string,
  minBars = 240,
): Array<{ time: number }> {
  if (!Number.isFinite(lastBarTimeSec) || lastBarTimeSec <= 0) return [];
  const stepSec = Math.max(60, intervalToSeconds(interval));
  // Ensure at least 72 hours of future horizon or minBars, whichever is reasonable (capped at 480 points for 120fps)
  const targetFor72h = Math.ceil((72 * 3600) / stepSec);
  const count = Math.min(480, Math.max(minBars, targetFor72h));
  const result: Array<{ time: number }> = [];
  for (let i = 1; i <= count; i++) {
    result.push({ time: lastBarTimeSec + i * stepSec });
  }
  return result;
}

export function getInstrumentPipSize(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s.includes("JPY")) return 0.01;
  if (
    s.includes("XAU") ||
    s.includes("NAS") ||
    s.includes("SPX") ||
    s.includes("US30") ||
    s.includes("GER40") ||
    s.includes("DAX") ||
    s.includes("BTC") ||
    s.includes("ETH") ||
    s.includes("SOL")
  ) {
    return 1;
  }
  if (s.includes("XAG") || s.includes("OIL") || s.includes("WTI")) return 0.01;
  return 0.0001;
}

/**
 * Computes real-time ATR(14) expressed in Pips/Points for immediate volatility telemetry.
 */
export function computeLiveAtrPips(
  candles: Candle[],
  symbol: string,
  period = 14,
): number | null {
  if (!candles || candles.length < 3) return null;
  const pipSize = getInstrumentPipSize(symbol);
  const lookback = Math.min(period, candles.length - 1);
  if (lookback < 1) return null;
  let trSum = 0;
  for (let i = candles.length - lookback; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    if (!cur || !prev) continue;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    trSum += tr;
  }
  const atrPrice = trSum / lookback;
  return atrPrice / pipSize;
}

export interface DailyChangeTelemetry {
  diffPrice: number;
  diffPips: number;
  diffPct: number;
  dayHigh: number;
  dayLow: number;
  dayOpen: number;
}

/**
 * Computes Revolut-style Daily Change (% and Pips) + Intraday High/Low range
 * from the active candle series.
 */
export function computeDailyChangeTelemetry(
  candles: Candle[],
  symbol: string,
  livePrice?: number | null,
): DailyChangeTelemetry | null {
  if (!candles || candles.length === 0) return null;
  const last = candles[candles.length - 1]!;
  const currentPrice =
    typeof livePrice === "number" && Number.isFinite(livePrice) && livePrice > 0
      ? livePrice
      : last.close;

  const lastDateUtc = new Date(last.time * 1000);
  const dayStartSec =
    Date.UTC(
      lastDateUtc.getUTCFullYear(),
      lastDateUtc.getUTCMonth(),
      lastDateUtc.getUTCDate(),
      0,
      0,
      0,
    ) / 1000;

  let dayOpen = candles[0]!.open;
  let dayHigh = currentPrice;
  let dayLow = currentPrice;
  let foundDayBar = false;

  for (let i = candles.length - 1; i >= 0; i--) {
    const bar = candles[i]!;
    if (bar.time >= dayStartSec) {
      dayOpen = bar.open;
      if (bar.high > dayHigh) dayHigh = bar.high;
      if (bar.low < dayLow) dayLow = bar.low;
      foundDayBar = true;
    } else {
      // Use previous session's last close as reference if available
      if (foundDayBar) {
        dayOpen = bar.close;
      }
      break;
    }
  }

  if (!foundDayBar) {
    // Fallback for D1/W1 or sparse bars: compare against previous bar close
    const refBar = candles.length >= 2 ? candles[candles.length - 2]! : last;
    dayOpen = candles.length >= 2 ? refBar.close : last.open;
    dayHigh = Math.max(last.high, currentPrice);
    dayLow = Math.min(last.low, currentPrice);
  }

  const pipSize = getInstrumentPipSize(symbol);
  const diffPrice = currentPrice - dayOpen;
  const diffPips = diffPrice / pipSize;
  const diffPct = dayOpen !== 0 ? (diffPrice / dayOpen) * 100 : 0;

  return {
    diffPrice,
    diffPips,
    diffPct,
    dayHigh,
    dayLow,
    dayOpen,
  };
}

/**
 * Formats a future or past delta in seconds into a concise Italian AUREUS string
 * e.g. "Tra 2h 15m", "Tra 45m", "1h 20m fa".
 */
export function formatRelativeHorizonDelta(deltaSec: number): string {
  const abs = Math.abs(Math.round(deltaSec));
  if (abs < 60) return deltaSec >= 0 ? "Adesso" : "Poco fa";
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const mins = Math.floor((abs % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}g`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 && days === 0) parts.push(`${mins}m`);

  const joined = parts.join(" ") || "1m";
  return deltaSec >= 0 ? `Tra ${joined}` : `${joined} fa`;
}
