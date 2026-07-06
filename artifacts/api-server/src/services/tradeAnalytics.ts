// Edge analytics: turns the raw stream of closed broker trades into a verdict.
// Computes expectancy in R, win rate and net profit overall and broken down by
// the dimensions that actually move a trader's edge (symbol, direction, session,
// day of week), plus one behavioural signal (post-loss "revenge" trades).
//
// The R-multiple convention is intentionally identical to the client-side
// `tradeRMultiple` in trader-dashboard/src/lib/parseTradeContent.ts so the same
// trade reads the same R everywhere:
//   R = (|exit - entry| / |entry - stop|) * sign(profit)

import { tradingHour, tradingDayOfWeek } from "../lib/tradingTime.js";
import {
  wilsonInterval,
  kellyFraction,
  rollingExpectancy,
  equityCurve,
  rHistogram,
  type ConfidenceInterval,
  type KellyResult,
  type RollingPoint,
  type EquityPoint,
  type RBucket,
} from "./edgeStats.js";

export interface EdgeTrade {
  symbol: string;
  /** Raw broker direction: "buy"/"sell" or "long"/"short". */
  direction: string;
  /** ISO timestamp of trade open. */
  openTime: string;
  /** ISO timestamp of trade close, when known. */
  closeTime: string | null;
  entryPrice: number | null;
  exitPrice: number | null;
  stopLoss: number | null;
  profit: number | null;
}

/**
 * Net P&L = gross profit + commission + swap (costs, usually negative). Returns
 * null when gross is unknown; missing costs count as zero. The coach classifies
 * wins/losses, R sign, net profit and the cash guard on this net figure so it
 * matches the client diario (which already nets costs) instead of gross profit.
 */
export function netProfit(
  gross: number | null,
  commission: number | null,
  swap: number | null,
): number | null {
  if (gross === null) return null;
  return gross + (commission ?? 0) + (swap ?? 0);
}

export interface EdgeSlice {
  /** Grouping key, e.g. "EURUSD", "long", "Londra", "Lun". */
  label: string;
  trades: number;
  /** Win rate as a percentage 0..100, or null when no P&L is known. */
  winRate: number | null;
  /** Average R per trade over trades with a computable R, or null. */
  expectancyR: number | null;
  netProfit: number;
}

export interface EdgeSliceRef {
  dimension: "symbol" | "direction" | "session" | "dayOfWeek";
  label: string;
  trades: number;
  expectancyR: number;
}

export interface EdgePostLoss {
  /** Trades opened within the revenge window after a losing trade closed. */
  trades: number;
  expectancyR: number | null;
  /** Expectancy of every other trade, for comparison. */
  baselineExpectancyR: number | null;
}

export interface EdgeOverall {
  closedTrades: number;
  /** How many closed trades have a computable R (entry + stop + exit known). */
  tradesWithR: number;
  winRate: number | null;
  expectancyR: number | null;
  avgWinR: number | null;
  avgLossR: number | null;
  profitFactor: number | null;
  netProfit: number;
  avgWin: number | null;
  avgLoss: number | null;
}

export interface EdgeStats {
  /** Wilson 95% CI on the win rate — is the edge statistically real? */
  winRateCI: ConfidenceInterval | null;
  /** Kelly-optimal risk fraction from this edge (full + half). */
  kelly: KellyResult | null;
  /** Rolling expectancy over the trailing window — edge decay. */
  rollingExpectancy: RollingPoint[];
  /** Cumulative net-P&L equity curve, chronological. */
  equityCurve: EquityPoint[];
  /** R-multiple distribution histogram. */
  rHistogram: RBucket[];
}

export interface EdgeReport {
  generatedAt: string;
  overall: EdgeOverall;
  breakdowns: {
    bySymbol: EdgeSlice[];
    byDirection: EdgeSlice[];
    bySession: EdgeSlice[];
    byDayOfWeek: EdgeSlice[];
  };
  highlights: {
    bestSlice: EdgeSliceRef | null;
    worstSlice: EdgeSliceRef | null;
    postLoss: EdgePostLoss | null;
  };
  stats: EdgeStats;
}

const REVENGE_WINDOW_MIN = 120;
/** A slice needs at least this many trades before we trust its expectancy. The
 *  threshold scales with sample size: small accounts surface a highlight at 3
 *  trades, larger ones require up to 5 to filter out noise. */
const MIN_SLICE_TRADES = 3;
const MAX_SLICE_TRADES = 5;

export function minSliceTradesFor(totalTrades: number): number {
  return Math.max(MIN_SLICE_TRADES, Math.min(MAX_SLICE_TRADES, Math.ceil(totalTrades * 0.15)));
}
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"] as const;
const DAY_ORDER = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return round(sum / values.length);
}

export function rMultiple(trade: EdgeTrade): number | null {
  const { profit, entryPrice, stopLoss, exitPrice } = trade;
  if (
    typeof profit !== "number" ||
    typeof entryPrice !== "number" ||
    typeof stopLoss !== "number" ||
    typeof exitPrice !== "number"
  ) {
    return null;
  }
  // A stop of 0 (or negative) is "no stop set" — brokers report 0 when absent —
  // not a real price. Without this, riskDistance = |entry - 0| = |entry| yields a
  // fake tiny R. Matches the client, which discards a 0 price as no stop.
  if (!(stopLoss > 0)) return null;
  const riskDistance = Math.abs(entryPrice - stopLoss);
  const moveDistance = Math.abs(exitPrice - entryPrice);
  if (!(riskDistance > 0) || !(moveDistance > 0)) return null;
  const r = (moveDistance / riskDistance) * Math.sign(profit);
  return Number.isFinite(r) ? round(r) : null;
}

export function normalizeDirection(direction: string): "long" | "short" | null {
  const value = direction.trim().toLowerCase();
  if (value === "buy" || value === "long") return "long";
  if (value === "sell" || value === "short") return "short";
  return null;
}

/** Open hour (Europe/Rome) → trading session bucket. */
export function sessionForTrade(openTime: string): string | null {
  const hour = tradingHour(new Date(openTime));
  if (hour === null) return null;
  if (hour < 7) return "Asia";
  if (hour < 12) return "Londra";
  if (hour < 17) return "Londra–NY";
  return "Sera/USA";
}

function dayOfWeekForTrade(openTime: string): string | null {
  const dow = tradingDayOfWeek(new Date(openTime));
  return dow === null ? null : DAY_LABELS[dow];
}

function buildSlice(label: string, trades: EdgeTrade[]): EdgeSlice {
  const withProfit = trades.filter((t) => typeof t.profit === "number");
  const wins = withProfit.filter((t) => (t.profit as number) > 0).length;
  const rValues = trades
    .map(rMultiple)
    .filter((r): r is number => r !== null);
  const netProfit = withProfit.reduce((acc, t) => acc + (t.profit as number), 0);

  return {
    label,
    trades: trades.length,
    winRate: withProfit.length > 0 ? Math.round((wins / withProfit.length) * 100) : null,
    expectancyR: mean(rValues),
    netProfit: round(netProfit),
  };
}

function groupBy(
  trades: EdgeTrade[],
  keyOf: (trade: EdgeTrade) => string | null,
): EdgeSlice[] {
  const groups = new Map<string, EdgeTrade[]>();
  for (const trade of trades) {
    const key = keyOf(trade);
    if (key === null) continue;
    const bucket = groups.get(key);
    if (bucket) bucket.push(trade);
    else groups.set(key, [trade]);
  }
  return Array.from(groups.entries()).map(([label, group]) => buildSlice(label, group));
}

/** Flags trades opened within REVENGE_WINDOW_MIN of a losing trade's close. */
function postLossSignal(trades: EdgeTrade[]): EdgePostLoss | null {
  const lossCloses = trades
    .filter((t) => typeof t.profit === "number" && (t.profit as number) < 0 && t.closeTime)
    .map((t) => new Date(t.closeTime as string).getTime())
    .filter((ms) => !Number.isNaN(ms));
  if (lossCloses.length === 0) return null;

  const windowMs = REVENGE_WINDOW_MIN * 60_000;
  const revenge: EdgeTrade[] = [];
  const baseline: EdgeTrade[] = [];

  for (const trade of trades) {
    const openMs = new Date(trade.openTime).getTime();
    if (Number.isNaN(openMs)) {
      baseline.push(trade);
      continue;
    }
    const isRevenge = lossCloses.some((closeMs) => openMs > closeMs && openMs - closeMs <= windowMs);
    (isRevenge ? revenge : baseline).push(trade);
  }

  if (revenge.length === 0) return null;

  const rOf = (group: EdgeTrade[]) =>
    mean(group.map(rMultiple).filter((r): r is number => r !== null));

  return {
    trades: revenge.length,
    expectancyR: rOf(revenge),
    baselineExpectancyR: rOf(baseline),
  };
}

function pickHighlights(
  breakdowns: EdgeReport["breakdowns"],
  minTrades: number,
): { bestSlice: EdgeSliceRef | null; worstSlice: EdgeSliceRef | null } {
  const candidates: EdgeSliceRef[] = [];
  const dims: Array<[EdgeSliceRef["dimension"], EdgeSlice[]]> = [
    ["symbol", breakdowns.bySymbol],
    ["direction", breakdowns.byDirection],
    ["session", breakdowns.bySession],
    ["dayOfWeek", breakdowns.byDayOfWeek],
  ];
  for (const [dimension, slices] of dims) {
    for (const slice of slices) {
      if (slice.trades >= minTrades && slice.expectancyR !== null) {
        candidates.push({ dimension, label: slice.label, trades: slice.trades, expectancyR: slice.expectancyR });
      }
    }
  }
  if (candidates.length === 0) return { bestSlice: null, worstSlice: null };

  let best = candidates[0];
  let worst = candidates[0];
  for (const candidate of candidates) {
    if (candidate.expectancyR > best.expectancyR) best = candidate;
    if (candidate.expectancyR < worst.expectancyR) worst = candidate;
  }
  return { bestSlice: best, worstSlice: best === worst ? null : worst };
}

export function computeEdgeReport(trades: EdgeTrade[], now: Date = new Date()): EdgeReport {
  const withProfit = trades.filter((t) => typeof t.profit === "number");
  const rValues = trades.map(rMultiple).filter((r): r is number => r !== null);
  const winRs = rValues.filter((r) => r > 0);
  const lossRs = rValues.filter((r) => r < 0);

  const winnings = withProfit.filter((t) => (t.profit as number) > 0).map((t) => t.profit as number);
  const losses = withProfit.filter((t) => (t.profit as number) < 0).map((t) => t.profit as number);
  const grossLoss = losses.reduce((acc, p) => acc + Math.abs(p), 0);
  const grossWin = winnings.reduce((acc, p) => acc + p, 0);

  const overall: EdgeOverall = {
    closedTrades: trades.length,
    tradesWithR: rValues.length,
    winRate: withProfit.length > 0 ? Math.round((winnings.length / withProfit.length) * 100) : null,
    expectancyR: mean(rValues),
    avgWinR: mean(winRs),
    avgLossR: mean(lossRs),
    profitFactor: grossLoss > 0 ? round(grossWin / grossLoss) : null,
    netProfit: round(withProfit.reduce((acc, t) => acc + (t.profit as number), 0)),
    avgWin: mean(winnings),
    avgLoss: mean(losses),
  };

  const bySymbol = groupBy(trades, (t) => t.symbol || null).sort((a, b) => b.trades - a.trades);
  const byDirection = groupBy(trades, (t) => normalizeDirection(t.direction));
  const bySession = groupBy(trades, (t) => sessionForTrade(t.openTime));
  const byDayOfWeek = groupBy(trades, (t) => dayOfWeekForTrade(t.openTime)).sort(
    (a, b) => DAY_ORDER.indexOf(a.label) - DAY_ORDER.indexOf(b.label),
  );

  const breakdowns = { bySymbol, byDirection, bySession, byDayOfWeek };
  const { bestSlice, worstSlice } = pickHighlights(breakdowns, minSliceTradesFor(trades.length));

  const scored = withProfit.length;
  const winRateFraction = scored > 0 ? winnings.length / scored : null;
  const rollingWindow = Math.max(5, Math.min(20, Math.round(rValues.length / 4)));
  const orderedProfits = withProfit
    .slice()
    .sort((a, b) => new Date(a.closeTime ?? a.openTime).getTime() - new Date(b.closeTime ?? b.openTime).getTime())
    .map((t) => t.profit as number);
  const stats: EdgeStats = {
    winRateCI: wilsonInterval(winnings.length, scored),
    kelly: kellyFraction(winRateFraction, overall.avgWinR, overall.avgLossR),
    rollingExpectancy: rollingExpectancy(rValues, rollingWindow),
    equityCurve: equityCurve(orderedProfits),
    rHistogram: rHistogram(rValues),
  };

  return {
    generatedAt: now.toISOString(),
    overall,
    breakdowns,
    highlights: { bestSlice, worstSlice, postLoss: postLossSignal(trades) },
    stats,
  };
}
