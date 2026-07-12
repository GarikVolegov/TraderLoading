// ─── Replay engine hook ──────────────────────────────────────────────────────
// The terminal's single stateful orchestrator: candle window, replay cursor,
// play loop, timeframe switching (close-time anchored, like ChartReplay), the
// simulated account (open/close/SL/TP via lib/replay/tradeEngine) and the
// persisted terminal state. UI components consume the returned API only.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getReplayIntervalSeconds } from "../chartReplayWindow";
import { buildAccountState } from "@/lib/replay/accountTracker";
import { defaultIndicators, type IndicatorConfig } from "@/lib/replay/indicatorCatalog";
import { computeJournalStats } from "@/lib/replay/journalStats";
import { computeLots, riskAmountFor, riskRewardRatio } from "@/lib/replay/lotSizing";
import {
  clampCursor,
  cursorFraction,
  cursorFromFraction,
  MIN_REVEALED_BARS,
  seekCursorToTime,
  stepCursor,
} from "@/lib/replay/replayCursor";
import {
  checkStopHit,
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
  ReplayDrawing,
  TradeDirection,
} from "@/lib/replay/types";
import { useCandleWindow } from "./useCandleWindow";

export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;
export const REPLAY_TIMEFRAMES = ["M1", "M5", "M15", "H1", "H4", "D1"] as const;
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
  const [startDate, setStartDate] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [cursorReady, setCursorReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [trades, setTrades] = useState<ClosedTrade[]>(restored?.trades ?? []);
  const [position, setPosition] = useState<OpenPosition | null>(restored?.openPosition ?? null);
  const [ticket, setTicket] = useState<TerminalTicket>(restored?.ticket ?? { ...DEFAULT_TICKET });
  const [settings, setSettings] = useState<TerminalSettings>(
    restored?.settings ?? { ...DEFAULT_TERMINAL_SETTINGS },
  );
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(
    restored?.indicators.length ? restored.indicators : defaultIndicators(),
  );
  const [drawings, setDrawings] = useState<ReplayDrawing[]>(restored?.drawings ?? []);

  const window_ = useCandleWindow(normalizedSymbol, interval, startDate);
  const { candles, ensureAhead } = window_;

  const tradeIdRef = useRef(restored?.trades.reduce((max, trade) => Math.max(max, trade.id), 0) ?? 0);
  const anchorRef = useRef<{ closeTime: number; price: number } | null>(null);
  const restoreCursorRef = useRef<number | null>(restored?.cursorTime ?? null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const positionRef = useRef<OpenPosition | null>(position);
  const cursorRef = useRef(cursor);
  useEffect(() => {
    positionRef.current = position;
  }, [position]);
  useEffect(() => {
    cursorRef.current = cursor;
  }, [cursor]);

  const intervalSeconds = getReplayIntervalSeconds(interval);

  // ── cursor placement on (re)load ───────────────────────────────────────────
  // Runs once per loaded window (initial, timeframe switch, date jump); guarded
  // by cursorReady so forward-page appends never re-place the cursor.
  useEffect(() => {
    if (window_.loading || candles.length === 0 || cursorReady) return;

    const anchor = anchorRef.current;
    if (anchor) {
      // Timeframe switch: land on the bar whose close covers the previous
      // bar's close time (same rule as resolveReplayWindowForCloseAnchor).
      anchorRef.current = null;
      const secs = getReplayIntervalSeconds(interval);
      let index = candles.findIndex((candle) => candle.time + secs >= anchor.closeTime);
      if (index === -1) index = candles.length - 1;
      setCursor(clampCursor(index, candles.length, MIN_REVEALED_BARS));
      setCursorReady(true);
      return;
    }

    const restoredTime = restoreCursorRef.current;
    if (restoredTime != null) {
      restoreCursorRef.current = null;
      setCursor(seekCursorToTime(candles, restoredTime, MIN_REVEALED_BARS));
      setCursorReady(true);
      return;
    }

    // Fresh session (or date jump): start just past the warm-up window for a
    // date jump, around half the loaded history otherwise (mockup behavior).
    const fallback = startDate
      ? MIN_REVEALED_BARS
      : Math.max(MIN_REVEALED_BARS, Math.floor(candles.length * 0.52));
    setCursor(clampCursor(fallback, candles.length, MIN_REVEALED_BARS));
    setCursorReady(true);
  }, [window_.loading, candles, interval, startDate, cursorReady]);

  // ── trading ──────────────────────────────────────────────────────────────
  const currentBar = candles.length > 0 ? candles[Math.min(cursor, candles.length - 1)] : null;
  const currentPrice = currentBar?.close ?? 0;

  const account = useMemo(() => {
    const openProfit = position && currentPrice > 0 ? unrealizedProfit(position, currentPrice, normalizedSymbol) : 0;
    return buildAccountState(restored?.initialBalance ?? INITIAL_BALANCE, trades, openProfit);
  }, [position, currentPrice, normalizedSymbol, trades, restored?.initialBalance]);

  const stats = useMemo(() => computeJournalStats(trades), [trades]);

  const riskAmount = riskAmountFor({ mode: ticket.riskMode, value: ticket.riskValue, balance: account.balance });
  const lots = computeLots({ riskAmount, slPips: ticket.slPips, symbol: normalizedSymbol });
  const rr = riskRewardRatio(ticket.slPips, ticket.tpPips);

  const closeAt = useCallback(
    (exitPrice: number, exitTime: number, exitReason: "sl" | "tp" | "manual") => {
      setPosition((current) => {
        if (!current) return null;
        tradeIdRef.current += 1;
        const closed = closePosition(current, {
          exitPrice,
          exitTime,
          exitReason,
          id: tradeIdRef.current,
          symbol: normalizedSymbol,
        });
        setTrades((old) => [closed, ...old]);
        return null;
      });
    },
    [normalizedSymbol],
  );

  /** SL/TP check for a newly revealed bar; returns true when it closed the position. */
  const revealBar = useCallback(
    (index: number): boolean => {
      const open = positionRef.current;
      const bar = candles[index];
      if (!open || !bar) return false;
      const hit = checkStopHit(open, bar);
      if (!hit) return false;
      closeAt(hit.exitPrice, bar.time, hit.exitReason);
      return true;
    },
    [candles, closeAt],
  );

  const stop = useCallback(() => {
    setPlaying(false);
    if (playTimerRef.current) {
      clearTimeout(playTimerRef.current);
      playTimerRef.current = null;
    }
  }, []);

  const stepForward = useCallback((): boolean => {
    const next = stepCursor(cursorRef.current, 1, candles.length, MIN_REVEALED_BARS);
    if (next === cursorRef.current) return false;
    setCursor(next);
    ensureAhead(next);
    const closed = revealBar(next);
    if (closed) stop();
    return true;
  }, [candles.length, ensureAhead, revealBar, stop]);

  const stepBack = useCallback(() => {
    stop();
    setCursor((current) => stepCursor(current, -1, candles.length, MIN_REVEALED_BARS));
  }, [candles.length, stop]);

  // ── play loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const advanced = stepForward();
      if (!advanced) {
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
  }, [playing, speed, stepForward]);

  const togglePlay = useCallback(() => {
    setPlaying((current) => !current);
  }, []);

  const restart = useCallback(() => {
    stop();
    setPosition(null);
    const fallback = startDate
      ? MIN_REVEALED_BARS
      : Math.max(MIN_REVEALED_BARS, Math.floor(candles.length * 0.52));
    setCursor(clampCursor(fallback, candles.length, MIN_REVEALED_BARS));
  }, [candles.length, startDate, stop]);

  const seekFraction = useCallback(
    (fraction: number) => {
      stop();
      setCursor(cursorFromFraction(fraction, candles.length, MIN_REVEALED_BARS));
    },
    [candles.length, stop],
  );

  const jumpToDate = useCallback(
    (date: string) => {
      stop();
      setPosition(null);
      anchorRef.current = null;
      restoreCursorRef.current = null;
      setCursorReady(false);
      setStartDate(date || null);
    },
    [stop],
  );

  const changeInterval = useCallback(
    (nextInterval: string) => {
      if (nextInterval === interval) return;
      stop();
      const bar = candles[cursorRef.current];
      if (bar) {
        anchorRef.current = {
          closeTime: bar.time + getReplayIntervalSeconds(interval),
          price: bar.close,
        };
      }
      setCursorReady(false);
      setIntervalState(nextInterval);
    },
    [candles, interval, stop],
  );

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
      if (positionRef.current || !currentBar || lots <= 0) return;
      setPosition(
        openPosition({
          direction,
          entryPrice: currentBar.close,
          entryTime: currentBar.time,
          slPips: ticket.slPips,
          tpPips: ticket.tpPips,
          lots,
          riskAmount,
          symbol: normalizedSymbol,
        }),
      );
    },
    [currentBar, lots, normalizedSymbol, riskAmount, ticket.slPips, ticket.tpPips],
  );

  const sell = useCallback(() => buy("sell"), [buy]);

  const closeMarket = useCallback(() => {
    if (!positionRef.current || !currentBar) return;
    closeAt(currentBar.close, currentBar.time, "manual");
  }, [closeAt, currentBar]);

  const updatePositionLevels = useCallback(
    (levels: { stopLoss?: number; takeProfit?: number; entryPrice?: number }) => {
      setPosition((current) => (current ? { ...current, ...levels } : current));
    },
    [],
  );

  const deleteTrade = useCallback((id: number) => {
    setTrades((old) => old.filter((trade) => trade.id !== id));
  }, []);

  // ── persistence ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined" || window_.loading || !cursorReady) return;
    try {
      window.localStorage.setItem(
        storageKey,
        serializeTerminalState({
          symbol: normalizedSymbol,
          interval,
          cursorTime: currentBar?.time ?? null,
          indicators,
          drawings,
          trades,
          openPosition: position,
          ticket,
          settings,
          initialBalance: restored?.initialBalance ?? INITIAL_BALANCE,
        }),
      );
    } catch {
      // Storage can fail (private mode / quota); the in-memory replay stays usable.
    }
  }, [
    storageKey,
    window_.loading,
    cursorReady,
    normalizedSymbol,
    interval,
    currentBar?.time,
    indicators,
    drawings,
    trades,
    position,
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
    error: window_.error,
    meta: window_.meta,
    appending: window_.appending,
    cursor,
    revealed: cursorReady ? candles.slice(0, cursor + 1) : [],
    currentBar,
    currentPrice,
    progress: cursorFraction(cursor, candles.length, MIN_REVEALED_BARS),
    playing,
    speed,
    startDate,
    trades,
    position,
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
    jumpToDate,
    changeInterval,
    changeSpeed,
    bumpSpeed,
    buy: () => buy("buy"),
    sell,
    closeMarket,
    updatePositionLevels,
    deleteTrade,
  };
}

export type ReplayEngine = ReturnType<typeof useReplayEngine>;
