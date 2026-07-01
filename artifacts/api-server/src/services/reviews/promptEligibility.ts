// Controllo puro: decide se mostrare il prompt "lascia una recensione" nel momento
// giusto. Un utente è idoneo se ha un minimo di attività reale (operazioni chiuse a
// diario) e non ha già recensito; il prompt scatta solo dopo un picco positivo
// (level-up, streak attiva, o verdetto positivo del coach passato dal client) e mai
// se l'utente ha rinviato (snooze) o rifiutato definitivamente (opt-out).

// Numero minimo di operazioni chiuse per considerare l'utente "reale e attivo".
export const MIN_TRADES_FOR_REVIEW = 5;
// Soglia di streak (giorni consecutivi) che conta come segnale positivo.
export const STREAK_SIGNAL_THRESHOLD = 3;

// Suggerimento inviato dal client quando l'utente arriva da un momento positivo.
export type PromptSignal = "level" | "streak" | "coach" | "none";

export type PromptInput = {
  closedTrades: number;
  level: number;
  streak: number;
  /** Segnale positivo passato dal client (es. dopo un recap/coach positivo). */
  clientSignal: PromptSignal;
  /** Esiste già una recensione viva (pending o approved) di questo utente. */
  hasReviewed: boolean;
  optedOut: boolean;
  snoozedUntil: Date | null;
  now: Date;
  /** Override della soglia minima di operazioni (default MIN_TRADES_FOR_REVIEW). */
  minTrades?: number;
};

export type PromptReason =
  | "opted_out"
  | "snoozed"
  | "already_reviewed"
  | "below_threshold"
  | "no_signal"
  | "level"
  | "streak"
  | "coach";

export type PromptResult = {
  shouldPrompt: boolean;
  eligible: boolean;
  hasReviewed: boolean;
  reason: PromptReason;
};

export function evaluateReviewPrompt(input: PromptInput): PromptResult {
  const minTrades = input.minTrades ?? MIN_TRADES_FOR_REVIEW;

  // Preferenze dell'utente: hanno la precedenza su qualsiasi segnale.
  if (input.optedOut) {
    return { shouldPrompt: false, eligible: false, hasReviewed: input.hasReviewed, reason: "opted_out" };
  }
  if (input.snoozedUntil && input.snoozedUntil.getTime() > input.now.getTime()) {
    return { shouldPrompt: false, eligible: false, hasReviewed: input.hasReviewed, reason: "snoozed" };
  }
  if (input.hasReviewed) {
    return { shouldPrompt: false, eligible: false, hasReviewed: true, reason: "already_reviewed" };
  }

  // Idoneità: attività minima reale.
  if (input.closedTrades < minTrades) {
    return { shouldPrompt: false, eligible: false, hasReviewed: false, reason: "below_threshold" };
  }

  // Segnale positivo (uno qualsiasi basta). L'ordine definisce quale motivo riportare.
  if (input.clientSignal === "coach") {
    return { shouldPrompt: true, eligible: true, hasReviewed: false, reason: "coach" };
  }
  if (input.level > 1 || input.clientSignal === "level") {
    return { shouldPrompt: true, eligible: true, hasReviewed: false, reason: "level" };
  }
  if (input.streak >= STREAK_SIGNAL_THRESHOLD || input.clientSignal === "streak") {
    return { shouldPrompt: true, eligible: true, hasReviewed: false, reason: "streak" };
  }

  // Idoneo, ma nessun picco positivo adesso: non disturbare.
  return { shouldPrompt: false, eligible: true, hasReviewed: false, reason: "no_signal" };
}
