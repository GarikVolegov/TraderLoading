export type ReplayCandleRaw = { time: number; open: number; high: number; low: number; close: number; volume?: number };

export function createReplayCandlesUrl(input: { symbol: string; interval: string }, options: { baseUrl?: string } = {}): string {
  const path = "/api/backtest/candles?symbol=" + input.symbol.replace("/", "") + "&interval=" + input.interval;
  const configuredBaseUrl = (import.meta as ImportMeta & { env?: { VITE_API_BASE?: string } }).env?.VITE_API_BASE;
  const baseUrl = options.baseUrl ?? configuredBaseUrl?.trim() ?? "";
  return baseUrl ? new URL(path, baseUrl).toString() : path;
}

export async function fetchReplayCandles(
  input: { symbol: string; interval: string },
  options: { baseUrl?: string; signal?: AbortSignal } = {},
): Promise<{ candles: ReplayCandleRaw[] }> {
  const response = await fetch(createReplayCandlesUrl(input, options), { signal: options.signal });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json() as Promise<{ candles: ReplayCandleRaw[] }>;
}