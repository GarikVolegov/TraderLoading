// Behavioural discipline analytics: the recurring leaks that empty retail
// accounts even when the edge is positive. Computed from the same closed-trade
// set as the edge report (see tradeAnalytics.ts) so both share one DB read.
//
// Signals:
//   - stopDiscipline  : how often a losing trade ran worse than its initial -1R
//                       risk (stop widened or removed).
//   - holdTime        : disposition effect — average hold of winners vs losers
//                       (cutting winners early while letting losers run).
//   - overtrading     : do high-volume days pay? expectancy on busy vs calm days.
//   - drawdown        : longest losing streak + max peak-to-trough P&L drawdown.

import { rMultiple, type EdgeTrade } from "./tradeAnalytics.js";

export interface DisciplineStop {
  /** Losing trades with a computable R. */
  losses: number;
  /** Of those, how many ran worse than -1R. */
  lossesBeyond1R: number;
  /** lossesBeyond1R / losses as a percentage 0..100. */
  pct: number;
}

export interface DisciplineHoldTime {
  avgWinnerMinutes: number;
  avgLoserMinutes: number;
}

export interface DisciplineOvertrading {
  medianTradesPerDay: number;
  busiestDayTrades: number;
  /** A day with strictly more trades than this is "busy". */
  busyThreshold: number;
  busyExpectancyR: number | null;
  calmExpectancyR: number | null;
}

export interface DisciplineDrawdown {
  longestLossStreak: number;
  /** Max peak-to-trough drop of cumulative P&L, in account currency (>= 0). */
  maxDrawdown: number;
}

export interface DisciplineReport {
  stopDiscipline: DisciplineStop | null;
  holdTime: DisciplineHoldTime | null;
  overtrading: DisciplineOvertrading | null;
  drawdown: DisciplineDrawdown | null;
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round(values.reduce((acc, v) => acc + v, 0) / values.length);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function holdMinutes(trade: EdgeTrade): number | null {
  if (!trade.openTime || !trade.closeTime) return null;
  const open = new Date(trade.openTime).getTime();
  const close = new Date(trade.closeTime).getTime();
  if (Number.isNaN(open) || Number.isNaN(close) || close < open) return null;
  return Math.round((close - open) / 60_000);
}

function expectancyR(trades: EdgeTrade[]): number | null {
  return mean(trades.map(rMultiple).filter((r): r is number => r !== null));
}

function computeStopDiscipline(trades: EdgeTrade[]): DisciplineStop | null {
  const lossRs = trades
    .map(rMultiple)
    .filter((r): r is number => r !== null && r < 0);
  if (lossRs.length === 0) return null;
  const beyond = lossRs.filter((r) => r < -1).length;
  return {
    losses: lossRs.length,
    lossesBeyond1R: beyond,
    pct: Math.round((beyond / lossRs.length) * 100),
  };
}

function computeHoldTime(trades: EdgeTrade[]): DisciplineHoldTime | null {
  const winners: number[] = [];
  const losers: number[] = [];
  for (const trade of trades) {
    if (typeof trade.profit !== "number") continue;
    const minutes = holdMinutes(trade);
    if (minutes === null) continue;
    if (trade.profit > 0) winners.push(minutes);
    else if (trade.profit < 0) losers.push(minutes);
  }
  const avgWinnerMinutes = mean(winners);
  const avgLoserMinutes = mean(losers);
  if (avgWinnerMinutes === null || avgLoserMinutes === null) return null;
  return { avgWinnerMinutes, avgLoserMinutes };
}

function utcDay(openTime: string): string | null {
  const date = new Date(openTime);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function computeOvertrading(trades: EdgeTrade[]): DisciplineOvertrading | null {
  const byDay = new Map<string, EdgeTrade[]>();
  for (const trade of trades) {
    const day = utcDay(trade.openTime);
    if (day === null) continue;
    const bucket = byDay.get(day);
    if (bucket) bucket.push(trade);
    else byDay.set(day, [trade]);
  }
  if (byDay.size === 0) return null;

  const counts = Array.from(byDay.values(), (group) => group.length);
  const medianPerDay = median(counts);
  const busiest = Math.max(...counts);

  const busy: EdgeTrade[] = [];
  const calm: EdgeTrade[] = [];
  for (const group of byDay.values()) {
    (group.length > medianPerDay ? busy : calm).push(...group);
  }

  return {
    medianTradesPerDay: round(medianPerDay, 1),
    busiestDayTrades: busiest,
    busyThreshold: round(medianPerDay, 1),
    busyExpectancyR: busy.length > 0 ? expectancyR(busy) : null,
    calmExpectancyR: calm.length > 0 ? expectancyR(calm) : null,
  };
}

function computeDrawdown(trades: EdgeTrade[]): DisciplineDrawdown | null {
  const closed = trades
    .filter((t) => typeof t.profit === "number")
    .map((t) => ({ profit: t.profit as number, at: new Date(t.closeTime ?? t.openTime).getTime() }))
    .filter((t) => !Number.isNaN(t.at))
    .sort((a, b) => a.at - b.at);
  if (closed.length === 0) return null;

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let streak = 0;
  let longestLossStreak = 0;

  for (const trade of closed) {
    cumulative += trade.profit;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.max(maxDrawdown, peak - cumulative);
    if (trade.profit < 0) {
      streak += 1;
      longestLossStreak = Math.max(longestLossStreak, streak);
    } else {
      streak = 0;
    }
  }

  return { longestLossStreak, maxDrawdown: round(maxDrawdown) };
}

export function computeDisciplineReport(trades: EdgeTrade[]): DisciplineReport {
  return {
    stopDiscipline: computeStopDiscipline(trades),
    holdTime: computeHoldTime(trades),
    overtrading: computeOvertrading(trades),
    drawdown: computeDrawdown(trades),
  };
}
