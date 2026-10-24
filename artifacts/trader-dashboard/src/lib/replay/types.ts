// ─── Replay terminal — shared vocabulary ─────────────────────────────────────
// Pure types shared by the replay engine modules (cursor, trade engine, account,
// journal, persistence) and by the terminal UI. No DOM, no chart-library types.

export type ReplayCandle = {
  time: number; // unix seconds, bar open
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type TradeDirection = "buy" | "sell";

export type ExitReason = "sl" | "tp" | "manual";

export type TradeResult = "win" | "loss" | "breakeven";

export interface OpenPosition {
  id?: string;
  direction: TradeDirection;
  entryPrice: number;
  /** Unix seconds of the bar the position was opened on (overlay x-anchor). */
  entryTime: number;
  stopLoss: number;
  takeProfit: number;
  lots: number;
  /** Initial lot size before any partial closes. */
  initialLots?: number;
  /** Account-currency amount risked when the position was sized. */
  riskAmount: number;
  /** Monetary risk measured once at entry after lot rounding. Never inferred on reload. */
  initialRiskAmount?: number;
  /** Absolute stop distance in pips (magnitude); 0 once the stop trails to entry. */
  slPips: number;
  tpPips: number;
  /** Whether a stop is armed. Distinct from slPips, which is 0 at breakeven yet still armed. */
  hasStop: boolean;
  /** Stop distance at entry (risk unit for MAE/MFE/BE triggers); slPips changes when the stop is dragged/trailed. */
  initialSlPips?: number;
  /** Running best favorable excursion in pips (≥ 0). */
  bestPips?: number;
  /** Running worst adverse excursion in pips (≤ 0). */
  worstPips?: number;
  /** True once auto-breakeven moved the stop to entry. */
  breakevenApplied?: boolean;
  /** Realized profit banked from partial closes on this position. */
  realizedPartialProfit?: number;
  /** Number of partial scale-outs executed. */
  partialCount?: number;
}

export interface ClosedTrade {
  id: number;
  /** Durable save identity, unique across tabs and unchanged by retries. */
  syncId?: string;
  positionId?: string;
  isPartial?: boolean;
  direction: TradeDirection;
  entryPrice: number;
  exitPrice: number;
  entryTime: number;
  exitTime: number;
  stopLoss: number;
  takeProfit: number;
  lots: number;
  /** Signed pips (positive = profit). */
  pips: number;
  /** Signed account-currency P&L. */
  profit: number;
  /** Immutable monetary entry risk; absent for incomplete legacy trades. */
  initialRiskAmount?: number | null;
  /** Signed R multiple (profit measured in risk units), null when unsized (slPips <= 0). */
  rMultiple: number | null;
  exitReason: ExitReason;
  result: TradeResult;
  /** Max adverse excursion in R (positive magnitude), null when unsized. */
  maeR?: number | null;
  /** Max favorable excursion in R (positive magnitude), null when unsized. */
  mfeR?: number | null;
  /** Free-form setup tags the user attaches after the fact (journal review). */
  tags?: string[];
  /** Free-form note for the trade. */
  note?: string;
  /** Execution cost (spread + commission) deducted from gross profit. */
  cost?: number;
}

export type RiskMode = "percent" | "fixed";

export type PendingOrderKind = "limit" | "stop";

/** A resting order that becomes an OpenPosition when price reaches its level. */
export interface PendingOrder {
  id?: string;
  direction: TradeDirection;
  kind: PendingOrderKind;
  /** Trigger price where the order fills. */
  price: number;
  /** Stop-loss / take-profit distances applied at fill. */
  slPips: number;
  tpPips: number;
  stopLoss?: number;
  takeProfit?: number;
  lots: number;
  riskAmount: number;
  /** Unix seconds of the bar the order was placed on (overlay x-anchor). */
  placedTime: number;
}

/** A drawing point anchored to chart data (not pixels). */
export type DrawingPoint = { time: number; price: number };

export type DrawingStyle = "solid" | "dashed" | "dotted";

export interface DrawingTimeframeRange {
  enabled: boolean;
  min: number;
  max: number;
}

/** Multi-timeframe visibility rules matching TradingView's Visibilità tab. */
export interface DrawingVisibilityConfig {
  ticks: boolean;
  seconds: DrawingTimeframeRange;
  minutes: DrawingTimeframeRange;
  hours: DrawingTimeframeRange;
  days: DrawingTimeframeRange;
  weeks: DrawingTimeframeRange;
  months: DrawingTimeframeRange;
  ranges: boolean;
}

export interface FibLevelConfig {
  level: number;
  enabled: boolean;
  color?: string;
}

export interface DrawingCommonMeta {
  locked?: boolean;
  hidden?: boolean;
  visibility?: DrawingVisibilityConfig;
  templateName?: string;
}

export type ReplayDrawing = DrawingCommonMeta & (
  | {
      id: string;
      kind: "trend";
      a: DrawingPoint;
      b: DrawingPoint;
      color: string;
      width: number;
      style?: DrawingStyle;
      extendLeft?: boolean;
      extendRight?: boolean;
      showPriceLabels?: boolean;
      showAngle?: boolean;
      showStats?: boolean;
      text?: string;
    }
  | {
      id: string;
      kind: "ray";
      a: DrawingPoint;
      b: DrawingPoint;
      color: string;
      width: number;
      style?: DrawingStyle;
      showPriceLabels?: boolean;
      text?: string;
    }
  | {
      id: string;
      kind: "infoline";
      a: DrawingPoint;
      b: DrawingPoint;
      color: string;
      width: number;
      style?: DrawingStyle;
      extendLeft?: boolean;
      extendRight?: boolean;
      showStats?: boolean;
      showAngle?: boolean;
      showPriceChange?: boolean;
      showBarsRange?: boolean;
      text?: string;
    }
  | {
      id: string;
      kind: "hray";
      at: DrawingPoint;
      color: string;
      width: number;
      style?: DrawingStyle;
      text?: string;
      showPriceLabel?: boolean;
    }
  | {
      id: string;
      kind: "arrow";
      a: DrawingPoint;
      b: DrawingPoint;
      color: string;
      width: number;
      style?: DrawingStyle;
      text?: string;
    }
  | {
      id: string;
      kind: "arrowUp";
      at: DrawingPoint;
      color: string;
      width: number;
      text?: string;
    }
  | {
      id: string;
      kind: "arrowDown";
      at: DrawingPoint;
      color: string;
      width: number;
      text?: string;
    }
  | {
      id: string;
      kind: "path";
      points: DrawingPoint[];
      color: string;
      width: number;
      style?: DrawingStyle;
    }
  | {
      id: string;
      kind: "highlighter";
      points: DrawingPoint[];
      color: string;
      width: number;
      fillOpacity?: number;
    }
  | {
      id: string;
      kind: "frvp";
      a: DrawingPoint;
      b: DrawingPoint;
      color: string;
      width: number;
      rows?: number;
      valueAreaPct?: number;
      volumeMode?: "total" | "up_down" | "delta";
      extendRight?: boolean;
      showProfile?: boolean;
      showValues?: boolean;
      valuesColor?: string;
      widthPct?: number;
      placement?: "left" | "right";
      upVolumeColor?: string;
      downVolumeColor?: string;
      vaUpColor?: string;
      vaDownColor?: string;
      showVah?: boolean;
      vahColor?: string;
      vahStyle?: DrawingStyle;
      vahWidth?: number;
      showVal?: boolean;
      valColor?: string;
      valStyle?: DrawingStyle;
      valWidth?: number;
      showPoc?: boolean;
      pocColor?: string;
      pocStyle?: DrawingStyle;
      pocWidth?: number;
      showDevelopingPoc?: boolean;
      developingPocColor?: string;
      developingPocStyle?: DrawingStyle;
      showDevelopingVa?: boolean;
      developingVaColor?: string;
      developingVaStyle?: DrawingStyle;
      histogramBoxColor?: string;
    }
  | {
      id: string;
      kind: "avwap";
      at: DrawingPoint;
      color: string;
      width: number;
      style?: DrawingStyle;
      showBands?: boolean;
      bandMultiplier?: number;
      bandColor?: string;
      fillOpacity?: number;
      source?: "hlc3" | "ohlc4" | "close" | "hl2";
    }
  | {
      id: string;
      kind: "parallelChannel";
      a: DrawingPoint;
      b: DrawingPoint;
      priceOffset?: number;
      color: string;
      width: number;
      style?: DrawingStyle;
      fillOpacity?: number;
      showMidline?: boolean;
      extendLeft?: boolean;
      extendRight?: boolean;
    }
  | {
      id: string;
      kind: "vline";
      time: number;
      color: string;
      width: number;
      style?: DrawingStyle;
      text?: string;
    }
  | {
      id: string;
      kind: "hline";
      price: number;
      color: string;
      width: number;
      style?: DrawingStyle;
      text?: string;
      showPriceLabel?: boolean;
    }
  | {
      id: string;
      kind: "rect";
      a: DrawingPoint;
      b: DrawingPoint;
      color: string;
      width: number;
      fillOpacity?: number;
      style?: DrawingStyle;
      showMidline?: boolean;
      extendLeft?: boolean;
      extendRight?: boolean;
      text?: string;
      zonePreset?: "custom" | "fvg" | "ob" | "liquidity" | "breaker" | "session";
    }
  | {
      id: string;
      kind: "fib";
      a: DrawingPoint;
      b: DrawingPoint;
      color: string;
      width: number;
      style?: DrawingStyle;
      extendLeft?: boolean;
      extendRight?: boolean;
      showPrices?: boolean;
      showPercents?: boolean;
      reverse?: boolean;
      fillOpacity?: number;
      levels?: FibLevelConfig[];
    }
  | {
      id: string;
      kind: "ruler";
      a: DrawingPoint;
      b: DrawingPoint;
      color?: string;
      fillOpacity?: number;
    }
  | {
      id: string;
      kind: "priceRange";
      a: DrawingPoint;
      b: DrawingPoint;
      color: string;
      width: number;
      fillOpacity?: number;
    }
  | {
      id: string;
      kind: "dateRange";
      a: DrawingPoint;
      b: DrawingPoint;
      color: string;
      width: number;
      fillOpacity?: number;
    }
  | {
      id: string;
      kind: "text";
      at: DrawingPoint;
      text: string;
      color: string;
      fontSize?: number;
      backgroundColor?: string;
      borderColor?: string;
      bold?: boolean;
    }
  | {
      id: string;
      kind: "callout";
      at: DrawingPoint;
      boxAt?: DrawingPoint;
      text: string;
      color: string;
      fontSize?: number;
      backgroundColor?: string;
    }
  | {
      id: string;
      kind: "position";
      direction: TradeDirection;
      entry: DrawingPoint;
      slPrice: number;
      tpPrice: number;
      endTime?: number;
      color?: string;
      stopColor?: string;
      targetColor?: string;
      fillOpacity?: number;
      accountSize?: number;
      riskPct?: number;
      showStats?: boolean;
      compactLabels?: boolean;
    }
);

export type ReplayDrawingKind = ReplayDrawing["kind"];

export type ChartType = "candles" | "heikin" | "bars" | "line" | "area";
