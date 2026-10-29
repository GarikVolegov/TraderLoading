import { db, accountTradesTable, processSessionsTable, processEvidenceTable } from "@workspace/db";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { singleFlight } from "../lib/singleFlight.js";
import {
  computeCompositeMasteryScore,
  computeLimenIntegritySnapshot,
  type LimenIntegritySnapshot,
} from "../../../../contracts/limenGrades.js";

export interface OperatorIntegrityReport extends LimenIntegritySnapshot {
  readonly masteryScore: number;
  readonly consistencyScore: number;
  readonly avgRiskReward: number;
  readonly profitFactor: number;
  readonly winRate: number | null;
}

const INTEGRITY_CACHE_TTL_MS = 20_000;
const MAX_INTEGRITY_CACHE_ENTRIES = 2_000;

const integrityReportCache = new Map<
  string,
  { report: OperatorIntegrityReport; expiresAt: number; userId: string }
>();
const integrityInFlight = new Map<string, Promise<OperatorIntegrityReport>>();

export function invalidateOperatorIntegrityCache(userId: string): void {
  if (!userId) return;
  for (const [key, entry] of integrityReportCache.entries()) {
    if (entry.userId === userId) {
      integrityReportCache.delete(key);
    }
  }
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function getOperatorIntegrityReport(params: {
  readonly userId: string | null;
  readonly legacyLevel?: number;
  readonly streak?: number;
  readonly isAdmin?: boolean;
}): Promise<OperatorIntegrityReport> {
  const { userId, legacyLevel = 1, streak = 0, isAdmin = false } = params;

  if (!userId) {
    const baseSnapshot = computeLimenIntegritySnapshot({
      legacyLevel,
      consecutiveIntegralSessions: streak,
      isAdmin,
    });
    const masteryScore = computeCompositeMasteryScore({
      integrityIndex: baseSnapshot.integrityIndex,
      consistencyScore: Math.min(100, streak * 5),
      avgRiskReward: 1.5,
      profitFactor: 1.2,
      protocolViolationsCount: 0,
    });
    return {
      ...baseSnapshot,
      masteryScore,
      consistencyScore: Math.min(100, streak * 5),
      avgRiskReward: 1.5,
      profitFactor: 1.2,
      winRate: 50,
    };
  }

  const cacheKey = `${userId}:${legacyLevel}:${streak}:${isAdmin ? 1 : 0}`;
  const now = Date.now();
  const cached = integrityReportCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.report;
  }

  return singleFlight(integrityInFlight, cacheKey, async () => {
    const [sessions, evidence, trades] = await Promise.all([
      db
        .select({
          day: processSessionsTable.day,
          state: processSessionsTable.state,
          closure: processSessionsTable.closure,
          checklist: processSessionsTable.checklist,
          updatedAt: processSessionsTable.updatedAt,
        })
        .from(processSessionsTable)
        .where(eq(processSessionsTable.userId, userId))
        .orderBy(desc(processSessionsTable.day))
        .limit(180),
      db
        .select({
          adherence: processEvidenceTable.adherence,
        })
        .from(processEvidenceTable)
        .where(eq(processEvidenceTable.userId, userId))
        .orderBy(desc(processEvidenceTable.observedAt))
        .limit(100),
      db
        .select({
          profit: accountTradesTable.profit,
        })
        .from(accountTradesTable)
        .where(
          and(
            eq(accountTradesTable.userId, userId),
            eq(accountTradesTable.status, "closed"),
            isNotNull(accountTradesTable.profit),
          ),
        )
        .limit(200),
    ]);

    let integralSessions = 0;
    let consecutiveIntegralSessions = 0;
    let streakBroken = false;
    let recentViolationsCount = 0;

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const closure = isObjectRecord(s.closure) ? s.closure : null;
      const assessment = closure && typeof closure.assessment === "string" ? closure.assessment : null;
      const checklistArr = Array.isArray(s.checklist) ? s.checklist : [];
      const checklistAllTrue =
        checklistArr.length === 0 || checklistArr.every((item) => item === true);

      const violated = assessment === "not_followed";
      const integral =
        !violated &&
        (s.state === "closed" || assessment === "followed") &&
        checklistAllTrue;

      if (integral) {
        integralSessions += 1;
        if (!streakBroken) {
          consecutiveIntegralSessions += 1;
        }
      } else if (violated) {
        streakBroken = true;
        if (i < 15) {
          recentViolationsCount += 1;
        }
      } else {
        streakBroken = true;
      }
    }

    const offPlanEvidenceCount = evidence.filter(
      (e) => e.adherence === "not_followed" || e.adherence === "off_plan",
    ).length;
    recentViolationsCount += Math.min(5, offPlanEvidenceCount);

    let daysSinceLastTruthEntry = 0;
    if (sessions.length > 0 && sessions[0]?.updatedAt) {
      const diffMs = Date.now() - new Date(sessions[0].updatedAt).getTime();
      daysSinceLastTruthEntry = Math.max(0, Math.floor(diffMs / 86_400_000));
    }

    // Compute Profit Factor & Risk/Reward from closed account trades
    let grossProfit = 0;
    let grossLoss = 0;
    let winCount = 0;
    let lossCount = 0;
    for (const t of trades) {
      const p = Number(t.profit ?? 0);
      if (p > 0) {
        grossProfit += p;
        winCount += 1;
      } else if (p < 0) {
        grossLoss += Math.abs(p);
        lossCount += 1;
      }
    }

    const profitFactor =
      grossLoss > 0
        ? Math.round((grossProfit / grossLoss) * 100) / 100
        : grossProfit > 0
          ? 2.0
          : 1.0;
    const avgWin = winCount > 0 ? grossProfit / winCount : 0;
    const avgLoss = lossCount > 0 ? grossLoss / lossCount : 0;
    const avgRiskReward =
      avgLoss > 0 ? Math.round((avgWin / avgLoss) * 100) / 100 : winCount > 0 ? 1.8 : 1.0;
    const decidedTrades = winCount + lossCount;
    const winRate = decidedTrades > 0 ? Math.round((winCount / decidedTrades) * 100) : null;

    const snapshot = computeLimenIntegritySnapshot({
      totalSessions: sessions.length,
      integralSessions: sessions.length > 0 ? integralSessions : undefined,
      consecutiveIntegralSessions,
      recentViolationsCount,
      daysSinceLastTruthEntry,
      profitFactor,
      isAdmin,
      legacyLevel,
    });

    const consistencyScore = Math.min(
      100,
      Math.round((consecutiveIntegralSessions / 30) * 40 + Math.min(20, streak) + (snapshot.integrityIndex * 0.4)),
    );
    const masteryScore = computeCompositeMasteryScore({
      integrityIndex: snapshot.integrityIndex,
      consistencyScore,
      avgRiskReward,
      profitFactor,
      protocolViolationsCount: recentViolationsCount,
    });

    const report: OperatorIntegrityReport = {
      ...snapshot,
      masteryScore,
      consistencyScore,
      avgRiskReward,
      profitFactor,
      winRate,
    };

    if (integrityReportCache.size >= MAX_INTEGRITY_CACHE_ENTRIES) {
      const oldestKey = integrityReportCache.keys().next().value;
      if (oldestKey !== undefined) {
        integrityReportCache.delete(oldestKey);
      }
    }
    integrityReportCache.set(cacheKey, {
      report,
      expiresAt: Date.now() + INTEGRITY_CACHE_TTL_MS,
      userId,
    });

    return report;
  });
}
