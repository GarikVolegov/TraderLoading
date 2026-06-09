// Parser per il contenuto dei trade importati (FX Blue Account Sync / account bridge).
// Il backend serializza i trade come righe "Chiave: Valore" (vedi
// api-server/src/services/brokerHub/accountDataSync.ts e accountBridge/journalImport.ts).
// Qui le ritrasformiamo in campi strutturati per un rendering leggibile.

export interface ParsedTradeContent {
  ticket?: string;
  source?: string;
  broker?: string;
  account?: string;
  symbol?: string;
  direction?: string;
  status?: string;
  volume?: number;
  openTime?: string;
  closeTime?: string;
  entryPrice?: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  profit?: number;
  commission?: number;
  swap?: number;
  currency?: string;
  riskDistance?: number;
  returnPct?: number;
  /** Testo libero aggiunto dall'utente dopo il blocco importato. */
  comment?: string;
}

const KNOWN_KEYS: Record<string, keyof ParsedTradeContent> = {
  "ticket": "ticket",
  "source": "source",
  "broker": "broker",
  "account": "account",
  "symbol": "symbol",
  "direction": "direction",
  "status": "status",
  "volume": "volume",
  "open time": "openTime",
  "close time": "closeTime",
  "entry price": "entryPrice",
  "exit price": "exitPrice",
  "stop loss": "stopLoss",
  "take profit": "takeProfit",
  "profit": "profit",
  "commission": "commission",
  "swap": "swap",
  "rischio prezzo": "riskDistance",
  "rendimento conto": "returnPct",
};

const NUMERIC_FIELDS = new Set<keyof ParsedTradeContent>([
  "volume", "entryPrice", "exitPrice", "stopLoss", "takeProfit",
  "profit", "commission", "swap", "riskDistance", "returnPct",
]);

const MONEY_FIELDS = new Set<keyof ParsedTradeContent>(["profit", "commission", "swap"]);

// Nei tracciati MT4/MT5 un prezzo a 0 significa "non impostato" (es. trade senza stop loss).
const PRICE_FIELDS = new Set<keyof ParsedTradeContent>([
  "entryPrice", "exitPrice", "stopLoss", "takeProfit",
]);

function parseNumeric(raw: string): number | undefined {
  const cleaned = raw.replace("%", "").trim();
  if (!cleaned || cleaned === "-" || cleaned.startsWith("non disponibile")) return undefined;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

/**
 * Estrae i campi del trade dal contenuto importato.
 * Ritorna null se il contenuto non è nel formato di import (es. note manuali).
 */
export function parseTradeContent(content: string | null | undefined): ParsedTradeContent | null {
  if (!content) return null;

  const result: ParsedTradeContent = {};
  const commentLines: string[] = [];
  let matchedKeys = 0;

  for (const line of content.split("\n")) {
    const separator = line.indexOf(":");
    const key = separator > 0 ? line.slice(0, separator).trim().toLowerCase() : "";
    const field = KNOWN_KEYS[key];

    if (!field) {
      if (line.trim()) commentLines.push(line.trim());
      continue;
    }

    matchedKeys++;
    const rawValue = line.slice(separator + 1).trim();
    if (!rawValue || rawValue === "-") continue;

    if (NUMERIC_FIELDS.has(field)) {
      const numeric = parseNumeric(rawValue);
      if (numeric === undefined) continue;
      if (PRICE_FIELDS.has(field) && numeric === 0) continue;
      (result[field] as number) = numeric;
      if (MONEY_FIELDS.has(field) && !result.currency) {
        const currencyMatch = rawValue.match(/[A-Z]{3}$/);
        if (currencyMatch) result.currency = currencyMatch[0];
      }
    } else {
      (result[field] as string) = rawValue;
    }
  }

  // Serve almeno il nucleo identificativo del trade, altrimenti è una nota libera.
  if (matchedKeys < 4 || !result.ticket || !result.symbol) return null;

  if (commentLines.length > 0) result.comment = commentLines.join("\n");
  return result;
}

/** Durata del trade in formato compatto (es. "2g 4h", "3h 12m", "45m"). */
export function tradeDuration(parsed: ParsedTradeContent): string | null {
  if (!parsed.openTime || !parsed.closeTime) return null;
  const open = new Date(parsed.openTime);
  const close = new Date(parsed.closeTime);
  if (Number.isNaN(open.getTime()) || Number.isNaN(close.getTime())) return null;
  const minutes = Math.round((close.getTime() - open.getTime()) / 60_000);
  if (minutes < 0) return null;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}g ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** R-multiple: profitto in rapporto al rischio iniziale (distanza entry-stop). */
export function tradeRMultiple(parsed: ParsedTradeContent): number | null {
  const { profit, entryPrice, stopLoss, exitPrice } = parsed;
  if (
    typeof profit !== "number" ||
    typeof entryPrice !== "number" ||
    typeof stopLoss !== "number" ||
    typeof exitPrice !== "number"
  ) return null;

  const riskDistance = Math.abs(entryPrice - stopLoss);
  const moveDistance = Math.abs(exitPrice - entryPrice);
  if (riskDistance <= 0 || moveDistance <= 0) return null;

  const r = (moveDistance / riskDistance) * Math.sign(profit);
  return Number.isFinite(r) ? Number(r.toFixed(2)) : null;
}
