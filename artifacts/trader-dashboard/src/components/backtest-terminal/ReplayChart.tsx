import { readDesignColors } from "@/lib/designColors";
// ─── Replay chart (lightweight-charts core) ──────────────────────────────────
// Owns the IChartApi lifecycle for the terminal: price series (candles /
// heikin / line), volume histogram, watermark, price-pane indicator overlays
// and the reveal mechanic (setData on seeks, series.update on single steps).
// Sub-pane indicators and trade overlays are layered on in later phases.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AreaSeries,
  BarSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  createTextWatermark,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  PriceScaleMode,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type ITextWatermarkPluginApi,
  type Logical,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { Settings2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { computeIndicator } from "@/lib/replay/indicatorCatalog";
import { cursorAtReplayTime, logicalIndexAtTime, timeAtLogicalIndex } from "@/lib/replay/replayClock";
import { toHeikinAshi } from "@/lib/replay/heikinAshi";
import type { ReplayCandle } from "@/lib/replay/types";
import { DrawingsOverlay } from "./DrawingsOverlay";
import { ChartAlertsOverlay } from "./ChartAlertsOverlay";
import type { ReplayAlertsApi } from "./useReplayAlerts";
import { formatPrice, priceDecimals, terminalLocale } from "./format";
import { PositionOverlay, type ChartProjector } from "./PositionOverlay";
import { SessionOpensOverlay } from "./SessionOpensOverlay";
import { LimenAiSetupOverlay } from "../chart/LimenAiSetupOverlay";
import type { VarcoSetupPlan } from "@workspace/api-client-react";
import type { DrawingToolId } from "./toolRailModel";
import type { ReplayEngine } from "./useReplayEngine";
import { formatBlindTimeOnly } from "./dateTime";

export interface ReplayChartApi {
  zoomIn: () => void;
  zoomOut: () => void;
  /** PNG snapshot of the chart (data URL), null before the chart mounts. */
  takeScreenshot: () => string | null;
}

const UP = "#26a69a";
const DOWN = "#ef5350";
const VISIBLE_BARS_ON_SEEK = 120;

type PriceSeries =
  | { type: "candles"; series: ISeriesApi<"Candlestick"> }
  | { type: "bars"; series: ISeriesApi<"Bar"> }
  | { type: "line"; series: ISeriesApi<"Line"> }
  | { type: "area"; series: ISeriesApi<"Area"> };

const replayTimeFormatters = new Map<string, Intl.DateTimeFormat>();
function formatReplayTime(locale: string, unixSeconds: number): string {
  let fmt = replayTimeFormatters.get(locale);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    replayTimeFormatters.set(locale, fmt);
  }
  return fmt.format(new Date(unixSeconds * 1000));
}

function findCandleAtTime(candles: ReplayCandle[], time: number): ReplayCandle | null {
  let lo = 0;
  let hi = candles.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const c = candles[mid];
    if (c.time === time) return c;
    if (c.time < time) lo = mid + 1;
    else hi = mid - 1;
  }
  return null;
}

export function ReplayChart({
  engine,
  apiRef,
  activeTool = "cursor",
  onToolDone,
  onOpenChartSettings,
  onOpenKnowledge,
  aiSetup,
  showAiOverlay = true,
  onUpdateAiSetup,
  onAdoptAiSetup,
  onToggleAiOverlay,
  alertsApi,
}: {
  engine: ReplayEngine;
  apiRef?: React.MutableRefObject<ReplayChartApi | null>;
  activeTool?: DrawingToolId;
  onToolDone?: () => void;
  onOpenChartSettings?: () => void;
  onOpenKnowledge?: (tool: DrawingToolId) => void;
  aiSetup?: VarcoSetupPlan | null;
  showAiOverlay?: boolean;
  onUpdateAiSetup?: (setup: VarcoSetupPlan) => void;
  onAdoptAiSetup?: () => void;
  onToggleAiOverlay?: () => void;
  alertsApi?: ReplayAlertsApi;
}) {
  const { language, t } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<PriceSeries | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">[]>>(new Map());
  const watermarkRef = useRef<ITextWatermarkPluginApi<Time> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const historyLoaderRef = useRef(engine.ensureHistoryBefore);
  historyLoaderRef.current = engine.ensureHistoryBefore;
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const [revision, setRevision] = useState(0);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [crosshairY, setCrosshairY] = useState<number | null>(null);
  // Bumped when the chart instance is recreated: the
  // data/watermark/marker/price-line effects must re-run against the new chart
  // even though their own deps did not change.
  const [chartEpoch, setChartEpoch] = useState(0);
  const lastRenderRef = useRef<{ firstTime: number | null; lastTime: number | null; length: number; chartType: string; lastValue: string }>({
    firstTime: null,
    lastTime: null,
    length: 0,
    chartType: "candles",
    lastValue: "",
  });

  const { revealed, symbol, interval, indicators, settings } = engine;
  const chartType = settings.chartType;

  const displayCandles = useMemo(
    () => (chartType === "heikin" ? toHeikinAshi(revealed) : revealed),
    [chartType, revealed],
  );

  const showVolume = useMemo(
    () => indicators.some((indicator) => indicator.on && indicator.type === "volume"),
    [indicators],
  );

  // ── chart lifecycle ────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const indicatorSeries = indicatorSeriesRef.current;
    const subSeries = subSeriesRef.current;

    const theme = readDesignColors();
    const bg1 = settings.chartBgColor1 ?? theme.background;
    const bg2 = settings.chartBgColor2 ?? theme.background;
    const isGradient = settings.chartBgType === "gradient";
    const gridColor = settings.gridColor ?? theme.panel;
    const toLineStyle = (s?: string) =>
      s === "solid" ? LineStyle.Solid : s === "dotted" ? LineStyle.Dotted : LineStyle.Dashed;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: isGradient
          ? { type: ColorType.VerticalGradient, topColor: bg1, bottomColor: bg2 }
          : { type: ColorType.Solid, color: bg1 },
        textColor: settings.textColor ?? theme.muted,
        fontFamily: getComputedStyle(container).fontFamily,
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: settings.showVertGrid !== false, color: gridColor, style: toLineStyle(settings.gridStyle) },
        horzLines: { visible: settings.showHorzGrid !== false, color: gridColor, style: toLineStyle(settings.gridStyle) },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: settings.crosshairColor ?? "rgba(148,163,184,0.4)",
          style: toLineStyle(settings.crosshairStyle),
          labelBackgroundColor: theme.border,
        },
        horzLine: {
          color: settings.crosshairColor ?? "rgba(148,163,184,0.4)",
          style: toLineStyle(settings.crosshairStyle),
          labelBackgroundColor: theme.border,
        },
      },
      rightPriceScale: {
        mode:
          settings.priceScaleMode === "logarithmic"
            ? PriceScaleMode.Logarithmic
            : settings.priceScaleMode === "percentage"
              ? PriceScaleMode.Percentage
              : PriceScaleMode.Normal,
        borderColor: settings.axisColor ?? "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        borderColor: settings.axisColor ?? "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: settings.rightOffsetBars ?? 12,
        shiftVisibleRangeOnNewBar: true,
      },
      localization: {
        locale: terminalLocale(language),
        timeFormatter: (time: Time) => {
          if (typeof time !== "number") return String(time);
          return formatReplayTime(terminalLocale(language), time);
        },
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    if (apiRef) {
      const zoomBy = (factor: number) => {
        const range = chart.timeScale().getVisibleLogicalRange();
        if (!range) return;
        const span = range.to - range.from;
        const nextSpan = Math.max(12, Math.min(1200, span * factor));
        chart.timeScale().setVisibleLogicalRange({ from: range.to - nextSpan, to: range.to });
      };
      apiRef.current = {
        zoomIn: () => zoomBy(1 / 1.35),
        zoomOut: () => zoomBy(1.35),
        takeScreenshot: () => {
          try {
            return chart.takeScreenshot().toDataURL("image/png");
          } catch {
            return null;
          }
        },
      };
    }

    // Overlay re-projection: pan/zoom and container resizes bump `revision` (coalesced per frame).
    const bump = () => setRevision((value) => value + 1);
    let animFrame: number | null = null;
    const scheduleRevision = () => {
      if (animFrame != null) return;
      animFrame = requestAnimationFrame(() => {
        animFrame = null;
        bump();
      });
    };

    const onLogicalRangeChange = (range: { from: number; to: number } | null) => {
      scheduleRevision();
      if (range && range.from < 50 && lastRenderRef.current.length > 0) historyLoaderRef.current();
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onLogicalRangeChange);
    chart.timeScale().subscribeVisibleTimeRangeChange(scheduleRevision);
    const resizeObserver = new ResizeObserver(() => {
      const nextW = container.clientWidth;
      const nextH = container.clientHeight;
      setOverlaySize((prev) => (prev.width === nextW && prev.height === nextH ? prev : { width: nextW, height: nextH }));
      scheduleRevision();
    });
    resizeObserver.observe(container);
    setOverlaySize({ width: container.clientWidth, height: container.clientHeight });
    setChartEpoch((epoch) => epoch + 1);

    // Tracker inerzia cinetica + drag scala prezzi verticale (120 FPS lockstep per i disegni)
    let kineticRaf: number | null = null;
    let kineticUntil = 0;
    let isPointerActive = false;
    let lastTopPrice: number | null = null;
    let lastBottomPrice: number | null = null;
    let lastFromLogical: number | null = null;
    let lastToLogical: number | null = null;

    const runKineticTick = () => {
      kineticRaf = null;
      const pSeries = priceSeriesRef.current?.series;
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
        scheduleRevision();
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

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("touchstart", onPointerDown);
      container.removeEventListener("touchmove", onWheel);
      container.removeEventListener("touchend", onPointerUp);
      container.removeEventListener("wheel", onWheel);
      if (animFrame != null) cancelAnimationFrame(animFrame);
      if (kineticRaf != null) cancelAnimationFrame(kineticRaf);
      resizeObserver.disconnect();
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onLogicalRangeChange);
      chart.timeScale().unsubscribeVisibleTimeRangeChange(scheduleRevision);
      if (apiRef) apiRef.current = null;
      watermarkRef.current = null;
      priceSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersRef.current = null;
      priceLinesRef.current = [];
      highLowLinesRef.current = { high: null, low: null };
      indicatorSeries.clear();
      subSeries.clear();
      lastRenderRef.current = { firstTime: null, lastTime: null, length: 0, chartType: "candles", lastValue: "" };
      chart.remove();
      chartRef.current = null;
    };
    // Appearance and localization are applied in place by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiRef]);

  // Localization does not need a new chart: preserve viewport, drawings and replay.
  // Replay Cieco: the axis and crosshair expose only the hour, never day/month/year.
  const blindMasked = engine.blindMasked;
  useEffect(() => {
    const loc = terminalLocale(language);
    chartRef.current?.applyOptions({
      localization: {
        locale: loc,
        timeFormatter: (time: Time) =>
          typeof time !== "number" ? String(time) : blindMasked ? `${formatBlindTimeOnly(time)} · Cieco` : formatReplayTime(loc, time),
      },
      timeScale: {
        tickMarkFormatter: (time: Time, tickMarkType: number) => {
          if (!blindMasked || typeof time !== "number") return null;
          return tickMarkType >= 3 ? formatBlindTimeOnly(time) : "◆";
        },
      },
    });
  }, [language, chartEpoch, blindMasked]);

  // ── watermark (symbol + timeframe) ─────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    watermarkRef.current?.detach();
    if (settings.showWatermark === false) {
      watermarkRef.current = null;
      return;
    }
    const text = settings.watermarkText?.trim() || `${symbol}  ${interval}`;
    const opacity = settings.watermarkOpacity ?? 0.05;
    const baseHex = settings.textColor && /^#[\da-f]{6}/i.test(settings.textColor) ? settings.textColor.slice(1, 7) : "ffffff";
    const wr = Number.parseInt(baseHex.slice(0, 2), 16) || 255;
    const wg = Number.parseInt(baseHex.slice(2, 4), 16) || 255;
    const wb = Number.parseInt(baseHex.slice(4, 6), 16) || 255;
    watermarkRef.current = createTextWatermark(chart.panes()[0], {
      horzAlign: "center",
      vertAlign: "center",
      lines: [
        {
          text,
          color: `rgba(${wr}, ${wg}, ${wb}, ${opacity})`,
          fontSize: 44,
          fontStyle: "bold",
        },
      ],
    });
  }, [symbol, interval, chartEpoch, settings.showWatermark, settings.watermarkText, settings.watermarkOpacity, settings.textColor]);

  // ── dynamic chart layout & scale options ───────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const theme = readDesignColors();
    const bg1 = settings.chartBgColor1 ?? theme.background;
    const bg2 = settings.chartBgColor2 ?? theme.background;
    const isGradient = settings.chartBgType === "gradient";
    const gridColor = settings.gridColor ?? theme.panel;
    const toLineStyle = (s?: string) =>
      s === "solid" ? LineStyle.Solid : s === "dotted" ? LineStyle.Dotted : LineStyle.Dashed;

    chart.applyOptions({
      layout: {
        background: isGradient
          ? { type: ColorType.VerticalGradient, topColor: bg1, bottomColor: bg2 }
          : { type: ColorType.Solid, color: bg1 },
        textColor: settings.textColor ?? theme.muted,
      },
      timeScale: {
        borderColor: settings.axisColor ?? "rgba(255,255,255,0.08)",
        rightOffset: settings.rightOffsetBars ?? 12,
      },
      grid: {
        vertLines: { visible: settings.showVertGrid !== false, color: gridColor, style: toLineStyle(settings.gridStyle) },
        horzLines: { visible: settings.showHorzGrid !== false, color: gridColor, style: toLineStyle(settings.gridStyle) },
      },
      crosshair: {
        vertLine: {
          color: settings.crosshairColor ?? "rgba(148,163,184,0.4)",
          style: toLineStyle(settings.crosshairStyle),
          labelBackgroundColor: settings.axisColor ?? theme.border,
        },
        horzLine: {
          color: settings.crosshairColor ?? "rgba(148,163,184,0.4)",
          style: toLineStyle(settings.crosshairStyle),
          labelBackgroundColor: settings.axisColor ?? theme.border,
        },
      },
      rightPriceScale: {
        borderColor: settings.axisColor ?? "rgba(255,255,255,0.08)",
        mode:
          settings.priceScaleMode === "logarithmic"
            ? PriceScaleMode.Logarithmic
            : settings.priceScaleMode === "percentage"
              ? PriceScaleMode.Percentage
              : PriceScaleMode.Normal,
      },
    });
  }, [
    chartEpoch,
    settings.textColor,
    settings.axisColor,
    settings.rightOffsetBars,
    settings.chartBgType,
    settings.chartBgColor1,
    settings.chartBgColor2,
    settings.showVertGrid,
    settings.showHorzGrid,
    settings.gridColor,
    settings.gridStyle,
    settings.crosshairColor,
    settings.crosshairStyle,
    settings.priceScaleMode,
  ]);

  // ── price series management (type swaps recreate the series) ──────────────
  const ensurePriceSeries = useCallback((): PriceSeries | null => {
    const chart = chartRef.current;
    if (!chart) return null;
    const wanted: "candles" | "bars" | "line" | "area" =
      chartType === "line" ? "line" : chartType === "area" ? "area" : chartType === "bars" ? "bars" : "candles";
    const existing = priceSeriesRef.current;
    if (existing && existing.type === wanted) return existing;
    if (existing) {
      markersRef.current?.detach();
      chart.removeSeries(existing.series);
      highLowLinesRef.current = { high: null, low: null };
    }

    const precision = priceDecimals(symbol);
    const minMove = 10 ** -precision;
    const priceFormat = { type: "price" as const, precision, minMove };

    const upColor = settings.candleUpColor ?? UP;
    const downColor = settings.candleDownColor ?? DOWN;
    const wickUpColor = settings.wickUpColor ?? upColor;
    const wickDownColor = settings.wickDownColor ?? downColor;
    const borderUpColor = settings.borderUpColor ?? upColor;
    const borderDownColor = settings.borderDownColor ?? downColor;
    const lineColor = settings.lineColor ?? "#3b82f6";
    const areaTopColor = settings.areaTopColor ?? "rgba(59, 130, 246, 0.35)";
    const areaBottomColor = settings.areaBottomColor ?? "rgba(59, 130, 246, 0.0)";

    if (wanted === "line") {
      const series = chart.addSeries(LineSeries, {
        color: lineColor,
        lineWidth: 2,
        priceFormat,
        priceLineVisible: settings.showLastPriceLine !== false,
      });
      priceSeriesRef.current = { type: "line", series };
    } else if (wanted === "area") {
      const series = chart.addSeries(AreaSeries, {
        lineColor,
        topColor: areaTopColor,
        bottomColor: areaBottomColor,
        lineWidth: 2,
        priceFormat,
        priceLineVisible: settings.showLastPriceLine !== false,
      });
      priceSeriesRef.current = { type: "area", series };
    } else if (wanted === "bars") {
      const series = chart.addSeries(BarSeries, {
        upColor,
        downColor,
        priceFormat,
        priceLineVisible: settings.showLastPriceLine !== false,
      });
      priceSeriesRef.current = { type: "bars", series };
    } else {
      const series = chart.addSeries(CandlestickSeries, {
        upColor,
        downColor,
        borderUpColor,
        borderDownColor,
        borderVisible: settings.candleBordersVisible !== false,
        wickVisible: settings.candleWicksVisible !== false,
        wickUpColor,
        wickDownColor,
        priceFormat,
        priceLineVisible: settings.showLastPriceLine !== false,
      });
      priceSeriesRef.current = { type: "candles", series };
    }
    // Markers and price lines are bound to the price series: rebind on swap.
    markersRef.current = createSeriesMarkers(priceSeriesRef.current.series);
    priceLinesRef.current = [];
    // A retained viewport may emit no range event when the series is replaced.
    // Reproject drawings against the new series instead of retaining its removed predecessor.
    setRevision((value) => value + 1);
    return priceSeriesRef.current;
  }, [
    chartType,
    symbol,
    settings.candleUpColor,
    settings.candleDownColor,
    settings.wickUpColor,
    settings.wickDownColor,
    settings.borderUpColor,
    settings.borderDownColor,
    settings.candleBordersVisible,
    settings.candleWicksVisible,
    settings.lineColor,
    settings.areaTopColor,
    settings.areaBottomColor,
    settings.showLastPriceLine,
  ]);

  // ── dynamic series appearance updates ──────────────────────────────────────
  useEffect(() => {
    const price = priceSeriesRef.current;
    if (!price) return;
    const precision = priceDecimals(symbol);
    price.series.applyOptions({ priceFormat: { type: "price", precision, minMove: 10 ** -precision } });
    const upColor = settings.candleUpColor ?? UP;
    const downColor = settings.candleDownColor ?? DOWN;
    const wickUpColor = settings.wickUpColor ?? upColor;
    const wickDownColor = settings.wickDownColor ?? downColor;
    const borderUpColor = settings.borderUpColor ?? upColor;
    const borderDownColor = settings.borderDownColor ?? downColor;
    const lineColor = settings.lineColor ?? "#3b82f6";
    const areaTopColor = settings.areaTopColor ?? "rgba(59, 130, 246, 0.35)";
    const areaBottomColor = settings.areaBottomColor ?? "rgba(59, 130, 246, 0.0)";

    if (price.type === "candles") {
      price.series.applyOptions({
        upColor,
        downColor,
        wickUpColor,
        wickDownColor,
        borderUpColor,
        borderDownColor,
        borderVisible: settings.candleBordersVisible !== false,
        wickVisible: settings.candleWicksVisible !== false,
        priceLineVisible: settings.showLastPriceLine !== false,
      });
    } else if (price.type === "bars") {
      price.series.applyOptions({
        upColor,
        downColor,
        priceLineVisible: settings.showLastPriceLine !== false,
      });
    } else if (price.type === "line") {
      price.series.applyOptions({
        color: lineColor,
        priceLineVisible: settings.showLastPriceLine !== false,
      });
    } else if (price.type === "area") {
      price.series.applyOptions({
        lineColor,
        topColor: areaTopColor,
        bottomColor: areaBottomColor,
        priceLineVisible: settings.showLastPriceLine !== false,
      });
    }
  }, [
    chartEpoch,
    chartType,
    symbol,
    settings.candleUpColor,
    settings.candleDownColor,
    settings.wickUpColor,
    settings.wickDownColor,
    settings.borderUpColor,
    settings.borderDownColor,
    settings.candleBordersVisible,
    settings.candleWicksVisible,
    settings.lineColor,
    settings.areaTopColor,
    settings.areaBottomColor,
    settings.showLastPriceLine,
  ]);

  // ── interactive OHLC status line / legend tracking (O(log N) + RAF-throttled) ──
  const [hoverCandle, setHoverCandle] = useState<ReplayCandle | null>(null);
  const displayCandlesRef = useRef<ReplayCandle[]>(displayCandles);
  displayCandlesRef.current = displayCandles;

  const crosshairYRef = useRef<number | null>(null);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    let rafId: number | null = null;
    let pendingTime: number | null = null;
    let pendingY: number | null = null;

    const handler = (param: { time?: Time; point?: { x: number; y: number } }) => {
      if (param.point && typeof param.point.y === "number") {
        pendingY = param.point.y;
      } else {
        pendingY = null;
      }
      crosshairYRef.current = pendingY;
      if (!param.point || !param.time || typeof param.time !== "number") {
        pendingTime = null;
      } else {
        pendingTime = param.time;
      }
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setCrosshairY((prevY) => (prevY === pendingY ? prevY : pendingY));
        if (pendingTime === null) {
          setHoverCandle((prev) => (prev === null ? prev : null));
          return;
        }
        const list = displayCandlesRef.current;
        const candle = findCandleAtTime(list, pendingTime);
        setHoverCandle((prev) => {
          if (prev === candle) return prev;
          if (
            prev &&
            candle &&
            prev.time === candle.time &&
            prev.close === candle.close &&
            prev.open === candle.open &&
            prev.high === candle.high &&
            prev.low === candle.low
          ) {
            return prev;
          }
          return candle;
        });
      });
    };
    chart.subscribeCrosshairMove(handler);
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      chart.unsubscribeCrosshairMove(handler);
    };
  }, [chartEpoch]);

  // ── reveal: setData on seeks, update on single steps ───────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const previousRange = chart?.timeScale().getVisibleLogicalRange();
    const price = ensurePriceSeries();
    if (!chart || !price) return;

    // volume series lives in the main pane, scaled to the bottom band
    let volumeJustCreated = false;
    if (showVolume && !volumeSeriesRef.current) {
      const series = chart.addSeries(HistogramSeries, {
        color: "rgba(120,120,120,0.3)",
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });
      volumeSeriesRef.current = series;
      volumeJustCreated = true;
    } else if (!showVolume && volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }

    const last = lastRenderRef.current;
    const firstTime = displayCandles.length > 0 ? displayCandles[0].time : null;
    const lastBar = displayCandles[displayCandles.length - 1];
    const lastValue = lastBar ? `${interval}:${lastBar.time}:${lastBar.open}:${lastBar.high}:${lastBar.low}:${lastBar.close}:${lastBar.volume}` : "";
    if (last.firstTime === firstTime && last.chartType === chartType && last.length === displayCandles.length && last.lastValue === lastValue) {
      if (volumeJustCreated && volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(
          displayCandles.map((candle) => ({
            time: candle.time as Time,
            value: candle.volume ?? 0,
            color: candle.close >= candle.open ? (settings.volumeUpColor ?? "rgba(16,185,129,0.25)") : (settings.volumeDownColor ?? "rgba(239,68,68,0.25)"),
          })),
        );
      }
      return;
    }
    const isIncremental =
      last.firstTime === firstTime &&
      last.chartType === chartType &&
      last.length > 0 &&
      displayCandles[last.length - 1]?.time === last.lastTime &&
      displayCandles.length >= last.length &&
      displayCandles.length - last.length <= 10;

    const isLineLike = price.type === "line" || price.type === "area";
    const toLinePoint = (candle: ReplayCandle) => ({ time: candle.time as Time, value: candle.close });
    const toCandlePoint = (candle: ReplayCandle) => ({
      time: candle.time as Time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    });
    const toVolumePoint = (candle: ReplayCandle) => ({
      time: candle.time as Time,
      value: candle.volume ?? 0,
      color: candle.close >= candle.open ? (settings.volumeUpColor ?? "rgba(16,185,129,0.25)") : (settings.volumeDownColor ?? "rgba(239,68,68,0.25)"),
    });

    if (isIncremental) {
      const deltaBars = displayCandles.length - last.length;
      const prevBar = displayCandles[last.length - 1];
      if (isLineLike) price.series.update(toLinePoint(prevBar));
      else price.series.update(toCandlePoint(prevBar));
      volumeSeriesRef.current?.update(toVolumePoint(prevBar));
      for (let i = last.length; i < displayCandles.length; i++) {
        const bar = displayCandles[i];
        if (isLineLike) price.series.update(toLinePoint(bar));
        else price.series.update(toCandlePoint(bar));
        volumeSeriesRef.current?.update(toVolumePoint(bar));
      }
      // Auto-Follow Camera: scorre fluidamente in avanti preservando lo zoom dell'utente
      if (previousRange && deltaBars > 0) {
        const span = Math.max(20, previousRange.to - previousRange.from);
        const rightOffset = settings.rightOffsetBars ?? 12;
        const isNearRightEdge = previousRange.to >= last.length - 1 - span * 0.35;
        if (engine.playing || isNearRightEdge) {
          const targetTo = displayCandles.length - 1 + rightOffset;
          chart.timeScale().setVisibleLogicalRange({
            from: targetTo - span,
            to: targetTo,
          });
        }
      }
    } else {
      const addedBefore = displayCandles.length - last.length;
      const isPrepend = addedBefore > 0 && last.length > 0 && last.lastValue === lastValue &&
        displayCandles[addedBefore]?.time === last.firstTime;
      if (isLineLike) price.series.setData(displayCandles.map(toLinePoint));
      else price.series.setData(displayCandles.map(toCandlePoint));
      volumeSeriesRef.current?.setData(showVolume ? displayCandles.map(toVolumePoint) : []);
      if (isPrepend && previousRange) {
        chart.timeScale().setVisibleLogicalRange({ from: previousRange.from + addedBefore, to: previousRange.to + addedBefore });
      } else if (previousRange && last.length > 0 && last.firstTime === firstTime) {
        const span = Math.max(20, previousRange.to - previousRange.from);
        const rightOffset = settings.rightOffsetBars ?? 12;
        const targetTo = displayCandles.length - 1 + rightOffset;
        chart.timeScale().setVisibleLogicalRange(
          engine.playing
            ? { from: targetTo - span, to: targetTo }
            : previousRange,
        );
      } else if (displayCandles.length > 0) {
        const targetTime = engine.currentBar?.time ?? engine.replayTime;
        const rightOffset = settings.rightOffsetBars ?? 12;
        if (targetTime != null) {
          const cursorIdx = cursorAtReplayTime(displayCandles, targetTime + 0.001);
          if (cursorIdx >= 0) {
            const targetTo = cursorIdx + rightOffset;
            chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, targetTo - VISIBLE_BARS_ON_SEEK), to: targetTo });
          } else {
            const to = displayCandles.length - 1 + rightOffset;
            chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, to - VISIBLE_BARS_ON_SEEK), to });
          }
        } else {
          const to = displayCandles.length - 1 + rightOffset;
          chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, to - VISIBLE_BARS_ON_SEEK), to });
        }
      }
    }

    lastRenderRef.current = { firstTime, lastTime: lastBar?.time ?? null, length: displayCandles.length, chartType, lastValue };
  }, [displayCandles, chartType, showVolume, ensurePriceSeries, chartEpoch, interval, settings.volumeUpColor, settings.volumeDownColor, engine.playing, settings.rightOffsetBars]);

  useEffect(() => {
    volumeSeriesRef.current?.setData(displayCandles.map((candle) => ({
      time: candle.time as Time,
      value: candle.volume ?? 0,
      color: candle.close >= candle.open
        ? (settings.volumeUpColor ?? "rgba(16,185,129,0.25)")
        : (settings.volumeDownColor ?? "rgba(239,68,68,0.25)"),
    })));
    // Data updates are handled incrementally above. This effect recolors existing bars.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.volumeUpColor, settings.volumeDownColor, chartEpoch, showVolume]);

  // ── session high / low price lines ─────────────────────────────────────────
  const highLowLinesRef = useRef<{ high: IPriceLine | null; low: IPriceLine | null }>({ high: null, low: null });
  useEffect(() => {
    const price = priceSeriesRef.current;
    if (!price) return;
    if (highLowLinesRef.current.high) {
      price.series.removePriceLine(highLowLinesRef.current.high);
      highLowLinesRef.current.high = null;
    }
    if (highLowLinesRef.current.low) {
      price.series.removePriceLine(highLowLinesRef.current.low);
      highLowLinesRef.current.low = null;
    }
    if (settings.showHighLowLines && displayCandles.length > 0) {
      let maxH = -Infinity;
      let minL = Infinity;
      const recent = displayCandles.slice(-120);
      for (const bar of recent) {
        if (bar.high > maxH) maxH = bar.high;
        if (bar.low < minL) minL = bar.low;
      }
      if (maxH > -Infinity) {
        highLowLinesRef.current.high = price.series.createPriceLine({
          price: maxH,
          color: "rgba(16, 185, 129, 0.7)",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "HIGH",
        });
      }
      if (minL < Infinity) {
        highLowLinesRef.current.low = price.series.createPriceLine({
          price: minL,
          color: "rgba(239, 68, 68, 0.7)",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: "LOW",
        });
      }
    }
  }, [displayCandles, settings.showHighLowLines, chartEpoch, chartType]);

  // ── indicator overlays and sub-panes ───────────────────────────────────────
  // Price-pane lines live in pane 0 next to the candles; each active sub-pane
  // indicator (RSI/MACD/ATR/Stoch/custom-sub) gets its own pane below, in
  // configuration order. Series are keyed per indicator id and recreated when
  // the shape (line count or pane index) changes.
  const subSeriesRef = useRef<
    Map<string, { paneIndex: number; lines: ISeriesApi<"Line">[]; histogram: ISeriesApi<"Histogram"> | null; levels: IPriceLine[] }>
  >(new Map());
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const savedRange = chart.timeScale().getVisibleLogicalRange();
    const registry = indicatorSeriesRef.current;
    const subRegistry = subSeriesRef.current;
    const activeIds = new Set<string>();
    const activeSubIds = new Set<string>();
    let nextPaneIndex = 1;

    const zip = (values: (number | null)[]): { time: Time; value: number }[] => {
      const data: { time: Time; value: number }[] = [];
      for (let i = 0; i < values.length && i < revealed.length; i++) {
        const value = values[i];
        if (value != null) data.push({ time: revealed[i].time as Time, value });
      }
      return data;
    };

    for (const config of indicators) {
      if (!config.on) continue;
      const output = computeIndicator(config, revealed);

      if (output.pane === "price" && output.lines.length > 0) {
        activeIds.add(config.id);
        let seriesList = registry.get(config.id) ?? [];
        // Recreate when the line count changes (e.g. custom → bollinger edit).
        if (seriesList.length !== output.lines.length) {
          for (const series of seriesList) chart.removeSeries(series);
          seriesList = output.lines.map(() =>
            chart.addSeries(LineSeries, {
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: false,
              crosshairMarkerVisible: false,
            }),
          );
          registry.set(config.id, seriesList);
        }
        output.lines.forEach((line, lineIndex) => {
          const series = seriesList[lineIndex];
          series.applyOptions({
            color: line.color,
            lineStyle: line.dashed ? 2 : 0,
            lineWidth: lineIndex === 0 ? 2 : 1,
          });
          series.setData(zip(line.values));
        });
        continue;
      }

      if (output.pane === "sub" && output.lines.length > 0) {
        activeSubIds.add(config.id);
        const paneIndex = nextPaneIndex++;
        let entry = subRegistry.get(config.id) ?? null;
        const needsHistogram = output.histogram != null;
        if (
          !entry ||
          entry.paneIndex !== paneIndex ||
          entry.lines.length !== output.lines.length ||
          (entry.histogram != null) !== needsHistogram
        ) {
          if (entry) {
            for (const series of entry.lines) chart.removeSeries(series);
            if (entry.histogram) chart.removeSeries(entry.histogram);
          }
          const histogram = needsHistogram
            ? chart.addSeries(
                HistogramSeries,
                { priceLineVisible: false, lastValueVisible: false, priceFormat: { type: "price", precision: 4, minMove: 0.0001 } },
                paneIndex,
              )
            : null;
          const lines = output.lines.map(() =>
            chart.addSeries(
              LineSeries,
              { lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false },
              paneIndex,
            ),
          );
          entry = { paneIndex, lines, histogram, levels: [] };
          subRegistry.set(config.id, entry);
          const pane = chart.panes()[paneIndex];
          // Relative weight vs. the main pane's default of 2: ≈0.6 → one sub-pane
          // takes ~23% of the height, two take ~19% each (mockup proportions).
          pane?.setStretchFactor(0.6);
        }

        output.lines.forEach((line, lineIndex) => {
          const series = entry!.lines[lineIndex];
          series.applyOptions({
            color: line.color,
            lineStyle: line.dashed ? 2 : 0,
            lineWidth: lineIndex === 0 ? 2 : 1,
          });
          series.setData(zip(line.values));
        });
        if (entry.histogram && output.histogram) {
          const histogramData: { time: Time; value: number; color: string }[] = [];
          for (let i = 0; i < output.histogram.values.length && i < revealed.length; i++) {
            const value = output.histogram.values[i];
            if (value != null) {
              histogramData.push({
                time: revealed[i].time as Time,
                value,
                color: value >= 0 ? output.histogram.positiveColor : output.histogram.negativeColor,
              });
            }
          }
          entry.histogram.setData(histogramData);
        }
        // Reference levels (RSI 30/70, Stoch 20/80) as dashed price lines.
        if (entry.levels.length === 0 && output.levels && entry.lines[0]) {
          entry.levels = output.levels.map((level) =>
            entry!.lines[0].createPriceLine({
              price: level,
              color: "rgba(148,163,184,0.35)",
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: false,
              title: "",
            }),
          );
        }
      }
    }

    for (const [id, seriesList] of registry) {
      if (!activeIds.has(id)) {
        for (const series of seriesList) chart.removeSeries(series);
        registry.delete(id);
      }
    }
    for (const [id, entry] of subRegistry) {
      if (!activeSubIds.has(id)) {
        for (const series of entry.lines) chart.removeSeries(series);
        if (entry.histogram) chart.removeSeries(entry.histogram);
        subRegistry.delete(id);
      }
    }
    if (savedRange) {
      chart.timeScale().setVisibleLogicalRange(savedRange);
    }
  }, [indicators, revealed, chartEpoch]);

  // ── closed-trade markers (entry arrows, exit dots) ─────────────────────────
  const lastRevealedTime = revealed.length > 0 ? revealed[revealed.length - 1].time : null;
  const visibleTradeCountKey = useMemo(() => {
    if (engine.replayTime == null || engine.trades.length === 0) return "0:0";
    let entries = 0;
    let exits = 0;
    for (const t of engine.trades) {
      if (t.entryTime <= engine.replayTime) entries++;
      if (t.exitTime <= engine.replayTime) exits++;
    }
    return `${entries}:${exits}`;
  }, [engine.trades, engine.replayTime]);

  useEffect(() => {
    const markersApi = markersRef.current;
    if (!markersApi || lastRevealedTime == null) return;
    if ((settings.showTradesOnChart === false && engine.hoveredTradeId == null) || engine.trades.length === 0) {
      markersApi.setMarkers([]);
      return;
    }
    const markers: SeriesMarker<Time>[] = [];
    const timeForExecution = (time: number) => {
      const index = cursorAtReplayTime(revealed, time);
      return index < 0 ? null : revealed[index].time;
    };
    for (const trade of engine.trades) {
      const isHovered = engine.hoveredTradeId === trade.id;
      if (settings.showTradesOnChart === false && !isHovered) continue;

      const entryBarTime = timeForExecution(trade.entryTime);
      const exitBarTime = timeForExecution(trade.exitTime);
      if (engine.replayTime != null && trade.entryTime <= engine.replayTime && entryBarTime != null) {
        markers.push({
          time: entryBarTime as Time,
          position: trade.direction === "buy" ? "belowBar" : "aboveBar",
          color: trade.direction === "buy" ? UP : DOWN,
          shape: trade.direction === "buy" ? "arrowUp" : "arrowDown",
          text: isHovered ? `${trade.direction === "buy" ? "▲ BUY" : "▼ SELL"} ${formatPrice(trade.entryPrice, symbol)}` : undefined,
          size: isHovered ? 2 : 1,
        });
      }
      if (engine.replayTime != null && trade.exitTime <= engine.replayTime && exitBarTime != null) {
        markers.push({
          time: exitBarTime as Time,
          position: "aboveBar",
          color: trade.result === "win" ? UP : trade.result === "loss" ? DOWN : "#eab308",
          shape: "circle",
          text: isHovered ? `${formatPrice(trade.exitPrice, symbol)} (${trade.profit >= 0 ? "+" : ""}${trade.profit.toFixed(0)}€)` : undefined,
          size: isHovered ? 2 : 1,
        });
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    markersApi.setMarkers(markers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine.trades, visibleTradeCountKey, symbol, chartType, chartEpoch, settings.showTradesOnChart, engine.hoveredTradeId]);

  // ── open-position price lines (entry / SL / TP on the price axis) ──────────
  useEffect(() => {
    const price = priceSeriesRef.current;
    if (!price) return;
    for (const line of priceLinesRef.current) price.series.removePriceLine(line);
    priceLinesRef.current = [];
    const position = engine.position;
    if (!position) return;
    const mk = (value: number, color: string, style: LineStyle) =>
      price.series.createPriceLine({
        price: value,
        color,
        lineWidth: 1,
        lineStyle: style,
        axisLabelVisible: true,
        title: "",
      });
    priceLinesRef.current = [
      mk(position.entryPrice, "#3b82f6", LineStyle.Solid),
      mk(position.stopLoss, DOWN, LineStyle.Dashed),
      mk(position.takeProfit, UP, LineStyle.Dashed),
    ];
  }, [engine.position, chartType, symbol, chartEpoch]);

  // ── projector for the SVG overlay ──────────────────────────────────────────
  const projector: ChartProjector | null = useMemo(() => {
    const chart = chartRef.current;
    const price = priceSeriesRef.current;
    if (!chart || !price || overlaySize.width <= 0) return null;
    const priceScaleWidth = chart.priceScale("right")?.width() || 58;
    const timeScaleHeight = chart.timeScale()?.height() || 26;
    const paneWidth = Math.max(0, overlaySize.width - priceScaleWidth);
    const paneHeight = Math.max(0, overlaySize.height - timeScaleHeight);

    return {
      xForTime: (time: number) => {
        // Continuous sub-bar and future logical interpolation first (prevents drawing detachment)
        const logical = logicalIndexAtTime(revealed, time, engine.intervalSeconds);
        if (logical != null) {
          const coordFromLogical = chart.timeScale().logicalToCoordinate(logical as Logical);
          if (coordFromLogical != null) return coordFromLogical;
        }
        const coordinate = chart.timeScale().timeToCoordinate(time as Time);
        return coordinate != null ? coordinate : null;
      },
      yForPrice: (value: number) => {
        const coordinate = price.series.priceToCoordinate(value);
        return coordinate == null ? null : coordinate;
      },
      priceForY: (y: number) => price.series.coordinateToPrice(y),
      timeForX: (x: number) => {
        const logical = chart.timeScale().coordinateToLogical(x);
        if (logical != null && revealed.length > 0) {
          const fromLogical = timeAtLogicalIndex(revealed, logical, engine.intervalSeconds);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision invalidates chart coordinates after pan/zoom
  }, [overlaySize, revision, revealed, engine.intervalSeconds, chartEpoch, chartType]);

  const [chartContextMenu, setChartContextMenu] = useState<{
    x: number;
    y: number;
    price: number;
    time?: number;
  } | null>(null);

  // Shift + Right-click = replay jump to the bar under the cursor;
  // Standard Right-click = apre il menu contestuale chirurgico AUREUS (Allerta, Limite, Salta Barra).
  const onContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container || !projector) return;
    event.preventDefault();
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const time = projector.timeForX(x);

    if (event.shiftKey && typeof time === "number") {
      engine.seekToTime(time);
      return;
    }

    const price = projector.priceForY(y);
    if (price != null && Number.isFinite(price)) {
      setChartContextMenu({
        x: event.clientX,
        y: event.clientY,
        price,
        time: typeof time === "number" ? time : undefined,
      });
    }
  };

  // ── Alt + A shortcut: rapida creazione allerta al prezzo sotto al crosshair ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "a" || e.key === "A" || e.code === "KeyA")) {
        const currentY = crosshairYRef.current;
        if (currentY != null && projector && alertsApi) {
          const price = projector.priceForY(currentY);
          if (price != null && Number.isFinite(price)) {
            e.preventDefault();
            alertsApi.createAlert(price);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [projector, alertsApi]);

  const activeBar = hoverCandle ?? (displayCandles.length > 0 ? displayCandles[displayCandles.length - 1] : null);
  const barChange = activeBar ? activeBar.close - activeBar.open : 0;
  const barPercent = activeBar && activeBar.open !== 0 ? (barChange / activeBar.open) * 100 : 0;
  const isUp = barChange >= 0;

  return (
    <>
      <div
        ref={containerRef}
        className="btm-chart"
        data-testid="replay-chart"
        onContextMenu={onContextMenu}
        onDoubleClick={() => onOpenChartSettings?.()}
      />
      {settings.showOhlcLegend !== false && activeBar && (
        <div className="btm-legend-bar" role="status">
          <div className="btm-legend-symbol">
            <span className="btm-legend-symbol-name">{symbol}</span>
            <span className="btm-legend-interval">{interval}</span>
            <span className="btm-legend-chart-type">{chartType.toUpperCase()}</span>
          </div>
          <div className="btm-legend-ohlc">
            <span className="btm-legend-cell">
              {"O "}<strong className={isUp ? "btm-legend-up" : "btm-legend-dn"}>{formatPrice(activeBar.open, symbol)}</strong>
            </span>
            <span className="btm-legend-cell">
              {"H "}<strong className={isUp ? "btm-legend-up" : "btm-legend-dn"}>{formatPrice(activeBar.high, symbol)}</strong>
            </span>
            <span className="btm-legend-cell">
              {"L "}<strong className={isUp ? "btm-legend-up" : "btm-legend-dn"}>{formatPrice(activeBar.low, symbol)}</strong>
            </span>
            <span className="btm-legend-cell">
              {"C "}<strong className={isUp ? "btm-legend-up" : "btm-legend-dn"}>{formatPrice(activeBar.close, symbol)}</strong>
            </span>
            {settings.showBarChange !== false && (
              <span className={`btm-legend-change ${isUp ? "btm-legend-up" : "btm-legend-dn"}`}>
                {isUp ? "+" : ""}{formatPrice(barChange, symbol)} ({isUp ? "+" : ""}{barPercent.toFixed(2)}%)
              </span>
            )}
            {activeBar.volume != null && activeBar.volume > 0 && (
              <span className="btm-legend-cell btm-legend-vol">
                {"Vol "}<strong>{activeBar.volume.toLocaleString()}</strong>
              </span>
            )}
          </div>
          {onOpenChartSettings && (
            <button
              type="button"
              className="btm-legend-gear-btn"
              onClick={onOpenChartSettings}
              title={t("backtest_terminal.chart_settings_legend")}
              aria-label={t("backtest_terminal.chart_settings_legend")}
            >
              <Settings2 size={13} />
            </button>
          )}
        </div>
      )}
      {projector && settings.showSessions && (
        <SessionOpensOverlay engine={engine} projector={projector} revision={revision} />
      )}
      {projector && <PositionOverlay engine={engine} projector={projector} revision={revision} />}
      {projector && alertsApi && (
        <ChartAlertsOverlay
          engine={engine}
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
      {projector && (
        <DrawingsOverlay
          engine={engine}
          projector={projector}
          revision={revision}
          activeTool={activeTool}
          onToolDone={onToolDone ?? (() => undefined)}
          onOpenKnowledge={onOpenKnowledge}
          onAddAlert={alertsApi?.createAlert}
          externalContextMenu={chartContextMenu}
          onClearExternalContextMenu={() => setChartContextMenu(null)}
          onSeekToTime={(time) => engine.seekToTime(time)}
        />
      )}
      {projector && showAiOverlay && aiSetup && (
        <LimenAiSetupOverlay
          setup={aiSetup}
          projector={projector}
          symbol={engine.symbol}
          onUpdateSetup={onUpdateAiSetup}
          onAdoptSetup={onAdoptAiSetup}
          onClose={onToggleAiOverlay}
        />
      )}
    </>
  );
}
