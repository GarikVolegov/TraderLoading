// ─── Replay chart (lightweight-charts core) ──────────────────────────────────
// Owns the IChartApi lifecycle for the terminal: price series (candles /
// heikin / line), volume histogram, watermark, price-pane indicator overlays
// and the reveal mechanic (setData on seeks, series.update on single steps).
// Sub-pane indicators and trade overlays are layered on in later phases.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  createTextWatermark,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type ITextWatermarkPluginApi,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import { useLanguage } from "@/contexts/LanguageContext";
import { computeIndicator } from "@/lib/replay/indicatorCatalog";
import { toHeikinAshi } from "@/lib/replay/heikinAshi";
import type { ReplayCandle } from "@/lib/replay/types";
import { DrawingsOverlay } from "./DrawingsOverlay";
import { formatPrice, priceDecimals, terminalLocale } from "./format";
import { PositionOverlay, type ChartProjector } from "./PositionOverlay";
import type { DrawingToolId } from "./toolRailModel";
import type { ReplayEngine } from "./useReplayEngine";

export interface ReplayChartApi {
  zoomIn: () => void;
  zoomOut: () => void;
}

const UP = "#10b981";
const DOWN = "#ef4444";
const VISIBLE_BARS_ON_SEEK = 120;

type PriceSeries =
  | { type: "candles"; series: ISeriesApi<"Candlestick"> }
  | { type: "line"; series: ISeriesApi<"Line"> };

export function ReplayChart({
  engine,
  apiRef,
  activeTool = "cursor",
  onToolDone,
}: {
  engine: ReplayEngine;
  apiRef?: React.MutableRefObject<ReplayChartApi | null>;
  activeTool?: DrawingToolId;
  onToolDone?: () => void;
}) {
  const { language } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<PriceSeries | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">[]>>(new Map());
  const watermarkRef = useRef<ITextWatermarkPluginApi<Time> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const [revision, setRevision] = useState(0);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const lastRenderRef = useRef<{ firstTime: number | null; length: number; chartType: string }>({
    firstTime: null,
    length: 0,
    chartType: "candles",
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

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(148,163,184,0.4)", labelBackgroundColor: "#334155" },
        horzLine: { color: "rgba(148,163,184,0.4)", labelBackgroundColor: "#334155" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.08, bottom: 0.12 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        shiftVisibleRangeOnNewBar: true,
      },
      localization: { locale: terminalLocale(language) },
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
      };
    }

    // Overlay re-projection: pan/zoom and container resizes bump `revision`.
    const bump = () => setRevision((value) => value + 1);
    chart.timeScale().subscribeVisibleLogicalRangeChange(bump);
    const resizeObserver = new ResizeObserver(() => {
      setOverlaySize({ width: container.clientWidth, height: container.clientHeight });
      bump();
    });
    resizeObserver.observe(container);
    setOverlaySize({ width: container.clientWidth, height: container.clientHeight });

    return () => {
      resizeObserver.disconnect();
      if (apiRef) apiRef.current = null;
      watermarkRef.current = null;
      priceSeriesRef.current = null;
      volumeSeriesRef.current = null;
      markersRef.current = null;
      priceLinesRef.current = [];
      indicatorSeries.clear();
      subSeries.clear();
      lastRenderRef.current = { firstTime: null, length: 0, chartType: "candles" };
      chart.remove();
      chartRef.current = null;
    };
  }, [language, apiRef]);

  // ── watermark (symbol + timeframe) ─────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    watermarkRef.current?.detach();
    watermarkRef.current = createTextWatermark(chart.panes()[0], {
      horzAlign: "center",
      vertAlign: "center",
      lines: [
        {
          text: `${symbol}  ${interval}`,
          color: "rgba(255,255,255,0.05)",
          fontSize: 44,
          fontStyle: "bold",
        },
      ],
    });
  }, [symbol, interval]);

  // ── price series management (type swaps recreate the series) ──────────────
  const ensurePriceSeries = useCallback((): PriceSeries | null => {
    const chart = chartRef.current;
    if (!chart) return null;
    const wanted = chartType === "line" ? "line" : "candles";
    const existing = priceSeriesRef.current;
    if (existing && existing.type === wanted) return existing;
    if (existing) chart.removeSeries(existing.series);

    if (wanted === "line") {
      const series = chart.addSeries(LineSeries, {
        color: "#60a5fa",
        lineWidth: 2,
        priceFormat: { type: "price", precision: priceDecimals(symbol), minMove: 10 ** -priceDecimals(symbol) },
      });
      priceSeriesRef.current = { type: "line", series };
    } else {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        borderUpColor: UP,
        borderDownColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
        priceFormat: { type: "price", precision: priceDecimals(symbol), minMove: 10 ** -priceDecimals(symbol) },
      });
      priceSeriesRef.current = { type: "candles", series };
    }
    // Markers and price lines are bound to the price series: rebind on swap.
    markersRef.current = createSeriesMarkers(priceSeriesRef.current.series);
    priceLinesRef.current = [];
    return priceSeriesRef.current;
  }, [chartType, symbol]);

  // ── reveal: setData on seeks, update on single steps ───────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const price = ensurePriceSeries();
    if (!chart || !price) return;

    // volume series lives in the main pane, scaled to the bottom band
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
    } else if (!showVolume && volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }

    const last = lastRenderRef.current;
    const firstTime = displayCandles.length > 0 ? displayCandles[0].time : null;
    const isIncremental =
      last.firstTime === firstTime &&
      last.chartType === chartType &&
      last.length > 0 &&
      displayCandles.length > last.length &&
      displayCandles.length - last.length <= 3;

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
      color: candle.close >= candle.open ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)",
    });

    if (isIncremental) {
      for (let i = last.length; i < displayCandles.length; i++) {
        if (price.type === "line") price.series.update(toLinePoint(displayCandles[i]));
        else price.series.update(toCandlePoint(displayCandles[i]));
        volumeSeriesRef.current?.update(toVolumePoint(displayCandles[i]));
      }
    } else {
      if (price.type === "line") price.series.setData(displayCandles.map(toLinePoint));
      else price.series.setData(displayCandles.map(toCandlePoint));
      volumeSeriesRef.current?.setData(showVolume ? displayCandles.map(toVolumePoint) : []);
      if (displayCandles.length > 0) {
        const to = displayCandles.length - 1 + 4;
        chart.timeScale().setVisibleLogicalRange({ from: to - VISIBLE_BARS_ON_SEEK, to });
      }
    }

    lastRenderRef.current = { firstTime, length: displayCandles.length, chartType };
  }, [displayCandles, chartType, showVolume, ensurePriceSeries]);

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
          pane?.setStretchFactor(28);
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
  }, [indicators, revealed]);

  // ── closed-trade markers (entry arrows, exit dots) ─────────────────────────
  const lastRevealedTime = revealed.length > 0 ? revealed[revealed.length - 1].time : null;
  useEffect(() => {
    const markersApi = markersRef.current;
    if (!markersApi || lastRevealedTime == null) return;
    const markers: SeriesMarker<Time>[] = [];
    for (const trade of engine.trades) {
      if (trade.entryTime <= lastRevealedTime) {
        markers.push({
          time: trade.entryTime as Time,
          position: trade.direction === "buy" ? "belowBar" : "aboveBar",
          color: trade.direction === "buy" ? UP : DOWN,
          shape: trade.direction === "buy" ? "arrowUp" : "arrowDown",
          text: `${trade.direction === "buy" ? "▲" : "▼"} ${formatPrice(trade.entryPrice, symbol)}`,
        });
      }
      if (trade.exitTime <= lastRevealedTime) {
        markers.push({
          time: trade.exitTime as Time,
          position: "aboveBar",
          color: trade.result === "win" ? UP : trade.result === "loss" ? DOWN : "#eab308",
          shape: "circle",
          text: formatPrice(trade.exitPrice, symbol),
        });
      }
    }
    markers.sort((a, b) => (a.time as number) - (b.time as number));
    markersApi.setMarkers(markers);
  }, [engine.trades, lastRevealedTime, symbol, chartType]);

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
  }, [engine.position, chartType, symbol]);

  // ── projector for the SVG overlay ──────────────────────────────────────────
  const projector: ChartProjector | null = useMemo(() => {
    const chart = chartRef.current;
    const price = priceSeriesRef.current;
    if (!chart || !price || overlaySize.width <= 0) return null;
    return {
      xForTime: (time: number) => {
        const coordinate = chart.timeScale().timeToCoordinate(time as Time);
        return coordinate == null ? null : coordinate;
      },
      yForPrice: (value: number) => {
        const coordinate = price.series.priceToCoordinate(value);
        return coordinate == null ? null : coordinate;
      },
      priceForY: (y: number) => price.series.coordinateToPrice(y),
      timeForX: (x: number) => {
        const time = chart.timeScale().coordinateToTime(x);
        return typeof time === "number" ? time : null;
      },
      width: overlaySize.width,
      height: overlaySize.height,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- revision invalidates chart coordinates after pan/zoom
  }, [overlaySize, revision, revealed.length]);

  return (
    <>
      <div ref={containerRef} className="btm-chart" data-testid="replay-chart" />
      {projector && <PositionOverlay engine={engine} projector={projector} revision={revision} />}
      {projector && (
        <DrawingsOverlay
          engine={engine}
          projector={projector}
          revision={revision}
          activeTool={activeTool}
          onToolDone={onToolDone ?? (() => undefined)}
        />
      )}
    </>
  );
}
