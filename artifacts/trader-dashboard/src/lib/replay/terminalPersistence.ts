// ─── Terminal state persistence (localStorage, v2) ───────────────────────────
// Per-session replay state: cursor, indicators, drawings, order-ticket inputs,
// tool settings, account and trades. Versioned and symbol-guarded like the v1
// chartReplayPersistence it supersedes; malformed entries degrade field-by-field
// instead of discarding the whole state.
import type { IndicatorConfig } from "./indicatorCatalog";
import type { ChartType, ClosedTrade, OpenPosition, ReplayDrawing, RiskMode } from "./types";

export interface TerminalTicket {
  riskMode: RiskMode;
  riskValue: number;
  slPips: number;
  tpPips: number;
}

export interface TerminalSettings {
  chartType: ChartType;
  showSessions: boolean;
  magnet: boolean;
  toolColor: string;
  toolWidth: number;
  /** Rail visibility per drawing tool id (missing = visible). */
  visibleTools: Record<string, boolean>;
}

export const DEFAULT_TICKET: TerminalTicket = {
  riskMode: "percent",
  riskValue: 1,
  slPips: 20,
  tpPips: 40,
};

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  chartType: "candles",
  showSessions: false,
  magnet: true,
  toolColor: "#3b82f6",
  toolWidth: 2,
  visibleTools: {},
};

export interface TerminalStateDraft {
  symbol: string;
  interval: string;
  /** Unix seconds of the bar the cursor is on (null = start fresh). */
  cursorTime: number | null;
  indicators: IndicatorConfig[];
  drawings: ReplayDrawing[];
  trades: ClosedTrade[];
  openPosition: OpenPosition | null;
  ticket: TerminalTicket;
  settings: TerminalSettings;
  initialBalance: number;
}

export interface PersistedTerminalState extends TerminalStateDraft {
  version: 2;
  savedAt: string;
}

export function createTerminalStorageKey(sessionKey: string): string {
  return `traderloading:backtest-terminal:${sessionKey}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isClosedTrade(value: unknown): value is ClosedTrade {
  const trade = value as Partial<ClosedTrade> | null;
  return Boolean(
    trade &&
      isFiniteNumber(trade.id) &&
      (trade.direction === "buy" || trade.direction === "sell") &&
      isFiniteNumber(trade.entryPrice) &&
      isFiniteNumber(trade.exitPrice) &&
      isFiniteNumber(trade.entryTime) &&
      isFiniteNumber(trade.exitTime) &&
      isFiniteNumber(trade.pips) &&
      isFiniteNumber(trade.profit) &&
      (trade.rMultiple === null || isFiniteNumber(trade.rMultiple)) &&
      (trade.exitReason === "sl" || trade.exitReason === "tp" || trade.exitReason === "manual") &&
      (trade.result === "win" || trade.result === "loss" || trade.result === "breakeven"),
  );
}

function isOpenPosition(value: unknown): value is OpenPosition {
  const position = value as Partial<OpenPosition> | null;
  return Boolean(
    position &&
      (position.direction === "buy" || position.direction === "sell") &&
      isFiniteNumber(position.entryPrice) &&
      isFiniteNumber(position.entryTime) &&
      isFiniteNumber(position.stopLoss) &&
      isFiniteNumber(position.takeProfit) &&
      isFiniteNumber(position.lots) &&
      isFiniteNumber(position.slPips) &&
      isFiniteNumber(position.tpPips),
  );
}

function isDrawingPoint(value: unknown): value is { time: number; price: number } {
  const point = value as { time?: unknown; price?: unknown } | null;
  return Boolean(point && isFiniteNumber(point.time) && isFiniteNumber(point.price));
}

function isDrawing(value: unknown): value is ReplayDrawing {
  const drawing = value as Partial<ReplayDrawing> & { [key: string]: unknown };
  if (!drawing || typeof drawing.id !== "string") return false;
  switch (drawing.kind) {
    case "trend":
    case "rect":
    case "fib":
      return isDrawingPoint(drawing.a) && isDrawingPoint(drawing.b) && typeof drawing.color === "string";
    case "ruler":
      return isDrawingPoint(drawing.a) && isDrawingPoint(drawing.b);
    case "hline":
      return isFiniteNumber(drawing.price) && typeof drawing.color === "string";
    case "text":
      return isDrawingPoint(drawing.at) && typeof drawing.text === "string";
    case "position":
      return (
        (drawing.direction === "buy" || drawing.direction === "sell") &&
        isDrawingPoint(drawing.entry) &&
        isFiniteNumber(drawing.slPrice) &&
        isFiniteNumber(drawing.tpPrice)
      );
    default:
      return false;
  }
}

const INDICATOR_TYPES = new Set([
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
]);

function isIndicator(value: unknown): value is IndicatorConfig {
  const indicator = value as Partial<IndicatorConfig> | null;
  return Boolean(
    indicator &&
      typeof indicator.id === "string" &&
      typeof indicator.type === "string" &&
      // Unknown types would crash INDICATOR_META lookups downstream.
      INDICATOR_TYPES.has(indicator.type) &&
      typeof indicator.on === "boolean" &&
      typeof indicator.color === "string",
  );
}

function parseTicket(value: unknown): TerminalTicket {
  const ticket = value as Partial<TerminalTicket> | null;
  if (!ticket) return { ...DEFAULT_TICKET };
  return {
    riskMode: ticket.riskMode === "fixed" ? "fixed" : "percent",
    riskValue: isFiniteNumber(ticket.riskValue) ? ticket.riskValue : DEFAULT_TICKET.riskValue,
    slPips: isFiniteNumber(ticket.slPips) ? ticket.slPips : DEFAULT_TICKET.slPips,
    tpPips: isFiniteNumber(ticket.tpPips) ? ticket.tpPips : DEFAULT_TICKET.tpPips,
  };
}

function parseSettings(value: unknown): TerminalSettings {
  const settings = value as Partial<TerminalSettings> | null;
  if (!settings) return { ...DEFAULT_TERMINAL_SETTINGS };
  const chartType: ChartType =
    settings.chartType === "heikin" || settings.chartType === "line" ? settings.chartType : "candles";
  const visibleTools: Record<string, boolean> = {};
  if (settings.visibleTools && typeof settings.visibleTools === "object") {
    for (const [key, visible] of Object.entries(settings.visibleTools)) {
      if (typeof visible === "boolean") visibleTools[key] = visible;
    }
  }
  return {
    chartType,
    showSessions: settings.showSessions === true,
    magnet: settings.magnet !== false,
    toolColor: typeof settings.toolColor === "string" ? settings.toolColor : DEFAULT_TERMINAL_SETTINGS.toolColor,
    toolWidth: isFiniteNumber(settings.toolWidth)
      ? Math.min(4, Math.max(1, settings.toolWidth))
      : DEFAULT_TERMINAL_SETTINGS.toolWidth,
    visibleTools,
  };
}

export function serializeTerminalState(draft: TerminalStateDraft): string {
  const state: PersistedTerminalState = {
    ...draft,
    trades: draft.trades.filter(isClosedTrade),
    drawings: draft.drawings.filter(isDrawing),
    indicators: draft.indicators.filter(isIndicator),
    openPosition: draft.openPosition && isOpenPosition(draft.openPosition) ? draft.openPosition : null,
    version: 2,
    savedAt: new Date().toISOString(),
  };
  return JSON.stringify(state);
}

export function parseTerminalState(raw: string | null, symbol: string): PersistedTerminalState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<PersistedTerminalState>;
    if (data.version !== 2) return null;
    if (data.symbol !== symbol) return null;
    if (typeof data.interval !== "string") return null;
    return {
      version: 2,
      symbol: data.symbol,
      interval: data.interval,
      cursorTime: isFiniteNumber(data.cursorTime) ? data.cursorTime : null,
      indicators: Array.isArray(data.indicators) ? data.indicators.filter(isIndicator) : [],
      drawings: Array.isArray(data.drawings) ? data.drawings.filter(isDrawing) : [],
      trades: Array.isArray(data.trades) ? data.trades.filter(isClosedTrade) : [],
      openPosition: data.openPosition && isOpenPosition(data.openPosition) ? data.openPosition : null,
      ticket: parseTicket(data.ticket),
      settings: parseSettings(data.settings),
      initialBalance: isFiniteNumber(data.initialBalance) ? data.initialBalance : 10_000,
      savedAt: typeof data.savedAt === "string" ? data.savedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}
