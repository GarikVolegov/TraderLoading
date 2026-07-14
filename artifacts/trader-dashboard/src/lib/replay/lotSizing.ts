// ─── Risk → lot sizing ───────────────────────────────────────────────────────
// The mockup's order ticket sizes positions from risk: the user picks a risk
// amount (percent of balance or fixed) and an SL distance in pips, and the lot
// count follows: lots = riskAmount / (slPips · pipValuePerLot). Pip semantics
// are shared with the rest of the app via getPipMultiplier; pipValuePerLot
// absorbs the legacy getPipDollarValue table from ChartReplay (account currency
// per pip per 1.00 lot).
import { getPipMultiplier } from "../pipMultiplier";
import type { RiskMode } from "./types";

/** Account-currency value of one pip for a 1.00 lot position. */
export function pipValuePerLot(symbol: string): number {
  const s = symbol.replace("/", "").toUpperCase();
  if (["US30", "NAS100", "SPX500"].includes(s)) return 1;
  if (s.includes("BTC") || s.includes("ETH")) return 1;
  return 10;
}

/** Price increment of one pip (inverse of the pips-per-price-unit multiplier). */
export function pipSize(symbol: string): number {
  return 1 / getPipMultiplier(symbol);
}

/** Lots for a target risk, floored to 0.01 so realized risk never exceeds it. */
export function computeLots(input: { riskAmount: number; slPips: number; symbol: string }): number {
  const { riskAmount, slPips, symbol } = input;
  if (!Number.isFinite(riskAmount) || riskAmount <= 0) return 0;
  if (!Number.isFinite(slPips) || slPips <= 0) return 0;
  const raw = riskAmount / (slPips * pipValuePerLot(symbol));
  return Math.floor(raw * 100) / 100;
}

export function riskAmountFor(input: { mode: RiskMode; value: number; balance: number }): number {
  const { mode, value, balance } = input;
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (mode === "percent") {
    if (!Number.isFinite(balance) || balance <= 0) return 0;
    return (balance * value) / 100;
  }
  return value;
}

/** Reward:risk ratio in R, or null when the stop distance is degenerate. */
export function riskRewardRatio(slPips: number, tpPips: number): number | null {
  if (!Number.isFinite(slPips) || slPips <= 0) return null;
  if (!Number.isFinite(tpPips)) return null;
  return tpPips / slPips;
}
