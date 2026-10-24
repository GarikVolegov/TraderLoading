import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { SessionOpensOverlay } from "../backtest-terminal/SessionOpensOverlay";
import type { ChartProjector } from "../backtest-terminal/PositionOverlay";
import { LimenChartHeader } from "./LimenChartHeader";
import { LimenAiSetupOverlay } from "./LimenAiSetupOverlay";
import type { VarcoSetupPlan } from "@workspace/api-client-react";
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
  className?: string;
  // Unified Cockpit Props
  biasScore?: number | null;
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
  if (s.includes("30") || s.includes("100") || s.includes("500")) return 1;
  return 5;
}

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

export function LimenProprietaryChart({
  symbol = "XAUUSD",
  onSymbolChange,
  interval = "60",
  onIntervalChange,
  onTradePlanned,
  className = "",
  biasScore,
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
  onScanAi,
  onCandlesUpdate,
  chartCanvasRef,
}: LimenProprietaryChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | null>(null);
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
  const [settingsTab, setSettingsTab] = useState<"chart" | "indicators" | "tools" | "templates">("chart");
  const [settingsIndicatorId, setSettingsIndicatorId] = useState<string | undefined>();
  const [knowledgeToolId, setKnowledgeToolId] = useState<DrawingToolId | null>(null);

  // Stato Dati & Feed
  const [chartInstance, setChartInstance] = useState(0);
  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [feedStatus, setFeedStatus] = useState<FeedStatus>("connecting");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const chartType = settings.chartType ?? "candles";
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(defaultIndicators());

  // Stato Indicatori & Visualizzazione
  const showSessions = settings.showSessions ?? false;
  const showVolume = indicators.some((ind) => ind.on && ind.type === "volume");
  const [showEma, setShowEma] = useState(false);
  const [showAutoFvg, setShowAutoFvg] = useState(false);

  // Stato Disegni (sincronizzazione immediata Varco <-> Backtest)
  const [activeTool, setActiveTool] = useState<DrawingToolId>("cursor");
  const [ticket, setTicket] = useState({ slPips: 25, tpPips: 75, riskMode: "percent" as const, riskValue: 1, comment: "" });
  const [drawings, setDrawingsState] = useState<ReplayDrawing[]>(() =>
    loadChartDrawings(symbol, interval),
  );
  const [revision, setRevision] = useState(0);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [hoverBar, setHoverBar] = useState<CandleBar | null>(null);

  // Orologio live UTC+2 per barra inferiore stile TradingView
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  useEffect(() => {
    const updateTime = () => {
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

  // Countdown chiusura candela sul prezzo (Punto 2)
  const [candleCountdown, setCandleCountdown] = useState<string>("");
  useEffect(() => {
    const updateCountdown = () => {
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

  // Sincronizza candele per la Sentinella AI
  useEffect(() => {
    if (candles.length > 0) {
      onCandlesUpdate?.(candles);
    }
  }, [candles, onCandlesUpdate]);

  // Sincronizza riferimento canvas grafico per screenshot AI
  useEffect(() => {
    if (chartCanvasRef && containerRef.current) {
      chartCanvasRef.current = containerRef.current.querySelector("canvas") || null;
    }
  });

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
        rightOffset: 12,
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
        color: "#d4af37",
        lineWidth: 2,
      });
      priceSeriesRef.current = lineSeries;
    } else {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: upCol,
        downColor: dnCol,
        borderUpColor: upCol,
        borderDownColor: dnCol,
        wickUpColor: upCol,
        wickDownColor: dnCol,
      });
      priceSeriesRef.current = candleSeries;
    }

    // Indicatori EMA
    ema20Ref.current = chart.addSeries(LineSeries, {
      color: "#3b82f6",
      lineWidth: 1,
      visible: false,
      title: "EMA 20",
    });
    ema50Ref.current = chart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      visible: false,
      title: "EMA 50",
    });
    ema200Ref.current = chart.addSeries(LineSeries, {
      color: "#8b5cf6",
      lineWidth: 2,
      visible: false,
      title: "EMA 200",
    });

    // Filigrana discreta TradingView-style
    if (settings.showWatermark !== false) {
      watermarkRef.current = createTextWatermark(chart.panes()[0], {
        horzAlign: "center",
        vertAlign: "center",
        lines: [
          {
            text: `${symbol}  ·  ${interval}`,
            color: "rgba(255, 255, 255, 0.04)",
            fontSize: 32,
            fontStyle: "bold",
          },
        ],
      });
    }

    // Crosshair hover listener per OHLC legend
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoverBar(null);
        return;
      }
      const data = param.seriesData.get(priceSeriesRef.current!) as any;
      if (data) {
        setHoverBar({
          time: typeof param.time === "number" ? param.time : 0,
          open: data.open ?? data.value,
          high: data.high ?? data.value,
          low: data.low ?? data.value,
          close: data.close ?? data.value,
        });
      }
    });

    // Resize Observer
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        chart.resize(width, height);
        setOverlaySize({ width, height });
        setRevision((r) => r + 1);
      }
    });
    ro.observe(container);

    const onVisibleRangeChange = () => setRevision((r) => r + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange);
    chart.timeScale().subscribeVisibleTimeRangeChange(onVisibleRangeChange);
    setChartInstance((c) => c + 1);

    let animFrame: number | null = null;
    const scheduleRevision = () => {
      if (animFrame != null) return;
      animFrame = requestAnimationFrame(() => {
        animFrame = null;
        setRevision((r) => r + 1);
      });
    };

    container.addEventListener("pointerdown", scheduleRevision);
    container.addEventListener("pointermove", scheduleRevision);
    container.addEventListener("pointerup", scheduleRevision);
    container.addEventListener("wheel", scheduleRevision, { passive: true });

    return () => {
      container.removeEventListener("pointerdown", scheduleRevision);
      container.removeEventListener("pointermove", scheduleRevision);
      container.removeEventListener("pointerup", scheduleRevision);
      container.removeEventListener("wheel", scheduleRevision);
      if (animFrame != null) cancelAnimationFrame(animFrame);
      ro.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(onVisibleRangeChange);
      watermarkRef.current?.detach();
      chart.remove();
      chartRef.current = null;
      priceSeriesRef.current = null;
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
    settings.priceScaleMode,
    settings.showWatermark,
  ]);

  // ── Sincronizzazione Reattiva Dati Serie (Garantisce Candele Sempre Visibili) ──
  useEffect(() => {
    if (!priceSeriesRef.current || candles.length === 0) return;
    const isFullReload =
      Math.abs(candles.length - lastRenderedCountRef.current) > 1 ||
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
      const visibleBars = Math.min(120, totalBars);
      chartRef.current?.timeScale().setVisibleLogicalRange({
        from: Math.max(0, totalBars - visibleBars),
        to: totalBars + 8,
      });
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
            text: `${symbol}  ·  ${interval}`,
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

    const loadHistory = async () => {
      try {
        setFeedStatus("connecting");
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

          const displayBars = chartType === "heikin" ? toHeikinAshi(bars) : bars;
          setCandles(bars);

          if (priceSeriesRef.current) {
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
          const visibleBars = Math.min(120, totalBars);
          chartRef.current?.timeScale().setVisibleLogicalRange({
            from: Math.max(0, totalBars - visibleBars),
            to: totalBars + 8,
          });
          setFeedStatus("live");
          setStatusMessage("TV Real-Time Feed Attivo");
          setRevision((r) => r + 1);
        }
      } catch (e) {
        console.warn("[LimenChart] Error loading historical candles:", e);
        setFeedStatus("fallback");
        setStatusMessage("Dati Limen Fallback");
      }
    };

    loadHistory();

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
              if (prev.length === 0) return [bar];
              const last = prev[prev.length - 1];
              if (last.time === bar.time) {
                return [...prev.slice(0, -1), bar];
              }
              return [...prev, bar];
            });

            if (priceSeriesRef.current) {
              priceSeriesRef.current.update({
                time: bar.time as Time,
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                value: bar.close,
              } as any);
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

  // Calcola e applica EMA
  useEffect(() => {
    if (!showEma || candles.length < 20) {
      ema20Ref.current?.applyOptions({ visible: false });
      ema50Ref.current?.applyOptions({ visible: false });
      ema200Ref.current?.applyOptions({ visible: false });
      return;
    }

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

    const zip = (values: (number | null)[]): { time: Time; value: number }[] => {
      const data: { time: Time; value: number }[] = [];
      for (let i = 0; i < values.length && i < candles.length; i++) {
        const val = values[i];
        if (val != null) data.push({ time: candles[i].time as Time, value: val });
      }
      return data;
    };

    const savedRange = chartRef.current?.timeScale().getVisibleLogicalRange();
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
    if (savedRange) {
      chartRef.current?.timeScale().setVisibleLogicalRange(savedRange);
    }
  }, [candles, showEma]);

  // ── 3. Proiettore Coordinate per Overlay SVG ───────────────────────────────────
  const projector: ChartProjector | null = useMemo(() => {
    const chart = chartRef.current;
    const price = priceSeriesRef.current;
    if (!chart || !price || overlaySize.width <= 0) return null;

    return {
      xForTime: (time: number) => {
        const coordinate = chart.timeScale().timeToCoordinate(time as Time);
        if (coordinate != null) return coordinate;
        const tfSec = timeframeToSeconds(interval);
        const logical = logicalIndexAtTime(candles as any, time, tfSec);
        return logical == null ? null : chart.timeScale().logicalToCoordinate(logical as Logical);
      },
      yForPrice: (value: number) => {
        const coordinate = price.priceToCoordinate(value);
        return coordinate != null ? coordinate : null;
      },
      priceForY: (y: number) => price.coordinateToPrice(y),
      timeForX: (x: number) => {
        const time = chart.timeScale().coordinateToTime(x);
        if (typeof time === "number") return time;
        const logical = chart.timeScale().coordinateToLogical(x);
        const tfSec = timeframeToSeconds(interval);
        return logical == null ? null : timeAtLogicalIndex(candles as any, logical, tfSec);
      },
      width: overlaySize.width,
      height: overlaySize.height,
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
    ],
  );

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

  // Cattura screenshot PNG
  const handleTakeScreenshot = useCallback(() => {
    if (!chartRef.current) return;
    const canvas = containerRef.current?.querySelector("canvas");
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `LIMEN_${symbol}_${interval}_${Date.now()}.png`;
      a.click();
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

  return (
    <div
      className={`limen-proprietary-chart ${isFullscreen ? "is-fullscreen" : ""} ${className}`}
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
        onToggleSessions={() => setSettings((prev) => ({ ...prev, showSessions: !prev.showSessions }))}
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
        onTakeScreenshot={handleTakeScreenshot}
        isFullscreen={isFullscreen}
        onToggleFullscreen={onToggleFullscreen}
        leftCollapsed={leftCollapsed}
        onToggleLeft={onToggleLeft}
        biasScore={biasScore}
        onOpenContext={onOpenContext}
        macroText={macroText}
        macroStatus={macroStatus}
        onOpenNews={onOpenNews}
        onOpenFavorites={() => {
          setSettingsTab("tools");
          setSettingsOpen(true);
        }}
        onScanAi={onScanAi}
        isAiScanning={isAiScanning}
        hasAiSetup={Boolean(aiSetup)}
        showAiOverlay={showAiOverlay}
        onToggleAiOverlay={onToggleAiOverlay}
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
        <div className="limen-chart-viewport">
          {/* Floating Favorite Tools Bar (Draggable ★ bar sincronizzata con Backtest) */}
          <FavoriteToolsBar
            engine={engineAdapter as any}
            activeTool={activeTool}
            onToolChange={setActiveTool}
          />

          <div
            ref={containerRef}
            className="limen-chart-canvas-container"
            onDoubleClick={() => {
              setSettingsTab("chart");
              setSettingsOpen(true);
            }}
          />

          {/* Legenda OHLC Ticking Bar con pulsante ⚙ */}
          {activeBar && (
            <div className="limen-chart-ohlc-legend" aria-hidden="true">
              <span className="symbol-tag">{resolveTradingViewSymbol(symbol)}</span>
              <div className="ohlc-values">
                <span className="val-item">
                  <span className="val-label">O</span>
                  <span className="val-num">{activeBar.open.toFixed(decimals)}</span>
                </span>
                <span className="val-item">
                  <span className="val-label">H</span>
                  <span className="val-num">{activeBar.high.toFixed(decimals)}</span>
                </span>
                <span className="val-item">
                  <span className="val-label">L</span>
                  <span className="val-num">{activeBar.low.toFixed(decimals)}</span>
                </span>
                <span className="val-item">
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
                  <span className="val-item">
                    <span className="val-label">Vol</span>
                    <span className="val-num">{activeBar.volume}</span>
                  </span>
                )}
              </div>
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

          {/* Badge Countdown alla chiusura candela ancorato alla scala dei prezzi a destra */}
          {activeBar && candleCountdown && projector && (() => {
            const priceY = projector.yForPrice(activeBar.close);
            if (priceY == null || priceY < 0 || priceY > projector.height - 32) return null;
            const isUp = activeBar.close >= activeBar.open;
            return (
              <div
                className={`limen-price-scale-countdown ${isUp ? "is-up" : "is-down"}`}
                style={{ top: `${Math.min(projector.height - 32, priceY + 14)}px` }}
                title={`Tempo rimanente alla chiusura della barra: ${candleCountdown}`}
              >
                <span>{candleCountdown}</span>
              </div>
            );
          })()}

          {/* Shading Killzones Sessioni (Asia, Londra, NY) */}
          {projector && showSessions && (
            <SessionOpensOverlay
              engine={engineAdapter as any}
              projector={projector}
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
              activeTool={activeTool}
              onToolDone={() => setActiveTool("cursor")}
              onOpenKnowledge={setKnowledgeToolId}
            />
          )}

          {/* Proiezione Setup Visivo Sentinella IA (Entry, SL, BE, TP1, TP2) e Mini Gadget Spostabile */}
          {projector && showAiOverlay && (aiSetup || isAiScanning) && (
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

        <div className="limen-bottom-right">
          {candleCountdown && (
            <span
              className="limen-bottom-countdown"
              title="Tempo rimanente alla chiusura della candela attiva"
            >
              <span className="limen-countdown-dot" />
              <span>{candleCountdown}</span>
            </span>
          )}
          <span className="limen-bottom-clock">{currentTimeStr}</span>
          <div className="limen-bottom-scales">
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
    </div>
  );
}
