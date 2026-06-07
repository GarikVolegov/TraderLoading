import type { AccountTrade } from "./types.js";

export type JournalTradeResult = "win" | "loss" | "breakeven";

export interface JournalEntryDraft {
  title: string;
  content: string;
  tradeDate: string;
  result: JournalTradeResult;
  tags: string;
}

function formatNumber(value: number | undefined, digits: number): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function formatTimestamp(value: string | undefined): string {
  return value ?? "-";
}

export function getTradeResult(trade: AccountTrade): JournalTradeResult {
  const profit = typeof trade.profit === "number" && Number.isFinite(trade.profit) ? trade.profit : 0;

  if (profit > 0) {
    return "win";
  }

  if (profit < 0) {
    return "loss";
  }

  return "breakeven";
}

export function buildJournalEntryFromAccountTrade(trade: AccountTrade): JournalEntryDraft {
  const tradeDate = (trade.closeTime ?? trade.openTime).slice(0, 10);
  const upperDirection = trade.direction.toUpperCase();

  return {
    title: `${trade.symbol} ${upperDirection} account trade`,
    tradeDate,
    result: getTradeResult(trade),
    tags: ["account-import", trade.source, trade.symbol, trade.direction].join(","),
    content: [
      `Ticket: ${trade.ticket}`,
      `Source: ${trade.source}`,
      `Symbol: ${trade.symbol}`,
      `Direction: ${upperDirection}`,
      `Status: ${trade.status}`,
      `Volume: ${formatNumber(trade.volume, 2)}`,
      `Open Time: ${formatTimestamp(trade.openTime)}`,
      `Close Time: ${formatTimestamp(trade.closeTime)}`,
      `Entry Price: ${formatNumber(trade.entryPrice, 5)}`,
      `Exit Price: ${formatNumber(trade.exitPrice, 5)}`,
      `Stop Loss: ${formatNumber(trade.stopLoss, 5)}`,
      `Take Profit: ${formatNumber(trade.takeProfit, 5)}`,
      `Profit: ${formatNumber(trade.profit, 2)}`,
      `Commission: ${formatNumber(trade.commission, 2)}`,
      `Swap: ${formatNumber(trade.swap, 2)}`,
    ].join("\n"),
  };
}
