export type BacktestStatsTrade = {
  id?: number;
  direction: "buy" | "sell";
  entryPrice?: string | number | null;
  exitPrice?: string | number | null;
  stopLoss?: string | number | null;
  takeProfit?: string | number | null;
  result: "win" | "loss" | "breakeven";
  pips?: string | number | null;
  tradeDate?: string;
  createdAt?: string;
  netPnl?: string | number | null;
  currency?: string | null;
  initialRisk?: string | number | null;
  lotSize?: string | number | null;
};

export type BacktestStats = {
  total: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  avgRR: string | null;
  totalPips: string;
  totalPnl: number;
  totalPnlFormatted: string;
  roiPct: number;
  roiPctFormatted: string;
  currency: string;
  initialBalance: number;
};

export type EquityCurvePoint = {
  index: number;
  tradeId?: number;
  pips: number;
  cumulativePips: number;
  pnl: number;
  cumulativePnl: number;
  balance: number;
  roiPct: number;
  result: "win" | "loss" | "breakeven";
  direction: "buy" | "sell";
  tradeDate?: string;
};

export type DetailedBacktestStats = BacktestStats & {
  lossRate: number;
  beRate: number;
  profitFactor: string | null;
  avgPipsPerTrade: string;
  avgWinPips: string;
  avgLossPips: string;
  winLossRatio: string | null;
  bestTradePips: string;
  worstTradePips: string;
  bestTradePnl: number;
  worstTradePnl: number;
  bestTradePnlFormatted: string;
  worstTradePnlFormatted: string;
  expectancyPips: string;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  maxDrawdownPips: string;
  maxDrawdownPnl: number;
  maxDrawdownPnlFormatted: string;
  maxDrawdownPct: number;
  maxDrawdownPctFormatted: string;
  longStats: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPips: string;
    totalPnl: number;
    totalPnlFormatted: string;
    roiPct: number;
  };
  shortStats: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
    totalPips: string;
    totalPnl: number;
    totalPnlFormatted: string;
    roiPct: number;
  };
  equityCurve: EquityCurvePoint[];
};

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value;
  return parseFloat(value ?? "0") || 0;
}

export function formatCurrencyPnl(val: number, currency = "EUR"): string {
  const sign = val >= 0 ? "+" : "-";
  const abs = Math.abs(val);
  const formattedNumber = abs.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${formattedNumber} ${currency}`;
}

export function formatRoi(val: number): string {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}

export function getTradePnl(trade: BacktestStatsTrade): number {
  if (trade.netPnl != null && trade.netPnl !== "") {
    return toNumber(trade.netPnl);
  }
  if (trade.pips != null) {
    const lots = toNumber(trade.lotSize) || 0.1;
    return toNumber(trade.pips) * lots * 10;
  }
  return 0;
}

export function calculateBacktestStats(
  trades: BacktestStatsTrade[] | undefined | null,
  initialBalance: number = 10000,
): BacktestStats | null {
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

  const currency = trades.find((t) => t.currency)?.currency ?? "EUR";
  const totalPnl = trades.reduce((sum, trade) => sum + getTradePnl(trade), 0);
  const roiPct = initialBalance > 0 ? (totalPnl / initialBalance) * 100 : 0;

  return {
    total,
    wins,
    losses,
    breakevens,
    winRate,
    avgRR,
    totalPips: totalPips.toFixed(1),
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    totalPnlFormatted: formatCurrencyPnl(totalPnl, currency),
    roiPct: parseFloat(roiPct.toFixed(2)),
    roiPctFormatted: formatRoi(roiPct),
    currency,
    initialBalance,
  };
}

export function calculateDetailedBacktestStats(
  trades: BacktestStatsTrade[] | undefined | null,
  initialBalance: number = 10000,
): DetailedBacktestStats | null {
  const basic = calculateBacktestStats(trades, initialBalance);
  if (!basic || !trades || trades.length === 0) return null;

  const total = basic.total;
  const wins = basic.wins;
  const losses = basic.losses;
  const breakevens = basic.breakevens;
  const currency = basic.currency;

  const lossRate = Math.round((losses / total) * 100);
  const beRate = Math.round((breakevens / total) * 100);

  let grossGains = 0;
  let grossLosses = 0;
  let winCount = 0;
  let lossCount = 0;
  let bestPips = -Infinity;
  let worstPips = Infinity;
  let bestPnl = -Infinity;
  let worstPnl = Infinity;

  for (const trade of trades) {
    const pips = toNumber(trade.pips);
    const pnl = getTradePnl(trade);

    if (pips > bestPips) bestPips = pips;
    if (pips < worstPips) worstPips = pips;

    if (pnl > bestPnl) bestPnl = pnl;
    if (pnl < worstPnl) worstPnl = pnl;

    if (pips > 0) {
      grossGains += pips;
      winCount++;
    } else if (pips < 0) {
      grossLosses += Math.abs(pips);
      lossCount++;
    }
  }

  const profitFactor = grossLosses > 0 ? (grossGains / grossLosses).toFixed(2) : grossGains > 0 ? "MAX" : null;
  const avgWinPipsNum = winCount > 0 ? grossGains / winCount : 0;
  const avgLossPipsNum = lossCount > 0 ? grossLosses / lossCount : 0;
  const winLossRatio = avgLossPipsNum > 0 ? (avgWinPipsNum / avgLossPipsNum).toFixed(2) : null;

  const totalPipsNum = toNumber(basic.totalPips);
  const avgPipsPerTrade = (totalPipsNum / total).toFixed(1);

  const winProb = wins / total;
  const lossProb = losses / total;
  const expectancyPips = ((winProb * avgWinPipsNum) - (lossProb * avgLossPipsNum)).toFixed(1);

  // Directional breakdown
  const longTrades = trades.filter((t) => t.direction === "buy");
  const shortTrades = trades.filter((t) => t.direction === "sell");

  const longWins = longTrades.filter((t) => t.result === "win").length;
  const longLosses = longTrades.filter((t) => t.result === "loss").length;
  const longPips = longTrades.reduce((acc, t) => acc + toNumber(t.pips), 0);
  const longPnl = longTrades.reduce((acc, t) => acc + getTradePnl(t), 0);
  const longWinRate = longTrades.length > 0 ? Math.round((longWins / longTrades.length) * 100) : 0;
  const longRoiPct = initialBalance > 0 ? (longPnl / initialBalance) * 100 : 0;

  const shortWins = shortTrades.filter((t) => t.result === "win").length;
  const shortLosses = shortTrades.filter((t) => t.result === "loss").length;
  const shortPips = shortTrades.reduce((acc, t) => acc + toNumber(t.pips), 0);
  const shortPnl = shortTrades.reduce((acc, t) => acc + getTradePnl(t), 0);
  const shortWinRate = shortTrades.length > 0 ? Math.round((shortWins / shortTrades.length) * 100) : 0;
  const shortRoiPct = initialBalance > 0 ? (shortPnl / initialBalance) * 100 : 0;

  // Chronological analysis for streaks, equity curve & drawdown
  const chronologicalTrades = [...trades].sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (a.id != null && b.id != null) {
      return a.id - b.id;
    }
    return 0;
  });

  let currentWinStreak = 0;
  let maxWinStreak = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;

  let cumulativePips = 0;
  let peakPips = 0;
  let maxDrawdownPips = 0;

  let cumulativePnl = 0;
  let peakPnl = 0;
  let maxDrawdownPnl = 0;
  let maxDrawdownPct = 0;

  const equityCurve: EquityCurvePoint[] = [
    {
      index: 0,
      pips: 0,
      cumulativePips: 0,
      pnl: 0,
      cumulativePnl: 0,
      balance: initialBalance,
      roiPct: 0,
      result: "breakeven",
      direction: "buy",
    },
  ];

  chronologicalTrades.forEach((trade, i) => {
    const pips = toNumber(trade.pips);
    const pnl = getTradePnl(trade);

    cumulativePips += pips;
    cumulativePnl += pnl;

    if (cumulativePips > peakPips) {
      peakPips = cumulativePips;
    }
    const currentDrawdownPips = peakPips - cumulativePips;
    if (currentDrawdownPips > maxDrawdownPips) {
      maxDrawdownPips = currentDrawdownPips;
    }

    if (cumulativePnl > peakPnl) {
      peakPnl = cumulativePnl;
    }
    const currentDrawdownPnl = peakPnl - cumulativePnl;
    if (currentDrawdownPnl > maxDrawdownPnl) {
      maxDrawdownPnl = currentDrawdownPnl;
    }

    const currentPeakBalance = initialBalance + peakPnl;
    if (currentPeakBalance > 0) {
      const currentDdPax = (currentDrawdownPnl / currentPeakBalance) * 100;
      if (currentDdPax > maxDrawdownPct) maxDrawdownPct = currentDdPax;
    }

    if (trade.result === "win") {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
    } else if (trade.result === "loss") {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;
    } else {
      currentWinStreak = 0;
      currentLossStreak = 0;
    }

    const currentRoi = initialBalance > 0 ? (cumulativePnl / initialBalance) * 100 : 0;

    equityCurve.push({
      index: i + 1,
      tradeId: trade.id,
      pips,
      cumulativePips: parseFloat(cumulativePips.toFixed(1)),
      pnl: parseFloat(pnl.toFixed(2)),
      cumulativePnl: parseFloat(cumulativePnl.toFixed(2)),
      balance: parseFloat((initialBalance + cumulativePnl).toFixed(2)),
      roiPct: parseFloat(currentRoi.toFixed(2)),
      result: trade.result,
      direction: trade.direction,
      tradeDate: trade.tradeDate,
    });
  });

  return {
    ...basic,
    lossRate,
    beRate,
    profitFactor,
    avgPipsPerTrade,
    avgWinPips: avgWinPipsNum.toFixed(1),
    avgLossPips: avgLossPipsNum.toFixed(1),
    winLossRatio,
    bestTradePips: bestPips !== -Infinity ? bestPips.toFixed(1) : "0.0",
    worstTradePips: worstPips !== Infinity ? worstPips.toFixed(1) : "0.0",
    bestTradePnl: bestPnl !== -Infinity ? parseFloat(bestPnl.toFixed(2)) : 0,
    worstTradePnl: worstPnl !== Infinity ? parseFloat(worstPnl.toFixed(2)) : 0,
    bestTradePnlFormatted: bestPnl !== -Infinity ? formatCurrencyPnl(bestPnl, currency) : formatCurrencyPnl(0, currency),
    worstTradePnlFormatted: worstPnl !== Infinity ? formatCurrencyPnl(worstPnl, currency) : formatCurrencyPnl(0, currency),
    expectancyPips,
    maxConsecutiveWins: maxWinStreak,
    maxConsecutiveLosses: maxLossStreak,
    maxDrawdownPips: maxDrawdownPips.toFixed(1),
    maxDrawdownPnl: parseFloat(maxDrawdownPnl.toFixed(2)),
    maxDrawdownPnlFormatted: formatCurrencyPnl(maxDrawdownPnl, currency),
    maxDrawdownPct: parseFloat(maxDrawdownPct.toFixed(2)),
    maxDrawdownPctFormatted: formatRoi(maxDrawdownPct),
    longStats: {
      total: longTrades.length,
      wins: longWins,
      losses: longLosses,
      winRate: longWinRate,
      totalPips: longPips.toFixed(1),
      totalPnl: parseFloat(longPnl.toFixed(2)),
      totalPnlFormatted: formatCurrencyPnl(longPnl, currency),
      roiPct: parseFloat(longRoiPct.toFixed(2)),
    },
    shortStats: {
      total: shortTrades.length,
      wins: shortWins,
      losses: shortLosses,
      winRate: shortWinRate,
      totalPips: shortPips.toFixed(1),
      totalPnl: parseFloat(shortPnl.toFixed(2)),
      totalPnlFormatted: formatCurrencyPnl(shortPnl, currency),
      roiPct: parseFloat(shortRoiPct.toFixed(2)),
    },
    equityCurve,
  };
}
