// Composes the full /journal/edge response from the edge + discipline analytics
// over one closed-trade set. Kept as a pure function so the response shape can be
// asserted against the OpenAPI EdgeReport contract without booting the server.
import { computeEdgeReport, rMultiple, type EdgeTrade } from "./tradeAnalytics.js";
import { computeDisciplineReport, type DisciplineReport } from "./tradeDiscipline.js";
import { DEFAULT_RISK_GUARD_CONFIG, evaluateRiskGuard, type RiskGuardConfig, type RiskGuardReport } from "./riskGuard.js";

export function composeEdgeReport(
  trades: EdgeTrade[],
  now: Date = new Date(),
  guardOverrides: Partial<RiskGuardConfig> = {},
): ReturnType<typeof computeEdgeReport> & { discipline: DisciplineReport; guard: RiskGuardReport; rSamples:number[]; rCoverage:{withR:number;withoutR:number} } {
  const rSamples=[...trades].sort((a,b)=>(a.closeTime??a.openTime).localeCompare(b.closeTime??b.openTime)).map(rMultiple).filter((r):r is number=>r!==null);
  return {
    ...computeEdgeReport(trades, now),
    rSamples,
    rCoverage:{withR:rSamples.length,withoutR:trades.length-rSamples.length},
    discipline: computeDisciplineReport(trades),
    guard: evaluateRiskGuard(trades, now, { ...DEFAULT_RISK_GUARD_CONFIG, ...guardOverrides }),
  };
}
