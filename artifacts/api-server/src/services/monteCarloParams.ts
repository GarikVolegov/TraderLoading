// Validate + clamp the /tools/montecarlo request body. Off-contract endpoint read
// `req.body as {...}` with no bounds, so an unclamped numTrades (the inner
// simulation loop) let a single request spin the CPU and allocate unbounded curve
// arrays (DoS — findings 0.7 + 2.8). Pure so it can be unit-tested in isolation.

export interface MonteCarloParams {
  /** 0..1 (input accepts 0-100 or 0-1). */
  winrate: number;
  avgR: number;
  lossR: number;
  numTrades: number;
  riskPercent: number;
  initialBalance: number;
  simCount: number;
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

export function parseMonteCarloParams(raw: unknown): MonteCarloParams {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // Winrate: accept 0-100 or 0-1, then bound to 0..1.
  const rawWinrate = clampNumber(body.winrate, { min: 0, max: 100, fallback: 55 });
  const winrate = rawWinrate > 1 ? rawWinrate / 100 : rawWinrate;
  return {
    winrate: Math.min(1, Math.max(0, winrate)),
    avgR: clampNumber(body.avgR, { min: 0, max: 100, fallback: 1.5 }),
    lossR: clampNumber(body.lossR, { min: 0, max: 100, fallback: 1 }),
    numTrades: clampNumber(body.numTrades, { min: 1, max: 1000, fallback: 100, integer: true }),
    riskPercent: clampNumber(body.riskPercent, { min: 0, max: 100, fallback: 1 }),
    initialBalance: clampNumber(body.initialBalance, { min: 1, max: 100_000_000, fallback: 10_000 }),
    simCount: clampNumber(body.simCount, { min: 1, max: 200, fallback: 50, integer: true }),
  };
}
