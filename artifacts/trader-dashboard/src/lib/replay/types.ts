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
  direction: TradeDirection;
  entryPrice: number;
  /** Unix seconds of the bar the position was opened on (overlay x-anchor). */
  entryTime: number;
  stopLoss: number;
  takeProfit: number;
  lots: number;
  /** Account-currency amount risked when the position was sized. */
  riskAmount: number;
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
}

export interface ClosedTrade {
  id: number;
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
  direction: TradeDirection;
  kind: PendingOrderKind;
  /** Trigger price where the order fills. */
  price: number;
  /** Stop-loss / take-profit distances applied at fill. */
  slPips: number;
  tpPips: number;
  lots: number;
  riskAmount: number;
  /** Unix seconds of the bar the order was placed on (overlay x-anchor). */
  placedTime: number;
}

/** A drawing point anchored to chart data (not pixels). */
export type DrawingPoint = { time: number; price: number };

export type ReplayDrawing =
  | { id: string; kind: "trend"; a: DrawingPoint; b: DrawingPoint; color: string; width: number }
  | { id: string; kind: "hline"; price: number; color: string; width: number }
  | { id: string; kind: "rect"; a: DrawingPoint; b: DrawingPoint; color: string; width: number }
  | { id: string; kind: "fib"; a: DrawingPoint; b: DrawingPoint; color: string; width: number }
  | { id: string; kind: "ruler"; a: DrawingPoint; b: DrawingPoint }
  | { id: string; kind: "text"; at: DrawingPoint; text: string; color: string }
  | {
      id: string;
      kind: "position";
      direction: TradeDirection;
      entry: DrawingPoint;
      slPrice: number;
      tpPrice: number;
    };

export type ReplayDrawingKind = ReplayDrawing["kind"];

export type ChartType = "candles" | "heikin" | "line";
