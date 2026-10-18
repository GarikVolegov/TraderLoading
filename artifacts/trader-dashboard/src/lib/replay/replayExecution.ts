import { checkPendingFill, fillPendingOrder, manageBar } from "./tradeEngine";
import type { OpenPosition, PendingOrder, ReplayCandle } from "./types";

/** Stage a transport move. No caller-owned state changes until this resolves. */
export async function simulateReplayExecution(input: {
  pages: AsyncIterable<ReplayCandle[]>;
  position: OpenPosition | null;
  pendingOrder: PendingOrder | null;
  symbol: string;
  targetTime: number;
  rules: { breakevenAtR: number | null; trailingPips: number | null };
  signal?: AbortSignal;
}) {
  let position = input.position;
  let pendingOrder = input.pendingOrder;
  let event: { kind: "fill" | "sl" | "tp"; price: number } | null = null;
  let finalTime = input.targetTime;
  let exit: { exitReason: "sl" | "tp"; exitPrice: number } | null = null;
  execution: for await (const page of input.pages) {
    input.signal?.throwIfAborted();
    for (const bar of page) {
      if (!position && pendingOrder) {
        const fillPrice = checkPendingFill(pendingOrder, bar);
        if (fillPrice != null) {
          const filledAtOpen = fillPrice === bar.open;
          position = fillPendingOrder(pendingOrder, fillPrice, filledAtOpen ? bar.time : bar.time + 60, input.symbol);
          pendingOrder = null;
          event = { kind: "fill", price: fillPrice };
          // All extrema follow an opening-price fill. A touch inside the minute
          // has no known ordering, so management starts with the next M1.
          if (!filledAtOpen) continue;
        }
      }
      if (!position) continue;
      const managed = manageBar(position, bar, input.rules, input.symbol);
      position = managed.position;
      if (managed.hit) {
        exit = managed.hit;
        finalTime = bar.time + 60;
        event = { kind: exit.exitReason, price: exit.exitPrice };
        break execution;
      }
    }
  }
  input.signal?.throwIfAborted();
  return { position, pendingOrder, event, exit, finalTime };
}
