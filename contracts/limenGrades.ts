/**
 * LIMEN PROTOCOL — "I 5 Gradi di Ascesa" & Indice di Integrità Engine
 *
 * Replaces generic video-game XP levels with 5 merit-gated Initiatic Grades.
 * Advancement is governed by the Indice di Integrità (%), consecutive integral
 * sessions in Il Libro della Verità, and adherence to L'Ordine Giornaliero &
 * Il Custode della Soglia.
 */

export type LimenGradeNumber = 1 | 2 | 3 | 4 | 5;

export type LimenRomanGrade = "I" | "II" | "III" | "IV" | "V";

export type LimenSigilId =
  | "sigil-grade-1"
  | "sigil-grade-2"
  | "sigil-grade-3"
  | "sigil-grade-4"
  | "sigil-grade-5";

export interface LimenGradeDefinition {
  readonly grade: LimenGradeNumber;
  readonly roman: LimenRomanGrade;
  readonly code: string;
  readonly title: string;
  readonly fullTitle: string;
  readonly subtitle: string;
  readonly requirementSummary: string;
  readonly requiredConsecutiveSessions: number;
  readonly minIntegrityPct: number;
  readonly requiredProfitFactor?: number;
  readonly adminOnly?: boolean;
  readonly unlockedPrivileges: readonly string[];
  readonly lockedNotice?: string;
  readonly sigilId: LimenSigilId;
}

export const LIMEN_GRADES: readonly LimenGradeDefinition[] = [
  {
    grade: 1,
    roman: "I",
    code: "GRADO I",
    title: "Novizio Consapevole",
    fullTitle: "GRADO I — Novizio Consapevole",
    subtitle: "Ingresso nell'Ordine e addestramento ai fondamenti operativi.",
    requirementSummary: "Sottoscrizione de Il Patto di Ingresso alla Soglia di Selezione.",
    requiredConsecutiveSessions: 0,
    minIntegrityPct: 0,
    unlockedPrivileges: [
      "Accesso a La Forgia del Passato (Simulatore Storico)",
      "Accesso a La Dottrina del Tempo (Arte dell'Assedio & Arte del Duello)",
      "Accesso a L'Ordine Giornaliero e Il Custode della Soglia",
      "Accesso a Il Libro della Verità",
    ],
    lockedNotice: "Codice di Chiamata (Mandato di Espansione 20%) BLOCCATO al Grado I.",
    sigilId: "sigil-grade-1",
  },
  {
    grade: 2,
    roman: "II",
    code: "GRADO II",
    title: "Il Custode della Regola",
    fullTitle: "GRADO II — Il Custode della Regola",
    subtitle: "Padronanza della disciplina quotidiana e diritto di trasmissione del Codice.",
    requirementSummary:
      "30 sessioni consecutive con Indice di Integrità al 100% ne Il Libro della Verità.",
    requiredConsecutiveSessions: 30,
    minIntegrityPct: 85,
    unlockedPrivileges: [
      "Sblocco sezione «Il Tempio Fisico» (Protocollo Biologico e Nutrizionale)",
      "Sblocco «Il Mandato di Espansione» (Codice di Chiamata con Royalty ricorrente del 20% — 30€/mese)",
      "Accesso completo alle Prove del Fuoco d'Élite",
    ],
    sigilId: "sigil-grade-2",
  },
  {
    grade: 3,
    roman: "III",
    code: "GRADO III",
    title: "L'Osservatore Sovrano",
    fullTitle: "GRADO III — L'Osservatore Sovrano",
    subtitle: "Governo trimestrale del tempo, del corpo e dell'esecuzione.",
    requirementSummary:
      "90 giorni (1 trimestre) di costanza operativa e fisica verificata.",
    requiredConsecutiveSessions: 90,
    minIntegrityPct: 90,
    unlockedPrivileges: [
      "Accesso prioritario e diritto di parola a «Il Concilio della Domenica»",
      "Sblocco moduli di negoziazione avanzata (Straight Line)",
      "Accesso preliminare ai capi riservati de «L'Uniforme»",
    ],
    sigilId: "sigil-grade-3",
  },
  {
    grade: 4,
    roman: "IV",
    code: "GRADO IV",
    title: "L'Architetto del Reale",
    fullTitle: "GRADO IV — L'Architetto del Reale",
    subtitle: "Trasmutazione della disciplina finanziaria in espansione imprenditoriale.",
    requirementSummary:
      "Profittabilità verificata e superamento prove di comunicazione/vendita (Straight Line).",
    requiredConsecutiveSessions: 120,
    minIntegrityPct: 92,
    requiredProfitFactor: 1.5,
    unlockedPrivileges: [
      "Sblocco completo «LIMEN B2B / Rete Imprenditoriale» (Segnalazione e chiusura contratti)",
      "Diritto di acquisizione capi esclusivi de «L'Uniforme» (Grado IV)",
      "Rango di Garante Seniore ne La Fratellanza",
    ],
    sigilId: "sigil-grade-4",
  },
  {
    grade: 5,
    roman: "V",
    code: "GRADO V",
    title: "Il Fondatore d'Eredità",
    fullTitle: "GRADO V — Il Fondatore d'Eredità",
    subtitle: "Custode supremo del Protocollo e membro della Cerchia Interna.",
    requirementSummary: "Investitura diretta ed esclusiva da parte del Comando (Cerchia Interna).",
    requiredConsecutiveSessions: 180,
    minIntegrityPct: 95,
    adminOnly: true,
    unlockedPrivileges: [
      "Membro della Cerchia Interna LIMEN",
      "Sovranità operativa su tutte le divisioni dell'Ecosistema",
      "Diritto di nomina e revisione nel Concilio della Domenica",
    ],
    sigilId: "sigil-grade-5",
  },
] as const;

export interface LimenIntegritySnapshot {
  /** 0 - 100 percentage of sessions respecting L'Ordine Giornaliero, Custode della Soglia, and Libro della Verità without overtrading */
  readonly integrityIndex: number;
  /** Number of consecutive integral sessions recorded */
  readonly consecutiveIntegralSessions: number;
  /** Total valid sessions audited */
  readonly totalAuditedSessions: number;
  /** Count of protocol/risk/overtrading violations in recent audit window */
  readonly recentViolationsCount: number;
  /** Count of days without compiling Il Libro della Verità */
  readonly daysSinceLastTruthEntry: number;
  /** Active demotion/penalty alert when a Grado II/III+ operator violates risk rules or stops compiling Il Libro della Verità */
  readonly driftDetected: boolean;
  /** Official alert banner copy when driftDetected is true */
  readonly driftAlertMessage: string | null;
  /** Current computed Grade (1..5) */
  readonly currentGrade: LimenGradeDefinition;
  /** Next Grade in the hierarchy (null if Grade V) */
  readonly nextGrade: LimenGradeDefinition | null;
  /** Progress percentage (0..100) toward the next grade */
  readonly progressToNextGradePct: number;
  /** Whether Mandato di Espansione (Codice di Chiamata 20%) is unlocked (Grado II+ or Admin) */
  readonly expansionMandateUnlocked: boolean;
  /** Whether Il Tempio Fisico is unlocked (Grado II+) */
  readonly physicalTempleUnlocked: boolean;
  /** Whether Divisione B2B & L'Uniforme are unlocked (Grado III+) */
  readonly b2bAndUniformUnlocked: boolean;
}

export const DRIFT_ALERT_TITLE = "Cedimento alla Deriva rilevato";
export const DRIFT_ALERT_DESCRIPTION =
  "Rilevata violazione delle regole di rischio o interruzione nella compilazione de Il Libro della Verità. Il tuo Indice di Integrità è stato penalizzato: ristabilisci immediatamente L'Ordine Giornaliero per evitare la retrocessione di Grado.";

export function getLimenGradeByNumber(grade: number): LimenGradeDefinition {
  const clamped = Math.max(1, Math.min(5, Math.floor(grade))) as LimenGradeNumber;
  return LIMEN_GRADES[clamped - 1] ?? LIMEN_GRADES[0];
}

/**
 * Maps legacy 1..20 XP level or explicit metrics into a full LimenIntegritySnapshot.
 */
export interface ComputeIntegrityInput {
  readonly totalSessions?: number;
  readonly integralSessions?: number;
  readonly consecutiveIntegralSessions?: number;
  readonly recentViolationsCount?: number;
  readonly daysSinceLastTruthEntry?: number;
  readonly profitFactor?: number;
  readonly isAdmin?: boolean;
  readonly adminAssignedGrade?: number | null;
  readonly legacyLevel?: number;
}

export function computeLimenIntegritySnapshot(
  input: ComputeIntegrityInput,
): LimenIntegritySnapshot {
  const totalSessions = Math.max(0, input.totalSessions ?? 0);
  const recentViolations = Math.max(0, input.recentViolationsCount ?? 0);
  const daysSinceLastEntry = Math.max(0, input.daysSinceLastTruthEntry ?? 0);

  // Derive base integrity percentage
  let rawIntegrity: number;
  if (totalSessions > 0 && input.integralSessions !== undefined) {
    rawIntegrity = Math.round((Math.max(0, input.integralSessions) / totalSessions) * 100);
  } else if (input.legacyLevel !== undefined && input.legacyLevel > 1) {
    // Smooth mapping for existing accounts before full session audit history is populated
    rawIntegrity = Math.min(100, 75 + Math.min(25, input.legacyLevel * 2));
  } else {
    rawIntegrity = 100; // Clean slate at Grado I until violations occur
  }

  // Apply penalty for recent risk violations or prolonged absence from Il Libro della Verità
  const violationPenalty = recentViolations * 12;
  const inactivityPenalty = daysSinceLastEntry > 5 ? Math.min(25, (daysSinceLastEntry - 5) * 3) : 0;
  const integrityIndex = Math.max(0, Math.min(100, rawIntegrity - violationPenalty - inactivityPenalty));

  const consecutiveIntegralSessions =
    recentViolations > 0
      ? 0
      : Math.max(
          0,
          input.consecutiveIntegralSessions ??
            (input.integralSessions ?? (input.legacyLevel ? Math.max(0, (input.legacyLevel - 1) * 8) : 0)),
        );

  // Determine natural grade before drift check
  let gradeNum: LimenGradeNumber = 1;
  if (input.isAdmin || input.adminAssignedGrade === 5) {
    gradeNum = 5;
  } else if (input.adminAssignedGrade && input.adminAssignedGrade >= 1 && input.adminAssignedGrade <= 5) {
    gradeNum = input.adminAssignedGrade as LimenGradeNumber;
  } else if (
    consecutiveIntegralSessions >= 120 &&
    integrityIndex >= 92 &&
    (input.profitFactor ?? 0) >= 1.5
  ) {
    gradeNum = 4;
  } else if (consecutiveIntegralSessions >= 90 && integrityIndex >= 90) {
    gradeNum = 3;
  } else if (consecutiveIntegralSessions >= 30 && integrityIndex >= 85) {
    gradeNum = 2;
  } else {
    gradeNum = 1;
  }

  // Check for "Cedimento alla Deriva" on operators who had reached or are at Grado II/III+
  const hadHigherStanding =
    gradeNum >= 2 ||
    (input.consecutiveIntegralSessions ?? 0) >= 30 ||
    (input.legacyLevel ?? 1) >= 5;
  const driftDetected =
    !input.isAdmin &&
    hadHigherStanding &&
    (recentViolations > 0 || daysSinceLastEntry > 7 || integrityIndex < 75);

  // If severe drift is detected on Grado II or III, demote by 1 grade if integrity drops below 70%
  if (driftDetected && integrityIndex < 70 && gradeNum > 1 && gradeNum <= 3) {
    gradeNum = (gradeNum - 1) as LimenGradeNumber;
  }

  const currentGrade = getLimenGradeByNumber(gradeNum);
  const nextGrade = gradeNum < 5 ? getLimenGradeByNumber(gradeNum + 1) : null;

  let progressToNextGradePct = 100;
  if (nextGrade) {
    if (nextGrade.adminOnly) {
      progressToNextGradePct = Math.min(95, Math.round((consecutiveIntegralSessions / 180) * 100));
    } else {
      const targetSessions = Math.max(1, nextGrade.requiredConsecutiveSessions);
      progressToNextGradePct = Math.max(
        0,
        Math.min(100, Math.round((consecutiveIntegralSessions / targetSessions) * 100)),
      );
    }
  }

  const expansionMandateUnlocked = Boolean(input.isAdmin || gradeNum >= 2);
  const physicalTempleUnlocked = Boolean(input.isAdmin || gradeNum >= 2);
  const b2bAndUniformUnlocked = Boolean(input.isAdmin || gradeNum >= 3);

  return {
    integrityIndex,
    consecutiveIntegralSessions,
    totalAuditedSessions: totalSessions,
    recentViolationsCount: recentViolations,
    daysSinceLastTruthEntry: daysSinceLastEntry,
    driftDetected,
    driftAlertMessage: driftDetected ? `${DRIFT_ALERT_TITLE}: ${DRIFT_ALERT_DESCRIPTION}` : null,
    currentGrade,
    nextGrade,
    progressToNextGradePct,
    expansionMandateUnlocked,
    physicalTempleUnlocked,
    b2bAndUniformUnlocked,
  };
}

/**
 * Composite Mastery Score for "La Gerarchia dell'Integrità" (Leaderboard)
 * Formula: Integrità del Protocollo (%) + Costanza + Risk/Reward Ratio + Profit Factor
 * Operators who generate profit while violating Il Custode della Soglia are penalized.
 */
export interface MasteryScoreInput {
  readonly integrityIndex: number; // 0..100
  readonly consistencyScore: number; // 0..100 (session regularity / discipline)
  readonly avgRiskReward: number; // e.g., 1.8
  readonly profitFactor: number; // e.g., 2.1
  readonly protocolViolationsCount?: number;
}

export function computeCompositeMasteryScore(input: MasteryScoreInput): number {
  const integrityComponent = Math.max(0, Math.min(100, input.integrityIndex)) * 0.45;
  const consistencyComponent = Math.max(0, Math.min(100, input.consistencyScore)) * 0.25;
  const rrNormalized = Math.min(100, Math.max(0, (input.avgRiskReward / 3.0) * 100)) * 0.15;
  const pfNormalized = Math.min(100, Math.max(0, (input.profitFactor / 3.0) * 100)) * 0.15;

  const violationPenalty = Math.max(0, input.protocolViolationsCount ?? 0) * 8;
  const rawScore = integrityComponent + consistencyComponent + rrNormalized + pfNormalized - violationPenalty;
  return Math.max(0, Math.min(100, Math.round(rawScore * 10) / 10));
}
