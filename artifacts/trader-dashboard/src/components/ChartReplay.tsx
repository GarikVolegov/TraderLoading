import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type CandlestickData,
  type Time,
  ColorType,
  CrosshairMode,
  type SeriesMarker,
} from "lightweight-charts";
import {
  Play, Pause, SkipForward, SkipBack, RotateCcw,
  TrendingUp, TrendingDown, X, ChevronRight,
  Eye, EyeOff, Calendar, ChevronLeft, MousePointer2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchReplayCandles, type ReplayCandleRaw } from "@/lib/replayCandlesApi";
import {
  applyFormingCandleForAnchor,
  DEFAULT_REPLAY_VISIBLE_CANDLES,
  getReplayIntervalSeconds,
  resolveReplayPointCloseTime,
  resolveReplayStartIndex,
  resolveReplayWindowForCloseAnchor,
} from "./chartReplayWindow";
import { createReplayStorageKey, parsePersistedReplayState, serializeReplayState } from "./chartReplayPersistence";

const START_BALANCE = 10_000;
const LOT_SIZES = ["0.01", "0.05", "0.10", "0.25", "0.50", "1.00"];

function getPipDollarValue(symbol: string, lotSize: number): number {
  const s = symbol.replace("/", "").toUpperCase();
  if (["US30", "NAS100", "SPX500"].includes(s)) return lotSize * 1;
  if (s.includes("BTC") || s.includes("ETH")) return lotSize * 1;
  if (s === "XAUUSD") return lotSize * 10;
  return lotSize * 10;
}

interface ReplayTrade {
  id: number;
  direction: "buy" | "sell";
  entryPrice: number;
  entryIndex: number;
  exitPrice?: number;
  exitIndex?: number;
  stopLoss?: number;
  takeProfit?: number;
  result?: "win" | "loss" | "breakeven";
  pips?: number;
  lotSize?: number;
  dollarPL?: number;
}

interface ChartReplayProps {
  symbol: string;
  interval: string;
  onTradesChange?: (trades: ReplayTrade[]) => void;
  persistenceKey?: string;
}

const SPEEDS = [1, 2, 5, 10];
const START_VISIBLE = DEFAULT_REPLAY_VISIBLE_CANDLES;
const TIMEFRAMES = ["M15", "M30", "H1", "H4", "D1", "W1"];

function getPipMultiplier(symbol: string): number {
  const s = symbol.replace("/", "").toUpperCase();
  if (s.includes("JPY")) return 100;
  if (s === "XAUUSD") return 10;
  if (["US30", "NAS100", "SPX500"].includes(s)) return 1;
  if (s.includes("BTC") || s.includes("ETH")) return 1;
  return 10000;
}

function formatPrice(price: number, symbol: string): string {
  const s = symbol.replace("/", "").toUpperCase();
  if (s.includes("JPY")) return price.toFixed(3);
  if (["US30", "NAS100", "SPX500"].includes(s)) return price.toFixed(1);
  if (s.includes("BTC")) return price.toFixed(1);
  if (s.includes("ETH")) return price.toFixed(2);
  return price.toFixed(5);
}

export default function ChartReplay({ symbol, interval: initialInterval, onTradesChange, persistenceKey }: ChartReplayProps) {
  const storageKey = useMemo(() => persistenceKey ? createReplayStorageKey(persistenceKey) : null, [persistenceKey]);
  const restoredState = useMemo(() => {
    if (!storageKey || typeof window === "undefined") return null;
    return parsePersistedReplayState(window.localStorage.getItem(storageKey), symbol);
  }, [storageKey, symbol]);
  const restoredTradeId = useMemo(() => {
    const ids = [
      ...(restoredState?.trades.map((trade) => trade.id) ?? []),
      ...(restoredState?.openTrade ? [restoredState.openTrade.id] : []),
    ];
    return ids.length > 0 ? Math.max(...ids) : 0;
  }, [restoredState]);
  const restoredWindowAppliedRef = useRef(false);
  const restoredTradesNotifiedRef = useRef(false);
  const timeframeAnchorRef = useRef<{ closeTime: number; price: number } | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const slLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const tpLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const volSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [activeInterval, setActiveInterval] = useState(restoredState?.activeInterval ?? initialInterval);
  const [allCandles, setAllCandles] = useState<CandlestickData<Time>[]>([]);
  const [allVolumes, setAllVolumes] = useState<{ time: Time; value: number; color: string }[]>([]);
  const [startIndex, setStartIndex] = useState(restoredState?.startIndex ?? 0);
  const [revealedCount, setRevealedCount] = useState(restoredState?.revealedCount ?? START_VISIBLE);
  const [replayPointCloseTime, setReplayPointCloseTime] = useState<number | null>(null);
  const prevRevealedRef = useRef(restoredState?.revealedCount ?? START_VISIBLE);

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(restoredState?.startDate ?? "");
  const [trades, setTrades] = useState<ReplayTrade[]>(restoredState?.trades ?? []);
  const [openTrade, setOpenTrade] = useState<ReplayTrade | null>(restoredState?.openTrade ?? null);
  const openTradeRef = useRef<ReplayTrade | null>(null);
  const [lotSize, setLotSize] = useState(restoredState?.lotSize ?? "0.01");
  const [balance, setBalance] = useState(restoredState?.balance ?? START_BALANCE);

  const [settingSL, setSettingSL] = useState(false);
  const [settingTP, setSettingTP] = useState(false);
  const [slInput, setSLInput] = useState("");
  const [tpInput, setTPInput] = useState("");
  const [showTradePanel, setShowTradePanel] = useState(false);
  const [showTrades, setShowTrades] = useState(true);

  const tradeIdCounter = useRef(restoredTradeId);
  const playingRef = useRef(false);
  const speedRef = useRef(speed);
  const revealedRef = useRef(revealedCount);
  const replayPointCloseTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { revealedRef.current = revealedCount; }, [revealedCount]);
  useEffect(() => { replayPointCloseTimeRef.current = replayPointCloseTime; }, [replayPointCloseTime]);
  useEffect(() => { openTradeRef.current = openTrade; }, [openTrade]);
  useEffect(() => {
    if (restoredTradesNotifiedRef.current) return;
    if (!restoredState?.trades.length) return;
    restoredTradesNotifiedRef.current = true;
    onTradesChange?.(restoredState.trades);
  }, [onTradesChange, restoredState]);

  const pipMultiplier = useMemo(() => getPipMultiplier(symbol), [symbol]);

  useEffect(() => {
    const s = symbol.replace("/", "");
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setIsPlaying(false);
    playingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);

    fetchReplayCandles({ symbol: s, interval: activeInterval, startDate: startDate || undefined }, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        const candles: CandlestickData<Time>[] = data.candles.map((c) => ({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        const volumes = data.candles
          .filter((c: ReplayCandleRaw) => c.volume != null)
          .map((c: ReplayCandleRaw) => ({
            time: c.time as Time,
            value: c.volume!,
            color: c.close >= c.open ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)",
          }));
        const anchor = timeframeAnchorRef.current;
        const canAnchorTimeframe = anchor != null;
        const nextCandles = anchor
          ? applyFormingCandleForAnchor(candles, anchor.closeTime, activeInterval, anchor.price)
          : candles;
        setAllVolumes(volumes);
        setAllCandles(nextCandles);

        const canRestoreWindow = Boolean(
          restoredState &&
          !restoredWindowAppliedRef.current &&
          restoredState.activeInterval === activeInterval,
        );
        const preferredVisibleCount = Math.max(START_VISIBLE, revealedRef.current);
        const anchoredWindow = anchor
          ? resolveReplayWindowForCloseAnchor(nextCandles, anchor.closeTime, activeInterval, preferredVisibleCount)
          : null;
        const initialRevealed = anchoredWindow?.revealedCount ?? Math.min(
          canRestoreWindow ? Math.max(START_VISIBLE, restoredState!.revealedCount) : START_VISIBLE,
          nextCandles.length,
        );
        const initialStart = anchoredWindow?.startIndex ?? (canRestoreWindow
          ? Math.min(restoredState!.startIndex, Math.max(0, nextCandles.length - initialRevealed))
          : resolveReplayStartIndex(nextCandles, startDate, START_VISIBLE));
        if (canRestoreWindow) restoredWindowAppliedRef.current = true;
        if (canAnchorTimeframe) timeframeAnchorRef.current = null;

        setStartIndex(initialStart);
        setRevealedCount(initialRevealed);
        const initialPointCandle = nextCandles.slice(initialStart, initialStart + initialRevealed).at(-1);
        setReplayPointCloseTime(anchor?.closeTime ?? resolveReplayPointCloseTime(initialPointCandle, activeInterval));
        prevRevealedRef.current = initialRevealed;
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Errore caricamento dati");
        setLoading(false);
      });

    return () => controller.abort();
  }, [symbol, activeInterval, startDate, restoredState]);

  useEffect(() => {
    if (!storageKey || loading) return;
    try {
      window.localStorage.setItem(storageKey, serializeReplayState({
        symbol,
        activeInterval,
        startDate,
        revealedCount,
        startIndex,
        balance,
        lotSize,
        trades,
        openTrade,
      }));
    } catch {
      // Storage can fail in private mode or under quota; in-memory replay remains usable.
    }
  }, [storageKey, loading, symbol, activeInterval, startDate, revealedCount, startIndex, balance, lotSize, trades, openTrade]);

  const replayCandles = useMemo(() => allCandles.slice(startIndex), [allCandles, startIndex]);
  const visibleCandles = useMemo(() => replayCandles.slice(0, revealedCount), [replayCandles, revealedCount]);

  const currentPrice = useMemo(() => {
    if (visibleCandles.length === 0) return 0;
    return visibleCandles[visibleCandles.length - 1].close;
  }, [visibleCandles]);

  const currentDate = useMemo(() => {
    if (visibleCandles.length === 0) return "";
    const fallbackTs = resolveReplayPointCloseTime(visibleCandles[visibleCandles.length - 1], activeInterval);
    const ts = replayPointCloseTime ?? fallbackTs;
    if (ts == null) return "";
    return new Date(ts * 1000).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [activeInterval, replayPointCloseTime, visibleCandles]);

  const dataRange = useMemo(() => {
    if (allCandles.length === 0) return { min: "", max: "" };
    const minTs = allCandles[0].time as number;
    const maxTs = allCandles[allCandles.length - 1].time as number;
    const fmt = (ts: number) => new Date(ts * 1000).toISOString().split("T")[0];
    return { min: fmt(minTs), max: fmt(maxTs) };
  }, [allCandles]);

  useEffect(() => {
    if (!chartContainerRef.current || loading) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(16,185,129,0.3)", labelBackgroundColor: "#10b981" },
        horzLine: { color: "rgba(16,185,129,0.3)", labelBackgroundColor: "#10b981" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.1)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.1)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderUpColor: "#10b981",
      borderDownColor: "#ef4444",
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    const seriesMarkers = createSeriesMarkers(candleSeries);

    const slLine = chart.addSeries(LineSeries, {
      color: "#ef4444",
      lineWidth: 1,
      lineStyle: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const tpLine = chart.addSeries(LineSeries, {
      color: "#10b981",
      lineWidth: 1,
      lineStyle: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const volSeries = chart.addSeries(HistogramSeries, {
      color: "rgba(120,120,120,0.3)",
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    slLineRef.current = slLine;
    tpLineRef.current = tpLine;
    markersRef.current = seriesMarkers;
    volSeriesRef.current = volSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      slLineRef.current = null;
      tpLineRef.current = null;
      markersRef.current = null;
      volSeriesRef.current = null;
    };
  }, [loading]);

  useEffect(() => {
    if (!candleSeriesRef.current || visibleCandles.length === 0) return;
    candleSeriesRef.current.setData(visibleCandles);

    const markers: SeriesMarker<Time>[] = [];
    const allTrades = [...trades, ...(openTrade ? [openTrade] : [])];

    if (showTrades) {
      allTrades.forEach((t) => {
        if (t.entryIndex < visibleCandles.length) {
          markers.push({
            time: visibleCandles[t.entryIndex].time,
            position: t.direction === "buy" ? "belowBar" : "aboveBar",
            color: t.direction === "buy" ? "#10b981" : "#ef4444",
            shape: t.direction === "buy" ? "arrowUp" : "arrowDown",
            text: `${t.direction.toUpperCase()} @ ${formatPrice(t.entryPrice, symbol)}`,
          });
        }
        if (t.exitIndex != null && t.exitIndex < visibleCandles.length) {
          markers.push({
            time: visibleCandles[t.exitIndex].time,
            position: "aboveBar",
            color: t.result === "win" ? "#10b981" : t.result === "loss" ? "#ef4444" : "#eab308",
            shape: "circle",
            text: `EXIT @ ${t.exitPrice != null ? formatPrice(t.exitPrice, symbol) : ""}`,
          });
        }
      });
    }

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    markersRef.current?.setMarkers(markers);

    if (openTrade && slLineRef.current && tpLineRef.current) {
      const first = visibleCandles[0];
      const last = visibleCandles[visibleCandles.length - 1];

      if (openTrade.stopLoss != null) {
        slLineRef.current.setData([
          { time: first.time, value: openTrade.stopLoss },
          { time: last.time, value: openTrade.stopLoss },
        ]);
      } else {
        slLineRef.current.setData([]);
      }

      if (openTrade.takeProfit != null) {
        tpLineRef.current.setData([
          { time: first.time, value: openTrade.takeProfit },
          { time: last.time, value: openTrade.takeProfit },
        ]);
      } else {
        tpLineRef.current.setData([]);
      }
    } else {
      slLineRef.current?.setData([]);
      tpLineRef.current?.setData([]);
    }

    chartRef.current?.timeScale().scrollToPosition(2, false);

    if (volSeriesRef.current && allVolumes.length > 0) {
      const replayVolumes = allVolumes.slice(startIndex, startIndex + revealedCount);
      volSeriesRef.current.setData(replayVolumes);
    }
    chartRef.current?.timeScale().fitContent();
  }, [visibleCandles, trades, openTrade, showTrades, symbol, allVolumes, startIndex, revealedCount]);

  useEffect(() => {
    const trade = openTradeRef.current;
    const prev = prevRevealedRef.current;
    prevRevealedRef.current = revealedCount;

    if (!trade || prev >= revealedCount) return;

    for (let i = prev; i < revealedCount; i++) {
      const candle = replayCandles[i];
      if (!candle) continue;

      if (trade.stopLoss != null) {
        const hitSL = trade.direction === "buy"
          ? candle.low <= trade.stopLoss
          : candle.high >= trade.stopLoss;
        if (hitSL) {
          const diff = trade.direction === "buy"
            ? trade.stopLoss - trade.entryPrice
            : trade.entryPrice - trade.stopLoss;
          const pips = parseFloat((diff * pipMultiplier).toFixed(1));
          const ls = trade.lotSize ?? 0.01;
          const dollarPL = parseFloat((pips * getPipDollarValue(symbol, ls)).toFixed(2));
          const closedTrade = { ...trade, exitPrice: trade.stopLoss, exitIndex: i, pips, result: "loss" as const, dollarPL };
          setOpenTrade(null);
          setSLInput("");
          setTPInput("");
          setBalance((prev) => parseFloat((prev + dollarPL).toFixed(2)));
          setTrades((old) => {
            const updated = [...old, closedTrade];
            onTradesChange?.(updated);
            return updated;
          });
          setIsPlaying(false);
          playingRef.current = false;
          return;
        }
      }

      if (trade.takeProfit != null) {
        const hitTP = trade.direction === "buy"
          ? candle.high >= trade.takeProfit
          : candle.low <= trade.takeProfit;
        if (hitTP) {
          const diff = trade.direction === "buy"
            ? trade.takeProfit - trade.entryPrice
            : trade.entryPrice - trade.takeProfit;
          const pips = parseFloat((diff * pipMultiplier).toFixed(1));
          const ls = trade.lotSize ?? 0.01;
          const dollarPL = parseFloat((pips * getPipDollarValue(symbol, ls)).toFixed(2));
          const closedTrade = { ...trade, exitPrice: trade.takeProfit, exitIndex: i, pips, result: "win" as const, dollarPL };
          setOpenTrade(null);
          setSLInput("");
          setTPInput("");
          setBalance((prev) => parseFloat((prev + dollarPL).toFixed(2)));
          setTrades((old) => {
            const updated = [...old, closedTrade];
            onTradesChange?.(updated);
            return updated;
          });
          setIsPlaying(false);
          playingRef.current = false;
          return;
        }
      }
    }
  }, [revealedCount, replayCandles, pipMultiplier, onTradesChange, symbol]);

  const advanceCandle = useCallback((count = 1) => {
    setRevealedCount((prev) => {
      const next = Math.min(prev + count, replayCandles.length);
      setReplayPointCloseTime(resolveReplayPointCloseTime(replayCandles[next - 1], activeInterval));
      return next;
    });
  }, [activeInterval, replayCandles]);

  const goBack = useCallback((count = 1) => {
    setIsPlaying(false);
    playingRef.current = false;
    setRevealedCount((prev) => {
      const next = Math.max(START_VISIBLE, prev - count);
      prevRevealedRef.current = next;
      setReplayPointCloseTime(resolveReplayPointCloseTime(replayCandles[next - 1], activeInterval));
      return next;
    });
  }, [activeInterval, replayCandles]);

  const closeTrade = useCallback((exitPrice: number, exitIndex: number) => {
    const trade = openTradeRef.current;
    if (!trade) return;
    const diff = trade.direction === "buy"
      ? exitPrice - trade.entryPrice
      : trade.entryPrice - exitPrice;
    const pips = parseFloat((diff * pipMultiplier).toFixed(1));
    const result: "win" | "loss" | "breakeven" = pips > 0 ? "win" : pips < 0 ? "loss" : "breakeven";
    const ls = trade.lotSize ?? 0.01;
    const dollarPL = parseFloat((pips * getPipDollarValue(symbol, ls)).toFixed(2));
    const closedTrade = { ...trade, exitPrice, exitIndex, pips, result, dollarPL };
    setOpenTrade(null);
    setSLInput("");
    setTPInput("");
    setBalance((prev) => parseFloat((prev + dollarPL).toFixed(2)));
    setTrades((old) => {
      const updated = [...old, closedTrade];
      onTradesChange?.(updated);
      return updated;
    });
  }, [pipMultiplier, onTradesChange, symbol]);

  useEffect(() => {
    if (!isPlaying) return;
    playingRef.current = true;

    const tick = () => {
      if (!playingRef.current) return;
      if (revealedRef.current >= replayCandles.length) {
        setIsPlaying(false);
        return;
      }
      advanceCandle(1);
      const delay = Math.max(50, 500 / speedRef.current);
      timerRef.current = setTimeout(tick, delay);
    };
    tick();

    return () => {
      playingRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, advanceCandle, replayCandles.length]);

  const handleBuy = () => {
    if (openTrade) return;
    setIsPlaying(false);
    playingRef.current = false;
    const trade: ReplayTrade = {
      id: ++tradeIdCounter.current,
      direction: "buy",
      entryPrice: currentPrice,
      entryIndex: revealedCount - 1,
      lotSize: parseFloat(lotSize) || 0.01,
    };
    setOpenTrade(trade);
    setSLInput("");
    setTPInput("");
    setShowTradePanel(true);
  };

  const handleSell = () => {
    if (openTrade) return;
    setIsPlaying(false);
    playingRef.current = false;
    const trade: ReplayTrade = {
      id: ++tradeIdCounter.current,
      direction: "sell",
      entryPrice: currentPrice,
      entryIndex: revealedCount - 1,
      lotSize: parseFloat(lotSize) || 0.01,
    };
    setOpenTrade(trade);
    setSLInput("");
    setTPInput("");
    setShowTradePanel(true);
  };

  const handleCloseTrade = () => {
    if (!openTrade) return;
    closeTrade(currentPrice, revealedCount - 1);
    setShowTradePanel(false);
  };

  const handleSetSL = () => {
    setSettingSL(true);
    setSettingTP(false);
  };

  const handleSetTP = () => {
    setSettingTP(true);
    setSettingSL(false);
  };

  const handleSLInputChange = (val: string) => {
    setSLInput(val);
    const price = parseFloat(val);
    if (!isNaN(price) && price > 0) {
      setOpenTrade((prev) => prev ? { ...prev, stopLoss: price } : null);
    }
  };

  const handleTPInputChange = (val: string) => {
    setTPInput(val);
    const price = parseFloat(val);
    if (!isNaN(price) && price > 0) {
      setOpenTrade((prev) => prev ? { ...prev, takeProfit: price } : null);
    }
  };

  useEffect(() => {
    if (!chartRef.current || (!settingSL && !settingTP)) return;
    const chart = chartRef.current;

    const handler = (param: { point?: { x: number; y: number } }) => {
      if (!param.point || !candleSeriesRef.current) return;
      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      if (price == null) return;

      setOpenTrade((prev) => {
        if (!prev) return null;
        if (settingSL) {
          setSLInput((price as number).toFixed(5));
          return { ...prev, stopLoss: price as number };
        }
        if (settingTP) {
          setTPInput((price as number).toFixed(5));
          return { ...prev, takeProfit: price as number };
        }
        return prev;
      });
      setSettingSL(false);
      setSettingTP(false);
    };

    chart.subscribeClick(handler);
    return () => chart.unsubscribeClick(handler);
  }, [settingSL, settingTP]);

  const handleReset = () => {
    setIsPlaying(false);
    playingRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
    setRevealedCount(START_VISIBLE);
    setReplayPointCloseTime(resolveReplayPointCloseTime(replayCandles[START_VISIBLE - 1], activeInterval));
    prevRevealedRef.current = START_VISIBLE;
    setTrades([]);
    setOpenTrade(null);
    setSLInput("");
    setTPInput("");
    setBalance(START_BALANCE);
    setShowTradePanel(false);
    if (storageKey) window.localStorage.removeItem(storageKey);
    onTradesChange?.([]);
  };

  const handleChangeInterval = (tf: string) => {
    if (tf === activeInterval) return;
    setIsPlaying(false);
    playingRef.current = false;
    const anchorCandle = visibleCandles[visibleCandles.length - 1];
    const anchorCloseTime = replayPointCloseTimeRef.current ?? resolveReplayPointCloseTime(anchorCandle, activeInterval);
    timeframeAnchorRef.current = anchorCandle
      ? {
          closeTime: anchorCloseTime ?? (anchorCandle.time as number) + getReplayIntervalSeconds(activeInterval),
          price: currentPrice,
        }
      : null;
    setActiveInterval(tf);
  };

  const handleApplyDate = (date: string) => {
    setStartDate(date);
    setReplayPointCloseTime(null);
    setTrades([]);
    setOpenTrade(null);
    setSLInput("");
    setTPInput("");
    onTradesChange?.([]);
  };

  const stats = useMemo(() => {
    if (trades.length === 0) return null;
    const wins = trades.filter((t) => t.result === "win").length;
    const losses = trades.filter((t) => t.result === "loss").length;
    const totalPips = trades.reduce((s, t) => s + (t.pips ?? 0), 0);
    const totalDollar = trades.reduce((s, t) => s + (t.dollarPL ?? 0), 0);
    const winRate = Math.round((wins / trades.length) * 100);
    return { total: trades.length, wins, losses, totalPips: totalPips.toFixed(1), totalDollar: totalDollar.toFixed(2), winRate };
  }, [trades]);

  const openPnL = useMemo(() => {
    if (!openTrade) return null;
    const diff = openTrade.direction === "buy"
      ? currentPrice - openTrade.entryPrice
      : openTrade.entryPrice - currentPrice;
    return parseFloat((diff * pipMultiplier).toFixed(1));
  }, [openTrade, currentPrice, pipMultiplier]);

  const progress = replayCandles.length > 0 ? Math.round((revealedCount / replayCandles.length) * 100) : 0;

  return (
    <div data-testid="chart-replay" className="space-y-3 min-w-0 overflow-hidden">
      <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 overflow-hidden">
        <div className="flex flex-col gap-1.5 px-3 py-2 border-b border-border/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-xs font-mono font-bold text-primary">{symbol}</span>
              <span className="text-[10px] text-muted-foreground">{activeInterval}</span>
              {!loading && (
                <span className="text-[10px] text-muted-foreground/60">
                  {revealedCount}/{replayCandles.length} candele
                </span>
              )}
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2">
              {!loading && <span className="text-[10px] text-muted-foreground">{currentDate}</span>}
              {!loading && (
                <span className="text-xs font-mono font-bold">{formatPrice(currentPrice, symbol)}</span>
              )}
              <span
                className="hidden sm:inline-flex p-1 rounded text-primary"
                title="Data di inizio backtest"
              >
                <Calendar className="w-3.5 h-3.5" />
              </span>
              <button
                onClick={() => setShowTrades(!showTrades)}
                className="p-1 rounded hover:bg-white/5"
                title={showTrades ? "Nascondi trade" : "Mostra trade"}
              >
                {showTrades
                  ? <Eye className="w-3.5 h-3.5 text-primary" />
                  : <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => handleChangeInterval(tf)}
                className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold transition-all ${
                  activeInterval === tf
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 py-2 border-b border-border/30 flex flex-col min-[420px]:flex-row min-[420px]:items-center gap-2 bg-card/40">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs text-muted-foreground shrink-0">Inizia dal</span>
            <input
              aria-label="Data di inizio backtest"
              type="date"
              value={startDate}
              max={dataRange.max}
              onChange={(e) => handleApplyDate(e.target.value)}
              className="flex-1 h-8 px-2 rounded-md border border-border bg-background text-xs font-mono"
            />
            {startDate && (
              <button
                onClick={() => handleApplyDate("")}
                className="text-xs text-orange-400 hover:text-orange-300 shrink-0"
              >
                Reset
              </button>
            )}
            {!loading && (
              <span className="text-[10px] text-muted-foreground/70 min-[420px]:ml-auto">
                Avvio con {visibleCandles.length} candele visibili
              </span>
            )}
          </div>

        {(settingSL || settingTP) && (
          <div className={`px-3 py-1.5 border-b border-border/30 text-xs font-medium flex items-center gap-2 ${
            settingSL ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
          }`}>
            <MousePointer2 className="w-3.5 h-3.5 shrink-0" />
            {settingSL ? "Clicca sul grafico per impostare Stop Loss" : "Clicca sul grafico per impostare Take Profit"}
            <button onClick={() => { setSettingSL(false); setSettingTP(false); }} className="ml-auto opacity-60 hover:opacity-100">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="relative min-h-[320px] sm:min-h-[420px] lg:min-h-[560px]" style={{ height: "clamp(320px, 58vh, 780px)" }}>
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Caricamento {symbol} {activeInterval}...</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <p className="text-red-400 text-sm mb-2">Errore: {error}</p>
              <p className="text-xs text-muted-foreground">Verifica che il simbolo sia supportato.</p>
            </div>
          )}
          {!loading && !error && allCandles.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <p className="text-muted-foreground text-sm mb-1">Nessuna candela disponibile</p>
              <p className="text-xs text-muted-foreground/60">
                Prova un timeframe diverso o un altro simbolo.
              </p>
            </div>
          )}
          <div
            ref={chartContainerRef}
            className={`w-full h-full ${settingSL || settingTP ? "cursor-crosshair" : ""}`}
            style={{ visibility: loading || error ? "hidden" : "visible" }}
          />
        </div>

        {!loading && !error && (
          <div className="px-3 py-2 border-t border-border/30 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                <div
                  className="h-full bg-primary/60 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">{progress}%</span>
            </div>

            <div className="flex items-center justify-center gap-1 flex-wrap">
              <Button
                variant="ghost" size="sm"
                className="h-9 w-9 p-0"
                onClick={() => goBack(10)}
                disabled={revealedCount <= START_VISIBLE}
                title="Indietro 10 candele"
              >
                <SkipBack className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost" size="sm"
                className="h-9 w-9 p-0"
                onClick={() => goBack(1)}
                disabled={revealedCount <= START_VISIBLE}
                title="Indietro 1 candela"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <Button
                variant={isPlaying ? "default" : "ghost"} size="sm"
                className={`h-9 w-12 p-0 ${isPlaying ? "bg-primary text-primary-foreground" : ""}`}
                onClick={() => setIsPlaying(!isPlaying)}
                disabled={revealedCount >= replayCandles.length}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>

              <Button
                variant="ghost" size="sm"
                className="h-9 w-9 p-0"
                onClick={() => advanceCandle(1)}
                disabled={isPlaying || revealedCount >= replayCandles.length}
                title="Avanti 1 candela"
              >
                <SkipForward className="w-4 h-4" />
              </Button>

              <Button
                variant="ghost" size="sm"
                className="h-9 w-9 p-0"
                onClick={() => advanceCandle(10)}
                disabled={isPlaying || revealedCount >= replayCandles.length}
                title="Avanti 10 candele"
              >
                <ChevronRight className="w-4 h-4" />
                <ChevronRight className="w-4 h-4 -ml-3" />
              </Button>

              <div className="w-px h-5 bg-border/40 mx-1 hidden sm:block" />

              <div className="flex items-center gap-0.5">
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    className={`min-w-[32px] h-8 rounded text-[11px] font-bold transition-all ${
                      speed === s
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "text-muted-foreground hover:text-foreground border border-transparent"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <Button
                variant="ghost" size="sm"
                className="h-9 w-9 p-0 text-orange-400"
                onClick={handleReset}
                title="Reset"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {!loading && !error && (
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-[11px] text-muted-foreground">Saldo virtuale:</span>
              <span className={`text-sm font-mono font-bold ${balance >= START_BALANCE ? "text-green-400" : "text-red-400"}`}>
                ${balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {balance !== START_BALANCE && (
                <span className={`text-[10px] font-mono ${balance >= START_BALANCE ? "text-green-400/70" : "text-red-400/70"}`}>
                  ({balance >= START_BALANCE ? "+" : ""}${(balance - START_BALANCE).toFixed(2)})
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-muted-foreground mr-1">Lotti:</span>
              {LOT_SIZES.map((ls) => (
                <button
                  key={ls}
                  onClick={() => setLotSize(ls)}
                  className={`px-1.5 py-1 rounded text-[10px] font-bold transition-all ${
                    lotSize === ls
                      ? "bg-primary/20 text-primary border border-primary/40"
                      : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50"
                  }`}
                >
                  {ls}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleBuy}
              disabled={!!openTrade}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold h-12 text-base"
            >
              <TrendingUp className="w-5 h-5 mr-2" />
              BUY
            </Button>
            <Button
              onClick={handleSell}
              disabled={!!openTrade}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold h-12 text-base"
            >
              <TrendingDown className="w-5 h-5 mr-2" />
              SELL
            </Button>
          </div>
        </div>
      )}

      {openTrade && (
        <div className="rounded-2xl bg-card/60 backdrop-blur-sm border border-primary/30 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg text-sm font-bold ${
                openTrade.direction === "buy" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
              }`}>
                {openTrade.direction.toUpperCase()}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                Entry: {formatPrice(openTrade.entryPrice, symbol)}
              </span>
            </div>
            <div className="text-right">
              <div className={`text-base font-mono font-bold leading-tight ${
                (openPnL ?? 0) >= 0 ? "text-green-400" : "text-red-400"
              }`}>
                {(openPnL ?? 0) >= 0 ? "+" : ""}{openPnL?.toFixed(1)} pip
              </div>
              <div className={`text-[11px] font-mono ${
                (openPnL ?? 0) >= 0 ? "text-green-400/70" : "text-red-400/70"
              }`}>
                {(() => {
                  const ls = openTrade.lotSize ?? 0.01;
                  const dollarVal = (openPnL ?? 0) * getPipDollarValue(symbol, ls);
                  return `${dollarVal >= 0 ? "+" : ""}$${dollarVal.toFixed(2)}`;
                })()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-red-400 uppercase tracking-wider font-medium">Stop Loss</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  step="any"
                  value={slInput}
                  onChange={(e) => handleSLInputChange(e.target.value)}
                  placeholder={formatPrice(currentPrice, symbol)}
                  className="h-8 text-xs font-mono border-red-500/30 focus:border-red-500/60"
                />
                <button
                  onClick={handleSetSL}
                  className={`px-2 rounded border text-[10px] shrink-0 transition-all ${
                    settingSL
                      ? "border-red-500 bg-red-500/20 text-red-400"
                      : "border-red-500/30 text-red-400/60 hover:border-red-500/60"
                  }`}
                  title="Clicca sul grafico"
                >
                  <MousePointer2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-green-400 uppercase tracking-wider font-medium">Take Profit</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  step="any"
                  value={tpInput}
                  onChange={(e) => handleTPInputChange(e.target.value)}
                  placeholder={formatPrice(currentPrice, symbol)}
                  className="h-8 text-xs font-mono border-green-500/30 focus:border-green-500/60"
                />
                <button
                  onClick={handleSetTP}
                  className={`px-2 rounded border text-[10px] shrink-0 transition-all ${
                    settingTP
                      ? "border-green-500 bg-green-500/20 text-green-400"
                      : "border-green-500/30 text-green-400/60 hover:border-green-500/60"
                  }`}
                  title="Clicca sul grafico"
                >
                  <MousePointer2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {openTrade.stopLoss && openTrade.takeProfit && (
            <div className="text-[10px] text-muted-foreground/60 font-mono text-center">
              {(() => {
                const risk = Math.abs(openTrade.entryPrice - openTrade.stopLoss) * pipMultiplier;
                const reward = Math.abs(openTrade.entryPrice - openTrade.takeProfit) * pipMultiplier;
                const rr = risk > 0 ? (reward / risk).toFixed(2) : "—";
                return `Risk: ${risk.toFixed(1)} pip · Reward: ${reward.toFixed(1)} pip · R:R ${rr}`;
              })()}
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
            onClick={handleCloseTrade}
          >
            <X className="w-3.5 h-3.5 mr-2" />
            Chiudi al prezzo corrente · {formatPrice(currentPrice, symbol)}
          </Button>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-xl bg-card/40 border border-border/30 p-2 text-center">
            <div className="text-[10px] text-muted-foreground">Trade</div>
            <div className="text-sm font-bold font-mono">{stats.total}</div>
          </div>
          <div className="rounded-xl bg-card/40 border border-border/30 p-2 text-center">
            <div className="text-[10px] text-muted-foreground">Win Rate</div>
            <div className={`text-sm font-bold font-mono ${stats.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
              {stats.winRate}%
            </div>
          </div>
          <div className="rounded-xl bg-card/40 border border-border/30 p-2 text-center">
            <div className="text-[10px] text-muted-foreground">Pips</div>
            <div className={`text-sm font-bold font-mono ${parseFloat(stats.totalPips) >= 0 ? "text-green-400" : "text-red-400"}`}>
              {parseFloat(stats.totalPips) >= 0 ? "+" : ""}{stats.totalPips}
            </div>
          </div>
          <div className="rounded-xl bg-card/40 border border-border/30 p-2 text-center">
            <div className="text-[10px] text-muted-foreground">P&L $</div>
            <div className={`text-sm font-bold font-mono ${parseFloat(stats.totalDollar) >= 0 ? "text-green-400" : "text-red-400"}`}>
              {parseFloat(stats.totalDollar) >= 0 ? "+" : ""}${stats.totalDollar}
            </div>
          </div>
        </div>
      )}

      {trades.length > 0 && (
        <div className="rounded-2xl bg-card/40 border border-border/30 overflow-hidden">
          <button
            onClick={() => setShowTradePanel(!showTradePanel)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:bg-white/5 transition-colors"
          >
            <span>Storico trade ({trades.length})</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showTradePanel ? "rotate-90" : ""}`} />
          </button>
          {showTradePanel && (
            <div className="max-h-48 overflow-y-auto divide-y divide-border/20 border-t border-border/20">
              {trades.map((t) => (
                <div key={t.id} className="group/trade flex flex-col min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between text-xs px-4 py-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`shrink-0 font-bold ${t.direction === "buy" ? "text-green-400" : "text-red-400"}`}>
                      {t.direction.toUpperCase()}
                    </span>
                    <span className="font-mono text-muted-foreground text-[10px] truncate">
                      {formatPrice(t.entryPrice, symbol)} → {t.exitPrice != null ? formatPrice(t.exitPrice, symbol) : "—"}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-bold font-mono text-[11px] ${
                      t.result === "win" ? "text-green-400" : t.result === "loss" ? "text-red-400" : "text-yellow-400"
                    }`}>
                      {(t.pips ?? 0) >= 0 ? "+" : ""}{t.pips?.toFixed(1)} pip
                    </div>
                    {t.dollarPL != null && (
                      <div className={`font-mono text-[10px] ${
                        t.dollarPL >= 0 ? "text-green-400/70" : "text-red-400/70"
                      }`}>
                        {t.dollarPL >= 0 ? "+" : ""}${t.dollarPL.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
