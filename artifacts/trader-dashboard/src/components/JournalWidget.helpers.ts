import { isSameDay, isWithinInterval, parseISO, startOfDay, subDays } from "date-fns";
import { parseTradeContent } from "../lib/parseTradeContent.js";

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

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getJournalEntryNetPnl(entry: JournalWidgetEntry | null | undefined): number | null {
  const parsed = parseTradeContent(entry?.content);
  if (!parsed || typeof parsed.profit !== "number") return null;
  return round2(parsed.profit + (parsed.commission ?? 0) + (parsed.swap ?? 0));
}

export function getJournalEntryEffectiveResult(entry: JournalWidgetEntry | null | undefined): string {
  const netPnl = getJournalEntryNetPnl(entry);
  if (netPnl == null) return entry?.result ?? "none";
  if (netPnl > 0) return "win";
  if (netPnl < 0) return "loss";
  return "breakeven";
}

function getComparableEntryDate(entry: JournalWidgetEntry): Date | null {
  return safeParseJournalDate(entry.tradeDate) ?? safeParseJournalDate(entry.createdAt);
}

export function getJournalWidgetSummary(
  entries: JournalWidgetEntry[] | undefined,
  now: Date = new Date(),
): JournalWidgetSummary {
  const list = entries ?? [];
  const rangeStart = startOfDay(subDays(now, 7));
  const rangeEnd = now;

  const validTradeDates = list
    .map((entry) => ({ entry, date: safeParseJournalDate(entry.tradeDate) }))
    .filter((item): item is { entry: JournalWidgetEntry; date: Date } => item.date !== null);

  const todayCount = validTradeDates.filter(({ date }) => isSameDay(date, now)).length;
  const weeklyEntries = validTradeDates
    .filter(({ date }) => isWithinInterval(date, { start: rangeStart, end: rangeEnd }))
    .map(({ entry }) => entry);

  const wins = weeklyEntries.filter((entry) => getJournalEntryEffectiveResult(entry) === "win").length;
  const losses = weeklyEntries.filter((entry) => getJournalEntryEffectiveResult(entry) === "loss").length;
  const breakevens = weeklyEntries.filter((entry) => getJournalEntryEffectiveResult(entry) === "breakeven").length;
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
