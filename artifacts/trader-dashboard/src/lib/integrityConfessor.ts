/**
 * AUREUS PROTOCOL — Il Confessore dell'Integrità (Post-Session Debriefing)
 *
 * Motore deterministico di auto-esame stoico per la disciplina operativa.
 * Valuta l'aderenza ai 3 principi cardinali:
 * 1. Rispetto Stop Loss & Drawdown
 * 2. Silenzio Operativo & Anti-Overtrading
 * 3. Trascrizione Fedele nel Libro della Verità
 */

export type StopLossChoice = "strict" | "hesitated" | "violated";
export type AntiOvertradingChoice = "monastic" | "tempted" | "violated";
export type TruthfulLedgerChoice = "faithful" | "partial" | "omitted";
export type ConfessionSeal = "inviolable" | "watchful" | "drift";

export interface ConfessionAnswers {
  stopLoss: StopLossChoice;
  antiOvertrading: AntiOvertradingChoice;
  truthfulLedger: TruthfulLedgerChoice;
  tacticalNote?: string;
}

export interface ConfessionRecord {
  date: string; // YYYY-MM-DD
  timestamp: string; // ISO 8601
  answers: ConfessionAnswers;
  score: number; // 0 - 100
  sealType: ConfessionSeal;
  sealLabel: string;
  sealColor: string;
  hash: string;
}

const STORAGE_KEY = "aureus_confessor_ledger_v1";

/**
 * Calcola il punteggio di disciplina (0 - 100) e il sigillo corrispondente
 */
export function computeConfessionScore(answers: ConfessionAnswers): {
  score: number;
  sealType: ConfessionSeal;
  sealLabel: string;
  sealColor: string;
} {
  let score = 0;

  // 1. Stop Loss (Max 35 punti)
  if (answers.stopLoss === "strict") {
    score += 35;
  } else if (answers.stopLoss === "hesitated") {
    score += 15;
  } else {
    score -= 10;
  }

  // 2. Anti-Overtrading (Max 35 punti)
  if (answers.antiOvertrading === "monastic") {
    score += 35;
  } else if (answers.antiOvertrading === "tempted") {
    score += 20;
  } else {
    score -= 10;
  }

  // 3. Trascrizione Fedele (Max 30 punti)
  if (answers.truthfulLedger === "faithful") {
    score += 30;
  } else if (answers.truthfulLedger === "partial") {
    score += 10;
  } else {
    score -= 20;
  }

  const clampedScore = Math.max(0, Math.min(100, score));

  if (clampedScore >= 90) {
    return {
      score: clampedScore,
      sealType: "inviolable",
      sealLabel: "Sigillo di Disciplina Inviolata",
      sealColor: "#10b981", // Smeraldo dell'Integrità
    };
  }

  if (clampedScore >= 60) {
    return {
      score: clampedScore,
      sealType: "watchful",
      sealLabel: "Monito dell'Ordine: Vigilanza Attiva",
      sealColor: "#C5A059", // Oro Aureo di Monito
    };
  }

  return {
    score: clampedScore,
    sealType: "drift",
    sealLabel: "Allerta di Deriva: Fermo Raccomandato",
    sealColor: "#ef4444", // Rubino della Disciplina
  };
}

/**
 * Calcola l'hash crittografico a 16 caratteri della confessione
 */
export function computeConfessionHash(date: string, answers: ConfessionAnswers, score: number): string {
  const payload = `${date}::${answers.stopLoss}::${answers.antiOvertrading}::${answers.truthfulLedger}::${score}`;
  let h1 = 0x811c9dc5 ^ 0;
  let h2 = 0x27d4eb2f ^ 0;

  for (let i = 0; i < payload.length; i++) {
    const ch = payload.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619);
    h2 = Math.imul(h2 ^ (ch << 1), 3266489909);
  }

  const p1 = (h1 >>> 0).toString(16).padStart(8, "0").toUpperCase();
  const p2 = (h2 >>> 0).toString(16).padStart(8, "0").toUpperCase();
  return `0x${p1}${p2}`;
}

export function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getAllConfessions(): Record<string, ConfessionRecord> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getConfessionForDate(dateStr = getTodayKey()): ConfessionRecord | null {
  const all = getAllConfessions();
  return all[dateStr] || null;
}

export function hasConfessedToday(): boolean {
  return Boolean(getConfessionForDate());
}

export function saveConfession(answers: ConfessionAnswers, dateStr = getTodayKey()): ConfessionRecord {
  const evaluation = computeConfessionScore(answers);
  const hash = computeConfessionHash(dateStr, answers, evaluation.score);
  const record: ConfessionRecord = {
    date: dateStr,
    timestamp: new Date().toISOString(),
    answers,
    score: evaluation.score,
    sealType: evaluation.sealType,
    sealLabel: evaluation.sealLabel,
    sealColor: evaluation.sealColor,
    hash,
  };

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const all = getAllConfessions();
      all[dateStr] = record;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent("aureus_confession_updated", { detail: record }));
    } catch (err) {
      console.warn("Impossibile salvare la confessione nel ledger locale:", err);
    }
  }

  return record;
}
