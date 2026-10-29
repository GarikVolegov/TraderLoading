/** Portable chart preferences. Execution costs, replay state and trades never belong here. */
export const CHART_TOOL_IDS = [
  "cursor",
  "arrowUp",
  "path",
  "arrowDown",
  "shortPosition",
  "longPosition",
  "rect",
  "arrow",
  "text",
  "frvp",
  "highlighter",
  "trend",
  "ray",
  "infoline",
  "hray",
  "hline",
  "vline",
  "parallelChannel",
  "fib",
  "avwap",
  "callout",
  "ruler",
  "priceRange",
  "dateRange",
] as const;
export const DEFAULT_FAVORITE_TOOLS = [
  "arrowUp",
  "path",
  "arrowDown",
  "shortPosition",
  "longPosition",
  "rect",
  "arrow",
  "text",
  "frvp",
  "highlighter",
] as const;
export const LEGACY_DEFAULT_FAVORITE_TOOLS = [
  "trend",
  "hline",
  "rect",
  "fib",
  "longPosition",
  "shortPosition",
  "text",
] as const;
export const DEFAULT_CHART_SETTINGS = {
  chartType: "candles" as "candles" | "heikin" | "bars" | "line" | "area",
  showSessions: false,
  magnet: true,
  stayInDrawingMode: false,
  showFavoriteToolbar: true,
  rightOffsetBars: 12,
  toolColor: "#3b82f6",
  toolWidth: 2,
  visibleTools: {} as Record<string, boolean>,
  showTradesOnChart: true,
  tradeLineMode: "hover_or_latest" as "hover_or_latest" | "all" | "none",
  candleUpColor: "#26a69a",
  candleDownColor: "#ef5350",
  wickUpColor: "#26a69a",
  wickDownColor: "#ef5350",
  borderUpColor: "#26a69a",
  borderDownColor: "#ef5350",
  candleBordersVisible: true,
  candleWicksVisible: true,
  lineColor: "#3b82f6",
  areaTopColor: "#3b82f659",
  areaBottomColor: "#3b82f600",
  chartBgType: "solid" as "solid" | "gradient",
  chartBgColor1: "#121418",
  chartBgColor2: "#0f1115",
  showVertGrid: true,
  showHorzGrid: true,
  gridColor: "#ffffff0a",
  gridStyle: "solid" as "solid" | "dashed" | "dotted",
  crosshairColor: "#94a3b866",
  crosshairStyle: "dashed" as "solid" | "dashed" | "dotted",
  textColor: "#b8bdc6",
  axisColor: "#363b45",
  volumeUpColor: "#26a69a66",
  volumeDownColor: "#ef535066",
  showWatermark: true,
  watermarkText: "",
  watermarkOpacity: 0.05,
  priceScaleMode: "normal" as "normal" | "logarithmic" | "percentage",
  showOhlcLegend: true,
  showBarChange: true,
  showLastPriceLine: true,
  showHighLowLines: false,
};
export type ChartSettings = typeof DEFAULT_CHART_SETTINGS;
export interface ChartIndicator {
  id: string;
  type:
    | "ema"
    | "sma"
    | "wma"
    | "bb"
    | "vwap"
    | "rsi"
    | "macd"
    | "atr"
    | "stoch"
    | "volume"
    | "custom";
  on: boolean;
  color: string;
  period?: number;
  mult?: number;
  fast?: number;
  slow?: number;
  signal?: number;
  k?: number;
  d?: number;
  source?: "close" | "open" | "high" | "low" | "hl2" | "ohlc4";
  ma?: "ema" | "sma" | "wma" | "none";
  formula?: string;
  name?: string;
  pane?: "price" | "sub" | "volume";
}
export interface BacktestChartTemplate {
  id: string;
  name: string;
  settings: ChartSettings;
  indicators: ChartIndicator[];
}
export interface BacktestChartPreferences {
  version: 1;
  settings: ChartSettings;
  favoriteTools: string[];
  favoriteColors: string[];
  templates: BacktestChartTemplate[];
  toolbarPosition: { x: number; y: number };
}
export interface BacktestChartSnapshot {
  revision: number;
  preferences: BacktestChartPreferences | null;
}
export interface UpdateBacktestChartRequest {
  revision: number;
  preferences: BacktestChartPreferences;
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
/** Allow concrete CSS colors only: no var(), URLs or unbounded CSS expressions. */
export function isChartColor(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 64) return false;
  if (/^#[\da-f]{3,4}$/i.test(value) || /^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) return true;
  const rgb =
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i.exec(
      value,
    );
  return (
    !!rgb &&
    rgb.slice(1, 4).every((n) => Number(n) >= 0 && Number(n) <= 255) &&
    (rgb[4] == null || Number(rgb[4]) <= 1)
  );
}
const ENUMS: Record<string, readonly string[]> = {
  chartType: ["candles", "heikin", "bars", "line", "area"],
  chartBgType: ["solid", "gradient"],
  tradeLineMode: ["hover_or_latest", "all", "none"],
  gridStyle: ["solid", "dashed", "dotted"],
  crosshairStyle: ["solid", "dashed", "dotted"],
  priceScaleMode: ["normal", "logarithmic", "percentage"],
};
/** Tolerant legacy migration and a whitelist preventing execution settings leaking into templates. */
export function pickChartSettings(value: unknown): ChartSettings {
  const result = {
    ...DEFAULT_CHART_SETTINGS,
    visibleTools: { ...DEFAULT_CHART_SETTINGS.visibleTools },
  };
  if (!record(value)) return result;
  const output = result as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(DEFAULT_CHART_SETTINGS)) {
    const candidate = value[key];
    if (key === "visibleTools") {
      if (record(candidate))
        result.visibleTools = Object.fromEntries(
          CHART_TOOL_IDS.filter((id) => typeof candidate[id] === "boolean").map((id) => [
            id,
            candidate[id],
          ]),
        ) as Record<string, boolean>;
    } else if (ENUMS[key]) {
      if (typeof candidate === "string" && ENUMS[key].includes(candidate)) output[key] = candidate;
    } else if (key.endsWith("Color") || key === "chartBgColor1" || key === "chartBgColor2") {
      if (isChartColor(candidate)) output[key] = candidate;
    } else if (typeof fallback === "boolean" && typeof candidate === "boolean")
      output[key] = candidate;
    else if (key === "watermarkText" && typeof candidate === "string")
      output[key] = candidate.slice(0, 120);
    else if (
      key === "toolWidth" &&
      Number.isInteger(candidate) &&
      Number(candidate) >= 1 &&
      Number(candidate) <= 8
    )
      output[key] = candidate;
    else if (
      key === "rightOffsetBars" &&
      Number.isInteger(candidate) &&
      Number(candidate) >= 0 &&
      Number(candidate) <= 100
    )
      output[key] = candidate;
    else if (
      key === "watermarkOpacity" &&
      typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate >= 0 &&
      candidate <= 1
    )
      output[key] = candidate;
  }
  return result;
}
export const DEFAULT_AUREUS_TEMPLATES: BacktestChartTemplate[] = [
  {
    id: "template-silver-bullet",
    name: "Setup Sovrano Silver Bullet (SMC)",
    settings: pickChartSettings({
      chartType: "candles",
      candleUpColor: "#C5A059",
      candleDownColor: "#ef4444",
      showSessions: true,
      priceScaleMode: "normal",
    }),
    indicators: [
      { id: "vol-def", type: "volume", on: true, color: "#C5A059" },
      { id: "ema-trend", type: "ema", on: true, period: 50, color: "#C5A059" },
    ],
  },
  {
    id: "template-pure-price-action",
    name: "Cartografia Pura (Nuda Price Action)",
    settings: pickChartSettings({
      chartType: "candles",
      candleUpColor: "#f4f4f6",
      candleDownColor: "#71717a",
      showSessions: false,
      priceScaleMode: "normal",
    }),
    indicators: [],
  },
  {
    id: "template-macro-trend",
    name: "Visione Macro Trend & Volatilità",
    settings: pickChartSettings({
      chartType: "candles",
      candleUpColor: "#10b981",
      candleDownColor: "#ef4444",
      showSessions: true,
      priceScaleMode: "normal",
    }),
    indicators: [
      { id: "ema-20", type: "ema", on: true, period: 20, color: "#38bdf8" },
      { id: "ema-50", type: "ema", on: true, period: 50, color: "#f59e0b" },
      { id: "ema-200", type: "ema", on: true, period: 200, color: "#8b5cf6" },
      { id: "vol-def", type: "volume", on: true, color: "#C5A059" },
    ],
  },
];

export function defaultChartPreferences(settings?: unknown): BacktestChartPreferences {
  return {
    version: 1,
    settings: pickChartSettings(settings),
    favoriteTools: [...DEFAULT_FAVORITE_TOOLS],
    favoriteColors: [],
    templates: [...DEFAULT_AUREUS_TEMPLATES],
    toolbarPosition: { x: 16, y: 64 },
  };
}
const INDICATORS = [
  "ema",
  "sma",
  "wma",
  "bb",
  "vwap",
  "rsi",
  "macd",
  "atr",
  "stoch",
  "volume",
  "custom",
];
function parseIndicators(value: unknown): ChartIndicator[] | null {
  if (!Array.isArray(value) || value.length > 40) return null;
  const result: ChartIndicator[] = [];
  for (const item of value) {
    if (
      !record(item) ||
      typeof item.id !== "string" ||
      item.id.length > 100 ||
      !INDICATORS.includes(String(item.type)) ||
      typeof item.on !== "boolean" ||
      !isChartColor(item.color)
    )
      return null;
    const next: Record<string, unknown> = {
      id: item.id,
      type: item.type,
      on: item.on,
      color: item.color,
    };
    for (const key of ["period", "mult", "fast", "slow", "signal", "k", "d"]) {
      if (item[key] !== undefined) {
        if (
          typeof item[key] !== "number" ||
          !Number.isFinite(item[key]) ||
          Number(item[key]) < (key === "mult" ? 0.1 : 1) ||
          Number(item[key]) > 1000 ||
          (key !== "mult" && !Number.isInteger(item[key]))
        )
          return null;
        next[key] = item[key];
      }
    }
    for (const [key, choices] of Object.entries({
      source: ["close", "open", "high", "low", "hl2", "ohlc4"],
      ma: ["ema", "sma", "wma", "none"],
      pane: ["price", "sub", "volume"],
    })) {
      if (item[key] !== undefined) {
        if (!choices.includes(String(item[key]))) return null;
        next[key] = item[key];
      }
    }
    for (const key of ["formula", "name"]) {
      if (item[key] !== undefined) {
        if (
          typeof item[key] !== "string" ||
          String(item[key]).length > (key === "formula" ? 2000 : 100)
        )
          return null;
        next[key] = item[key];
      }
    }
    result.push(next as unknown as ChartIndicator);
  }
  return new Set(result.map((i) => i.id)).size === result.length ? result : null;
}
export function parseBacktestChartPreferences(value: unknown): BacktestChartPreferences | null {
  if (!record(value) || value.version !== 1 || !record(value.settings)) return null;
  // Validate present fields strictly; whitelist unknown keys (including legacy costs).
  const settings = pickChartSettings(value.settings);
  for (const key of Object.keys(DEFAULT_CHART_SETTINGS)) {
    if (key === "visibleTools") {
      if (
        value.settings[key] !== undefined &&
        (!record(value.settings[key]) ||
          Object.entries(value.settings[key]).some(
            ([id, visible]) =>
              !(CHART_TOOL_IDS as readonly string[]).includes(id) || typeof visible !== "boolean",
          ))
      )
        return null;
    } else if (
      value.settings[key] !== undefined &&
      value.settings[key] !== settings[key as keyof ChartSettings]
    )
      return null;
  }
  if (
    !Array.isArray(value.favoriteTools) ||
    value.favoriteTools.length > CHART_TOOL_IDS.length ||
    !value.favoriteTools.every(
      (id) => typeof id === "string" && (CHART_TOOL_IDS as readonly string[]).includes(id),
    )
  )
    return null;
  if (new Set(value.favoriteTools).size !== value.favoriteTools.length) return null;
  if (
    !Array.isArray(value.favoriteColors) ||
    value.favoriteColors.length > 24 ||
    !value.favoriteColors.every(isChartColor)
  )
    return null;
  if (
    !record(value.toolbarPosition) ||
    ![value.toolbarPosition.x, value.toolbarPosition.y].every(
      (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 20000,
    )
  )
    return null;
  if (!Array.isArray(value.templates) || value.templates.length > 50) return null;
  const templates: BacktestChartTemplate[] = [];
  for (const item of value.templates) {
    if (
      !record(item) ||
      typeof item.id !== "string" ||
      item.id.length === 0 ||
      item.id.length > 100 ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      item.name.length > 80 ||
      !record(item.settings)
    )
      return null;
    const indicators = parseIndicators(item.indicators);
    if (!indicators) return null;
    templates.push({
      id: item.id,
      name: item.name.trim(),
      settings: pickChartSettings(item.settings),
      indicators,
    });
  }
  if (new Set(templates.map((t) => t.id)).size !== templates.length) return null;
  return {
    version: 1,
    settings,
    favoriteTools: [...value.favoriteTools],
    favoriteColors: [...new Set(value.favoriteColors)],
    templates,
    toolbarPosition: { x: value.toolbarPosition.x as number, y: value.toolbarPosition.y as number },
  };
}
export function parseBacktestChartUpdate(value: unknown): UpdateBacktestChartRequest | null {
  if (!record(value) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0)
    return null;
  const preferences = parseBacktestChartPreferences(value.preferences);
  return preferences ? { revision: Number(value.revision), preferences } : null;
}
