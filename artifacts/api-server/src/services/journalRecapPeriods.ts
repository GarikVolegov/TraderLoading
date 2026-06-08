export type JournalRecapKind = "weekly" | "four_week";

export interface JournalRecapPeriod {
  kind: JournalRecapKind;
  periodStart: string;
  periodEnd: string;
  editWindowStart: string;
  editWindowEnd: string;
}

export const FOUR_WEEK_ANCHOR_ISO = "2026-06-08";
const RECAP_TIME_ZONE = "Europe/Rome";
const MS_PER_DAY = 86_400_000;
const romeDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: RECAP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function recapDay(date: Date): Date {
  const parts = Object.fromEntries(
    romeDateFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
}

function parseIsoDay(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function differenceInUtcDays(later: Date, earlier: Date): number {
  return Math.floor((recapDay(later).getTime() - recapDay(earlier).getTime()) / MS_PER_DAY);
}

function startOfUtcWeek(date: Date): Date {
  const day = recapDay(date);
  const daysSinceMonday = (day.getUTCDay() + 6) % 7;
  return addUtcDays(day, -daysSinceMonday);
}

export function getJournalRecapPeriodForDate(kind: JournalRecapKind, baseDate = new Date()): JournalRecapPeriod {
  const base = recapDay(baseDate);

  if (kind === "weekly") {
    const start = startOfUtcWeek(base);
    const end = addUtcDays(start, 6);
    return {
      kind,
      periodStart: iso(start),
      periodEnd: iso(end),
      editWindowStart: iso(addUtcDays(end, -1)),
      editWindowEnd: iso(end),
    };
  }

  const anchor = parseIsoDay(FOUR_WEEK_ANCHOR_ISO);
  const elapsedDays = Math.max(0, differenceInUtcDays(base, anchor));
  const cycleIndex = Math.floor(elapsedDays / 28);
  const start = addUtcDays(anchor, cycleIndex * 28);
  const end = addUtcDays(start, 27);

  return {
    kind,
    periodStart: iso(start),
    periodEnd: iso(end),
    editWindowStart: iso(addUtcDays(end, -1)),
    editWindowEnd: iso(end),
  };
}

export function isJournalRecapPeriodEditable(period: JournalRecapPeriod, now = new Date()): boolean {
  const current = iso(recapDay(now));
  return current >= period.editWindowStart && current <= period.editWindowEnd;
}

export function validateJournalRecapPeriod(
  kind: JournalRecapKind,
  periodStart: string,
  periodEnd: string,
): boolean {
  const expected = getJournalRecapPeriodForDate(kind, parseIsoDay(periodEnd));
  return expected.periodStart === periodStart && expected.periodEnd === periodEnd;
}
