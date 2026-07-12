// ─── Replay trade engine ─────────────────────────────────────────────────────
// Opening, SL/TP hit detection on bar reveal and closing of simulated trades.
// The hit rule ports ChartReplay's semantics: the stop is checked before the
// target, so a bar that spans both counts as a loss (conservative — without
// lower-timeframe data the intra-bar order is unknowable).
import { getPipMultiplier } from "../pipMultiplier";
import { pipSize, pipValuePerLot } from "./lotSizing";
import type { ClosedTrade, ExitReason, OpenPosition, ReplayCandle, TradeDirection } from "./types";

export function openPosition(input: {
  direction: TradeDirection;
  entryPrice: number;
  entryTime: number;
  slPips: number;
  tpPips: number;
  lots: number;
  riskAmount: number;
  symbol: string;
}): OpenPosition {
  const { direction, entryPrice, entryTime, slPips, tpPips, lots, riskAmount, symbol } = input;
  const size = pipSize(symbol);
  const sign = direction === "buy" ? 1 : -1;
  return {
    direction,
    entryPrice,
    entryTime,
    stopLoss: entryPrice - sign * slPips * size,
    takeProfit: entryPrice + sign * tpPips * size,
    lots,
    riskAmount,
    slPips,
    tpPips,
  };
}

/** SL/TP touch on a revealed bar; SL wins when both are inside the bar's range. */
export function checkStopHit(
  position: OpenPosition,
  bar: ReplayCandle,
): { exitPrice: number; exitReason: "sl" | "tp" } | null {
  if (position.direction === "buy") {
    if (position.slPips > 0 && bar.low <= position.stopLoss) {
      return { exitPrice: position.stopLoss, exitReason: "sl" };
    }
    if (position.tpPips > 0 && bar.high >= position.takeProfit) {
      return { exitPrice: position.takeProfit, exitReason: "tp" };
    }
    return null;
  }
  if (position.slPips > 0 && bar.high >= position.stopLoss) {
    return { exitPrice: position.stopLoss, exitReason: "sl" };
  }
  if (position.tpPips > 0 && bar.low <= position.takeProfit) {
    return { exitPrice: position.takeProfit, exitReason: "tp" };
  }
  return null;
}

function roundPips(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Signed pips of the position marked at `price`. */
export function positionPips(position: OpenPosition, price: number, symbol: string): number {
  const sign = position.direction === "buy" ? 1 : -1;
  return roundPips((price - position.entryPrice) * sign * getPipMultiplier(symbol));
}

/** Signed account-currency P&L of the position marked at `price`. */
export function unrealizedProfit(position: OpenPosition, price: number, symbol: string): number {
  return positionPips(position, price, symbol) * pipValuePerLot(symbol) * position.lots;
}

export function closePosition(
  position: OpenPosition,
  close: { exitPrice: number; exitTime: number; exitReason: ExitReason; id: number; symbol: string },
): ClosedTrade {
  const pips = positionPips(position, close.exitPrice, close.symbol);
  const profit = pips * pipValuePerLot(close.symbol) * position.lots;
  return {
    id: close.id,
    direction: position.direction,
    entryPrice: position.entryPrice,
    exitPrice: close.exitPrice,
    entryTime: position.entryTime,
    exitTime: close.exitTime,
    stopLoss: position.stopLoss,
    takeProfit: position.takeProfit,
    lots: position.lots,
    pips,
    profit,
    rMultiple: position.slPips > 0 ? pips / position.slPips : null,
    exitReason: close.exitReason,
    result: pips > 0 ? "win" : pips < 0 ? "loss" : "breakeven",
  };
}
