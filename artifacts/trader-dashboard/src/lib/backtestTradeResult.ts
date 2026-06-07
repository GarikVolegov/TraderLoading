export type BacktestTradeDirection = "buy" | "sell";

export type ManualBacktestTradeResult = {
  result: "win" | "loss" | "breakeven";
  pips: string;
};

export function calculateManualBacktestTradeResult(
  entryPrice: string,
  exitPrice: string,
  direction: BacktestTradeDirection,
): ManualBacktestTradeResult {
  const entry = parseFloat(entryPrice);
  const exit = parseFloat(exitPrice);

  if (isNaN(entry) || isNaN(exit)) {
    return { result: "breakeven", pips: "0" };
  }

  const diff = direction === "buy" ? exit - entry : entry - exit;
  const pips = (diff * 10000).toFixed(1);
  const result = diff > 0 ? "win" : diff < 0 ? "loss" : "breakeven";

  return { result, pips };
}
