import { getPipMultiplier } from "./pipMultiplier.js";

export type BacktestTradeDirection = "buy" | "sell";

export type ManualBacktestTradeResult = {
  result: "win" | "loss" | "breakeven";
  pips: string;
};

export function calculateManualBacktestTradeResult(
  entryPrice: string,
  exitPrice: string,
  direction: BacktestTradeDirection,
  symbol: string,
): ManualBacktestTradeResult {
  const entry = parseFloat(entryPrice);
  const exit = parseFloat(exitPrice);

  if (isNaN(entry) || isNaN(exit)) {
    return { result: "breakeven", pips: "0" };
  }

  const diff = direction === "buy" ? exit - entry : entry - exit;
  // Pip size is instrument-specific (JPY/gold/indices/crypto differ from FX
  // majors); the replay uses the same helper, so both modes agree.
  const pips = (diff * getPipMultiplier(symbol)).toFixed(1);
  const result = diff > 0 ? "win" : diff < 0 ? "loss" : "breakeven";

  return { result, pips };
}
