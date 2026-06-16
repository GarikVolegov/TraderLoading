// Risk guard ("circuit-breaker"): evaluates the trader's recent activity against
// account-blowing patterns and returns the breaches that are active *right now*.
// Computed from the same closed-trade set as the edge report; surfaced as a
// banner and re-evaluated on each poll (near-real-time).
//
// Breakers:
//   - daily_loss  : today's net R at/under the daily loss limit.
//   - loss_streak : N+ consecutive losses on the most recent trades.
//   - overtrading : too many trades today.
//   - revenge     : a trade today opened within the revenge window after a loss.

import { rMultiple, type EdgeTrade } from "./tradeAnalytics.js";

export interface RiskGuardConfig {
  maxConsecutiveLosses: number;
  maxDailyTrades: number;
  /** Today's net R at/under -maxDailyLossR triggers the daily-loss breaker. */
  maxDailyLossR: number;
  /** Today's net P&L at/under -maxDailyLossCash (account currency) triggers the
   *  cash daily-loss breaker. From the user's `maxDailyLoss` setting; null = off.
   *  Works without stops, so it catches no-stop blow-ups the R limit misses. */
  maxDailyLossCash: number | null;
  revengeWindowMinutes: number;
  /** Streak/daily breakers only fire if the latest trade is this recent. */
  recencyWindowHours: number;
}

export const DEFAULT_RISK_GUARD_CONFIG: RiskGuardConfig = {
  maxConsecutiveLosses: 3,
  maxDailyTrades: 6,
  maxDailyLossR: 3,
  maxDailyLossCash: null,
  revengeWindowMinutes: 120,
  recencyWindowHours: 48,
};

export type RiskGuardAlertType = "daily_loss" | "daily_loss_cash" | "loss_streak" | "overtrading" | "revenge";

export interface RiskGuardAlert {
  type: RiskGuardAlertType;
  severity: "warning" | "danger";
  value: number;
  threshold: number;
}

export interface RiskGuardReport {
  evaluatedAt: string;
  tradingDay: string;
  todayTrades: number;
  todayNetR: number | null;
  alerts: RiskGuardAlert[];
}

const GUARD_TZ = "Europe/Rome";
const romeDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: GUARD_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function romeDay(date: Date): string | null {
  if (Number.isNaN(date.getTime())) return null;
  return romeDateFormatter.format(date);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function closeMs(trade: EdgeTrade): number {
  return new Date(trade.closeTime ?? trade.openTime).getTime();
}

export function evaluateRiskGuard(
  trades: EdgeTrade[],
  now: Date = new Date(),
  config: RiskGuardConfig = DEFAULT_RISK_GUARD_CONFIG,
): RiskGuardReport {
  const today = romeDay(now);
  const dayOf = (trade: EdgeTrade): string | null => romeDay(new Date(trade.closeTime ?? trade.openTime));
  const todayTradesList = trades.filter((t) => dayOf(t) === today);

  const todayRs = todayTradesList.map(rMultiple).filter((r): r is number => r !== null);
  const todayNetR = todayRs.length > 0 ? round(todayRs.reduce((acc, r) => acc + r, 0)) : null;

  const todayProfits = todayTradesList
    .map((t) => t.profit)
    .filter((p): p is number => typeof p === "number");
  const todayNetProfit = round(todayProfits.reduce((acc, p) => acc + p, 0));

  // Current losing streak: leading consecutive losers from the most recent trade.
  const ordered = trades
    .filter((t) => typeof t.profit === "number" && !Number.isNaN(closeMs(t)))
    .sort((a, b) => closeMs(b) - closeMs(a));
  let lossStreak = 0;
  for (const trade of ordered) {
    if ((trade.profit as number) < 0) lossStreak += 1;
    else break;
  }

  const latestMs = ordered.length > 0 ? closeMs(ordered[0]) : null;
  const recent = latestMs !== null && now.getTime() - latestMs <= config.recencyWindowHours * 3_600_000;

  // Revenge: a trade today opened within the window after any losing close.
  const lossCloses = trades
    .filter((t) => typeof t.profit === "number" && (t.profit as number) < 0 && t.closeTime)
    .map((t) => new Date(t.closeTime as string).getTime())
    .filter((ms) => !Number.isNaN(ms));
  const windowMs = config.revengeWindowMinutes * 60_000;
  const revengeToday = todayTradesList.filter((t) => {
    const openMs = new Date(t.openTime).getTime();
    if (Number.isNaN(openMs)) return false;
    return lossCloses.some((c) => openMs > c && openMs - c <= windowMs);
  }).length;

  const alerts: RiskGuardAlert[] = [];

  if (recent && lossStreak >= config.maxConsecutiveLosses) {
    alerts.push({ type: "loss_streak", severity: "danger", value: lossStreak, threshold: config.maxConsecutiveLosses });
  }
  if (recent && todayNetR !== null && todayNetR <= -config.maxDailyLossR) {
    alerts.push({ type: "daily_loss", severity: "danger", value: todayNetR, threshold: config.maxDailyLossR });
  }
  if (config.maxDailyLossCash != null && config.maxDailyLossCash > 0 && todayTradesList.length > 0) {
    const limit = config.maxDailyLossCash;
    if (todayNetProfit <= -limit) {
      alerts.push({ type: "daily_loss_cash", severity: "danger", value: todayNetProfit, threshold: limit });
    } else if (todayNetProfit <= -0.8 * limit) {
      alerts.push({ type: "daily_loss_cash", severity: "warning", value: todayNetProfit, threshold: limit });
    }
  }
  if (revengeToday > 0) {
    alerts.push({ type: "revenge", severity: "danger", value: revengeToday, threshold: 0 });
  }
  if (todayTradesList.length >= config.maxDailyTrades) {
    alerts.push({ type: "overtrading", severity: "warning", value: todayTradesList.length, threshold: config.maxDailyTrades });
  }

  return {
    evaluatedAt: now.toISOString(),
    tradingDay: today ?? "",
    todayTrades: todayTradesList.length,
    todayNetR,
    alerts,
  };
}
