/** A verified range means a successful canonical-source import, not 24/7 trading. */
export type VerifiedRange = { from: number; to: number };
export type ImportFailureReason =
  | "rate_limited"
  | "network_unavailable"
  | "source_empty"
  | "invalid_data"
  | "import_failed";

/** Return categories only: stored errors may contain infrastructure details. */
export function importFailureReason(error: string | null): ImportFailureReason | null {
  if (!error) return null;
  if (/HTTP 429|rate.?limit/i.test(error)) return "rate_limited";
  if (/fetch failed|timeout|ECONN|ENOTFOUND|network|HTTP 5\d\d/i.test(error))
    return "network_unavailable";
  if (/no M1 candles|no candles|empty/i.test(error)) return "source_empty";
  if (/invalid|duplicate/i.test(error)) return "invalid_data";
  return "import_failed";
}

export function mergeVerifiedRanges(ranges: VerifiedRange[]): VerifiedRange[] {
  const sorted = ranges.filter((r) => r.from < r.to).sort((a, b) => a.from - b.from);
  const out: VerifiedRange[] = [];
  for (const range of sorted) {
    const last = out[out.length - 1];
    if (last && range.from <= last.to) last.to = Math.max(last.to, range.to);
    else out.push({ ...range });
  }
  return out;
}

export function rangeIsVerified(ranges: VerifiedRange[], from: number, to: number): boolean {
  return (
    from < to && mergeVerifiedRanges(ranges).some((range) => range.from <= from && range.to >= to)
  );
}

export function coverageStatus(
  count: number,
  ranges: VerifiedRange[],
  from: number,
  to: number,
  missingDays: string[],
): "verified" | "partial" | "unavailable" {
  return count === 0
    ? "unavailable"
    : rangeIsVerified(ranges, from, to) && missingDays.length === 0
      ? "verified"
      : "partial";
}

/** Weekends are session closures, not missing data. Weekday holidays remain
 * explicitly suspected gaps; no synthetic bars are inserted to hide them. */
export function missingWeekdays(from: number, to: number, observedDays: Set<string>): string[] {
  const missing: string[] = [];
  const start = new Date(from * 1000);
  let day = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()) / 1000;
  while (day + 86400 <= to) {
    const date = new Date(day * 1000);
    const weekday = date.getUTCDay();
    const label = date.toISOString().slice(0, 10);
    if (weekday > 0 && weekday < 6 && !observedDays.has(label)) missing.push(label);
    day += 86400;
  }
  return missing;
}

/** Validate fetched data before certifying a range. Never write invalid OHLC. */
export function validateImportCandles<
  T extends {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
  },
>(candles: T[], from: number, to: number): T[] {
  const seen = new Set<number>();
  return [...candles]
    .sort((a, b) => a.time - b.time)
    .map((candle) => {
      if (
        !Number.isInteger(candle.time) ||
        candle.time % 60 !== 0 ||
        candle.time < from ||
        candle.time >= to ||
        ![candle.open, candle.high, candle.low, candle.close].every(Number.isFinite) ||
        candle.high < Math.max(candle.open, candle.close) ||
        candle.low > Math.min(candle.open, candle.close) ||
        candle.high < candle.low ||
        (candle.volume !== undefined && (!Number.isFinite(candle.volume) || candle.volume < 0)) ||
        seen.has(candle.time)
      )
        throw new Error("Invalid or duplicate M1 candle in import range");
      seen.add(candle.time);
      return candle;
    });
}
