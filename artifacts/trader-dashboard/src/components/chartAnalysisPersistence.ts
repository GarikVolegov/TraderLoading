import {
  DEFAULT_CHART_ANALYSIS_STATE,
  DEFAULT_DRAWING_STYLE,
  DEFAULT_FIBONACCI_LEVELS,
  DEFAULT_SESSION_BOX_SETTINGS,
  DEFAULT_MOVING_AVERAGES,
  DEFAULT_VOLUME_PROFILE_SETTINGS,
  DEFAULT_VWAP_SETTINGS,
  type ChartAnalysisState,
  type ChartDrawing,
  type DrawingStyle,
  type MovingAverageSettings,
  type SessionBoxSettings,
  type VolumeProfileSettings,
  type VwapSettings,
} from "./chartAnalysisTypes";

interface PersistedAnalysisState extends ChartAnalysisState {
  version: 1;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseStyle(value: unknown): DrawingStyle {
  const style = value as Partial<DrawingStyle>;
  if (!style || typeof style !== "object") return DEFAULT_DRAWING_STYLE;
  return {
    stroke: typeof style.stroke === "string" ? style.stroke : DEFAULT_DRAWING_STYLE.stroke,
    strokeWidth: finiteNumber(style.strokeWidth) ? clamp(style.strokeWidth, 1, 8) : DEFAULT_DRAWING_STYLE.strokeWidth,
    opacity: finiteNumber(style.opacity) ? clamp(style.opacity, 0, 1) : DEFAULT_DRAWING_STYLE.opacity,
    lineStyle: style.lineStyle === "dashed" || style.lineStyle === "dotted" || style.lineStyle === "solid" ? style.lineStyle : DEFAULT_DRAWING_STYLE.lineStyle,
    fill: typeof style.fill === "string" ? style.fill : DEFAULT_DRAWING_STYLE.fill,
    fillOpacity: finiteNumber(style.fillOpacity) ? clamp(style.fillOpacity, 0, 1) : DEFAULT_DRAWING_STYLE.fillOpacity,
  };
}

function isPoint(value: unknown): value is ChartDrawing["points"][number] {
  const point = value as Partial<ChartDrawing["points"][number]>;
  return Boolean(point && (typeof point.time === "number" || typeof point.time === "string") && finiteNumber(point.price));
}

function parseDrawing(value: unknown): ChartDrawing | null {
  const drawing = value as Partial<ChartDrawing>;
  if (!drawing || typeof drawing !== "object") return null;
  if (typeof drawing.id !== "string" || typeof drawing.createdAt !== "string") return null;
  if (drawing.kind !== "line" && drawing.kind !== "rectangle" && drawing.kind !== "fibonacci") return null;
  if (!Array.isArray(drawing.points) || drawing.points.length !== 2 || !drawing.points.every(isPoint)) return null;
  const common = {
    id: drawing.id,
    points: drawing.points as ChartDrawing["points"],
    style: parseStyle(drawing.style),
    createdAt: drawing.createdAt,
  };
  if (drawing.kind === "fibonacci") {
    const levels = Array.isArray((drawing as Partial<Extract<ChartDrawing, { kind: "fibonacci" }>>).levels)
      ? (drawing as Partial<Extract<ChartDrawing, { kind: "fibonacci" }>>).levels!.filter(finiteNumber)
      : DEFAULT_FIBONACCI_LEVELS;
    return { ...common, kind: "fibonacci", levels };
  }
  return { ...common, kind: drawing.kind };
}

function parseVwap(value: unknown): VwapSettings {
  const vwap = value as Partial<VwapSettings>;
  return {
    enabled: typeof vwap?.enabled === "boolean" ? vwap.enabled : DEFAULT_VWAP_SETTINGS.enabled,
    color: typeof vwap?.color === "string" ? vwap.color : DEFAULT_VWAP_SETTINGS.color,
    lineWidth: finiteNumber(vwap?.lineWidth) ? clamp(Math.floor(vwap.lineWidth), 1, 5) : DEFAULT_VWAP_SETTINGS.lineWidth,
  };
}

function parseMovingAverages(value: unknown): MovingAverageSettings[] {
  if (!Array.isArray(value)) return DEFAULT_MOVING_AVERAGES;
  const parsed = value
    .map((item): MovingAverageSettings | null => {
      const ma = item as Partial<MovingAverageSettings>;
      if (!ma || typeof ma.id !== "string") return null;
      return {
        id: ma.id,
        type: ma.type === "sma" ? "sma" : "ema",
        period: finiteNumber(ma.period) ? clamp(Math.floor(ma.period), 1, 500) : 50,
        color: typeof ma.color === "string" ? ma.color : "#38bdf8",
        enabled: typeof ma.enabled === "boolean" ? ma.enabled : false,
      };
    })
    .filter((ma): ma is MovingAverageSettings => ma != null);
  return parsed.length > 0 ? parsed : DEFAULT_MOVING_AVERAGES;
}

function parseVolumeProfile(value: unknown): VolumeProfileSettings {
  const profile = value as Partial<VolumeProfileSettings>;
  return {
    ...DEFAULT_VOLUME_PROFILE_SETTINGS,
    ...(profile && typeof profile === "object" ? profile : {}),
    enabled: typeof profile?.enabled === "boolean" ? profile.enabled : DEFAULT_VOLUME_PROFILE_SETTINGS.enabled,
    rows: finiteNumber(profile?.rows) ? clamp(Math.floor(profile.rows), 4, 100) : DEFAULT_VOLUME_PROFILE_SETTINGS.rows,
    valueAreaPercent: finiteNumber(profile?.valueAreaPercent) ? clamp(profile.valueAreaPercent, 1, 100) : DEFAULT_VOLUME_PROFILE_SETTINGS.valueAreaPercent,
    opacity: finiteNumber(profile?.opacity) ? clamp(profile.opacity, 0, 1) : DEFAULT_VOLUME_PROFILE_SETTINGS.opacity,
    width: finiteNumber(profile?.width) ? clamp(profile.width, 48, 220) : DEFAULT_VOLUME_PROFILE_SETTINGS.width,
    side: profile?.side === "left" || profile?.side === "right" ? profile.side : DEFAULT_VOLUME_PROFILE_SETTINGS.side,
  };
}

function parseSession(value: unknown, fallback: SessionBoxSettings): SessionBoxSettings {
  const session = value as Partial<SessionBoxSettings>;
  return {
    enabled: typeof session?.enabled === "boolean" ? session.enabled : fallback.enabled,
    label: typeof session?.label === "string" ? session.label : fallback.label,
    color: typeof session?.color === "string" ? session.color : fallback.color,
    opacity: finiteNumber(session?.opacity) ? clamp(session.opacity, 0, 1) : fallback.opacity,
    showBorders: typeof session?.showBorders === "boolean" ? session.showBorders : fallback.showBorders,
  };
}

function normalizeState(data: Partial<PersistedAnalysisState>): ChartAnalysisState {
  const indicators = data.indicators ?? DEFAULT_CHART_ANALYSIS_STATE.indicators;
  const sessions = data.sessionBoxes ?? DEFAULT_CHART_ANALYSIS_STATE.sessionBoxes;
  return {
    indicators: {
      vwap: parseVwap(indicators.vwap),
      volumeProfile: parseVolumeProfile(indicators.volumeProfile),
      movingAverages: parseMovingAverages(indicators.movingAverages),
    },
    sessionBoxes: {
      asia: parseSession(sessions.asia, DEFAULT_SESSION_BOX_SETTINGS.asia),
      london: parseSession(sessions.london, DEFAULT_SESSION_BOX_SETTINGS.london),
      newYork: parseSession(sessions.newYork, DEFAULT_SESSION_BOX_SETTINGS.newYork),
    },
    drawings: Array.isArray(data.drawings) ? data.drawings.map(parseDrawing).filter((drawing): drawing is ChartDrawing => drawing != null) : [],
    defaultDrawingStyle: parseStyle(data.defaultDrawingStyle),
    activeTool: data.activeTool === "line" || data.activeTool === "rectangle" || data.activeTool === "fibonacci" ? data.activeTool : "select",
    selectedDrawingId: typeof data.selectedDrawingId === "string" ? data.selectedDrawingId : null,
  };
}

export function serializeAnalysisState(state: ChartAnalysisState): string {
  const payload: PersistedAnalysisState = {
    version: 1,
    ...normalizeState(state as Partial<PersistedAnalysisState>),
    selectedDrawingId: null,
  };
  return JSON.stringify(payload);
}

export function parseAnalysisState(raw: string | null | undefined): ChartAnalysisState {
  if (!raw) return DEFAULT_CHART_ANALYSIS_STATE;
  try {
    const data = JSON.parse(raw) as Partial<PersistedAnalysisState>;
    if (data.version !== 1) return DEFAULT_CHART_ANALYSIS_STATE;
    return normalizeState(data);
  } catch {
    return DEFAULT_CHART_ANALYSIS_STATE;
  }
}

export function createDrawing(kind: ChartDrawing["kind"], points: ChartDrawing["points"], style: DrawingStyle): ChartDrawing {
  const common = {
    id: crypto.randomUUID(),
    points,
    style,
    createdAt: new Date().toISOString(),
  };
  return kind === "fibonacci" ? { ...common, kind, levels: DEFAULT_FIBONACCI_LEVELS } : { ...common, kind };
}
