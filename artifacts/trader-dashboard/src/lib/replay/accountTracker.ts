// ─── Account tracker ─────────────────────────────────────────────────────────
// Folds closed trades (plus the open position's mark-to-market) into the
// header chips and the equity mini-curve: balance, equity, peak, max drawdown,
// return %. Trades are sorted oldest-first before folding so the journal can
// keep its newest-first ordering.
import type { ClosedTrade } from "./types";

export interface AccountState {
  balance: number;
  equity: number;
  peakEquity: number;
  /** Worst peak-to-trough equity drop, percent of the peak. */
  maxDrawdownPct: number;
  returnPct: number;
  /** Balance after each closed trade, starting at the initial balance. */
  equityCurve: number[];
}

export function buildAccountState(
  initialBalance: number,
  trades: ClosedTrade[],
  openProfit = 0,
): AccountState {
  const ordered = [...trades].sort((a, b) => a.exitTime - b.exitTime || a.id - b.id);
  const equityCurve: number[] = [initialBalance];
  let balance = initialBalance;
  let peak = initialBalance;
  let maxDrawdownPct = 0;

  const track = (equity: number) => {
    if (equity > peak) peak = equity;
    else if (peak > 0) maxDrawdownPct = Math.max(maxDrawdownPct, ((peak - equity) / peak) * 100);
  };

  for (const trade of ordered) {
    balance += trade.profit;
    equityCurve.push(balance);
    track(balance);
  }

  const equity = balance + openProfit;
  track(equity);

  return {
    balance,
    equity,
    peakEquity: peak,
    maxDrawdownPct,
    returnPct: initialBalance > 0 ? ((equity - initialBalance) / initialBalance) * 100 : 0,
    equityCurve,
  };
}
