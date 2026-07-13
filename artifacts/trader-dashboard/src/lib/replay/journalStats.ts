// ─── Journal stats ───────────────────────────────────────────────────────────
// Aggregates for the terminal's journal panel: Win Rate, Net R and Expectancy
// (mean R). R aggregates only cover sized trades (rMultiple != null) — a trade
// without a stop has no risk unit, so counting it as 0 R would skew the mean.
import type { ClosedTrade } from "./types";

export interface JournalStats {
  total: number;
  wins: number;
  losses: number;
  breakevens: number;
  /** Percent of all trades that are wins (0–100, rounded). */
  winRate: number;
  /** Sum of R multiples over sized trades. */
  netR: number;
  /** Mean R over sized trades, null when none are sized. */
  expectancy: number | null;
  totalPips: number;
  totalProfit: number;
  /** Mean max adverse excursion in R over tracked trades, null when none. */
  avgMaeR: number | null;
  /** Mean max favorable excursion in R over tracked trades, null when none. */
  avgMfeR: number | null;
}

export function computeJournalStats(trades: ClosedTrade[]): JournalStats {
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let netR = 0;
  let sizedCount = 0;
  let totalPips = 0;
  let totalProfit = 0;
  let maeSum = 0;
  let mfeSum = 0;
  let excursionCount = 0;

  for (const trade of trades) {
    if (trade.result === "win") wins += 1;
    else if (trade.result === "loss") losses += 1;
    else breakevens += 1;
    if (trade.rMultiple != null) {
      netR += trade.rMultiple;
      sizedCount += 1;
    }
    if (trade.maeR != null && trade.mfeR != null) {
      maeSum += trade.maeR;
      mfeSum += trade.mfeR;
      excursionCount += 1;
    }
    totalPips += trade.pips;
    totalProfit += trade.profit;
  }

  const total = trades.length;
  return {
    total,
    wins,
    losses,
    breakevens,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    netR,
    expectancy: sizedCount > 0 ? netR / sizedCount : null,
    totalPips: Math.round(totalPips * 10) / 10,
    totalProfit,
    avgMaeR: excursionCount > 0 ? Math.round((maeSum / excursionCount) * 100) / 100 : null,
    avgMfeR: excursionCount > 0 ? Math.round((mfeSum / excursionCount) * 100) / 100 : null,
  };
}

/** All distinct tags across the trades, unique and sorted, empties ignored. */
export function collectTags(trades: ClosedTrade[]): string[] {
  const set = new Set<string>();
  for (const trade of trades) {
    for (const tag of trade.tags ?? []) {
      const trimmed = tag.trim();
      if (trimmed !== "") set.add(trimmed);
    }
  }
  return [...set].sort();
}

/** Trades carrying at least one of the selected tags (OR); empty selection = all. */
export function filterTradesByTags(trades: ClosedTrade[], selected: string[]): ClosedTrade[] {
  if (selected.length === 0) return trades;
  const wanted = new Set(selected);
  return trades.filter((trade) => (trade.tags ?? []).some((tag) => wanted.has(tag)));
}

export interface TagStat {
  tag: string;
  count: number;
  netR: number;
}

/** Count + net R per tag, sorted by count desc then tag asc. */
export function statsByTag(trades: ClosedTrade[]): TagStat[] {
  const map = new Map<string, TagStat>();
  for (const trade of trades) {
    for (const tag of trade.tags ?? []) {
      const trimmed = tag.trim();
      if (trimmed === "") continue;
      const entry = map.get(trimmed) ?? { tag: trimmed, count: 0, netR: 0 };
      entry.count += 1;
      entry.netR = Math.round((entry.netR + (trade.rMultiple ?? 0)) * 100) / 100;
      map.set(trimmed, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export interface TimeBucket {
  /** Hour 0–23 (UTC) or weekday 0–6 (0 = Sunday, UTC). */
  bucket: number;
  count: number;
  netR: number;
}

/**
 * Session-analytics buckets over the closed trades, keyed by ENTRY time (UTC):
 * when the user trades, and how those slots perform in R. Only populated
 * buckets are returned, ascending.
 */
export function computeTimeBuckets(trades: ClosedTrade[]): { byHour: TimeBucket[]; byWeekday: TimeBucket[] } {
  const hours = new Map<number, TimeBucket>();
  const weekdays = new Map<number, TimeBucket>();
  const add = (map: Map<number, TimeBucket>, bucket: number, r: number | null) => {
    const entry = map.get(bucket) ?? { bucket, count: 0, netR: 0 };
    entry.count += 1;
    entry.netR = Math.round((entry.netR + (r ?? 0)) * 100) / 100;
    map.set(bucket, entry);
  };
  for (const trade of trades) {
    const date = new Date(trade.entryTime * 1000);
    add(hours, date.getUTCHours(), trade.rMultiple);
    add(weekdays, date.getUTCDay(), trade.rMultiple);
  }
  const ascending = (a: TimeBucket, b: TimeBucket) => a.bucket - b.bucket;
  return { byHour: [...hours.values()].sort(ascending), byWeekday: [...weekdays.values()].sort(ascending) };
}
