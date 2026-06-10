// Report automatico della giornata: aggrega diario, check-in e missioni di oggi.
// Logica pura, separata dal componente per essere testabile in node.

import { parseTradeContent } from "./parseTradeContent";
import { getLocalDateKey } from "./marketSessions";

export interface TodayReport {
  win: number;
  loss: number;
  be: number;
  netPnl: number | null;
  currency: string;
  mood: string | null;
  missionsCompleted: number;
  missionsTotal: number;
}

export interface ReportEntry {
  tradeDate: string;
  result: string;
  content?: string | null;
}

export function buildTodayReport(
  entries: ReportEntry[] | undefined,
  mood: string | null,
  missionsCompleted: number,
  missionsTotal: number,
): TodayReport {
  const today = getLocalDateKey();
  let win = 0;
  let loss = 0;
  let be = 0;
  let netPnl: number | null = null;
  let currency = "";

  for (const entry of entries ?? []) {
    if (entry.tradeDate.slice(0, 10) !== today) continue;
    if (entry.result === "win") win++;
    else if (entry.result === "loss") loss++;
    else if (entry.result === "breakeven") be++;

    const parsed = parseTradeContent(entry.content);
    if (parsed && typeof parsed.profit === "number") {
      const net = parsed.profit + (parsed.commission ?? 0) + (parsed.swap ?? 0);
      netPnl = (netPnl ?? 0) + net;
      if (!currency && parsed.currency) currency = parsed.currency;
    }
  }

  return {
    win,
    loss,
    be,
    netPnl: netPnl != null ? Math.round(netPnl * 100) / 100 : null,
    currency,
    mood,
    missionsCompleted,
    missionsTotal,
  };
}
