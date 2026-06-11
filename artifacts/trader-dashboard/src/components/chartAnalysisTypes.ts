import type { Time } from "lightweight-charts";

export type DrawingTool = "select" | "line" | "rectangle" | "fibonacci";
export type DrawingLineStyle = "solid" | "dashed" | "dotted";
export type SessionBoxId = "asia" | "london" | "newYork";

export interface ChartPoint {
  time: Time;
  price: number;
}

export interface DrawingStyle {
  stroke: string;
  strokeWidth: number;
  opacity: number;
  lineStyle: DrawingLineStyle;
  fill: string;
  fillOpacity: number;
}

export interface DrawingCore {
  id: string;
  points: [ChartPoint, ChartPoint];
  style: DrawingStyle;
  createdAt: string;
}

export interface BaseDrawing extends DrawingCore {
  kind: "line" | "rectangle";
}

export interface FibonacciDrawing extends DrawingCore {
  kind: "fibonacci";
  levels: number[];
}

export type ChartDrawing = BaseDrawing | FibonacciDrawing;

export interface VwapSettings {
  enabled: boolean;
  color: string;
  lineWidth: number;
}

export interface VolumeProfileSettings {
  enabled: boolean;
  rows: number;
  valueAreaPercent: number;
  opacity: number;
  side: "right" | "left";
  width: number;
  barColor: string;
  valueAreaColor: string;
  pocColor: string;
}

export interface SessionBoxSettings {
  enabled: boolean;
  label: string;
  color: string;
  opacity: number;
  showBorders: boolean;
}

export interface ChartIndicatorSettings {
  vwap: VwapSettings;
  volumeProfile: VolumeProfileSettings;
}

export interface ChartAnalysisState {
  indicators: ChartIndicatorSettings;
  sessionBoxes: Record<SessionBoxId, SessionBoxSettings>;
  drawings: ChartDrawing[];
  defaultDrawingStyle: DrawingStyle;
  activeTool: DrawingTool;
  selectedDrawingId: string | null;
}

export const DEFAULT_FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  stroke: "#f8fafc",
  strokeWidth: 2,
  opacity: 0.92,
  lineStyle: "solid",
  fill: "#4ca973",
  fillOpacity: 0.12,
};

export const DEFAULT_VWAP_SETTINGS: VwapSettings = {
  enabled: true,
  color: "#f59e0b",
  lineWidth: 2,
};

export const DEFAULT_VOLUME_PROFILE_SETTINGS: VolumeProfileSettings = {
  enabled: true,
  rows: 28,
  valueAreaPercent: 70,
  opacity: 0.38,
  side: "right",
  width: 112,
  barColor: "#64748b",
  valueAreaColor: "#38bdf8",
  pocColor: "#f97316",
};

export const DEFAULT_SESSION_BOX_SETTINGS: Record<SessionBoxId, SessionBoxSettings> = {
  asia: {
    enabled: true,
    label: "Asia",
    color: "#22d3ee",
    opacity: 0.08,
    showBorders: true,
  },
  london: {
    enabled: true,
    label: "London",
    color: "#a3e635",
    opacity: 0.07,
    showBorders: true,
  },
  newYork: {
    enabled: true,
    label: "New York",
    color: "#fb7185",
    opacity: 0.07,
    showBorders: true,
  },
};

export const DEFAULT_CHART_ANALYSIS_STATE: ChartAnalysisState = {
  indicators: {
    vwap: DEFAULT_VWAP_SETTINGS,
    volumeProfile: DEFAULT_VOLUME_PROFILE_SETTINGS,
  },
  sessionBoxes: DEFAULT_SESSION_BOX_SETTINGS,
  drawings: [],
  defaultDrawingStyle: DEFAULT_DRAWING_STYLE,
  activeTool: "select",
  selectedDrawingId: null,
};
