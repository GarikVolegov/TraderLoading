import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  CrosshairMode,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { fetchReplayCandles } from "@/lib/replayCandlesApi";
import { computeMtfContext } from "./chartMtf";

interface MtfContextChartProps {
  symbol: string;
  htfInterval: string;
  /** Close-time of the main chart's current replay bar (the shared cursor). */
  cursorCloseTime: number | null;
  /** Current replay price, used to close the forming higher-timeframe bar. */
  cursorPrice: number;
  startDate?: string;
  height?: number;
}

/**
 * Read-only higher-timeframe chart locked to the main replay cursor. It fetches
 * its own HTF series and, on every cursor move, renders the window up to that
 * moment with the containing bar forming — see computeMtfContext.
 */
export default function MtfContextChart({
  symbol,
  htfInterval,
  cursorCloseTime,
  cursorPrice,
  startDate,
  height = 200,
}: MtfContextChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [htfCandles, setHtfCandles] = useState<CandlestickData<Time>[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const normalizedSymbol = symbol.replace("/", "");
    const controller = new AbortController();
    setError(null);
    fetchReplayCandles(
      { symbol: normalizedSymbol, interval: htfInterval, startDate: startDate || undefined },
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setHtfCandles(
          data.candles.map((c) => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          })),
        );
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Errore caricamento contesto");
      });
    return () => controller.abort();
  }, [symbol, htfInterval, startDate]);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true, secondsVisible: false },
      handleScroll: false,
      handleScale: false,
      height,
      width: containerRef.current.clientWidth,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    chartRef.current = chart;
    seriesRef.current = series;

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    if (htfCandles.length === 0 || cursorCloseTime == null) {
      series.setData([]);
      return;
    }
    const view = computeMtfContext(htfCandles, htfInterval, cursorCloseTime, cursorPrice);
    series.setData(view.candles);
    chart.timeScale().fitContent();
  }, [htfCandles, htfInterval, cursorCloseTime, cursorPrice]);

  return (
    <div className="relative">
      <div ref={containerRef} style={{ height }} />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {error}
        </div>
      )}
    </div>
  );
}
