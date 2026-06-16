// Composes the full /journal/edge response from the edge + discipline analytics
// over one closed-trade set. Kept as a pure function so the response shape can be
// asserted against the OpenAPI EdgeReport contract without booting the server.
import { computeEdgeReport, type EdgeTrade } from "./tradeAnalytics.js";
import { computeDisciplineReport, type DisciplineReport } from "./tradeDiscipline.js";
import { DEFAULT_RISK_GUARD_CONFIG, evaluateRiskGuard, type RiskGuardReport } from "./riskGuard.js";

export function composeEdgeReport(
  trades: EdgeTrade[],
  now: Date = new Date(),
  maxDailyLossCash: number | null = null,
): ReturnType<typeof computeEdgeReport> & { discipline: DisciplineReport; guard: RiskGuardReport } {
  return {
    ...computeEdgeReport(trades, now),
    discipline: computeDisciplineReport(trades),
    guard: evaluateRiskGuard(trades, now, { ...DEFAULT_RISK_GUARD_CONFIG, maxDailyLossCash }),
  };
}
