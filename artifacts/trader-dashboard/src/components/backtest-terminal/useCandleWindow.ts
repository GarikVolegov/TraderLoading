// Strict historical windows anchored to a market timestamp, with forward paging.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchReplayCandles,
  fetchReplayCandlesMeta,
  type ReplayCandlesMeta,
} from "@/lib/replayCandlesApi";
import type { ReplayCandle } from "@/lib/replay/types";

const PAGE_LIMIT = 5000;
const PREFETCH_THRESHOLD = 500;

export interface CandleWindow {
  candles: ReplayCandle[];
  partialCandle: ReplayCandle | null;
  availableTo: number | null;
  loading: boolean;
  appending: boolean;
  error: string | null;
  pageError: string | null;
  meta: ReplayCandlesMeta | null;
  source: string | null;
  hasMore: boolean;
  loadedFor: { symbol: string; interval: string; anchorTime: number | null; requestId: number } | null;
  ensureAhead: (cursor: number) => void;
  ensureBefore: () => void;
}

export function useCandleWindow(symbol: string, interval: string, anchorTime: number | null, requestId = 0): CandleWindow {
  const [candles, setCandles] = useState<ReplayCandle[]>([]);
  const [partialCandle, setPartialCandle] = useState<ReplayCandle | null>(null);
  const [availableTo, setAvailableTo] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [appending, setAppending] = useState(false);
  const [prepending, setPrepending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReplayCandlesMeta | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadedFor, setLoadedFor] = useState<CandleWindow["loadedFor"]>(null);
  const nextFromRef = useRef<number | null>(null);
  const appendingRef = useRef(false);
  const generationRef = useRef(0);
  const appendControllerRef = useRef<AbortController | null>(null);
  const prependControllerRef = useRef<AbortController | null>(null);
  const prependingRef = useRef(false);
  const hasEarlierRef = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    setMeta(null);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = async () => {
      try {
        const result = await fetchReplayCandlesMeta(symbol, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setMeta(result);
        if (result.coverage?.status !== "verified") timer = setTimeout(refresh, 60_000);
      } catch {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 60_000);
      }
    };
    void refresh();
    return () => { controller.abort(); if (timer) clearTimeout(timer); };
  }, [symbol, requestId]);

  useEffect(() => {
    const controller = new AbortController();
    appendControllerRef.current?.abort();
    prependControllerRef.current?.abort();
    prependingRef.current = false;
    hasEarlierRef.current = true;
    setPrepending(false);
    appendingRef.current = false;
    setAppending(false);
    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);
    setPageError(null);
    setAvailableTo(null);
    setHasMore(false);
    nextFromRef.current = null;
    fetchReplayCandles({
      symbol, interval, mode: "replay", limit: PAGE_LIMIT,
      ...(anchorTime != null ? { anchorTime, replayTime: anchorTime, warmupBars: 250 } : {}),
    }, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        setCandles(data.candles);
        setPartialCandle(data.partialCandle ?? null);
        setAvailableTo(data.availableTo ?? null);
        setSource(data.source ?? null);
        nextFromRef.current = data.nextFrom ?? null;
        setHasMore(data.nextFrom != null);
        setLoadedFor({ symbol, interval, anchorTime, requestId });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setCandles([]);
        setPartialCandle(null);
        setLoadedFor({ symbol, interval, anchorTime, requestId });
        setLoading(false);
      });
    return () => {
      controller.abort();
      appendControllerRef.current?.abort();
      prependControllerRef.current?.abort();
    };
  }, [symbol, interval, anchorTime, requestId]);

  const ensureAhead = useCallback((cursor: number) => {
    const nextFrom = nextFromRef.current;
    if (nextFrom == null || appendingRef.current || candles.length - cursor > PREFETCH_THRESHOLD) return;
    appendingRef.current = true;
    setAppending(true);
    setPageError(null);
    const generation = generationRef.current;
    const controller = new AbortController();
    appendControllerRef.current = controller;
    fetchReplayCandles({ symbol, interval, mode: "replay", from: nextFrom, limit: PAGE_LIMIT }, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        if (data.availableTo != null) setAvailableTo(data.availableTo);
        nextFromRef.current = data.nextFrom ?? null;
        setHasMore(data.nextFrom != null);
        if (data.candles.length > 0) setCandles((prev) => {
          const lastTime = prev.length > 0 ? prev[prev.length - 1].time : -Infinity;
          const fresh = data.candles.filter((candle) => candle.time > lastTime);
          return fresh.length > 0 ? [...prev, ...fresh] : prev;
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        setPageError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (generation !== generationRef.current) return;
        appendingRef.current = false;
        setAppending(false);
      });
  }, [candles.length, symbol, interval]);

  const firstTime = candles[0]?.time;
  const firstAvailable = meta?.warehouse?.firstTs;
  const ensureBefore = useCallback(() => {
    if (firstTime == null || loading || prependingRef.current || !hasEarlierRef.current ||
        !loadedFor || loadedFor.symbol !== symbol || loadedFor.interval !== interval ||
        loadedFor.anchorTime !== anchorTime || loadedFor.requestId !== requestId ||
        (firstAvailable != null && firstTime <= firstAvailable)) return;
    const controller = new AbortController();
    prependControllerRef.current = controller;
    prependingRef.current = true;
    setPrepending(true);
    const generation = generationRef.current;
    fetchReplayCandles({ symbol, interval, mode: "replay", to: firstTime, limit: PAGE_LIMIT }, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        if (data.candles.length === 0) { hasEarlierRef.current = false; return; }
        setCandles((previous) => {
          const oldest = previous[0]?.time ?? Infinity;
          const older = data.candles.filter((candle) => candle.time < oldest);
          return older.length ? [...older, ...previous] : previous;
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        if ((error as { status?: number })?.status === 409) hasEarlierRef.current = false;
        else setPageError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (generation !== generationRef.current) return;
        prependingRef.current = false;
        setPrepending(false);
      });
  }, [anchorTime, firstAvailable, firstTime, interval, loadedFor, loading, requestId, symbol]);

  return { candles, partialCandle, availableTo, loading, appending: appending || prepending, error, pageError, meta, source, hasMore, loadedFor, ensureAhead, ensureBefore };
}
