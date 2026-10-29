import {
  getReplayCandlesFromCache,
  saveReplayCandlesToCache,
} from "./replayCandlesCache";
import { findMatchingOfflineReplayBuffer } from "./replayOfflineBuffer";

export type ReplayCandleRaw = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export type ReplayCandlesResponse = {
  candles: ReplayCandleRaw[];
  source?: string;
  /** Cursor for the next page when the response was truncated by `limit`. */
  nextFrom?: number;
  partialCandle?: ReplayCandleRaw | null;
  replayTime?: number;
  /** Last observed canonical M1 close, exclusive, across every derived interval. */
  availableTo?: number;
};

export type ReplayCandlesMeta = {
  symbol: string;
  warehouseEnabled: boolean;
  /** M1 ingestion bounds (bounds every derived timeframe), null when unavailable. */
  warehouse: { firstTs: number | null; lastTs: number | null } | null;
  source?: string;
  instrument?: string | null;
  coverage?: {
    status: "verified" | "partial" | "unavailable";
    candleCount: number;
    targetFrom: number;
    targetTo: number;
    verifiedRanges: { from: number; to: number }[];
    missingDays: string[];
    missingDayCount: number;
    lastImportedAt: string | null;
    lastImportStatus?: "idle" | "running" | "verified" | "failed";
    lastImportReason?: "rate_limited" | "network_unavailable" | "source_empty" | "invalid_data" | "import_failed" | null;
  };
};

export type ReplayCandlesRequest = {
  symbol: string;
  interval: string;
  startDate?: string;
  /** Cursor paging (unix seconds, inclusive). */
  from?: number;
  to?: number;
  limit?: number;
  /** Strict historical replay: one permanent canonical feed, no live fallback. */
  mode?: "replay";
  anchorTime?: number;
  warmupBars?: number;
  replayTime?: number;
};

function resolveBaseUrl(baseUrl?: string): string {
  const configuredBaseUrl = (import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE;
  return baseUrl ?? configuredBaseUrl?.trim() ?? "";
}

function toUrl(path: string, baseUrl?: string): string {
  const base = resolveBaseUrl(baseUrl);
  return base ? new URL(path, base).toString() : path;
}

export function createReplayCandlesUrl(
  input: ReplayCandlesRequest,
  options: { baseUrl?: string } = {},
): string {
  const params = new URLSearchParams({
    symbol: input.symbol.replace("/", ""),
    interval: input.interval,
  });
  if (input.startDate) params.set("startDate", input.startDate);
  if (input.from != null) params.set("from", String(input.from));
  if (input.to != null) params.set("to", String(input.to));
  if (input.limit != null) params.set("limit", String(input.limit));
  if (input.mode) params.set("mode", input.mode);
  if (input.anchorTime != null) params.set("anchorTime", String(input.anchorTime));
  if (input.warmupBars != null) params.set("warmupBars", String(input.warmupBars));
  if (input.replayTime != null) params.set("replayTime", String(input.replayTime));
  return toUrl("/api/backtest/candles?" + params.toString(), options.baseUrl);
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = "HTTP " + response.status;
    try {
      const body = await response.json() as { error?: unknown };
      if (typeof body.error === "string" && body.error.trim()) message = body.error;
    } catch {
      /* keep HTTP status fallback */
    }
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

export async function fetchReplayCandles(
  input: ReplayCandlesRequest,
  options: { baseUrl?: string; signal?: AbortSignal; skipCache?: boolean } = {},
): Promise<ReplayCandlesResponse> {
  if (!options.skipCache) {
    const cached = await getReplayCandlesFromCache(input);
    if (cached) {
      return cached;
    }
  }

  try {
    const response = await fetch(createReplayCandlesUrl(input, options), { signal: options.signal });
    const result = await parseJsonOrThrow<ReplayCandlesResponse>(response);

    if (!options.skipCache) {
      void saveReplayCandlesToCache(input, result);
    }

    return result;
  } catch (networkErr) {
    // Failover: se la rete fallisce o siamo offline, cerca nel buffer di replay offline resiliente
    try {
      const buffered = await findMatchingOfflineReplayBuffer(input);
      if (buffered && buffered.candles.length > 0) {
        return buffered;
      }
    } catch {
      // Ignora errori di buffer e prosegui con rilancio dell'errore di rete
    }
    throw networkErr;
  }
}

export async function fetchReplayCandlesMeta(
  symbol: string,
  options: { baseUrl?: string; signal?: AbortSignal } = {},
): Promise<ReplayCandlesMeta> {
  const params = new URLSearchParams({ symbol: symbol.replace("/", "") });
  const response = await fetch(toUrl("/api/backtest/candles/meta?" + params.toString(), options.baseUrl), {
    signal: options.signal,
  });
  return parseJsonOrThrow<ReplayCandlesMeta>(response);
}

/** Execution always walks canonical M1, even while the chart displays H4/W1. */
export async function fetchReplayExecutionCandles(
  symbol: string,
  from: number,
  to: number,
  options: { baseUrl?: string; signal?: AbortSignal } = {},
): Promise<ReplayCandleRaw[]> {
  const candles: ReplayCandleRaw[] = [];
  for await (const page of iterateReplayExecutionCandles(symbol, from, to, options)) candles.push(...page);
  return candles;
}

/** Stop fetching as soon as a trade exits, even on a long chart scrub. */
export async function* iterateReplayExecutionCandles(
  symbol: string,
  from: number,
  to: number,
  options: { baseUrl?: string; signal?: AbortSignal } = {},
): AsyncGenerator<ReplayCandleRaw[]> {
  let next = from;
  while (next < to) {
    const page = await fetchReplayCandles({ symbol, interval: "M1", mode: "replay", from: next, to, limit: 5000 }, options);
    yield page.candles.filter((bar) => bar.time >= next && bar.time < to);
    if (page.nextFrom == null) break;
    if (page.nextFrom <= next) throw new Error("Invalid historical candle cursor");
    next = page.nextFrom;
  }
}
