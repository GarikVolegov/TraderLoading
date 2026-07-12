// ─── Replay chart (lightweight-charts core) ──────────────────────────────────
// Owns the IChartApi lifecycle for the terminal: price series (candles /
// heikin / line), volume histogram, watermark, price-pane indicator overlays
// and the reveal mechanic (setData on seeks, series.update on single steps).
// Sub-pane indicators and trade overlays are layered on in later phases.
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createTextWatermark,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type ITextWatermarkPluginApi,
  type Time,
} from "lightweight-charts";
import { useLanguage } from "@/contexts/LanguageContext";
import { computeIndicator } from "@/lib/replay/indicatorCatalog";
import { toHeikinAshi } from "@/lib/replay/heikinAshi";
import type { ReplayCandle } from "@/lib/replay/types";
import { priceDecimals, terminalLocale } from "./format";
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
}: {
  engine: ReplayEngine;
  apiRef?: React.MutableRefObject<ReplayChartApi | null>;
}) {
  const { language } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<PriceSeries | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<"Line">[]>>(new Map());
  const watermarkRef = useRef<ITextWatermarkPluginApi<Time> | null>(null);
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

    return () => {
      if (apiRef) apiRef.current = null;
      watermarkRef.current = null;
      priceSeriesRef.current = null;
      volumeSeriesRef.current = null;
      indicatorSeries.clear();
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

  // ── price-pane indicator overlays ──────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const registry = indicatorSeriesRef.current;
    const activeIds = new Set<string>();

    for (const config of indicators) {
      if (!config.on) continue;
      const output = computeIndicator(config, revealed);
      if (output.pane !== "price" || output.lines.length === 0) continue;
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
        const data: { time: Time; value: number }[] = [];
        for (let i = 0; i < line.values.length && i < revealed.length; i++) {
          const value = line.values[i];
          if (value != null) data.push({ time: revealed[i].time as Time, value });
        }
        series.setData(data);
      });
    }

    for (const [id, seriesList] of registry) {
      if (!activeIds.has(id)) {
        for (const series of seriesList) chart.removeSeries(series);
        registry.delete(id);
      }
    }
  }, [indicators, revealed]);

  return <div ref={containerRef} className="btm-chart" data-testid="replay-chart" />;
}
