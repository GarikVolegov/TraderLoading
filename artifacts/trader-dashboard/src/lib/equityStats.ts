// Statistiche equity calcolate client-side dai trade importati nel diario
// (contenuto parsato da parseTradeContent). Nessuna chiamata API aggiuntiva.

import { parseTradeContent } from "./parseTradeContent";

export interface EquityEntryInput {
  tradeDate: string;
  content?: string | null;
  tags?: string | null;
}

export interface EquityPoint {
  /** Giorno (yyyy-mm-dd). */
  date: string;
  /** P&L del giorno. */
  pnl: number;
  /** P&L cumulativo fino a questo giorno incluso. */
  cumulative: number;
}

export interface EquityStats {
  points: EquityPoint[];
  totalPnl: number;
  tradeCount: number;
  currency: string | null;
  bestDay: EquityPoint | null;
  worstDay: EquityPoint | null;
  /** Massimo drawdown sul cumulativo (valore <= 0). */
  maxDrawdown: number;
}

function isImportedTrade(entry: EquityEntryInput): boolean {
  const tags = (entry.tags ?? "").toLowerCase();
  return tags.includes("account-import") || tags.includes("fxblue");
}

/**
 * Aggrega i trade importati in una serie equity giornaliera cumulativa.
 * Le note manuali e i contenuti non parsabili vengono ignorati.
 */
export function computeEquityStats(entries: EquityEntryInput[] | undefined): EquityStats {
  const empty: EquityStats = {
    points: [],
    totalPnl: 0,
    tradeCount: 0,
    currency: null,
    bestDay: null,
    worstDay: null,
    maxDrawdown: 0,
  };
  if (!entries?.length) return empty;

  const dailyPnl = new Map<string, number>();
  let tradeCount = 0;
  let currency: string | null = null;

  for (const entry of entries) {
    if (!isImportedTrade(entry)) continue;
    const parsed = parseTradeContent(entry.content);
    if (!parsed || typeof parsed.profit !== "number") continue;

    const day = entry.tradeDate.slice(0, 10);
    if (!day) continue;
    const net = parsed.profit + (parsed.commission ?? 0) + (parsed.swap ?? 0);
    dailyPnl.set(day, (dailyPnl.get(day) ?? 0) + net);
    tradeCount++;
    if (!currency && parsed.currency) currency = parsed.currency;
  }

  if (tradeCount === 0) return empty;

  const sortedDays = [...dailyPnl.keys()].sort();
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const points: EquityPoint[] = [];

  for (const date of sortedDays) {
    const pnl = round2(dailyPnl.get(date) ?? 0);
    cumulative = round2(cumulative + pnl);
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, round2(cumulative - peak));
    points.push({ date, pnl, cumulative });
  }

  let bestDay: EquityPoint | null = null;
  let worstDay: EquityPoint | null = null;
  for (const point of points) {
    if (!bestDay || point.pnl > bestDay.pnl) bestDay = point;
    if (!worstDay || point.pnl < worstDay.pnl) worstDay = point;
  }

  return {
    points,
    totalPnl: round2(cumulative),
    tradeCount,
    currency,
    bestDay,
    worstDay,
    maxDrawdown,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Filtra le entry per finestra temporale (giorni indietro da oggi; null = tutte). */
export function filterEntriesByDays<T extends EquityEntryInput>(
  entries: T[] | undefined,
  days: number | null,
): T[] {
  if (!entries?.length) return [];
  if (days == null) return entries;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  return entries.filter((entry) => {
    const date = new Date(entry.tradeDate);
    return !Number.isNaN(date.getTime()) && date >= cutoff;
  });
}
