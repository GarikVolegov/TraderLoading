import { pickChartSettings } from "../../../../../contracts/backtestChart";
// ─── Terminal state persistence (localStorage, v3; reads v2) ──────────────────
// Per-session replay state: cursor, indicators, drawings, order-ticket inputs,
// tool settings, account and trades. Versioned and symbol-guarded like the v1
// chartReplayPersistence it supersedes; malformed entries degrade field-by-field
// instead of discarding the whole state.
import type { IndicatorConfig } from "./indicatorCatalog";
import { getReplayIntervalSeconds } from "../../components/chartReplayWindow";
import { migrateReplayTime } from "./replayClock";
import type { ChartType, ClosedTrade, OpenPosition, PendingOrder, ReplayDrawing, RiskMode } from "./types";

export interface TerminalTicket {
  riskMode: RiskMode;
  riskValue: number;
  slPips: number;
  tpPips: number;
  /** Auto-breakeven trigger in R (null = off). */
  breakevenAtR: number | null;
  /** Trailing-stop distance in pips (null = off). */
  trailingPips: number | null;
  /** Automatically recalculate lot size to maintain target risk when dragging/modifying stop loss. */
  adaptRiskOnSlMove?: boolean;
}

export interface TerminalSettings {
  chartType: ChartType;
  showSessions: boolean;
  magnet: boolean;
  stayInDrawingMode?: boolean;
  showFavoriteToolbar?: boolean;
  rightOffsetBars?: number;
  toolColor: string;
  toolWidth: number;
  /** Rail visibility per drawing tool id (missing = visible). */
  visibleTools: Record<string, boolean>;
  /** Simulated spread paid on entry, in pips (0 = frictionless). */
  spreadPips: number;
  /** Round-turn commission per lot, in account currency. */
  commissionPerLot: number;
  /** Whether to show closed trade markers/executions on the chart (default: true). */
  showTradesOnChart?: boolean;
  /** Mode for trade connector dashed lines: 'hover_or_latest' (clean) | 'all' | 'none' (default: 'hover_or_latest'). */
  tradeLineMode?: "hover_or_latest" | "all" | "none";

  // ── TradingView Pro Chart Customization ──────────────────────────────────
  candleBordersVisible?: boolean;
  candleWicksVisible?: boolean;
  textColor?: string;
  axisColor?: string;
  volumeUpColor?: string;
  volumeDownColor?: string;
  candleUpColor?: string;
  candleDownColor?: string;
  wickUpColor?: string;
  wickDownColor?: string;
  borderUpColor?: string;
  borderDownColor?: string;
  lineColor?: string;
  areaTopColor?: string;
  areaBottomColor?: string;

  chartBgType?: "solid" | "gradient";
  chartBgColor1?: string;
  chartBgColor2?: string;
  showVertGrid?: boolean;
  showHorzGrid?: boolean;
  gridColor?: string;
  gridStyle?: "solid" | "dashed" | "dotted";
  crosshairColor?: string;
  crosshairStyle?: "solid" | "dashed" | "dotted";

  showWatermark?: boolean;
  watermarkText?: string;
  watermarkOpacity?: number;

  priceScaleMode?: "normal" | "logarithmic" | "percentage";
  showOhlcLegend?: boolean;
  showBarChange?: boolean;
  showLastPriceLine?: boolean;
  showHighLowLines?: boolean;
}

export const DEFAULT_TICKET: TerminalTicket = {
  riskMode: "percent",
  riskValue: 1,
  slPips: 25,
  tpPips: 75,
  breakevenAtR: null,
  trailingPips: null,
  adaptRiskOnSlMove: true,
};

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  chartType: "candles",
  showSessions: false,
  magnet: true,
  stayInDrawingMode: false,
  showFavoriteToolbar: true,
  rightOffsetBars: 12,
  toolColor: "#c5a059",
  toolWidth: 2,
  visibleTools: {},
  spreadPips: 0,
  commissionPerLot: 0,
  showTradesOnChart: true,
  tradeLineMode: "hover_or_latest",

  candleBordersVisible: true,
  candleWicksVisible: true,
  textColor: "#f4f4f6",
  axisColor: "#26262e",
  volumeUpColor: "rgba(197, 160, 89, 0.4)",
  volumeDownColor: "rgba(224, 86, 102, 0.4)",
  candleUpColor: "#c5a059",
  candleDownColor: "#e05666",
  wickUpColor: "#c5a059",
  wickDownColor: "#e05666",
  borderUpColor: "#c5a059",
  borderDownColor: "#e05666",
  lineColor: "#c5a059",
  areaTopColor: "rgba(197, 160, 89, 0.35)",
  areaBottomColor: "rgba(197, 160, 89, 0.0)",

  chartBgType: "solid",
  chartBgColor1: "#08080a",
  chartBgColor2: "#0e1015",
  showVertGrid: true,
  showHorzGrid: true,
  gridColor: "rgba(197, 160, 89, 0.04)",
  crosshairColor: "rgba(197, 160, 89, 0.6)",
  crosshairStyle: "dashed",

  showWatermark: true,
  watermarkText: "",
  watermarkOpacity: 0.05,

  priceScaleMode: "normal",
  showOhlcLegend: true,
  showBarChange: true,
  showLastPriceLine: true,
  showHighLowLines: false,
};

export interface TerminalStateDraft {
  symbol: string;
  interval: string;
  /** Unix seconds of the bar the cursor is on (null = start fresh). */
  cursorTime: number | null;
  /** Exact exclusive cutoff, independent of the selected chart interval. */
  replayTime?: number | null;
  startTime?: number | null;
  indicators: IndicatorConfig[];
  drawings: ReplayDrawing[];
  trades: ClosedTrade[];
  openPosition: OpenPosition | null;
  pendingOrder: PendingOrder | null;
  openPositions?: OpenPosition[];
  pendingOrders?: PendingOrder[];
  ticket: TerminalTicket;
  settings: TerminalSettings;
  initialBalance: number;
}

export interface PersistedTerminalState extends TerminalStateDraft {
  version: 3;
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
  if (
    !(
      position &&
      (position.direction === "buy" || position.direction === "sell") &&
      isFiniteNumber(position.entryPrice) &&
      isFiniteNumber(position.entryTime) &&
      isFiniteNumber(position.stopLoss) &&
      isFiniteNumber(position.takeProfit) &&
      isFiniteNumber(position.lots) &&
      isFiniteNumber(position.slPips) &&
      isFiniteNumber(position.tpPips)
    )
  ) {
    return false;
  }
  // hasStop was added after v2 shipped: default from slPips for older state.
  if (typeof position.hasStop !== "boolean") position.hasStop = position.slPips > 0;
  return true;
}

function isPendingOrder(value: unknown): value is PendingOrder {
  const order = value as Partial<PendingOrder> | null;
  return Boolean(
    order &&
      (order.direction === "buy" || order.direction === "sell") &&
      (order.kind === "limit" || order.kind === "stop") &&
      isFiniteNumber(order.price) &&
      isFiniteNumber(order.slPips) &&
      isFiniteNumber(order.tpPips) &&
      isFiniteNumber(order.lots) &&
      isFiniteNumber(order.placedTime),
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
    case "ray":
    case "infoline":
    case "parallelChannel":
    case "arrow":
    case "rect":
    case "fib":
    case "frvp":
    case "priceRange":
    case "dateRange":
      return isDrawingPoint(drawing.a) && isDrawingPoint(drawing.b) && typeof drawing.color === "string";
    case "ruler":
      return isDrawingPoint(drawing.a) && isDrawingPoint(drawing.b);
    case "hray":
    case "arrowUp":
    case "arrowDown":
    case "avwap":
      return isDrawingPoint(drawing.at) && typeof drawing.color === "string";
    case "path":
    case "highlighter":
      return (
        Array.isArray(drawing.points) &&
        drawing.points.length >= 2 &&
        drawing.points.every(isDrawingPoint) &&
        typeof drawing.color === "string"
      );
    case "hline":
      return isFiniteNumber(drawing.price) && typeof drawing.color === "string";
    case "vline":
      return isFiniteNumber(drawing.time) && typeof drawing.color === "string";
    case "text":
    case "callout":
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
  const out: TerminalTicket = {
    riskMode: ticket.riskMode === "fixed" ? "fixed" : "percent",
    riskValue: isFiniteNumber(ticket.riskValue) ? ticket.riskValue : DEFAULT_TICKET.riskValue,
    slPips: isFiniteNumber(ticket.slPips) ? ticket.slPips : DEFAULT_TICKET.slPips,
    tpPips: isFiniteNumber(ticket.tpPips) ? ticket.tpPips : DEFAULT_TICKET.tpPips,
    breakevenAtR: isFiniteNumber(ticket.breakevenAtR) && ticket.breakevenAtR > 0 ? ticket.breakevenAtR : null,
    trailingPips: isFiniteNumber(ticket.trailingPips) && ticket.trailingPips > 0 ? ticket.trailingPips : null,
  };
  if (typeof ticket.adaptRiskOnSlMove === "boolean") {
    out.adaptRiskOnSlMove = ticket.adaptRiskOnSlMove;
  }
  return out;
}

// ── named ticket profiles (Scalper Mode) — global, not per-session ──────────
export function createTicketProfilesStorageKey(): string {
  return "traderloading:backtest-terminal:ticket-profiles";
}

export function serializeTicketProfiles(profiles: Record<string, TerminalTicket>): string {
  return JSON.stringify({ version: 1, profiles });
}

export function parseTicketProfiles(raw: string | null): Record<string, TerminalTicket> {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as { version?: unknown; profiles?: unknown };
    if (data.version !== 1 || data.profiles == null || typeof data.profiles !== "object") return {};
    const out: Record<string, TerminalTicket> = {};
    for (const [name, ticket] of Object.entries(data.profiles as Record<string, unknown>)) {
      if (name.trim() === "") continue;
      out[name] = parseTicket(ticket);
    }
    return out;
  } catch {
    return {};
  }
}

// ── chart templates (indicators + settings) — global, session-independent ───
export interface ChartTemplate {
  indicators: IndicatorConfig[];
  settings: TerminalSettings;
}

export function createChartTemplateStorageKey(): string {
  return "traderloading:backtest-terminal:chart-templates";
}

export function serializeChartTemplates(templates: Record<string, ChartTemplate>): string {
  return JSON.stringify({ version: 1, templates });
}

export function parseChartTemplates(raw: string | null): Record<string, ChartTemplate> {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as { version?: unknown; templates?: unknown };
    if (data.version !== 1 || data.templates == null || typeof data.templates !== "object") return {};
    const out: Record<string, ChartTemplate> = {};
    for (const [name, template] of Object.entries(data.templates as Record<string, unknown>)) {
      if (name.trim() === "") continue;
      const entry = template as { indicators?: unknown; settings?: unknown } | null;
      out[name] = {
        indicators: Array.isArray(entry?.indicators) ? entry.indicators.filter(isIndicator) : [],
        settings: parseSettings(entry?.settings ?? null),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function parseSettings(value: unknown): TerminalSettings {
  const settings = value && typeof value === "object" ? value as Partial<TerminalSettings> : {};
  return {
    ...pickChartSettings(settings),
    spreadPips: isFiniteNumber(settings.spreadPips) && settings.spreadPips > 0 ? settings.spreadPips : 0,
    commissionPerLot: isFiniteNumber(settings.commissionPerLot) && settings.commissionPerLot > 0 ? settings.commissionPerLot : 0,
  };
}

export function serializeTerminalState(draft: TerminalStateDraft): string {
  const openPositions = Array.isArray(draft.openPositions)
    ? draft.openPositions.filter(isOpenPosition)
    : draft.openPosition && isOpenPosition(draft.openPosition)
      ? [draft.openPosition]
      : [];
  const pendingOrders = Array.isArray(draft.pendingOrders)
    ? draft.pendingOrders.filter(isPendingOrder)
    : draft.pendingOrder && isPendingOrder(draft.pendingOrder)
      ? [draft.pendingOrder]
      : [];

  const state: PersistedTerminalState = {
    ...draft,
    trades: draft.trades.filter(isClosedTrade),
    drawings: draft.drawings.filter(isDrawing),
    indicators: draft.indicators.filter(isIndicator),
    openPosition: openPositions[0] ?? null,
    pendingOrder: pendingOrders[0] ?? null,
    openPositions,
    pendingOrders,
    replayTime: draft.replayTime ?? migrateReplayTime(draft.cursorTime, getReplayIntervalSeconds(draft.interval)),
    startTime: draft.startTime ?? null,
    version: 3,
    savedAt: new Date().toISOString(),
  };
  return JSON.stringify(state);
}

export function parseTerminalState(raw: string | null, symbol: string): PersistedTerminalState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<Omit<PersistedTerminalState, "version">> & { version?: number };
    if (data.version !== 3 && data.version !== 2) return null;
    if (data.symbol !== symbol) return null;
    if (typeof data.interval !== "string") return null;

    const singleOpenPosition = data.openPosition && isOpenPosition(data.openPosition) ? data.openPosition : null;
    const singlePendingOrder = data.pendingOrder && isPendingOrder(data.pendingOrder) ? data.pendingOrder : null;

    let openPositions: OpenPosition[] = [];
    if (Array.isArray(data.openPositions)) {
      openPositions = data.openPositions.filter(isOpenPosition);
      if (data.openPosition !== undefined && !singleOpenPosition) {
        openPositions = [];
      }
    } else if (singleOpenPosition) {
      openPositions = [singleOpenPosition];
    }

    let pendingOrders: PendingOrder[] = [];
    if (Array.isArray(data.pendingOrders)) {
      pendingOrders = data.pendingOrders.filter(isPendingOrder);
      if (data.pendingOrder !== undefined && !singlePendingOrder) {
        pendingOrders = [];
      }
    } else if (singlePendingOrder) {
      pendingOrders = [singlePendingOrder];
    }

    return {
      version: 3,
      symbol: data.symbol,
      interval: data.interval,
      cursorTime: isFiniteNumber(data.cursorTime) ? data.cursorTime : null,
      replayTime: data.version === 3 && isFiniteNumber(data.replayTime)
        ? data.replayTime
        : migrateReplayTime(isFiniteNumber(data.cursorTime) ? data.cursorTime : null, getReplayIntervalSeconds(data.interval)),
      startTime: isFiniteNumber(data.startTime) ? data.startTime : null,
      indicators: Array.isArray(data.indicators) ? data.indicators.filter(isIndicator) : [],
      drawings: Array.isArray(data.drawings) ? data.drawings.filter(isDrawing) : [],
      trades: Array.isArray(data.trades) ? data.trades.filter(isClosedTrade) : [],
      openPosition: openPositions[0] ?? null,
      pendingOrder: pendingOrders[0] ?? null,
      openPositions,
      pendingOrders,
      ticket: parseTicket(data.ticket),
      settings: parseSettings(data.settings),
      initialBalance: isFiniteNumber(data.initialBalance) ? data.initialBalance : 10_000,
      savedAt: typeof data.savedAt === "string" ? data.savedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}
