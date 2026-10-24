// ─── Memoria Operativa Antifragile & Statistiche per Singolo Concetto (Piano Operativo LIMEN) ───
// Applica esclusivamente i concetti ufficiali del Piano Operativo, Finestra Operativa
// ed Esempi certificati:
// 1. La Regola del Flip (inversione violata -> cambia subito bias in continuazione JTC/BTI)
// 2. Soglia dello Sbilanciamento 10% (SOW/SOS) in Area Vergine
// 3. Re-accumulo su Box Intermedio (Causa 2 -> Solo JTC con Rischio Dimezzato 50%)
// 4. Reattività Immediata & Taglio della Congestione a ridosso della zona
// 5. Selezione Adattiva dei 4 Trigger (TEST, POC, JTC, BTI) e Statistiche Granulari per Concetto

export type CockpitCycleType = "up" | "down" | "end_up" | "end_down";
export type CockpitLiquidityContext = "compression" | "swept" | "intermediate";
export type CockpitZoneScenario = "valid_zone" | "no_zone" | "reaccum";
export type CockpitTriggerType = "TEST" | "POC" | "JTC" | "BTI";
export type CockpitAreaType = "history" | "virgin";

export type ConceptCategory = "cycle" | "context" | "scenario" | "area" | "trigger" | "session";

export interface SingleConceptStat {
  key: string;
  label: string;
  category: ConceptCategory;
  trades: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number;
  totalR: number;
  expectancyR: number;
  avgMfeR: number;
  avgMaeR: number;
}

export interface Step4CareStats {
  /** Operazioni protette a Pareggio ad almeno 1:1.5 R:R dopo presa di liquidità (mgmt_be) */
  beMovedCount: number;
  /** Parziali 50% incassati tassativamente a 1:3.0 R:R (mgmt_tp1) */
  tp1PartialCount: number;
  /** Uscite anticipate per chiusura candela oltre lo swing della schematica (mgmt_invalidation) */
  invalidationSavesCount: number;
  /** Uscite/cancellazioni per congestione prolungata a ridosso della zona */
  congestionExitsCount: number;
  /** Unità di Rischio (R) risparmiate grazie a mgmt_invalidation e taglio congestione rispetto allo SL pieno */
  savedRiskR: number;
  /** Quante volte è stata attivata La Regola del Flip */
  flipTriggeredCount: number;
  /** Quante volte La Regola del Flip ha portato il trade di continuazione a Target */
  flipWinsCount: number;
}

export interface ConceptStatsRegistry {
  byCycle: Record<string, SingleConceptStat>;
  byContext: Record<string, SingleConceptStat>;
  byScenario: Record<string, SingleConceptStat>;
  byArea: Record<string, SingleConceptStat>;
  byTrigger: Record<string, SingleConceptStat>;
  bySession: Record<string, SingleConceptStat>;
}

export interface LimenOperativeMemoryState {
  symbol: string;
  /** La Regola del Flip: se una schematica d'inversione viene violata, cambia bias verso la continuazione */
  flipActive: boolean;
  flipDirection: "long" | "short" | null;
  flipReason: string | null;
  /** Filtro Sbilanciamento SOW/SOS (default 10% da Piano Operativo, sale fino al 18% se finte in Area Vergine) */
  minImbalancePercent: number;
  /** Barre massime tollerate in congestione a ridosso della zona prima di cancellare pendente o chiudere */
  maxCongestionBars: number;
  /** Moltiplicatore di rischio nei Re-accumuli intermedi Causa 2 (default 0.5 = Rischio Dimezzato da Esempio 4) */
  reaccumRiskMultiplier: number;
  /** Se i trigger TEST subiscono stop su falsi rimbalzi, esige il re-test profondo sul POC volumetrico */
  preferPocOnReversal: boolean;
  /** Combinazioni scenario:trigger temporaneamente bloccate dopo stop consecutivi */
  quarantinedCombos: string[];
  /** Contatore stop consecutivi per combinazione scenario:trigger */
  comboLossStreaks: Record<string, number>;
  /** Statistiche globali dell'operatività autonoma */
  stats: {
    totalTrades: number;
    wins: number;
    losses: number;
    breakevens: number;
    winRate: number;
    totalR: number;
    expectancyR: number;
  };
  /** Statistiche granulari per ogni singolo concetto del Piano Operativo */
  conceptStats: ConceptStatsRegistry;
  /** Statistiche della Cura Attiva del Trade (Step 04) */
  step4CareStats: Step4CareStats;
  /** Registro delle lezioni apprese dal comportamento del prezzo */
  learnedLessons: string[];
}

export interface OperativeTradeOutcomeInput {
  direction: "long" | "short";
  result: "win" | "loss" | "breakeven";
  exitReason: "sl" | "tp" | "manual" | "invalidation" | "congestion";
  mfeR: number | null;
  maeR: number | null;
  realizedR?: number | null;
  cycle?: CockpitCycleType;
  context?: CockpitLiquidityContext;
  scenario?: CockpitZoneScenario;
  trigger?: CockpitTriggerType;
  area?: CockpitAreaType;
  sessionName?: string;
  wasReversal?: boolean;
  barsHeld?: number;
}

const STORAGE_PREFIX = "limen_operative_memory_v1_";

export const CONCEPT_LABELS: Record<string, string> = {
  // Cicli (Step 01)
  up: "Ciclo Rialzista (UP)",
  down: "Ciclo Ribassista (DOWN)",
  end_up: "Fine Ciclo UP (Inversione)",
  end_down: "Fine Ciclo DOWN (Inversione)",
  // Contesto Liquidità (Step 01 - Le 4 Domande)
  compression: "Compressione verso Zona",
  swept: "Liquidità Precedente Spazzata",
  intermediate: "Liquidità Intermedia da Prendere",
  // Router di Zona (Step 02 - I 3 Bivi)
  valid_zone: "Bivio 1 · Zona HTF Mitigata",
  no_zone: "Bivio 2 · Sola Liquidità (Cont.)",
  reaccum: "Bivio 3 · Re-accumulo Causa 2 (50%)",
  // Natura Area (Step 03)
  history: "Area con Storico a Sinistra",
  virgin: "Area Vergine (SOW/SOS ≥10%)",
  // Trigger (Step 03)
  TEST: "Trigger TEST (Bordo Zona)",
  POC: "Trigger POC (Point of Control)",
  JTC: "Trigger JTC (Jump The Creek)",
  BTI: "Trigger BTI (Back To Ice)",
  // Sessioni (Step 01/03)
  Londra: "Sessione Londra (08:00-11:30)",
  "New York": "Sessione NY (14:00-18:00)",
  Asia: "Sessione Asia (01:00-03:30)",
  Altro: "Altra Finestra Oraria",
};

function createEmptyConceptStat(key: string, category: ConceptCategory): SingleConceptStat {
  return {
    key,
    label: CONCEPT_LABELS[key] ?? key,
    category,
    trades: 0,
    wins: 0,
    losses: 0,
    breakevens: 0,
    winRate: 0,
    totalR: 0,
    expectancyR: 0,
    avgMfeR: 0,
    avgMaeR: 0,
  };
}

function createInitialConceptStats(): ConceptStatsRegistry {
  return {
    byCycle: {
      up: createEmptyConceptStat("up", "cycle"),
      down: createEmptyConceptStat("down", "cycle"),
      end_up: createEmptyConceptStat("end_up", "cycle"),
      end_down: createEmptyConceptStat("end_down", "cycle"),
    },
    byContext: {
      compression: createEmptyConceptStat("compression", "context"),
      swept: createEmptyConceptStat("swept", "context"),
      intermediate: createEmptyConceptStat("intermediate", "context"),
    },
    byScenario: {
      valid_zone: createEmptyConceptStat("valid_zone", "scenario"),
      no_zone: createEmptyConceptStat("no_zone", "scenario"),
      reaccum: createEmptyConceptStat("reaccum", "scenario"),
    },
    byArea: {
      history: createEmptyConceptStat("history", "area"),
      virgin: createEmptyConceptStat("virgin", "area"),
    },
    byTrigger: {
      TEST: createEmptyConceptStat("TEST", "trigger"),
      POC: createEmptyConceptStat("POC", "trigger"),
      JTC: createEmptyConceptStat("JTC", "trigger"),
      BTI: createEmptyConceptStat("BTI", "trigger"),
    },
    bySession: {
      Londra: createEmptyConceptStat("Londra", "session"),
      "New York": createEmptyConceptStat("New York", "session"),
      Asia: createEmptyConceptStat("Asia", "session"),
    },
  };
}

function createInitialStep4Stats(): Step4CareStats {
  return {
    beMovedCount: 0,
    tp1PartialCount: 0,
    invalidationSavesCount: 0,
    congestionExitsCount: 0,
    savedRiskR: 0,
    flipTriggeredCount: 0,
    flipWinsCount: 0,
  };
}

export function createInitialOperativeMemory(symbol: string): LimenOperativeMemoryState {
  return {
    symbol: symbol.replace("/", "").toUpperCase(),
    flipActive: false,
    flipDirection: null,
    flipReason: null,
    minImbalancePercent: 10,
    maxCongestionBars: 10,
    reaccumRiskMultiplier: 0.5,
    preferPocOnReversal: false,
    quarantinedCombos: [],
    comboLossStreaks: {},
    stats: {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakevens: 0,
      winRate: 0,
      totalR: 0,
      expectancyR: 0,
    },
    conceptStats: createInitialConceptStats(),
    step4CareStats: createInitialStep4Stats(),
    learnedLessons: [
      "Protocollo inizializzato: Router di Zona a 3 Bivi, Sbilanciamento ≥10% (SOW/SOS), BE a 1:1.5R e Parziale 50% a 1:3R.",
    ],
  };
}

export function loadOperativeMemory(symbol: string): LimenOperativeMemoryState {
  const norm = symbol.replace("/", "").toUpperCase();
  const base = createInitialOperativeMemory(norm);
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${norm}`);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return base;
    return {
      ...base,
      ...parsed,
      symbol: norm,
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
      conceptStats: {
        byCycle: { ...base.conceptStats.byCycle, ...(parsed.conceptStats?.byCycle ?? {}) },
        byContext: { ...base.conceptStats.byContext, ...(parsed.conceptStats?.byContext ?? {}) },
        byScenario: { ...base.conceptStats.byScenario, ...(parsed.conceptStats?.byScenario ?? {}) },
        byArea: { ...base.conceptStats.byArea, ...(parsed.conceptStats?.byArea ?? {}) },
        byTrigger: { ...base.conceptStats.byTrigger, ...(parsed.conceptStats?.byTrigger ?? {}) },
        bySession: { ...base.conceptStats.bySession, ...(parsed.conceptStats?.bySession ?? {}) },
      },
      step4CareStats: { ...base.step4CareStats, ...(parsed.step4CareStats ?? {}) },
    };
  } catch {
    return base;
  }
}

export function saveOperativeMemory(symbol: string, state: LimenOperativeMemoryState): void {
  const norm = symbol.replace("/", "").toUpperCase();
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${norm}`, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function resetOperativeMemory(symbol: string): LimenOperativeMemoryState {
  const fresh = createInitialOperativeMemory(symbol);
  saveOperativeMemory(symbol, fresh);
  return fresh;
}

function pushLesson(lessons: string[], nextLesson: string): string[] {
  const filtered = lessons.filter((l) => l !== nextLesson);
  return [nextLesson, ...filtered].slice(0, 6);
}

function normalizeSessionBucket(sessionName?: string): string {
  if (!sessionName) return "Londra";
  const s = sessionName.toLowerCase();
  if (s.includes("londra") || s.includes("london") || s.includes(" Impulso Londra")) return "Londra";
  if (s.includes("new york") || s.includes("ny")) return "New York";
  if (s.includes("asia")) return "Asia";
  return "Altro";
}

function updateBucketStat(
  bucket: Record<string, SingleConceptStat>,
  key: string,
  category: ConceptCategory,
  result: "win" | "loss" | "breakeven",
  realizedR: number,
  mfeR: number,
  maeR: number,
): Record<string, SingleConceptStat> {
  const prev = bucket[key] ?? createEmptyConceptStat(key, category);
  const trades = prev.trades + 1;
  const wins = prev.wins + (result === "win" ? 1 : 0);
  const losses = prev.losses + (result === "loss" ? 1 : 0);
  const breakevens = prev.breakevens + (result === "breakeven" ? 1 : 0);
  const decided = wins + losses;
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : 0;
  const totalR = Number((prev.totalR + realizedR).toFixed(2));
  const expectancyR = Number((totalR / trades).toFixed(2));
  const avgMfeR = Number((((prev.avgMfeR * prev.trades) + mfeR) / trades).toFixed(2));
  const avgMaeR = Number((((prev.avgMaeR * prev.trades) + maeR) / trades).toFixed(2));

  return {
    ...bucket,
    [key]: {
      ...prev,
      trades,
      wins,
      losses,
      breakevens,
      winRate,
      totalR,
      expectancyR,
      avgMfeR,
      avgMaeR,
    },
  };
}

/**
 * Registra un evento intermedio di Cura Attiva Step 04 (mgmt_be a 1:1.5R, mgmt_tp1 a 1:3R, o cancellazione congestione pendente).
 */
export function recordStep4CareEvent(
  current: LimenOperativeMemoryState,
  event: "be_moved" | "tp1_partial" | "pending_congestion_cancelled",
): LimenOperativeMemoryState {
  const next: LimenOperativeMemoryState = {
    ...current,
    step4CareStats: { ...current.step4CareStats },
    learnedLessons: [...current.learnedLessons],
  };

  if (event === "be_moved") {
    next.step4CareStats.beMovedCount += 1;
  } else if (event === "tp1_partial") {
    next.step4CareStats.tp1PartialCount += 1;
  } else if (event === "pending_congestion_cancelled") {
    next.step4CareStats.congestionExitsCount += 1;
    next.step4CareStats.savedRiskR = Number((next.step4CareStats.savedRiskR + 1.0).toFixed(2));
  }

  return next;
}

/**
 * Analizza l'esito del trade chiuso e aggiorna la Memoria Antifragile e le Statistiche per Singolo Concetto
 * applicando rigorosamente le regole del Piano Operativo (Regola del Flip, Sbilanciamento 10%,
 * Reattività post-M1, Congestione e Router di Zona).
 */
export function recordOperativeTradeOutcome(
  current: LimenOperativeMemoryState,
  outcome: OperativeTradeOutcomeInput,
): LimenOperativeMemoryState {
  const next: LimenOperativeMemoryState = {
    ...current,
    quarantinedCombos: [...current.quarantinedCombos],
    comboLossStreaks: { ...current.comboLossStreaks },
    stats: { ...current.stats },
    conceptStats: {
      byCycle: { ...current.conceptStats.byCycle },
      byContext: { ...current.conceptStats.byContext },
      byScenario: { ...current.conceptStats.byScenario },
      byArea: { ...current.conceptStats.byArea },
      byTrigger: { ...current.conceptStats.byTrigger },
      bySession: { ...current.conceptStats.bySession },
    },
    step4CareStats: { ...current.step4CareStats },
    learnedLessons: [...current.learnedLessons],
  };

  const mfe = outcome.mfeR ?? (outcome.result === "win" ? 3.0 : 0.2);
  const mae = outcome.maeR ?? (outcome.result === "loss" ? 1.0 : 0.2);

  // Calcolo di R realizzato preciso in base al Piano Operativo
  let realizedR = outcome.realizedR ?? null;
  if (realizedR == null) {
    if (outcome.result === "win") {
      realizedR = Math.max(1.5, mfe >= 3.0 ? 3.0 : mfe);
    } else if (outcome.result === "breakeven") {
      realizedR = 0;
    } else if (outcome.exitReason === "invalidation") {
      realizedR = -0.45;
    } else if (outcome.exitReason === "congestion") {
      realizedR = -0.25;
    } else {
      realizedR = -1.0;
    }
  }

  // Aggiorna contatori globali
  next.stats.totalTrades += 1;
  if (outcome.result === "win") {
    next.stats.wins += 1;
  } else if (outcome.result === "loss") {
    next.stats.losses += 1;
  } else {
    next.stats.breakevens += 1;
  }

  const decidedTrades = next.stats.wins + next.stats.losses;
  next.stats.winRate = decidedTrades > 0 ? Math.round((next.stats.wins / decidedTrades) * 100) : 0;
  next.stats.totalR = Number(((next.stats.totalR ?? 0) + realizedR).toFixed(2));
  next.stats.expectancyR = Number((next.stats.totalR / next.stats.totalTrades).toFixed(2));

  // Aggiorna Statistiche per ciascun Singolo Concetto del Piano Operativo
  const cycle = outcome.cycle ?? "up";
  const context = outcome.context ?? "swept";
  const scenario = outcome.scenario ?? "valid_zone";
  const area = outcome.area ?? "history";
  const trigger = outcome.trigger ?? "TEST";
  const sessionKey = normalizeSessionBucket(outcome.sessionName);

  next.conceptStats.byCycle = updateBucketStat(next.conceptStats.byCycle, cycle, "cycle", outcome.result, realizedR, mfe, mae);
  next.conceptStats.byContext = updateBucketStat(next.conceptStats.byContext, context, "context", outcome.result, realizedR, mfe, mae);
  next.conceptStats.byScenario = updateBucketStat(next.conceptStats.byScenario, scenario, "scenario", outcome.result, realizedR, mfe, mae);
  next.conceptStats.byArea = updateBucketStat(next.conceptStats.byArea, area, "area", outcome.result, realizedR, mfe, mae);
  next.conceptStats.byTrigger = updateBucketStat(next.conceptStats.byTrigger, trigger, "trigger", outcome.result, realizedR, mfe, mae);
  next.conceptStats.bySession = updateBucketStat(next.conceptStats.bySession, sessionKey, "session", outcome.result, realizedR, mfe, mae);

  // Aggiorna contatori Step 04 se uscita anticipata per invalidazione o congestione
  if (outcome.exitReason === "invalidation") {
    next.step4CareStats.invalidationSavesCount += 1;
    const saved = Math.max(0.2, 1.0 - Math.abs(realizedR));
    next.step4CareStats.savedRiskR = Number((next.step4CareStats.savedRiskR + saved).toFixed(2));
  } else if (outcome.exitReason === "congestion") {
    next.step4CareStats.congestionExitsCount += 1;
    const saved = Math.max(0.3, 1.0 - Math.abs(realizedR));
    next.step4CareStats.savedRiskR = Number((next.step4CareStats.savedRiskR + saved).toFixed(2));
  }

  const comboKey = `${scenario}:${trigger}`;

  if (outcome.result === "win") {
    // Reset serie negativa per questa combinazione
    next.comboLossStreaks[comboKey] = 0;
    next.quarantinedCombos = next.quarantinedCombos.filter((k) => k !== comboKey);

    // Se un trigger POC o TEST in valid_zone torna a vincere con ottimo MFE, riabilita la flessibilità
    if (trigger === "POC" && next.conceptStats.byTrigger.POC?.winRate >= 60) {
      next.learnedLessons = pushLesson(
        next.learnedLessons,
        `Statistica Concetto [Trigger POC]: Win Rate ${next.conceptStats.byTrigger.POC.winRate}% (${next.conceptStats.byTrigger.POC.expectancyR >= 0 ? "+" : ""}${next.conceptStats.byTrigger.POC.expectancyR}R/trade). Confermato ad alta precisione.`,
      );
    }

    if (next.flipActive && outcome.direction === next.flipDirection) {
      next.step4CareStats.flipWinsCount += 1;
      next.learnedLessons = pushLesson(
        next.learnedLessons,
        `Regola del Flip confermata a target (${outcome.direction.toUpperCase()} con ${trigger}): continuazione completata (${next.step4CareStats.flipWinsCount}/${next.step4CareStats.flipTriggeredCount} Flip vinti).`,
      );
      next.flipActive = false;
      next.flipDirection = null;
      next.flipReason = null;
    } else {
      const trigStat = next.conceptStats.byTrigger[trigger];
      next.learnedLessons = pushLesson(
        next.learnedLessons,
        `Setup ${scenario.toUpperCase()} + ${trigger} a Target (+${realizedR.toFixed(1)}R) · WR ${trigger}: ${trigStat?.winRate ?? 100}% su ${trigStat?.trades ?? 1} trade.`,
      );
    }
    return next;
  }

  if (outcome.result === "breakeven") {
    next.learnedLessons = pushLesson(
      next.learnedLessons,
      `Protezione Step 04 (mgmt_be): operazione chiusa a Pareggio (0R) dopo presa di liquidità intermedia. Capitale preservato.`,
    );
    return next;
  }

  // ── GESTIONE PERDITA / INVALIDAZIONE (Apprendimento Antifragile dal Piano Operativo) ──
  const streak = (next.comboLossStreaks[comboKey] ?? 0) + 1;
  next.comboLossStreaks[comboKey] = streak;

  // 1. LA REGOLA DEL FLIP: Se viene violata una schematica d'inversione (su valid_zone o fine ciclo)
  const isReversalAttempt =
    outcome.wasReversal ||
    (scenario === "valid_zone" && (trigger === "TEST" || trigger === "POC")) ||
    outcome.cycle === "end_up" ||
    outcome.cycle === "end_down";

  if (isReversalAttempt || outcome.exitReason === "invalidation") {
    const continuationDir: "long" | "short" = outcome.direction === "long" ? "short" : "long";
    next.flipActive = true;
    next.flipDirection = continuationDir;
    next.step4CareStats.flipTriggeredCount += 1;
    next.flipReason = `Schematica ${outcome.direction.toUpperCase()} violata: La Regola del Flip impone cambio bias immediato verso la continuazione ${continuationDir.toUpperCase()} (solo JTC / BTI).`;
    next.learnedLessons = pushLesson(next.learnedLessons, next.flipReason);
  }

  // 2. FALSO SWEEP / AREA VERGINE SENZA SPINTA SUFFICIENTE (mfeR < 0.5)
  if (mfe < 0.5 && (outcome.area === "virgin" || trigger === "BTI" || trigger === "TEST")) {
    next.minImbalancePercent = Math.min(18, next.minImbalancePercent + 2);
    next.learnedLessons = pushLesson(
      next.learnedLessons,
      `Statistica [Area Vergine]: MFE ${mfe.toFixed(1)}R insufficiente. Soglia Sbilanciamento SOW/SOS alzata al ${next.minImbalancePercent}% per filtrare le finte.`,
    );
  }

  // 3. PERDITA SU TRIGGER 'TEST': confronta statistica TEST vs POC e attiva priorità sul POC volumetrico
  const testStat = next.conceptStats.byTrigger.TEST;
  if (trigger === "TEST" && (mfe < 0.8 || (testStat && testStat.trades >= 2 && testStat.winRate < 45))) {
    next.preferPocOnReversal = true;
    next.learnedLessons = pushLesson(
      next.learnedLessons,
      `Statistica [Trigger TEST]: WR ${testStat?.winRate ?? 0}% con MAE alto. Attivata priorità sul Trigger POC (Point of Control volumetrico).`,
    );
  }

  // 4. CONGESTIONE PROLUNGATA A RIDOSSO DELLA ZONA
  if (outcome.exitReason === "congestion" || (outcome.barsHeld != null && outcome.barsHeld >= 8 && mfe < 1.0)) {
    next.maxCongestionBars = Math.max(5, next.maxCongestionBars - 2);
    next.learnedLessons = pushLesson(
      next.learnedLessons,
      `Statistica [Reattività Step 04]: Congestione rilevata. Ridotta tolleranza a ${next.maxCongestionBars} candele prima di tagliare l'operazione.`,
    );
  }

  // 5. QUARANTENA COMBINAZIONE SCENARIO + TRIGGER DOPO 2 STOP CONSECUTIVI
  if (streak >= 2 && !next.quarantinedCombos.includes(comboKey)) {
    next.quarantinedCombos.push(comboKey);
    next.learnedLessons = pushLesson(
      next.learnedLessons,
      `Filtro Concetto [${scenario} + ${trigger}]: sospeso dopo ${streak} invalidazioni consecutive. Priorità a conferme POC / JTC.`,
    );
  }

  return next;
}

export interface DerivedConceptInsights {
  activeConcepts: SingleConceptStat[];
  bestConcept: SingleConceptStat | null;
  weakestConcept: SingleConceptStat | null;
  bestTrigger: CockpitTriggerType | null;
}

/**
 * Estrae una sintesi ordinata delle statistiche per singolo concetto (solo i concetti con almeno 1 trade eseguito),
 * permettendo sia alla UI sia al motore di conoscere i concetti più performanti e quelli più vulnerabili.
 */
export function deriveConceptInsights(memory: LimenOperativeMemoryState): DerivedConceptInsights {
  const cs = memory.conceptStats;
  if (!cs) {
    return { activeConcepts: [], bestConcept: null, weakestConcept: null, bestTrigger: null };
  }

  const all: SingleConceptStat[] = [
    ...Object.values(cs.byTrigger ?? {}),
    ...Object.values(cs.byScenario ?? {}),
    ...Object.values(cs.byArea ?? {}),
    ...Object.values(cs.byCycle ?? {}),
    ...Object.values(cs.byContext ?? {}),
    ...Object.values(cs.bySession ?? {}),
  ].filter((item) => item && item.trades > 0);

  all.sort((a, b) => {
    if (b.expectancyR !== a.expectancyR) return b.expectancyR - a.expectancyR;
    return b.winRate - a.winRate;
  });

  const bestConcept = all.find((c) => c.expectancyR > 0) ?? null;
  const weakestConcept = [...all].reverse().find((c) => c.expectancyR < 0) ?? null;

  const triggers = Object.values(cs.byTrigger ?? {}).filter((t) => t.trades > 0);
  triggers.sort((a, b) => b.expectancyR - a.expectancyR);
  const bestTrigger = (triggers[0]?.key as CockpitTriggerType | undefined) ?? null;

  return {
    activeConcepts: all,
    bestConcept,
    weakestConcept,
    bestTrigger,
  };
}
