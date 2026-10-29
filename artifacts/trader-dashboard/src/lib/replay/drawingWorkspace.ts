import type {
  DrawingPoint,
  DrawingVisibilityConfig,
  FibLevelConfig,
  ReplayCandle,
  ReplayDrawing,
  ReplayDrawingKind,
} from "./types";

export type DrawingHandle =
  | "a"
  | "b"
  | "ab"
  | "ba"
  | "anchor"
  | "box"
  | "offset"
  | "entry"
  | "sl"
  | "tp"
  | "end"
  | `p-${number}`;

export const DEFAULT_DRAWING_VISIBILITY: DrawingVisibilityConfig = {
  ticks: true,
  seconds: { enabled: true, min: 1, max: 59 },
  minutes: { enabled: true, min: 1, max: 59 },
  hours: { enabled: true, min: 1, max: 24 },
  days: { enabled: true, min: 1, max: 366 },
  weeks: { enabled: true, min: 1, max: 52 },
  months: { enabled: true, min: 1, max: 12 },
  ranges: true,
};

export const DEFAULT_FIB_LEVELS: FibLevelConfig[] = [
  { level: -0.618, enabled: false, color: "#ef4444" },
  { level: -0.27, enabled: false, color: "#f59e0b" },
  { level: 0, enabled: true, color: "#94a3b8" },
  { level: 0.236, enabled: true, color: "#64748b" },
  { level: 0.382, enabled: true, color: "#38bdf8" },
  { level: 0.5, enabled: true, color: "#10b981" },
  { level: 0.618, enabled: true, color: "#E8C56A" },
  { level: 0.705, enabled: true, color: "#C5A059" },
  { level: 0.786, enabled: true, color: "#f59e0b" },
  { level: 1, enabled: true, color: "#94a3b8" },
  { level: 1.272, enabled: false, color: "#a855f7" },
  { level: 1.618, enabled: false, color: "#3b82f6" },
];

/**
 * Checks whether a drawing should be visible on the active chart timeframe
 * according to its TradingView-style `Visibilità` configuration.
 */
export function isDrawingVisibleOnInterval(
  drawing: Pick<ReplayDrawing, "hidden" | "visibility">,
  intervalSeconds: number,
): boolean {
  if (drawing.hidden) return false;
  const vis = drawing.visibility;
  if (!vis) return true;

  if (intervalSeconds <= 0) return vis.ticks;
  if (intervalSeconds < 60) {
    if (!vis.seconds.enabled) return false;
    return intervalSeconds >= vis.seconds.min && intervalSeconds <= vis.seconds.max;
  }
  if (intervalSeconds < 3600) {
    if (!vis.minutes.enabled) return false;
    const mins = Math.round(intervalSeconds / 60);
    return mins >= vis.minutes.min && mins <= vis.minutes.max;
  }
  if (intervalSeconds < 86400) {
    if (!vis.hours.enabled) return false;
    const hours = Math.round(intervalSeconds / 3600);
    return hours >= vis.hours.min && hours <= vis.hours.max;
  }
  if (intervalSeconds < 86400 * 7) {
    if (!vis.days.enabled) return false;
    const days = Math.round(intervalSeconds / 86400);
    return days >= vis.days.min && days <= vis.days.max;
  }
  if (intervalSeconds < 86400 * 28) {
    if (!vis.weeks.enabled) return false;
    const weeks = Math.round(intervalSeconds / (86400 * 7));
    return weeks >= vis.weeks.min && weeks <= vis.weeks.max;
  }
  if (!vis.months.enabled) return false;
  const months = Math.max(1, Math.round(intervalSeconds / (86400 * 30)));
  return months >= vis.months.min && months <= vis.months.max;
}

/** Pure data-space operations keep gestures stable when the viewport moves. */
export function moveDrawing(item: ReplayDrawing, time: number, price: number): ReplayDrawing {
  if (item.locked) return item;
  const shift = (point: DrawingPoint) => ({ time: point.time + time, price: point.price + price });
  switch (item.kind) {
    case "hline":
      return { ...item, price: item.price + price };
    case "vline":
      return { ...item, time: item.time + time };
    case "text":
    case "hray":
    case "arrowUp":
    case "arrowDown":
    case "avwap":
      return { ...item, at: shift(item.at) };
    case "callout":
      return {
        ...item,
        at: shift(item.at),
        ...(item.boxAt ? { boxAt: shift(item.boxAt) } : {}),
      };
    case "path":
    case "highlighter":
      return { ...item, points: item.points.map(shift) };
    case "position":
      return {
        ...item,
        entry: shift(item.entry),
        slPrice: item.slPrice + price,
        tpPrice: item.tpPrice + price,
        ...(item.endTime != null ? { endTime: item.endTime + time } : {}),
      };
    default:
      return { ...item, a: shift(item.a), b: shift(item.b) };
  }
}

export function resizeDrawing(item: ReplayDrawing, handle: DrawingHandle, point: DrawingPoint): ReplayDrawing {
  if (item.locked) return item;
  if (item.kind === "position") {
    if (handle === "sl") return { ...item, slPrice: point.price };
    if (handle === "tp") return { ...item, tpPrice: point.price };
    if (handle === "entry") {
      if (item.endTime !== undefined) {
        const dPrice = point.price - item.entry.price;
        const dTime = point.time - item.entry.time;
        return {
          ...item,
          entry: point,
          slPrice: item.slPrice + dPrice,
          tpPrice: item.tpPrice + dPrice,
          endTime: item.endTime + dTime,
        };
      }
      return { ...item, entry: point };
    }
    if (handle === "end") return { ...item, endTime: Math.max(item.entry.time + 1, point.time) };
  }
  if (item.kind === "hline") return { ...item, price: point.price };
  if (item.kind === "vline") return { ...item, time: point.time };
  if (
    item.kind === "text" ||
    item.kind === "hray" ||
    item.kind === "arrowUp" ||
    item.kind === "arrowDown" ||
    item.kind === "avwap"
  ) {
    return { ...item, at: point };
  }
  if (item.kind === "callout") {
    if (handle === "box") return { ...item, boxAt: point };
    return { ...item, at: point };
  }
  if (item.kind === "parallelChannel" && handle === "offset") {
    const dt = item.b.time - item.a.time;
    const tRatio = dt !== 0 ? (point.time - item.a.time) / dt : 0;
    const basePriceAtPoint = item.a.price + (item.b.price - item.a.price) * tRatio;
    return { ...item, priceOffset: point.price - basePriceAtPoint };
  }
  if ((item.kind === "path" || item.kind === "highlighter") && handle.startsWith("p-")) {
    const idx = Number.parseInt(handle.slice(2), 10);
    if (Number.isInteger(idx) && idx >= 0 && idx < item.points.length) {
      const points = item.points.map((pt, i) => (i === idx ? point : pt));
      return { ...item, points };
    }
  }
  if ("a" in item) {
    if (handle === "a" || handle === "b") return { ...item, [handle]: point };
    if (handle === "ab") return { ...item, a: { ...item.a, time: point.time }, b: { ...item.b, price: point.price } };
    if (handle === "ba") return { ...item, b: { ...item.b, time: point.time }, a: { ...item.a, price: point.price } };
  }
  return item;
}

export interface VolumeProfileBucket {
  priceLow: number;
  priceHigh: number;
  priceMid: number;
  upVolume: number;
  downVolume: number;
  totalVolume: number;
  inValueArea: boolean;
  isPoc: boolean;
}

export interface DevelopingVaPoint {
  time: number;
  poc: number;
  vah: number;
  val: number;
}

export interface FixedRangeVolumeProfileResult {
  minTime: number;
  maxTime: number;
  minPrice: number;
  maxPrice: number;
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  maxBucketVolume: number;
  totalVolume: number;
  buckets: VolumeProfileBucket[];
  developing: DevelopingVaPoint[];
}

/**
 * Computes a TradingView-style Fixed Range Volume Profile (FRVP) across the candles
 * falling within [min(t1, t2), max(t1, t2)], including POC, VAH, VAL (default 70% VA),
 * and bar-by-bar Developing POC / Developing Value Area series.
 */
export function computeFixedRangeVolumeProfile(
  candles: ReplayCandle[],
  t1: number,
  t2: number,
  rows = 24,
  valueAreaPct = 0.7,
): FixedRangeVolumeProfileResult | null {
  const minTime = Math.min(t1, t2);
  const maxTime = Math.max(t1, t2);
  const rangeCandles = candles.filter((c) => c.time >= minTime && c.time <= maxTime);
  if (rangeCandles.length === 0) return null;

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (const c of rangeCandles) {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
  }
  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice) || maxPrice <= minPrice) return null;

  const numRows = Math.max(6, Math.min(100, Math.round(rows)));
  const step = (maxPrice - minPrice) / numRows;
  const vaPct = Math.max(0.1, Math.min(1, valueAreaPct));
  const buckets: VolumeProfileBucket[] = Array.from({ length: numRows }, (_, i) => {
    const priceLow = minPrice + i * step;
    const priceHigh = i === numRows - 1 ? maxPrice : priceLow + step;
    return {
      priceLow,
      priceHigh,
      priceMid: (priceLow + priceHigh) / 2,
      upVolume: 0,
      downVolume: 0,
      totalVolume: 0,
      inValueArea: false,
      isPoc: false,
    };
  });

  const developing: DevelopingVaPoint[] = [];
  let runningTotal = 0;

  for (const c of rangeCandles) {
    // Fallback to synthetic tick-range weight if candle volume is missing or zero
    const rawVol = c.volume != null && c.volume > 0 ? c.volume : Math.max(1, (c.high - c.low) / Math.max(1e-9, step));
    const isUp = c.close >= c.open;
    const startIdx = Math.max(0, Math.min(numRows - 1, Math.floor((c.low - minPrice) / step)));
    const endIdx = Math.max(startIdx, Math.min(numRows - 1, Math.floor((c.high - minPrice) / step)));
    const count = endIdx - startIdx + 1;
    const share = rawVol / count;
    for (let i = startIdx; i <= endIdx; i++) {
      if (isUp) buckets[i].upVolume += share;
      else buckets[i].downVolume += share;
      buckets[i].totalVolume += share;
    }
    runningTotal += rawVol;

    // Developing POC / VA at this bar
    let curPocIdx = 0;
    let curMax = 0;
    for (let i = 0; i < numRows; i++) {
      if (buckets[i].totalVolume > curMax) {
        curMax = buckets[i].totalVolume;
        curPocIdx = i;
      }
    }
    if (curMax > 0) {
      const targetVol = runningTotal * vaPct;
      let acc = buckets[curPocIdx].totalVolume;
      let lIdx = curPocIdx;
      let hIdx = curPocIdx;
      while (acc < targetVol && (lIdx > 0 || hIdx < numRows - 1)) {
        const nextD = lIdx > 0 ? buckets[lIdx - 1].totalVolume : -1;
        const nextU = hIdx < numRows - 1 ? buckets[hIdx + 1].totalVolume : -1;
        if (nextU >= nextD && hIdx < numRows - 1) {
          hIdx += 1;
          acc += buckets[hIdx].totalVolume;
        } else if (lIdx > 0) {
          lIdx -= 1;
          acc += buckets[lIdx].totalVolume;
        } else {
          break;
        }
      }
      developing.push({
        time: c.time,
        poc: buckets[curPocIdx].priceMid,
        vah: buckets[hIdx].priceHigh,
        val: buckets[lIdx].priceLow,
      });
    }
  }

  let pocIdx = 0;
  let maxBucketVolume = 0;
  let totalVolume = 0;
  for (let i = 0; i < numRows; i++) {
    totalVolume += buckets[i].totalVolume;
    if (buckets[i].totalVolume > maxBucketVolume) {
      maxBucketVolume = buckets[i].totalVolume;
      pocIdx = i;
    }
  }
  if (maxBucketVolume <= 0) return null;

  buckets[pocIdx].isPoc = true;
  buckets[pocIdx].inValueArea = true;

  const targetVolume = totalVolume * vaPct;
  let accumVolume = buckets[pocIdx].totalVolume;
  let lowIdx = pocIdx;
  let highIdx = pocIdx;

  while (accumVolume < targetVolume && (lowIdx > 0 || highIdx < numRows - 1)) {
    const nextDown = lowIdx > 0 ? buckets[lowIdx - 1].totalVolume : -1;
    const nextUp = highIdx < numRows - 1 ? buckets[highIdx + 1].totalVolume : -1;
    if (nextUp >= nextDown && highIdx < numRows - 1) {
      highIdx += 1;
      buckets[highIdx].inValueArea = true;
      accumVolume += buckets[highIdx].totalVolume;
    } else if (lowIdx > 0) {
      lowIdx -= 1;
      buckets[lowIdx].inValueArea = true;
      accumVolume += buckets[lowIdx].totalVolume;
    } else {
      break;
    }
  }

  return {
    minTime,
    maxTime,
    minPrice,
    maxPrice,
    pocPrice: buckets[pocIdx].priceMid,
    vahPrice: buckets[highIdx].priceHigh,
    valPrice: buckets[lowIdx].priceLow,
    maxBucketVolume,
    totalVolume,
    buckets,
    developing,
  };
}

export interface AnchoredVwapPoint {
  time: number;
  vwap: number;
  upper: number;
  lower: number;
}

/**
 * Computes an Anchored VWAP (with optional standard deviation bands) starting from `anchorTime`.
 */
export function computeAnchoredVwap(
  candles: ReplayCandle[],
  anchorTime: number,
  source: "hlc3" | "ohlc4" | "close" | "hl2" = "hlc3",
  bandMultiplier = 1,
): AnchoredVwapPoint[] {
  const startIdx = candles.findIndex((c) => c.time >= anchorTime);
  if (startIdx < 0) return [];
  let sumPV = 0;
  let sumP2V = 0;
  let sumV = 0;
  const out: AnchoredVwapPoint[] = [];

  for (let i = startIdx; i < candles.length; i++) {
    const c = candles[i];
    const tp =
      source === "close"
        ? c.close
        : source === "hl2"
          ? (c.high + c.low) / 2
          : source === "ohlc4"
            ? (c.open + c.high + c.low + c.close) / 4
            : (c.high + c.low + c.close) / 3;
    const vol = c.volume != null && c.volume > 0 ? c.volume : Math.max(1, c.high - c.low);
    sumPV += tp * vol;
    sumP2V += tp * tp * vol;
    sumV += vol;
    const vwap = sumV > 0 ? sumPV / sumV : tp;
    const variance = sumV > 0 ? Math.max(0, sumP2V / sumV - vwap * vwap) : 0;
    const stdev = Math.sqrt(variance);
    out.push({
      time: c.time,
      vwap,
      upper: vwap + stdev * bandMultiplier,
      lower: vwap - stdev * bandMultiplier,
    });
  }
  return out;
}

export interface DrawingToolSavedTemplate {
  id: string;
  name: string;
  kind: ReplayDrawingKind;
  props: Record<string, unknown>;
}

const TOOL_TEMPLATES_STORAGE_KEY = "limen_drawing_tool_templates_v1";

export function loadDrawingToolTemplates(kind?: ReplayDrawingKind): DrawingToolSavedTemplate[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(TOOL_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (item): item is DrawingToolSavedTemplate =>
        Boolean(item && typeof item.id === "string" && typeof item.name === "string" && typeof item.kind === "string" && item.props),
    );
    return kind ? valid.filter((t) => t.kind === kind) : valid;
  } catch {
    return [];
  }
}

export function saveDrawingToolTemplate(
  kind: ReplayDrawingKind,
  name: string,
  drawing: ReplayDrawing,
): DrawingToolSavedTemplate[] {
  const cleanName = name.trim().slice(0, 60);
  if (!cleanName) return loadDrawingToolTemplates(kind);
  const all = loadDrawingToolTemplates();
  // Strip coordinates and unique id from template props
  const { id: _id, kind: _kind, ...rest } = drawing as unknown as Record<string, unknown>;
  delete rest.a;
  delete rest.b;
  delete rest.at;
  delete rest.boxAt;
  delete rest.points;
  delete rest.entry;
  delete rest.slPrice;
  delete rest.tpPrice;
  delete rest.endTime;
  delete rest.price;
  delete rest.time;

  const existingIdx = all.findIndex((t) => t.kind === kind && t.name.toLowerCase() === cleanName.toLowerCase());
  const nextItem: DrawingToolSavedTemplate = {
    id: existingIdx >= 0 ? all[existingIdx].id : `dtpl-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name: cleanName,
    kind,
    props: rest,
  };
  const nextAll =
    existingIdx >= 0 ? all.map((t, i) => (i === existingIdx ? nextItem : t)) : [...all, nextItem];
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(TOOL_TEMPLATES_STORAGE_KEY, JSON.stringify(nextAll));
    } catch {
      // ignore
    }
  }
  return nextAll.filter((t) => t.kind === kind);
}

export function deleteDrawingToolTemplate(templateId: string, kind?: ReplayDrawingKind): DrawingToolSavedTemplate[] {
  const all = loadDrawingToolTemplates().filter((t) => t.id !== templateId);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(TOOL_TEMPLATES_STORAGE_KEY, JSON.stringify(all));
    } catch {
      // ignore
    }
  }
  return kind ? all.filter((t) => t.kind === kind) : all;
}

/** Snapshots are immutable; recording happens once at the end of a gesture. */
export class DrawingHistory {
  private past: ReplayDrawing[][] = [];
  private future: ReplayDrawing[][] = [];
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  record(before: ReplayDrawing[], after: ReplayDrawing[]) {
    if (JSON.stringify(before) === JSON.stringify(after)) return;
    this.past.push(before);
    if (this.past.length > 100) this.past.shift();
    this.future = [];
  }
  undo(current: ReplayDrawing[]): ReplayDrawing[] {
    const previous = this.past.pop();
    if (!previous) return current;
    this.future.push(current);
    return previous;
  }
  redo(current: ReplayDrawing[]): ReplayDrawing[] {
    const next = this.future.pop();
    if (!next) return current;
    this.past.push(current);
    return next;
  }
}
