// ─── Drawing tool registry ───────────────────────────────────────────────────
// Shared by the left tool rail and the settings dialog (visibility toggles).
// The active tool drives the DrawingsOverlay interaction mode.
import {
  ArrowDownRight,
  ArrowUpRight,
  Crosshair,
  GitCommitHorizontal,
  Minus,
  Ruler,
  Square,
  TrendingUp,
  Type,
  type LucideIcon,
} from "lucide-react";

export type DrawingToolId =
  | "cursor"
  | "trend"
  | "hline"
  | "rect"
  | "fib"
  | "ruler"
  | "longPosition"
  | "shortPosition"
  | "text";

export interface DrawingToolMeta {
  id: DrawingToolId;
  Icon: LucideIcon;
  labelKey: string;
}

export const DRAWING_TOOLS: DrawingToolMeta[] = [
  { id: "cursor", Icon: Crosshair, labelKey: "backtest_terminal.tool_cursor" },
  { id: "trend", Icon: TrendingUp, labelKey: "backtest_terminal.tool_trend" },
  { id: "hline", Icon: Minus, labelKey: "backtest_terminal.tool_hline" },
  { id: "rect", Icon: Square, labelKey: "backtest_terminal.tool_rect" },
  { id: "fib", Icon: GitCommitHorizontal, labelKey: "backtest_terminal.tool_fib" },
  { id: "ruler", Icon: Ruler, labelKey: "backtest_terminal.tool_ruler" },
  { id: "longPosition", Icon: ArrowUpRight, labelKey: "backtest_terminal.tool_long" },
  { id: "shortPosition", Icon: ArrowDownRight, labelKey: "backtest_terminal.tool_short" },
  { id: "text", Icon: Type, labelKey: "backtest_terminal.tool_text" },
];
