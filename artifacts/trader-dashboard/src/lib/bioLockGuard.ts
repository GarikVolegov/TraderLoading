// ─── PRESIDIO BIO-LOCK PRE-ESECUZIONE & CORRELAZIONE CARDIO-PERFORMANCE (AUREUS PROTOCOL) ───
// Governa il blocco preventivo del sigillo esecutivo in presenza di Rischio Deriva cardiaca
// e calcola la matrice di correlazione tra fasce BPM (< 75, 75-91, >= 92) e rendimento nel Libro della Verità.

export interface BioLockConfig {
  /** Attiva il Presidio Bio-Lock che richiede 1 ciclo di Respiro 4-7-8 se il battito supera la soglia */
  enabled: boolean;
  /** Soglia BPM oltre la quale si attiva il blocco di sicurezza (default: 92 BPM) */
  maxBpmThreshold: number;
  /** Minuti di validità dello sblocco dopo aver completato il Respiro Tattico 4-7-8 (default: 15 min) */
  gracePeriodMinutes: number;
}

export const DEFAULT_BIOLOCK_CONFIG: BioLockConfig = {
  enabled: true,
  maxBpmThreshold: 92,
  gracePeriodMinutes: 15,
};

const BIOLOCK_CONFIG_STORAGE_KEY = "aureus_biolock_config_v1";
const BIOLOCK_LAST_BREATH_KEY = "aureus_biolock_last_breath_ts_v1";

export function loadBioLockConfig(): BioLockConfig {
  if (typeof window === "undefined") return { ...DEFAULT_BIOLOCK_CONFIG };
  try {
    const raw = localStorage.getItem(BIOLOCK_CONFIG_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BIOLOCK_CONFIG };
    const parsed = JSON.parse(raw);
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_BIOLOCK_CONFIG.enabled,
      maxBpmThreshold:
        typeof parsed.maxBpmThreshold === "number" && parsed.maxBpmThreshold >= 75 && parsed.maxBpmThreshold <= 130
          ? parsed.maxBpmThreshold
          : DEFAULT_BIOLOCK_CONFIG.maxBpmThreshold,
      gracePeriodMinutes:
        typeof parsed.gracePeriodMinutes === "number" && parsed.gracePeriodMinutes >= 1 && parsed.gracePeriodMinutes <= 120
          ? parsed.gracePeriodMinutes
          : DEFAULT_BIOLOCK_CONFIG.gracePeriodMinutes,
    };
  } catch {
    return { ...DEFAULT_BIOLOCK_CONFIG };
  }
}

export function saveBioLockConfig(config: BioLockConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BIOLOCK_CONFIG_STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event("aureus-biolock-updated"));
  } catch {
    // ignore storage errors
  }
}

export function recordBreathAlignmentTimestamp(nowMs: number = Date.now()): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BIOLOCK_LAST_BREATH_KEY, String(nowMs));
    window.dispatchEvent(new Event("aureus-biolock-updated"));
  } catch {
    // ignore
  }
}

export function getLastBreathAlignmentTimestamp(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BIOLOCK_LAST_BREATH_KEY);
    if (!raw) return null;
    const num = Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  } catch {
    return null;
  }
}

export interface BioLockEvaluation {
  isLocked: boolean;
  isGraceActive: boolean;
  remainingGraceMinutes: number;
  currentBpm: number;
  thresholdBpm: number;
  reason: string | null;
}

/**
 * Valuta se il Presidio Bio-Lock blocca l'esecuzione / registrazione del trade
 * in attesa di 1 ciclo di Respiro Tattico 4-7-8.
 */
export function evaluateBioLockStatus(params: {
  config: BioLockConfig;
  currentBpm: number;
  isCriticalDrift?: boolean;
  lastBreathMs?: number | null;
  nowMs?: number;
}): BioLockEvaluation {
  const {
    config,
    currentBpm,
    isCriticalDrift = false,
    lastBreathMs = null,
    nowMs = Date.now(),
  } = params;

  const graceWindowMs = config.gracePeriodMinutes * 60_000;
  const elapsedSinceBreath =
    lastBreathMs != null && lastBreathMs > 0 ? Math.max(0, nowMs - lastBreathMs) : Infinity;
  const isGraceActive = elapsedSinceBreath <= graceWindowMs;
  const remainingGraceMinutes = isGraceActive
    ? Math.max(1, Math.ceil((graceWindowMs - elapsedSinceBreath) / 60_000))
    : 0;

  if (!config.enabled) {
    return {
      isLocked: false,
      isGraceActive,
      remainingGraceMinutes,
      currentBpm,
      thresholdBpm: config.maxBpmThreshold,
      reason: null,
    };
  }

  const exceedsBpm = currentBpm >= config.maxBpmThreshold || isCriticalDrift;
  if (!exceedsBpm) {
    return {
      isLocked: false,
      isGraceActive,
      remainingGraceMinutes,
      currentBpm,
      thresholdBpm: config.maxBpmThreshold,
      reason: null,
    };
  }

  if (isGraceActive) {
    return {
      isLocked: false,
      isGraceActive: true,
      remainingGraceMinutes,
      currentBpm,
      thresholdBpm: config.maxBpmThreshold,
      reason: null,
    };
  }

  return {
    isLocked: true,
    isGraceActive: false,
    remainingGraceMinutes: 0,
    currentBpm,
    thresholdBpm: config.maxBpmThreshold,
    reason: `Battito in Rischio Deriva (${currentBpm} BPM ≥ ${config.maxBpmThreshold} BPM). Completa il Respiro 4-7-8 per sbloccare il sigillo.`,
  };
}

// ─── PASSO 3: ANALISI CORRELAZIONE CARDIO-PERFORMANCE NEL LIBRO DELLA VERITÀ ───

export type CardioBandId = "zen" | "vigilant" | "drift";

export interface CardioBandMetrics {
  id: CardioBandId;
  title: string;
  rangeLabel: string;
  color: string;
  tradesCount: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  netPnl: number;
  avgPnl: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  avgBpm: number;
  cumulativeCurve: number[];
}

export interface CardioPerformanceCorrelationReport {
  totalAnalyzedTrades: number;
  liveBleTaggedCount: number;
  bands: {
    zen: CardioBandMetrics;
    vigilant: CardioBandMetrics;
    drift: CardioBandMetrics;
  };
  /** Differenza di Win Rate tra Assetto Zen e Rischio Deriva (punti percentuali) */
  clarityWinRateEdge: number;
  /** Capitale bruciato nelle operazioni eseguite in fascia Rischio Deriva (>= 92 BPM) */
  tachycardiaBleedEuro: number;
  /** Verdetto sintetico del Custode della Soglia */
  sovereignVerdict: string;
}

export interface RawJournalTradeInput {
  id?: string | number;
  title?: string | null;
  content?: string | null;
  tags?: string | null;
  result?: string | null;
  profit?: number | null;
  tradeDate?: string | null;
}

/**
 * Estrae il BPM effettivo (Smartwatch BLE registrato o stima fisiologica deterministica)
 * da una voce del Libro della Verità.
 */
export function extractTradeBpm(entry: RawJournalTradeInput, parsedProfit: number): {
  bpm: number;
  isLiveBleTag: boolean;
} {
  const rawTags = (entry.tags ?? "")
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  const rawContent = entry.content ?? "";

  // 1. Tag diretto BPM-XX (es. BPM-72)
  const bpmTag = rawTags.find((t) => /^bpm-(\d+)$/.test(t));
  if (bpmTag) {
    const val = parseInt(bpmTag.replace("bpm-", ""), 10);
    if (Number.isFinite(val) && val >= 40 && val <= 210) {
      return { bpm: val, isLiveBleTag: true };
    }
  }

  // 2. Riga strutturata "Biometria: XX BPM" nel content
  const contentMatch = rawContent.match(/Biometria:\s*(\d+)\s*BPM/i);
  if (contentMatch) {
    const val = parseInt(contentMatch[1], 10);
    if (Number.isFinite(val) && val >= 40 && val <= 210) {
      return { bpm: val, isLiveBleTag: true };
    }
  }

  // 3. Stima fisiologica deterministica dai marcatori di disciplina e risultato
  const hasCalm =
    rawTags.includes("cardio-zen") ||
    rawTags.includes("respiro-478") ||
    rawTags.includes("respiro") ||
    rawTags.includes("calma") ||
    rawContent.toLowerCase().includes("respiro tattico");

  const hasDriftLeak =
    rawTags.includes("cardio-deriva") ||
    rawTags.includes("fomo") ||
    rawTags.includes("revenge") ||
    rawTags.includes("overtrading") ||
    rawTags.includes("anticipazione") ||
    rawTags.includes("rabbia") ||
    rawTags.includes("impazienza");

  const hasVigilantTag =
    rawTags.includes("cardio-vigile") ||
    rawTags.includes("esitazione") ||
    rawTags.includes("uscita_prematura") ||
    rawTags.includes("paura_stop");

  if (hasDriftLeak) {
    return { bpm: parsedProfit < 0 ? 98 : 94, isLiveBleTag: false };
  }
  if (hasCalm) {
    return { bpm: parsedProfit >= 0 ? 64 : 68, isLiveBleTag: false };
  }
  if (hasVigilantTag) {
    return { bpm: 82, isLiveBleTag: false };
  }

  // Fallback basato su esito
  if (parsedProfit > 0 || entry.result === "win") {
    return { bpm: 70, isLiveBleTag: false };
  }
  if (parsedProfit < 0 || entry.result === "loss") {
    return { bpm: 84, isLiveBleTag: false };
  }
  return { bpm: 74, isLiveBleTag: false };
}

export function classifyCardioBand(bpm: number, driftThreshold: number = 92): CardioBandId {
  if (bpm < 75) return "zen";
  if (bpm < driftThreshold) return "vigilant";
  return "drift";
}

function createEmptyBand(id: CardioBandId, title: string, rangeLabel: string, color: string): CardioBandMetrics {
  return {
    id,
    title,
    rangeLabel,
    color,
    tradesCount: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    winRate: 0,
    netPnl: 0,
    avgPnl: 0,
    grossProfit: 0,
    grossLoss: 0,
    profitFactor: 0,
    avgBpm: 0,
    cumulativeCurve: [0],
  };
}

/**
 * Calcola la correlazione completa tra le 3 fasce biometriche (< 75 BPM, 75-91 BPM, >= 92 BPM)
 * e le performance finanziarie registrate ne Il Libro della Verità.
 */
export function computeCardioPerformanceCorrelation(
  entries: RawJournalTradeInput[],
  extractProfitFn: (entry: RawJournalTradeInput) => number,
  driftThreshold: number = 92
): CardioPerformanceCorrelationReport {
  const bands = {
    zen: createEmptyBand("zen", "Assetto Zen", "< 75 BPM", "#10b981"),
    vigilant: createEmptyBand("vigilant", "Assetto Vigile", `75–${driftThreshold - 1} BPM`, "#C5A059"),
    drift: createEmptyBand("drift", "Rischio Deriva", `≥ ${driftThreshold} BPM`, "#ef4444"),
  };

  const bpmSums: Record<CardioBandId, number> = { zen: 0, vigilant: 0, drift: 0 };
  let liveBleTaggedCount = 0;
  let tachycardiaBleedEuro = 0;

  // Ordina cronologicamente per costruire le curve cumulative di ciascuna fascia
  const sorted = [...entries].sort((a, b) => {
    const da = a.tradeDate ? new Date(a.tradeDate).getTime() : 0;
    const db = b.tradeDate ? new Date(b.tradeDate).getTime() : 0;
    return da - db;
  });

  for (const entry of sorted) {
    const pnl = extractProfitFn(entry);
    const { bpm, isLiveBleTag } = extractTradeBpm(entry, pnl);
    if (isLiveBleTag) liveBleTaggedCount++;

    const bandId = classifyCardioBand(bpm, driftThreshold);
    const band = bands[bandId];

    band.tradesCount++;
    bpmSums[bandId] += bpm;

    const isWin = entry.result === "win" || (entry.result == null && pnl > 0);
    const isLoss = entry.result === "loss" || (entry.result == null && pnl < 0);

    if (isWin) {
      band.wins++;
    } else if (isLoss) {
      band.losses++;
    } else {
      band.breakevens++;
    }

    band.netPnl = Math.round((band.netPnl + pnl) * 100) / 100;
    if (pnl > 0) {
      band.grossProfit = Math.round((band.grossProfit + pnl) * 100) / 100;
    } else if (pnl < 0) {
      band.grossLoss = Math.round((band.grossLoss + Math.abs(pnl)) * 100) / 100;
      if (bandId === "drift") {
        tachycardiaBleedEuro = Math.round((tachycardiaBleedEuro + Math.abs(pnl)) * 100) / 100;
      }
    }

    const prevCum = band.cumulativeCurve[band.cumulativeCurve.length - 1] ?? 0;
    band.cumulativeCurve.push(Math.round((prevCum + pnl) * 100) / 100);
  }

  for (const id of ["zen", "vigilant", "drift"] as const) {
    const b = bands[id];
    if (b.tradesCount > 0) {
      b.winRate = Math.round((b.wins / b.tradesCount) * 100);
      b.avgPnl = Math.round((b.netPnl / b.tradesCount) * 100) / 100;
      b.avgBpm = Math.round(bpmSums[id] / b.tradesCount);
      b.profitFactor =
        b.grossLoss > 0
          ? Math.round((b.grossProfit / b.grossLoss) * 100) / 100
          : b.grossProfit > 0
          ? 9.99
          : 0;
    }
  }

  const clarityWinRateEdge =
    bands.zen.tradesCount > 0 && bands.drift.tradesCount > 0
      ? bands.zen.winRate - bands.drift.winRate
      : bands.zen.winRate;

  let sovereignVerdict = "Registra operazioni con Smartwatch BLE attivo per calibrare la curva cardio-esecutiva.";
  if (entries.length > 0) {
    if (bands.drift.tradesCount > 0 && tachycardiaBleedEuro > 0) {
      sovereignVerdict = `La tachicardia emotiva (≥ ${driftThreshold} BPM) ha eroso -${tachycardiaBleedEuro.toFixed(2)} €. Il Presidio Bio-Lock 4-7-8 protegge questo capitale.`;
    } else if (bands.zen.winRate >= 60) {
      sovereignVerdict = `Eccellenza Neocorticale: in Assetto Zen (< 75 BPM) il tuo Win Rate raggiunge il ${bands.zen.winRate}% con PF ${bands.zen.profitFactor.toFixed(2)}.`;
    } else {
      sovereignVerdict = `Stabilità fisiologica rilevata su ${entries.length} operazioni. Mantieni il Respiro 4-7-8 prima di ogni ingresso.`;
    }
  }

  return {
    totalAnalyzedTrades: entries.length,
    liveBleTaggedCount,
    bands,
    clarityWinRateEdge,
    tachycardiaBleedEuro,
    sovereignVerdict,
  };
}
