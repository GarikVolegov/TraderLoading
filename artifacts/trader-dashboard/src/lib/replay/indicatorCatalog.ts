// ─── Indicator catalog ───────────────────────────────────────────────────────
// The terminal's indicator registry: per-type metadata (pane, params, i18n
// label key), default set (EMA 9 / EMA 21 / Volume like the mockup), compact
// chip labels and the computation dispatch into chartIndicatorEngine /
// formulaParser. Pure — the chart layer decides how to render the output.
import type { Time } from "lightweight-charts";
import {
  atr,
  bollinger,
  ema,
  macd,
  rsi,
  sma,
  stochastic,
  wma,
} from "../../components/chartIndicatorEngine";
import { calculateDailyVwap } from "../../components/chartIndicators";
import { evaluateFormula, parseFormula } from "./formulaParser";
import type { ReplayCandle } from "./types";

export type IndicatorType =
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

export type IndicatorPane = "price" | "sub" | "volume";

export type IndicatorSource = "close" | "open" | "high" | "low" | "hl2" | "ohlc4";

export type IndicatorMa = "ema" | "sma" | "wma" | "none";

export interface IndicatorConfig {
  id: string;
  type: IndicatorType;
  on: boolean;
  color: string;
  period?: number;
  /** Bollinger standard-deviation multiplier. */
  mult?: number;
  fast?: number;
  slow?: number;
  signal?: number;
  k?: number;
  d?: number;
  /** custom: input series. */
  source?: IndicatorSource;
  /** custom: smoothing applied to the source (ignored when a formula is set). */
  ma?: IndicatorMa;
  /** custom: free-text formula (see formulaParser). */
  formula?: string;
  /** custom: display name. */
  name?: string;
  /** custom: chosen pane (fixed by type for the others). */
  pane?: IndicatorPane;
}

export interface IndicatorParamMeta {
  key: "period" | "mult" | "fast" | "slow" | "signal" | "k" | "d";
  /** uiText key for the param label in the settings dialog. */
  labelKey: string;
  def: number;
  min: number;
  max: number;
  step?: number;
}

export interface IndicatorMeta {
  /** uiText key for the indicator name in the settings dialog. */
  labelKey: string;
  pane: IndicatorPane;
  params: IndicatorParamMeta[];
}

const PERIOD = (def: number, max = 400): IndicatorParamMeta => ({
  key: "period",
  labelKey: "backtest_terminal.ind.param_period",
  def,
  min: 1,
  max,
});

export const INDICATOR_META: Record<IndicatorType, IndicatorMeta> = {
  ema: { labelKey: "backtest_terminal.ind.ema", pane: "price", params: [PERIOD(21)] },
  sma: { labelKey: "backtest_terminal.ind.sma", pane: "price", params: [PERIOD(20)] },
  wma: { labelKey: "backtest_terminal.ind.wma", pane: "price", params: [PERIOD(20)] },
  bb: {
    labelKey: "backtest_terminal.ind.bb",
    pane: "price",
    params: [
      PERIOD(20),
      { key: "mult", labelKey: "backtest_terminal.ind.param_mult", def: 2, min: 0.5, max: 5, step: 0.5 },
    ],
  },
  vwap: { labelKey: "backtest_terminal.ind.vwap", pane: "price", params: [] },
  rsi: { labelKey: "backtest_terminal.ind.rsi", pane: "sub", params: [PERIOD(14, 200)] },
  macd: {
    labelKey: "backtest_terminal.ind.macd",
    pane: "sub",
    params: [
      { key: "fast", labelKey: "backtest_terminal.ind.param_fast", def: 12, min: 1, max: 200 },
      { key: "slow", labelKey: "backtest_terminal.ind.param_slow", def: 26, min: 1, max: 400 },
      { key: "signal", labelKey: "backtest_terminal.ind.param_signal", def: 9, min: 1, max: 100 },
    ],
  },
  atr: { labelKey: "backtest_terminal.ind.atr", pane: "sub", params: [PERIOD(14, 200)] },
  stoch: {
    labelKey: "backtest_terminal.ind.stoch",
    pane: "sub",
    params: [
      { key: "k", labelKey: "backtest_terminal.ind.param_k", def: 14, min: 1, max: 200 },
      { key: "d", labelKey: "backtest_terminal.ind.param_d", def: 3, min: 1, max: 100 },
    ],
  },
  volume: { labelKey: "backtest_terminal.ind.volume", pane: "volume", params: [] },
  custom: { labelKey: "backtest_terminal.ind.custom", pane: "price", params: [PERIOD(14)] },
};

/** The 8-color swatch palette shared by indicators and drawing tools. */
export const INDICATOR_SWATCHES = [
  "#f59e0b",
  "#3b82f6",
  "#a855f7",
  "#22c55e",
  "#ef4444",
  "#eab308",
  "#06b6d4",
  "#ec4899",
] as const;

export function indicatorPane(config: IndicatorConfig): IndicatorPane {
  if (config.type === "custom") return config.pane ?? "price";
  return INDICATOR_META[config.type].pane;
}

/** Compact technical chip label (not localized copy): "EMA 9", "MACD 12,26"… */
export function indicatorLabel(config: IndicatorConfig): string {
  const meta = INDICATOR_META[config.type];
  switch (config.type) {
    case "ema":
    case "sma":
    case "wma":
      return `${config.type.toUpperCase()} ${config.period ?? meta.params[0].def}`;
    case "bb":
      return `BB ${config.period ?? 20}`;
    case "vwap":
      return "VWAP";
    case "rsi":
      return `RSI ${config.period ?? 14}`;
    case "macd":
      return `MACD ${config.fast ?? 12},${config.slow ?? 26}`;
    case "atr":
      return `ATR ${config.period ?? 14}`;
    case "stoch":
      return `Stoch ${config.k ?? 14},${config.d ?? 3}`;
    case "volume":
      return "Vol";
    case "custom":
      return config.name?.trim() || "Custom";
  }
}

export function createIndicator(type: IndicatorType, id: string): IndicatorConfig {
  const meta = INDICATOR_META[type];
  const config: IndicatorConfig = {
    id,
    type,
    on: true,
    color: INDICATOR_SWATCHES[0],
  };
  for (const param of meta.params) config[param.key] = param.def;
  if (type === "custom") {
    config.source = "close";
    config.ma = "ema";
    config.pane = "price";
  }
  return config;
}

let seedCounter = 0;

/** The mockup's default stack: EMA 9 (amber), EMA 21 (blue), Volume. */
export function defaultIndicators(): IndicatorConfig[] {
  seedCounter += 1;
  const prefix = `default-${seedCounter}`;
  return [
    { id: `${prefix}-ema9`, type: "ema", on: true, color: "#f59e0b", period: 9 },
    { id: `${prefix}-ema21`, type: "ema", on: true, color: "#3b82f6", period: 21 },
    { id: `${prefix}-volume`, type: "volume", on: true, color: "#3b82f6" },
  ];
}

export interface IndicatorLine {
  values: (number | null)[];
  color: string;
  dashed?: boolean;
}

export type IndicatorOutput =
  | { pane: "price"; lines: IndicatorLine[] }
  | {
      pane: "sub";
      lines: IndicatorLine[];
      histogram?: { values: (number | null)[]; positiveColor: string; negativeColor: string };
      range?: { min: number; max: number };
      levels?: number[];
    }
  | { pane: "volume" };

function sourceSeries(candles: ReplayCandle[], source: IndicatorSource): number[] {
  switch (source) {
    case "close":
      return candles.map((c) => c.close);
    case "open":
      return candles.map((c) => c.open);
    case "high":
      return candles.map((c) => c.high);
    case "low":
      return candles.map((c) => c.low);
    case "hl2":
      return candles.map((c) => (c.high + c.low) / 2);
    case "ohlc4":
      return candles.map((c) => (c.open + c.high + c.low + c.close) / 4);
  }
}

function customSeries(config: IndicatorConfig, candles: ReplayCandle[]): (number | null)[] | null {
  if (config.formula && config.formula.trim() !== "") {
    try {
      return evaluateFormula(parseFormula(config.formula), candles);
    } catch {
      // Invalid formulas are reported by the dialog at input time; at render
      // time the indicator simply contributes nothing.
      return null;
    }
  }
  const source = sourceSeries(candles, config.source ?? "close");
  const period = config.period ?? 14;
  switch (config.ma ?? "ema") {
    case "none":
      return source;
    case "sma":
      return sma(source, period);
    case "wma":
      return wma(source, period);
    case "ema":
      return ema(source, period);
  }
}

export function computeIndicator(config: IndicatorConfig, candles: ReplayCandle[]): IndicatorOutput {
  const pane = indicatorPane(config);
  if (pane === "volume") return { pane: "volume" };
  if (!config.on) return pane === "price" ? { pane, lines: [] } : { pane, lines: [] };

  const closes = candles.map((c) => c.close);

  if (pane === "price") {
    const lines: IndicatorLine[] = [];
    switch (config.type) {
      case "ema":
        lines.push({ values: ema(closes, config.period ?? 21), color: config.color });
        break;
      case "sma":
        lines.push({ values: sma(closes, config.period ?? 20), color: config.color });
        break;
      case "wma":
        lines.push({ values: wma(closes, config.period ?? 20), color: config.color });
        break;
      case "bb": {
        const bands = bollinger(closes, config.period ?? 20, config.mult ?? 2);
        lines.push(
          { values: bands.map((b) => (b ? b.middle : null)), color: config.color, dashed: true },
          { values: bands.map((b) => (b ? b.upper : null)), color: config.color },
          { values: bands.map((b) => (b ? b.lower : null)), color: config.color },
        );
        break;
      }
      case "vwap": {
        const points = calculateDailyVwap(
          candles.map((c) => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume,
          })),
        );
        lines.push({
          values: points.map((p) => (Number.isFinite(p.value) ? p.value : null)),
          color: config.color,
          dashed: true,
        });
        break;
      }
      case "custom": {
        const series = customSeries(config, candles);
        if (series) lines.push({ values: series, color: config.color });
        break;
      }
      default:
        break;
    }
    return { pane, lines };
  }

  // sub panes
  switch (config.type) {
    case "rsi":
      return {
        pane,
        lines: [{ values: rsi(closes, config.period ?? 14), color: config.color }],
        range: { min: 0, max: 100 },
        levels: [30, 70],
      };
    case "stoch": {
      const points = stochastic(candles, config.k ?? 14, config.d ?? 3);
      return {
        pane,
        lines: [
          { values: points.map((p) => p.k), color: config.color },
          { values: points.map((p) => p.d), color: "#f59e0b", dashed: true },
        ],
        range: { min: 0, max: 100 },
        levels: [20, 80],
      };
    }
    case "macd": {
      const points = macd(closes, config.fast ?? 12, config.slow ?? 26, config.signal ?? 9);
      return {
        pane,
        lines: [
          { values: points.map((p) => p.macd), color: config.color },
          { values: points.map((p) => p.signal), color: "#f59e0b" },
        ],
        histogram: {
          values: points.map((p) => p.histogram),
          positiveColor: "hsl(142 71% 45% / 0.5)",
          negativeColor: "hsl(0 84% 60% / 0.5)",
        },
      };
    }
    case "atr":
      return { pane, lines: [{ values: atr(candles, config.period ?? 14), color: config.color }] };
    case "custom": {
      const series = customSeries(config, candles);
      return { pane, lines: series ? [{ values: series, color: config.color }] : [] };
    }
    default:
      return { pane, lines: [] };
  }
}
