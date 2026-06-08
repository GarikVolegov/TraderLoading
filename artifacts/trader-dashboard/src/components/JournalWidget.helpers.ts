import { endOfWeek, isSameDay, isWithinInterval, parseISO, startOfWeek } from "date-fns";

export type JournalWidgetEntry = {
  id: number;
  title: string;
  content: string;
  tradeDate: string;
  result: string;
  tags: string | null;
  images: Array<{ id: number; url: string }>;
  createdAt: string;
  updatedAt: string;
};

export type JournalResultTone = "success" | "danger" | "warning" | "muted";

export type JournalWidgetSummary = {
  todayCount: number;
  weekly: {
    total: number;
    wins: number;
    losses: number;
    breakevens: number;
    winRate: number;
  };
  latestEntry: JournalWidgetEntry | null;
};

export function safeParseJournalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getJournalResultMeta(result: string): { label: string; tone: JournalResultTone } {
  if (result === "win") return { label: "Win", tone: "success" };
  if (result === "loss") return { label: "Loss", tone: "danger" };
  if (result === "breakeven") return { label: "Break Even", tone: "warning" };
  return { label: "Non segnato", tone: "muted" };
}

function getComparableEntryDate(entry: JournalWidgetEntry): Date | null {
  return safeParseJournalDate(entry.tradeDate) ?? safeParseJournalDate(entry.createdAt);
}

export function getJournalWidgetSummary(
  entries: JournalWidgetEntry[] | undefined,
  now: Date = new Date(),
): JournalWidgetSummary {
  const list = entries ?? [];
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const validTradeDates = list
    .map((entry) => ({ entry, date: safeParseJournalDate(entry.tradeDate) }))
    .filter((item): item is { entry: JournalWidgetEntry; date: Date } => item.date !== null);

  const todayCount = validTradeDates.filter(({ date }) => isSameDay(date, now)).length;
  const weeklyEntries = validTradeDates
    .filter(({ date }) => isWithinInterval(date, { start: weekStart, end: weekEnd }))
    .map(({ entry }) => entry);

  const wins = weeklyEntries.filter((entry) => entry.result === "win").length;
  const losses = weeklyEntries.filter((entry) => entry.result === "loss").length;
  const breakevens = weeklyEntries.filter((entry) => entry.result === "breakeven").length;
  const total = weeklyEntries.length;

  const latestEntry = [...list].sort((a, b) => {
    const aDate = getComparableEntryDate(a)?.getTime() ?? 0;
    const bDate = getComparableEntryDate(b)?.getTime() ?? 0;
    return bDate - aDate;
  })[0] ?? null;

  return {
    todayCount,
    weekly: {
      total,
      wins,
      losses,
      breakevens,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    },
    latestEntry,
  };
}
