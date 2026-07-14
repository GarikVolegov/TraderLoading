// Client off-contract del risk-of-ruin (come torneiApi): apiJSON su POST.
import { apiJSON } from "./apiFetch";

export interface RiskOfRuinParams {
  /** Risk per trade as a percent (0..100); the server converts to a fraction. */
  riskPercent?: number;
  /** Simulation horizon in trades. */
  trades?: number;
  /** Monte Carlo paths. */
  sims?: number;
}

export interface RiskOfRuinResult {
  /** Fraction of simulated paths that hit the ruin threshold (0..1). */
  riskOfRuin: number;
  /** Median final equity (start = 1), e.g. 1.34 = +34%. */
  medianFinalEquity: number;
  p5: number;
  p95: number;
  /** How many closed trades had a computable R (the resample pool). */
  tradesWithR: number;
  params: { riskFraction: number; ruinThreshold: number; trades: number; sims: number };
}

export const riskOfRuinKey = (riskPercent: number, trades: number) =>
  ["/api/journal/risk-of-ruin", riskPercent, trades] as const;

/** Bootstrap risk-of-ruin from the user's own closed-trade R-multiples. Throws on
 *  422 when there aren't enough trades with a computable R. */
export function computeRiskOfRuin(params: RiskOfRuinParams): Promise<RiskOfRuinResult> {
  return apiJSON<RiskOfRuinResult>("journal/risk-of-ruin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
}
