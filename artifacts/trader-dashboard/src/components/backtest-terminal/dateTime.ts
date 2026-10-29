/** Native datetime-local values are interpreted explicitly as UTC, never browser time. */
export function utcDateTimeInput(timestamp: number | null | undefined): string {
  return timestamp != null && Number.isFinite(timestamp)
    ? new Date(timestamp * 1000).toISOString().slice(0, 16)
    : "";
}

export function parseUtcDateTimeInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const millis = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(millis)) return null;
  // Date.parse normalizes impossible dates (e.g. 30 February): reject those.
  if (new Date(millis).toISOString().slice(0, 16) !== value) return null;
  return Math.floor(millis / 1000);
}

export function formatRomeReplayTime(timestamp: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "Europe/Rome", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(new Date(timestamp * 1000));
}

export const formatUtcReplayTime = formatRomeReplayTime;

const blindTimeFormatter = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

/** Format for Blind Replay Mode: hides year, month, and day until explicitly unmasked. */
export function formatBlindTimeOnly(timestamp: number): string {
  return blindTimeFormatter.format(new Date(timestamp * 1000));
}

export function formatBlindReplayDisplay(timestamp: number, isRevealed: boolean, locale: string): string {
  if (isRevealed) {
    return formatRomeReplayTime(timestamp, locale);
  }
  const timeStr = formatBlindTimeOnly(timestamp);
  return `CIECA · ${timeStr} CET [DATA NASCOSTA]`;
}

/**
 * Returns the timestamp for the first active Monday trading session of a given year (08:00 UTC),
 * clamped to the available data bounds.
 */
export function getYearTradingStart(year: number, firstTs?: number | null, lastTs?: number | null): number {
  // First Monday in January of the given year at 08:00 UTC
  const date = new Date(Date.UTC(year, 0, 1, 8, 0, 0));
  while (date.getUTCDay() !== 1) { // 1 = Monday
    date.setUTCDate(date.getUTCDate() + 1);
  }
  const ts = Math.floor(date.getTime() / 1000);
  let clamped = ts;
  if (firstTs != null && clamped < firstTs) clamped = firstTs;
  if (lastTs != null && clamped > lastTs) clamped = lastTs;
  return clamped;
}

/**
 * High-quality random date generator across available historical data.
 * Snaps to active trading sessions (London / NY: 08:00-15:00 UTC), skips weekends,
 * and eliminates hindsight bias for deliberate practice.
 */
export function generateRandomTradingTimestamp(
  firstTs?: number | null,
  lastTs?: number | null,
  symbol?: string,
  intervalSeconds: number = 3600,
): number {
  // Safe bounds: from 2020-01-06 (or firstTs) to 30 days before current time (or lastTs)
  const defaultFirst = 1578297600; // 2020-01-06 08:00:00 UTC (first Monday of 2020)
  const now = Math.floor(Date.now() / 1000);
  const defaultLast = now - 30 * 86400;

  const minTs = Math.max(firstTs ?? defaultFirst, defaultFirst);
  const maxTs = Math.min(lastTs ?? defaultLast, defaultLast);

  const start = Math.min(minTs, maxTs);
  const end = Math.max(minTs, maxTs);
  const span = Math.max(end - start, 86400);

  // Generate candidate
  const candidate = start + Math.floor(Math.random() * span);
  const date = new Date(candidate * 1000);

  // Adjust weekends to Monday
  const day = date.getUTCDay(); // 0 = Sun, 6 = Sat
  if (day === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  } else if (day === 6) {
    date.setUTCDate(date.getUTCDate() + 2);
  }

  // Active trading hour between 08:00 and 15:00 UTC
  const randomHour = 8 + Math.floor(Math.random() * 8); // 8..15
  const randomMinute = [0, 15, 30, 45][Math.floor(Math.random() * 4)];
  date.setUTCHours(randomHour, randomMinute, 0, 0);

  let finalTs = Math.floor(date.getTime() / 1000);

  // Interval alignment
  if (intervalSeconds > 0) {
    finalTs = Math.floor(finalTs / intervalSeconds) * intervalSeconds;
  }

  // Final bounds clamp
  if (firstTs != null && finalTs < firstTs) finalTs = firstTs;
  if (lastTs != null && finalTs > lastTs) finalTs = lastTs;

  return finalTs;
}

