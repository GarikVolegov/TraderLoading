// Helper puri di mapping/scoring usati dallo store dei Tornei. Tenuti separati da
// `store.ts` così non dipendono da `db` e restano testabili senza DATABASE_URL.

import { rMultiple, type EdgeTrade } from "../tradeAnalytics.js";
import { type TorneiTrade } from "./standings.js";
import { MAX_RISK_PCT, divisionForScore } from "./constants.js";

const num = (value: string | null): number | null => (value === null ? null : Number(value));

// Riga grezza selezionata da accountTradesTable per il calcolo del torneo.
export type AccountTradeRow = {
  symbol: string;
  direction: string;
  openTime: string;
  closeTime: string | null;
  entryPrice: string | null;
  exitPrice: string | null;
  stopLoss: string | null;
  profit: string | null;
  returnPct: string | null;
  journalEntryId: number | null;
};

// Mapper puro: account trade → trade del torneo.
// riskPct deriva da returnPct (= profit/saldo·100, account-relative) e R:
//   ritorno = R × rischio  ⇒  rischio% = |ritorno%| / |R|.
export function mapAccountTradeToTorneiTrade(row: AccountTradeRow): TorneiTrade {
  const edge: EdgeTrade = {
    symbol: row.symbol,
    direction: row.direction,
    openTime: row.openTime,
    closeTime: row.closeTime,
    entryPrice: num(row.entryPrice),
    exitPrice: num(row.exitPrice),
    stopLoss: num(row.stopLoss),
    profit: num(row.profit),
  };
  const r = rMultiple(edge);
  const ret = num(row.returnPct);
  const riskPct = ret !== null && r !== null && r !== 0 ? Math.abs(ret) / Math.abs(r) : null;
  return { rMultiple: r, riskPct, journaled: row.journalEntryId !== null };
}

// Indice Disciplina puro (0-100): 100 meno le violazioni di guardrail.
// Penalizza i trade che sforano lo stop (peggio di -1R) o il rischio massimo.
export function disciplineIndexFor(trades: TorneiTrade[]): number {
  // Non si filtra su `journaled` (link mutabile dall'utente). Il caso "0 trade"
  // resta 100 per il display, ma non frutta premi: qualifyPrizes richiede
  // un'attività minima (MIN_PRIZE_TRADES) per QUALSIASI tier.
  const valid = trades.filter((t) => t.rMultiple !== null);
  if (valid.length === 0) return 100;
  let breaches = 0;
  for (const t of valid) {
    const r = t.rMultiple as number;
    if (r < -1.05) breaches += 1; // stop sforato
    else if (t.riskPct !== null && t.riskPct > MAX_RISK_PCT) breaches += 1; // rischio sforato
  }
  const index = Math.round(100 * (1 - breaches / valid.length));
  return Math.max(0, Math.min(100, index));
}

// Prossima divisione raggiungibile dato uno score (per la vista Percorso).
export function nextDivisionFor(score: number): string | null {
  const current = divisionForScore(score);
  const order = ["bronzo", "argento", "oro", "diamante"];
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;
}
