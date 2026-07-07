// Validate + clamp the /journal/risk-of-ruin request body. Bounds the bootstrap
// simulation (idea 5B) so an unclamped `sims`/`trades` can't spin the CPU (same
// DoS class as monteCarloParams). Pure so it can be unit-tested in isolation.

export interface RiskOfRuinParams {
  /** Fraction of equity risked per 1R trade (0.0001..1; e.g. 0.01 = 1%). */
  riskFraction: number;
  /** Equity level (start = 1) that counts as ruin (0.01..0.99; e.g. 0.5 = −50%). */
  ruinThreshold: number;
  /** Simulation horizon in trades (1..1000). */
  trades: number;
  /** Number of Monte Carlo paths (1..2000). */
  sims: number;
}

function clampNumber(
  value: unknown,
  { min, max, fallback, integer = false }: { min: number; max: number; fallback: number; integer?: boolean },
): number {
  const num = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(num)) return fallback;
  const bounded = Math.min(max, Math.max(min, num));
  return integer ? Math.round(bounded) : bounded;
}

export function parseRiskOfRuinParams(raw: unknown): RiskOfRuinParams {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // riskPercent (0..100) is the friendlier UI input; use it only when an explicit
  // riskFraction wasn't provided.
  const riskFraction =
    body.riskFraction !== undefined
      ? clampNumber(body.riskFraction, { min: 0.0001, max: 1, fallback: 0.01 })
      : clampNumber(body.riskPercent, { min: 0.01, max: 100, fallback: 1 }) / 100;
  return {
    riskFraction: Math.min(1, Math.max(0.0001, riskFraction)),
    ruinThreshold: clampNumber(body.ruinThreshold, { min: 0.01, max: 0.99, fallback: 0.5 }),
    trades: clampNumber(body.trades, { min: 1, max: 1000, fallback: 100, integer: true }),
    sims: clampNumber(body.sims, { min: 1, max: 2000, fallback: 500, integer: true }),
  };
}
