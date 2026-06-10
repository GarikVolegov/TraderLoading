// Ricostruzione della progressione del balance del conto dai deal chiusi del
// Broker Hub, ancorata al saldo reale dello snapshot: l'ultimo punto della
// curva È il balance attuale del conto, e ogni punto precedente si ottiene
// sottraendo il netto dei deal successivi.

import type { BrokerDeal } from "./types";

export interface AccountEquityPoint {
  /** Giorno (yyyy-mm-dd). */
  date: string;
  /** P&L netto del giorno (profit + commission + swap). */
  pnl: number;
  /** Balance del conto a fine giornata. */
  balance: number;
}

export interface AccountEquityStats {
  points: AccountEquityPoint[];
  /** Balance del conto all'inizio della finestra. */
  startBalance: number;
  /** Balance attuale (ancora = snapshot del broker). */
  endBalance: number;
  /** P&L netto della finestra. */
  periodPnl: number;
  /** Variazione percentuale del balance nella finestra. */
  periodPct: number | null;
  /** Massimo drawdown sul balance (valore <= 0). */
  maxDrawdown: number;
  bestDay: AccountEquityPoint | null;
  worstDay: AccountEquityPoint | null;
  dealCount: number;
}

function dealNet(deal: BrokerDeal): number {
  return (deal.profit ?? 0) + (deal.commission ?? 0) + (deal.swap ?? 0);
}

function dealDay(deal: BrokerDeal): string | null {
  const raw = deal.closedAt ?? deal.openedAt;
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calcola la serie del balance per la finestra richiesta (giorni indietro da
 * oggi; null = tutto lo storico). I deal senza data o senza profitto numerico
 * vengono ignorati.
 */
export function computeAccountEquity(
  history: BrokerDeal[] | undefined,
  currentBalance: number,
  windowDays: number | null,
): AccountEquityStats {
  const dailyNet = new Map<string, { pnl: number; deals: number }>();

  for (const deal of history ?? []) {
    if (typeof deal.profit !== "number" || !Number.isFinite(deal.profit)) continue;
    const day = dealDay(deal);
    if (!day) continue;
    const bucket = dailyNet.get(day) ?? { pnl: 0, deals: 0 };
    bucket.pnl += dealNet(deal);
    bucket.deals += 1;
    dailyNet.set(day, bucket);
  }

  const allDays = [...dailyNet.keys()].sort();

  let cutoffKey: string | null = null;
  if (windowDays != null) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - windowDays);
    cutoffKey = cutoff.toISOString().slice(0, 10);
  }
  const windowDayKeys = cutoffKey ? allDays.filter((d) => d >= cutoffKey) : allDays;

  // Ricostruzione all'indietro: il balance attuale è l'ancora.
  // balance a fine dell'ultimo giorno = currentBalance; ogni giorno precedente
  // si ottiene togliendo il P&L dei giorni successivi.
  const balanceByDay = new Map<string, number>();
  let running = currentBalance;
  for (let i = allDays.length - 1; i >= 0; i--) {
    const day = allDays[i];
    balanceByDay.set(day, round2(running));
    running -= dailyNet.get(day)!.pnl;
  }

  const points: AccountEquityPoint[] = windowDayKeys.map((date) => ({
    date,
    pnl: round2(dailyNet.get(date)!.pnl),
    balance: balanceByDay.get(date)!,
  }));

  const dealCount = windowDayKeys.reduce((sum, d) => sum + (dailyNet.get(d)?.deals ?? 0), 0);
  const periodPnl = round2(points.reduce((sum, p) => sum + p.pnl, 0));
  const startBalance = points.length > 0 ? round2(points[0].balance - points[0].pnl) : round2(currentBalance);

  let peak = startBalance;
  let maxDrawdown = 0;
  let bestDay: AccountEquityPoint | null = null;
  let worstDay: AccountEquityPoint | null = null;
  for (const point of points) {
    peak = Math.max(peak, point.balance);
    maxDrawdown = Math.min(maxDrawdown, round2(point.balance - peak));
    if (!bestDay || point.pnl > bestDay.pnl) bestDay = point;
    if (!worstDay || point.pnl < worstDay.pnl) worstDay = point;
  }

  return {
    points,
    startBalance,
    endBalance: round2(currentBalance),
    periodPnl,
    periodPct: startBalance > 0 ? round2((periodPnl / startBalance) * 100) : null,
    maxDrawdown,
    bestDay,
    worstDay,
    dealCount,
  };
}
