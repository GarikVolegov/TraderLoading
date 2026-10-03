export type ReplayCandleRaw = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export type ReplayCandlesResponse = {
  candles: ReplayCandleRaw[];
  source?: string;
  /** Cursor for the next page when the response was truncated by `limit`. */
  nextFrom?: number;
};

export type ReplayCandlesMeta = {
  symbol: string;
  warehouseEnabled: boolean;
  /** M1 ingestion bounds (bounds every derived timeframe), null when unavailable. */
  warehouse: { firstTs: number | null; lastTs: number | null } | null;
};

export type ReplayCandlesRequest = {
  symbol: string;
  interval: string;
  startDate?: string;
  /** Cursor paging (unix seconds, inclusive). */
  from?: number;
  to?: number;
  limit?: number;
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
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function fetchReplayCandles(
  input: ReplayCandlesRequest,
  options: { baseUrl?: string; signal?: AbortSignal } = {},
): Promise<ReplayCandlesResponse> {
  const response = await fetch(createReplayCandlesUrl(input, options), { signal: options.signal });
  return parseJsonOrThrow<ReplayCandlesResponse>(response);
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
