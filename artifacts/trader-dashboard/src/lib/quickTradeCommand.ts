import { AVAILABLE_TAGS } from "../components/journal/SessionDetailInspector.js";

export interface QuickTradeParsed {
  isValid: boolean;
  error?: string;
  symbol: string;
  direction: "buy" | "sell";
  result: "win" | "loss" | "breakeven";
  profit: number;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  rMultiple?: number;
  tags: string[];
  notes: string;
  title: string;
  rawContent: string;
}

const KNOWN_SYMBOLS = new Set([
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
  "XAUUSD",
  "BTCUSD",
  "ETHUSD",
  "US30",
  "NAS100",
  "SPX500",
  "GER40",
]);

function isKnownTagToken(tok: string): boolean {
  const lower = tok.toLowerCase();
  return AVAILABLE_TAGS.some(
    (t) => t.id.toLowerCase() === lower || t.label.toLowerCase() === lower,
  );
}

/**
 * Esegue il parsing stoico e rigoroso del comando da riga di comando per il diario:
 *
 * Sintassi 1 (Esito diretto):
 *   trade win 150 EURUSD piano target
 *   trade loss -80 GBPUSD fomo
 *   trade be 0 USDJPY
 *
 * Sintassi 2 (Parametrico con Stop Loss obbligatorio):
 *   trade buy EURUSD 1.0850 sl 1.0820 tp 1.0910 piano
 *   trade sell GBPUSD 1.2750 sl 1.2800 tp 1.2650
 */
export function parseQuickTradeCommand(input: string): QuickTradeParsed | null {
  const trimmed = input.trim();
  if (!/^(?:\/)?trade\b/i.test(trimmed)) {
    return null;
  }

  const payload = trimmed.replace(/^(?:\/)?trade\s*/i, "").trim();
  if (!payload) {
    return {
      isValid: false,
      error: "Sintassi: trade [win|loss|be] [profit] [simbolo] oppure trade [buy|sell] [simbolo] [entry] sl [sl] tp [tp]",
      symbol: "EURUSD",
      direction: "buy",
      result: "win",
      profit: 0,
      tags: [],
      notes: "",
      title: "Nuovo Trade Rapido",
      rawContent: "",
    };
  }

  const tokens = payload.split(/\s+/);
  const firstToken = tokens[0]?.toLowerCase();

  // ── SINTASSI 1: trade [win|loss|be] [pnl] [symbol] [tags/notes] ───────────
  if (firstToken === "win" || firstToken === "loss" || firstToken === "be" || firstToken === "breakeven") {
    const outcomeResult: "win" | "loss" | "breakeven" =
      firstToken === "win" ? "win" : firstToken === "loss" ? "loss" : "breakeven";

    let rawPnl: number | null = null;
    let symbol = "EURUSD";
    let symbolFound = false;
    const remainingTokens: string[] = [];

    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i];
      const num = parseFloat(tok.replace(/^[+€$]/, "").replace(/[€$]$/, ""));
      if (rawPnl === null && !isNaN(num)) {
        rawPnl = tok.startsWith("-") || outcomeResult === "loss" ? -Math.abs(num) : Math.abs(num);
      } else if (isKnownTagToken(tok)) {
        remainingTokens.push(tok);
      } else if (!symbolFound && (KNOWN_SYMBOLS.has(tok.toUpperCase()) || /^[A-Z]{3}\/?[A-Z]{3}$/i.test(tok) || /^[A-Z0-9]{3,7}$/i.test(tok))) {
        symbol = tok.toUpperCase().replace("/", "");
        symbolFound = true;
      } else {
        remainingTokens.push(tok);
      }
    }

    const profit = rawPnl ?? (outcomeResult === "win" ? 100 : outcomeResult === "loss" ? -100 : 0);
    const direction: "buy" | "sell" = "buy";

    // Extract recognized tags
    const recognizedTags: string[] = [];
    const notesTokens: string[] = [];

    for (const tok of remainingTokens) {
      const lower = tok.toLowerCase();
      const matched = AVAILABLE_TAGS.find(
        (t) => t.id.toLowerCase() === lower || t.label.toLowerCase().includes(lower),
      );
      if (matched) {
        if (!recognizedTags.includes(matched.id)) recognizedTags.push(matched.id);
      } else {
        notesTokens.push(tok);
      }
    }

    const notes = notesTokens.join(" ");
    const pnlFormatted = profit >= 0 ? `+€${profit.toFixed(2)}` : `-€${Math.abs(profit).toFixed(2)}`;
    const title = `${symbol} · ${outcomeResult.toUpperCase()} (${pnlFormatted})`;
    const ticketId = `CMD-${Date.now().toString().slice(-6)}`;

    const rawContent = [
      `Ticket: #${ticketId}`,
      `Symbol: ${symbol}`,
      `Direction: ${direction.toUpperCase()}`,
      `Profit: ${profit.toFixed(2)}`,
      `Outcome: ${outcomeResult.toUpperCase()}`,
      notes ? `Notes: ${notes}` : `Notes: Registrato da Command Palette (⌘K)`,
    ].join("\n");

    return {
      isValid: true,
      symbol,
      direction,
      result: outcomeResult,
      profit,
      tags: recognizedTags,
      notes,
      title,
      rawContent,
    };
  }

  // ── SINTASSI 2: trade [buy|sell] [symbol] [entry] sl [sl] tp [tp] ─────────
  if (firstToken === "buy" || firstToken === "sell" || firstToken === "long" || firstToken === "short") {
    const direction: "buy" | "sell" = firstToken === "buy" || firstToken === "long" ? "buy" : "sell";
    let symbol = "EURUSD";
    let symbolFound = false;
    let entryPrice: number | undefined;
    let stopLoss: number | undefined;
    let takeProfit: number | undefined;
    const remainingTokens: string[] = [];

    let currentModifier: "sl" | "tp" | "entry" | null = null;

    for (let i = 1; i < tokens.length; i++) {
      const tok = tokens[i];
      const lower = tok.toLowerCase();

      if (lower === "sl" || lower === "stop") {
        currentModifier = "sl";
        continue;
      }
      if (lower === "tp" || (lower === "target" && currentModifier !== null)) {
        currentModifier = "tp";
        continue;
      }
      if (lower === "at" || lower === "entry") {
        currentModifier = "entry";
        continue;
      }

      const num = parseFloat(tok);
      if (!isNaN(num) && num > 0) {
        if (currentModifier === "sl") {
          stopLoss = num;
          currentModifier = null;
        } else if (currentModifier === "tp") {
          takeProfit = num;
          currentModifier = null;
        } else if (currentModifier === "entry" || entryPrice === undefined) {
          entryPrice = num;
          currentModifier = null;
        } else {
          remainingTokens.push(tok);
        }
      } else if (isKnownTagToken(tok)) {
        remainingTokens.push(tok);
      } else if (!symbolFound && (KNOWN_SYMBOLS.has(tok.toUpperCase()) || /^[A-Z]{3}\/?[A-Z]{3}$/i.test(tok) || /^[A-Z0-9]{3,7}$/i.test(tok))) {
        symbol = tok.toUpperCase().replace("/", "");
        symbolFound = true;
      } else {
        remainingTokens.push(tok);
      }
    }

    // Regola Inviolabile AUREUS: Stop Loss Obbligatorio se sono stati indicati prezzi
    if (entryPrice !== undefined && stopLoss === undefined) {
      return {
        isValid: false,
        error: "Il Codice AUREUS impone lo Stop Loss obbligatorio (es. sl 1.0820)",
        symbol,
        direction,
        result: "win",
        profit: 0,
        entryPrice,
        tags: [],
        notes: "",
        title: `${symbol} ${direction.toUpperCase()}`,
        rawContent: "",
      };
    }

    // Calcolo R:R (R-Multiple) se SL e TP sono presenti
    let rMultiple: number | undefined;
    if (entryPrice !== undefined && stopLoss !== undefined && takeProfit !== undefined) {
      const risk = direction === "buy" ? entryPrice - stopLoss : stopLoss - entryPrice;
      const reward = direction === "buy" ? takeProfit - entryPrice : entryPrice - takeProfit;
      if (risk > 0 && reward > 0) {
        rMultiple = Math.round((reward / risk) * 10) / 10;
      }
    }

    // Extract tags from remaining tokens
    const recognizedTags: string[] = [];
    const notesTokens: string[] = [];

    for (const tok of remainingTokens) {
      const lower = tok.toLowerCase();
      const matched = AVAILABLE_TAGS.find(
        (t) => t.id.toLowerCase() === lower || t.label.toLowerCase().includes(lower),
      );
      if (matched) {
        if (!recognizedTags.includes(matched.id)) recognizedTags.push(matched.id);
      } else {
        notesTokens.push(tok);
      }
    }

    const notes = notesTokens.join(" ");
    const ticketId = `CMD-${Date.now().toString().slice(-6)}`;
    const outcomeResult: "win" | "loss" | "breakeven" = "win";
    const estimatedProfit = 100; // default 100 EUR nominal win

    const title = `${symbol} ${direction.toUpperCase()} · ${entryPrice ? `@ ${entryPrice}` : "Setup Eseguito"}${rMultiple ? ` (${rMultiple}R)` : ""}`;

    const rawContent = [
      `Ticket: #${ticketId}`,
      `Symbol: ${symbol}`,
      `Direction: ${direction.toUpperCase()}`,
      `Entry Price: ${entryPrice ?? "-"}`,
      `Stop Loss: ${stopLoss ?? "-"}`,
      `Take Profit: ${takeProfit ?? "-"}`,
      rMultiple ? `R-Multiple: ${rMultiple}` : "",
      `Profit: ${estimatedProfit.toFixed(2)}`,
      notes ? `Notes: ${notes}` : `Notes: Registrato da Command Palette (⌘K)`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      isValid: true,
      symbol,
      direction,
      result: outcomeResult,
      profit: estimatedProfit,
      entryPrice,
      stopLoss,
      takeProfit,
      rMultiple,
      tags: recognizedTags,
      notes,
      title,
      rawContent,
    };
  }

  // Fallback con errore guidato
  return {
    isValid: false,
    error: `Direzione o esito sconosciuto: '${firstToken}'. Usa: win, loss, be, buy, sell`,
    symbol: "EURUSD",
    direction: "buy",
    result: "win",
    profit: 0,
    tags: [],
    notes: "",
    title: "Comando Non Riconosciuto",
    rawContent: "",
  };
}
