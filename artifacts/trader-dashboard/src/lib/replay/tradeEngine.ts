// ─── Replay trade engine ─────────────────────────────────────────────────────
// Opening, SL/TP hit detection on bar reveal and closing of simulated trades.
// The hit rule ports ChartReplay's semantics: the stop is checked before the
// target, so a bar that spans both counts as a loss (conservative — without
// lower-timeframe data the intra-bar order is unknowable).
import { getPipMultiplier } from "../pipMultiplier";
import { pipSize, pipValuePerLot } from "./lotSizing";
import type {
  ClosedTrade,
  ExitReason,
  OpenPosition,
  PendingOrder,
  ReplayCandle,
  TradeDirection,
} from "./types";

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
    initialSlPips: slPips,
    bestPips: 0,
    worstPips: 0,
    breakevenApplied: false,
  };
}

/**
 * Fill price for a pending order on a revealed bar, or null if untouched.
 * Gap-aware: a bar opening beyond the trigger fills at the open (the price the
 * market actually offered), not at the resting level.
 * - buy limit / sell stop rest BELOW price → the bar's low must reach them;
 * - buy stop / sell limit rest ABOVE price → the bar's high must reach them.
 */
export function checkPendingFill(order: PendingOrder, bar: ReplayCandle): number | null {
  const triggersBelow =
    (order.direction === "buy" && order.kind === "limit") ||
    (order.direction === "sell" && order.kind === "stop");
  if (triggersBelow) {
    if (bar.low <= order.price) return Math.min(bar.open, order.price);
    return null;
  }
  if (bar.high >= order.price) return Math.max(bar.open, order.price);
  return null;
}

/** Turn a filled pending order into an open position anchored to the fill bar. */
export function fillPendingOrder(
  order: PendingOrder,
  fillPrice: number,
  fillTime: number,
  symbol: string,
): OpenPosition {
  return openPosition({
    direction: order.direction,
    entryPrice: fillPrice,
    entryTime: fillTime,
    slPips: order.slPips,
    tpPips: order.tpPips,
    lots: order.lots,
    riskAmount: order.riskAmount,
    symbol,
  });
}

export interface ManageRules {
  /** Move the stop to entry once favorable excursion reaches this many R (initial risk). */
  breakevenAtR?: number | null;
  /** Trail the stop this many pips behind the best favorable price. */
  trailingPips?: number | null;
}

/**
 * Process one revealed bar for an open position: stop check first (against the
 * PRE-bar levels — no intra-bar look-ahead), then excursion tracking, then
 * auto-breakeven and trailing, which only ever move the stop in the position's
 * favor and take effect from the NEXT bar.
 */
export function manageBar(
  position: OpenPosition,
  bar: ReplayCandle,
  rules: ManageRules,
  symbol: string,
): { position: OpenPosition; hit: { exitPrice: number; exitReason: "sl" | "tp" } | null } {
  const hit = checkStopHit(position, bar);
  const sign = position.direction === "buy" ? 1 : -1;
  const multiplier = getPipMultiplier(symbol);
  const size = pipSize(symbol);
  const roundPips = (value: number) => Math.round(value * 10) / 10;

  const favorableExtreme = position.direction === "buy" ? bar.high : bar.low;
  const adverseExtreme = position.direction === "buy" ? bar.low : bar.high;
  const bestPips = Math.max(
    position.bestPips ?? 0,
    roundPips((favorableExtreme - position.entryPrice) * sign * multiplier),
  );
  const worstPips = Math.min(
    position.worstPips ?? 0,
    roundPips((adverseExtreme - position.entryPrice) * sign * multiplier),
  );
  let next: OpenPosition = { ...position, bestPips, worstPips };

  if (hit) return { position: next, hit };

  const initialRisk = next.initialSlPips ?? next.slPips;
  if (
    rules.breakevenAtR != null &&
    rules.breakevenAtR > 0 &&
    !next.breakevenApplied &&
    initialRisk > 0 &&
    bestPips >= rules.breakevenAtR * initialRisk
  ) {
    const raised = position.direction === "buy" ? Math.max(next.stopLoss, next.entryPrice) : Math.min(next.stopLoss, next.entryPrice);
    next = { ...next, stopLoss: raised, breakevenApplied: true };
  }

  if (rules.trailingPips != null && rules.trailingPips > 0) {
    const trailed =
      position.direction === "buy"
        ? favorableExtreme - rules.trailingPips * size
        : favorableExtreme + rules.trailingPips * size;
    const improved = position.direction === "buy" ? Math.max(next.stopLoss, trailed) : Math.min(next.stopLoss, trailed);
    if (improved !== next.stopLoss) next = { ...next, stopLoss: improved };
  }

  if (next.stopLoss !== position.stopLoss) {
    next = { ...next, slPips: Math.max(0, roundPips((next.entryPrice - next.stopLoss) * sign * multiplier)) };
  }

  return { position: next, hit: null };
}

/**
 * SL/TP touch on a revealed bar; SL wins when both are inside the bar's range.
 * Gap-aware: when the bar OPENS beyond the level (weekend gap, news candle)
 * the fill happens at the open, not at a price the market never traded.
 */
export function checkStopHit(
  position: OpenPosition,
  bar: ReplayCandle,
): { exitPrice: number; exitReason: "sl" | "tp" } | null {
  if (position.direction === "buy") {
    if (position.slPips > 0 && bar.low <= position.stopLoss) {
      return { exitPrice: Math.min(bar.open, position.stopLoss), exitReason: "sl" };
    }
    if (position.tpPips > 0 && bar.high >= position.takeProfit) {
      return { exitPrice: Math.max(bar.open, position.takeProfit), exitReason: "tp" };
    }
    return null;
  }
  if (position.slPips > 0 && bar.high >= position.stopLoss) {
    return { exitPrice: Math.max(bar.open, position.stopLoss), exitReason: "sl" };
  }
  if (position.tpPips > 0 && bar.low <= position.takeProfit) {
    return { exitPrice: Math.min(bar.open, position.takeProfit), exitReason: "tp" };
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
  const initialRisk = position.initialSlPips ?? position.slPips;
  const round2 = (value: number) => Math.round(value * 100) / 100;
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
    rMultiple: initialRisk > 0 ? pips / initialRisk : null,
    exitReason: close.exitReason,
    result: pips > 0 ? "win" : pips < 0 ? "loss" : "breakeven",
    maeR: initialRisk > 0 ? round2(Math.max(0, -(position.worstPips ?? 0)) / initialRisk) : null,
    mfeR: initialRisk > 0 ? round2(Math.max(0, position.bestPips ?? 0) / initialRisk) : null,
  };
}
