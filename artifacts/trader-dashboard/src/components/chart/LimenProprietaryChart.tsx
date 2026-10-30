import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import {
  Scissors,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Check,
  Trash2,
} from "lucide-react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createTextWatermark,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  PriceScaleMode,
  type IChartApi,
  type ISeriesApi,
  type ITextWatermarkPluginApi,
  type Logical,
  type Time,
} from "lightweight-charts";
import type { FeedStatus } from "@/lib/chart/tradingViewRealtimeFeed";
import { resolveTradingViewSymbol, timeframeToSeconds } from "@/lib/chart/symbolMapping";
import { logicalIndexAtTime, timeAtLogicalIndex } from "@/lib/replay/replayClock";
import { synestheticAlert } from "@/lib/soundFx";
import {
  clearChartDrawings,
  DRAWINGS_SYNC_EVENT,
  loadChartDrawings,
  saveChartDrawings,
} from "@/lib/chart/drawingStorage";
import type { ReplayDrawing, TradeDirection } from "@/lib/replay/types";
import { computeIndicator, defaultIndicators, type IndicatorConfig } from "@/lib/replay/indicatorCatalog";
import { toHeikinAshi } from "@/lib/replay/heikinAshi";
import { DEFAULT_TERMINAL_SETTINGS, type TerminalSettings } from "@/lib/replay/terminalPersistence";
import { pickChartSettings } from "../../../../../contracts/backtestChart";
import { useChartPreferences } from "../backtest-terminal/useChartPreferences";
import { ToolRail } from "../backtest-terminal/ToolRail";
import { FavoriteToolsBar } from "../backtest-terminal/FavoriteToolsBar";
import { ToolKnowledgeDrawer } from "../backtest-terminal/ToolKnowledgeDrawer";
import { TerminalSettingsDialog } from "../backtest-terminal/TerminalSettingsDialog";
import type { DrawingToolId } from "../backtest-terminal/toolRailModel";
import { DrawingsOverlay } from "../backtest-terminal/DrawingsOverlay";
import { ChartAlertsOverlay } from "../backtest-terminal/ChartAlertsOverlay";
import { useReplayAlerts } from "../backtest-terminal/useReplayAlerts";
import { SessionOpensOverlay } from "../backtest-terminal/SessionOpensOverlay";
import type { ChartProjector } from "../backtest-terminal/PositionOverlay";
import { LimenChartHeader } from "./LimenChartHeader";
import { LimenAiSetupOverlay } from "./LimenAiSetupOverlay";
import { ChartObjectTreeModal } from "./ChartObjectTreeModal";
import { LimenCompanionChartPane } from "./LimenCompanionChartPane";
import { LiquidityLevelsOverlay } from "./LiquidityLevelsOverlay";
import { WyckoffOverlay } from "./WyckoffOverlay";
import { RedNewsOverlay } from "./RedNewsOverlay";
import { analyzeInstitutionalLiquidity } from "@/lib/chart/liquidityEngine";
import { analyzeWyckoffStructure } from "@/lib/chart/wyckoffEngine";
import type { VarcoSetupPlan } from "@workspace/api-client-react";
import { getLimenSessionInfo } from "@/lib/limenSession";
import { computeLots, pipValuePerLot } from "@/lib/replay/lotSizing";
import { getPipMultiplier } from "@/lib/pipMultiplier";
import {
  computeDailyChangeTelemetry,
  computeLiveAtrPips,
  formatRelativeHorizonDelta,
  loadCachedCandles,
  loadChartMemory,
  saveCachedCandles,
  saveChartMemory,
} from "@/lib/chart/chartMemoryEngine";
import "./LimenProprietaryChart.css";

export interface PlannedTradeInfo {
  direction: TradeDirection;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
}

export interface CandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface LimenProprietaryChartProps {
  symbol?: string;
  onSymbolChange?: (symbol: string) => void;
  interval?: string;
  onIntervalChange?: (interval: string) => void;
  onTradePlanned?: (trade: PlannedTradeInfo) => void;
  onImminentNewsChange?: (news: {
    title: string;
    country: string;
    time: number;
    countdownMin: number;
  } | null) => void;
  className?: string;
  // Unified Cockpit Props
  biasScore?: number | null;
  h4DirectionalBias?: "BULLISH" | "BEARISH" | "NEUTRAL" | null;
  edgeTier?: string | null;
  onOpenContext?: () => void;
  macroText?: string;
  macroStatus?: "pre" | "clear" | "post" | "normal";
  onOpenNews?: () => void;
  onOpenFavorites?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  leftCollapsed?: boolean;
  onToggleLeft?: () => void;
  // Limen Vision Sentinel AI Integration
  aiSetup?: VarcoSetupPlan | null;
  onUpdateAiSetup?: (setup: VarcoSetupPlan) => void;
  onAdoptAiSetup?: () => void;
  showAiOverlay?: boolean;
  onToggleAiOverlay?: () => void;
  isAiScanning?: boolean;
  onScanAi?: () => void;
  isAdmin?: boolean;
  onCandlesUpdate?: (candles: CandleBar[]) => void;
  chartCanvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
}

const UP_COLOR = "#26a69a";
const DOWN_COLOR = "#ef5350";

function priceDecimals(symbol: string): number {
  const s = symbol.trim().toUpperCase();
  if (s.includes("JPY")) return 3;
  if (s.includes("XAU") || s.includes("GOLD") || s.includes("XAG")) return 2;
  if (s.includes("BTC") || s.includes("ETH")) return 2;
  if (s.includes("30") || s.includes("100") || s.includes("500") || s.includes("SPX") || s.includes("NDX") || s.includes("US")) return 2;
  return 5;
}

const priceFormatters = new Map<number, Intl.NumberFormat>();

function formatPriceLocale(price: number, symbol: string): string {
  const dec = priceDecimals(symbol);
  let fmt = priceFormatters.get(dec);
  if (!fmt) {
    fmt = new Intl.NumberFormat("it-IT", {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
    priceFormatters.set(dec, fmt);
  }
  return fmt.format(price);
}

const ChartBottomClock = memo(function ChartBottomClock() {
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  useEffect(() => {
    const updateTime = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const d = new Date(utc + 2 * 3600000);
      const h = String(d.getHours()).padStart(2, "0");
      const m = String(d.getMinutes()).padStart(2, "0");
      const s = String(d.getSeconds()).padStart(2, "0");
      setCurrentTimeStr(`${h}:${m}:${s} (UTC+2)`);
    };
    updateTime();
    const intervalId = setInterval(updateTime, 1000);
    return () => clearInterval(intervalId);
  }, []);
  return <span className="limen-bottom-clock whitespace-nowrap">{currentTimeStr}</span>;
});

const CandlePriceScaleTag = memo(function CandlePriceScaleTag({
  close,
  open,
  priceY,
  projectorHeight,
  symbol,
  interval,
  priceScaleWidth,
}: {
  close: number;
  open: number;
  priceY: number | null;
  projectorHeight: number;
  symbol: string;
  interval: string;
  priceScaleWidth: number;
}) {
  const [candleCountdown, setCandleCountdown] = useState<string>("");
  useEffect(() => {
    const updateCountdown = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const duration = timeframeToSeconds(interval);
      if (duration >= 86400) {
        setCandleCountdown("");
        return;
      }
      const now = Math.floor(Date.now() / 1000);
      const remainder = duration - (now % duration);
      const hh = Math.floor(remainder / 3600);
      const mm = Math.floor((remainder % 3600) / 60);
      const ss = remainder % 60;
      const formatted =
        duration >= 3600
          ? `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
          : `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
      setCandleCountdown(formatted);
    };
    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);
    return () => clearInterval(intervalId);
  }, [interval]);

  if (priceY == null || priceY < -10 || priceY > projectorHeight + 10) return null;
  const isUp = close >= open;
  const formattedPrice = formatPriceLocale(close, symbol);
  const clampedTop = Math.max(2, Math.min(projectorHeight - 34, Math.round(priceY - 9)));

  return (
    <div
      className={`limen-price-scale-tag ${isUp ? "is-up" : "is-down"} ${candleCountdown ? "has-countdown" : "no-countdown"}`}
      style={{
        top: `${clampedTop}px`,
        width: `${priceScaleWidth}px`,
      }}
      title={`Prezzo: ${formattedPrice}${candleCountdown ? ` · Chiusura candela tra: ${candleCountdown}` : ""}`}
      aria-label={`Prezzo ${formattedPrice}${candleCountdown ? `, chiusura candela in ${candleCountdown}` : ""}`}
    >
      <div className="limen-price-scale-price whitespace-nowrap">{formattedPrice}</div>
      {candleCountdown && (
        <div className="limen-price-scale-timer whitespace-nowrap">{candleCountdown}</div>
      )}
    </div>
  );
});

function normalizeToApiInterval(tf: string): string {
  const norm = tf.trim().toUpperCase();
  if (norm === "60" || norm === "1H" || norm === "H1") return "H1";
  if (norm === "240" || norm === "4H" || norm === "H4") return "H4";
  if (norm === "15" || norm === "M15") return "M15";
  if (norm === "5" || norm === "M5") return "M5";
  if (norm === "1" || norm === "M1") return "M1";
  if (norm === "30" || norm === "M30") return "M30";
  if (norm === "D" || norm === "D1" || norm === "1D") return "D1";
  if (norm === "W" || norm === "W1" || norm === "1W") return "W1";
  return norm;
}

function formatCleanPairLabel(sym: string): string {
  const raw = sym.includes(":") ? sym.split(":").pop()! : sym;
  const clean = raw.trim().toUpperCase().replace(/[\/\-_]/g, "");
  if (clean.length === 6 && !clean.includes("30") && !clean.includes("100") && !clean.includes("500")) {
    return `${clean.slice(0, 3)}/${clean.slice(3, 6)}`;
  }
  return clean;
}

function formatHumanTimeframe(tf: string): string {
  const norm = tf.trim().toUpperCase();
  if (norm === "1" || norm === "M1") return "1m";
  if (norm === "5" || norm === "M5") return "5m";
  if (norm === "15" || norm === "M15") return "15m";
  if (norm === "30" || norm === "M30") return "30m";
  if (norm === "60" || norm === "H1" || norm === "1H") return "1H";
  if (norm === "240" || norm === "H4" || norm === "4H") return "4H";
  if (norm === "D" || norm === "D1" || norm === "1D") return "1D";
  if (norm === "W" || norm === "W1" || norm === "1W") return "1W";
  return norm;
}

function getFutureWhitespaceBars(lastTime: number, interval: string): Array<{ time: Time }> {
  const norm = interval.trim().toUpperCase();
  let step = 3600;
  let count = 160;

  if (norm === "1" || norm === "M1") { step = 60; count = 240; }
  else if (norm === "5" || norm === "M5") { step = 300; count = 200; }
  else if (norm === "15" || norm === "M15") { step = 900; count = 180; }
  else if (norm === "30" || norm === "M30") { step = 1800; count = 160; }
  else if (norm === "60" || norm === "H1" || norm === "1H") { step = 3600; count = 160; }
  else if (norm === "240" || norm === "H4" || norm === "4H") { step = 14400; count = 120; }
  else if (norm === "D" || norm === "D1" || norm === "1D") { step = 86400; count = 90; }
  else if (norm === "W" || norm === "W1" || norm === "1W") { step = 604800; count = 52; }

  const out: Array<{ time: Time }> = [];
  for (let i = 1; i <= count; i++) {
    out.push({ time: (lastTime + i * step) as Time });
  }
  return out;
}

export function LimenProprietaryChart({
  symbol = "XAUUSD",
  onSymbolChange,
  interval = "60",
  onIntervalChange,
  onTradePlanned,
  onImminentNewsChange,
  className = "",
  biasScore,
  h4DirectionalBias,
  edgeTier,
  onOpenContext,
  macroText,
  macroStatus = "normal",
  onOpenNews,
  onOpenFavorites,
  isFullscreen = false,
  onToggleFullscreen,
  leftCollapsed = false,
  onToggleLeft,
  aiSetup,
  onUpdateAiSetup,
  onAdoptAiSetup,
  showAiOverlay = true,
  onToggleAiOverlay,
  isAiScanning = false,
  isAdmin = false,
  onScanAi,
  onCandlesUpdate,
  chartCanvasRef,
}: LimenProprietaryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null>(null);
  const futureHorizonSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const catalogSeriesRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema200Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const watermarkRef = useRef<ITextWatermarkPluginApi<Time> | null>(null);
  const lastRenderedCountRef = useRef(0);
  const lastRenderedTypeRef = useRef<string>("");
  const lastRenderedInstanceRef = useRef(0);

  // ── Preferenze grafiche condivise & sincronizzate Cloud + LocalStorage ────
  const [sessionSettings, setSessionSettings] = useState<TerminalSettings>({
    ...DEFAULT_TERMINAL_SETTINGS,
  });
  const chartPreferences = useChartPreferences(sessionSettings);
  const settings = useMemo<TerminalSettings>(
    () => ({ ...sessionSettings, ...chartPreferences.preferences.settings }),
    [sessionSettings, chartPreferences.preferences.settings],
  );
  const updateChartPreferences = chartPreferences.update;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const setSettings = useCallback(
    (value: TerminalSettings | ((previous: TerminalSettings) => TerminalSettings)) => {
      const next = typeof value === "function" ? value(settingsRef.current) : value;
      settingsRef.current = next;
      setSessionSettings((previous) => ({ ...previous, spreadPips: next.spreadPips, commissionPerLot: next.commissionPerLot }));
      updateChartPreferences((previous) => ({ ...previous, settings: pickChartSettings(next) }));
    },
    [updateChartPreferences],
  );

  // Stato Modali e Guide TradingView
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"chart" | "sessions" | "liquidity" | "wyckoff" | "indicators" | "tools" | "templates">("chart");
  const [settingsIndicatorId, setSettingsIndicatorId] = useState<string | undefined>();
  const [knowledgeToolId, setKnowledgeToolId] = useState<DrawingToolId | null>(null);

  // Stato Dati & Feed (con Idratazione Istantanea da Cache Locale < 16ms)
  const [chartInstance, setChartInstance] = useState(0);
  const [candles, setCandles] = useState<CandleBar[]>(() => {
    const rawSym = symbol.includes(":") ? symbol.split(":").pop()! : symbol;
    const cleanSym = rawSym.trim().toUpperCase().replace(/[\/\-_]/g, "");
    const cached = loadCachedCandles(cleanSym, normalizeToApiInterval(interval));
    return cached ?? [];
  });
  // ── Storico infinito all'indietro (Il Varco) ──
  const candlesRef = useRef<CandleBar[]>([]);
  candlesRef.current = candles;
  const intervalRef = useRef(interval);
  intervalRef.current = interval;
  const prependShiftRef = useRef(0);
  const loadOlderRef = useRef<() => void>(() => {});
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("connecting");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const cameraAnchorRef = useRef<{ centerTime: number | null; isNearLive: boolean } | null>(null);
  const chartType = settings.chartType ?? "candles";

  // ── Memoria Totale del Grafico (chartMemoryEngine) & Modalità Grafico Pulito ──
  const initialMemory = useMemo(() => loadChartMemory(), []);

  const [indicators, setIndicators] = useState<IndicatorConfig[]>(() => {
    if (typeof window !== "undefined") {
      const mode = localStorage.getItem("limen_clean_chart_mode");
      if (mode === "true") {
        return defaultIndicators().map((ind) => ({ ...ind, on: false }));
      }
      if (initialMemory.indicators && initialMemory.indicators.length > 0) {
        return initialMemory.indicators;
      }
      if (mode === "false") {
        return defaultIndicators();
      }
    }
    return defaultIndicators().map((ind) => ({ ...ind, on: false }));
  });

  const [showSessionsState, setShowSessionsState] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const mode = localStorage.getItem("limen_clean_chart_mode");
      if (mode === "true") return false;
      if (initialMemory.updatedAt > 0) return initialMemory.showSessions;
      if (mode === "false") return settings.showSessions ?? false;
    }
    return false;
  });

  const showSessions = showSessionsState;
  const showVolume = indicators.some((ind) => ind.on && ind.type === "volume");
  const [showEma, setShowEma] = useState<boolean>(() => {
    if (typeof window !== "undefined" && localStorage.getItem("limen_clean_chart_mode") === "true") {
      return false;
    }
    return initialMemory.showEma;
  });
  const [showAutoFvg, setShowAutoFvg] = useState<boolean>(() => {
    if (typeof window !== "undefined" && localStorage.getItem("limen_clean_chart_mode") === "true") {
      return false;
    }
    return initialMemory.showAutoFvg;
  });

  // Stato Disegni (sincronizzazione immediata Varco <-> Backtest)
  const [activeTool, setActiveTool] = useState<DrawingToolId>("cursor");
  const [ticket, setTicket] = useState(() => ({
    slPips: initialMemory.slPips || 25,
    tpPips: initialMemory.tpPips || 75,
    riskMode: "percent" as const,
    riskValue: initialMemory.riskValue || 1,
    comment: "",
  }));
  const [drawings, setDrawingsState] = useState<ReplayDrawing[]>(() =>
    loadChartDrawings(symbol, interval),
  );
  const [revision, setRevision] = useState(0);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [hoverBar, setHoverBar] = useState<CandleBar | null>(null);
  const [crosshairY, setCrosshairY] = useState<number | null>(null);
  const [crosshairDetails, setCrosshairDetails] = useState<{
    x: number;
    y: number;
    time: number;
    price: number | null;
    isFuture: boolean;
    barsDelta: number;
  } | null>(null);
  const [isScrolledAway, setIsScrolledAway] = useState(false);
  const [chartContextMenu, setChartContextMenu] = useState<{
    x: number;
    y: number;
    price: number;
    time?: number;
  } | null>(null);
  const [objectTreeOpen, setObjectTreeOpen] = useState(false);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [layout, setLayout] = useState<"1x1" | "1x2" | "2x1" | "2x2">(() => initialMemory.layout || "1x1");
  const [activePane, setActivePane] = useState<"primary" | "secondary">("primary");

  // Replay Mode & Scissors Cut Tool (TradingView Pro Image 4)
  const [replayActive, setReplayActive] = useState(false);
  const [replayScissorsMode, setReplayScissorsMode] = useState(false);
  const [replayCutIndex, setReplayCutIndex] = useState<number | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(1);
  const [replayHover, setReplayHover] = useState<{ x: number; time: number; label: string } | null>(null);

  // Price Scale Context Menu (TradingView Pro Image 5)
  const [scaleContextMenu, setScaleContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [scaleInvert, setScaleInvert] = useState(false);
  const [scaleCountdownVisible, setScaleCountdownVisible] = useState(true);
  const [showLiquidityLevels, setShowLiquidityLevels] = useState(() => {
    if (typeof window !== "undefined") {
      const mode = localStorage.getItem("limen_clean_chart_mode");
      if (mode === "true") return false;
      if (initialMemory.updatedAt > 0) return initialMemory.showLiquidityLevels;
      if (mode === "false") return true;
    }
    return false;
  });

  const [showWyckoff, setShowWyckoff] = useState(() => {
    if (typeof window !== "undefined") {
      const mode = localStorage.getItem("limen_clean_chart_mode");
      if (mode === "true") return false;
      if (initialMemory.updatedAt > 0) return initialMemory.showWyckoff;
      if (mode === "false") return true;
    }
    return false;
  });

  const [showRedNews, setShowRedNews] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("limen_chart_show_red_news_v1");
      if (saved != null) return saved === "true";
    } catch {}
    return initialMemory.showRedNews ?? true;
  });

  const [imminentRedNews, setImminentRedNews] = useState<{
    title: string;
    country: string;
    time: number;
    countdownMin: number;
  } | null>(null);

  // Persistenza automatica in chartMemoryEngine ad ogni modifica di configurazione
  useEffect(() => {
    saveChartMemory({
      showSessions: showSessionsState,
      showLiquidityLevels,
      showWyckoff,
      showEma,
      showAutoFvg,
      showVolume,
      showRedNews,
      indicators,
      layout,
      riskValue: ticket.riskValue,
      slPips: ticket.slPips,
      tpPips: ticket.tpPips,
    });
  }, [
    showSessionsState,
    showLiquidityLevels,
    showWyckoff,
    showEma,
    showAutoFvg,
    showVolume,
    showRedNews,
    indicators,
    layout,
    ticket.riskValue,
    ticket.slPips,
    ticket.tpPips,
  ]);

  const toggleRedNews = useCallback(() => {
    setShowRedNews((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("limen_chart_show_red_news_v1", String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleJumpToTime = useCallback((targetTime: number) => {
    if (!chartRef.current || candlesRef.current.length === 0) return;
    const step = timeframeToSeconds(interval) || 3600;
    const curCandles = candlesRef.current;
    const lastBarTime = curCandles[curCandles.length - 1].time;
    let targetIdx = -1;
    if (targetTime <= lastBarTime) {
      targetIdx = curCandles.findIndex((c) => Math.abs(c.time - targetTime) < step);
    } else {
      const futureOffset = Math.round((targetTime - lastBarTime) / step);
      targetIdx = curCandles.length - 1 + futureOffset;
    }
    if (targetIdx >= 0) {
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: Math.max(0, targetIdx - 30),
        to: targetIdx + 30,
      });
    }
  }, [interval]);

  const isCleanChart = !showSessions && !showVolume && !showEma && !showAutoFvg && !showLiquidityLevels && !showWyckoff && indicators.every((i) => !i.on);

  const handleClearAllIndicators = () => {
    setIndicators((prev) => prev.map((ind) => ({ ...ind, on: false })));
    setShowEma(false);
    setShowAutoFvg(false);
    setShowLiquidityLevels(false);
    setShowWyckoff(false);
    setShowSessionsState(false);
    setSettings((prev) => ({ ...prev, showSessions: false }));
    if (typeof window !== "undefined") {
      localStorage.setItem("limen_clean_chart_mode", "true");
    }
  };

  const handleSelectAllIndicators = () => {
    setIndicators((prev) => prev.map((ind) => ({ ...ind, on: true })));
    setShowEma(true);
    setShowAutoFvg(true);
    setShowLiquidityLevels(true);
    setShowWyckoff(true);
    setShowSessionsState(true);
    setSettings((prev) => ({ ...prev, showSessions: true }));
    if (typeof window !== "undefined") {
      localStorage.setItem("limen_clean_chart_mode", "false");
    }
  };

  // Key structural swing/Wyckoff analysis on completed-bar boundaries so sub-second SSE ticks
  // on the forming candle do not re-scan 1000+ bars on the main thread.
  const structuralCandleKey = `${candles.length}:${candles[0]?.time ?? 0}:${candles[candles.length - 2]?.time ?? 0}:${candles[candles.length - 2]?.close ?? 0}`;
  const liquidityAnalysis = useMemo(
    () => analyzeInstitutionalLiquidity(candles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structuralCandleKey],
  );
  const wyckoffAnalysis = useMemo(
    () => analyzeWyckoffStructure(candles),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [structuralCandleKey],
  );

  // Dossier Setup Sigillati ne Il Libro della Verità + Calcolatore Esposizione Cumulativa
  const [sealedDrawerOpen, setSealedDrawerOpen] = useState(false);
  const [sealedSetups, setSealedSetups] = useState<any[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("limen_libro_verita_sealed_setups_v1");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onSealed = () => {
      try {
        const raw = localStorage.getItem("limen_libro_verita_sealed_setups_v1");
        if (raw) setSealedSetups(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener("limen:setup-sealed", onSealed);
    return () => window.removeEventListener("limen:setup-sealed", onSealed);
  }, []);

  const cumulativeExposure = useMemo(() => {
    const hasPositions = drawings.some((d) => d.kind === "position" && !d.hidden);
    if (!hasPositions) {
      return { count: 0, totalRisk: 0, totalReward: 0, totalLots: 0 };
    }
    const rawSym = symbol.includes(":") ? symbol.split(":").pop()! : symbol;
    const cleanSym = rawSym.trim().toUpperCase().replace(/[\/\-_]/g, "");
    const pipMult = getPipMultiplier(cleanSym);
    const pipVal = pipValuePerLot(cleanSym);
    let count = 0;
    let totalRisk = 0;
    let totalReward = 0;
    let totalLots = 0;
    for (const d of drawings) {
      if (d.kind !== "position" || d.hidden) continue;
      count += 1;
      const slPips = Math.abs(d.entry.price - d.slPrice) * pipMult;
      const tpPips = Math.abs(d.tpPrice - d.entry.price) * pipMult;
      const accountBalance = d.accountSize ?? 10000;
      const riskPct = d.riskPct ?? ticket.riskValue ?? 1;
      const cashRisk = Math.max(1, (accountBalance * riskPct) / 100);
      const lots = computeLots({ riskAmount: cashRisk, slPips, symbol: cleanSym });
      totalLots += lots;
      totalRisk += lots > 0 ? lots * slPips * pipVal : cashRisk;
      totalReward += lots > 0 ? lots * tpPips * pipVal : cashRisk * (slPips > 0 ? tpPips / slPips : 1);
    }
    return { count, totalRisk, totalReward, totalLots };
  }, [drawings, symbol, ticket.riskValue]);

  // Telemetria di sessione sotto il grafico (reattiva al minuto e agli orari personali, zero re-render al secondo)
  const minuteClock = useMinuteClock();
  const [sessionPrefVersion, setSessionPrefVersion] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPrefUpdate = () => setSessionPrefVersion((v) => v + 1);
    window.addEventListener("aureus:session-preferences-updated", onPrefUpdate);
    return () => window.removeEventListener("aureus:session-preferences-updated", onPrefUpdate);
  }, []);
  const currentSession = useMemo(() => getLimenSessionInfo(minuteClock), [minuteClock, sessionPrefVersion]);

  // Ricarica disegni al cambio simbolo o interval
  useEffect(() => {
    setDrawingsState(loadChartDrawings(symbol, interval));
  }, [symbol, interval]);

  // Listener per sincronizzazione cross-window / cross-view di disegni
  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawSym = symbol.includes(":") ? symbol.split(":").pop()! : symbol;
    const cleanSym = rawSym.trim().toUpperCase().replace(/[\/\-_]/g, "");
    const onDrawingsSync = (event: Event) => {
      const detail = (event as CustomEvent<{ symbol?: string; drawings?: ReplayDrawing[] }>).detail;
      if (!detail || detail.symbol !== cleanSym || !Array.isArray(detail.drawings)) return;
      setDrawingsState((prev) => (prev === detail.drawings ? prev : detail.drawings!));
      setRevision((r) => r + 1);
    };
    window.addEventListener(DRAWINGS_SYNC_EVENT, onDrawingsSync);
    return () => window.removeEventListener(DRAWINGS_SYNC_EVENT, onDrawingsSync);
  }, [symbol]);

  // Sincronizza candele per la Sentinella AI (throttled a 250ms per non saturare il Cockpit sui tick live)
  const lastCandlesUpdateNotifyRef = useRef<number>(0);
  useEffect(() => {
    if (candles.length === 0 || !onCandlesUpdate) return;
    const nowMs = performance.now();
    const elapsed = nowMs - lastCandlesUpdateNotifyRef.current;
    if (elapsed >= 250) {
      lastCandlesUpdateNotifyRef.current = nowMs;
      onCandlesUpdate(candles);
      return;
    }
    const timer = window.setTimeout(() => {
      lastCandlesUpdateNotifyRef.current = performance.now();
      onCandlesUpdate(candles);
    }, 250 - elapsed);
    return () => window.clearTimeout(timer);
  }, [candles, onCandlesUpdate]);

  // Sincronizza riferimento canvas grafico per screenshot AI (solo al mount/cambio istanza chart)
  useEffect(() => {
    if (chartCanvasRef && containerRef.current) {
      chartCanvasRef.current = containerRef.current.querySelector("canvas") || null;
    }
  }, [chartCanvasRef, chartInstance]);

  const handleUpdateDrawings = useCallback(
    (action: ReplayDrawing[] | ((prev: ReplayDrawing[]) => ReplayDrawing[])) => {
      setDrawingsState((prev) => {
        const next = typeof action === "function" ? action(prev) : action;
        saveChartDrawings(symbol, interval, next, "varco");
        return next;
      });
      setRevision((r) => r + 1);
    },
    [symbol, interval],
  );

  const handleClearDrawings = useCallback(() => {
    clearChartDrawings(symbol, interval);
    setDrawingsState([]);
    setRevision((r) => r + 1);
  }, [symbol, interval]);

  const handleUpdateSingleDrawing = useCallback(
    (drawing: ReplayDrawing) => {
      handleUpdateDrawings((prev) =>
        prev.map((d) => (d.id === drawing.id ? drawing : d)),
      );
    },
    [handleUpdateDrawings],
  );

  const handleDeleteSingleDrawing = useCallback(
    (id: string) => {
      handleUpdateDrawings((prev) => prev.filter((d) => d.id !== id));
      if (selectedDrawingId === id) setSelectedDrawingId(null);
    },
    [handleUpdateDrawings, selectedDrawingId],
  );

  const handleClearPositions = useCallback(() => {
    handleUpdateDrawings((prev) => prev.filter((d) => d.kind !== "position"));
    synestheticAlert();
  }, [handleUpdateDrawings]);

  // Selettore Rapido Dimensione Capitale Conto (10k / 25k / 50k / 100k / 200k)
  const REPLAY_CAPITAL_OPTIONS = [10000, 25000, 50000, 100000, 200000] as const;
  const [replayCapitalSize, setReplayCapitalSize] = useState<number>(() => {
    if (typeof window === "undefined") return 10000;
    const saved = localStorage.getItem("limen_replay_capital_size_v1");
    const num = saved ? Number(saved) : 10000;
    return REPLAY_CAPITAL_OPTIONS.includes(num as any) ? num : 10000;
  });

  const cycleReplayCapitalSize = useCallback(() => {
    setReplayCapitalSize((prev) => {
      const idx = REPLAY_CAPITAL_OPTIONS.indexOf(prev as any);
      const next = REPLAY_CAPITAL_OPTIONS[(idx + 1) % REPLAY_CAPITAL_OPTIONS.length];
      try {
        localStorage.setItem("limen_replay_capital_size_v1", String(next));
      } catch {}
      return next;
    });
    synestheticAlert();
  }, []);

  // Calcolo Dinamico Conto Simulazione Replay su Base Capitale Sovrano Selezionato
  const replayAccountState = useMemo(() => {
    const hasPositions = drawings.some((d) => d.kind === "position" && !d.hidden);
    if (!hasPositions) {
      return {
        baseCapital: replayCapitalSize,
        balance: replayCapitalSize,
        equity: replayCapitalSize,
        realizedPnl: 0,
        unrealizedPnl: 0,
        totalNetPnl: 0,
        totalNetPnlPct: 0,
        openPositionsCount: 0,
        closedTradesCount: 0,
        winCount: 0,
        lossCount: 0,
        totalLotsActive: 0,
        closedTradesList: [],
      };
    }

    const rawSym = symbol.includes(":") ? symbol.split(":").pop()! : symbol;
    const cleanSym = rawSym.trim().toUpperCase().replace(/[\/\-_]/g, "");
    const pipMult = getPipMultiplier(cleanSym);
    const pipVal = pipValuePerLot(cleanSym);

    const effectiveCutIndex =
      replayActive && replayCutIndex != null
        ? Math.min(candles.length - 1, replayCutIndex)
        : candles.length - 1;
    const currentBar = candles[effectiveCutIndex];
    const visibleBars = candles.slice(0, effectiveCutIndex + 1);

    let realizedPnl = 0;
    let unrealizedPnl = 0;
    let openPositionsCount = 0;
    let closedTradesCount = 0;
    let winCount = 0;
    let lossCount = 0;
    let totalLotsActive = 0;
    const closedTradesList: Array<{
      id: string;
      direction: TradeDirection;
      entryPrice: number;
      exitPrice: number;
      pnl: number;
      outcome: "win" | "loss" | "be";
      lots: number;
    }> = [];

    for (const d of drawings) {
      if (d.kind !== "position" || d.hidden) continue;

      const slPips = Math.abs(d.entry.price - d.slPrice) * pipMult;
      const tpPips = Math.abs(d.tpPrice - d.entry.price) * pipMult;
      const riskPct = d.riskPct ?? ticket.riskValue ?? 1;
      const cashRisk = Math.max(1, (replayCapitalSize * riskPct) / 100);
      const lots = computeLots({ riskAmount: cashRisk, slPips, symbol: cleanSym });
      const maxReward = lots > 0 ? lots * tpPips * pipVal : cashRisk * (slPips > 0 ? tpPips / slPips : 1);
      const maxRisk = lots > 0 ? lots * slPips * pipVal : cashRisk;
      const isLong = d.direction === "buy";

      if (!currentBar) continue;
      if (d.entry.time > currentBar.time) continue;

      const entryBarIdx = visibleBars.findIndex((b) => b.time >= d.entry.time);
      if (entryBarIdx === -1) continue;

      let closed = false;
      let outcomePnl = 0;
      let exitPrice = d.entry.price;
      let outcome: "win" | "loss" | "be" = "be";

      for (let i = entryBarIdx; i < visibleBars.length; i++) {
        const bar = visibleBars[i];
        const hitTp = isLong ? bar.high >= d.tpPrice : bar.low <= d.tpPrice;
        const hitSl = isLong ? bar.low <= d.slPrice : bar.high >= d.slPrice;

        if (hitTp && hitSl) {
          closed = true;
          outcomePnl = -maxRisk;
          exitPrice = d.slPrice;
          outcome = "loss";
          lossCount += 1;
          break;
        } else if (hitTp) {
          closed = true;
          outcomePnl = maxReward;
          exitPrice = d.tpPrice;
          outcome = "win";
          winCount += 1;
          break;
        } else if (hitSl) {
          closed = true;
          const isAtBe = Math.abs(d.slPrice - d.entry.price) < 0.0001;
          outcomePnl = isAtBe ? 0 : -maxRisk;
          exitPrice = d.slPrice;
          outcome = isAtBe ? "be" : "loss";
          if (outcomePnl < 0) lossCount += 1;
          break;
        }
      }

      if (closed) {
        realizedPnl += outcomePnl;
        closedTradesCount += 1;
        closedTradesList.push({
          id: d.id,
          direction: d.direction,
          entryPrice: d.entry.price,
          exitPrice,
          pnl: outcomePnl,
          outcome,
          lots,
        });
      } else {
        openPositionsCount += 1;
        totalLotsActive += lots;
        const priceDiff = isLong ? currentBar.close - d.entry.price : d.entry.price - currentBar.close;
        const floatingPips = priceDiff * pipMult;
        const floatingPnl = lots > 0 ? floatingPips * pipVal * lots : (floatingPips / (slPips || 1)) * cashRisk;
        unrealizedPnl += floatingPnl;
      }
    }

    const balance = replayCapitalSize + realizedPnl;
    const equity = balance + unrealizedPnl;
    const totalNetPnl = equity - replayCapitalSize;
    const totalNetPnlPct = (totalNetPnl / replayCapitalSize) * 100;

    return {
      baseCapital: replayCapitalSize,
      balance,
      equity,
      realizedPnl,
      unrealizedPnl,
      totalNetPnl,
      totalNetPnlPct,
      openPositionsCount,
      closedTradesCount,
      winCount,
      lossCount,
      totalLotsActive,
      closedTradesList,
    };
  }, [drawings, symbol, ticket.riskValue, replayActive, replayCutIndex, candles, replayCapitalSize]);

  // ── Sentinella di Prezzo: Alert Sonori Sinestesici sui Livelli Tracciati ────
  const triggeredAlertsRef = useRef<Map<string, number>>(new Map());

  const checkPriceCrossAlerts = useCallback(
    (currentPrice: number, previousPrice: number) => {
      if (previousPrice <= 0 || currentPrice <= 0) return;
      const now = Date.now();

      for (const d of drawings) {
        if (d.hidden) continue;
        let targetPrice: number | null = null;
        if (d.kind === "hline") targetPrice = d.price;
        else if (d.kind === "hray") targetPrice = d.at.price;

        if (targetPrice == null) continue;

        const crossedAbove = previousPrice < targetPrice && currentPrice >= targetPrice;
        const crossedBelow = previousPrice > targetPrice && currentPrice <= targetPrice;

        if (crossedAbove || crossedBelow) {
          const lastTriggered = triggeredAlertsRef.current.get(d.id) ?? 0;
          if (now - lastTriggered > 60_000) {
            triggeredAlertsRef.current.set(d.id, now);
            synestheticAlert();
          }
        }
      }
    },
    [drawings],
  );

  // ── Keyboard Shortcuts TradingView Pro (Hotkeys) ───────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      // Alt+H -> Linea orizzontale
      if (e.altKey && e.key.toLowerCase() === "h") {
        e.preventDefault();
        const price = hoverBar?.close ?? (candles.length > 0 ? candles[candles.length - 1].close : 0);
        if (price > 0) {
          const newHline: ReplayDrawing = {
            id: `drw-hline-${Date.now()}`,
            kind: "hline",
            price,
            color: settings.toolColor || "#C5A059",
            width: 1,
            style: "solid",
          };
          handleUpdateDrawings((prev) => [...prev, newHline]);
        }
        return;
      }

      // Alt+J -> Semiretta orizzontale (HRay)
      if (e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        const nowSec = hoverBar?.time ?? (candles.length > 0 ? candles[candles.length - 1].time : Math.floor(Date.now() / 1000));
        const price = hoverBar?.close ?? (candles.length > 0 ? candles[candles.length - 1].close : 0);
        if (price > 0) {
          const newHray: ReplayDrawing = {
            id: `drw-hray-${Date.now()}`,
            kind: "hray",
            at: { time: nowSec, price },
            color: settings.toolColor || "#C5A059",
            width: 1,
            style: "solid",
          };
          handleUpdateDrawings((prev) => [...prev, newHray]);
        }
        return;
      }

      // Alt+T -> Trendline
      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setActiveTool("trend");
        return;
      }

      // Alt+F -> Fibonacci
      if (e.altKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setActiveTool("fib");
        return;
      }

      // Alt+R -> Rettangolo SMC
      if (e.altKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setActiveTool("rect");
        return;
      }

      // Alt+N -> Toggle Naked Institutional Mode (Grafico Pulito / Indicatori Sovrani)
      if (e.altKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        if (isCleanChart) {
          handleSelectAllIndicators();
        } else {
          handleClearAllIndicators();
        }
        return;
      }

      // Esc -> Torna al cursore
      if (e.key === "Escape") {
        setActiveTool("cursor");
        setSelectedDrawingId(null);
        return;
      }

      // Replay Bar-by-Bar Stepping (FX Replay Standard)
      if (replayActive) {
        if (e.key === " ") {
          e.preventDefault();
          setReplayPlaying((prev) => !prev);
          return;
        }
        if (e.key === "ArrowRight") {
          e.preventDefault();
          setReplayCutIndex((prev) => {
            const next = Math.min(candles.length - 1, (prev ?? candles.length - 1) + 1);
            return next;
          });
          synestheticAlert();
          return;
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          setReplayCutIndex((prev) => {
            const next = Math.max(5, (prev ?? candles.length - 1) - 1);
            return next;
          });
          synestheticAlert();
          return;
        }
      }

      // Quick Numeric Jump Timeframe (1, 5, 1H, 4H, 1D, 1W)
      if (!e.altKey && !e.ctrlKey && !e.metaKey && onIntervalChange) {
        if (e.key === "1") onIntervalChange("1");
        else if (e.key === "5") onIntervalChange("5");
        else if (e.key === "h" || e.key === "H") onIntervalChange("60");
        else if (e.key === "4") onIntervalChange("240");
        else if (e.key === "D" || e.key === "d") onIntervalChange("D");
        else if (e.key === "W" || e.key === "w") onIntervalChange("W");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [candles, hoverBar, onIntervalChange, settings.toolColor, handleUpdateDrawings]);

  // ── 1. Inizializzazione Canvas Lightweight Charts ──────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Colori background
    const isGradient = settings.chartBgType === "gradient";
    const bgConfig = isGradient
      ? {
          type: ColorType.VerticalGradient,
          topColor: settings.chartBgColor1 || "#0d1017",
          bottomColor: settings.chartBgColor2 || "#08080a",
        }
      : {
          type: ColorType.Solid,
          color: settings.chartBgColor1 || "#08080a",
        };

    // Price Scale Mode
    const scaleMode =
      settings.priceScaleMode === "logarithmic"
        ? PriceScaleMode.Logarithmic
        : settings.priceScaleMode === "percentage"
          ? PriceScaleMode.Percentage
          : PriceScaleMode.Normal;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      autoSize: true,
      layout: {
        background: bgConfig,
        textColor: settings.textColor || "#a1a1aa",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        attributionLogo: false, // Rimuove logo TradingView
      },
      grid: {
        vertLines: { color: settings.gridColor || "rgba(255, 255, 255, 0.03)" },
        horzLines: { color: settings.gridColor || "rgba(255, 255, 255, 0.03)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: settings.crosshairColor || "rgba(212, 175, 55, 0.4)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#18181b",
        },
        horzLine: {
          color: settings.crosshairColor || "rgba(212, 175, 55, 0.4)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#18181b",
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.12)",
        mode: scaleMode,
        invertScale: false,
        autoScale: true,
      },
      timeScale: {
        visible: true,
        borderVisible: true,
        borderColor: "rgba(255, 255, 255, 0.12)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 24,
        shiftVisibleRangeOnNewBar: true,
      },
      localization: {
        locale: "it-IT",
        timeFormatter: (time: Time) => {
          if (typeof time !== "number") return String(time);
          return new Intl.DateTimeFormat("it-IT", {
            timeZone: "Europe/Rome",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(time * 1000));
        },
      },
    });

    chartRef.current = chart;

    // Sottoserie Volume
    const volSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volSeries.applyOptions({ visible: showVolume });
    volumeSeriesRef.current = volSeries;

    // Serie Principale (Candlestick o Line)
    const upCol = settings.candleUpColor || UP_COLOR;
    const dnCol = settings.candleDownColor || DOWN_COLOR;

    if (chartType === "line") {
      const lineSeries = chart.addSeries(LineSeries, {
        color: settings.lineColor || "#d4af37",
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: settings.showLastPriceLine !== false,
      });
      priceSeriesRef.current = lineSeries;
    } else {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: upCol,
        downColor: dnCol,
        borderUpColor: settings.borderUpColor || upCol,
        borderDownColor: settings.borderDownColor || dnCol,
        wickUpColor: settings.wickUpColor || upCol,
        wickDownColor: settings.wickDownColor || dnCol,
        borderVisible: settings.candleBordersVisible !== false,
        wickVisible: settings.candleWicksVisible !== false,
        lastValueVisible: false,
        priceLineVisible: settings.showLastPriceLine !== false,
      });
      priceSeriesRef.current = candleSeries;
    }

    // Serie invisibile di Orizzonte Futuro (WhitespaceData per asse temporale e News future senza interferire con .update() live)
    futureHorizonSeriesRef.current = chart.addSeries(LineSeries, {
      color: "rgba(0, 0, 0, 0)",
      lineWidth: 1,
      visible: true,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

    // Indicatori EMA
    ema20Ref.current = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 1,
      visible: false,
      title: "EMA 20",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema50Ref.current = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      visible: false,
      title: "EMA 50",
      priceLineVisible: false,
      lastValueVisible: false,
    });
    ema200Ref.current = chart.addSeries(LineSeries, {
      color: "#8b5cf6",
      lineWidth: 2,
      visible: false,
      title: "EMA 200",
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Filigrana discreta TradingView-style
    if (settings.showWatermark !== false) {
      watermarkRef.current = createTextWatermark(chart.panes()[0], {
        horzAlign: "center",
        vertAlign: "center",
        lines: [
          {
            text: `${formatCleanPairLabel(symbol)}  ·  ${formatHumanTimeframe(interval)}`,
            color: "rgba(255, 255, 255, 0.04)",
            fontSize: 32,
            fontStyle: "bold",
          },
        ],
      });
    }

    // Crosshair hover listener per OHLC legend + Telemetria Orizzonte Futuro (RAF-throttled & deduplicato per 120 FPS)
    let hoverRaf: number | null = null;
    let pendingHover: CandleBar | null | undefined = undefined;
    let pendingCrosshairY: number | null = null;
    let pendingCrosshairDetails: {
      x: number;
      y: number;
      time: number;
      price: number | null;
      isFuture: boolean;
      barsDelta: number;
    } | null = null;

    chart.subscribeCrosshairMove((param) => {
      if (param.point && typeof param.point.y === "number" && typeof param.point.x === "number") {
        pendingCrosshairY = param.point.y;
        const curBars = candlesRef.current;
        const tfSec = timeframeToSeconds(interval);
        const priceAtY = priceSeriesRef.current?.coordinateToPrice(param.point.y) ?? null;
        let resolvedTime: number | null =
          typeof param.time === "number" ? param.time : null;
        let logicalIdx: number | null =
          typeof param.logical === "number"
            ? param.logical
            : chart.timeScale().coordinateToLogical(param.point.x);

        if (resolvedTime == null && logicalIdx != null && curBars.length > 0) {
          resolvedTime = timeAtLogicalIndex(curBars as any, logicalIdx, tfSec);
        }

        if (resolvedTime != null && curBars.length > 0) {
          const lastBar = curBars[curBars.length - 1]!;
          const isFuture = resolvedTime > lastBar.time;
          const barsDelta =
            logicalIdx != null
              ? Math.round(logicalIdx - (curBars.length - 1))
              : Math.round((resolvedTime - lastBar.time) / Math.max(60, tfSec));
          pendingCrosshairDetails = {
            x: param.point.x,
            y: param.point.y,
            time: resolvedTime,
            price: priceAtY != null && Number.isFinite(priceAtY) ? priceAtY : null,
            isFuture,
            barsDelta,
          };
        } else {
          pendingCrosshairDetails = null;
        }
      } else {
        pendingCrosshairY = null;
        pendingCrosshairDetails = null;
      }

      if (!param.time || !param.seriesData) {
        pendingHover = null;
      } else {
        const data = param.seriesData.get(priceSeriesRef.current!) as any;
        if (data && (data.close != null || data.value != null)) {
          pendingHover = {
            time: typeof param.time === "number" ? param.time : 0,
            open: data.open ?? data.value,
            high: data.high ?? data.value,
            low: data.low ?? data.value,
            close: data.close ?? data.value,
          };
        } else {
          pendingHover = null;
        }
      }
      if (hoverRaf != null) return;
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = null;
        setCrosshairY((prevY) => (prevY === pendingCrosshairY ? prevY : pendingCrosshairY));
        setCrosshairDetails((prevD) => {
          if (prevD === null && pendingCrosshairDetails === null) return prevD;
          if (
            prevD &&
            pendingCrosshairDetails &&
            prevD.time === pendingCrosshairDetails.time &&
            Math.abs(prevD.x - pendingCrosshairDetails.x) < 1 &&
            Math.abs(prevD.y - pendingCrosshairDetails.y) < 1
          ) {
            return prevD;
          }
          return pendingCrosshairDetails;
        });
        if (pendingHover === undefined) return;
        const next = pendingHover;
        setHoverBar((prev) => {
          if (prev === null && next === null) return prev;
          if (
            prev &&
            next &&
            prev.time === next.time &&
            prev.close === next.close &&
            prev.open === next.open &&
            prev.high === next.high &&
            prev.low === next.low
          ) {
            return prev;
          }
          return next;
        });
      });
    });

    let animFrame: number | null = null;
    const scheduleRevision = () => {
      if (animFrame != null) return;
      animFrame = requestAnimationFrame(() => {
        animFrame = null;
        setRevision((r) => r + 1);
      });
    };

    // Tracker inerzia cinetica + drag verticale scala prezzi (120 FPS lockstep per i disegni)
    let kineticRaf: number | null = null;
    let kineticUntil = 0;
    let isPointerActive = false;
    let lastTopPrice: number | null = null;
    let lastBottomPrice: number | null = null;
    let lastFromLogical: number | null = null;
    let lastToLogical: number | null = null;

    const runKineticTick = () => {
      kineticRaf = null;
      const pSeries = priceSeriesRef.current;
      const lRange = chart.timeScale().getVisibleLogicalRange();
      const topP = pSeries?.coordinateToPrice(0) ?? null;
      const botP = pSeries?.coordinateToPrice(container.clientHeight || 400) ?? null;
      const fromL = lRange?.from ?? null;
      const toL = lRange?.to ?? null;

      if (
        topP !== lastTopPrice ||
        botP !== lastBottomPrice ||
        fromL !== lastFromLogical ||
        toL !== lastToLogical
      ) {
        lastTopPrice = topP;
        lastBottomPrice = botP;
        lastFromLogical = fromL;
        lastToLogical = toL;
        setRevision((r) => r + 1);
      }

      if (isPointerActive || performance.now() < kineticUntil) {
        kineticRaf = requestAnimationFrame(runKineticTick);
      }
    };

    const startKineticSync = (tailMs = 650) => {
      kineticUntil = Math.max(kineticUntil, performance.now() + tailMs);
      if (kineticRaf == null) {
        kineticRaf = requestAnimationFrame(runKineticTick);
      }
    };

    // Resize Observer
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        chart.resize(width, height);
        setOverlaySize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }));
        scheduleRevision();
      }
    });
    ro.observe(container);

    const onVisibleRangeChange = () => scheduleRevision();
    const onLogicalRangeChange = (range: { from: number; to: number } | null) => {
      scheduleRevision();
      if (range && range.from < 50) loadOlderRef.current();
      const total = candlesRef.current.length;
      if (range && total > 10) {
        const away = range.to < total - 10 || range.from > total + 4;
        setIsScrolledAway((prev) => (prev === away ? prev : away));
      } else {
        setIsScrolledAway(false);
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onLogicalRangeChange);
    chart.timeScale().subscribeVisibleTimeRangeChange(onVisibleRangeChange);
    setChartInstance((c) => c + 1);

    const onPointerDown = () => {
      isPointerActive = true;
      scheduleRevision();
      startKineticSync(250);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.buttons > 0 || isPointerActive) {
        scheduleRevision();
        startKineticSync(350);
      }
    };
    const onPointerUp = () => {
      isPointerActive = false;
      scheduleRevision();
      startKineticSync(700);
    };
    const onWheel = () => {
      scheduleRevision();
      startKineticSync(500);
    };

    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    container.addEventListener("touchstart", onPointerDown, { passive: true });
    container.addEventListener("touchmove", onWheel, { passive: true });
    container.addEventListener("touchend", onPointerUp, { passive: true });
    container.addEventListener("wheel", onWheel, { passive: true });

    const catalogMap = catalogSeriesRef.current;

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("touchstart", onPointerDown);
      container.removeEventListener("touchmove", onWheel);
      container.removeEventListener("touchend", onPointerUp);
      container.removeEventListener("wheel", onWheel);
      if (animFrame != null) cancelAnimationFrame(animFrame);
      if (hoverRaf != null) cancelAnimationFrame(hoverRaf);
      if (kineticRaf != null) cancelAnimationFrame(kineticRaf);
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onLogicalRangeChange);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onVisibleRangeChange);
      watermarkRef.current?.detach();
      catalogMap.clear();
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
      futureHorizonSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [
    chartType,
    settings.chartBgType,
    settings.chartBgColor1,
    settings.chartBgColor2,
    settings.gridColor,
    settings.textColor,
    settings.candleUpColor,
    settings.candleDownColor,
    settings.borderUpColor,
    settings.borderDownColor,
    settings.wickUpColor,
    settings.wickDownColor,
    settings.candleBordersVisible,
    settings.candleWicksVisible,
    settings.lineColor,
    settings.showLastPriceLine,
    settings.priceScaleMode,
    settings.showWatermark,
  ]);

  // ── Sincronizzazione Reattiva Dati Serie (Garantisce Candele + Orizzonte Futuro Sempre Visibili) ──
  useEffect(() => {
    if (!priceSeriesRef.current || candles.length === 0) return;
    const isFullReload =
      Math.abs(candles.length - lastRenderedCountRef.current) > 1 ||
      prependShiftRef.current > 0 ||
      lastRenderedTypeRef.current !== chartType ||
      lastRenderedInstanceRef.current !== chartInstance;

    if (isFullReload) {
      lastRenderedCountRef.current = candles.length;
      lastRenderedTypeRef.current = chartType;
      lastRenderedInstanceRef.current = chartInstance;

      const displayBars = chartType === "heikin" ? toHeikinAshi(candles) : candles;
      priceSeriesRef.current.setData(
        displayBars.map((b) => ({
          time: b.time as Time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          value: b.close,
        })) as any,
      );
      if (futureHorizonSeriesRef.current && displayBars.length > 0) {
        const lastBar = displayBars[displayBars.length - 1]!;
        const futureWhitespace = getFutureWhitespaceBars(lastBar.time, intervalRef.current);
        futureHorizonSeriesRef.current.setData([
          { time: lastBar.time as Time, value: lastBar.close },
          ...futureWhitespace,
        ] as any);
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(
          candles.map((b) => ({
            time: b.time as Time,
            value: b.volume ?? 0,
            color: b.close >= b.open ? "rgba(197, 160, 89, 0.4)" : "rgba(224, 86, 102, 0.4)",
          })),
        );
      }
      const totalBars = displayBars.length;
      const prependShift = prependShiftRef.current;
      prependShiftRef.current = 0;
      const currentRange = chartRef.current?.timeScale().getVisibleLogicalRange();
      if (prependShift > 0 && currentRange) {
        // Older history was prepended: keep the operator on the same candles.
        chartRef.current?.timeScale().setVisibleLogicalRange({
          from: currentRange.from + prependShift,
          to: currentRange.to + prependShift,
        });
      } else {
        const anchor = cameraAnchorRef.current;
        if (anchor && !anchor.isNearLive && anchor.centerTime != null) {
          let closestIdx = -1;
          let minDelta = Infinity;
          for (let i = 0; i < totalBars; i++) {
            const delta = Math.abs(displayBars[i].time - anchor.centerTime);
            if (delta < minDelta) {
              minDelta = delta;
              closestIdx = i;
            }
          }
          if (closestIdx >= 0) {
            const span = Math.min(100, totalBars);
            chartRef.current?.timeScale().setVisibleLogicalRange({
              from: Math.max(0, closestIdx - Math.floor(span / 2)),
              to: closestIdx + Math.floor(span / 2),
            });
          } else {
            const visibleBars = Math.min(120, totalBars);
            chartRef.current?.timeScale().setVisibleLogicalRange({
              from: Math.max(0, totalBars - visibleBars),
              to: totalBars + 20,
            });
          }
        } else {
          const visibleBars = Math.min(120, totalBars);
          chartRef.current?.timeScale().setVisibleLogicalRange({
            from: Math.max(0, totalBars - visibleBars),
            to: totalBars + 20,
          });
        }
      }
      setRevision((r) => r + 1);
    }
  }, [candles, chartType, chartInstance]);

  // Aggiorna watermark al cambio simbolo o interval
  useEffect(() => {
    if (!watermarkRef.current || !chartRef.current) return;
    watermarkRef.current.detach();
    if (settings.showWatermark !== false) {
      watermarkRef.current = createTextWatermark(chartRef.current.panes()[0], {
        horzAlign: "center",
        vertAlign: "center",
        lines: [
          {
            text: `${formatCleanPairLabel(symbol)}  ·  ${formatHumanTimeframe(interval)}`,
            color: "rgba(255, 255, 255, 0.04)",
            fontSize: 32,
            fontStyle: "bold",
          },
        ],
      });
    }
  }, [symbol, interval, settings.showWatermark]);

  // ── 2. Data Loading & Real-Time Tick Stream ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const rawSym = symbol.includes(":") ? symbol.split(":").pop()! : symbol;
    const cleanSym = rawSym.trim().toUpperCase().replace(/[\/\-_]/g, "");
    const apiTf = normalizeToApiInterval(interval);

    // Idratazione istantanea da cache locale al cambio coppia/timeframe
    const cached = loadCachedCandles(cleanSym, apiTf);
    if (cached && cached.length > 0 && candlesRef.current.length === 0) {
      setCandles(cached);
    }

    const loadHistory = async () => {
      try {
        setFeedStatus("connecting");
        // Salva il centro dell'inquadratura e l'ancoraggio live prima del fetch del nuovo timeframe
        const currentLogicalRange = chartRef.current?.timeScale().getVisibleLogicalRange();
        const currentTimeRange = chartRef.current?.timeScale().getVisibleRange();
        const totalCurrentBars = candlesRef.current.length;
        const isNearLive = Boolean(
          currentLogicalRange &&
          totalCurrentBars > 0 &&
          currentLogicalRange.to >= totalCurrentBars - 8,
        );
        let centerTime: number | null = null;
        if (currentTimeRange && typeof currentTimeRange.from === "number" && typeof currentTimeRange.to === "number") {
          centerTime = Math.floor((currentTimeRange.from + currentTimeRange.to) / 2);
        }
        cameraAnchorRef.current = { centerTime, isNearLive };

        const res = await fetch(`/api/backtest/candles?symbol=${cleanSym}&interval=${apiTf}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        if (data && Array.isArray(data.candles) && data.candles.length > 0) {
          const bars: CandleBar[] = data.candles.map((c: any) => ({
            time: typeof c.time === "number" ? c.time : Math.floor(new Date(c.time).getTime() / 1000),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: c.volume != null ? Number(c.volume) : undefined,
          }));

          saveCachedCandles(cleanSym, apiTf, bars);
          const displayBars = chartType === "heikin" ? toHeikinAshi(bars) : bars;
          setCandles(bars);

          if (priceSeriesRef.current && displayBars.length > 0) {
            const lastBar = displayBars[displayBars.length - 1]!;
            const lastBarTime = lastBar.time;
            const futureWhitespace = getFutureWhitespaceBars(lastBarTime, interval);
            priceSeriesRef.current.setData(
              displayBars.map((b) => ({
                time: b.time as Time,
                open: b.open,
                high: b.high,
                low: b.low,
                close: b.close,
                value: b.close,
              })) as any,
            );
            futureHorizonSeriesRef.current?.setData([
              { time: lastBarTime as Time, value: lastBar.close },
              ...futureWhitespace,
            ] as any);
          }
          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.setData(
              bars.map((b) => ({
                time: b.time as Time,
                value: b.volume ?? 0,
                color: b.close >= b.open ? "rgba(38, 166, 154, 0.35)" : "rgba(239, 83, 80, 0.35)",
              })),
            );
          }
          const totalBars = displayBars.length;
          const anchor = cameraAnchorRef.current;
          if (anchor && !anchor.isNearLive && anchor.centerTime != null) {
            let closestIdx = -1;
            let minDelta = Infinity;
            for (let i = 0; i < totalBars; i++) {
              const delta = Math.abs(displayBars[i].time - anchor.centerTime);
              if (delta < minDelta) {
                minDelta = delta;
                closestIdx = i;
              }
            }
            if (closestIdx >= 0) {
              const span = Math.min(100, totalBars);
              chartRef.current?.timeScale().setVisibleLogicalRange({
                from: Math.max(0, closestIdx - Math.floor(span / 2)),
                to: closestIdx + Math.floor(span / 2),
              });
            } else {
              const visibleBars = Math.min(120, totalBars);
              chartRef.current?.timeScale().setVisibleLogicalRange({
                from: Math.max(0, totalBars - visibleBars),
                to: totalBars + 24,
              });
            }
          } else {
            const visibleBars = Math.min(120, totalBars);
            chartRef.current?.timeScale().setVisibleLogicalRange({
              from: Math.max(0, totalBars - visibleBars),
              to: totalBars + 24,
            });
          }
          setFeedStatus("live");
          setStatusMessage("TV Real-Time Feed Attivo");
          setRevision((r) => r + 1);
        }
      } catch (e) {
        console.warn("[LimenChart] Error loading historical candles:", e);
        setFeedStatus("fallback");
        setStatusMessage("Dati AUREUS Fallback");
      }
    };

    loadHistory();

    // Infinite backward history: when the operator pans near the left edge, prepend
    // the previous page from the permanent archive (down to the first stored quote).
    let loadingOlder = false;
    let hasOlder = true;
    const parseBars = (rows: any[]): CandleBar[] =>
      rows.map((c: any) => ({
        time: typeof c.time === "number" ? c.time : Math.floor(new Date(c.time).getTime() / 1000),
        open: Number(c.open),
        high: Number(c.high),
        low: Number(c.low),
        close: Number(c.close),
        volume: c.volume != null ? Number(c.volume) : undefined,
      }));
    loadOlderRef.current = () => {
      const current = candlesRef.current;
      if (cancelled || loadingOlder || !hasOlder || current.length === 0) return;
      const oldest = current[0].time;
      loadingOlder = true;
      const query = `symbol=${cleanSym}&interval=${apiTf}&to=${oldest}&limit=2000`;
      const fetchPage = async (): Promise<CandleBar[]> => {
        // Permanent replay archive first (reaches 2020); generic warehouse as fallback.
        try {
          const res = await fetch(`/api/backtest/candles?${query}&mode=replay`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.candles)) return parseBars(data.candles);
          }
        } catch { /* fall through to the generic window */ }
        const res = await fetch(`/api/backtest/candles?${query}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return Array.isArray(data?.candles) ? parseBars(data.candles) : [];
      };
      fetchPage()
        .then((bars) => {
          if (cancelled) return;
          const older = bars.filter((b) => b.time < oldest);
          if (older.length === 0) { hasOlder = false; return; }
          prependShiftRef.current = older.length;
          setCandles((prev) => {
            const first = prev[0]?.time ?? Infinity;
            const fresh = older.filter((b) => b.time < first);
            if (fresh.length !== older.length) prependShiftRef.current = fresh.length;
            const merged = fresh.length ? [...fresh, ...prev] : prev;
            // Sliding window massimo di 6.000 candele per preservare la memoria e il garbage collector del browser
            return merged.length > 6000 ? merged.slice(0, 6000) : merged;
          });
        })
        .catch((e) => console.warn("[LimenChart] Older history unavailable:", e))
        .finally(() => { loadingOlder = false; });
    };

    // SSE Real-Time Ticks from TradingView Bridge
    let sse: EventSource | null = null;
    try {
      sse = new EventSource(`/api/candles/live?symbol=${cleanSym}&interval=${apiTf}`);

      sse.onmessage = (event) => {
        if (cancelled) return;
        try {
          const tick = JSON.parse(event.data);
          if (tick && tick.status === "connected") {
            setFeedStatus("live");
            setStatusMessage("TV Real-Time Connesso");
            return;
          }
          if (tick && typeof tick.time === "number" && tick.close != null) {
            const bar: CandleBar = {
              time: tick.time,
              open: tick.open,
              high: tick.high,
              low: tick.low,
              close: tick.close,
              volume: tick.volume,
            };
            setFeedStatus("live");
            setStatusMessage("TV Real-Time · Live");
            setCandles((prev) => {
              const last = prev.length > 0 ? prev[prev.length - 1] : null;
              if (last && last.close != null) {
                checkPriceCrossAlerts(bar.close, last.close);
              }
              if (prev.length === 0) return [bar];
              if (last && last.time >= bar.time) {
                return [...prev.slice(0, -1), bar];
              }
              return [...prev, bar];
            });

            if (priceSeriesRef.current) {
              try {
                priceSeriesRef.current.update({
                  time: bar.time as Time,
                  open: bar.open,
                  high: bar.high,
                  low: bar.low,
                  close: bar.close,
                  value: bar.close,
                } as any);
              } catch (e) {
                console.warn("[LimenChart] SSE tick update skipped:", e);
              }
            }

            if (volumeSeriesRef.current && bar.volume != null) {
              volumeSeriesRef.current.update({
                time: bar.time as Time,
                value: bar.volume,
                color: bar.close >= bar.open ? "rgba(38, 166, 154, 0.35)" : "rgba(239, 83, 80, 0.35)",
              });
            }
            setRevision((r) => r + 1);
          }
        } catch {
          // heartbeat/ping
        }
      };

      sse.onerror = () => {
        // SSE reconnects automatically
      };
    } catch {
      // ignore
    }

    return () => {
      cancelled = true;
      if (sse) sse.close();
    };
  }, [symbol, interval, chartType]);

  // Aggiorna visibilità Volume
  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume });
  }, [showVolume]);

  // Calcola e applica EMA + Indicatori di Prezzo dal Catalogo (BB, VWAP, SMA, WMA, EMA)
  useEffect(() => {
    const zip = (values: (number | null)[]): { time: Time; value: number }[] => {
      const data: { time: Time; value: number }[] = [];
      for (let i = 0; i < values.length && i < candles.length; i++) {
        const val = values[i];
        if (val != null && Number.isFinite(val)) {
          data.push({ time: candles[i].time as Time, value: val });
        }
      }
      return data;
    };

    const savedRange = chartRef.current?.timeScale().getVisibleLogicalRange();

    if (!showEma || candles.length < 20) {
      ema20Ref.current?.applyOptions({ visible: false });
      ema50Ref.current?.applyOptions({ visible: false });
      ema200Ref.current?.applyOptions({ visible: false });
    } else {
      const ema20Out = computeIndicator(
        { id: "e20", type: "ema", on: true, period: 20, color: "#3b82f6" },
        candles,
      );
      const ema50Out = computeIndicator(
        { id: "e50", type: "ema", on: true, period: 50, color: "#f59e0b" },
        candles,
      );
      const ema200Out = computeIndicator(
        { id: "e200", type: "ema", on: true, period: 200, color: "#8b5cf6" },
        candles,
      );

      if (ema20Ref.current && ema20Out.pane === "price" && ema20Out.lines[0]) {
        ema20Ref.current.setData(zip(ema20Out.lines[0].values));
        ema20Ref.current.applyOptions({ visible: true });
      }
      if (ema50Ref.current && ema50Out.pane === "price" && ema50Out.lines[0]) {
        ema50Ref.current.setData(zip(ema50Out.lines[0].values));
        ema50Ref.current.applyOptions({ visible: true });
      }
      if (ema200Ref.current && ema200Out.pane === "price" && ema200Out.lines[0]) {
        ema200Ref.current.setData(zip(ema200Out.lines[0].values));
        ema200Ref.current.applyOptions({ visible: true });
      }
    }

    // Sincronizza anche tutti gli indicatori "price" attivi nel catalogo (BB, VWAP, SMA, WMA, EMA custom)
    const chart = chartRef.current;
    if (chart && candles.length >= 5) {
      const activeKeys = new Set<string>();
      for (const cfg of indicators) {
        if (!cfg.on || cfg.type === "volume") continue;
        const out = computeIndicator(cfg, candles);
        if (out.pane !== "price") continue;
        out.lines.forEach((line, idx) => {
          const key = `${cfg.id}:${idx}`;
          activeKeys.add(key);
          let series = catalogSeriesRef.current.get(key);
          if (!series) {
            series = chart.addSeries(LineSeries, {
              color: line.color,
              lineWidth: 1,
              lineStyle: line.dashed ? 2 : 0,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            });
            catalogSeriesRef.current.set(key, series);
          } else {
            series.applyOptions({
              color: line.color,
              lineStyle: line.dashed ? 2 : 0,
              visible: true,
            });
          }
          series.setData(zip(line.values));
        });
      }
      for (const [key, series] of catalogSeriesRef.current.entries()) {
        if (!activeKeys.has(key)) {
          series.applyOptions({ visible: false });
        }
      }
    }

    if (savedRange) {
      chartRef.current?.timeScale().setVisibleLogicalRange(savedRange);
    }
  }, [candles, showEma, indicators]);

  // ── 3. Proiettore Coordinate per Overlay SVG (Sub-Bar + Orizzonte Futuro a 120 FPS) ──
  const projector: ChartProjector | null = useMemo(() => {
    const chart = chartRef.current;
    const price = priceSeriesRef.current;
    if (!chart || !price || overlaySize.width <= 0) return null;
    const priceScaleWidth = chart.priceScale("right")?.width() || 62;
    const timeScaleHeight = chart.timeScale()?.height() || 26;
    const paneWidth = Math.max(0, overlaySize.width - priceScaleWidth);
    const paneHeight = Math.max(0, overlaySize.height - timeScaleHeight);
    const tfSec = timeframeToSeconds(interval);

    return {
      xForTime: (time: number) => {
        // Primary continuous sub-bar & future logical interpolation (never jumps or detaches in empty space)
        const logical = logicalIndexAtTime(candles as any, time, tfSec);
        if (logical != null) {
          const coordFromLogical = chart.timeScale().logicalToCoordinate(logical as Logical);
          if (coordFromLogical != null) return coordFromLogical;
        }
        const coordinate = chart.timeScale().timeToCoordinate(time as Time);
        return coordinate != null ? coordinate : null;
      },
      yForPrice: (value: number) => {
        const coordinate = price.priceToCoordinate(value);
        return coordinate != null ? coordinate : null;
      },
      priceForY: (y: number) => price.coordinateToPrice(y),
      timeForX: (x: number) => {
        const logical = chart.timeScale().coordinateToLogical(x);
        if (logical != null && candles.length > 0) {
          const fromLogical = timeAtLogicalIndex(candles as any, logical, tfSec);
          if (fromLogical != null) return fromLogical;
        }
        const time = chart.timeScale().coordinateToTime(x);
        return typeof time === "number" ? time : null;
      },
      width: overlaySize.width,
      height: overlaySize.height,
      paneWidth,
      paneHeight,
    };
  }, [overlaySize, revision, candles, interval]);

  // Adapter TradingView completo per DrawingsOverlay, ToolRail, FavoriteToolsBar, TerminalSettingsDialog
  const engineAdapter = useMemo(
    () => ({
      drawings,
      setDrawings: handleUpdateDrawings,
      settings,
      setSettings,
      symbol,
      interval,
      intervalSeconds: timeframeToSeconds(interval),
      revealed: candles,
      chartPreferences,
      indicators,
      setIndicators,
      ticket,
      setTicket,
      account: {
        balance: replayAccountState.balance,
        equity: replayAccountState.equity,
        realizedProfit: replayAccountState.realizedPnl,
      },
      pickingOrderPrice: false,
      setPickedPrice: undefined,
      setPickingOrderPrice: undefined,
      executeDrawingOrder: (item: ReplayDrawing) => {
        if (item.kind === "position" && onTradePlanned) {
          const entry = item.entry.price;
          const sl = item.slPrice;
          const tp = item.tpPrice;
          const risk = Math.abs(entry - sl);
          const reward = Math.abs(tp - entry);
          const rr = risk > 0 ? parseFloat((reward / risk).toFixed(2)) : 0;
          onTradePlanned({
            direction: item.direction,
            entryPrice: entry,
            stopLoss: sl,
            takeProfit: tp,
            riskReward: rr,
          });
        }
      },
    }),
    [
      drawings,
      handleUpdateDrawings,
      settings,
      setSettings,
      symbol,
      interval,
      candles,
      chartPreferences,
      indicators,
      ticket,
      onTradePlanned,
      replayAccountState,
    ],
  );

  // Sincronizzazione candele per Replay Mode (Taglio a storico + Auto Break-Even su TP1 50%)
  const wasReplayActiveRef = useRef(false);
  useEffect(() => {
    if (!priceSeriesRef.current || candles.length === 0) return;
    if (!replayActive && !wasReplayActiveRef.current) return;
    wasReplayActiveRef.current = replayActive;
    const targetBars =
      replayActive && replayCutIndex != null
        ? candles.slice(0, Math.max(5, replayCutIndex + 1))
        : candles;
    const displayBars = chartType === "heikin" ? toHeikinAshi(targetBars) : targetBars;
    priceSeriesRef.current.setData(
      displayBars.map((b) => ({
        time: b.time as Time,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        value: b.close,
      })) as any,
    );
    if (futureHorizonSeriesRef.current && displayBars.length > 0) {
      const lastBar = displayBars[displayBars.length - 1]!;
      const futureWhitespace = getFutureWhitespaceBars(lastBar.time, interval);
      futureHorizonSeriesRef.current.setData([
        { time: lastBar.time as Time, value: lastBar.close },
        ...futureWhitespace,
      ] as any);
    }

    // Automazione Break-Even su TP1 / BE 50% durante l'avanzamento Replay
    if (replayActive && replayCutIndex != null) {
      const currentBar = candles[Math.min(candles.length - 1, Math.max(0, replayCutIndex))];
      if (currentBar) {
        let triggeredBe = false;
        handleUpdateDrawings((prev) =>
          prev.map((d) => {
            if (d.kind !== "position" || d.entry.time > currentBar.time) return d;
            const partialPrice = d.entry.price + (d.tpPrice - d.entry.price) * 0.5;
            const isLong = d.direction === "buy";
            const hitTp1 = isLong ? currentBar.high >= partialPrice : currentBar.low <= partialPrice;
            const notYetBe = isLong ? d.slPrice < d.entry.price : d.slPrice > d.entry.price;
            if (hitTp1 && notYetBe) {
              triggeredBe = true;
              return { ...d, slPrice: d.entry.price };
            }
            return d;
          }),
        );
        if (triggeredBe) {
          synestheticAlert();
        }
      }
    }
  }, [candles, replayActive, replayCutIndex, chartType, handleUpdateDrawings]);

  // Replay Playback Timer (Avanzamento a cadenza temporale)
  useEffect(() => {
    if (!replayActive || !replayPlaying) return;
    const delay = Math.max(150, Math.floor(1000 / replaySpeed));
    const timer = setInterval(() => {
      setReplayCutIndex((prev) => {
        if (prev == null) return candles.length - 1;
        if (prev >= candles.length - 1) {
          setReplayPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, delay);
    return () => clearInterval(timer);
  }, [replayActive, replayPlaying, replaySpeed, candles.length]);

  // Chiudi context menu al click esterno
  useEffect(() => {
    if (!scaleContextMenu) return;
    const close = () => setScaleContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [scaleContextMenu]);

  const handleViewportMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!replayScissorsMode || !containerRef.current || !chartRef.current || candles.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    if (mouseX < 0 || mouseX > rect.width) return;
    const logical = chartRef.current.timeScale().coordinateToLogical(mouseX);
    if (logical == null) return;
    const barIndex = Math.max(0, Math.min(candles.length - 1, Math.round(logical)));
    const candle = candles[barIndex];
    if (!candle) return;
    const coordX = chartRef.current.timeScale().logicalToCoordinate(barIndex as Logical);
    if (coordX == null) return;
    const date = new Date(candle.time * 1000);
    const dateLabel = `${date.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })} ${date.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
    setReplayHover({
      x: coordX,
      time: candle.time,
      label: dateLabel,
    });
  };

  const handleViewportClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (replayScissorsMode && replayHover) {
      e.stopPropagation();
      const logical = chartRef.current?.timeScale().coordinateToLogical(replayHover.x);
      if (logical != null) {
        const barIndex = Math.max(5, Math.min(candles.length - 1, Math.round(logical)));
        setReplayCutIndex(barIndex);
        setReplayActive(true);
        setReplayScissorsMode(false);
        setReplayHover(null);
        synestheticAlert();
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (e.clientX >= rect.right - 95 || e.clientX >= rect.left + rect.width - 95) {
      e.preventDefault();
      e.stopPropagation();
      setScaleContextMenu({ x: e.clientX, y: e.clientY });
      return;
    }

    if (projector) {
      e.preventDefault();
      const y = e.clientY - rect.top;
      const x = e.clientX - rect.left;
      const price = projector.priceForY(y);
      const time = projector.timeForX(x);
      if (price != null && Number.isFinite(price)) {
        setChartContextMenu({
          x: e.clientX,
          y: e.clientY,
          price,
          time: typeof time === "number" ? time : undefined,
        });
      }
    }
  };

  const handleToggleScaleMode = (mode: "normal" | "logarithmic" | "percentage") => {
    setSettings((prev) => ({
      ...prev,
      priceScaleMode: prev.priceScaleMode === mode ? "normal" : mode,
    }));
  };

  const handleToggleInvertScale = () => {
    setScaleInvert((prev) => {
      const next = !prev;
      chartRef.current?.priceScale("right").applyOptions({ invertScale: next });
      return next;
    });
  };

  const handleResetScale = () => {
    chartRef.current?.priceScale("right").applyOptions({
      autoScale: true,
      invertScale: false,
    });
    setSettings((prev) => ({ ...prev, priceScaleMode: "normal" }));
    setScaleInvert(false);
    chartRef.current?.timeScale().fitContent();
  };

  // Auto FVG (Fair Value Gap) detection
  const detectedFvgs = useMemo(() => {
    if (!showAutoFvg || candles.length < 3) return [];
    const gaps: Array<{
      id: string;
      bullish: boolean;
      topPrice: number;
      bottomPrice: number;
      startTime: number;
      endTime: number;
    }> = [];

    for (let i = 2; i < candles.length; i++) {
      const c1 = candles[i - 2];
      const c2 = candles[i - 1];
      const c3 = candles[i];

      if (c1.high < c3.low) {
        gaps.push({
          id: `fvg-bull-${c2.time}`,
          bullish: true,
          topPrice: c3.low,
          bottomPrice: c1.high,
          startTime: c2.time,
          endTime: c3.time + timeframeToSeconds(interval) * 10,
        });
      } else if (c1.low > c3.high) {
        gaps.push({
          id: `fvg-bear-${c2.time}`,
          bullish: false,
          topPrice: c1.low,
          bottomPrice: c3.high,
          startTime: c2.time,
          endTime: c3.time + timeframeToSeconds(interval) * 10,
        });
      }
    }
    return gaps.slice(-12);
  }, [showAutoFvg, candles, interval]);

  // Cattura screenshot PNG ad alta risoluzione & Appunti
  const handleTakeScreenshot = useCallback(async () => {
    if (!chartRef.current) return;
    const canvas = containerRef.current?.querySelector("canvas");
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `AUREUS_${symbol}_${interval}_${Date.now()}.png`;
      a.click();

      if (typeof navigator !== "undefined" && navigator.clipboard && canvas.toBlob) {
        canvas.toBlob((blob) => {
          if (blob) {
            try {
              navigator.clipboard.write([
                new ClipboardItem({ "image/png": blob }),
              ]);
            } catch {}
          }
        });
      }
    }
  }, [symbol, interval]);

  // Tasti Rapidi Range TradingView (1D, 5D, 1M, 3M, 6M, YTD, 1Y, Tutto)
  const setRangeBars = useCallback(
    (days: number) => {
      const chart = chartRef.current;
      if (!chart || candles.length === 0) return;
      const tfSec = timeframeToSeconds(interval);
      const barsToFit = Math.max(10, Math.round((days * 86400) / tfSec));
      const total = candles.length;
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, total - barsToFit),
        to: total + 6,
      });
    },
    [candles, interval],
  );

  // Barra attiva / hover per legenda OHLC
  const activeBar = hoverBar ?? (candles.length > 0 ? candles[candles.length - 1] : null);
  const decimals = priceDecimals(symbol);

  // Barra live reale per il tag prezzo + countdown sull'asse destro (non salta con l'hover storico)
  const liveBar =
    replayActive && replayCutIndex != null
      ? candles[Math.min(candles.length - 1, Math.max(0, replayCutIndex))]
      : candles.length > 0
        ? candles[candles.length - 1]
        : null;

  // Telemetria Revolut-Style (Variazione Giornaliera % / Pips) + Volatilità ATR(14) in Pips
  const dailyChange = useMemo(
    () => computeDailyChangeTelemetry(candles, symbol, liveBar?.close),
    [candles, symbol, liveBar?.close],
  );
  const atrPips = useMemo(() => computeLiveAtrPips(candles, symbol, 14), [candles, symbol]);

  const handleReturnToLive = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || candles.length === 0) return;
    const totalBars = candles.length;
    const visibleBars = Math.min(110, totalBars);
    chart.timeScale().setVisibleLogicalRange({
      from: Math.max(0, totalBars - visibleBars),
      to: totalBars + 22,
    });
    chart.priceScale("right").applyOptions({ autoScale: true });
    setIsScrolledAway(false);
    setRevision((r) => r + 1);
  }, [candles.length]);

  // Larghezza reale della scala prezzi di destra
  const priceScaleWidth = useMemo(() => {
    try {
      const w = chartRef.current?.priceScale("right")?.width();
      if (w && w > 40 && w < 160) return w;
    } catch {
      // fallback
    }
    return 68;
  }, [revision, overlaySize.width, activePane]);

  // Allerte di Prezzo Interattive (TradingView Pro Style nel Varco)
  const alertsApi = useReplayAlerts({
    symbol,
    sessionKey: "cockpit",
    currentBar: liveBar,
    isPlaying: replayActive && replayPlaying,
    onPause: () => setReplayPlaying(false),
  });

  // Alt + A shortcut: rapida creazione allerta al prezzo sotto al crosshair
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "a" || e.key === "A" || e.code === "KeyA")) {
        if (crosshairY != null && projector && alertsApi) {
          const price = projector.priceForY(crosshairY);
          if (price != null && Number.isFinite(price)) {
            e.preventDefault();
            alertsApi.createAlert(price);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [crosshairY, projector, alertsApi]);

  return (
    <div
      className={`limen-proprietary-chart ${isFullscreen ? "is-fullscreen" : ""} ${layout !== "1x1" ? `is-layout-${layout}` : ""} ${className}`}
    >
      {/* ── Unica Barra Superiore Integrata (Single Header) ── */}
      <LimenChartHeader
        symbol={symbol}
        onSymbolChange={(s) => onSymbolChange?.(s)}
        interval={interval}
        onIntervalChange={(i) => onIntervalChange?.(i)}
        chartType={chartType === "heikin" || chartType === "line" ? chartType : "candles"}
        onChartTypeChange={(t) => setSettings((prev) => ({ ...prev, chartType: t }))}
        feedStatus={feedStatus}
        statusMessage={statusMessage}
        latestBarTime={candles.length > 0 ? candles[candles.length - 1].time : undefined}
        showSessions={showSessions}
        onToggleSessions={() => {
          setShowSessionsState((prev) => !prev);
          setSettings((prev) => ({ ...prev, showSessions: !prev.showSessions }));
        }}
        onOpenSessionsSettings={() => {
          setSettingsTab("sessions");
          setSettingsOpen(true);
        }}
        showLiquidity={showLiquidityLevels}
        onToggleLiquidity={() => setShowLiquidityLevels((v) => !v)}
        onOpenLiquiditySettings={() => {
          setSettingsTab("liquidity");
          setSettingsOpen(true);
        }}
        showRedNews={showRedNews}
        onToggleRedNews={toggleRedNews}
        imminentRedNews={imminentRedNews}
        onJumpToEventTime={handleJumpToTime}
        showWyckoff={showWyckoff}
        onToggleWyckoff={() => setShowWyckoff((v) => !v)}
        onOpenWyckoffSettings={() => {
          setSettingsTab("wyckoff");
          setSettingsOpen(true);
        }}
        showVolume={showVolume}
        onToggleVolume={() =>
          setIndicators((prev) =>
            prev.map((ind) => (ind.type === "volume" ? { ...ind, on: !ind.on } : ind)),
          )
        }
        showEma={showEma}
        onToggleEma={() => setShowEma(!showEma)}
        showAutoFvg={showAutoFvg}
        onToggleAutoFvg={() => setShowAutoFvg(!showAutoFvg)}
        onClearAllIndicators={handleClearAllIndicators}
        onSelectAllIndicators={handleSelectAllIndicators}
        isCleanChart={isCleanChart}
        onTakeScreenshot={handleTakeScreenshot}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        leftCollapsed={leftCollapsed}
        onToggleLeft={onToggleLeft}
        biasScore={biasScore}
        h4DirectionalBias={h4DirectionalBias}
        edgeTier={edgeTier}
        onOpenContext={onOpenContext}
        macroText={macroText}
        macroStatus={macroStatus}
        onOpenNews={onOpenNews}
        onOpenFavorites={() => {
          setSettingsTab("tools");
          setSettingsOpen(true);
        }}
        isAdmin={isAdmin}
        onScanAi={onScanAi}
        isAiScanning={isAiScanning}
        hasAiSetup={Boolean(aiSetup)}
        showAiOverlay={showAiOverlay}
        onToggleAiOverlay={onToggleAiOverlay}
        onOpenObjectTree={() => setObjectTreeOpen(true)}
        objectCount={drawings.length}
        layout={layout}
        onLayoutChange={setLayout}
        alertsCount={alertsApi.activeCount}
        alerts={alertsApi.alerts}
        onCreateAlertCurrent={() => {
          if (liveBar) alertsApi.createAlert(liveBar.close);
        }}
        onRemoveAlert={alertsApi.removeAlert}
        onClearAllAlerts={alertsApi.clearAllAlerts}
      />

      {/* ── Chart Main Body (ToolRail + Viewport) ── */}
      <div className="limen-chart-body">
        {/* ToolRail Pro (TradingView-Grade con 24 strumenti, flyout categorizzato, hover ? e preferiti ★) */}
        <ToolRail
          engine={engineAdapter as any}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onOpenKnowledge={setKnowledgeToolId}
          onOpenSettings={() => {
            setSettingsTab("tools");
            setSettingsOpen(true);
          }}
        />

        {/* Viewport Canvas + Overlays */}
        <div className={`limen-chart-viewport ${layout !== "1x1" ? `is-split is-split-${layout}` : ""}`}>
          <div
            className={`limen-pane-primary transition-all ${
              activePane === "primary" ? "ring-1 ring-[#C5A059]/40" : ""
            }`}
            onClick={() => setActivePane("primary")}
            onContextMenu={handleContextMenu}
          >
            {/* Floating Favorite Tools Bar (Draggable ★ bar sincronizzata con Backtest) */}
          <FavoriteToolsBar
            engine={engineAdapter as any}
            activeTool={activeTool}
            onToolChange={setActiveTool}
          />

          <div
            ref={containerRef}
            className="limen-chart-canvas-container"
            onMouseMove={handleViewportMouseMove}
            onClick={handleViewportClick}
            onContextMenu={handleContextMenu}
            onDoubleClick={() => {
              setSettingsTab("chart");
              setSettingsOpen(true);
            }}
          />

          {/* Legenda OHLC Ticking Bar con Telemetria Revolut Daily Delta + ATR(14) + Orizzonte Futuro */}
          {activeBar && (
            <div className="limen-chart-ohlc-legend" aria-hidden="true">
              <span className="symbol-tag whitespace-nowrap">
                {formatCleanPairLabel(symbol)} · {formatHumanTimeframe(interval)}
              </span>
              <div className="ohlc-values">
                <span className="val-item whitespace-nowrap">
                  <span className="val-label">O</span>
                  <span className="val-num">{activeBar.open.toFixed(decimals)}</span>
                </span>
                <span className="val-item whitespace-nowrap">
                  <span className="val-label">H</span>
                  <span className="val-num">{activeBar.high.toFixed(decimals)}</span>
                </span>
                <span className="val-item whitespace-nowrap">
                  <span className="val-label">L</span>
                  <span className="val-num">{activeBar.low.toFixed(decimals)}</span>
                </span>
                <span className="val-item whitespace-nowrap">
                  <span className="val-label">C</span>
                  <span
                    className={`val-num ${
                      activeBar.close >= activeBar.open ? "is-up" : "is-down"
                    }`}
                  >
                    {activeBar.close.toFixed(decimals)}
                  </span>
                </span>
                {activeBar.volume != null && activeBar.volume > 0 && (
                  <span className="val-item whitespace-nowrap">
                    <span className="val-label">Vol</span>
                    <span className="val-num">{activeBar.volume}</span>
                  </span>
                )}
              </div>

              {dailyChange && (
                <span
                  className={`limen-ohlc-delta-badge whitespace-nowrap ${
                    dailyChange.diffPrice >= 0 ? "is-up" : "is-down"
                  }`}
                  title={`Variazione Sessione: ${dailyChange.diffPct >= 0 ? "+" : ""}${dailyChange.diffPct.toFixed(2)}% (${dailyChange.diffPips >= 0 ? "+" : ""}${dailyChange.diffPips.toFixed(1)} pips) · Max ${dailyChange.dayHigh.toFixed(decimals)} / Min ${dailyChange.dayLow.toFixed(decimals)}`}
                >
                  {dailyChange.diffPct >= 0 ? "+" : ""}
                  {dailyChange.diffPct.toFixed(2)}% · {dailyChange.diffPips >= 0 ? "+" : ""}
                  {dailyChange.diffPips.toFixed(1)}p
                </span>
              )}

              {atrPips != null && (
                <span
                  className="limen-ohlc-atr-badge whitespace-nowrap"
                  title="Volatilità Media Candela ATR(14) espressa in Pips/Punti"
                >
                  ATR {atrPips.toFixed(1)}p
                </span>
              )}

              {crosshairDetails && crosshairDetails.isFuture && liveBar && (
                <span className="limen-ohlc-future-badge whitespace-nowrap">
                  ⏳ FUTURO{" "}
                  {new Date(crosshairDetails.time * 1000).toLocaleString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  })}{" "}
                  · {formatRelativeHorizonDelta(crosshairDetails.time - liveBar.time)} (+
                  {Math.max(1, crosshairDetails.barsDelta)}b)
                  {crosshairDetails.price != null
                    ? ` · ${formatPriceLocale(crosshairDetails.price, symbol)}`
                    : ""}
                </span>
              )}

              <button
                type="button"
                className="limen-legend-gear"
                onClick={() => {
                  setSettingsTab("chart");
                  setSettingsOpen(true);
                }}
                title="Impostazioni Grafico"
                aria-label="Impostazioni Grafico"
                style={{ pointerEvents: "auto" }}
              >
                ⚙
              </button>
            </div>
          )}

          {/* Pillola Asse Temporale Futuro (Visibile quando il cursore esplora lo spazio vuoto a destra) */}
          {crosshairDetails && crosshairDetails.isFuture && liveBar && projector && (
            <div
              className="limen-future-axis-pill whitespace-nowrap"
              style={{
                left: `${Math.max(90, Math.min((projector.paneWidth ?? 800) - 90, crosshairDetails.x))}px`,
              }}
              aria-hidden="true"
            >
              <span className="text-[#E8C56A] font-bold">
                {new Date(crosshairDetails.time * 1000).toLocaleString("it-IT", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-emerald-400 font-bold">
                {formatRelativeHorizonDelta(crosshairDetails.time - liveBar.time)}
              </span>
              <span className="text-slate-500">
                (+{Math.max(1, crosshairDetails.barsDelta)} barre)
              </span>
            </div>
          )}

          {/* Pulsante Flottante "Torna al Live" quando l'Operatore scorre lontano dalla candela corrente */}
          {isScrolledAway && (
            <button
              type="button"
              className="limen-return-live-btn whitespace-nowrap"
              onClick={handleReturnToLive}
              title="Torna immediatamente alla candela live e all'orizzonte futuro"
            >
              <span>TORNA AL LIVE</span>
              <span className="text-[#E8C56A]">⇥</span>
            </button>
          )}

          {/* Tag Prezzo + Countdown Chiusura Candela su Asse Prezzi a Destra (TradingView Exact Style) */}
          {liveBar && projector && (
            <CandlePriceScaleTag
              close={liveBar.close}
              open={liveBar.open}
              priceY={projector.yForPrice(liveBar.close)}
              projectorHeight={projector.height}
              symbol={symbol}
              interval={interval}
              priceScaleWidth={priceScaleWidth}
            />
          )}

          {/* Shading Killzones Sessioni (Asia, Londra, NY + Personalizzate) */}
          {projector && showSessions && (
            <SessionOpensOverlay
              engine={engineAdapter as any}
              projector={projector}
              revision={revision}
              onOpenSettings={() => {
                setSettingsTab("sessions");
                setSettingsOpen(true);
              }}
            />
          )}

          {/* Mappa della Liquidità Istituzionale BSL/SSL, PDH/PDL, EQH/EQL */}
          {projector && showLiquidityLevels && (
            <LiquidityLevelsOverlay
              candles={candles}
              projector={projector}
              symbol={symbol}
              revision={revision}
            />
          )}

          {/* Segnalatore News Rosse ad Alto Impatto (TradingView Style) */}
          {projector && showRedNews && (
            <RedNewsOverlay
              symbol={symbol}
              projector={projector}
              revision={revision}
              visible={showRedNews}
              referenceTimeSec={liveBar?.time}
              onImminentEvent={(event) => {
                setImminentRedNews(event);
                onImminentNewsChange?.(event);
              }}
            />
          )}

          {/* Wyckoff Strutturale (Trading Range Creek/Ice, Spring, UTAD, SOW 10%, SOS, LPS) */}
          {projector && showWyckoff && (
            <WyckoffOverlay
              candles={candles}
              projector={projector}
              symbol={symbol}
              revision={revision}
            />
          )}

          {/* Auto Fair Value Gap (FVG) Boxes */}
          {projector && showAutoFvg && (
            <div className="limen-fvg-overlay" aria-hidden="true">
              {detectedFvgs.map((fvg) => {
                const x1 = projector.xForTime(fvg.startTime);
                const x2 = projector.xForTime(fvg.endTime) ?? projector.width;
                const yTop = projector.yForPrice(fvg.topPrice);
                const yBottom = projector.yForPrice(fvg.bottomPrice);
                if (x1 == null || yTop == null || yBottom == null) return null;

                const top = Math.min(yTop, yBottom);
                const height = Math.abs(yBottom - yTop);
                const width = Math.max(20, x2 - x1);

                return (
                  <div
                    key={fvg.id}
                    className={`limen-fvg-box ${fvg.bullish ? "is-bullish" : "is-bearish"}`}
                    style={{
                      left: `${x1}px`,
                      top: `${top}px`,
                      width: `${width}px`,
                      height: `${Math.max(4, height)}px`,
                    }}
                  >
                    <span className="limen-fvg-label">
                      {fvg.bullish ? "BULL FVG" : "BEAR FVG"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Interactive SVG Drawing Overlay (Trend, Ray, FVG, Fib, Ruler, Risk:Reward) */}
          {projector && (
            <DrawingsOverlay
              engine={engineAdapter as any}
              projector={projector}
              revision={revision}
              activeTool={activePane === "primary" ? activeTool : "cursor"}
              onToolDone={() => setActiveTool("cursor")}
              onOpenKnowledge={setKnowledgeToolId}
              onAddAlert={(price) => alertsApi.createAlert(price)}
              externalContextMenu={chartContextMenu}
              onClearExternalContextMenu={() => setChartContextMenu(null)}
            />
          )}

          {/* Allerte di Prezzo Interattive stile TradingView (Pulsante '+' su asse prezzi, Drag & Drop e Alert Line) */}
          {projector && (
            <ChartAlertsOverlay
              symbol={symbol}
              projector={projector}
              revision={revision}
              alerts={alertsApi.alerts}
              onCreateAlert={alertsApi.createAlert}
              onRemoveAlert={alertsApi.removeAlert}
              onUpdateAlertPrice={alertsApi.updateAlertPrice}
              onToggleAlert={alertsApi.toggleAlert}
              crosshairY={crosshairY}
            />
          )}

          {/* Replay Scissors Cut Line & Floating Tag Overlay (TradingView Pro Image 4) */}
          {replayScissorsMode && replayHover && (
            <div className="limen-replay-scissors-overlay">
              <div className="limen-replay-cut-line" style={{ left: `${replayHover.x}px` }} />
              <div className="limen-replay-scissors-tag" style={{ left: `${replayHover.x}px` }}>
                <Scissors size={11} />
                <span>TAGLIA STORICO</span>
              </div>
              <div className="limen-replay-time-pill" style={{ left: `${replayHover.x}px` }}>
                {replayHover.label}
              </div>
            </div>
          )}

          {/* Floating Replay Transport Dock (TradingView Pro con Telemetria Conto Base 10k) */}
          {(replayActive || replayScissorsMode) && (
            <div className="limen-replay-floating-dock flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className={`limen-replay-dock-btn ${replayScissorsMode ? "is-active-cut" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplayScissorsMode(!replayScissorsMode);
                  }}
                  title="Taglia a punto storico (Cursore a Forbice)"
                >
                  <Scissors size={13} />
                </button>
                <button
                  type="button"
                  className="limen-replay-dock-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplayCutIndex((prev) => (prev != null ? Math.max(5, prev - 1) : 5));
                  }}
                  title="Passo indietro (1 candela)"
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  className="limen-replay-dock-btn is-play"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplayPlaying(!replayPlaying);
                  }}
                  title={replayPlaying ? "Pausa simulazione" : "Riproduci simulazione"}
                >
                  {replayPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button
                  type="button"
                  className="limen-replay-dock-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplayCutIndex((prev) =>
                      prev != null ? Math.min(candles.length - 1, prev + 1) : candles.length - 1,
                    );
                  }}
                  title="Passo avanti (1 candela)"
                >
                  <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  className="limen-replay-speed-badge"
                  onClick={(e) => {
                    e.stopPropagation();
                    const speeds = [1, 2, 3, 5];
                    const nextIndex = (speeds.indexOf(replaySpeed) + 1) % speeds.length;
                    setReplaySpeed(speeds[nextIndex]);
                  }}
                  title="Velocità riproduzione"
                >
                  {replaySpeed}x
                </button>
                <button
                  type="button"
                  className="limen-replay-dock-btn text-rose-400 hover:text-rose-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    setReplayActive(false);
                    setReplayScissorsMode(false);
                    setReplayCutIndex(null);
                    setReplayPlaying(false);
                  }}
                  title="Esci dalla modalità Simulazione"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Telemetria Sovrana Conto Base Replay (La Forgia del Passato) */}
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-white/15 font-mono text-[10.5px]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleReplayCapitalSize();
                  }}
                  className="px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#E8C56A] hover:bg-[#C5A059]/25 hover:border-[#C5A059]/60 font-bold text-[9px] tracking-wider whitespace-nowrap cursor-pointer transition-all"
                  title="Clicca per cambiare taglia capitale (10k, 25k, 50k, 100k, 200k)"
                >
                  CONTO {replayCapitalSize >= 1000 ? `${replayCapitalSize / 1000}K` : replayCapitalSize} €
                </button>
                <div className="flex items-center gap-1.5 text-slate-300 whitespace-nowrap">
                  <span className="text-slate-400">Equity:</span>
                  <span className="font-bold text-white">
                    €{replayAccountState.equity.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-1 whitespace-nowrap font-bold">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9.5px] ${
                      replayAccountState.totalNetPnl > 0
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        : replayAccountState.totalNetPnl < 0
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          : "bg-white/5 text-slate-400 border border-white/10"
                    }`}
                  >
                    {replayAccountState.totalNetPnl >= 0 ? "+" : ""}
                    €{replayAccountState.totalNetPnl.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (
                    {replayAccountState.totalNetPnlPct >= 0 ? "+" : ""}
                    {replayAccountState.totalNetPnlPct.toFixed(2)}%)
                  </span>
                </div>
                {replayAccountState.closedTradesCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      try {
                        const key = "limen_libro_verita_sealed_setups_v1";
                        const existing = JSON.parse(localStorage.getItem(key) || "[]");
                        const newEntries = replayAccountState.closedTradesList.map((t) => ({
                          id: `replay-${t.id}-${Date.now()}`,
                          symbol,
                          direction: t.direction,
                          entryPrice: t.entryPrice,
                          exitPrice: t.exitPrice,
                          realizedPnl: t.pnl,
                          outcome: t.outcome,
                          lots: t.lots,
                          accountSize: replayCapitalSize,
                          sealedAt: new Date().toISOString(),
                          source: "forgia-replay",
                        }));
                        localStorage.setItem(key, JSON.stringify([...newEntries, ...existing].slice(0, 100)));
                        window.dispatchEvent(new CustomEvent("limen:setup-sealed", { detail: newEntries[0] }));
                        synestheticAlert();
                      } catch {}
                    }}
                    className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 font-bold text-[8.5px] whitespace-nowrap cursor-pointer transition-colors"
                    title="Sigilla i trade completati della sessione nel Libro della Verità"
                  >
                    SIGILLA VERITÀ ({replayAccountState.closedTradesCount})
                  </button>
                )}
                {drawings.some((d) => d.kind === "position") && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearPositions();
                    }}
                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors cursor-pointer"
                    title="Pulisci tutte le posizioni dal grafico"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Proiezione Setup Visivo Sentinella IA (Entry, SL, BE, TP1, TP2) — Riservato ADMIN */}
          {isAdmin && projector && showAiOverlay && (aiSetup || isAiScanning) && (
            <LimenAiSetupOverlay
              setup={aiSetup}
              projector={projector}
              symbol={symbol}
              onUpdateSetup={onUpdateAiSetup}
              onAdoptSetup={onAdoptAiSetup}
              onClose={onToggleAiOverlay}
              isScanning={isAiScanning}
              onScan={onScanAi}
            />
          )}
          </div>

          {/* Polittico Sovrano Companion Pane (Layout 1x2 / 2x1) */}
          {layout !== "1x1" && (
            <div
              className={`limen-pane-secondary transition-all ${
                activePane === "secondary" ? "ring-1 ring-[#C5A059]/40" : ""
              }`}
              onClick={() => setActivePane("secondary")}
            >
              <LimenCompanionChartPane
                primarySymbol={symbol}
                primaryInterval={interval}
                primaryHoverTime={hoverBar?.time}
                isActive={activePane === "secondary"}
                onActivate={() => setActivePane("secondary")}
                activeTool={activePane === "secondary" ? activeTool : "cursor"}
                onToolDone={() => setActiveTool("cursor")}
                ticket={ticket}
                settings={settings}
                onTradePlanned={onTradePlanned}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── TradingView Pro Bottom Bar (1D 5D 1M 3M 6M YTD 1Y Tutto · UTC+2 Clock · % log auto) ── */}
      <div className="limen-bottom-bar" role="toolbar" aria-label="Controlli vista grafico">
        <div className="limen-bottom-ranges">
          <button type="button" onClick={() => setRangeBars(1)} title="Ultimo giorno">1D</button>
          <button type="button" onClick={() => setRangeBars(5)} title="Ultimi 5 giorni">5D</button>
          <button type="button" onClick={() => setRangeBars(30)} title="Ultimo mese">1M</button>
          <button type="button" onClick={() => setRangeBars(90)} title="Ultimi 3 mesi">3M</button>
          <button type="button" onClick={() => setRangeBars(180)} title="Ultimi 6 mesi">6M</button>
          <button type="button" onClick={() => setRangeBars(365)} title="Ultimo anno">1Y</button>
          <button type="button" onClick={() => chartRef.current?.timeScale().fitContent()} title="Tutti i dati">Tutto</button>
        </div>

        <div className="limen-bottom-right relative">
          {/* Selettore Mappa Liquidità Istituzionale BSL/SSL & Fase Ciclica */}
          <button
            type="button"
            onClick={() => setShowLiquidityLevels((v) => !v)}
            className={`limen-liquidity-toggle-btn flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono font-bold transition-all whitespace-nowrap ${
              showLiquidityLevels
                ? "bg-emerald-500/15 border-emerald-500/45 text-emerald-400"
                : "bg-[#0d0f14] border-white/10 text-slate-400 hover:text-white"
            }`}
            title={`${liquidityAnalysis.cycle.title} — ${liquidityAnalysis.cycle.subtitle} (${liquidityAnalysis.cycle.dilutionRatio})`}
          >
            <span>BSL/SSL</span>
            <span className="text-slate-500">·</span>
            <span className="text-[#E8C56A]">{liquidityAnalysis.cycle.phase}</span>
          </button>

          {/* Selettore Wyckoff Strutturale */}
          <button
            type="button"
            onClick={() => setShowWyckoff((v) => !v)}
            className={`limen-wyckoff-toggle-btn flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono font-bold transition-all whitespace-nowrap ${
              showWyckoff
                ? "bg-[#C5A059]/15 border-[#C5A059]/45 text-[#E8C56A]"
                : "bg-[#0d0f14] border-white/10 text-slate-400 hover:text-white"
            }`}
            title={
              wyckoffAnalysis.tradingRange
                ? `Wyckoff: ${wyckoffAnalysis.tradingRange.structureType} (Creek: ${wyckoffAnalysis.tradingRange.creekPrice.toFixed(2)}, Ice: ${wyckoffAnalysis.tradingRange.icePrice.toFixed(2)})`
                : "Wyckoff Strutturale: Trading Range non consolidato"
            }
          >
            <span>WYCKOFF</span>
            <span className="text-slate-500">·</span>
            <span className="text-[#C5A059]">
              {wyckoffAnalysis.tradingRange?.structureType === "ACCUMULATION"
                ? "ACC"
                : wyckoffAnalysis.tradingRange?.structureType === "DISTRIBUTION"
                  ? "DIST"
                  : "TR"}
            </span>
          </button>

          {/* Calcolatore di Esposizione Cumulativa Multi-Posizione su Base Conto 10k */}
          {cumulativeExposure.count > 0 ? (
            <div
              className="limen-exposure-badge flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#C5A059]/40 bg-[#07080b] text-[10px] font-mono whitespace-nowrap"
              title={`Esposizione Cumulativa Posizioni Tracciate sul Grafico (Base Conto €${replayCapitalSize.toLocaleString("it-IT")})`}
            >
              <button
                type="button"
                onClick={cycleReplayCapitalSize}
                className="text-[#E8C56A] hover:underline font-bold whitespace-nowrap cursor-pointer"
                title="Clicca per cambiare taglia conto"
              >
                CONTO {replayCapitalSize >= 1000 ? `${replayCapitalSize / 1000}K` : replayCapitalSize}
              </button>
              <span className="text-slate-600">·</span>
              <span className="text-white whitespace-nowrap">{cumulativeExposure.count} POS</span>
              <span className="text-slate-600">·</span>
              <span className="text-rose-400 font-bold whitespace-nowrap">-€{cumulativeExposure.totalRisk.toFixed(0)} ({((cumulativeExposure.totalRisk / replayCapitalSize) * 100).toFixed(1)}%)</span>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-400 font-bold whitespace-nowrap">+€{cumulativeExposure.totalReward.toFixed(0)} ({((cumulativeExposure.totalReward / replayCapitalSize) * 100).toFixed(1)}%)</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-200 whitespace-nowrap">{cumulativeExposure.totalLots.toFixed(2)}L</span>
              <button
                type="button"
                onClick={handleClearPositions}
                className="ml-0.5 text-slate-500 hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                title="Pulisci tutte le posizioni dal grafico"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ) : replayActive ? (
            <div
              className="limen-exposure-badge flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#C5A059]/40 bg-[#07080b] text-[10px] font-mono whitespace-nowrap"
              title={`Conto di Simulazione Forgia del Passato (Base €${replayCapitalSize.toLocaleString("it-IT")})`}
            >
              <button
                type="button"
                onClick={cycleReplayCapitalSize}
                className="text-[#E8C56A] hover:underline font-bold whitespace-nowrap cursor-pointer"
                title="Clicca per cambiare taglia conto"
              >
                CONTO REPLAY {replayCapitalSize >= 1000 ? `${replayCapitalSize / 1000}K` : replayCapitalSize}
              </button>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300 whitespace-nowrap">SALDO: €{replayCapitalSize.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
            </div>
          ) : null}

          {/* Ispettore Rapido Setup Sigillati ne Il Libro della Verità */}
          <button
            type="button"
            onClick={() => setSealedDrawerOpen((v) => !v)}
            className={`limen-sealed-btn flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-mono font-bold transition-all whitespace-nowrap ${
              sealedDrawerOpen || sealedSetups.length > 0
                ? "bg-[#C5A059]/15 border-[#C5A059]/45 text-[#E8C56A]"
                : "bg-[#0d0f14] border-white/10 text-slate-400 hover:text-white"
            }`}
            title="Dossier dei Setup Sigillati ne Il Libro della Verità"
          >
            <span>SIGILLATI ({sealedSetups.length})</span>
          </button>

          {sealedDrawerOpen && (
            <div className="limen-sealed-popover absolute bottom-8 right-0 z-50 w-[340px] max-h-[260px] overflow-y-auto rounded-lg border border-[#C5A059]/40 bg-[#07080b]/98 p-3 shadow-2xl font-mono text-[10px]">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
                <span className="font-bold text-[#E8C56A] uppercase tracking-wider">
                  LIBRO DELLA VERITÀ · SETUP SIGILLATI
                </span>
                <button
                  type="button"
                  onClick={() => setSealedDrawerOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
              {sealedSetups.length === 0 ? (
                <div className="text-slate-400 py-3 text-center">
                  Nessun setup sigillato. Clicca SIGILLA su una posizione tracciata.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {sealedSetups.slice(0, 6).map((s) => (
                    <div
                      key={s.id}
                      className="rounded border border-white/10 bg-[#0d0f14] px-2 py-1.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-white whitespace-nowrap flex items-center gap-1.5">
                          <span>{s.symbol}</span>
                          <span>·</span>
                          <span className={s.direction === "buy" ? "text-emerald-400" : "text-rose-400"}>
                            {s.direction === "buy" ? "LONG" : "SHORT"}
                          </span>
                          <span>·</span>
                          <span className="text-[#E8C56A]">R:R {s.rr}</span>
                          {s.cyclePhase && (
                            <span className="px-1 py-0.2 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[8px] text-[#E8C56A] whitespace-nowrap">
                              {s.cyclePhase}
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-slate-400 whitespace-nowrap">
                          E: {Number(s.entryPrice).toFixed(2)} · BE: {Number(s.tp1BePrice).toFixed(2)} · TP: {Number(s.tpPrice).toFixed(2)}
                        </div>
                        {s.targetLiquidityPool && (
                          <div className="text-[8.5px] text-emerald-400/90 whitespace-nowrap">
                            Target: {s.targetLiquidityPool}
                            {s.wyckoffGrab ? ` · ${s.wyckoffGrab}` : ""}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0 whitespace-nowrap">
                        <div className="font-bold text-[#E8C56A]">{Number(s.lots).toFixed(2)} Lotti</div>
                        <div className="text-[9px] text-emerald-400">+€{Number(s.expectedReward).toFixed(0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Telemetria Sessione Operativa (sotto il grafico, accanto all'ora - cliccabile per personalizzare orari) */}
          <button
            type="button"
            onClick={() => {
              setSettingsTab("sessions");
              setSettingsOpen(true);
            }}
            className="limen-bottom-session flex items-center gap-1.5 px-2 py-0.5 rounded border border-[#C5A059]/25 hover:border-[#C5A059]/60 bg-[#0d0f14]/90 hover:bg-[#11131c] text-[10.5px] font-mono select-none cursor-pointer transition-colors"
            title={`${currentSession.name} (${currentSession.hours}): ${currentSession.description} — Clicca per personalizzare sessioni e orari`}
          >
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              {currentSession.isActive && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                  currentSession.isActive ? "bg-emerald-400" : "bg-[#C5A059]/60"
                }`}
              />
            </span>
            <span className="font-bold text-[#E8C56A] uppercase tracking-wider whitespace-nowrap">
              {currentSession.shortName}
            </span>
            <span
              className={`text-[8.5px] uppercase font-bold tracking-wider px-1 py-0.2 rounded border whitespace-nowrap ${
                currentSession.isActive
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-[#C5A059]/10 border-[#C5A059]/25 text-[#E8C56A]/75"
              }`}
            >
              {currentSession.isActive ? "Aperto" : "Chiuso"}
            </span>
            <span className="text-slate-400 text-[9.5px] whitespace-nowrap hidden sm:inline">
              {currentSession.hours}
            </span>
          </button>

          <ChartBottomClock />
          <div className="limen-bottom-scales">
            <button
              type="button"
              className={`limen-bottom-replay-btn flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                replayActive || replayScissorsMode
                  ? "bg-[#38bdf8] text-black"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
              onClick={() => {
                if (replayActive) {
                  setReplayActive(false);
                  setReplayScissorsMode(false);
                  setReplayCutIndex(null);
                  setReplayPlaying(false);
                } else {
                  setReplayScissorsMode(true);
                }
              }}
              title="Modalità Simulazione Bar Replay con Cursore Forbice (Immagine 4)"
            >
              <Scissors size={11} />
              <span>REPLAY</span>
            </button>
            <button
              type="button"
              className={settings.priceScaleMode === "percentage" ? "is-active" : ""}
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  priceScaleMode: prev.priceScaleMode === "percentage" ? "normal" : "percentage",
                }))
              }
              title="Scala percentuale"
            >
              %
            </button>
            <button
              type="button"
              className={settings.priceScaleMode === "logarithmic" ? "is-active" : ""}
              onClick={() =>
                setSettings((prev) => ({
                  ...prev,
                  priceScaleMode: prev.priceScaleMode === "logarithmic" ? "normal" : "logarithmic",
                }))
              }
              title="Scala logaritmica"
            >
              log
            </button>
            <button
              type="button"
              className={settings.priceScaleMode === "normal" ? "is-active" : ""}
              onClick={() => {
                chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
                setSettings((prev) => ({ ...prev, priceScaleMode: "normal" }));
              }}
              title="Auto-scala"
            >
              auto
            </button>
          </div>
        </div>
      </div>

      {/* ── TradingView Drawer "Centro di supporto" per spiegazione di ogni strumento ── */}
      <ToolKnowledgeDrawer
        toolId={knowledgeToolId}
        favoriteTools={chartPreferences.preferences.favoriteTools}
        onToggleFavorite={(tool) =>
          chartPreferences.update((prev) => ({
            ...prev,
            favoriteTools: prev.favoriteTools.includes(tool)
              ? prev.favoriteTools.filter((t) => t !== tool)
              : [...prev.favoriteTools, tool],
          }))
        }
        onSelectTool={(tool) => setActiveTool(tool)}
        onClose={() => setKnowledgeToolId(null)}
      />

      {/* ── Finestra di Dialogo Impostazioni Grafico (Aspetto, Indicatori, Strumenti, Modelli) ── */}
      {settingsOpen && (
        <TerminalSettingsDialog
          engine={engineAdapter as any}
          initialTab={settingsTab}
          initialIndicatorId={settingsIndicatorId}
          onOpenKnowledge={setKnowledgeToolId}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* ── Albero Oggetti & Livelli Grafico (TradingView Pro Object Tree) ── */}
      <ChartObjectTreeModal
        isOpen={objectTreeOpen}
        onClose={() => setObjectTreeOpen(false)}
        symbol={symbol}
        interval={interval}
        drawings={drawings}
        onUpdateDrawing={handleUpdateSingleDrawing}
        onDeleteDrawing={handleDeleteSingleDrawing}
        onClearAllDrawings={handleClearDrawings}
        onSelectDrawing={(id) => setSelectedDrawingId(id)}
        selectedDrawingId={selectedDrawingId}
        indicators={indicators}
        onToggleIndicator={(id) =>
          setIndicators((prev) =>
            prev.map((ind) => (ind.id === id ? { ...ind, on: !ind.on } : ind)),
          )
        }
        onClearAllIndicators={handleClearAllIndicators}
        onSelectAllIndicators={handleSelectAllIndicators}
        onOpenSettings={() => {
          setSettingsTab("tools");
          setSettingsOpen(true);
        }}
      />

      {/* ── TradingView Pro Scale Context Menu (Immagine 5) ── */}
      {scaleContextMenu && (
        <div
          className="limen-scale-context-menu"
          style={{
            left: Math.min(window.innerWidth - 220, scaleContextMenu.x - 100),
            top: Math.min(window.innerHeight - 240, scaleContextMenu.y),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="limen-scale-context-header">Scala Prezzi (Asse Destro)</div>
          <button
            type="button"
            className={`limen-scale-context-item ${settings.priceScaleMode === "normal" ? "is-active" : ""}`}
            onClick={() => {
              chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
              setSettings((prev) => ({ ...prev, priceScaleMode: "normal" }));
              setScaleContextMenu(null);
            }}
          >
            <span>Auto (adatta a schermo)</span>
            {settings.priceScaleMode === "normal" && <Check size={13} className="text-[#E8C56A]" />}
          </button>
          <button
            type="button"
            className={`limen-scale-context-item ${settings.priceScaleMode === "logarithmic" ? "is-active" : ""}`}
            onClick={() => {
              handleToggleScaleMode("logarithmic");
              setScaleContextMenu(null);
            }}
          >
            <span>Logaritmica</span>
            {settings.priceScaleMode === "logarithmic" && <Check size={13} className="text-[#E8C56A]" />}
          </button>
          <button
            type="button"
            className={`limen-scale-context-item ${settings.priceScaleMode === "percentage" ? "is-active" : ""}`}
            onClick={() => {
              handleToggleScaleMode("percentage");
              setScaleContextMenu(null);
            }}
          >
            <span>Percentuale</span>
            {settings.priceScaleMode === "percentage" && <Check size={13} className="text-[#E8C56A]" />}
          </button>
          <button
            type="button"
            className={`limen-scale-context-item ${scaleInvert ? "is-active" : ""}`}
            onClick={() => {
              handleToggleInvertScale();
              setScaleContextMenu(null);
            }}
          >
            <span>Inverti asse</span>
            {scaleInvert && <Check size={13} className="text-[#E8C56A]" />}
          </button>
          <button
            type="button"
            className={`limen-scale-context-item ${scaleCountdownVisible ? "is-active" : ""}`}
            onClick={() => {
              setScaleCountdownVisible(!scaleCountdownVisible);
              setScaleContextMenu(null);
            }}
          >
            <span>Conto alla rovescia candela</span>
            {scaleCountdownVisible && <Check size={13} className="text-[#E8C56A]" />}
          </button>
          <div className="limen-scale-context-divider" />
          <button
            type="button"
            className="limen-scale-context-item text-slate-400 hover:text-white"
            onClick={() => {
              handleResetScale();
              setScaleContextMenu(null);
            }}
          >
            <span>Ripristina scala</span>
            <RotateCcw size={12} className="text-slate-400" />
          </button>
        </div>
      )}
    </div>
  );
}
