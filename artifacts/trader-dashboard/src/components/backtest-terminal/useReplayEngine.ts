// ─── Replay engine hook ──────────────────────────────────────────────────────
// The terminal's single stateful orchestrator: candle window, replay cursor,
// play loop, timeframe switching (close-time anchored, like ChartReplay), the
// simulated account (open/close/SL/TP via lib/replay/tradeEngine) and the
// persisted terminal state. UI components consume the returned API only.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getReplayIntervalSeconds } from "../chartReplayWindow";
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
  seekCursorToTime,
  stepCursor,
} from "@/lib/replay/replayCursor";
import {
  closePosition,
  manageBar,
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
  // by cursorReady so forward-page appends never re-place the cursor, and by
  // loadedFor so the same-commit run after a timeframe switch (when `candles`
  // is still the previous window and `loading` hasn't flipped yet) never
  // consumes the anchor against stale data.
  useEffect(() => {
    const loadedFor = window_.loadedFor;
    if (
      window_.loading ||
      candles.length === 0 ||
      cursorReady ||
      !loadedFor ||
      loadedFor.interval !== interval ||
      (loadedFor.startDate ?? null) !== (startDate ?? null)
    ) {
      return;
    }

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
  }, [window_.loading, window_.loadedFor, candles, interval, startDate, cursorReady]);

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
      });
      setPosition(null);
      setTrades((old) => [closed, ...old]);
    },
    [normalizedSymbol],
  );

  /**
   * Full per-bar processing of the open position: stop check (pre-bar levels),
   * excursion tracking, auto-breakeven and trailing per the ticket rules.
   * Returns true when the bar closed the position.
   */
  const revealBar = useCallback(
    (index: number): boolean => {
      const open = positionRef.current;
      const bar = candles[index];
      if (!open || !bar) return false;
      const { position: managed, hit } = manageBar(
        open,
        bar,
        { breakevenAtR: ticket.breakevenAtR, trailingPips: ticket.trailingPips },
        normalizedSymbol,
      );
      positionRef.current = managed;
      setPosition(managed);
      if (!hit) return false;
      closeAt(hit.exitPrice, bar.time, hit.exitReason);
      return true;
    },
    [candles, closeAt, normalizedSymbol, ticket.breakevenAtR, ticket.trailingPips],
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

  /** Lowest cursor allowed right now: an open position pins it to its entry bar. */
  const minCursorIndex = useCallback((): number => {
    const open = positionRef.current;
    if (!open) return MIN_REVEALED_BARS;
    const entryIndex = candles.findIndex((candle) => candle.time >= open.entryTime);
    return entryIndex === -1 ? MIN_REVEALED_BARS : Math.max(MIN_REVEALED_BARS, entryIndex);
  }, [candles]);

  const stepBack = useCallback(() => {
    stop();
    setCursor((current) => stepCursor(current, -1, candles.length, minCursorIndex()));
  }, [candles.length, minCursorIndex, stop]);

  // ── play loop ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const advanced = stepForward();
      if (!advanced) {
        // At the loaded edge: if a forward page is still on its way, idle one
        // tick instead of dropping out of play.
        if (window_.appending || window_.hasMore) {
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
  }, [playing, speed, stepForward, window_.appending, window_.hasMore]);

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

  // Backward seeks can't cross the open position's entry bar; forward seeks
  // replay the full per-bar management (stops, BE, trailing) across every
  // skipped bar, so scrubbing cannot fast-forward through a stop-out.
  const seekToIndex = useCallback(
    (target: number) => {
      const from = cursorRef.current;
      if (target > from && positionRef.current) {
        for (let index = from + 1; index <= target; index++) {
          if (revealBar(index) || !positionRef.current) break;
        }
      }
      setCursor(target);
      ensureAhead(target);
    },
    [ensureAhead, revealBar],
  );

  const seekFraction = useCallback(
    (fraction: number) => {
      stop();
      seekToIndex(cursorFromFraction(fraction, candles.length, minCursorIndex()));
    },
    [candles.length, minCursorIndex, seekToIndex, stop],
  );

  /** Jump the replay to the bar at/after `time` (right-click jump, Go-To). */
  const seekToTime = useCallback(
    (time: number) => {
      stop();
      seekToIndex(seekCursorToTime(candles, time, minCursorIndex()));
    },
    [candles, minCursorIndex, seekToIndex, stop],
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
      // Re-derive the pip distances so R:R, the hit checks' guards and the
      // closed trade's R multiple track the dragged lines, not the original
      // ticket values.
      const multiplier = getPipMultiplier(normalizedSymbol);
      const roundPips = (value: number) => Math.round(value * 10) / 10;
      setPosition((current) => {
        if (!current) return current;
        const next = { ...current, ...levels };
        const sign = next.direction === "buy" ? 1 : -1;
        next.slPips = Math.max(0, roundPips((next.entryPrice - next.stopLoss) * sign * multiplier));
        next.tpPips = Math.max(0, roundPips((next.takeProfit - next.entryPrice) * sign * multiplier));
        positionRef.current = next;
        return next;
      });
    },
    [normalizedSymbol],
  );

  const deleteTrade = useCallback((id: number) => {
    setTrades((old) => old.filter((trade) => trade.id !== id));
  }, []);

  const setTradeTags = useCallback((id: number, tags: string[]) => {
    setTrades((old) => old.map((trade) => (trade.id === id ? { ...trade, tags } : trade)));
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

  // Stable identity: the chart's reveal effect keys on this array, and a fresh
  // slice per render would reset the user's pan/zoom on every unrelated
  // interaction (typing in the ticket, toggling the panel, pausing…).
  const revealed = useMemo(
    () => (cursorReady ? candles.slice(0, cursor + 1) : []),
    [cursorReady, candles, cursor],
  );

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
    revealed,
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
    seekToTime,
    jumpToDate,
    changeInterval,
    changeSpeed,
    bumpSpeed,
    buy: () => buy("buy"),
    sell,
    closeMarket,
    updatePositionLevels,
    deleteTrade,
    setTradeTags,
  };
}

export type ReplayEngine = ReturnType<typeof useReplayEngine>;
