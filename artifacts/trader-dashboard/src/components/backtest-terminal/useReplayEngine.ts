import { useChartPreferences } from "./useChartPreferences";
import { pickChartSettings } from "../../../../../contracts/backtestChart";
import { DRAWINGS_SYNC_EVENT, loadChartDrawings, saveChartDrawings } from "@/lib/chart/drawingStorage";
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
import { computeLots, pipSize, riskAmountFor, riskRewardRatio } from "@/lib/replay/lotSizing";
import {
  clampCursor,
  cursorFraction,
  cursorFromFraction,
  MIN_REVEALED_BARS,
  stepCursor,
} from "@/lib/replay/replayCursor";
import {
  adaptPositionToStop,
  closePosition,
  openPosition,
  partialClosePosition,
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
import { generateRandomTradingTimestamp, getYearTradingStart } from "./dateTime";

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
  const initialTime = useMemo(() => {
    if (restored?.replayTime != null && Number.isFinite(restored.replayTime) && restored.replayTime > 0) {
      return restored.replayTime;
    }
    if (restored?.cursorTime != null && Number.isFinite(restored.cursorTime) && restored.cursorTime > 0) {
      const step = getReplayIntervalSeconds(restored.interval ?? defaultInterval);
      return restored.cursorTime + step;
    }
    return requestedStart;
  }, [restored?.replayTime, restored?.cursorTime, restored?.interval, defaultInterval, requestedStart]);

  const [startTime, setStartTime] = useState<number | null>(restored?.startTime ?? initialTime ?? requestedStart);
  const [replayTime, setReplayTime] = useState<number | null>(initialTime);
  const [anchorTime, setAnchorTime] = useState<number | null>(initialTime);
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
  const initialPositions = restored?.openPositions?.length
    ? restored.openPositions
    : restored?.openPosition
      ? [restored.openPosition]
      : [];
  const initialPendingOrders = restored?.pendingOrders?.length
    ? restored.pendingOrders
    : restored?.pendingOrder
      ? [restored.pendingOrder]
      : [];

  const [positions, setPositions] = useState<OpenPosition[]>(initialPositions);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>(initialPendingOrders);
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(initialPositions[0]?.id ?? null);
  const [pickingOrderPrice, setPickingOrderPrice] = useState(false);
  const [pickedPrice, setPickedPrice] = useState<number | null>(null);

  const positionsRef = useRef<OpenPosition[]>(positions);
  const pendingOrdersRef = useRef<PendingOrder[]>(pendingOrders);
  useEffect(() => { positionsRef.current = positions; }, [positions]);
  useEffect(() => { pendingOrdersRef.current = pendingOrders; }, [pendingOrders]);

  const position = positions[0] ?? null;
  const pendingOrder = pendingOrders[0] ?? null;
  const positionRef = useRef<OpenPosition | null>(position);
  const pendingRef = useRef<PendingOrder | null>(pendingOrder);
  useEffect(() => { positionRef.current = positions[0] ?? null; }, [positions]);
  useEffect(() => { pendingRef.current = pendingOrders[0] ?? null; }, [pendingOrders]);

  const setPosition = useCallback((pos: OpenPosition | null) => {
    if (!pos) {
      setPositions([]);
      positionsRef.current = [];
    } else {
      setPositions([pos]);
      positionsRef.current = [pos];
    }
  }, []);

  const setPendingOrder = useCallback((ord: PendingOrder | null) => {
    if (!ord) {
      setPendingOrders([]);
      pendingOrdersRef.current = [];
    } else {
      setPendingOrders([ord]);
      pendingOrdersRef.current = [ord];
    }
  }, []);

  const [ticket, setTicket] = useState<TerminalTicket>(restored?.ticket ?? { ...DEFAULT_TICKET });
  const [sessionSettings, setSessionSettings] = useState<TerminalSettings>(
    restored?.settings ?? { ...DEFAULT_TERMINAL_SETTINGS },
  );
  const chartPreferences = useChartPreferences(sessionSettings);
  const settings = useMemo<TerminalSettings>(() => ({ ...sessionSettings, ...chartPreferences.preferences.settings }), [sessionSettings, chartPreferences.preferences.settings]);
  const updateChartPreferences = chartPreferences.update;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const setSettings = useCallback((value: TerminalSettings | ((previous: TerminalSettings) => TerminalSettings)) => {
    const next = typeof value === "function" ? value(settingsRef.current) : value;
    settingsRef.current = next;
    setSessionSettings((previous) => ({ ...previous, spreadPips: next.spreadPips, commissionPerLot: next.commissionPerLot }));
    updateChartPreferences((previous) => ({ ...previous, settings: pickChartSettings(next) }));
  }, [updateChartPreferences]);
  const [indicators, setIndicators] = useState<IndicatorConfig[]>(
    restored?.indicators ?? defaultIndicators(),
  );
  const [drawings, setDrawingsState] = useState<ReplayDrawing[]>(() => {
    if (restored?.drawings && restored.drawings.length > 0) return restored.drawings;
    return loadChartDrawings(normalizedSymbol);
  });
  const setDrawings = useCallback(
    (update: ReplayDrawing[] | ((prev: ReplayDrawing[]) => ReplayDrawing[])) => {
      setDrawingsState((prev) => {
        const next = typeof update === "function" ? update(prev) : update;
        saveChartDrawings(normalizedSymbol, next);
        return next;
      });
    },
    [normalizedSymbol],
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onDrawingsSync = (event: Event) => {
      const detail = (event as CustomEvent<{ symbol?: string; drawings?: ReplayDrawing[] }>).detail;
      if (!detail || detail.symbol !== normalizedSymbol || !Array.isArray(detail.drawings)) return;
      setDrawingsState((prev) => (prev === detail.drawings ? prev : detail.drawings!));
    };
    window.addEventListener(DRAWINGS_SYNC_EVENT, onDrawingsSync);
    return () => window.removeEventListener(DRAWINGS_SYNC_EVENT, onDrawingsSync);
  }, [normalizedSymbol]);
  const [hoveredTradeId, setHoveredTradeId] = useState<number | null>(null);
  // Transient event feedback (order filled, stopped out, target hit); the shell
  // renders it as a brief banner and it self-clears.
  const [notice, setNotice] = useState<{ id: number; kind: "fill" | "sl" | "tp" | "cancel_tp" | "cancel_sl"; price: number } | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeIdRef = useRef(0);
  const pushNotice = useCallback((kind: "fill" | "sl" | "tp" | "cancel_tp" | "cancel_sl", price: number) => {
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

  // Trade ids are human-meaningful sequential numbers (1, 2, 3...)
  const tradeIdRef = useRef(
    restored?.trades && restored.trades.length > 0
      ? Math.max(0, ...restored.trades.filter((t) => typeof t.id === "number" && t.id < 1000000).map((t) => t.id))
      : 0,
  );
  const replayTimeRef = useRef(replayTime);
  useEffect(() => { replayTimeRef.current = replayTime; }, [replayTime]);
  useEffect(() => () => executionControllerRef.current?.abort(), []);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef = useRef(cursor);
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
    let index = Math.max(0, cursorAtReplayTime(candles, time));

    // Snapshot exact bar recovery: se abbiamo memorizzato il cursorTime esatto di quella barra,
    // allineiamo l'indice con precisione assoluta al timestamp salvato.
    if (restored?.cursorTime != null && Number.isFinite(restored.cursorTime)) {
      const exactIndex = candles.findIndex((c) => c.time === restored.cursorTime);
      if (exactIndex >= 0) {
        index = exactIndex;
      }
    }

    cursorRef.current = index;
    replayTimeRef.current = time;
    setCursor(index);
    setReplayTime(time);
    setStartTime((current) => current ?? time);
    setCursorReady(true);
    ensureAhead(index);
  }, [window_.loading, window_.loadedFor, cursorReady, normalizedSymbol, interval, anchorTime,
      requestId, candles, intervalSeconds, ensureAhead, availableTo, restored?.cursorTime]);

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

  const totalOpenProfit = useMemo(() => {
    if (currentPrice <= 0 || positions.length === 0) return 0;
    const profit = positions.reduce((sum, pos) => sum + unrealizedProfit(pos, currentPrice, normalizedSymbol), 0);
    return Math.round(profit * 100) / 100;
  }, [positions, currentPrice, normalizedSymbol]);

  const totalOpenPips = useMemo(() => {
    if (currentPrice <= 0 || positions.length === 0) return 0;
    if (positions.length === 1) return positionPips(positions[0], currentPrice, normalizedSymbol);
    const pips = positions.reduce((sum, pos) => sum + positionPips(pos, currentPrice, normalizedSymbol), 0);
    return Math.round(pips * 10) / 10;
  }, [positions, currentPrice, normalizedSymbol]);

  const totalExposureLots = useMemo(() => {
    return Math.round(positions.reduce((sum, pos) => sum + pos.lots, 0) * 100) / 100;
  }, [positions]);

  const account = useMemo(() => {
    return buildAccountState(restored?.initialBalance ?? INITIAL_BALANCE, trades, totalOpenProfit);
  }, [trades, totalOpenProfit, restored?.initialBalance]);

  const stats = useMemo(() => computeJournalStats(trades), [trades]);

  const riskAmount = riskAmountFor({ mode: ticket.riskMode, value: ticket.riskValue, balance: account.balance });
  const lots = computeLots({ riskAmount, slPips: ticket.slPips, symbol: normalizedSymbol });
  const rr = riskRewardRatio(ticket.slPips, ticket.tpPips);

  // Execution costs read through a ref so closeAt stays referentially stable.
  const costsRef = useRef({ spreadPips: settings.spreadPips, commissionPerLot: settings.commissionPerLot });
  useEffect(() => {
    costsRef.current = { spreadPips: settings.spreadPips, commissionPerLot: settings.commissionPerLot };
  }, [settings.spreadPips, settings.commissionPerLot]);

  const closePositionDirect = useCallback(
    (targetPos: OpenPosition, exitPrice: number, exitTime: number, exitReason: "sl" | "tp" | "manual") => {
      tradeIdRef.current += 1;
      const closed = closePosition(targetPos, {
        exitPrice,
        exitTime,
        exitReason,
        id: tradeIdRef.current,
        symbol: normalizedSymbol,
        costs: costsRef.current,
      });
      closed.syncId = crypto.randomUUID();
      setTrades((old) => [closed, ...old]);
      return closed;
    },
    [normalizedSymbol],
  );

  const closeAt = useCallback(
    (exitPrice: number, exitTime: number, exitReason: "sl" | "tp" | "manual") => {
      const current = positionsRef.current[0];
      if (!current) return;
      closePositionDirect(current, exitPrice, exitTime, exitReason);
      const nextPositions = positionsRef.current.slice(1);
      positionsRef.current = nextPositions;
      setPositions(nextPositions);
    },
    [closePositionDirect],
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
    if (positionsRef.current.length > 0 || pendingOrdersRef.current.length > 0) {
      executingRef.current = true;
      setExecuting(true);
      setExecutionError(null);
      const controller = new AbortController();
      executionControllerRef.current = controller;
      try {
        const targetCandles = candles.filter((c) => c.time >= from && c.time <= targetTime);
        const result = await simulateReplayExecution({
          pages: iterateReplayExecutionCandles(normalizedSymbol, from, targetTime, { signal: controller.signal }),
          fallbackCandles: targetCandles.length > 0 ? targetCandles : (currentBar ? [currentBar] : []),
          positions: positionsRef.current,
          pendingOrders: pendingOrdersRef.current,
          position: positionsRef.current[0] ?? null,
          pendingOrder: pendingOrdersRef.current[0] ?? null,
          symbol: normalizedSymbol,
          targetTime,
          rules: { breakevenAtR: ticket.breakevenAtR, trailingPips: ticket.trailingPips },
          signal: controller.signal,
        });
        const exitTimestamp = result.finalTime;
        // Manteniamo l'avanzamento fluido fino a targetTime così il replay continuo non si blocca a metà candela
        finalTime = targetTime;
        const newPositions = result.positions ?? (result.position ? [result.position] : []);
        const newPendingOrders = result.pendingOrders ?? (result.pendingOrder ? [result.pendingOrder] : []);
        positionsRef.current = newPositions;
        pendingOrdersRef.current = newPendingOrders;
        setPositions(newPositions);
        setPendingOrders(newPendingOrders);

        if (result.event) {
          pushNotice(result.event.kind, result.event.price);
        }

        if (result.exits && result.exits.length > 0) {
          for (const exit of result.exits) {
            closePositionDirect(exit.position, exit.exitPrice, exit.exitTime ?? exitTimestamp, exit.exitReason);
          }
        } else if (result.exit) {
          closeAt(result.exit.exitPrice, exitTimestamp, result.exit.exitReason);
        }
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
    if (positionsRef.current.length > 0 || pendingOrdersRef.current.length > 0) return cursorRef.current;
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
    setPositions([]);
    positionsRef.current = [];
    setPendingOrders([]);
    pendingOrdersRef.current = [];
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

  // ── Replay Cieco (Blind Mode): l'Operatore non conosce il periodo storico ──
  const blindKey = `traderloading:backtest-blind:${sessionKey.replace(/^backtest-session-/, "")}`;
  const [blindMode, setBlindModeState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(blindKey) === "1"; } catch { return false; }
  });
  const [blindRevealed, setBlindRevealed] = useState(false);
  const setBlindMode = useCallback((value: boolean) => {
    setBlindModeState(value);
    setBlindRevealed(false);
    try {
      if (value) window.localStorage.setItem(blindKey, "1");
      else window.localStorage.removeItem(blindKey);
    } catch { /* Blind mode stays in memory when storage is unavailable. */ }
  }, [blindKey]);
  const toggleBlindMode = useCallback(() => setBlindMode(!blindMode), [blindMode, setBlindMode]);
  const revealBlindPeriod = useCallback(() => setBlindRevealed((value) => !value), []);
  const blindMasked = blindMode && !blindRevealed;

  const warehouseFirst = window_.meta?.warehouse?.firstTs ?? null;
  const warehouseLast = window_.meta?.warehouse?.lastTs ?? null;
  const jumpToRandomDate = useCallback((options?: { blind?: boolean }) => {
    const ts = generateRandomTradingTimestamp(
      warehouseFirst != null ? warehouseFirst + 60 : null,
      warehouseLast != null ? warehouseLast - 30 * 86400 : null,
      normalizedSymbol,
      Math.min(intervalSeconds, 3600),
    );
    if (options?.blind) setBlindMode(true);
    else setBlindRevealed(false);
    jumpToTime(ts);
  }, [warehouseFirst, warehouseLast, normalizedSymbol, intervalSeconds, jumpToTime, setBlindMode]);

  const jumpToYear = useCallback((year: number) => {
    jumpToTime(getYearTradingStart(year, warehouseFirst != null ? warehouseFirst + 60 : null, warehouseLast != null ? warehouseLast + 60 : null));
  }, [jumpToTime, warehouseFirst, warehouseLast]);

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
      if (!currentBar || !cursorReady || executingRef.current || lots <= 0) return;
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
      const nextPositions = [...positionsRef.current, opened];
      positionsRef.current = nextPositions;
      positionRef.current = nextPositions[0] ?? null;
      setPositions(nextPositions);
      setSelectedPositionId(opened.id ?? null);
    },
    [currentBar, cursorReady, lots, normalizedSymbol, riskAmount, ticket.slPips, ticket.tpPips],
  );

  const sell = useCallback(() => buy("sell"), [buy]);

  const placeOrder = useCallback(
    (
      direction: TradeDirection,
      price: number,
      options?: { slPips?: number; tpPips?: number; lots?: number; riskAmount?: number },
    ) => {
      if (!currentBar || !cursorReady || executingRef.current) return;
      if (!Number.isFinite(price) || price <= 0) return;
      const orderLots = options?.lots ?? lots;
      if (orderLots <= 0) return;
      const orderSlPips = options?.slPips ?? ticket.slPips;
      const orderTpPips = options?.tpPips ?? ticket.tpPips;
      const orderRiskAmount = options?.riskAmount ?? riskAmount;
      // Nel protocollo LIMEN tutti i pendenti sono esclusivamente ordini LIMIT (su sconto o premium).
      // Gli ordini Stop breakout non vengono mai usati.
      const kind: "limit" = "limit";
      const size = pipSize(normalizedSymbol);
      const sign = direction === "buy" ? 1 : -1;
      const order: PendingOrder = {
        id: `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        direction,
        kind,
        price,
        stopLoss: orderSlPips > 0 ? price - sign * orderSlPips * size : undefined,
        takeProfit: orderTpPips > 0 ? price + sign * orderTpPips * size : undefined,
        slPips: orderSlPips,
        tpPips: orderTpPips,
        lots: orderLots,
        riskAmount: orderRiskAmount,
        placedTime: replayTimeRef.current ?? currentBar.time,
      };
      const nextPending = [...pendingOrdersRef.current, order];
      pendingOrdersRef.current = nextPending;
      pendingRef.current = nextPending[0] ?? null;
      setPendingOrders(nextPending);
    },
    [currentBar, cursorReady, lots, normalizedSymbol, riskAmount, ticket.slPips, ticket.tpPips],
  );

  const executeDrawingOrder = useCallback(
    (drawing: {
      direction?: TradeDirection;
      orderType?: "limit" | "market";
      entry: { price: number; time: number };
      slPrice: number;
      tpPrice: number;
    }) => {
      if (!currentBar || !cursorReady || executingRef.current) return;
      const dir: TradeDirection = drawing.direction ?? (drawing.tpPrice > drawing.entry.price ? "buy" : "sell");
      const multiplier = getPipMultiplier(normalizedSymbol);
      const slPips = Math.max(1, Math.round(Math.abs(drawing.entry.price - drawing.slPrice) * multiplier * 10) / 10);
      const tpPips = Math.max(1, Math.round(Math.abs(drawing.tpPrice - drawing.entry.price) * multiplier * 10) / 10);
      const drawingLots = computeLots({ riskAmount, slPips, symbol: normalizedSymbol });
      if (drawingLots <= 0) return;

      const pip = 1 / multiplier;
      const explicitLimit = drawing.orderType === "limit";
      const explicitMarket = drawing.orderType === "market";
      // Precision tolerance: 1.5 pips or 0.02% of current price
      const priceTolerance = Math.max(1.5 * pip, currentBar.close * 0.0002);

      // In LIMEN:
      // Se il prezzo corrente ha già raggiunto o oltrepassato il livello del Limit (sconto per Buy, premium per Sell),
      // entra direttamente a Mercato. Altrimenti resta come Buy Limit o Sell Limit in attesa del ritracciamento.
      const isAlreadyAtOrPastLimit =
        dir === "buy"
          ? drawing.entry.price >= currentBar.close - priceTolerance
          : drawing.entry.price <= currentBar.close + priceTolerance;

      const isMarket = explicitMarket || (!explicitLimit && Math.abs(drawing.entry.price - currentBar.close) <= priceTolerance) || isAlreadyAtOrPastLimit;
      if (isMarket) {
        const opened = openPosition({
          direction: dir,
          entryPrice: currentBar.close,
          entryTime: replayTimeRef.current ?? currentBar.time,
          slPips,
          tpPips,
          lots: drawingLots,
          riskAmount,
          symbol: normalizedSymbol,
        });
        const nextPositions = [...positionsRef.current, opened];
        positionsRef.current = nextPositions;
        positionRef.current = nextPositions[0] ?? null;
        setPositions(nextPositions);
        setSelectedPositionId(opened.id ?? null);
      } else {
        placeOrder(dir, drawing.entry.price, { slPips, tpPips, lots: drawingLots, riskAmount });
      }
    },
    [currentBar, cursorReady, normalizedSymbol, placeOrder, riskAmount],
  );

  const cancelOrder = useCallback((orderId?: string) => {
    const nextPending = orderId
      ? pendingOrdersRef.current.filter((o) => o.id !== orderId)
      : [];
    pendingOrdersRef.current = nextPending;
    pendingRef.current = nextPending[0] ?? null;
    setPendingOrders(nextPending);
  }, []);

  const cancelAllOrders = useCallback(() => {
    pendingOrdersRef.current = [];
    pendingRef.current = null;
    setPendingOrders([]);
  }, []);

  const closePositionById = useCallback(
    (positionId: string, exitPrice?: number) => {
      if (!currentBar || executingRef.current || !cursorReady) return;
      const targetPos = positionsRef.current.find((p) => p.id === positionId) ?? positionsRef.current[0];
      if (!targetPos) return;

      closePositionDirect(targetPos, exitPrice ?? currentBar.close, replayTimeRef.current ?? currentBar.time, "manual");
      const nextPositions = positionsRef.current.filter((p) => p.id !== targetPos.id);
      positionsRef.current = nextPositions;
      positionRef.current = nextPositions[0] ?? null;
      setPositions(nextPositions);
    },
    [closePositionDirect, currentBar, cursorReady],
  );

  const closeAllPositions = useCallback(() => {
    if (!currentBar || executingRef.current || !cursorReady) return;
    const currentPositions = positionsRef.current;
    if (currentPositions.length === 0) return;

    for (const pos of currentPositions) {
      closePositionDirect(pos, currentBar.close, replayTimeRef.current ?? currentBar.time, "manual");
    }
    positionsRef.current = [];
    positionRef.current = null;
    setPositions([]);
  }, [closePositionDirect, currentBar, cursorReady]);

  const closeMarket = useCallback(() => {
    if (positionsRef.current.length === 0 || !currentBar || executingRef.current || !cursorReady) return;
    closePositionById(selectedPositionId ?? positionsRef.current[0]?.id ?? "");
  }, [closePositionById, currentBar, cursorReady, selectedPositionId]);

  const partialClose = useCallback(
    (positionId: string, fraction: number, moveToBreakeven?: boolean) => {
      if (!currentBar || executingRef.current || !cursorReady) return;
      const currentPositions = positionsRef.current;
      const targetPos = currentPositions.find((p) => p.id === positionId) ?? currentPositions[0];
      if (!targetPos) return;

      tradeIdRef.current += 1;
      const result = partialClosePosition(targetPos, {
        fraction,
        exitPrice: currentBar.close,
        exitTime: replayTimeRef.current ?? currentBar.time,
        id: tradeIdRef.current,
        symbol: normalizedSymbol,
        costs: costsRef.current,
        moveToBreakeven,
      });

      result.closedTrade.syncId = crypto.randomUUID();
      setTrades((old) => [result.closedTrade, ...old]);

      let nextPositions: OpenPosition[];
      if (result.remainingPosition.lots <= 0.005) {
        nextPositions = currentPositions.filter((p) => p.id !== targetPos.id);
      } else {
        nextPositions = currentPositions.map((p) => (p.id === targetPos.id ? result.remainingPosition : p));
      }

      positionsRef.current = nextPositions;
      positionRef.current = nextPositions[0] ?? null;
      setPositions(nextPositions);
    },
    [currentBar, cursorReady, normalizedSymbol],
  );

  const moveToBreakeven = useCallback((positionId: string) => {
    const nextPositions = positionsRef.current.map((pos) => {
      if (pos.id !== positionId) return pos;
      return {
        ...pos,
        stopLoss: pos.entryPrice,
        slPips: 0,
        breakevenApplied: true,
        hasStop: true,
      };
    });
    positionsRef.current = nextPositions;
    positionRef.current = nextPositions[0] ?? null;
    setPositions(nextPositions);
  }, []);

  const moveAllToBreakeven = useCallback(() => {
    const nextPositions = positionsRef.current.map((pos) => ({
      ...pos,
      stopLoss: pos.entryPrice,
      slPips: 0,
      breakevenApplied: true,
      hasStop: true,
    }));
    positionsRef.current = nextPositions;
    positionRef.current = nextPositions[0] ?? null;
    setPositions(nextPositions);
  }, []);

  const rebalancePositionRisk = useCallback(
    (positionId: string, nextStopLoss: number) => {
      const nextPositions = positionsRef.current.map((pos) => {
        if (pos.id !== positionId) return pos;
        return adaptPositionToStop(pos, nextStopLoss, {
          symbol: normalizedSymbol,
          adaptLots: true,
          targetRiskAmount: pos.riskAmount,
        });
      });
      positionsRef.current = nextPositions;
      positionRef.current = nextPositions[0] ?? null;
      setPositions(nextPositions);
    },
    [normalizedSymbol],
  );

  const updatePositionLevels = useCallback(
    (levels: { stopLoss?: number; takeProfit?: number; entryPrice?: number }, positionId?: string) => {
      if (executingRef.current || !cursorReady) return;
      const multiplier = getPipMultiplier(normalizedSymbol);
      const roundPips = (value: number) => Math.round(value * 10) / 10;
      const targetId = positionId ?? selectedPositionId ?? positionsRef.current[0]?.id;

      const nextPositions = positionsRef.current.map((pos) => {
        if (pos.id !== targetId && positionsRef.current.length > 1) return pos;
        let next = { ...pos, ...levels };
        if (levels.stopLoss != null && ticket.adaptRiskOnSlMove) {
          next = adaptPositionToStop(next, levels.stopLoss, {
            symbol: normalizedSymbol,
            adaptLots: true,
            targetRiskAmount: pos.riskAmount,
          });
        } else {
          next.slPips = roundPips(Math.abs((next.entryPrice - next.stopLoss) * multiplier));
          next.tpPips = roundPips(Math.abs((next.takeProfit - next.entryPrice) * multiplier));
          next.hasStop = true;
        }
        return next;
      });

      positionsRef.current = nextPositions;
      positionRef.current = nextPositions[0] ?? null;
      setPositions(nextPositions);
    },
    [cursorReady, normalizedSymbol, selectedPositionId, ticket.adaptRiskOnSlMove],
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
    const persistNow = () => {
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
            openPosition: positions[0] ?? null,
            pendingOrder: pendingOrders[0] ?? null,
            openPositions: positions,
            pendingOrders,
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
    };

    if (!playing) {
      persistNow();
      return;
    }

    const timer = window.setTimeout(persistNow, 600);
    return () => {
      window.clearTimeout(timer);
    };
  }, [
    playing,
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
    positions,
    pendingOrders,
    ticket,
    settings,
    restored?.initialBalance,
  ]);

  const handleBuy = useCallback(() => buy("buy"), [buy]);

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
    positions,
    setPositions,
    pendingOrders,
    setPendingOrders,
    selectedPositionId,
    setSelectedPositionId,
    pickingOrderPrice,
    setPickingOrderPrice,
    pickedPrice,
    setPickedPrice,
    totalExposureLots,
    openProfit: totalOpenProfit,
    openPips: totalOpenPips,
    account,
    stats,
    ticket,
    setTicket,
    riskAmount,
    lots,
    rr,
    settings,
    setSettings,
    chartPreferences,
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
    jumpToYear,
    jumpToRandomDate,
    blindMode,
    blindRevealed,
    blindMasked,
    setBlindMode,
    toggleBlindMode,
    revealBlindPeriod,
    retryHistory,
    ensureHistoryBefore: window_.ensureBefore,
    changeInterval,
    changeSpeed,
    bumpSpeed,
    buy: handleBuy,
    sell,
    placeOrder,
    executeDrawingOrder,
    partialClose,
    moveToBreakeven,
    moveAllToBreakeven,
    rebalancePositionRisk,
    closePositionById,
    closeAllPositions,
    cancelOrder,
    cancelAllOrders,
    closeMarket,
    updatePositionLevels,
    deleteTrade,
    setTradeTags,
    source: window_.source,
    hoveredTradeId,
    setHoveredTradeId,
  };
}

export type ReplayEngine = ReturnType<typeof useReplayEngine>;
