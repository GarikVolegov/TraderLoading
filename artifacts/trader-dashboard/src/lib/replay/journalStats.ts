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
}

export function computeJournalStats(trades: ClosedTrade[]): JournalStats {
  let wins = 0;
  let losses = 0;
  let breakevens = 0;
  let netR = 0;
  let sizedCount = 0;
  let totalPips = 0;
  let totalProfit = 0;

  for (const trade of trades) {
    if (trade.result === "win") wins += 1;
    else if (trade.result === "loss") losses += 1;
    else breakevens += 1;
    if (trade.rMultiple != null) {
      netR += trade.rMultiple;
      sizedCount += 1;
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
  };
}
