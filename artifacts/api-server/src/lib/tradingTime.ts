// Shared day/hour/weekday bucketing in a single trading timezone so the coach
// (edge, discipline, session/day-of-week breakdowns), the risk guard and the
// journal recap all attribute a trade to the SAME day/week. Previously some used
// UTC and some Europe/Rome, so the same near-midnight trade landed in different
// days depending on the function.
export const TRADING_TIME_ZONE = "Europe/Rome";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TRADING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TRADING_TIME_ZONE,
  hour: "2-digit",
  hour12: false,
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** YYYY-MM-DD in the trading timezone, or null for an invalid date. */
export function tradingDay(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return dayFormatter.format(date);
}

/** Hour 0-23 in the trading timezone, or null for an invalid date. */
export function tradingHour(date: Date): number | null {
  if (Number.isNaN(date.getTime())) return null;
  const raw = partsFormatter.formatToParts(date).find((p) => p.type === "hour")?.value;
  const hour = raw === undefined ? Number.NaN : parseInt(raw, 10);
  return Number.isFinite(hour) ? hour % 24 : null;
}

/** Day of week 0-6 (Sun-Sat, like Date.getUTCDay) in the trading timezone. */
export function tradingDayOfWeek(date: Date): number | null {
  if (Number.isNaN(date.getTime())) return null;
  const raw = partsFormatter.formatToParts(date).find((p) => p.type === "weekday")?.value;
  const idx = raw === undefined ? undefined : WEEKDAY_INDEX[raw];
  return idx === undefined ? null : idx;
}
