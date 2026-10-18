// ─── Drawing tool registry ───────────────────────────────────────────────────
// Shared by the left tool rail and the settings dialog (visibility toggles).
// The active tool drives the DrawingsOverlay interaction mode.
import {
  ArrowDownRight,
  ArrowUpRight,
  Crosshair,
  Minus,
  Ruler,
  Square,
  Type,
  type LucideProps,
} from "lucide-react";
import { createElement, type ComponentType } from "react";

function TrendLineIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    createElement("line", { x1: 5, y1: 19, x2: 19, y2: 5 }),
    createElement("circle", { cx: 5, cy: 19, r: 2, fill: "var(--btm-cbg)" }),
    createElement("circle", { cx: 19, cy: 5, r: 2, fill: "var(--btm-cbg)" }));
}

function FibonacciIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    ...[4, 9, 15, 20].map((y) => createElement("line", { key: y, x1: 3, y1: y, x2: 21, y2: y })),
    createElement("line", { x1: 5, y1: 21, x2: 18, y2: 3, strokeOpacity: 0.6, strokeDasharray: "2 2" }));
}

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
  Icon: ComponentType<LucideProps>;
  labelKey: string;
}

export const DRAWING_TOOLS: DrawingToolMeta[] = [
  { id: "cursor", Icon: Crosshair, labelKey: "backtest_terminal.tool_cursor" },
  { id: "trend", Icon: TrendLineIcon, labelKey: "backtest_terminal.tool_trend" },
  { id: "hline", Icon: Minus, labelKey: "backtest_terminal.tool_hline" },
  { id: "rect", Icon: Square, labelKey: "backtest_terminal.tool_rect" },
  { id: "fib", Icon: FibonacciIcon, labelKey: "backtest_terminal.tool_fib" },
  { id: "ruler", Icon: Ruler, labelKey: "backtest_terminal.tool_ruler" },
  { id: "longPosition", Icon: ArrowUpRight, labelKey: "backtest_terminal.tool_long" },
  { id: "shortPosition", Icon: ArrowDownRight, labelKey: "backtest_terminal.tool_short" },
  { id: "text", Icon: Type, labelKey: "backtest_terminal.tool_text" },
];
