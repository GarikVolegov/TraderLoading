import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

export type JournalRecapKind = "weekly" | "four_week";

export interface JournalRecapPeriod {
  kind: JournalRecapKind;
  periodStart: string;
  periodEnd: string;
  editWindowStart: string;
  editWindowEnd: string;
}

export const FOUR_WEEK_ANCHOR_ISO = "2026-06-08";

function iso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function localDay(date: Date): Date {
  return startOfDay(date);
}

export function getJournalRecapPeriod(kind: JournalRecapKind, baseDate = new Date()): JournalRecapPeriod {
  const base = localDay(baseDate);

  if (kind === "weekly") {
    const start = startOfWeek(base, { weekStartsOn: 1 });
    const end = endOfWeek(base, { weekStartsOn: 1 });
    return {
      kind,
      periodStart: iso(start),
      periodEnd: iso(end),
      editWindowStart: iso(addDays(end, -1)),
      editWindowEnd: iso(end),
    };
  }

  const anchor = parseISO(FOUR_WEEK_ANCHOR_ISO);
  const elapsedDays = Math.max(0, differenceInCalendarDays(base, anchor));
  const cycleIndex = Math.floor(elapsedDays / 28);
  const start = addDays(anchor, cycleIndex * 28);
  const end = addDays(start, 27);

  return {
    kind,
    periodStart: iso(start),
    periodEnd: iso(end),
    editWindowStart: iso(addDays(end, -1)),
    editWindowEnd: iso(end),
  };
}

export function isJournalRecapEditable(period: JournalRecapPeriod, now = new Date()): boolean {
  const day = localDay(now);
  return isWithinInterval(day, {
    start: parseISO(period.editWindowStart),
    end: parseISO(period.editWindowEnd),
  });
}

export function getNextJournalRecapWindow(
  kind: JournalRecapKind,
  now = new Date(),
): Pick<JournalRecapPeriod, "editWindowStart" | "editWindowEnd"> {
  const current = getJournalRecapPeriod(kind, now);
  if (localDay(now).getTime() <= parseISO(current.editWindowEnd).getTime()) {
    return {
      editWindowStart: current.editWindowStart,
      editWindowEnd: current.editWindowEnd,
    };
  }

  const next = getJournalRecapPeriod(kind, addDays(parseISO(current.periodEnd), 1));
  return {
    editWindowStart: next.editWindowStart,
    editWindowEnd: next.editWindowEnd,
  };
}
