// Shared loaders for the edge/guard pipeline: closed broker trades + the user's
// risk-guard config from settings. Used by the /journal/edge route and the
// risk-guard push notifier so both read the same data the same way.
import { db, accountTradesTable, userSettingsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { netProfit, normalizeDirection, type EdgeTrade } from "./tradeAnalytics.js";
import { sanitizeRiskGuardOverrides, type RiskGuardConfig } from "./riskGuard.js";

/** The user's closed broker trades, mapped for the analytics services. */
export async function loadClosedEdgeTrades(userId: string | null): Promise<EdgeTrade[]> {
  const userFilter = userId
    ? eq(accountTradesTable.userId, userId)
    : eq(accountTradesTable.userId, "guest");

  const rows = await db
    .select({
      symbol: accountTradesTable.symbol,
      direction: accountTradesTable.direction,
      openTime: accountTradesTable.openTime,
      closeTime: accountTradesTable.closeTime,
      entryPrice: accountTradesTable.entryPrice,
      exitPrice: accountTradesTable.exitPrice,
      stopLoss: accountTradesTable.stopLoss,
      profit: accountTradesTable.profit,
      commission: accountTradesTable.commission,
      swap: accountTradesTable.swap,
    })
    .from(accountTradesTable)
    .where(and(userFilter, eq(accountTradesTable.status, "closed")));

  const num = (value: string | null): number | null => (value === null ? null : Number(value));
  return rows.map((row) => ({
    symbol: row.symbol,
    direction: row.direction,
    openTime: row.openTime,
    closeTime: row.closeTime,
    entryPrice: num(row.entryPrice),
    exitPrice: num(row.exitPrice),
    stopLoss: num(row.stopLoss),
    // Net P&L (gross + commission + swap) so the coach and the cash guard match
    // the diario, which already classifies on net.
    profit: netProfit(num(row.profit), num(row.commission), num(row.swap)),
  }));
}

/** The user's currently-open positions, one per symbol (first direction wins),
 *  for portfolio correlation / concentration analysis (idea 5B). */
export async function loadOpenPositions(
  userId: string | null,
): Promise<{ symbol: string; direction: "long" | "short" }[]> {
  const userFilter = userId
    ? eq(accountTradesTable.userId, userId)
    : eq(accountTradesTable.userId, "guest");
  const rows = await db
    .select({ symbol: accountTradesTable.symbol, direction: accountTradesTable.direction })
    .from(accountTradesTable)
    .where(and(userFilter, eq(accountTradesTable.status, "open")));

  const seen = new Set<string>();
  const out: { symbol: string; direction: "long" | "short" }[] = [];
  for (const row of rows) {
    const dir = normalizeDirection(row.direction);
    if (!dir || seen.has(row.symbol)) continue;
    seen.add(row.symbol);
    out.push({ symbol: row.symbol, direction: dir });
  }
  return out;
}

/** Risk-guard config overrides: cash limit from `maxDailyLoss`, thresholds from
 *  notificationPrefs.__riskGuard. */
export async function loadGuardOverrides(userId: string | null): Promise<Partial<RiskGuardConfig>> {
  const filter = userId ? eq(userSettingsTable.userId, userId) : isNull(userSettingsTable.userId);
  const [row] = await db
    .select({ maxDailyLoss: userSettingsTable.maxDailyLoss, notificationPrefs: userSettingsTable.notificationPrefs })
    .from(userSettingsTable)
    .where(filter)
    .limit(1);

  let thresholds: Partial<RiskGuardConfig> = {};
  if (row?.notificationPrefs) {
    try {
      const prefs = JSON.parse(row.notificationPrefs) as Record<string, unknown>;
      thresholds = sanitizeRiskGuardOverrides(prefs.__riskGuard);
    } catch {
      // malformed prefs → fall back to defaults
    }
  }
  return { ...thresholds, maxDailyLossCash: row?.maxDailyLoss ?? null };
}
