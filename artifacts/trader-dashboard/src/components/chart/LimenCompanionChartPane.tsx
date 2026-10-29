import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type Logical,
} from "lightweight-charts";
import { resolveTradingViewSymbol, timeframeToSeconds } from "@/lib/chart/symbolMapping";
import { logicalIndexAtTime, timeAtLogicalIndex } from "@/lib/replay/replayClock";
import { DRAWINGS_SYNC_EVENT, loadChartDrawings, saveChartDrawings } from "@/lib/chart/drawingStorage";
import { DrawingsOverlay } from "../backtest-terminal/DrawingsOverlay";
import { LiquidityLevelsOverlay } from "./LiquidityLevelsOverlay";
import type { ChartProjector } from "../backtest-terminal/PositionOverlay";
import type { DrawingToolId } from "../backtest-terminal/toolRailModel";
import type { ReplayDrawing } from "@/lib/replay/types";
import { DEFAULT_TERMINAL_SETTINGS } from "@/lib/replay/terminalPersistence";
import type { CandleBar } from "./LimenProprietaryChart";

export interface LimenCompanionChartPaneProps {
  primarySymbol: string;
  primaryInterval: string;
  primaryHoverTime?: number | null;
  onHoverTimeChange?: (time: number | null) => void;
  className?: string;
  isActive?: boolean;
  onActivate?: () => void;
  activeTool?: DrawingToolId;
  onToolDone?: () => void;
  ticket?: any;
  account?: any;
  settings?: any;
  onTradePlanned?: (plan: any) => void;
}

function getCompanionTf(primaryTf: string): string {
  const norm = primaryTf.trim().toUpperCase();
  if (norm === "1" || norm === "5" || norm === "15") return "60";
  if (norm === "60" || norm === "H1") return "240";
  if (norm === "240" || norm === "H4") return "D";
  return "60";
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

export function LimenCompanionChartPane({
  primarySymbol,
  primaryInterval,
  primaryHoverTime,
  onHoverTimeChange,
  className = "",
  isActive = false,
  onActivate,
  activeTool = "cursor",
  onToolDone,
  ticket,
  account,
  settings,
  onTradePlanned,
}: LimenCompanionChartPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [interval, setInterval] = useState<string>(() => getCompanionTf(primaryInterval));
  const [candles, setCandles] = useState<CandleBar[]>([]);
  const [hoverBar, setHoverBar] = useState<CandleBar | null>(null);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const [revision, setRevision] = useState(0);

  const rawSym = primarySymbol.includes(":") ? primarySymbol.split(":").pop()! : primarySymbol;
  const cleanSym = rawSym.trim().toUpperCase().replace(/[\/\-_]/g, "");

  // Drawing state for secondary companion chart pane + Cross-Pane Mirroring
  const [syncMirrored, setSyncMirrored] = useState<boolean>(true);
  const [drawings, setDrawings] = useState<ReplayDrawing[]>(() =>
    loadChartDrawings(cleanSym, interval),
  );

  const handleUpdateDrawings = useCallback(
    (nextDrawings: ReplayDrawing[] | ((prev: ReplayDrawing[]) => ReplayDrawing[])) => {
      setDrawings((prev) => {
        const resolved = typeof nextDrawings === "function" ? nextDrawings(prev) : nextDrawings;
        saveChartDrawings(cleanSym, interval, resolved);
        return resolved;
      });
      setRevision((r) => r + 1);
    },
    [cleanSym, interval],
  );

  // Cross-Pane Drawing Mirroring listener (sincronizzazione istantanea HTF <-> LTF)
  useEffect(() => {
    if (typeof window === "undefined" || !syncMirrored) return;
    const onDrawingsSync = (event: Event) => {
      const detail = (event as CustomEvent<{ symbol?: string; drawings?: ReplayDrawing[] }>).detail;
      if (!detail || detail.symbol !== cleanSym || !Array.isArray(detail.drawings)) return;
      setDrawings((prev) => (prev === detail.drawings ? prev : detail.drawings!));
      setRevision((r) => r + 1);
    };
    window.addEventListener(DRAWINGS_SYNC_EVENT, onDrawingsSync);
    return () => window.removeEventListener(DRAWINGS_SYNC_EVENT, onDrawingsSync);
  }, [cleanSym, syncMirrored]);

  // Sync companion interval if primary changes drastically
  useEffect(() => {
    const nextTf = getCompanionTf(primaryInterval);
    setInterval(nextTf);
    setDrawings(loadChartDrawings(cleanSym, nextTf));
  }, [primaryInterval, cleanSym]);

  // Init Lightweight Charts
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#07080b" },
        textColor: "#94a3b8",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255, 255, 255, 0.02)" },
        horzLines: { color: "rgba(255, 255, 255, 0.02)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(197, 160, 89, 0.45)",
          width: 1,
          style: 3,
        },
        horzLine: {
          color: "rgba(197, 160, 89, 0.45)",
          width: 1,
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: "rgba(255, 255, 255, 0.1)",
        autoScale: true,
      },
      timeScale: {
        visible: true,
        borderColor: "rgba(255, 255, 255, 0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#C5A059",
      downColor: "#ef4444",
      borderUpColor: "#C5A059",
      borderDownColor: "#ef4444",
      wickUpColor: "#C5A059",
      wickDownColor: "#ef4444",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoverBar(null);
        onHoverTimeChange?.(null);
        return;
      }
      const data = param.seriesData.get(series) as any;
      if (data) {
        const timeNum = typeof param.time === "number" ? param.time : 0;
        setHoverBar({
          time: timeNum,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
        });
        onHoverTimeChange?.(timeNum);
      }
    });

    const handleVisibleRangeChange = () => {
      setRevision((r) => r + 1);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

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

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Load data for companion symbol & interval
  useEffect(() => {
    let cancelled = false;
    const apiTf = normalizeToApiInterval(interval);

    const loadData = async () => {
      try {
        const currentLogicalRange = chartRef.current?.timeScale().getVisibleLogicalRange();
        const currentTimeRange = chartRef.current?.timeScale().getVisibleRange();
        const isNearLive = Boolean(
          currentLogicalRange &&
          candles.length > 0 &&
          currentLogicalRange.to >= candles.length - 6,
        );
        let centerTime: number | null = null;
        if (currentTimeRange && typeof currentTimeRange.from === "number" && typeof currentTimeRange.to === "number") {
          centerTime = Math.floor((currentTimeRange.from + currentTimeRange.to) / 2);
        }

        const res = await fetch(`/api/backtest/candles?symbol=${cleanSym}&interval=${apiTf}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data && Array.isArray(data.candles) && data.candles.length > 0) {
          const bars: CandleBar[] = data.candles.map((c: any) => ({
            time: typeof c.time === "number" ? c.time : Math.floor(new Date(c.time).getTime() / 1000),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }));
          setCandles(bars);
          if (seriesRef.current) {
            seriesRef.current.setData(
              bars.map((b) => ({
                time: b.time as Time,
                open: b.open,
                high: b.high,
                low: b.low,
                close: b.close,
              })),
            );
          }
          const totalBars = bars.length;
          if (!isNearLive && centerTime != null) {
            let closestIdx = -1;
            let minDelta = Infinity;
            for (let i = 0; i < totalBars; i++) {
              const delta = Math.abs(bars[i].time - centerTime);
              if (delta < minDelta) {
                minDelta = delta;
                closestIdx = i;
              }
            }
            if (closestIdx >= 0) {
              chartRef.current?.timeScale().setVisibleLogicalRange({
                from: Math.max(0, closestIdx - 40),
                to: closestIdx + 40,
              });
            } else {
              chartRef.current?.timeScale().setVisibleLogicalRange({
                from: Math.max(0, totalBars - 80),
                to: totalBars + 4,
              });
            }
          } else {
            chartRef.current?.timeScale().setVisibleLogicalRange({
              from: Math.max(0, totalBars - 80),
              to: totalBars + 4,
            });
          }
          setRevision((r) => r + 1);
        }
      } catch {}
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [cleanSym, interval]);

  // Compute ChartProjector for companion pane DrawingsOverlay
  const companionProjector: ChartProjector | null = useMemo(() => {
    const chart = chartRef.current;
    const price = seriesRef.current;
    if (!chart || !price || overlaySize.width === 0 || overlaySize.height === 0 || candles.length === 0) {
      return null;
    }

    return {
      xForTime: (time: number) => {
        const tfSec = timeframeToSeconds(interval);
        const logical = logicalIndexAtTime(candles as any, time, tfSec);
        return logical == null ? null : chart.timeScale().logicalToCoordinate(logical as Logical);
      },
      yForPrice: (val: number) => {
        const coordinate = price.priceToCoordinate(val);
        return coordinate != null ? coordinate : null;
      },
      priceForY: (y: number) => price.coordinateToPrice(y),
      timeForX: (xCoord: number) => {
        const time = chart.timeScale().coordinateToTime(xCoord);
        if (typeof time === "number") return time;
        const logical = chart.timeScale().coordinateToLogical(xCoord);
        const tfSec = timeframeToSeconds(interval);
        return logical == null ? null : timeAtLogicalIndex(candles as any, logical, tfSec);
      },
      width: overlaySize.width,
      height: overlaySize.height,
    };
  }, [overlaySize, revision, candles, interval]);

  // Adapter for companion pane DrawingsOverlay
  const companionEngineAdapter = useMemo(
    () => ({
      drawings,
      setDrawings: handleUpdateDrawings,
      settings: settings ?? DEFAULT_TERMINAL_SETTINGS,
      setSettings: () => {},
      symbol: cleanSym,
      interval,
      intervalSeconds: timeframeToSeconds(interval),
      revealed: candles,
      chartPreferences: {},
      indicators: [],
      setIndicators: () => {},
      ticket: ticket ?? { riskMode: "percent", riskValue: 1, slPips: 25, tpPips: 75 },
      setTicket: () => {},
      account: account ?? { balance: 10000, equity: 10000, realizedProfit: 0 },
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
    [drawings, handleUpdateDrawings, settings, cleanSym, interval, candles, ticket, account, onTradePlanned],
  );

  // Crosshair Sync Polittico: trova la candela HTF corrispondente al timestamp hover del grafico primario
  const syncedPrimaryBar = useMemo(() => {
    if (primaryHoverTime == null || candles.length === 0) return null;
    for (let i = candles.length - 1; i >= 0; i--) {
      if (candles[i].time <= primaryHoverTime) return candles[i];
    }
    return candles[0];
  }, [primaryHoverTime, candles]);

  const syncCrosshairX = useMemo(() => {
    if (!syncedPrimaryBar || hoverBar || !companionProjector) return null;
    return companionProjector.xForTime(syncedPrimaryBar.time);
  }, [syncedPrimaryBar, hoverBar, companionProjector]);

  const activeBar = hoverBar ?? syncedPrimaryBar ?? (candles.length > 0 ? candles[candles.length - 1] : null);

  return (
    <div
      className={`relative flex flex-col h-full w-full border-l border-white/10 bg-[#07080b] transition-all ${
        isActive ? "ring-1 ring-[#C5A059]/60" : "hover:border-white/20"
      } ${className}`}
      onClick={() => onActivate?.()}
    >
      {/* Mini Header Polittico */}
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-white/10 bg-[#0d0f14] text-xs font-mono select-none">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#E8C56A] uppercase tracking-wider text-[11px]">
            {resolveTradingViewSymbol(primarySymbol)}
          </span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
            HTF CONTESTUALE
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSyncMirrored((prev) => {
                const next = !prev;
                if (next) setDrawings(loadChartDrawings(cleanSym, interval));
                return next;
              });
            }}
            className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold transition-all whitespace-nowrap ${
              syncMirrored
                ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-400"
                : "bg-white/5 border border-white/10 text-slate-400"
            }`}
            title="Sincronizza disegni tra grafico primario e grafico HTF secondario"
          >
            {syncMirrored ? "SYNC HTF↔LTF" : "SYNC OFF"}
          </button>
          {isActive ? (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-mono font-bold bg-[#C5A059]/20 border border-[#C5A059] text-[#E8C56A] shadow-[0_0_8px_rgba(197,160,89,0.25)]">
              PANE ATTIVO
            </span>
          ) : (
            <button
              type="button"
              className="text-[9px] px-1.5 py-0.5 rounded font-mono text-slate-400 hover:text-white hover:bg-white/5 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onActivate?.();
              }}
            >
              CLICCA PER ATTIVARE
            </button>
          )}
          {activeBar && (
            <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-slate-400">
              <span>
                C: <strong className={activeBar.close >= activeBar.open ? "text-emerald-400" : "text-rose-400"}>{activeBar.close.toFixed(2)}</strong>
              </span>
            </div>
          )}
        </div>

        {/* Timeframe Chips */}
        <div className="flex items-center gap-1">
          {["15", "60", "240", "D"].map((tf) => (
            <button
              key={tf}
              type="button"
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                interval === tf
                  ? "bg-[#C5A059] text-black font-bold"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setInterval(tf);
                setDrawings(loadChartDrawings(cleanSym, tf));
              }}
            >
              {tf === "60" ? "1H" : tf === "240" ? "4H" : tf === "15" ? "15m" : "1D"}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas e Interactive Drawings Overlay */}
      <div ref={containerRef} className="limen-companion-canvas-container flex-1 w-full h-full relative overflow-hidden">
        {syncCrosshairX != null && syncCrosshairX >= 0 && syncCrosshairX <= overlaySize.width && (
          <div
            className="limen-crosshair-sync-overlay pointer-events-none absolute inset-0 z-20"
            data-testid="companion-crosshair-sync"
          >
            <div
              className="limen-crosshair-sync-line absolute top-0 bottom-0 border-l border-dashed border-[#C5A059]/75"
              style={{ left: `${syncCrosshairX}px` }}
            >
              <span className="limen-crosshair-sync-tag absolute top-2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#07080b]/95 border border-[#C5A059]/60 text-[8px] font-mono font-bold text-[#E8C56A] whitespace-nowrap">
                MIRINO SYNC
              </span>
            </div>
          </div>
        )}
        {companionProjector && (
          <>
            <LiquidityLevelsOverlay
              candles={candles}
              projector={companionProjector}
              symbol={cleanSym}
              revision={revision}
            />
            <DrawingsOverlay
              engine={companionEngineAdapter as any}
              projector={companionProjector}
              revision={revision}
              activeTool={isActive ? activeTool : "cursor"}
              onToolDone={() => onToolDone?.()}
            />
          </>
        )}
      </div>
    </div>
  );
}
