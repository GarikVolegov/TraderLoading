// ─── Replay engine hook ──────────────────────────────────────────────────────
// The terminal's single stateful orchestrator: candle window, replay cursor,
// play loop, timeframe switching (close-time anchored, like ChartReplay), the
// simulated account (open/close/SL/TP via lib/replay/tradeEngine) and the
// persisted terminal state. UI components consume the returned API only.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getReplayIntervalSeconds } from "../chartReplayWindow";
import { simulateReplayExecution } from "@/lib/replay/replayExecution";
import { cursorAtReplayTime, revealAtReplayTime } from "@/lib/replay/replayClock";
import { iterateReplayExecutionCandles } from "@/lib/replayCandlesApi";
import { getPipMultiplier } from "@/lib/pipMultiplier";
import { buildAccountState } from "@/lib/replay/accountTracker";
import { defaultIndicators, type IndicatorConfig } from "@/lib/replay/indicatorCatalog";
import { computeJournalStats } from "@/lib/replay/journalStats";
import { computeLots, riskAmountFor, riskRewardRatio } from "@/lib/replay/lotSizing";
import {
  clampCursor,
  cursorFraction,
  cursorFromFraction,
  MIN_REVEALED_BARS,
  stepCursor,
} from "@/lib/replay/replayCursor";
import {
  closePosition,
  openPosition,
  positionPips,
  unrealizedProfit,
} from "@/lib/replay/tradeEngine";
import {
  createTerminalStorageKey,
  DEFAULT_TERMINAL_SETTINGS,
  DEFAULT_TICKET,
  parseTerminalState,
  serializeTerminalState,
  type TerminalSettings,
  type TerminalTicket,
} from "@/lib/replay/terminalPersistence";
import type {
  ClosedTrade,
  OpenPosition,
  PendingOrder,
  ReplayDrawing,
  TradeDirection,
} from "@/lib/replay/types";
import { useCandleWindow } from "./useCandleWindow";

export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
export const REPLAY_TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1"] as const;
const INITIAL_BALANCE = 10_000;
const BASE_TICK_MS = 720;

export interface ReplayEngineInput {
  sessionKey: string;
  symbol: string;
  initialInterval: string;
}

export function useReplayEngine({ sessionKey, symbol, initialInterval }: ReplayEngineInput) {
  const storageKey = useMemo(() => createTerminalStorageKey(sessionKey), [sessionKey]);
  const restored = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return parseTerminalState(window.localStorage.getItem(storageKey), symbol.replace("/", ""));
    } catch {
      return null;
    }
  }, [storageKey, symbol]);

  const normalizedSymbol = symbol.replace("/", "");
  const defaultInterval = REPLAY_TIMEFRAMES.includes(initialInterval as (typeof REPLAY_TIMEFRAMES)[number])
    ? initialInterval
    : "H1";

  const [interval, setIntervalState] = useState<string>(restored?.interval ?? defaultInterval);
  const requestedStart = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      const id = sessionKey.replace(/^backtest-session-/, "");
      const key = `traderloading:backtest-start:${id}`;
      const raw = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
      const timestamp = raw ? Number(raw) : NaN;
      return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    } catch { return null; }
  }, [sessionKey]);
  const [startTime, setStartTime] = useState<number | null>(restored?.startTime ?? requestedStart);
  const [replayTime, setReplayTime] = useState<number | null>(restored?.replayTime ?? requestedStart);
  const [anchorTime, setAnchorTime] = useState<number | null>(restored?.replayTime ?? requestedStart);
  const [requestId, setRequestId] = useState(0);
  const startDate = startTime == null ? null : new Date(startTime * 1000).toISOString().slice(0, 10);
  const [executing, setExecuting] = useState(false);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const executingRef = useRef(false);
  const executionControllerRef = useRef<AbortController | null>(null);
  const [cursor, setCursor] = useState(0);
  const [cursorReady, setCursorReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [trades, setTrades] = useState<ClosedTrade[]>(restored?.trades ?? []);
  const [position, setPosition] = useState<OpenPosition | null>(restored?.openPosition ?? null);
  const [pendingOrder, setPendingOrder] = useState<PendingOrder | null>(restored?.pendingOrder ?? null);
  const [ticket, setTicket] = useState<TerminalTicket>(restored?.ticket ?? { ...DEFAULT_TICKET });
  const [settings, setSettings] = useState<TerminalSettings>(
    restored?.settings ?? { ...DEFAULT_TERMINAL_SETTINGS },
  );
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(
    restored?.indicators ?? defaultIndicators(),
  );
  const [drawings, setDrawings] = useState<ReplayDrawing[]>(restored?.drawings ?? []);
  // Transient event feedback (order filled, stopped out, target hit); the shell
  // renders it as a brief banner and it self-clears.
  const [notice, setNotice] = useState<{ id: number; kind: "fill" | "sl" | "tp"; price: number } | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeIdRef = useRef(0);
  const pushNotice = useCallback((kind: "fill" | "sl" | "tp", price: number) => {
    noticeIdRef.current += 1;
    setNotice({ id: noticeIdRef.current, kind, price });
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 3500);
  }, []);
  const dismissNotice = useCallback(() => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice(null);
  }, []);
  useEffect(() => () => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
  }, []);

  const window_ = useCandleWindow(normalizedSymbol, interval, anchorTime, requestId);
  const { candles, ensureAhead } = window_;

  // Trade ids are epoch-seconds-seeded and monotonic: they never collide with
  // ids from earlier runs (or the retired ChartReplay's 1..N sequence), so the
  // saved-to-DB dedupe set can't silently swallow new trades after a
  // delete+reload or a legacy carry-over.
  const tradeIdRef = useRef(
    Math.max(
      restored?.trades.reduce((max, trade) => Math.max(max, trade.id), 0) ?? 0,
      Math.floor(Date.now() / 1000),
    ),
  );
  const replayTimeRef = useRef(replayTime);
  useEffect(() => { replayTimeRef.current = replayTime; }, [replayTime]);
  useEffect(() => () => executionControllerRef.current?.abort(), []);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionRef = useRef<OpenPosition | null>(position);
  const pendingRef = useRef<PendingOrder | null>(pendingOrder);
  useEffect(() => {
    pendingRef.current = pendingOrder;
  }, [pendingOrder]);
  const cursorRef = useRef(cursor);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  const intervalSeconds = getReplayIntervalSeconds(interval);
  const metadataAvailableTo = window_.meta?.warehouse?.lastTs != null ? window_.meta.warehouse.lastTs + 60 : null;
  const availableTo = window_.availableTo != null && metadataAvailableTo != null
    ? Math.max(window_.availableTo, metadataAvailableTo)
    : window_.availableTo ?? metadataAvailableTo;

  // An import can extend the last, still-forming aggregate. Refresh the window
  // while preserving its exact clock so its future OHLC can advance safely.
  useEffect(() => {
    if (!cursorReady || window_.availableTo == null || metadataAvailableTo == null || metadataAvailableTo <= window_.availableTo) return;
    setCursorReady(false);
    setAnchorTime(replayTimeRef.current);
    setRequestId((id) => id + 1);
  }, [cursorReady, metadataAvailableTo, window_.availableTo]);

  // A chart interval is a view over the clock, never the source of replay time.
  useEffect(() => {
    const loadedFor = window_.loadedFor;
    if (window_.loading || cursorReady || !loadedFor ||
        loadedFor.symbol !== normalizedSymbol || loadedFor.interval !== interval ||
        loadedFor.anchorTime !== anchorTime || loadedFor.requestId !== requestId) return;
    if (candles.length === 0) {
      setCursorReady(true);
      return;
    }
    const requestedTime = anchorTime ?? candles[clampCursor(
      Math.max(MIN_REVEALED_BARS, Math.floor(candles.length * 0.52)), candles.length, 0,
    )].time + intervalSeconds;
    const time = availableTo == null ? requestedTime : Math.min(requestedTime, availableTo);
    const index = Math.max(0, cursorAtReplayTime(candles, time));
    cursorRef.current = index;
    replayTimeRef.current = time;
    setCursor(index);
    setReplayTime(time);
    setStartTime((current) => current ?? time);
    setCursorReady(true);
    ensureAhead(index);
  }, [window_.loading, window_.loadedFor, cursorReady, normalizedSymbol, interval, anchorTime,
      requestId, candles, intervalSeconds, ensureAhead, availableTo]);

  const revealed = useMemo(() => cursorReady
    ? revealAtReplayTime(candles, replayTime, intervalSeconds, window_.partialCandle)
    : [], [cursorReady, candles, replayTime, intervalSeconds, window_.partialCandle]);
  const currentBar = revealed[revealed.length - 1] ?? null;
  const currentPrice = currentBar?.close ?? 0;

  // Prepending older history shifts indices, while the observation clock stays
  // fixed. Forward appends leave this index unchanged.
  useEffect(() => {
    if (!cursorReady || replayTime == null) return;
    const next = Math.max(0, cursorAtReplayTime(candles, replayTime));
    if (next !== cursorRef.current) {
      cursorRef.current = next;
      setCursor(next);
    }
  }, [candles, cursorReady, replayTime]);

  const account = useMemo(() => {
    const openProfit = position && currentPrice > 0 ? unrealizedProfit(position, currentPrice, normalizedSymbol) : 0;
    return buildAccountState(restored?.initialBalance ?? INITIAL_BALANCE, trades, openProfit);
  }, [position, currentPrice, normalizedSymbol, trades, restored?.initialBalance]);

  const stats = useMemo(() => computeJournalStats(trades), [trades]);

  const riskAmount = riskAmountFor({ mode: ticket.riskMode, value: ticket.riskValue, balance: account.balance });
  const lots = computeLots({ riskAmount, slPips: ticket.slPips, symbol: normalizedSymbol });
  const rr = riskRewardRatio(ticket.slPips, ticket.tpPips);

  // Execution costs read through a ref so closeAt stays referentially stable.
  const costsRef = useRef({ spreadPips: settings.spreadPips, commissionPerLot: settings.commissionPerLot });
  useEffect(() => {
    costsRef.current = { spreadPips: settings.spreadPips, commissionPerLot: settings.commissionPerLot };
  }, [settings.spreadPips, settings.commissionPerLot]);

  const closeAt = useCallback(
    (exitPrice: number, exitTime: number, exitReason: "sl" | "tp" | "manual") => {
      // Side effects live OUTSIDE the state updater (updaters may re-run under
      // StrictMode/rebasing); positionRef mirrors state synchronously enough
      // for the transport/hotkey call sites.
      const current = positionRef.current;
      if (!current) return;
      positionRef.current = null;
      tradeIdRef.current += 1;
      const closed = closePosition(current, {
        exitPrice,
        exitTime,
        exitReason,
        id: tradeIdRef.current,
        symbol: normalizedSymbol,
        costs: costsRef.current,
      });
      closed.syncId = crypto.randomUUID();
      setPosition(null);
      setTrades((old) => [closed, ...old]);
    },
    [normalizedSymbol],
  );

  const stop = useCallback(() => {
    setPlaying(false);
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
  }, []);
  useEffect(() => { if (window_.pageError) stop(); }, [window_.pageError, stop]);

  const advanceToTime = useCallback(async (targetTime: number): Promise<boolean> => {
    const from = replayTimeRef.current;
    if (from == null || targetTime <= from || executingRef.current || !cursorReady) return false;
    let finalTime = targetTime;
    if (positionRef.current || pendingRef.current) {
      executingRef.current = true;
      setExecuting(true);
      setExecutionError(null);
      const controller = new AbortController();
      executionControllerRef.current = controller;
      try {
        const result = await simulateReplayExecution({
          pages: iterateReplayExecutionCandles(normalizedSymbol, from, targetTime, { signal: controller.signal }),
          position: positionRef.current,
          pendingOrder: pendingRef.current,
          symbol: normalizedSymbol,
          targetTime,
          rules: { breakevenAtR: ticket.breakevenAtR, trailingPips: ticket.trailingPips },
          signal: controller.signal,
        });
        finalTime = result.finalTime;
        positionRef.current = result.position;
        pendingRef.current = result.pendingOrder;
        setPosition(result.position);
        setPendingOrder(result.pendingOrder);
        if (result.event) pushNotice(result.event.kind, result.event.price);
        if (result.exit) { closeAt(result.exit.exitPrice, finalTime, result.exit.exitReason); stop(); }
      } catch (error) {
        if (!controller.signal.aborted) {
          setExecutionError(error instanceof Error ? error.message : String(error));
          stop();
        }
        return false;
      } finally {
        if (executionControllerRef.current === controller) {
          executingRef.current = false;
          setExecuting(false);
        }
      }
    }
    const next = Math.max(0, cursorAtReplayTime(candles, finalTime));
    cursorRef.current = next;
    replayTimeRef.current = finalTime;
    setCursor(next);
    setReplayTime(finalTime);
    ensureAhead(next);
    if (candles[next] && candles[next].time + intervalSeconds > finalTime) {
      // A stop inside the displayed candle needs its M1-derived partial OHLC.
      setCursorReady(false);
      setAnchorTime(finalTime);
      setRequestId((id) => id + 1);
    }
    return true;
  }, [candles, closeAt, cursorReady, ensureAhead, intervalSeconds, normalizedSymbol, pushNotice, stop, ticket.breakevenAtR, ticket.trailingPips]);

  const stepForward = useCallback(async (): Promise<boolean> => {
    if (!cursorReady || candles.length === 0) return false;
    const current = candles[cursorRef.current];
    const completingPartial = current && replayTimeRef.current != null && current.time + intervalSeconds > replayTimeRef.current;
    const next = completingPartial ? cursorRef.current : cursorRef.current + 1;
    if (!candles[next]) { ensureAhead(cursorRef.current); return false; }
    const nextTime = candles[next].time + intervalSeconds;
    return advanceToTime(availableTo == null ? nextTime : Math.min(nextTime, availableTo));
  }, [advanceToTime, availableTo, candles, cursorReady, ensureAhead, intervalSeconds]);

  /** Never rewind an open trade or pending order into market data it already consumed. */
  const minCursorIndex = useCallback((): number => {
    if (positionRef.current || pendingRef.current) return cursorRef.current;
    return 0;
  }, []);

  const stepBack = useCallback(() => {
    stop();
    if (!cursorReady || executingRef.current) return;
    const next = stepCursor(cursorRef.current, -1, candles.length, minCursorIndex());
    if (next >= cursorRef.current || !candles[next]) return;
    const time = candles[next].time + intervalSeconds;
    cursorRef.current = next;
    replayTimeRef.current = time;
    setCursor(next);
    setReplayTime(time);
  }, [candles, cursorReady, intervalSeconds, minCursorIndex, stop]);

  // ── play loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const advanced = await stepForward();
      if (cancelled) return;
      if (!advanced) {
        // At the loaded edge: if a forward page is still on its way, idle one
        // tick instead of dropping out of play.
        if (window_.appending || window_.hasMore || executingRef.current || !cursorReady) {
          playTimerRef.current = setTimeout(tick, BASE_TICK_MS);
          return;
        }
        setPlaying(false);
        return;
      }
      playTimerRef.current = setTimeout(tick, BASE_TICK_MS / speed);
    };
    playTimerRef.current = setTimeout(tick, BASE_TICK_MS / speed);
    return () => {
      cancelled = true;
      if (playTimerRef.current) {
        clearTimeout(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
  }, [playing, speed, stepForward, window_.appending, window_.hasMore, cursorReady]);

  const togglePlay = useCallback(() => {
    if (!cursorReady || window_.error || window_.pageError || executionError || candles.length === 0) return;
    setPlaying((current) => !current);
  }, [cursorReady, window_.error, window_.pageError, executionError, candles.length]);

  const jumpToTime = useCallback((timestamp: number) => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) return;
    stop();
    executionControllerRef.current?.abort();
    executingRef.current = false;
    setExecuting(false);
    setExecutionError(null);
    setPosition(null);
    positionRef.current = null;
    setPendingOrder(null);
    pendingRef.current = null;
    const time = Math.floor(timestamp / 60) * 60;
    setCursorReady(false);
    setStartTime(time);
    setReplayTime(time);
    replayTimeRef.current = time;
    setAnchorTime(time);
    setRequestId((id) => id + 1);
  }, [stop]);

  const jumpToDate = useCallback((date: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const time = new Date(`${date}T00:00:00.000Z`);
    if (Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === date) jumpToTime(time.getTime() / 1000);
  }, [jumpToTime]);

  const restart = useCallback(() => {
    if (startTime != null) jumpToTime(startTime);
    else if (candles.length) jumpToTime(candles[clampCursor(
      Math.max(MIN_REVEALED_BARS, Math.floor(candles.length * 0.52)), candles.length, 0,
    )].time + intervalSeconds);
  }, [candles, intervalSeconds, jumpToTime, startTime]);

  const seekToIndex = useCallback((target: number) => {
    if (!cursorReady || executingRef.current || !candles[target] || target === cursorRef.current) return;
    const requestedTime = candles[target].time + intervalSeconds;
    const time = availableTo == null ? requestedTime : Math.min(requestedTime, availableTo);
    if (replayTimeRef.current != null && time > replayTimeRef.current) { void advanceToTime(time); return; }
    cursorRef.current = target;
    replayTimeRef.current = time;
    setCursor(target);
    setReplayTime(time);
  }, [advanceToTime, availableTo, candles, cursorReady, intervalSeconds]);

  const seekFraction = useCallback((fraction: number) => {
    stop();
    const target = cursorFromFraction(fraction, candles.length, 0);
    seekToIndex(Math.max(minCursorIndex(), target));
  }, [candles.length, minCursorIndex, seekToIndex, stop]);

  const seekToTime = useCallback((time: number) => {
    stop();
    const index = Math.max(minCursorIndex(), cursorAtReplayTime(candles, time + intervalSeconds));
    seekToIndex(index);
  }, [candles, intervalSeconds, minCursorIndex, seekToIndex, stop]);

  const changeInterval = useCallback((nextInterval: string) => {
    if (nextInterval === interval || !REPLAY_TIMEFRAMES.includes(nextInterval as typeof REPLAY_TIMEFRAMES[number])) return;
    stop();
    executionControllerRef.current?.abort();
    executingRef.current = false;
    setExecuting(false);
    setExecutionError(null);
    setCursorReady(false);
    setAnchorTime(replayTimeRef.current);
    setIntervalState(nextInterval);
    setRequestId((id) => id + 1);
  }, [interval, stop]);

  const retryHistory = useCallback(() => {
    stop();
    executionControllerRef.current?.abort();
    executingRef.current = false;
    setExecuting(false);
    setExecutionError(null);
    setCursorReady(false);
    setAnchorTime(replayTimeRef.current ?? startTime);
    setRequestId((id) => id + 1);
  }, [startTime, stop]);

  const changeSpeed = useCallback((next: number) => {
    setSpeed(next);
  }, []);

  const bumpSpeed = useCallback((direction: 1 | -1) => {
    setSpeed((current) => {
      const index = REPLAY_SPEEDS.findIndex((value) => value === current);
      const nextIndex = Math.min(REPLAY_SPEEDS.length - 1, Math.max(0, (index === -1 ? 2 : index) + direction));
      return REPLAY_SPEEDS[nextIndex];
    });
  }, []);

  const buy = useCallback(
    (direction: TradeDirection = "buy") => {
      // Reject while a position OR a resting order exists (the B/S hotkeys reach
      // here even when the ticket hides the buttons behind the pending card).
      if (positionRef.current || pendingRef.current || !currentBar || !cursorReady || executingRef.current || lots <= 0) return;
      const opened = openPosition({
        direction,
        entryPrice: currentBar.close,
        entryTime: replayTimeRef.current ?? currentBar.time,
        slPips: ticket.slPips,
        tpPips: ticket.tpPips,
        lots,
        riskAmount,
        symbol: normalizedSymbol,
      });
      positionRef.current = opened;
      setPosition(opened);
    },
    [currentBar, cursorReady, lots, normalizedSymbol, riskAmount, ticket.slPips, ticket.tpPips],
  );

  const sell = useCallback(() => buy("sell"), [buy]);

  /**
   * Place a resting limit/stop order at `price`. Only one order (and no open
   * position) at a time. The kind (limit vs stop) is inferred from where the
   * price sits relative to the current close, matching broker conventions:
   * buy below = limit / buy above = stop, and mirrored for sell.
   */
  const placeOrder = useCallback(
    (direction: TradeDirection, price: number) => {
      if (positionRef.current || pendingRef.current || !currentBar || !cursorReady || executingRef.current || lots <= 0) return;
      if (!Number.isFinite(price) || price <= 0) return;
      const below = price < currentBar.close;
      const kind: "limit" | "stop" = direction === "buy" ? (below ? "limit" : "stop") : below ? "stop" : "limit";
      const order = {
        direction,
        kind,
        price,
        slPips: ticket.slPips,
        tpPips: ticket.tpPips,
        lots,
        riskAmount,
        placedTime: replayTimeRef.current ?? currentBar.time,
      };
      pendingRef.current = order;
      setPendingOrder(order);
    },
    [currentBar, cursorReady, lots, riskAmount, ticket.slPips, ticket.tpPips],
  );

  const cancelOrder = useCallback(() => {
    // The X hotkey can fire while a transport fetch is in flight. Abort the
    // staged move so it cannot resurrect an order the user just cancelled.
    executionControllerRef.current?.abort();
    stop();
    pendingRef.current = null;
    setPendingOrder(null);
  }, [stop]);

  const closeMarket = useCallback(() => {
    if (!positionRef.current || !currentBar || executingRef.current || !cursorReady) return;
    closeAt(currentBar.close, replayTimeRef.current ?? currentBar.time, "manual");
  }, [closeAt, currentBar, cursorReady]);

  const updatePositionLevels = useCallback(
    (levels: { stopLoss?: number; takeProfit?: number; entryPrice?: number }) => {
      if (executingRef.current || !cursorReady) return;
      // Re-derive the pip distances so R:R, the hit checks' guards and the
      // closed trade's R multiple track the dragged lines, not the original
      // ticket values.
      const multiplier = getPipMultiplier(normalizedSymbol);
      const roundPips = (value: number) => Math.round(value * 10) / 10;
      setPosition((current) => {
        if (!current) return current;
        const next = { ...current, ...levels };
        // Magnitudes (the stop stays armed via hasStop even when dragged to the
        // profit side of entry, where the signed distance would go negative).
        next.slPips = roundPips(Math.abs((next.entryPrice - next.stopLoss) * multiplier));
        next.tpPips = roundPips(Math.abs((next.takeProfit - next.entryPrice) * multiplier));
        next.hasStop = true;
        positionRef.current = next;
        return next;
      });
    },
    [normalizedSymbol, cursorReady],
  );

  const deleteTrade = useCallback((id: number) => {
    setTrades((old) => old.filter((trade) => trade.id !== id));
  }, []);

  const setTradeTags = useCallback((id: number, tags: string[]) => {
    setTrades((old) => old.map((trade) => (trade.id === id ? { ...trade, tags } : trade)));
  }, []);

  // ── persistence ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || window_.loading || window_.error || !cursorReady || !currentBar) return;
    try {
      window.localStorage.setItem(
        storageKey,
        serializeTerminalState({
          symbol: normalizedSymbol,
          interval,
          cursorTime: currentBar?.time ?? null,
          replayTime,
          startTime,
          indicators,
          drawings,
          trades,
          openPosition: position,
          pendingOrder,
          ticket,
          settings,
          initialBalance: restored?.initialBalance ?? INITIAL_BALANCE,
        }),
      );
      const requestedStartKey = `traderloading:backtest-start:${sessionKey.replace(/^backtest-session-/, "")}`;
      window.localStorage.removeItem(requestedStartKey);
      window.sessionStorage.removeItem(requestedStartKey);
    } catch {
      // Storage can fail (private mode / quota); the in-memory replay stays usable.
    }
  }, [
    storageKey,
    window_.loading,
    cursorReady,
    normalizedSymbol,
    interval,
    currentBar,
    replayTime,
    startTime,
    sessionKey,
    window_.error,
    indicators,
    drawings,
    trades,
    position,
    pendingOrder,
    ticket,
    settings,
    restored?.initialBalance,
  ]);

  const openProfit = position && currentPrice > 0 ? unrealizedProfit(position, currentPrice, normalizedSymbol) : 0;
  const openPips = position && currentPrice > 0 ? positionPips(position, currentPrice, normalizedSymbol) : 0;

  return {
    symbol: normalizedSymbol,
    interval,
    intervalSeconds,
    candles,
    loading: window_.loading || !cursorReady,
    error: window_.error ?? executionError ?? window_.pageError,
    executing,
    meta: window_.meta,
    appending: window_.appending,
    cursor,
    revealed,
    noData: !window_.loading && cursorReady && candles.length === 0,
    notice,
    dismissNotice,
    currentBar,
    currentPrice,
    progress: cursorFraction(cursor, candles.length, 0),
    playing,
    speed,
    startDate,
    startTime,
    replayTime,
    trades,
    position,
    pendingOrder,
    openProfit,
    openPips,
    account,
    stats,
    ticket,
    setTicket,
    riskAmount,
    lots,
    rr,
    settings,
    setSettings,
    indicators,
    setIndicators,
    drawings,
    setDrawings,
    togglePlay,
    stop,
    stepForward,
    stepBack,
    restart,
    seekFraction,
    seekToTime,
    jumpToDate,
    jumpToTime,
    retryHistory,
    ensureHistoryBefore: window_.ensureBefore,
    changeInterval,
    changeSpeed,
    bumpSpeed,
    buy: () => buy("buy"),
    sell,
    placeOrder,
    cancelOrder,
    closeMarket,
    updatePositionLevels,
    deleteTrade,
    setTradeTags,
  };
}

export type ReplayEngine = ReturnType<typeof useReplayEngine>;
