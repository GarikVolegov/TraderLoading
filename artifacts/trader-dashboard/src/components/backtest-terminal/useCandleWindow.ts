// ─── Candle window data hook ─────────────────────────────────────────────────
// Loads the active-timeframe series for the terminal: availability meta once
// per symbol, the initial page on (interval, startDate) change, and forward
// pages (cursor paging via `nextFrom`) prefetched in the background before the
// replay cursor reaches the end of the loaded window.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchReplayCandles,
  fetchReplayCandlesMeta,
  type ReplayCandlesMeta,
} from "@/lib/replayCandlesApi";
import type { ReplayCandle } from "@/lib/replay/types";

const PAGE_LIMIT = 5000;
/** Prefetch the next page when fewer bars than this remain ahead of the cursor. */
const PREFETCH_THRESHOLD = 500;

export interface CandleWindow {
  candles: ReplayCandle[];
  loading: boolean;
  /** True while a forward page is being appended. */
  appending: boolean;
  error: string | null;
  meta: ReplayCandlesMeta | null;
  source: string | null;
  /** True when a further page exists past the loaded window. */
  hasMore: boolean;
  /**
   * Request identity of the currently loaded window. Consumers must ignore the
   * data (e.g. for cursor placement) until this matches their current request —
   * effects can otherwise observe the previous window in the same commit.
   */
  loadedFor: { symbol: string; interval: string; startDate: string | null } | null;
  /** Prefetch the next page when the cursor is close to the loaded end. */
  ensureAhead: (cursor: number) => void;
}

export function useCandleWindow(symbol: string, interval: string, startDate: string | null): CandleWindow {
  const [candles, setCandles] = useState<ReplayCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [appending, setAppending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReplayCandlesMeta | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadedFor, setLoadedFor] = useState<CandleWindow["loadedFor"]>(null);
  const nextFromRef = useRef<number | null>(null);
  const appendingRef = useRef(false);
  const generationRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchReplayCandlesMeta(symbol, { signal: controller.signal })
      .then((result) => setMeta(result))
      .catch(() => setMeta(null));
    return () => controller.abort();
  }, [symbol]);

  useEffect(() => {
    const controller = new AbortController();
    const generation = ++generationRef.current;
    setLoading(true);
    setError(null);
    nextFromRef.current = null;

    fetchReplayCandles(
      { symbol, interval, startDate: startDate || undefined, limit: PAGE_LIMIT },
      { signal: controller.signal },
    )
      .then((data) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        setCandles(data.candles);
        setSource(data.source ?? null);
        nextFromRef.current = data.nextFrom ?? null;
        setHasMore(data.nextFrom != null);
        setLoadedFor({ symbol, interval, startDate });
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || generation !== generationRef.current) return;
        setError(err instanceof Error ? err.message : String(err));
        setCandles([]);
        setLoadedFor({ symbol, interval, startDate });
        setLoading(false);
      });

    return () => controller.abort();
  }, [symbol, interval, startDate]);

  const ensureAhead = useCallback(
    (cursor: number) => {
      const nextFrom = nextFromRef.current;
      if (nextFrom == null || appendingRef.current) return;
      if (candles.length - cursor > PREFETCH_THRESHOLD) return;

      appendingRef.current = true;
      setAppending(true);
      const generation = generationRef.current;
      fetchReplayCandles({ symbol, interval, from: nextFrom, limit: PAGE_LIMIT })
        .then((data) => {
          if (generation !== generationRef.current) return;
          nextFromRef.current = data.nextFrom ?? null;
          setHasMore(data.nextFrom != null);
          if (data.candles.length > 0) {
            setCandles((prev) => {
              const lastTime = prev.length > 0 ? prev[prev.length - 1].time : -Infinity;
              const fresh = data.candles.filter((candle) => candle.time > lastTime);
              return fresh.length > 0 ? [...prev, ...fresh] : prev;
            });
          }
        })
        .catch(() => {
          // Transient page failure: keep the cursor usable on loaded data; the
          // next ensureAhead call retries.
        })
        .finally(() => {
          appendingRef.current = false;
          setAppending(false);
        });
    },
    [candles.length, symbol, interval],
  );

  return {
    candles,
    loading,
    appending,
    error,
    meta,
    source,
    hasMore,
    loadedFor,
    ensureAhead,
  };
}
