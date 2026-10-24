import { checkPendingFill, checkPendingCancellation, fillPendingOrder, manageBar } from "./tradeEngine";
import type { OpenPosition, PendingOrder, ReplayCandle } from "./types";

export interface ReplayExecutionExit {
  position: OpenPosition;
  exitReason: "sl" | "tp";
  exitPrice: number;
  exitTime: number;
}

export interface ReplayExecutionResult {
  position: OpenPosition | null;
  pendingOrder: PendingOrder | null;
  positions: OpenPosition[];
  pendingOrders: PendingOrder[];
  event: { kind: "fill" | "sl" | "tp" | "cancel_tp" | "cancel_sl"; price: number } | null;
  exit: { exitReason: "sl" | "tp"; exitPrice: number; positionId?: string } | null;
  exits: ReplayExecutionExit[];
  finalTime: number;
}

/** Stage a transport move. Supports single or multiple concurrent positions and resting orders. */
export async function simulateReplayExecution(input: {
  pages: AsyncIterable<ReplayCandle[]>;
  fallbackCandles?: ReplayCandle[];
  position?: OpenPosition | null;
  pendingOrder?: PendingOrder | null;
  positions?: OpenPosition[];
  pendingOrders?: PendingOrder[];
  symbol: string;
  targetTime: number;
  rules: { breakevenAtR: number | null; trailingPips: number | null };
  signal?: AbortSignal;
}): Promise<ReplayExecutionResult> {
  let activePositions: OpenPosition[] = input.positions
    ? [...input.positions]
    : input.position
      ? [input.position]
      : [];
  let activeOrders: PendingOrder[] = input.pendingOrders
    ? [...input.pendingOrders]
    : input.pendingOrder
      ? [input.pendingOrder]
      : [];

  let event: { kind: "fill" | "sl" | "tp" | "cancel_tp" | "cancel_sl"; price: number } | null = null;
  let finalTime = input.targetTime;
  let exit: { exitReason: "sl" | "tp"; exitPrice: number; positionId?: string } | null = null;
  const exits: ReplayExecutionExit[] = [];
  let processedBars = 0;

  const processBar = (bar: ReplayCandle): boolean => {
    // 1. Pending order fills
    const newlyFilledThisBar: OpenPosition[] = [];
    if (activeOrders.length > 0) {
      const remainingOrders: PendingOrder[] = [];
      for (const order of activeOrders) {
        const fillPrice = checkPendingFill(order, bar);
        if (fillPrice != null) {
          const filledAtOpen = fillPrice === bar.open;
          const newPos = fillPendingOrder(order, fillPrice, filledAtOpen ? bar.time : bar.time + 60, input.symbol);
          if (filledAtOpen) {
            activePositions.push(newPos);
          } else {
            newlyFilledThisBar.push(newPos);
          }
          event = { kind: "fill", price: fillPrice };
        } else {
          const cancelReason = checkPendingCancellation(order, bar);
          if (cancelReason != null) {
            if (!event) {
              event = {
                kind: cancelReason === "target_reached" ? "cancel_tp" : "cancel_sl",
                price: cancelReason === "target_reached" ? (order.takeProfit ?? bar.close) : (order.stopLoss ?? bar.close),
              };
            }
          } else {
            remainingOrders.push(order);
          }
        }
      }
      activeOrders = remainingOrders;
    }

    // 2. Active position management
    if (activePositions.length > 0) {
      const remainingPositions: OpenPosition[] = [];
      let hitOccurred = false;

      for (const pos of activePositions) {
        const managed = manageBar(pos, bar, input.rules, input.symbol);
        if (managed.hit) {
          hitOccurred = true;
          const exitItem: ReplayExecutionExit = {
            position: pos,
            exitReason: managed.hit.exitReason,
            exitPrice: managed.hit.exitPrice,
            exitTime: bar.time + 60,
          };
          exits.push(exitItem);
          if (!exit) {
            exit = { exitReason: managed.hit.exitReason, exitPrice: managed.hit.exitPrice, positionId: pos.id };
          }
        } else {
          remainingPositions.push(managed.position);
        }
      }

      activePositions = remainingPositions;

      if (hitOccurred) {
        finalTime = bar.time + 60;
        if (exit) event = { kind: exit.exitReason, price: exit.exitPrice };
        activePositions.push(...newlyFilledThisBar);
        return true;
      }
    }

    // Newly filled inside-minute positions join management for next M1
    if (newlyFilledThisBar.length > 0) {
      activePositions.push(...newlyFilledThisBar);
    }
    return false;
  };

  execution: for await (const page of input.pages) {
    input.signal?.throwIfAborted();
    for (const bar of page) {
      processedBars++;
      if (processBar(bar)) break execution;
    }
  }

  // Fallback: if M1 stream was empty/unavailable (e.g. historical data or offline replay),
  // process against the visible chart bar(s) provided in fallbackCandles
  if (processedBars === 0 && input.fallbackCandles && input.fallbackCandles.length > 0) {
    for (const bar of input.fallbackCandles) {
      input.signal?.throwIfAborted();
      if (processBar(bar)) break;
    }
  }

  input.signal?.throwIfAborted();
  const returnedPosition = activePositions[0] ?? exits[0]?.position ?? null;
  return {
    position: returnedPosition,
    pendingOrder: activeOrders[0] ?? null,
    positions: activePositions,
    pendingOrders: activeOrders,
    event,
    exit,
    exits,
    finalTime,
  };
}
