export type BacktestStatsTrade = {
  direction: "buy" | "sell";
  entryPrice?: string | number | null;
  exitPrice?: string | number | null;
  stopLoss?: string | number | null;
  result: "win" | "loss" | "breakeven";
  pips?: string | number | null;
};

export type BacktestStats = {
  total: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  avgRR: string | null;
  totalPips: string;
};

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  return parseFloat(value ?? "0");
}

export function calculateBacktestStats(trades: BacktestStatsTrade[] | undefined | null): BacktestStats | null {
  if (!trades || trades.length === 0) return null;

  const wins = trades.filter((trade) => trade.result === "win").length;
  const losses = trades.filter((trade) => trade.result === "loss").length;
  const breakevens = trades.filter((trade) => trade.result === "breakeven").length;
  const total = trades.length;
  const winRate = Math.round((wins / total) * 100);
  let totalRR = 0;
  let rrCount = 0;

  for (const trade of trades) {
    if (trade.stopLoss && trade.entryPrice) {
      const entry = toNumber(trade.entryPrice);
      const stopLoss = toNumber(trade.stopLoss);
      const exit = toNumber(trade.exitPrice);
      const risk = Math.abs(entry - stopLoss);

      if (risk > 0) {
        const reward = trade.direction === "buy" ? exit - entry : entry - exit;
        totalRR += reward / risk;
        rrCount += 1;
      }
    }
  }

  const avgRR = rrCount > 0 ? (totalRR / rrCount).toFixed(2) : null;
  const totalPips = trades.reduce((sum, trade) => sum + toNumber(trade.pips), 0);

  return { total, wins, losses, breakevens, winRate, avgRR, totalPips: totalPips.toFixed(1) };
}
