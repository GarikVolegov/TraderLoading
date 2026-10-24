// ─── Drawing tool registry ───────────────────────────────────────────────────
// Shared by the left tool rail, the floating favorites bar and the settings
// dialog. Custom TradingView-grade vector icons match the reference toolbar.
import {
  Crosshair,
  Ruler,
  type LucideProps,
} from "lucide-react";
import { createElement, type ComponentType } from "react";

function TrendLineIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    createElement("line", { x1: 6.4, y1: 17.6, x2: 17.6, y2: 6.4 }),
    createElement("circle", { cx: 5, cy: 19, r: 2, fill: "none" }),
    createElement("circle", { cx: 19, cy: 5, r: 2, fill: "none" }),
  );
}

function RayLineIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    createElement("line", { x1: 6.4, y1: 17.6, x2: 20, y2: 4 }),
    createElement("circle", { cx: 5, cy: 19, r: 2, fill: "none" }),
    createElement("polyline", { points: "15 4 20 4 20 9" }),
  );
}

function HRayIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    createElement("circle", { cx: 5.5, cy: 12, r: 2, fill: "none" }),
    createElement("line", { x1: 7.5, y1: 12, x2: 20.5, y2: 12 }),
  );
}

function HLineIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    createElement("line", { x1: 3, y1: 12, x2: 10, y2: 12 }),
    createElement("circle", { cx: 12, cy: 12, r: 2, fill: "none" }),
    createElement("line", { x1: 14, y1: 12, x2: 21, y2: 12 }),
  );
}

function VLineIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    createElement("line", { x1: 12, y1: 3, x2: 12, y2: 10 }),
    createElement("circle", { cx: 12, cy: 12, r: 2, fill: "none" }),
    createElement("line", { x1: 12, y1: 14, x2: 12, y2: 21 }),
  );
}

/** 1. Freccia su (Arrow Mark Up) */
function ArrowUpMarkerIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinejoin: "round",
      ...props,
    },
    createElement("polygon", { points: "12 4.5 19.5 13.5 14.5 13.5 14.5 19.5 9.5 19.5 9.5 13.5 4.5 13.5" }),
  );
}

/** 2. Percorso (Path tool — multi-segment polyline with vertex circles & end arrow) */
function PathToolIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    createElement("line", { x1: 3.5, y1: 16.5, x2: 7.8, y2: 12.2 }),
    createElement("circle", { cx: 9.2, cy: 10.8, r: 1.8, fill: "none" }),
    createElement("line", { x1: 10.6, y1: 12, x2: 13.1, y2: 14.3 }),
    createElement("circle", { cx: 14.5, cy: 15.5, r: 1.8, fill: "none" }),
    createElement("line", { x1: 15.8, y1: 14.1, x2: 20.2, y2: 9.2 }),
    createElement("polyline", { points: "16.2 9.2 20.2 9.2 20.2 13.2" }),
  );
}

/** 3. Freccia giù (Arrow Mark Down) */
function ArrowDownMarkerIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinejoin: "round",
      ...props,
    },
    createElement("polygon", { points: "12 19.5 4.5 10.5 9.5 10.5 9.5 4.5 14.5 4.5 14.5 10.5 19.5 10.5" }),
  );
}

/** 4. Posizione Short (TradingView Short Position icon with S) */
function ShortPositionIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      ...props,
    },
    createElement("circle", { cx: 5.5, cy: 6, r: 1.7, fill: "none" }),
    createElement("line", { x1: 7.2, y1: 6, x2: 19.5, y2: 6 }),
    createElement("line", { x1: 5.5, y1: 10.8, x2: 19.5, y2: 10.8 }),
    createElement("circle", { cx: 5.5, cy: 18.2, r: 1.7, fill: "none" }),
    createElement("line", { x1: 7.2, y1: 18.2, x2: 19.5, y2: 18.2 }),
    createElement(
      "text",
      {
        x: 12.5,
        y: 16.3,
        textAnchor: "middle",
        fontSize: 6.4,
        fontWeight: 700,
        fill: "currentColor",
        stroke: "none",
        fontFamily: "system-ui, -apple-system, sans-serif",
      },
      "S",
    ),
  );
}

/** 5. Posizione Long (TradingView Long Position icon with L) */
function LongPositionIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      ...props,
    },
    createElement("circle", { cx: 5.5, cy: 6, r: 1.7, fill: "none" }),
    createElement("line", { x1: 7.2, y1: 6, x2: 19.5, y2: 6 }),
    createElement("line", { x1: 5.5, y1: 13.4, x2: 19.5, y2: 13.4 }),
    createElement("circle", { cx: 5.5, cy: 18.2, r: 1.7, fill: "none" }),
    createElement("line", { x1: 7.2, y1: 18.2, x2: 19.5, y2: 18.2 }),
    createElement(
      "text",
      {
        x: 12.5,
        y: 11.4,
        textAnchor: "middle",
        fontSize: 6.4,
        fontWeight: 700,
        fill: "currentColor",
        stroke: "none",
        fontFamily: "system-ui, -apple-system, sans-serif",
      },
      "L",
    ),
  );
}

/** 6. Rettangolo (Rectangle with 4 corner circles) */
function RectToolIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    createElement("line", { x1: 7.6, y1: 6, x2: 16.4, y2: 6 }),
    createElement("line", { x1: 18, y1: 7.6, x2: 18, y2: 16.4 }),
    createElement("line", { x1: 16.4, y1: 18, x2: 7.6, y2: 18 }),
    createElement("line", { x1: 6, y1: 16.4, x2: 6, y2: 7.6 }),
    createElement("circle", { cx: 6, cy: 6, r: 1.7, fill: "none" }),
    createElement("circle", { cx: 18, cy: 6, r: 1.7, fill: "none" }),
    createElement("circle", { cx: 6, cy: 18, r: 1.7, fill: "none" }),
    createElement("circle", { cx: 18, cy: 18, r: 1.7, fill: "none" }),
  );
}

/** 7. Freccia (Arrow with start/end circles and filled arrowhead) */
function ArrowToolIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    createElement("circle", { cx: 5.8, cy: 18.2, r: 1.7, fill: "none" }),
    createElement("line", { x1: 7, y1: 17, x2: 14.5, y2: 9.5 }),
    createElement("polygon", { points: "16.6 7.4 11.4 9.2 14.8 12.6", fill: "currentColor", stroke: "none" }),
    createElement("circle", { cx: 18.2, cy: 5.8, r: 1.7, fill: "none" }),
  );
}

/** 8. Testo (TradingView serif T icon) */
function TextToolIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    createElement("path", { d: "M6 8V5.5h12V8" }),
    createElement("line", { x1: 12, y1: 5.5, x2: 12, y2: 18.5 }),
    createElement("line", { x1: 9.2, y1: 18.5, x2: 14.8, y2: 18.5 }),
  );
}

/** 9. Profilo Volume Range Fisso (Fixed Range Volume Profile — FRVP) */
function FrvpToolIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    createElement("line", { x1: 6, y1: 4.5, x2: 6, y2: 16.2 }),
    createElement("circle", { cx: 6, cy: 18, r: 1.7, fill: "none" }),
    createElement("rect", { x: 6, y: 6.5, width: 3.5, height: 2.6 }),
    createElement("rect", { x: 6, y: 9.1, width: 6.2, height: 2.6 }),
    createElement("rect", { x: 6, y: 11.7, width: 2.8, height: 2.6 }),
    createElement("circle", { cx: 17.5, cy: 6, r: 1.7, fill: "none" }),
    createElement("line", { x1: 17.5, y1: 7.8, x2: 17.5, y2: 19.5 }),
  );
}

/** 10. Evidenziatore (Highlighter chisel marker icon) */
function HighlighterToolIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      ...props,
    },
    createElement("path", { d: "M15.5 4.5 L9.2 10.8 L8.5 14.5 L12.2 13.8 L18.5 7.5" }),
    createElement("path", { d: "M8.5 14.5 L5 18 L8.5 19.2 L12.2 13.8" }),
  );
}

function FibonacciIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    ...[4, 9, 15, 20].map((y) => createElement("line", { key: y, x1: 3, y1: y, x2: 21, y2: y })),
    createElement("line", { x1: 5, y1: 21, x2: 18, y2: 3, strokeOpacity: 0.6, strokeDasharray: "2 2" }),
  );
}

/** 11. Infolinea (Trendline with attached data card icon) */
function InfoLineIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    createElement("line", { x1: 5.5, y1: 18.5, x2: 17.5, y2: 6.5 }),
    createElement("circle", { cx: 4.5, cy: 19.5, r: 1.7, fill: "none" }),
    createElement("circle", { cx: 18.5, cy: 5.5, r: 1.7, fill: "none" }),
    createElement("rect", { x: 11.5, y: 12.5, width: 9, height: 6.5, rx: 1.2 }),
    createElement("line", { x1: 13.5, y1: 15, x2: 18.5, y2: 15 }),
    createElement("line", { x1: 13.5, y1: 17, x2: 16.8, y2: 17 }),
  );
}

/** 12. Canale Parallelo (Parallel Channel with midline) */
function ParallelChannelIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, ...props },
    createElement("line", { x1: 4, y1: 14, x2: 18, y2: 5 }),
    createElement("line", { x1: 6, y1: 19, x2: 20, y2: 10 }),
    createElement("line", { x1: 5, y1: 16.5, x2: 19, y2: 7.5, strokeDasharray: "2 2", strokeOpacity: 0.65 }),
    createElement("circle", { cx: 4, cy: 14, r: 1.6, fill: "none" }),
    createElement("circle", { cx: 18, cy: 5, r: 1.6, fill: "none" }),
    createElement("circle", { cx: 6, cy: 19, r: 1.6, fill: "none" }),
  );
}

/** 13. VWAP Ancorato (Anchored VWAP icon matching TradingView) */
function AnchoredVwapIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", ...props },
    createElement("line", { x1: 6, y1: 5, x2: 6, y2: 19 }),
    createElement("circle", { cx: 6, cy: 12, r: 2.1, fill: "none" }),
    createElement("path", { d: "M8.1 12 C 11 12, 12 7.5, 15.5 8.5 C 18 9.2, 19 6.5, 20.5 6" }),
    createElement("path", { d: "M8.1 12 C 11 12, 12.5 16, 16 15 C 18.5 14.2, 19.5 16.5, 20.5 17", strokeOpacity: 0.55, strokeDasharray: "2 2" }),
  );
}

/** 14. Nota Ancorata / Callout */
function CalloutIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinejoin: "round", ...props },
    createElement("path", { d: "M6 5h13a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 19 15H11l-5 4.5V15H6a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 6 5Z" }),
    createElement("circle", { cx: 5.5, cy: 19.5, r: 1.5, fill: "none" }),
  );
}

/** 15. Range Prezzo (Price Range vertical measurement) */
function PriceRangeIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", ...props },
    createElement("line", { x1: 5, y1: 5, x2: 19, y2: 5 }),
    createElement("line", { x1: 5, y1: 19, x2: 19, y2: 19 }),
    createElement("line", { x1: 12, y1: 5.5, x2: 12, y2: 18.5 }),
    createElement("polyline", { points: "9.5 8 12 5.5 14.5 8" }),
    createElement("polyline", { points: "9.5 16 12 18.5 14.5 16" }),
  );
}

/** 16. Range Data (Date Range horizontal measurement) */
function DateRangeIcon({ size = 24, strokeWidth = 1.6, ...props }: LucideProps) {
  return createElement(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth, strokeLinecap: "round", ...props },
    createElement("line", { x1: 5, y1: 5, x2: 5, y2: 19 }),
    createElement("line", { x1: 19, y1: 5, x2: 19, y2: 19 }),
    createElement("line", { x1: 5.5, y1: 12, x2: 18.5, y2: 12 }),
    createElement("polyline", { points: "8 9.5 5.5 12 8 14.5" }),
    createElement("polyline", { points: "16 9.5 18.5 12 16 14.5" }),
  );
}

export type DrawingToolId =
  | "cursor"
  | "arrowUp"
  | "path"
  | "arrowDown"
  | "shortPosition"
  | "longPosition"
  | "rect"
  | "arrow"
  | "text"
  | "frvp"
  | "highlighter"
  | "trend"
  | "ray"
  | "infoline"
  | "hray"
  | "hline"
  | "vline"
  | "parallelChannel"
  | "fib"
  | "avwap"
  | "callout"
  | "ruler"
  | "priceRange"
  | "dateRange";

export type DrawingToolCategoryId =
  | "lines"
  | "fib_channels"
  | "shapes_annotations"
  | "forecasting"
  | "volume_based"
  | "measurers";

export interface DrawingToolMeta {
  id: DrawingToolId;
  Icon: ComponentType<LucideProps>;
  labelKey: string;
  category?: DrawingToolCategoryId;
  shortcut?: string;
}

export interface DrawingToolCategoryMeta {
  id: DrawingToolCategoryId;
  titleIt: string;
  titleEn: string;
  tools: DrawingToolId[];
}

export const DRAWING_TOOL_CATEGORIES: DrawingToolCategoryMeta[] = [
  {
    id: "lines",
    titleIt: "LINEE DI TENDENZA",
    titleEn: "TREND LINES",
    tools: ["trend", "ray", "infoline", "hray", "hline", "vline", "arrow", "path"],
  },
  {
    id: "fib_channels",
    titleIt: "FIBONACCI E CANALI",
    titleEn: "FIBONACCI & CHANNELS",
    tools: ["fib", "parallelChannel"],
  },
  {
    id: "shapes_annotations",
    titleIt: "FORME E ANNOTAZIONI",
    titleEn: "SHAPES & ANNOTATIONS",
    tools: ["rect", "highlighter", "text", "callout", "arrowUp", "arrowDown"],
  },
  {
    id: "forecasting",
    titleIt: "PREVISIONI",
    titleEn: "FORECASTING",
    tools: ["longPosition", "shortPosition"],
  },
  {
    id: "volume_based",
    titleIt: "BASATO SUL VOLUME",
    titleEn: "VOLUME-BASED",
    tools: ["avwap", "frvp"],
  },
  {
    id: "measurers",
    titleIt: "MISURATORI",
    titleEn: "MEASURERS",
    tools: ["priceRange", "dateRange", "ruler"],
  },
];

export const DRAWING_TOOLS: DrawingToolMeta[] = [
  { id: "cursor", Icon: Crosshair, labelKey: "backtest_terminal.tool_cursor", shortcut: "Esc" },
  { id: "arrowUp", Icon: ArrowUpMarkerIcon, labelKey: "backtest_terminal.tool_arrowUp", category: "shapes_annotations" },
  { id: "path", Icon: PathToolIcon, labelKey: "backtest_terminal.tool_path", category: "lines" },
  { id: "arrowDown", Icon: ArrowDownMarkerIcon, labelKey: "backtest_terminal.tool_arrowDown", category: "shapes_annotations" },
  { id: "shortPosition", Icon: ShortPositionIcon, labelKey: "backtest_terminal.tool_short", category: "forecasting" },
  { id: "longPosition", Icon: LongPositionIcon, labelKey: "backtest_terminal.tool_long", category: "forecasting" },
  { id: "rect", Icon: RectToolIcon, labelKey: "backtest_terminal.tool_rect", category: "shapes_annotations", shortcut: "Alt+R" },
  { id: "arrow", Icon: ArrowToolIcon, labelKey: "backtest_terminal.tool_arrow", category: "lines" },
  { id: "text", Icon: TextToolIcon, labelKey: "backtest_terminal.tool_text", category: "shapes_annotations", shortcut: "Alt+T" },
  { id: "frvp", Icon: FrvpToolIcon, labelKey: "backtest_terminal.tool_frvp", category: "volume_based" },
  { id: "highlighter", Icon: HighlighterToolIcon, labelKey: "backtest_terminal.tool_highlighter", category: "shapes_annotations" },
  { id: "trend", Icon: TrendLineIcon, labelKey: "backtest_terminal.tool_trend", category: "lines", shortcut: "Alt+T" },
  { id: "ray", Icon: RayLineIcon, labelKey: "backtest_terminal.tool_ray", category: "lines" },
  { id: "infoline", Icon: InfoLineIcon, labelKey: "backtest_terminal.tool_infoline", category: "lines" },
  { id: "hray", Icon: HRayIcon, labelKey: "backtest_terminal.tool_hray", category: "lines", shortcut: "Alt+J" },
  { id: "hline", Icon: HLineIcon, labelKey: "backtest_terminal.tool_hline", category: "lines", shortcut: "Alt+H" },
  { id: "vline", Icon: VLineIcon, labelKey: "backtest_terminal.tool_vline", category: "lines", shortcut: "Alt+V" },
  { id: "parallelChannel", Icon: ParallelChannelIcon, labelKey: "backtest_terminal.tool_parallelChannel", category: "fib_channels" },
  { id: "fib", Icon: FibonacciIcon, labelKey: "backtest_terminal.tool_fib", category: "fib_channels", shortcut: "Alt+F" },
  { id: "avwap", Icon: AnchoredVwapIcon, labelKey: "backtest_terminal.tool_avwap", category: "volume_based" },
  { id: "callout", Icon: CalloutIcon, labelKey: "backtest_terminal.tool_callout", category: "shapes_annotations" },
  { id: "ruler", Icon: Ruler, labelKey: "backtest_terminal.tool_ruler", category: "measurers", shortcut: "Shift+Click" },
  { id: "priceRange", Icon: PriceRangeIcon, labelKey: "backtest_terminal.tool_priceRange", category: "measurers" },
  { id: "dateRange", Icon: DateRangeIcon, labelKey: "backtest_terminal.tool_dateRange", category: "measurers" },
];
