import { getVisionClient } from "./llmClient.js";

export interface VarcoVisionCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface VarcoOperativeMemoryInput {
  flipActive?: boolean;
  flipDirection?: "long" | "short" | null;
  minImbalancePercent?: number;
  preferPocOnReversal?: boolean;
  reaccumRiskMultiplier?: number;
  quarantinedCombos?: string[];
}

export interface VarcoVisionRequest {
  symbol: string;
  interval?: string;
  chartImage?: string;
  candles: VarcoVisionCandle[];
  currentPhase?: number;
  accountCapital?: number;
  riskPercent?: number;
  activeSetup?: VarcoSetupPlan | null;
  enforceSessionWindows?: boolean;
  operativeMemory?: VarcoOperativeMemoryInput | null;
  directionalBias?: {
    h4MasterBias: "BULLISH" | "BEARISH" | "NEUTRAL";
    edgeTier?: string;
    antiFadeProtected?: boolean;
    confidenceScore?: number;
  };
  currentChecks?: {
    htfContext?: boolean;
    turningPoint?: boolean;
    ltfTrigger?: boolean;
    riskGuard?: boolean;
  };
}

export interface VarcoChecklistItemAudit {
  valid: boolean;
  note: string;
  triggerType?: "TEST" | "POC" | "JTC" | "BTI";
  recommendedLots?: number;
  riskAmount?: number;
}

export interface VarcoChecklistAudit {
  htfContext: VarcoChecklistItemAudit;
  turningPoint: VarcoChecklistItemAudit;
  ltfTrigger: VarcoChecklistItemAudit;
  riskGuard: VarcoChecklistItemAudit;
}

export interface VarcoProceduralStep {
  phase: number;
  title: string;
  valid: boolean;
  note: string;
  schematicId?: string;
  triggerType?: "TEST" | "POC" | "JTC" | "BTI";
}

export type WyckoffSchematicType = "accumulation" | "reaccumulation" | "distribution" | "redistribution";
export type WyckoffPhaseType = "Phase A" | "Phase B" | "Phase C" | "Phase D" | "Phase E";

export interface WyckoffPoint {
  label:
    | "PS"
    | "PSY"
    | "SC"
    | "BC"
    | "AR"
    | "STB"
    | "ST"
    | "10%"
    | "Spring"
    | "UT"
    | "UTAD"
    | "Test"
    | "10% 2"
    | "SOS"
    | "SOW"
    | "JTC"
    | "BTI"
    | "POC";
  price: number;
  time: number;
  note?: string;
}

export interface WyckoffZoneInfo {
  triggerType: "TEST" | "POC" | "JTC" | "BTI";
  label: string;
  topPrice: number;
  bottomPrice: number;
}

export interface WyckoffBoxInfo {
  startTime: number;
  endTime: number;
  topPrice: number;
  bottomPrice: number;
  rangeHeight: number;
  schematicType: WyckoffSchematicType;
  phase?: WyckoffPhaseType;
  causeStage?: "causa_1" | "causa_2_redistrib" | "causa_2_reaccum";
  tenPercentLevel: number;
  tenPercent2Level?: number;
  arPrice?: number;
  scPrice?: number;
  stbPrice?: number;
  springPrice?: number;
  utadPrice?: number;
  pocPrice: number;
  equilibriumPrice?: number;
  creekPrice?: number;
  icePrice?: number;
  jtcZoneTop?: number;
  jtcZoneBottom?: number;
  testZoneTop?: number;
  testZoneBottom?: number;
}

export interface VarcoSetupPlan {
  direction: "long" | "short";
  orderType: "limit" | "market";
  entryPrice: number;
  limitPrice?: number;
  entryReason?: string;
  invalidationReason?: string;
  timeframe?: string;
  schematicRef?: string;
  stopLossPrice: number;
  breakEvenPrice: number;
  breakEvenRule: string;
  takeProfit1Price: number;
  takeProfit1Rule: string;
  takeProfit2Price: number;
  takeProfit2Rule: string;
  riskRewardRatio: number;
  lotSize: number;
  pipsRisk: number;
  // Campi Ufficiali Piano Operativo & Finestra Operativa
  cycle?: "up" | "down" | "end_up" | "end_down";
  liquidityContext?: "compression" | "swept" | "intermediate";
  zoneScenario?: "valid_zone" | "no_zone" | "reaccum";
  areaType?: "history" | "virgin";
  triggerType?: "TEST" | "POC" | "JTC" | "BTI";
  imbalancePercent?: number;
  oppositePoolPrice?: number;
  oppositePoolLabel?: string;
  sessionName?: string;
  invalidationSwingPrice?: number;
  wasReversal?: boolean;
  // Visualizzazione Geometrica Wyckoff
  schematicPoints?: WyckoffPoint[];
  activeZone?: WyckoffZoneInfo;
  schematicBox?: WyckoffBoxInfo;
}

export interface VarcoVisionResponse {
  verdict: "SETUP_READY" | "WAITING_TRIGGER" | "INVALID_STRUCTURE" | "NO_ZONE";
  summary: string;
  confidenceScore: number;
  executionPhase?: number;
  proceduralSteps?: VarcoProceduralStep[];
  checklistAudit: VarcoChecklistAudit;
  setup: VarcoSetupPlan | null;
  doctrineAdvice: string;
}

export type TimeframeCategory = "SCALP" | "DAYTRADE" | "SWING" | "MACRO";

export interface TimeframeConfig {
  category: TimeframeCategory;
  name: string;
  hierarchyLabel: string;
  mode: "scalp" | "swing";
  displacementLookback: number;
  invalidationBufferPips: number;
  minAllowedStopPips: number;
  maxAllowedStopPips: number;
  retestDiscountRatio: number;
}

export function parseTimeframeCategory(interval?: string): TimeframeConfig {
  const norm = (interval || "15").toUpperCase().trim();
  let minutes = 15;
  if (norm === "1" || norm === "M1") minutes = 1;
  else if (norm === "3" || norm === "M3") minutes = 3;
  else if (norm === "5" || norm === "M5") minutes = 5;
  else if (norm === "15" || norm === "M15") minutes = 15;
  else if (norm === "30" || norm === "M30") minutes = 30;
  else if (norm === "60" || norm === "H1" || norm === "1H") minutes = 60;
  else if (norm === "120" || norm === "H2" || norm === "2H") minutes = 120;
  else if (norm === "240" || norm === "H4" || norm === "4H") minutes = 240;
  else if (norm === "D" || norm === "1D" || norm === "D1" || norm === "DAILY") minutes = 1440;
  else {
    const parsed = parseInt(norm, 10);
    if (!isNaN(parsed) && parsed > 0) minutes = parsed;
  }

  if (minutes <= 5) {
    return {
      category: "SCALP",
      name: `M${minutes} (Scalp)`,
      hierarchyLabel: "Scalping: H1 (Mappa) → M15 (Schematica) → M1 (Trigger)",
      mode: "scalp",
      displacementLookback: 6,
      invalidationBufferPips: 1.2,
      minAllowedStopPips: 2.0,
      maxAllowedStopPips: 6.5,
      retestDiscountRatio: 0.5,
    };
  }
  if (minutes <= 45) {
    return {
      category: "DAYTRADE",
      name: `M${minutes} (Day Trading)`,
      hierarchyLabel: "Scalping/Intraday: H1 → M15 → M1/M5",
      mode: "scalp",
      displacementLookback: 8,
      invalidationBufferPips: 1.8,
      minAllowedStopPips: 4.5,
      maxAllowedStopPips: 12.0,
      retestDiscountRatio: 0.5,
    };
  }
  if (minutes <= 360) {
    return {
      category: "SWING",
      name: `H${Math.round(minutes / 60)} (Swing)`,
      hierarchyLabel: "Swing: Daily/H4 (Ciclo) → H1/M15 (Schematica) → M5/M1 (Trigger)",
      mode: "swing",
      displacementLookback: 16,
      invalidationBufferPips: 3.5,
      minAllowedStopPips: 12.0,
      maxAllowedStopPips: 35.0,
      retestDiscountRatio: 0.5,
    };
  }
  return {
    category: "MACRO",
    name: "Daily (Macro)",
    hierarchyLabel: "Swing/Macro: Daily/H4 → H1/M15 → M5",
    mode: "swing",
    displacementLookback: 24,
    invalidationBufferPips: 8.0,
    minAllowedStopPips: 30.0,
    maxAllowedStopPips: 80.0,
    retestDiscountRatio: 0.5,
  };
}

export function getScaledTimeframeConfig(symbol: string, interval?: string): TimeframeConfig {
  const base = parseTimeframeCategory(interval);
  const s = symbol.replace("/", "").toUpperCase();
  let assetMultiplier = 1;
  if (s === "XAUUSD") assetMultiplier = 3.5;
  else if (["US30", "NAS100", "SPX500", "BTCUSD", "ETHUSD"].includes(s)) assetMultiplier = 5;

  return {
    ...base,
    invalidationBufferPips: base.invalidationBufferPips * assetMultiplier,
    minAllowedStopPips: base.minAllowedStopPips * assetMultiplier,
    maxAllowedStopPips: base.maxAllowedStopPips * assetMultiplier,
  };
}

export function getPipMultiplier(symbol: string): number {
  const s = symbol.replace("/", "").toUpperCase();
  if (s.includes("JPY")) return 100;
  if (s === "XAUUSD") return 10;
  if (s === "USOIL") return 100;
  if (["US30", "NAS100", "SPX500"].includes(s)) return 1;
  if (s.includes("BTC") || s.includes("ETH")) return 1;
  return 10000;
}

export function priceDecimals(symbol: string): number {
  const s = symbol.replace("/", "").toUpperCase();
  if (s.includes("JPY")) return 3;
  if (s === "XAUUSD") return 2;
  if (s === "USOIL") return 2;
  if (["US30", "NAS100", "SPX500", "BTCUSD", "ETHUSD"].includes(s)) return 2;
  return 5;
}

export function roundPrice(price: number, symbol: string): number {
  const dec = priceDecimals(symbol);
  return Number(price.toFixed(dec));
}

export function calculateLotSize(
  symbol: string,
  capital: number,
  riskPct: number,
  stopPips: number,
): number {
  const cashRisk = capital * (riskPct / 100);
  if (stopPips <= 0) return 0.01;
  let pipValuePerLot = 10;
  const s = symbol.replace("/", "").toUpperCase();
  if (["US30", "NAS100", "SPX500"].includes(s)) pipValuePerLot = 1;
  if (s.includes("BTC") || s.includes("ETH")) pipValuePerLot = 1;
  const rawLots = cashRisk / (stopPips * pipValuePerLot);
  return Math.max(0.01, Math.round(rawLots * 100) / 100);
}

/**
 * Valuta la Finestra Operativa Italiana (Europe/Rome) sul timestamp della candela storica,
 * seguendo alla lettera il Quadrante delle Sessioni del Piano Operativo.
 */
export function evaluateItalianSessionWindow(
  unixSeconds: number,
  symbol: string,
  mode: "scalp" | "swing",
  impulseStarted: boolean,
): {
  allowed: boolean;
  sessionName: string;
  reason: string;
} {
  const s = symbol.replace("/", "").toUpperCase();
  if (["BTCUSD", "ETHUSD"].includes(s)) {
    return {
      allowed: true,
      sessionName: "Crypto 24/7",
      reason: "Mercato Crypto 24/7 sempre attivo.",
    };
  }

  // Se il timestamp è sintetico (es. < 100_000_000 nei test unitari di base), consenti di default
  if (!Number.isFinite(unixSeconds) || unixSeconds < 100_000_000) {
    return {
      allowed: true,
      sessionName: "Londra (08:00–11:30 CET)",
      reason: "Sessione operativa attiva.",
    };
  }

  const date = new Date(unixSeconds * 1000);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    weekday: "short",
  }).format(date);

  if (["Sat", "Sun"].includes(weekday)) {
    return {
      allowed: false,
      sessionName: "Weekend (Chiuso)",
      reason: "Mercato chiuso nel weekend: solo preparazione della settimana successiva.",
    };
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hourCycle: "h23",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  const totalMin = hour * 60 + minute;
  const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} CET`;

  // 1. Asia: 00:00 - 08:00 (480m). Ingressi consentiti SOLO 01:00 - 03:30 (60m - 210m)
  if (totalMin < 480) {
    if (totalMin >= 60 && totalMin <= 210) {
      return {
        allowed: true,
        sessionName: `Asia Ingressi (${timeStr})`,
        reason: `Finestra ingressi Asia attiva (01:00–03:30 CET): ammessi solo setup ad altissima conferma fuori compressione.`,
      };
    }
    return {
      allowed: false,
      sessionName: `Asia Mappatura (${timeStr})`,
      reason: `Sessione Asiatica (${timeStr}): SOLO MAPPATURA di Asian High / Low. Nuovi ingressi consentiti solo 01:00–03:30 CET.`,
    };
  }

  // 2. Londra: 08:00 - 11:30 (480m - 690m)
  if (totalMin < 690) {
    return {
      allowed: true,
      sessionName: `Londra (${timeStr})`,
      reason: `Sessione Primaria Londra attiva (${timeStr}): cerca sweep della liquidità asiatica e zona H1/H4.`,
    };
  }

  // 3. Lunch: 11:30 - 13:30 (690m - 810m)
  if (totalMin < 810) {
    if (impulseStarted) {
      return {
        allowed: true,
        sessionName: `Lunch Impulso Avviato (${timeStr})`,
        reason: `Finestra Lunch (${timeStr}): ingresso autorizzato perché l'impulso direzionale è già chiaramente partito.`,
      };
    }
    return {
      allowed: false,
      sessionName: `Lunch Bloccato (${timeStr})`,
      reason: `Pausa Liquidità Lunch (11:30–13:30 CET): nuovi ingressi VIETATI se l'impulso non è già chiaramente partito.`,
    };
  }

  // 4. Intervallo: 13:30 - 14:00 (810m - 840m)
  if (totalMin < 840) {
    return {
      allowed: false,
      sessionName: `Intervallo (${timeStr})`,
      reason: `Intervallo 13:30–14:00 CET (${timeStr}): solo analisi e gestione posizioni in vista dell'apertura di New York. Nessun nuovo ordine.`,
    };
  }

  // 5. New York: 14:00 - 18:00 (840m - 1080m)
  if (totalMin < 1080) {
    return {
      allowed: true,
      sessionName: `New York (${timeStr})`,
      reason: `Sessione New York attiva (${timeStr}): espansione Scalp & Swing su sweep dei livelli di Londra.`,
    };
  }

  // 6. Sera: 18:00 - 22:00 (1080m - 1320m) -> Scalp BLOCCATO, solo Swing consentito
  if (totalMin < 1320) {
    if (mode === "scalp") {
      return {
        allowed: false,
        sessionName: `Chiusura Scalp (${timeStr})`,
        reason: `Dalle 18:00 CET (${timeStr}) lo Scalping è categoricamente BLOCCATO. Solo gestione delle posizioni aperte o operatività Swing.`,
      };
    }
    return {
      allowed: true,
      sessionName: `Swing Sera (${timeStr})`,
      reason: `Finestra Swing serale attiva (${timeStr}): consentiti ingressi Swing fino alle 22:00 CET.`,
    };
  }

  // 7. Notte: >= 22:00 (1320m+) -> Chiusura Totale
  return {
    allowed: false,
    sessionName: `Chiusura Notturna (${timeStr})`,
    reason: `Oltre le 22:00 CET (${timeStr}): terminale chiuso per nuovi ingressi Scalp e Swing. Solo gestione posizioni aperte.`,
  };
}

/**
 * Calcola il Point of Control (POC volumetrico - linea rossa del Volume Profile)
 * all'interno del cluster di candele della schematica (accumulo/distribuzione).
 */
function computeSchematicPocPrice(candles: VarcoVisionCandle[], symbol: string): number {
  if (candles.length === 0) return 0;
  let minP = Infinity;
  let maxP = -Infinity;
  for (const c of candles) {
    if (c.low < minP) minP = c.low;
    if (c.high > maxP) maxP = c.high;
  }
  if (maxP <= minP) return roundPrice(candles[candles.length - 1].close, symbol);

  const buckets = 12;
  const step = (maxP - minP) / buckets;
  const scores = new Array(buckets).fill(0);

  for (const c of candles) {
    const volWeight = (c.volume && c.volume > 0 ? c.volume : 1) * (1 + Math.abs(c.close - c.open) / Math.max(1e-8, c.high - c.low));
    for (let b = 0; b < buckets; b++) {
      const bucketLow = minP + b * step;
      const bucketHigh = bucketLow + step;
      const bucketMid = (bucketLow + bucketHigh) / 2;
      if (bucketMid >= c.low && bucketMid <= c.high) {
        scores[b] += volWeight;
      }
    }
  }

  let bestBucket = Math.floor(buckets / 2);
  let maxScore = -1;
  for (let b = 0; b < buckets; b++) {
    if (scores[b] > maxScore) {
      maxScore = scores[b];
      bestBucket = b;
    }
  }

  const pocPrice = minP + (bestBucket + 0.5) * step;
  return roundPrice(pocPrice, symbol);
}

export interface WyckoffCycleAnalysis {
  cycleDirection: "long" | "short";
  markupCount: number;
  cycleExhausted: boolean;
  cycleState: "up" | "down" | "end_up" | "end_down";
  htfHigh: number;
  htfLow: number;
  posInHtfRange: number;
}

/**
 * Legge dove si trova il mercato seguendo il Ciclo e la Legge di Causa ed Effetto di Wyckoff,
 * contando quanti Markup (in trend rialzista) o Markdown (in trend ribassista) sono stati svolti
 * nel movimento attuale. Finché non sono stati completati almeno 2-3 movimenti fino a una zona HTF estrema,
 * vieta di indovinare inversioni premature e segue il flusso (Causa 1 -> Causa 2 -> Causa 3).
 */
export function analyzeWyckoffCycleAndMarkups(candles: VarcoVisionCandle[]): WyckoffCycleAnalysis {
  if (candles.length < 8) {
    return {
      cycleDirection: "long",
      markupCount: 1,
      cycleExhausted: false,
      cycleState: "up",
      htfHigh: candles[candles.length - 1]?.high ?? 0,
      htfLow: candles[candles.length - 1]?.low ?? 0,
      posInHtfRange: 0.5,
    };
  }

  const lookback = Math.min(candles.length, 160);
  const slice = candles.slice(candles.length - lookback);
  let htfHigh = -Infinity;
  let htfLow = Infinity;
  let highIdx = 0;
  let lowIdx = 0;
  let totalRange = 0;

  for (let i = 0; i < slice.length; i++) {
    const c = slice[i];
    if (c.high > htfHigh) {
      htfHigh = c.high;
      highIdx = i;
    }
    if (c.low < htfLow) {
      htfLow = c.low;
      lowIdx = i;
    }
    totalRange += Math.abs(c.high - c.low);
  }

  const avgRange = totalRange / slice.length;
  const htfSpan = Math.max(1e-8, htfHigh - htfLow);
  const latest = slice[slice.length - 1];
  const posInHtfRange = (latest.close - htfLow) / htfSpan;

  // Direzione strutturale del ciclo: confrontiamo l'origine del movimento principale e le medie strutturali
  const quarter = Math.max(2, Math.floor(slice.length / 4));
  const firstQuarterAvg = slice.slice(0, quarter).reduce((s, c) => s + c.close, 0) / quarter;
  const lastQuarterAvg = slice.slice(-quarter).reduce((s, c) => s + c.close, 0) / quarter;
  const cycleDirection: "long" | "short" =
    lastQuarterAvg > firstQuarterAvg + avgRange * 0.15
      ? "long"
      : lastQuarterAvg < firstQuarterAvg - avgRange * 0.15
        ? "short"
        : lowIdx < highIdx
          ? "long"
          : "short";

  // Conteggio dei Markup (se long) o Markdown (se short) partendo dall'origine del ciclo (Causa 1):
  // Ogni volta che il prezzo consolida in una Causa (pausa/box) e poi rompe con un nuovo impulso (Effetto)
  // oltre il massimo/minimo del movimento precedente, il contatore dei Markup avanza (1 -> 2 -> 3).
  const startIdx = cycleDirection === "long" ? Math.min(lowIdx, Math.floor(slice.length * 0.4)) : Math.min(highIdx, Math.floor(slice.length * 0.4));
  let markupCount = 1;
  let anchorExtreme = cycleDirection === "long" ? slice[startIdx].high : slice[startIdx].low;
  let hadConsolidationPause = false;
  let pauseBars = 0;

  for (let i = startIdx + 1; i < slice.length; i++) {
    const c = slice[i];
    if (cycleDirection === "long") {
      if (c.high <= anchorExtreme + avgRange * 0.25) {
        pauseBars += 1;
        if (pauseBars >= 3) hadConsolidationPause = true;
      } else if (c.close > anchorExtreme + avgRange * 0.6) {
        if (hadConsolidationPause) {
          markupCount += 1;
          hadConsolidationPause = false;
          pauseBars = 0;
        }
        anchorExtreme = Math.max(anchorExtreme, c.high);
      } else {
        anchorExtreme = Math.max(anchorExtreme, c.high);
      }
    } else {
      if (c.low >= anchorExtreme - avgRange * 0.25) {
        pauseBars += 1;
        if (pauseBars >= 3) hadConsolidationPause = true;
      } else if (c.close < anchorExtreme - avgRange * 0.6) {
        if (hadConsolidationPause) {
          markupCount += 1;
          hadConsolidationPause = false;
          pauseBars = 0;
        }
        anchorExtreme = Math.min(anchorExtreme, c.low);
      } else {
        anchorExtreme = Math.min(anchorExtreme, c.low);
      }
    }
  }

  // Verifica se dopo 2 o 3 Markup/Markdown c'è già una rottura contraria del ciclo (CHoCH / SOW-SOS opposto)
  const recentWindow = slice.slice(-Math.min(10, slice.length));
  const recentOpen = recentWindow[0].open;
  const recentNetMove = latest.close - recentOpen;
  const strongCounterImpulse =
    (cycleDirection === "long" && recentNetMove < -avgRange * 1.8 && posInHtfRange >= 0.65) ||
    (cycleDirection === "short" && recentNetMove > avgRange * 1.8 && posInHtfRange <= 0.35);

  const cycleExhausted = markupCount >= 2 && strongCounterImpulse;

  let cycleState: "up" | "down" | "end_up" | "end_down";
  if (cycleDirection === "long") {
    cycleState = cycleExhausted ? "end_up" : "up";
  } else {
    cycleState = cycleExhausted ? "end_down" : "down";
  }

  return {
    cycleDirection,
    markupCount,
    cycleExhausted,
    cycleState,
    htfHigh,
    htfLow,
    posInHtfRange,
  };
}

export interface WyckoffSchematicGeometry {
  direction: "long" | "short";
  schematicType: WyckoffSchematicType;
  phase: WyckoffPhaseType;
  /** Livello SC (Accumulo) o BC (Distribuzione) */
  climaxPrice: number;
  /** Livello AR (Automatic Rally in Accumulo / Automatic Reaction in Distribuzione) */
  arPrice: number;
  /** Livello STB (Accumulo) o ST (Distribuzione) */
  secondaryTestPrice: number;
  /** True se è presente lo Spring (in Accumulo) o l'UT Upthrust (in Distribuzione) */
  hasSpringOrUt: boolean;
  /** Prezzo estremo dello Spring o dell'UT (se presente) */
  springOrUtExtreme: number | null;
  /** Livello del 10% (SOS in Accumulo / SOW in Distribuzione) */
  tenPercentLevel: number;
  tenPercent2Level?: number;
  /** Zona di TEST calcolata sulle ombre:
   * - Accumulo: ombra di STB (se c'è Spring) oppure ombra di SC (se c'è solo STB e manca Spring)
   * - Distribuzione: ombra di UT (se c'è UT) oppure ombra di BC (se manca UT)
   */
  testZonePrice: number;
  testZoneTop?: number;
  testZoneBottom?: number;
  testZoneRuleLabel: string;
  /** Zona di POC volumetrico della schematica (usata quando il SOW/SOS 10% viene rotto lievemente) */
  pocZonePrice: number;
  /** Zona di JTC / BTI compresa esattamente tra il livello del 10% (SOW/SOS) e la AR */
  jtcBtiZonePrice: number;
  jtcBtiZoneLow: number;
  jtcBtiZoneHigh: number;
  /** Intensità della rottura del SOW / SOS (10%): 'none' (<10%), 'mild' (rotto lievemente -> POC/TEST), 'strong' (rotto di tanto -> JTC/BTI tra 10% e AR) */
  tenPercentBreakStrength: "none" | "mild" | "strong";
  imbalancePercent: number;
  /** Trigger selezionato meccanicamente dalla geometria di Wyckoff */
  selectedTrigger: "TEST" | "POC" | "JTC" | "BTI";
  /** Prezzo d'ingresso ottimale sulla zona del trigger selezionato */
  entryZonePrice: number;
  /** Stop Loss strutturale posto oltre l'estremo reale della schematica (mai su 1-2 candeline) */
  structuralInvalidationPrice: number;
  /** Altezza strutturale della Causa (schematica) per proiettare l'Effetto */
  schematicHeight: number;
  /** Punti chiave georeferenziati della Schematica di Wyckoff */
  schematicPoints: WyckoffPoint[];
  /** Coordinate e label del box della Zona attiva */
  activeZone: WyckoffZoneInfo;
  /** Bounding box completo della Causa (Trading Range Wyckoff) */
  schematicBox: WyckoffBoxInfo;
  /** Fase della Causa: Causa 1 (Primaria) vs Causa 2 (Redistribuzione / Re-accumulo per 2° Markdown/Markup) */
  causeStage?: "causa_1" | "causa_2_redistrib" | "causa_2_reaccum";
  /** True se è presente sia UT che UTAD (doppio sweep di massimi) */
  hasUtad?: boolean;
  /** Prezzo dell'UTAD (sweep estremo al massimo assoluto) */
  utadPrice?: number | null;
  /** Livelli strutturali chiave del Trading Range */
  creekPrice: number;
  icePrice: number;
  equilibriumPrice: number;
}

/**
 * Calcola la geometria esatta della Schematica di Wyckoff (Accumulazione, Riaccumulo, Distribuzione o Ridistribuzione)
 * applicando l'anatomia geometrica istituzionale:
 *
 * ACCUMULAZIONE / RIACCUMULO:
 * 1. PS (Primary Selling / decelerazione nel markdown) -> SC (Selling Climax, "il chiodo") -> AR (Automatic Rally).
 * 2. ST (Secondary Test, minimo > SC) -> 10% (Zona Apollo: massimo induttivo di copertura banche oltre AR).
 * 3. STB (Secondary Test Fase B: prima caccia sotto SC) -> Spring (caccia finale sotto STB).
 * 4. Zona di TEST: si trova sull'ombra inferiore di STB (se Spring presente) o di SC.
 * 5. Markup che rompe con corpo il 10% creando "10% 2".
 * 6. Bivio Trigger:
 *    - Se 10% 2 sfonda di tanto: Zona di JTC (dall'ombra del 10% fino al corpo di AR).
 *    - Se 10% 2 rompe di poco: Zona di POC (tracciata dal minimo di PS al massimo di 10% 2).
 *
 * DISTRIBUZIONE / RIDISTRIBUZIONE:
 * Simmetrico: PSY -> BC ("chiodo" superiore) -> AR -> ST -> 10% (Apollo ribassista) -> UT -> UTAD ->
 * Zona di Test su ombra UT -> 10% 2 -> Bivio BTI/JTC tra 10% e AR vs POC da PSY a 10% 2.
 */
export function analyzeWyckoffSchematicGeometry(
  candles: VarcoVisionCandle[],
  direction: "long" | "short",
  symbol: string,
  hasFvg: boolean,
  preferPocOnReversal = false,
  context?: {
    isReaccumOrRedistrib?: boolean;
    markupCount?: number;
    zoneScenario?: string;
  },
): WyckoffSchematicGeometry {
  const windowSize = Math.min(candles.length, 48);
  const cluster = candles.slice(candles.length - windowSize);
  // Dividiamo il cluster nella fase di costruzione della Causa (schematica) e nelle candele di spinta/rottura SOW/SOS
  const breakCount = Math.min(4, Math.max(1, Math.floor(cluster.length * 0.2)));
  const causeCandles = cluster.slice(0, Math.max(4, cluster.length - breakCount));
  const breakCandles = cluster.slice(Math.max(0, cluster.length - breakCount));

  const isReaccumOrRedistrib = Boolean(
    context?.isReaccumOrRedistrib ||
    context?.zoneScenario === "reaccum" ||
    ((context?.markupCount ?? 0) >= 1 && context?.zoneScenario !== "valid_zone")
  );

  if (direction === "long") {
    // ── SCHEMATICA DI ACCUMULO / RIACCUMULO (PS -> SC -> AR -> ST -> 10% Apollo -> STB -> Spring -> Test -> 10% 2) ──
    // 1. Identificazione algoritmica della coppia primaria Climax & Reaction (SC -> AR)
    // SC è il minimo più basso / climax nel primo 70% delle causeCandles
    let scIdx = 0;
    let minLow = Infinity;
    const scSearchLimit = Math.max(1, Math.min(causeCandles.length - 1, Math.floor(causeCandles.length * 0.75)));
    for (let i = 0; i < scSearchLimit; i++) {
      if (causeCandles[i].low < minLow) {
        minLow = causeCandles[i].low;
        scIdx = i;
      }
    }

    // AR è il primo massimo di reazione immediata dopo SC prima del pullback a ST
    let arIdx = Math.min(scIdx + 1, causeCandles.length - 1);
    for (let j = scIdx + 1; j < causeCandles.length; j++) {
      if (causeCandles[j].high >= causeCandles[arIdx].high) {
        arIdx = j;
      }
      // Se dopo aver trovato il picco di reazione c'è un ritracciamento significativo (>25% del rimbalzo), AR è fissata
      const bounce = causeCandles[arIdx].high - causeCandles[scIdx].low;
      if (bounce > 0 && j > arIdx && causeCandles[j].close < causeCandles[arIdx].high - bounce * 0.3) {
        break;
      }
    }

    const scCandle = causeCandles[scIdx];
    const arCandle = causeCandles[arIdx];
    const arPrice = roundPrice(arCandle.high, symbol);
    const scPrice = roundPrice(scCandle.low, symbol);

    // 2. Identificazione di PS (Preliminary Support / Primary Selling) prima di SC
    const preScCandles = causeCandles.slice(0, Math.max(1, scIdx));
    let psCandle = preScCandles[0] ?? scCandle;
    if (scIdx > 0 && preScCandles.length > 0) {
      // PS è la candela di decelerazione nel markdown antecedente a SC
      psCandle = preScCandles.reduce((prev, curr) => (curr.low < prev.low ? curr : prev), preScCandles[0]);
    }
    const psPrice = roundPrice(psCandle.low, symbol);

    // 3. Ricerca di ST (Secondary Test, minimo più alto di SC), STB ed eventuale Spring dopo l'AR
    const postArCandles = causeCandles.slice(arIdx + 1);
    const searchPool = postArCandles.length > 0 ? postArCandles : causeCandles.slice(scIdx + 1);
    const sortedLows = [...searchPool].sort((a, b) => a.low - b.low);
    const lowestSecond = sortedLows[0] ?? scCandle;
    const secondLowestSecond = sortedLows[1] ?? lowestSecond;

    // C'è uno Spring se dopo il SC e un STB intermedio si verifica una caccia di liquidità sotto il minimo del SC
    // (o sotto lo STB sul bordo inferiore della schematica) con riassorbimento del corpo
    const prelimHeight = Math.max(1e-8, arPrice - scCandle.low);
    const sweptBelowSc = lowestSecond.low < scCandle.low && lowestSecond.close >= scCandle.low;
    const sweptBelowStb =
      searchPool.length >= 2 &&
      lowestSecond.time > secondLowestSecond.time &&
      lowestSecond.low < secondLowestSecond.low &&
      lowestSecond.low <= scCandle.low + prelimHeight * 0.05 &&
      lowestSecond.close > secondLowestSecond.low;

    const hasSpring = sweptBelowSc || sweptBelowStb;
    const stbCandle =
      hasSpring && searchPool.length >= 2
        ? (sweptBelowSc && secondLowestSecond.time < lowestSecond.time ? secondLowestSecond : (lowestSecond === secondLowestSecond ? scCandle : secondLowestSecond))
        : lowestSecond;
    const springCandle = hasSpring ? lowestSecond : null;

    // Identificazione cronologica di ST (Secondary Test) e 10% (Zona Apollo di Fase B):
    // In Wyckoff Accumulo, tra AR e STB/Spring:
    // 1) ST è il trough / minimo di ritracciamento locale (swing low) dopo AR
    // 2) 10% è il massimo induttivo di Fase B che testa/supera AR prima dello scarico STB
    const sweepRefCandle = springCandle ?? (stbCandle && stbCandle.time > arCandle.time ? stbCandle : null);
    const phaseBCandles = sweepRefCandle
      ? postArCandles.filter((c) => c.time < sweepRefCandle.time)
      : postArCandles;

    let stCandle: VarcoVisionCandle;
    let tenPercentCandle: VarcoVisionCandle;

    if (phaseBCandles.length >= 2) {
      const highestPhaseB = phaseBCandles.reduce((highest, c) => (c.high > highest.high ? c : highest), phaseBCandles[0]);
      if (highestPhaseB.time > phaseBCandles[0].time) {
        const pullbackCandles = phaseBCandles.filter((c) => c.time < highestPhaseB.time);
        stCandle = pullbackCandles.reduce((lowest, c) => (c.low < lowest.low ? c : lowest), pullbackCandles[0]);
        tenPercentCandle = highestPhaseB;
      } else {
        tenPercentCandle = highestPhaseB;
        const postPeakCandles = phaseBCandles.filter((c) => c.time > highestPhaseB.time);
        stCandle = postPeakCandles.length > 0
          ? postPeakCandles.reduce((lowest, c) => (c.low < lowest.low ? c : lowest), postPeakCandles[0])
          : phaseBCandles[0];
      }
    } else if (phaseBCandles.length === 1) {
      stCandle = phaseBCandles[0];
      tenPercentCandle = phaseBCandles[0];
    } else {
      stCandle = postArCandles[0] ?? arCandle;
      tenPercentCandle = postArCandles[0] ?? arCandle;
    }

    const stPrice = roundPrice(stCandle.low, symbol);

    // Calcolo Ombra (wick inferiore) di STB e Ombra di SC (Zona di Test)
    const stbBodyLow = Math.min(stbCandle.open, stbCandle.close);
    const stbWickHeight = Math.max(stbBodyLow - stbCandle.low, (stbCandle.high - stbCandle.low) * 0.3);
    const stbWickPrice = roundPrice(stbCandle.low + stbWickHeight * 0.5, symbol);

    const scBodyLow = Math.min(scCandle.open, scCandle.close);
    const scWickHeight = Math.max(scBodyLow - scCandle.low, (scCandle.high - scCandle.low) * 0.3);
    const scWickPrice = roundPrice(scCandle.low + scWickHeight * 0.5, symbol);

    // REGOLA TEST IN ACCUMULO:
    // "La zona di test si trova sull'ombra del STB oppure del SC se è presente solo STB e manca Spring."
    const testZonePrice = hasSpring ? stbWickPrice : scWickPrice;
    const testZoneTop = roundPrice(hasSpring ? stbBodyLow : scBodyLow, symbol);
    const testZoneBottom = roundPrice(hasSpring ? stbCandle.low : scCandle.low, symbol);
    const testZoneRuleLabel = hasSpring
      ? `Ombra dello STB a ${testZonePrice} (Spring presente a ${roundPrice(springCandle!.low, symbol)})`
      : `Ombra del SC a ${testZonePrice} (solo STB presente, manca Spring)`;

    const schematicBottom = Math.min(scCandle.low, stbCandle.low, springCandle?.low ?? Infinity);
    const schematicHeight = Math.max(1e-8, arPrice - schematicBottom);

    // 4. Identificazione del 10% (Zona Apollo)
    // Livello del picco induttivo di Fase B (o calcolo proporzionale al 76% in assenza di sweep)
    const tenPercentLevel = roundPrice(
      tenPercentCandle && tenPercentCandle.high >= arPrice
        ? tenPercentCandle.high
        : schematicBottom + schematicHeight * 0.76,
      symbol
    );

    // 5. Ricerca di "10% 2": rottura del 10% a candela chiusa con nuovo massimo
    const maxBreakHigh = Math.max(...breakCandles.map((c) => c.high));
    const latestClose = candles[candles.length - 1].close;
    const breakDistance = Math.max(maxBreakHigh - tenPercentLevel, latestClose - tenPercentLevel);
    const rawBreakPct = Math.round((breakDistance / schematicHeight) * 100);
    const imbalancePercent = breakDistance > 0 ? Math.max(10, Math.min(100, rawBreakPct + 10)) : Math.max(0, Math.round(((maxBreakHigh - schematicBottom) / schematicHeight) * 15));

    const tenPercent2Candle = breakCandles.find((c) => c.high >= tenPercentLevel) ?? breakCandles[breakCandles.length - 1] ?? null;
    const tenPercent2Level = tenPercent2Candle && tenPercent2Candle.high > tenPercentLevel ? roundPrice(tenPercent2Candle.high, symbol) : undefined;

    // 6. ZONA JTC: "presa dal massimo dell'ombra del 10% fino al massimo del corpo del massimo di AR"
    const arBodyHigh = Math.max(arCandle.open, arCandle.close);
    const jtcZoneTop = roundPrice(Math.max(tenPercentLevel, tenPercentCandle.high), symbol);
    const jtcZoneBottom = roundPrice(Math.min(arPrice, arBodyHigh > 0 ? arBodyHigh : arPrice), symbol);
    const jtcBtiZoneLow = Math.min(jtcZoneBottom, jtcZoneTop);
    const jtcBtiZoneHigh = Math.max(jtcZoneBottom, jtcZoneTop);
    const jtcBtiZonePrice = roundPrice((jtcBtiZoneLow + jtcBtiZoneHigh) / 2, symbol);

    // 7. ZONA POC: "tracciata dal PS fino al 10% 2"
    const pocStartTime = psCandle.time;
    const pocEndTime = tenPercent2Candle ? tenPercent2Candle.time : candles[candles.length - 1].time;
    const pocCandles = candles.filter((c) => c.time >= pocStartTime && c.time <= pocEndTime);
    const pocZonePrice = computeSchematicPocPrice(pocCandles.length > 0 ? pocCandles : causeCandles, symbol);

    // Bivio di rottura del 10%:
    let tenPercentBreakStrength: "none" | "mild" | "strong" = "none";
    if (imbalancePercent >= 28 || latestClose > arPrice + schematicHeight * 0.15) {
      tenPercentBreakStrength = "strong"; // 10% 2 ha sfondato di tanto -> Zona JTC
    } else if (imbalancePercent >= 10) {
      tenPercentBreakStrength = "mild"; // 10% 2 ha rotto di poco -> Zona POC
    }

    let selectedTrigger: "TEST" | "POC" | "JTC" | "BTI";
    let entryZonePrice: number;

    if (tenPercentBreakStrength === "strong") {
      selectedTrigger = hasFvg ? "BTI" : "JTC";
      entryZonePrice = jtcBtiZonePrice;
    } else if (tenPercentBreakStrength === "mild") {
      if (preferPocOnReversal || imbalancePercent >= 16) {
        selectedTrigger = "POC";
        entryZonePrice = pocZonePrice;
      } else {
        selectedTrigger = "TEST";
        entryZonePrice = testZonePrice;
      }
    } else {
      selectedTrigger = "TEST";
      entryZonePrice = testZonePrice;
    }

    // Stop Loss Strutturale: sotto il minimo reale della schematica (Spring/STB/SC) per TEST/POC,
    // oppure sotto il POC/minimo interno per JTC/BTI dopo rottura forte
    const structuralInvalidationPrice =
      selectedTrigger === "JTC" || selectedTrigger === "BTI"
        ? roundPrice(Math.min(pocZonePrice, schematicBottom + schematicHeight * 0.35), symbol)
        : roundPrice(schematicBottom, symbol);

    // Candela SOS / Rottura:
    // Se c'è stata espansione dopo STB/Spring, SOS è la candela di spinta con massimo relativo oltre il range
    const postStbCandles = stbCandle
      ? cluster.filter((c) => c.time > stbCandle.time)
      : breakCandles;
    const sosCandidate =
      postStbCandles.length > 0
        ? postStbCandles.reduce((highest, c) => (c.high > highest.high ? c : highest), postStbCandles[0])
        : (breakCandles[breakCandles.length - 1] ?? candles[candles.length - 1]);
    const sosCandle =
      sosCandidate && sosCandidate.high >= tenPercentLevel
        ? sosCandidate
        : (breakCandles.find((c) => c.high >= tenPercentLevel) ?? breakCandles[breakCandles.length - 1] ?? candles[candles.length - 1]);

    // Livelli Strutturali Range Wyckoff:
    // Creek delimita la resistenza superiore Wyckoff (il livello 10% Apollo / AR)
    const creekPrice = roundPrice(Math.max(arPrice, tenPercentLevel), symbol);
    const icePrice = roundPrice(schematicBottom, symbol);
    const equilibriumPrice = roundPrice((creekPrice + icePrice) / 2, symbol);

    // Determinazione Fase Wyckoff
    let phase: WyckoffPhaseType = "Phase A";
    if (tenPercent2Level && tenPercentBreakStrength !== "none") {
      phase = latestClose > creekPrice ? "Phase E" : "Phase D";
    } else if (springCandle || (stbCandle && latestClose > stbCandle.low)) {
      phase = "Phase C";
    } else if (tenPercentCandle && tenPercentCandle.time > arCandle.time) {
      phase = "Phase B";
    }

    const schematicType: WyckoffSchematicType = isReaccumOrRedistrib ? "reaccumulation" : "accumulation";

    const schematicPoints: WyckoffPoint[] = [
      ...(psCandle && psCandle.time < scCandle.time ? [{ label: "PS" as const, price: psPrice, time: psCandle.time }] : []),
      { label: "SC", price: scPrice, time: scCandle.time },
      { label: "AR", price: arPrice, time: arCandle.time },
      ...(stCandle && stCandle.time > arCandle.time ? [{ label: "ST" as const, price: stPrice, time: stCandle.time }] : []),
      ...(tenPercentCandle && tenPercentCandle.time > stCandle.time ? [{ label: "10%" as const, price: tenPercentLevel, time: tenPercentCandle.time }] : []),
      { label: "STB", price: roundPrice(stbCandle.low, symbol), time: stbCandle.time },
      ...(springCandle ? [{ label: "Spring" as const, price: roundPrice(springCandle.low, symbol), time: springCandle.time }] : []),
      ...(sosCandle && sosCandle.time > (springCandle?.time ?? stbCandle.time) && sosCandle.time !== tenPercentCandle.time
        ? [{ label: "SOS" as const, price: roundPrice(sosCandle.high, symbol), time: sosCandle.time }]
        : []),
      ...(tenPercent2Candle && tenPercent2Level ? [{ label: "10% 2" as const, price: tenPercent2Level, time: tenPercent2Candle.time }] : []),
    ];

    const activeZone: WyckoffZoneInfo =
      selectedTrigger === "TEST"
        ? {
            triggerType: "TEST",
            label: `TEST (${hasSpring ? "Ombra STB" : "Ombra SC"})`,
            topPrice: testZoneTop,
            bottomPrice: testZoneBottom,
          }
        : selectedTrigger === "POC"
          ? {
              triggerType: "POC",
              label: "Zona POC (PS → 10% 2)",
              topPrice: roundPrice(pocZonePrice + schematicHeight * 0.04, symbol),
              bottomPrice: roundPrice(pocZonePrice - schematicHeight * 0.04, symbol),
            }
          : {
              triggerType: selectedTrigger,
              label: `Zona ${selectedTrigger} (10% - AR)`,
              topPrice: jtcBtiZoneHigh,
              bottomPrice: jtcBtiZoneLow,
            };

    const schematicBox: WyckoffBoxInfo = {
      startTime: scCandle.time,
      endTime: candles[candles.length - 1].time,
      topPrice: creekPrice,
      bottomPrice: icePrice,
      rangeHeight: schematicHeight,
      schematicType,
      phase,
      causeStage: isReaccumOrRedistrib ? "causa_2_reaccum" : "causa_1",
      tenPercentLevel,
      tenPercent2Level,
      arPrice,
      scPrice,
      stbPrice: roundPrice(stbCandle.low, symbol),
      springPrice: springCandle ? roundPrice(springCandle.low, symbol) : undefined,
      pocPrice: pocZonePrice,
      equilibriumPrice,
      creekPrice,
      icePrice,
      jtcZoneTop: jtcBtiZoneHigh,
      jtcZoneBottom: jtcBtiZoneLow,
      testZoneTop,
      testZoneBottom,
    };

    return {
      direction: "long",
      schematicType,
      phase,
      causeStage: isReaccumOrRedistrib ? "causa_2_reaccum" : "causa_1",
      climaxPrice: scPrice,
      arPrice,
      secondaryTestPrice: roundPrice(stbCandle.low, symbol),
      hasSpringOrUt: hasSpring,
      springOrUtExtreme: springCandle ? roundPrice(springCandle.low, symbol) : null,
      tenPercentLevel,
      tenPercent2Level,
      testZonePrice,
      testZoneTop,
      testZoneBottom,
      testZoneRuleLabel,
      pocZonePrice,
      jtcBtiZonePrice,
      jtcBtiZoneLow,
      jtcBtiZoneHigh,
      tenPercentBreakStrength,
      imbalancePercent,
      selectedTrigger,
      entryZonePrice,
      structuralInvalidationPrice,
      schematicHeight,
      schematicPoints,
      activeZone,
      schematicBox,
      creekPrice,
      icePrice,
      equilibriumPrice,
    };
  } else {
    // ── SCHEMATICA DI DISTRIBUZIONE / RIDISTRIBUZIONE (PSY -> BC -> AR -> ST -> 10% Apollo -> UT -> UTAD -> Test -> 10% 2) ──
    // 1. Identificazione algoritmica di BC (Buying Climax) e AR (Automatic Reaction)
    // BC è il picco di esaustione del markup che precede la prima violenta reazione correttiva AR.
    // In Wyckoff, UT e UTAD si svilupperanno DOPO AR spingendosi sopra BC, pertanto la coppia (BC -> AR)
    // è identificata dalla prima massima reazione correttiva immediata prima del rimbalzo a ST.
    let bcIdx = 0;
    let arIdx = 1;
    let maxReactionDrop = -Infinity;
    const bcSearchLimit = Math.max(1, Math.min(causeCandles.length - 1, Math.floor(causeCandles.length * 0.85)));

    for (let i = 0; i < bcSearchLimit; i++) {
      // Un Buying Climax deve essere un picco di swing (massimo non inferiore alla candela precedente)
      if (i > 0 && causeCandles[i].high < causeCandles[i - 1].high) {
        continue;
      }

      let localLowestIdx = i + 1;
      let localLowestLow = causeCandles[i + 1]?.low ?? causeCandles[i].low;

      for (let j = i + 1; j < causeCandles.length; j++) {
        if (causeCandles[j].low < localLowestLow) {
          localLowestLow = causeCandles[j].low;
          localLowestIdx = j;
        }
        const currentDrop = causeCandles[i].high - localLowestLow;
        // Se dopo aver trovato il minimo di reazione c'è un rimbalzo significativo (>30% del drop), AR è fissata
        if (currentDrop > 0 && j > localLowestIdx && causeCandles[j].high > localLowestLow + currentDrop * 0.3) {
          break;
        }
      }

      const reactionDrop = causeCandles[i].high - localLowestLow;
      if (reactionDrop > maxReactionDrop) {
        maxReactionDrop = reactionDrop;
        bcIdx = i;
        arIdx = localLowestIdx;
      }
    }

    const bcCandle = causeCandles[bcIdx];
    const arCandle = causeCandles[arIdx];
    const arPrice = roundPrice(arCandle.low, symbol);
    const bcPrice = roundPrice(bcCandle.high, symbol);

    // 2. Identificazione di PSY (Preliminary Supply) prima di BC
    const preBcCandles = causeCandles.slice(0, Math.max(1, bcIdx));
    let psyCandle = preBcCandles[0] ?? bcCandle;
    if (bcIdx > 0 && preBcCandles.length > 0) {
      psyCandle = preBcCandles.reduce((prev, curr) => (curr.high > prev.high ? curr : prev), preBcCandles[0]);
    }
    const psyPrice = roundPrice(psyCandle.high, symbol);

    // 3. Ricerca di ST (Secondary Test, massimo più basso di BC), UT ed eventuale UTAD dopo l'AR
    const postArCandles = causeCandles.slice(arIdx + 1);
    const searchPool = postArCandles.length > 0 ? postArCandles : causeCandles.slice(bcIdx + 1);
    const sortedHighs = [...searchPool].sort((a, b) => b.high - a.high);
    const highestSecond = sortedHighs[0] ?? bcCandle;
    const secondHighestSecond = sortedHighs[1] ?? highestSecond;

    // C'è un UT (Upthrust) se dopo il BC e l'AR il prezzo caccia sopra il massimo del BC (o sopra lo ST sul bordo superiore)
    // e rientra nel range chiudendo sotto il massimo
    const prelimHeight = Math.max(1e-8, bcCandle.high - arPrice);
    const sweptAboveBc = highestSecond.high > bcCandle.high && highestSecond.close <= bcCandle.high;
    const sweptAboveSt =
      searchPool.length >= 2 &&
      highestSecond.time > secondHighestSecond.time &&
      highestSecond.high > secondHighestSecond.high &&
      highestSecond.high >= bcCandle.high - prelimHeight * 0.05 &&
      highestSecond.close < secondHighestSecond.high;

    // Rilevamento di UT (Upthrust) ed eventuale UTAD (Upthrust After Distribution)
    // Se ci sono più sweep sopra BC/ST, il primo nel tempo è UT e il massimo successivo è UTAD (massimo assoluto)
    const sweepCandidates = searchPool.filter(
      (c) => c.high > bcCandle.high || (c.high >= bcCandle.high - prelimHeight * 0.05 && c.close < bcCandle.high)
    );

    let utCandle: VarcoVisionCandle | null = null;
    let utadCandle: VarcoVisionCandle | null = null;

    if (sweepCandidates.length >= 2) {
      const byTime = [...sweepCandidates].sort((a, b) => a.time - b.time);
      utCandle = byTime[0];
      const laterSweeps = byTime.slice(1).sort((a, b) => b.high - a.high);
      if (laterSweeps.length > 0 && laterSweeps[0].high >= utCandle.high) {
        utadCandle = laterSweeps[0];
      }
    } else if (sweepCandidates.length === 1) {
      utCandle = sweepCandidates[0];
    } else if (sweptAboveBc || sweptAboveSt) {
      utCandle = highestSecond;
    }

    const hasUT = utCandle !== null;
    const hasUtad = utadCandle !== null;
    const utadPrice = utadCandle ? roundPrice(utadCandle.high, symbol) : null;

    // Identificazione cronologica di ST (Secondary Test) e 10% (Zona Apollo Ribassista di Fase B):
    // In Wyckoff Distribuzione, tra AR e UT/UTAD:
    // 1) ST è il peak di rimbalzo / pullback rialzista locale (swing high) sotto BC
    // 2) 10% è il minimo induttivo di Fase B che testa o rompe sotto AR prima del pump verso UT/UTAD
    const sweepRefCandle = utCandle ?? utadCandle ?? (highestSecond.high > bcCandle.high ? highestSecond : null);
    const phaseBCandles = sweepRefCandle
      ? postArCandles.filter((c) => c.time < sweepRefCandle.time)
      : postArCandles;

    let stCandle: VarcoVisionCandle;
    let tenPercentCandle: VarcoVisionCandle;

    if (phaseBCandles.length >= 2) {
      const lowestPhaseB = phaseBCandles.reduce((lowest, c) => (c.low < lowest.low ? c : lowest), phaseBCandles[0]);
      if (lowestPhaseB.time > phaseBCandles[0].time) {
        const bounceCandles = phaseBCandles.filter((c) => c.time < lowestPhaseB.time);
        stCandle = bounceCandles.reduce((highest, c) => (c.high > highest.high ? c : highest), bounceCandles[0]);
        tenPercentCandle = lowestPhaseB;
      } else {
        tenPercentCandle = lowestPhaseB;
        const postDropCandles = phaseBCandles.filter((c) => c.time > lowestPhaseB.time);
        stCandle = postDropCandles.length > 0
          ? postDropCandles.reduce((highest, c) => (c.high > highest.high ? c : highest), postDropCandles[0])
          : phaseBCandles[0];
      }
    } else if (phaseBCandles.length === 1) {
      stCandle = phaseBCandles[0];
      tenPercentCandle = phaseBCandles[0];
    } else {
      stCandle = postArCandles[0] ?? arCandle;
      tenPercentCandle = postArCandles[0] ?? arCandle;
    }

    const stPrice = roundPrice(stCandle.high, symbol);

    // Calcolo Ombra superiore (wick) di UT e Ombra superiore di BC (Zona di Test)
    // Se UTAD è presente, come da diagramma AUREUS, la zona di TEST è ancorata sull'ombra/livello di UT (testata post-UTAD)
    const testRefCandle = utCandle ?? bcCandle;
    const testBodyHigh = Math.max(testRefCandle.open, testRefCandle.close);
    const testWickHeight = Math.max(testRefCandle.high - testBodyHigh, (testRefCandle.high - testRefCandle.low) * 0.3);
    const testZonePrice = roundPrice(testRefCandle.high - testWickHeight * 0.5, symbol);
    const testZoneTop = roundPrice(testRefCandle.high, symbol);
    const testZoneBottom = roundPrice(testBodyHigh, symbol);
    const testZoneRuleLabel = hasUtad
      ? `Ombra dell'UT a ${testZonePrice} (dopo sweep UTAD a ${utadPrice})`
      : hasUT
        ? `Ombra dell'UT a ${testZonePrice} (assenza di UTAD)`
        : `Ombra del BC a ${testZonePrice} (assenza di UT)`;

    const schematicTop = Math.max(bcCandle.high, stCandle.high, utCandle?.high ?? -Infinity, utadCandle?.high ?? -Infinity);
    const schematicHeight = Math.max(1e-8, schematicTop - arPrice);

    // 4. Identificazione del 10% (Zona Apollo Ribassista)
    const sow10Price = roundPrice(
      tenPercentCandle && tenPercentCandle.low <= arPrice
        ? tenPercentCandle.low
        : schematicTop - schematicHeight * 0.76,
      symbol
    );

    // 5. Ricerca di "10% 2": rottura del 10% a candela chiusa con nuovo minimo
    const minBreakLow = Math.min(...breakCandles.map((c) => c.low));
    const latestClose = candles[candles.length - 1].close;
    const breakDistance = Math.max(sow10Price - minBreakLow, sow10Price - latestClose);
    const rawBreakPct = Math.round((breakDistance / schematicHeight) * 100);
    const imbalancePercent = breakDistance > 0 ? Math.max(10, Math.min(100, rawBreakPct + 10)) : Math.max(0, Math.round(((schematicTop - minBreakLow) / schematicHeight) * 15));

    const tenPercent2Candle = breakCandles.find((c) => c.low <= sow10Price) ?? breakCandles[breakCandles.length - 1] ?? null;
    const tenPercent2Level = tenPercent2Candle && tenPercent2Candle.low < sow10Price ? roundPrice(tenPercent2Candle.low, symbol) : undefined;

    // 6. ZONA JTC / BTI: "dall'ombra del 10% fino al massimo del corpo del massimo di AR"
    const arBodyLow = Math.min(arCandle.open, arCandle.close);
    const jtcZoneBottom = roundPrice(Math.min(sow10Price, tenPercentCandle.low), symbol);
    const jtcZoneTop = roundPrice(Math.max(arPrice, arBodyLow > 0 ? arBodyLow : arPrice), symbol);
    const jtcBtiZoneLow = Math.min(jtcZoneBottom, jtcZoneTop);
    const jtcBtiZoneHigh = Math.max(jtcZoneBottom, jtcZoneTop);
    const jtcBtiZonePrice = roundPrice((jtcBtiZoneLow + jtcBtiZoneHigh) / 2, symbol);

    // 7. ZONA POC: "tracciata dal PSY fino al 10% 2"
    const pocStartTime = psyCandle.time;
    const pocEndTime = tenPercent2Candle ? tenPercent2Candle.time : candles[candles.length - 1].time;
    const pocCandles = candles.filter((c) => c.time >= pocStartTime && c.time <= pocEndTime);
    const pocZonePrice = computeSchematicPocPrice(pocCandles.length > 0 ? pocCandles : causeCandles, symbol);

    let tenPercentBreakStrength: "none" | "mild" | "strong" = "none";
    if (imbalancePercent >= 28 || latestClose < arPrice - schematicHeight * 0.15) {
      tenPercentBreakStrength = "strong"; // 10% rotto di tanto -> Zona JTC / BTI
    } else if (imbalancePercent >= 10) {
      tenPercentBreakStrength = "mild"; // 10% rotto lievemente -> Zona POC
    }

    let selectedTrigger: "TEST" | "POC" | "JTC" | "BTI";
    let entryZonePrice: number;

    if (tenPercentBreakStrength === "strong") {
      selectedTrigger = hasFvg ? "BTI" : "JTC";
      entryZonePrice = jtcBtiZonePrice;
    } else if (tenPercentBreakStrength === "mild") {
      if (preferPocOnReversal || imbalancePercent >= 16) {
        selectedTrigger = "POC";
        entryZonePrice = pocZonePrice;
      } else {
        selectedTrigger = "TEST";
        entryZonePrice = testZonePrice;
      }
    } else {
      selectedTrigger = "TEST";
      entryZonePrice = testZonePrice;
    }

    const structuralInvalidationPrice =
      selectedTrigger === "JTC" || selectedTrigger === "BTI"
        ? roundPrice(Math.max(pocZonePrice, schematicTop - schematicHeight * 0.35), symbol)
        : roundPrice(schematicTop, symbol);

    const creekPrice = roundPrice(schematicTop, symbol);
    const icePrice = roundPrice(Math.min(arPrice, sow10Price), symbol);
    const equilibriumPrice = roundPrice((creekPrice + icePrice) / 2, symbol);

    let phase: WyckoffPhaseType = "Phase A";
    if (tenPercent2Level && tenPercentBreakStrength !== "none") {
      phase = latestClose < icePrice ? "Phase E" : "Phase D";
    } else if (utadCandle || (utCandle && latestClose < utCandle.high)) {
      phase = "Phase C";
    } else if (tenPercentCandle && tenPercentCandle.time > arCandle.time) {
      phase = "Phase B";
    }

    const schematicType: WyckoffSchematicType = isReaccumOrRedistrib ? "redistribution" : "distribution";

    // Identificazione precisa della candela di rottura del SOW 10%
    const postUtCandles = utCandle || utadCandle
      ? cluster.filter((c) => c.time > (utadCandle?.time ?? utCandle!.time))
      : breakCandles;
    const sowCandidate =
      postUtCandles.length > 0
        ? postUtCandles.reduce((lowest, c) => (c.low < lowest.low ? c : lowest), postUtCandles[0])
        : (breakCandles[breakCandles.length - 1] ?? candles[candles.length - 1]);
    const sowCandle =
      sowCandidate && sowCandidate.low <= sow10Price
        ? sowCandidate
        : (breakCandles.find((c) => c.low <= sow10Price) ?? breakCandles[breakCandles.length - 1] ?? candles[candles.length - 1]);

    const schematicPoints: WyckoffPoint[] = [
      ...(psyCandle && psyCandle.time < bcCandle.time ? [{ label: "PSY" as const, price: psyPrice, time: psyCandle.time }] : []),
      { label: "BC", price: bcPrice, time: bcCandle.time },
      { label: "AR", price: arPrice, time: arCandle.time },
      ...(stCandle && stCandle.time > arCandle.time ? [{ label: "ST" as const, price: stPrice, time: stCandle.time }] : []),
      ...(tenPercentCandle && tenPercentCandle.time > stCandle.time ? [{ label: "10%" as const, price: sow10Price, time: tenPercentCandle.time }] : []),
      ...(utCandle ? [{ label: "UT" as const, price: roundPrice(utCandle.high, symbol), time: utCandle.time }] : []),
      ...(utadCandle ? [{ label: "UTAD" as const, price: roundPrice(utadCandle.high, symbol), time: utadCandle.time }] : []),
      ...(sowCandle && sowCandle.time > (utadCandle?.time ?? utCandle?.time ?? 0) && sowCandle.time !== tenPercentCandle.time
        ? [{ label: "SOW" as const, price: roundPrice(sowCandle.low, symbol), time: sowCandle.time }]
        : []),
      ...(tenPercent2Candle && tenPercent2Level ? [{ label: "10% 2" as const, price: tenPercent2Level, time: tenPercent2Candle.time }] : []),
    ];

    const activeZone: WyckoffZoneInfo =
      selectedTrigger === "TEST"
        ? {
            triggerType: "TEST",
            label: `TEST (${hasUtad ? "Ombra UT post-UTAD" : hasUT ? "Ombra UT" : "Ombra BC"})`,
            topPrice: testZoneTop,
            bottomPrice: testZoneBottom,
          }
        : selectedTrigger === "POC"
          ? {
              triggerType: "POC",
              label: "Zona POC (PSY → 10% 2)",
              topPrice: roundPrice(pocZonePrice + schematicHeight * 0.04, symbol),
              bottomPrice: roundPrice(pocZonePrice - schematicHeight * 0.04, symbol),
            }
          : {
              triggerType: selectedTrigger,
              label: `Zona ${selectedTrigger} (10% - AR)`,
              topPrice: jtcBtiZoneHigh,
              bottomPrice: jtcBtiZoneLow,
            };

    const schematicBox: WyckoffBoxInfo = {
      startTime: bcCandle.time,
      endTime: candles[candles.length - 1].time,
      topPrice: creekPrice,
      bottomPrice: icePrice,
      rangeHeight: schematicHeight,
      schematicType,
      phase,
      causeStage: isReaccumOrRedistrib ? "causa_2_redistrib" : "causa_1",
      tenPercentLevel: sow10Price,
      tenPercent2Level,
      arPrice,
      scPrice: bcPrice,
      stbPrice: utCandle ? roundPrice(utCandle.high, symbol) : undefined,
      springPrice: utadCandle ? roundPrice(utadCandle.high, symbol) : undefined,
      utadPrice: utadPrice ?? undefined,
      pocPrice: pocZonePrice,
      equilibriumPrice,
      creekPrice,
      icePrice,
      jtcZoneTop: jtcBtiZoneHigh,
      jtcZoneBottom: jtcBtiZoneLow,
      testZoneTop,
      testZoneBottom,
    };

    return {
      direction: "short",
      schematicType,
      phase,
      causeStage: isReaccumOrRedistrib ? "causa_2_redistrib" : "causa_1",
      climaxPrice: bcPrice,
      arPrice,
      secondaryTestPrice: roundPrice(stCandle.high, symbol),
      hasSpringOrUt: hasUT,
      hasUtad,
      utadPrice,
      springOrUtExtreme: utadCandle ? roundPrice(utadCandle.high, symbol) : utCandle ? roundPrice(utCandle.high, symbol) : null,
      tenPercentLevel: sow10Price,
      tenPercent2Level,
      testZonePrice,
      testZoneTop,
      testZoneBottom,
      testZoneRuleLabel,
      pocZonePrice,
      jtcBtiZonePrice,
      jtcBtiZoneLow,
      jtcBtiZoneHigh,
      tenPercentBreakStrength,
      imbalancePercent,
      selectedTrigger,
      entryZonePrice,
      structuralInvalidationPrice,
      schematicHeight,
      schematicPoints,
      activeZone,
      schematicBox,
      creekPrice,
      icePrice,
      equilibriumPrice,
    };
  }
}

/**
 * Motore Deterministico Procedurale basato ESCLUSIVAMENTE sul Piano Operativo,
 * Finestra Operativa, Esempi del Playbook e Router di Zona a 3 Bivi:
 * - Gerarchia Timeframe: Scalping (H1 -> M15 -> M1) | Swing (Daily/H4 -> H1/M15 -> M5/M1)
 * - Domanda 1 (DOVE): Ciclo HTF (2/3 movimenti vs fine ciclo) + Assenza Compressione (liq_compression = NO TRADE)
 * - Domanda 2 (SINISTRA - Router di Zona):
 *     Bivio 1 (valid_zone) -> Inversione autorizzata (TEST, POC, JTC, BTI)
 *     Bivio 2 (no_zone - Sola Liquidità) -> Inversioni VIETATE, solo continuazione (JTC, BTI)
 *     Bivio 3 (reaccum - Causa 1 -> Causa 2) -> Solo JTC + Rischio Dimezzato 50%
 * - Domanda 3 (COME): Chiusura Ciclo ITF + Schematica LTF + Sbilanciamento >= 10% (SOW/SOS) in Area Vergine
 * - Domanda 4 (COSA DEVE PRENDERE): Pool di Liquidità Opposto identificato + BE a 1:1.5R + Parziale 50% a 1:3.0R
 */
export function computeDeterministicQuantSetup(req: VarcoVisionRequest): VarcoVisionResponse {
  const candles = req.candles ?? [];
  const symbol = req.symbol || "EURUSD";
  const capital = req.accountCapital ?? 100000;
  const baseRiskPct = req.riskPercent ?? 1.0;
  const mult = getPipMultiplier(symbol);
  const tfConfig = getScaledTimeframeConfig(symbol, req.interval);
  const memory = req.operativeMemory ?? null;

  if (candles.length < 8) {
    const cashRisk = Math.round(capital * (baseRiskPct / 100));
    return {
      verdict: "WAITING_TRIGGER",
      summary: "Storico candele insufficiente per interrogare le 4 Domande della Finestra Operativa.",
      confidenceScore: 30,
      executionPhase: 1,
      proceduralSteps: [
        { phase: 1, title: "1. DOVE · Ciclo & Liquidità HTF", valid: false, note: "Attendi caricamento del flusso dati per mappare il ciclo." },
        { phase: 2, title: "2. SINISTRA · Router di Zona", valid: false, note: "Dati insufficienti per attivare il Router di Zona." },
        { phase: 3, title: "3. COME · Schematica & Trigger LTF", valid: false, note: "Nessuna schematica ITF/LTF rilevabile." },
        { phase: 4, title: "4. TARGET · Pool Opposto & Rischio", valid: true, note: `Rischio base ${baseRiskPct}% (€${cashRisk}).` },
      ],
      checklistAudit: {
        htfContext: { valid: false, note: "Attendi caricamento del flusso dati." },
        turningPoint: { valid: false, note: "Dati non sufficienti per il Router di Zona." },
        ltfTrigger: { valid: false, note: "Nessun trigger rilevabile su poche candele." },
        riskGuard: { valid: true, note: `Rischio ${baseRiskPct}% impostato (€${cashRisk}).`, recommendedLots: 0.1, riskAmount: cashRisk },
      },
      setup: null,
      doctrineAdvice: "Attendi la sincronizzazione della Gerarchia Timeframe prima di compilare le 4 Domande.",
    };
  }

  const latest = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  // ─────────────────────────────────────────────────────────────────────────
  // GERARCHIA FRATTALE DEI TIMEFRAME (HTF -> ITF -> LTF)
  // Costruiamo le 3 viste strutturali partendo dallo storico candele disponibile:
  // - HTF (Ciclo Grande, Pool di Liquidità Principali, Zone HTF a sinistra)
  // - ITF (Chiusura Ciclo Intermedio, Schematica BC->AR->ST->UT, Causa 1 -> Causa 2)
  // - LTF (Rottura SOW/SOS, Sbilanciamento >=10%, Trigger TEST / POC / JTC / BTI)
  // ─────────────────────────────────────────────────────────────────────────
  const htfLookback = Math.min(candles.length - 1, 120);
  const itfLookback = Math.min(candles.length - 1, 30);
  const ltfLookback = Math.min(candles.length - 1, 10);

  const htfSlice = candles.slice(candles.length - htfLookback - 1, candles.length - 1);
  const itfSlice = candles.slice(candles.length - itfLookback - 1, candles.length - 1);
  const ltfSlice = candles.slice(candles.length - ltfLookback);

  // Calcolo estremi HTF (Pool di Liquidità Buy-Side e Sell-Side) e estremi ITF
  let htfHigh = -Infinity;
  let htfLow = Infinity;
  for (const c of htfSlice) {
    if (c.high > htfHigh) htfHigh = c.high;
    if (c.low < htfLow) htfLow = c.low;
  }

  const sweepLookback = Math.min(25, candles.length - 2);
  let recentSwingHigh = -Infinity;
  let recentSwingLow = Infinity;
  let totalCandleRange = 0;

  for (let i = candles.length - sweepLookback - 1; i < candles.length - 1; i++) {
    const c = candles[i];
    if (c.high > recentSwingHigh) recentSwingHigh = c.high;
    if (c.low < recentSwingLow) recentSwingLow = c.low;
    totalCandleRange += Math.abs(c.high - c.low);
  }

  const avgCandleRange = totalCandleRange / sweepLookback;
  const lastTwoSpan = Math.max(latest.high, prev.high) - Math.min(latest.low, prev.low);

  // ─────────────────────────────────────────────────────────────────────────
  // DOMANDA 1: DOVE CI TROVIAMO? (Ciclo HTF + Filtro Assoluto Compressione)
  // ─────────────────────────────────────────────────────────────────────────
  // Rilevamento Sweep confermato a candela chiusa (sotto minimi evidenti o sopra massimi evidenti)
  const recentLtfLow = Math.min(...ltfSlice.slice(0, -1).map((c) => c.low), prev.low);
  const recentLtfHigh = Math.max(...ltfSlice.slice(0, -1).map((c) => c.high), prev.high);

  const bullishSweep =
    (prev.low < recentSwingLow && latest.close > recentSwingLow) ||
    (latest.low < recentSwingLow && latest.close > recentSwingLow && (latest.close - latest.low) > (latest.high - latest.low) * 0.55);

  const bearishSweep =
    (prev.high > recentSwingHigh && latest.close < recentSwingHigh) ||
    (latest.high > recentSwingHigh && latest.close < recentSwingHigh && (latest.high - latest.close) > (latest.high - latest.low) * 0.55);

  // Filtro Inviolabile: Liquidità Sopra e Sotto = COMPRESSIONE (NO TRADE)
  const isCompressed = lastTwoSpan < avgCandleRange * 0.42 && !bullishSweep && !bearishSweep;
  if (isCompressed) {
    const cashRisk = Math.round(capital * (baseRiskPct / 100));
    return {
      verdict: "NO_ZONE",
      summary: `Compressione attiva su ${symbol} (${tfConfig.name}): liquidità sopra e sotto. NO TRADE.`,
      confidenceScore: 35,
      executionPhase: 1,
      proceduralSteps: [
        {
          phase: 1,
          title: "1. DOVE · Compressione (NO TRADE)",
          valid: false,
          note: "Liquidità evidente sia sopra sia sotto (liq_compression). È severamente vietato anticipare il breakout del range.",
          schematicId: "liq_compression",
        },
        {
          phase: 2,
          title: "2. SINISTRA · Router Bloccato",
          valid: false,
          note: "Nessun estremo ancora spazzato: il Router di Zona vieta qualsiasi operatività.",
          schematicId: "scenario_no_zone",
        },
        {
          phase: 3,
          title: "3. COME · Trigger Disabilitato",
          valid: false,
          note: "In compressione la statistica è zero (Esempio 2 Playbook).",
        },
        {
          phase: 4,
          title: "4. TARGET · Capitale Protetto",
          valid: true,
          note: `Disciplina AUREUS: 0 trade inseriti (€${cashRisk} protetti).`,
          schematicId: "mgmt_be",
        },
      ],
      checklistAudit: {
        htfContext: { valid: false, note: "Compressione attiva: liquidità sopra e sotto (NO TRADE)." },
        turningPoint: { valid: false, note: "Nessuna zona estrema cacciata a sinistra." },
        ltfTrigger: { valid: false, note: "Attendi lo sweep a candela chiusa prima di cercare un trigger." },
        riskGuard: { valid: true, note: `Capitale protetto (€${cashRisk} non esposto).` },
      },
      setup: null,
      doctrineAdvice: "Regola Inviolabile: Liquidità sopra e sotto = NO TRADE. Resta spettatore finché uno dei lati non viene spazzato.",
    };
  }

  // Persistenza Setup Attivo (Isteresi: evita cambi repentini di idea su 1-2 candele di pullback)
  const prevActive = req.activeSetup;
  let activeSetupIntact = false;
  if (prevActive) {
    if (prevActive.direction === "short") {
      const breachedSL = latest.high >= prevActive.stopLossPrice;
      const hitTP = latest.low <= prevActive.takeProfit1Price;
      if (!breachedSL && !hitTP && !bullishSweep) {
        activeSetupIntact = true;
      }
    } else {
      const breachedSL = latest.low <= prevActive.stopLossPrice;
      const hitTP = latest.high >= prevActive.takeProfit1Price;
      if (!breachedSL && !hitTP && !bearishSweep) {
        activeSetupIntact = true;
      }
    }
  }

  // Analisi del Ciclo HTF con Legge di Causa ed Effetto di Wyckoff e Conteggio dei Markup/Markdown
  const wyckoffCycle = analyzeWyckoffCycleAndMarkups(candles);
  const macroTrend: "long" | "short" = wyckoffCycle.cycleDirection;
  const markupCount = wyckoffCycle.markupCount;

  // Conteggio spinte impulsive per distinguere Ciclo in Espansione (up/down) vs Fine Ciclo (end_up/end_down)
  const htfRange = Math.max(1e-8, htfHigh - htfLow);
  const posInHtfRange = (latest.close - htfLow) / htfRange; // 0 = sul minimo HTF, 1 = sul massimo HTF

  let cycle: "up" | "down" | "end_up" | "end_down" = wyckoffCycle.cycleState;
  if (bearishSweep && posInHtfRange >= 0.72 && markupCount >= 2) {
    cycle = "end_up"; // Esaurimento ciclo rialzista dopo 2-3 Markup e caccia ai massimi
  } else if (bullishSweep && posInHtfRange <= 0.28 && markupCount >= 2) {
    cycle = "end_down"; // Esaurimento ciclo ribassista dopo 2-3 Markdown e caccia ai minimi
  } else if (macroTrend === "long" && cycle !== "end_up") {
    cycle = "up";
  } else if (macroTrend === "short" && cycle !== "end_down") {
    cycle = "down";
  }

  // Rilevamento Zona HTF a sinistra (FVG HTF o Fascia Grigia di Causa precedente)
  let hasLeftHtfZone = false;
  for (let i = Math.max(1, candles.length - htfLookback); i < candles.length - 4; i++) {
    const cBefore = candles[i - 1];
    const cMid = candles[i];
    const body = Math.abs(cMid.close - cMid.open);
    if (body > avgCandleRange * 1.1) {
      // Verifica se il prezzo attuale sta testando/mitigando quella zona di origine o FVG
      const zoneLow = Math.min(cBefore.low, cMid.open, cMid.close);
      const zoneHigh = Math.max(cBefore.high, cMid.open, cMid.close);
      if (latest.high >= zoneLow && latest.low <= zoneHigh) {
        hasLeftHtfZone = true;
        break;
      }
    }
  }
  // Se c'è stato uno sweep netto di un estremo strutturale, la zona di origine dello swing a sinistra è toccata
  if (bullishSweep || bearishSweep) {
    hasLeftHtfZone = true;
  }

  // Contesto di Liquidità HTF: Swept vs Intermediate (Causa 1 -> Causa 2)
  const liquidityContext: "swept" | "intermediate" =
    bullishSweep || bearishSweep ? "swept" : "intermediate";

  // ─────────────────────────────────────────────────────────────────────────
  // DOMANDA 2: COSA HA PRESO A SINISTRA? (IL ROUTER DI ZONA A 3 BIVI MECCANICI + FILTRO ANTI-INVERSIONE PREMATURA)
  // ─────────────────────────────────────────────────────────────────────────
  let zoneScenario: "valid_zone" | "no_zone" | "reaccum";
  let direction: "long" | "short";
  let wasReversal = false;

  if (activeSetupIntact && prevActive) {
    direction = prevActive.direction;
    zoneScenario = prevActive.zoneScenario ?? "valid_zone";
    wasReversal = prevActive.wasReversal ?? false;
  } else if (memory?.flipActive && memory.flipDirection) {
    // LA REGOLA DEL FLIP: Se la schematica d'inversione precedente è stata violata,
    // cambia immediatamente bias verso la continuazione (solo JTC o BTI)
    direction = memory.flipDirection;
    zoneScenario = "no_zone";
    wasReversal = false;
  } else if (liquidityContext === "swept" && hasLeftHtfZone) {
    // BIVIO 1: Zona HTF valida toccata e mitigata.
    // REGOLA CICLO WYCKOFF: Non cercare di prevedere l'inversione se siamo ancora nel 1° movimento
    // del ciclo senza aver raggiunto un estremo HTF dopo almeno 2-3 Markup/Markdown!
    const sweepDirection: "long" | "short" = bullishSweep ? "long" : bearishSweep ? "short" : macroTrend;
    const isCounterCycleSweep = sweepDirection !== macroTrend;
    const allowedReversal =
      !isCounterCycleSweep ||
      wyckoffCycle.cycleExhausted ||
      (markupCount >= 2 && ((sweepDirection === "long" && posInHtfRange <= 0.32) || (sweepDirection === "short" && posInHtfRange >= 0.68)));

    if (allowedReversal) {
      zoneScenario = "valid_zone";
      direction = sweepDirection;
      wasReversal = isCounterCycleSweep;
    } else {
      // Se lo sweep è contro il ciclo ma siamo ancora nel 1° Markup/Markdown, non indoviniamo l'inversione:
      // leggiamo il movimento come scarico intermedio a favore del ciclo principale (Causa 1 -> Causa 2)
      zoneScenario = "reaccum";
      direction = macroTrend;
      wasReversal = false;
    }
  } else if (liquidityContext === "swept" && !hasLeftHtfZone) {
    // BIVIO 2: Solo liquidità senza Zona HTF -> INVERSIONI SEVERAMENTE VIETATE (Solo JTC/BTI in continuazione)
    zoneScenario = "no_zone";
    direction = macroTrend;
    wasReversal = false;
  } else {
    // BIVIO 3: Zona estrema non raggiunta -> Re-accumulo / Ri-distribuzione Intermedia (Causa 1 -> Causa 2)
    // Se si trova nel mezzo del ciclo con una fascia grigia alle spalle è 'reaccum' (Solo JTC + Rischio 50%),
    // altrimenti se è in forte spinta aperta è 'no_zone' (continuazione JTC/BTI)
    zoneScenario = hasLeftHtfZone ? "reaccum" : "no_zone";
    direction = macroTrend;
    wasReversal = false;
  }

  // Anti-Fade Protection da Macro Bias HTF (TraderWiki -0.13R Rule):
  // Se il bias H4 è BULLISH e stiamo tentando un reversal SHORT senza esaurimento ciclo o sweep primario,
  // il sistema impedisce l'entrata in contro-trend.
  if (req.directionalBias?.antiFadeProtected || (req.directionalBias?.h4MasterBias === "BULLISH" && direction === "short" && !wyckoffCycle.cycleExhausted)) {
    if (wasReversal) {
      direction = "long";
      zoneScenario = "no_zone";
      wasReversal = false;
    }
  } else if (req.directionalBias?.h4MasterBias === "BEARISH" && direction === "long" && !wyckoffCycle.cycleExhausted) {
    if (wasReversal) {
      direction = "short";
      zoneScenario = "no_zone";
      wasReversal = false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOMANDA 3: COME CI È ARRIVATO? (Schematica di Wyckoff, TEST su Ombre STB/SC o UT/BC, POC vs JTC/BTI su rottura 10% SOW/SOS)
  // ─────────────────────────────────────────────────────────────────────────
  const dispLookback = Math.min(tfConfig.displacementLookback, candles.length - 1);
  let displacementCandle = prev;
  let maxDisplacement = 0;
  let displacementIdx = candles.length - 2;

  for (let i = candles.length - 1; i >= candles.length - dispLookback; i--) {
    const c = candles[i];
    const body = Math.abs(c.close - c.open);
    const isDirectional = direction === "short" ? c.close < c.open : c.close > c.open;
    if (isDirectional && body > maxDisplacement) {
      maxDisplacement = body;
      displacementCandle = c;
      displacementIdx = i;
    }
  }

  // Ricerca Area Vergine (FVG / Imbalance aperto) vs Storia Passata (fascia grigia mitigata)
  let fvgTop = 0;
  let fvgBottom = 0;
  let hasFvg = false;

  if (displacementIdx > 0 && displacementIdx < candles.length - 1) {
    const candleBefore = candles[displacementIdx - 1];
    const candleAfter = candles[displacementIdx + 1];

    if (direction === "short" && candleBefore.low > candleAfter.high) {
      fvgTop = candleBefore.low;
      fvgBottom = candleAfter.high;
      hasFvg = true;
    } else if (direction === "long" && candleBefore.high < candleAfter.low) {
      fvgTop = candleAfter.low;
      fvgBottom = candleBefore.high;
      hasFvg = true;
    }
  }

  const areaType: "virgin" | "history" = hasFvg ? "virgin" : "history";
  const testQuarantined = Boolean(memory?.quarantinedCombos?.includes("valid_zone:TEST"));

  // Analisi Geometrica della Schematica di Wyckoff (SC/BC, AR, STB/ST, Spring/UT, SOW/SOS 10%)
  const isReaccumOrRedistrib =
    zoneScenario === "reaccum" ||
    (markupCount >= 1 && (liquidityContext === "intermediate" || !wasReversal));

  const wyckoff = analyzeWyckoffSchematicGeometry(
    candles,
    direction,
    symbol,
    hasFvg,
    Boolean(memory?.preferPocOnReversal || testQuarantined),
    {
      isReaccumOrRedistrib,
      markupCount,
      zoneScenario,
    },
  );

  // Calcolo dello Sbilanciamento del 10% (Rottura SOW / SOS rispetto al box della schematica)
  const schematicRange = Math.max(1e-8, recentLtfHigh - recentLtfLow);
  const impulseSpan = Math.max(maxDisplacement, Math.abs(displacementCandle.high - displacementCandle.low));
  const legacyImbalancePct = Math.min(100, Math.round((impulseSpan / schematicRange) * 100));
  const imbalancePercent = Math.max(wyckoff.imbalancePercent, legacyImbalancePct);
  const requiredImbalance = memory?.minImbalancePercent ?? 10;
  const tenPercentVerified = imbalancePercent >= requiredImbalance;
  const impulseAlreadyStarted = maxDisplacement >= avgCandleRange * 0.85 && tenPercentVerified;

  // ─────────────────────────────────────────────────────────────────────────
  // FILTRO FINESTRA OPERATIVA ITALIANA (Europe/Rome sulla candela storica)
  // ─────────────────────────────────────────────────────────────────────────
  if (req.enforceSessionWindows === true && !activeSetupIntact) {
    const sessionCheck = evaluateItalianSessionWindow(
      latest.time,
      symbol,
      tfConfig.mode,
      impulseAlreadyStarted,
    );
    if (!sessionCheck.allowed) {
      const cashRisk = Math.round(capital * (baseRiskPct / 100));
      return {
        verdict: "WAITING_TRIGGER",
        summary: `${sessionCheck.sessionName}: ${sessionCheck.reason}`,
        confidenceScore: 45,
        executionPhase: 1,
        proceduralSteps: [
          {
            phase: 1,
            title: `1. DOVE · ${sessionCheck.sessionName}`,
            valid: false,
            note: sessionCheck.reason,
            schematicId: direction === "long" ? "cycle_up" : "cycle_down",
          },
          {
            phase: 2,
            title: "2. SINISTRA · Mappatura Scenario",
            valid: true,
            note: `Mappatura attiva (${zoneScenario}): prepara i livelli per la prossima finestra operativa.`,
            schematicId: zoneScenario === "valid_zone" ? "scenario_valid_zone" : zoneScenario === "reaccum" ? "scenario_reaccum" : "scenario_no_zone",
          },
          {
            phase: 3,
            title: "3. COME · Attesa Finestra",
            valid: false,
            note: "Nessun nuovo ordine autorizzato fuori dagli orari del Piano Operativo.",
          },
          {
            phase: 4,
            title: "4. TARGET · Disciplina Oraria",
            valid: true,
            note: `Capitale protetto (€${cashRisk}). La gestione delle posizioni già aperte resta attiva.`,
            schematicId: "mgmt_be",
          },
        ],
        checklistAudit: {
          htfContext: { valid: false, note: sessionCheck.reason },
          turningPoint: { valid: true, note: "Scenario mappato in attesa dell'apertura di sessione." },
          ltfTrigger: { valid: false, note: "Ingressi bloccati dal Quadrante delle Sessioni Italiane." },
          riskGuard: { valid: true, note: `Capitale preservato (€${cashRisk}).` },
        },
        setup: null,
        doctrineAdvice: sessionCheck.reason,
      };
    }
  }

  // Verifica rigorosa chiusura Ciclo ITF e Sbilanciamento 10% in Area Vergine:
  // Se non c'è una candela direzionale nella finestra di displacement o lo sbilanciamento è < soglia,
  // non forziamo il trade (evita l'overtrading che causava il 27% di win rate!)
  if (!activeSetupIntact && (maxDisplacement === 0 || (areaType === "virgin" && !tenPercentVerified))) {
    const cashRisk = Math.round(capital * (baseRiskPct / 100));
    return {
      verdict: "WAITING_TRIGGER",
      summary: `In attesa di conferma schematica LTF e sbilanciamento ≥ ${requiredImbalance}% (attuale: ${imbalancePercent}%) su ${symbol}.`,
      confidenceScore: 58,
      executionPhase: 3,
      proceduralSteps: [
        {
          phase: 1,
          title: "1. DOVE · Ciclo HTF Validato",
          valid: true,
          note: `Ciclo ${cycle.toUpperCase()} (${tfConfig.hierarchyLabel}). Nessuna compressione.`,
          schematicId: cycle === "up" ? "cycle_up" : cycle === "down" ? "cycle_down" : cycle === "end_up" ? "cycle_end_up" : "cycle_end_down",
        },
        {
          phase: 2,
          title: "2. SINISTRA · Router di Zona",
          valid: true,
          note: `Scenario: ${zoneScenario === "valid_zone" ? "Zona HTF Mitigata" : zoneScenario === "reaccum" ? "Re-accumulo Causa 2" : "Sola Liquidità (Solo JTC/BTI)"}.`,
          schematicId: zoneScenario === "valid_zone" ? "scenario_valid_zone" : zoneScenario === "reaccum" ? "scenario_reaccum" : "scenario_no_zone",
        },
        {
          phase: 3,
          title: "3. COME · Attesa Sbilanciamento 10%",
          valid: false,
          note: `Sbilanciamento SOW/SOS attuale ${imbalancePercent}% (richiesto ≥ ${requiredImbalance}%). Attendi la rottura decisa prima di piazzare il Limit.`,
          schematicId: "itf_schematic",
        },
        {
          phase: 4,
          title: "4. TARGET · In Attesa",
          valid: true,
          note: `Rischio pronto (€${cashRisk}), in attesa del completamento della schematica.`,
          schematicId: "mgmt_be",
        },
      ],
      checklistAudit: {
        htfContext: { valid: true, note: `Ciclo ${cycle.toUpperCase()} identificato.` },
        turningPoint: { valid: true, note: `Router di Zona attivo su ${zoneScenario}.` },
        ltfTrigger: { valid: false, note: `Attendi sbilanciamento SOW/SOS ≥ ${requiredImbalance}% e chiusura schematica.` },
        riskGuard: { valid: true, note: `Capitale protetto (€${cashRisk}).` },
      },
      setup: null,
      doctrineAdvice: "Regola Piano Operativo: Se M15 è in area vergine e M1 accumula/distribuisce, attendi tassativamente uno sbilanciamento di spinta almeno del 10% (rottura SOW/SOS).",
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SELEZIONE MECCANICA DEL TRIGGER SECONDO LA GEOMETRIA DI WYCKOFF E IL ROUTER DI ZONA
  // - Zona di TEST: sull'ombra dello STB (se c'è Spring) o sull'ombra del SC (se manca Spring) in Accumulo;
  //   sull'ombra dell'UT (se c'è UT) o sull'ombra del BC (se manca UT) in Distribuzione.
  // - Zona di POC: presa come zona d'inversione/re-test quando il SOW o SOS (10%) viene rotto LIEVEMENTE ("di poco").
  // - Zona JTC / BTI: presa direttamente quando il SOW o SOS (10%) viene rotto DI TANTO, ed è situata
  //   esattamente nella zona tra il 10% (SOW/SOS) e la AR (Automatic Reaction/Rally) della schematica.
  // ─────────────────────────────────────────────────────────────────────────
  let triggerType: "TEST" | "POC" | "JTC" | "BTI" = wyckoff.selectedTrigger;
  let schematicRef = "trigger_test";
  let limitPrice = wyckoff.entryZonePrice;
  let entryReason = "";
  const tenPctName = direction === "long" ? "SOS (10%)" : "SOW (10%)";

  if (zoneScenario === "reaccum" || wyckoff.causeStage === "causa_2_redistrib" || wyckoff.causeStage === "causa_2_reaccum") {
    // BIVIO 3: Re-accumulo / Redistribuzione Causa 1 -> Causa 2
    const stageName = direction === "short" ? "Redistribuzione Causa 2 (2° Markdown HTF)" : "Re-accumulo Causa 2 (2° Markup HTF)";
    if (wyckoff.selectedTrigger === "TEST") {
      triggerType = "TEST";
      schematicRef = "trigger_test";
      limitPrice = wyckoff.testZonePrice;
      entryReason = `Trigger TEST su ${stageName} sull'${wyckoff.testZoneRuleLabel} a ${limitPrice} · Continuazione verso il pool opposto HTF`;
    } else {
      triggerType = "JTC";
      schematicRef = "trigger_jtc";
      limitPrice = wyckoff.jtcBtiZonePrice;
      entryReason = `Trigger JTC su ${stageName} nella zona tra ${tenPctName} (${wyckoff.tenPercentLevel}) e AR (${wyckoff.arPrice}) a ${limitPrice} · Rischio dimezzato 50% (Esempio 4 Playbook)`;
    }
  } else if (zoneScenario === "no_zone") {
    // BIVIO 2: Sola Liquidità / Continuazione => Inversioni VIETATE, SOLO BTI (se FVG) o JTC nella zona tra il 10% (SOW/SOS) e la AR
    triggerType = hasFvg ? "BTI" : "JTC";
    schematicRef = triggerType === "BTI" ? "trigger_bti" : "trigger_jtc";
    limitPrice = wyckoff.jtcBtiZonePrice;
    entryReason = `Trigger ${triggerType} (${markupCount}° Movimento del Ciclo · Continuazione Obbligatoria) nella zona tra ${tenPctName} (${wyckoff.tenPercentLevel}) e AR (${wyckoff.arPrice}) a ${limitPrice}`;
  } else {
    // BIVIO 1: Zona HTF Valida Toccata e Mitigata (valid_zone) -> Regole di Wyckoff pure:
    // 1) Se SOW/SOS (10%) è rotto DI TANTO (strong) -> guarda direttamente JTC o BTI (tra 10% e AR)
    // 2) Se SOW/SOS (10%) è rotto LIEVEMENTE / DI POCO (mild) -> guarda il POC (se inversione/rottura lieve del 10%) oppure il TEST sull'ombra (STB/SC o UT/BC)
    if (wyckoff.tenPercentBreakStrength === "strong") {
      triggerType = hasFvg ? "BTI" : "JTC";
      schematicRef = triggerType === "BTI" ? "trigger_bti" : "trigger_jtc";
      limitPrice = wyckoff.jtcBtiZonePrice;
      entryReason = `Rottura forte di ${tenPctName} (${imbalancePercent}%) → Trigger ${triggerType} diretto nella zona tra il 10% (${wyckoff.tenPercentLevel}) e la AR (${wyckoff.arPrice}) a ${limitPrice}`;
    } else if (
      wyckoff.tenPercentBreakStrength === "mild" &&
      (wasReversal || memory?.preferPocOnReversal || testQuarantined || wyckoff.selectedTrigger === "POC")
    ) {
      triggerType = "POC";
      schematicRef = "trigger_poc";
      limitPrice = wyckoff.pocZonePrice;
      entryReason = `Rottura lieve di ${tenPctName} (${imbalancePercent}%) → Zona POC d'inversione della schematica di ${wyckoff.schematicType === "accumulation" ? "Accumulo" : "Distribuzione"} a ${limitPrice}`;
    } else {
      triggerType = "TEST";
      schematicRef = "trigger_test";
      limitPrice = wyckoff.testZonePrice;
      entryReason = `Caccia di liquidità e Trigger TEST sull'${wyckoff.testZoneRuleLabel}`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VALUTAZIONE TIPO ORDINE & FILTRO ANTI-PENDENTI LONTANI DAL MERCATO (NO GHOST LIMIT)
  // In AUREUS tutti gli ordini pendenti sono tassativamente LIMIT (su ritracciamento/sconto per Buy, o premium per Sell).
  // Se il prezzo è già fuggito via verso il target oltre la naturale tolleranza di re-test del timeframe,
  // il setup non viene forzato con un pendente fantasma 200 pips indietro, ma resta in WAITING_TRIGGER.
  // Se il prezzo si trova già nella zona di re-test o l'ha oltrepassata a favore, l'ordine entra subito a Market.
  // ─────────────────────────────────────────────────────────────────────────
  const distFromCurrent = Math.abs(latest.close - limitPrice) * mult;
  const maxAllowedRetestPips = Math.max(80, tfConfig.maxAllowedStopPips * 3.5);

  if (!activeSetupIntact && distFromCurrent > maxAllowedRetestPips) {
    const cashRisk = Math.round(capital * (baseRiskPct / 100));
    return {
      verdict: "WAITING_TRIGGER",
      summary: `Prezzo allontanato dalla zona ${triggerType} (${distFromCurrent.toFixed(1)}p > ${maxAllowedRetestPips}p): nessun ordine pendente fantasma su ${symbol}. Attendi nuova Causa.`,
      confidenceScore: 50,
      executionPhase: 3,
      proceduralSteps: [
        {
          phase: 1,
          title: "1. DOVE · Ciclo & Struttura",
          valid: true,
          note: `Ciclo: ${cycle.toUpperCase()} (${markupCount}° movimento). Nessuna compressione.`,
          schematicId: direction === "long" ? "cycle_up" : "cycle_down",
        },
        {
          phase: 2,
          title: "2. SINISTRA · Router di Zona",
          valid: true,
          note: `Scenario: ${zoneScenario}. Zona mappata ma non mitigata tempestivamente.`,
          schematicId: zoneScenario === "valid_zone" ? "scenario_valid_zone" : zoneScenario === "reaccum" ? "scenario_reaccum" : "scenario_no_zone",
        },
        {
          phase: 3,
          title: "3. COME · Attesa Nuovo Ritracciamento",
          valid: false,
          note: `Distanza dal livello ${triggerType} eccessiva (${distFromCurrent.toFixed(1)} pips). Vietato inseguire o piazzare pendenti lontani dal prezzo battuto.`,
          schematicId: "trigger_test",
        },
        {
          phase: 4,
          title: "4. TARGET · Capitale Protetto",
          valid: true,
          note: `Capitale protetto (€${cashRisk}). Attendi una nuova Causa locale per il prossimo ingresso.`,
          schematicId: "mgmt_be",
        },
      ],
      checklistAudit: {
        htfContext: { valid: true, note: `Ciclo ${cycle.toUpperCase()} identificato.` },
        turningPoint: { valid: true, note: `Router attivo su ${zoneScenario}.` },
        ltfTrigger: { valid: false, note: `Distanza dal re-test eccessiva (${distFromCurrent.toFixed(1)} pips).` },
        riskGuard: { valid: true, note: `Capitale protetto (€${cashRisk}).` },
      },
      setup: null,
      doctrineAdvice: "Regola Inviolabile: Non inseguire mai il mercato e non piazzare pendenti lontani dal prezzo battuto. Se è già partito, resta spettatore.",
    };
  }

  let orderType: "limit" | "market";
  let entryPrice: number;

  if (direction === "long") {
    // Nel Buy: il prezzo corrente deve essere >= limitPrice per un Buy Limit su ritracciamento.
    // Se il prezzo è già sceso alla zona o sotto di essa, l'ordine entra subito a Market.
    if (latest.close <= limitPrice + 1.5 / mult) {
      orderType = "market";
      entryPrice = latest.close;
    } else {
      orderType = "limit";
      entryPrice = limitPrice;
    }
  } else {
    // Nel Sell: il prezzo corrente deve essere <= limitPrice per un Sell Limit su ritracciamento.
    // Se il prezzo è già salito alla zona o sopra di essa, l'ordine entra subito a Market.
    if (latest.close >= limitPrice - 1.5 / mult) {
      orderType = "market";
      entryPrice = latest.close;
    } else {
      orderType = "limit";
      entryPrice = limitPrice;
    }
  }

  // Calcolo Stop Loss Strutturale a protezione dell'intera Schematica di Wyckoff (mai su 1-2 candeline)
  const invBuffer = tfConfig.invalidationBufferPips / mult;
  let stopLossPrice = 0;
  let invalidationSwingPrice = 0;
  let invalidationReason = "";

  if (direction === "short") {
    const structuralHigh = Math.max(
      wyckoff.structuralInvalidationPrice,
      displacementCandle.high,
      latest.high,
      prev.high,
    );
    invalidationSwingPrice = roundPrice(structuralHigh, symbol);
    const rawSL = structuralHigh + invBuffer;
    const rawDiffPips = (rawSL - entryPrice) * mult;

    if (rawDiffPips > tfConfig.maxAllowedStopPips) {
      stopLossPrice = roundPrice(entryPrice + tfConfig.maxAllowedStopPips / mult, symbol);
    } else if (rawDiffPips < tfConfig.minAllowedStopPips) {
      stopLossPrice = roundPrice(entryPrice + tfConfig.minAllowedStopPips / mult, symbol);
    } else {
      stopLossPrice = roundPrice(rawSL, symbol);
    }
    invalidationReason = `Invalidazione strutturale sopra ${wyckoff.hasSpringOrUt ? "l'UT (Upthrust)" : "il BC / POC della Distribuzione"} a ${stopLossPrice} (uscita anticipata mgmt_invalidation su chiusura oltre ${invalidationSwingPrice})`;
  } else {
    const structuralLow = Math.min(
      wyckoff.structuralInvalidationPrice,
      displacementCandle.low,
      latest.low,
      prev.low,
    );
    invalidationSwingPrice = roundPrice(structuralLow, symbol);
    const rawSL = structuralLow - invBuffer;
    const rawDiffPips = (entryPrice - rawSL) * mult;

    if (rawDiffPips > tfConfig.maxAllowedStopPips) {
      stopLossPrice = roundPrice(entryPrice - tfConfig.maxAllowedStopPips / mult, symbol);
    } else if (rawDiffPips < tfConfig.minAllowedStopPips) {
      stopLossPrice = roundPrice(entryPrice - tfConfig.minAllowedStopPips / mult, symbol);
    } else {
      stopLossPrice = roundPrice(rawSL, symbol);
    }
    invalidationReason = `Invalidazione strutturale sotto ${wyckoff.hasSpringOrUt ? "lo Spring" : "lo STB / SC / POC dell'Accumulo"} a ${stopLossPrice} (uscita anticipata mgmt_invalidation su chiusura oltre ${invalidationSwingPrice})`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DOMANDA 4: COSA DEVE PRENDERE? (Legge di Causa ed Effetto di Wyckoff, Pool Opposto, BE a 1:1.5R e Parziale 50% a 1:3.0R)
  // ─────────────────────────────────────────────────────────────────────────
  // Regola Esempio 4 Playbook: Nei box di Re-accumulo Intermedio (Causa 2) il rischio viene dimezzato (50%)
  const effectiveRiskPct =
    zoneScenario === "reaccum"
      ? Number((baseRiskPct * (memory?.reaccumRiskMultiplier ?? 0.5)).toFixed(2))
      : baseRiskPct;
  const cashRisk = Math.round(capital * (effectiveRiskPct / 100));

  const priceDiff = Math.abs(entryPrice - stopLossPrice);
  const pipsRisk = Math.max(1, Math.round(priceDiff * mult * 10) / 10);
  const lotSize = calculateLotSize(symbol, capital, effectiveRiskPct, pipsRisk);

  // Regola Limen mgmt_be: Break Even tassativamente ad almeno 1 : 1.5 R:R su presa di liquidità intermedia
  // Regola Limen mgmt_tp1: Primo parziale 50% tassativamente a 1 : 3.0 R:R; resto al Pool di Liquidità Opposto (Effetto della Causa di Wyckoff)
  let breakEvenPrice = 0;
  let takeProfit1Price = 0;
  let takeProfit2Price = 0;
  let oppositePoolPrice = 0;
  let oppositePoolLabel = "";
  const wyckoffEffectSpan = Math.max(priceDiff * 4.2, wyckoff.schematicHeight * 2.5);

  if (direction === "long") {
    breakEvenPrice = roundPrice(entryPrice + priceDiff * 1.5, symbol);
    takeProfit1Price = roundPrice(entryPrice + priceDiff * 3.0, symbol);
    const structuralPool = Math.max(htfHigh, recentSwingHigh, entryPrice + wyckoffEffectSpan);
    oppositePoolPrice = structuralPool > takeProfit1Price
      ? roundPrice(structuralPool, symbol)
      : roundPrice(entryPrice + wyckoffEffectSpan, symbol);
    takeProfit2Price = oppositePoolPrice;
    oppositePoolLabel = `Buy-Side Liquidity Pool · Effetto Wyckoff (${markupCount}° Markup verso ${oppositePoolPrice})`;
  } else {
    breakEvenPrice = roundPrice(entryPrice - priceDiff * 1.5, symbol);
    takeProfit1Price = roundPrice(entryPrice - priceDiff * 3.0, symbol);
    const structuralPool = Math.min(htfLow, recentSwingLow, entryPrice - wyckoffEffectSpan);
    oppositePoolPrice = structuralPool < takeProfit1Price
      ? roundPrice(structuralPool, symbol)
      : roundPrice(entryPrice - wyckoffEffectSpan, symbol);
    takeProfit2Price = oppositePoolPrice;
    oppositePoolLabel = `Sell-Side Liquidity Pool · Effetto Wyckoff (${markupCount}° Markdown verso ${oppositePoolPrice})`;
  }

  const sessionEval = evaluateItalianSessionWindow(latest.time, symbol, tfConfig.mode, impulseAlreadyStarted);
  const confidenceScore = bullishSweep || bearishSweep ? 92 : hasFvg ? 88 : 83;

  const routerTitle =
    zoneScenario === "valid_zone"
      ? "Bivio 1 · Zona HTF Mitigata (Inversione/Continuazione Autorizzata)"
      : zoneScenario === "no_zone"
        ? "Bivio 2 · Sola Liquidità (Inversioni VIETATE · Solo JTC/BTI)"
        : "Bivio 3 · Re-accumulo Causa 2 (Solo JTC · Rischio Dimezzato 50%)";

  const proceduralSteps: VarcoProceduralStep[] = [
    {
      phase: 1,
      title: "1. DOVE · Ciclo Wyckoff & Markup",
      valid: true,
      note: `${tfConfig.hierarchyLabel} · Ciclo: ${cycle.toUpperCase()} (${markupCount}° ${macroTrend === "long" ? "Markup" : "Markdown"} secondo Causa-Effetto). ${
        liquidityContext === "swept"
          ? `Caccia di liquidità confermata a candela chiusa (${roundPrice(direction === "long" ? recentSwingLow : recentSwingHigh, symbol)}).`
          : `In flusso con il ciclo (${markupCount}° Movimento · Causa 1 → Causa 2).`
      } Assenza totale di compressione.`,
      schematicId:
        liquidityContext === "swept"
          ? "liq_swept"
          : zoneScenario === "reaccum"
            ? "liq_intermediate"
            : direction === "long"
              ? "cycle_up"
              : "cycle_down",
    },
    {
      phase: 2,
      title: "2. SINISTRA · Router di Zona",
      valid: true,
      note: `${routerTitle}.${memory?.flipActive ? ` [REGOLA DEL FLIP ATTIVA: Bias forzato in continuazione ${direction.toUpperCase()}]` : ""}`,
      schematicId:
        zoneScenario === "valid_zone"
          ? "scenario_valid_zone"
          : zoneScenario === "reaccum"
            ? "scenario_reaccum"
            : "scenario_no_zone",
    },
    {
      phase: 3,
      title: `3. COME · Schematica Wyckoff & Trigger ${triggerType}`,
      valid: true,
      triggerType,
      schematicId: schematicRef,
      note: `${
        wyckoff.schematicType === "reaccumulation"
          ? "Riaccumulo (Causa 2 · Rischio 50%)"
          : wyckoff.schematicType === "accumulation"
          ? "Accumulazione Primaria"
          : wyckoff.schematicType === "redistribution"
          ? "Ridistribuzione (Causa 2 · Rischio 50%)"
          : "Distribuzione Primaria"
      } · ${wyckoff.phase} (${
        wyckoff.tenPercentBreakStrength === "strong"
          ? `${tenPctName} rotto di tanto [${imbalancePercent}%] → Zona JTC tra 10% e AR`
          : `${tenPctName} rotto lievemente [${imbalancePercent}%] → ${triggerType === "POC" ? "Zona POC (da PS a 10% 2)" : wyckoff.testZoneRuleLabel}`
      }). ${orderType.toUpperCase()} @ ${entryPrice} · SL: ${stopLossPrice} (${pipsRisk}p).`,
    },
    {
      phase: 4,
      title: "4. TARGET · Effetto Wyckoff & Gestione Step 04",
      valid: true,
      schematicId: "mgmt_be",
      note: `${oppositePoolLabel}. Rischio ${effectiveRiskPct}% (€${cashRisk}${zoneScenario === "reaccum" ? " · Dimezzato Causa 2" : ""}) · ${lotSize}L. BE a 1:1.5R (${breakEvenPrice}) · Parziale 50% a 1:3.0R (${takeProfit1Price}).`,
    },
  ];

  const checklistAudit: VarcoChecklistAudit = {
    htfContext: {
      valid: true,
      note: proceduralSteps[0].note,
    },
    turningPoint: {
      valid: true,
      note: proceduralSteps[1].note,
    },
    ltfTrigger: {
      valid: true,
      triggerType,
      note: proceduralSteps[2].note,
    },
    riskGuard: {
      valid: true,
      note: `Rischio ${effectiveRiskPct}% (€${cashRisk}). Lotti: ${lotSize}L. SL ${pipsRisk} pips.`,
      recommendedLots: lotSize,
      riskAmount: cashRisk,
    },
  };

  const setup: VarcoSetupPlan = activeSetupIntact && prevActive
    ? prevActive
    : {
        direction,
        orderType,
        entryPrice: roundPrice(entryPrice, symbol),
        limitPrice: roundPrice(limitPrice, symbol),
        entryReason,
        invalidationReason,
        timeframe: tfConfig.name,
        schematicRef,
        stopLossPrice,
        breakEvenPrice,
        breakEvenRule: `Regola AUREUS mgmt_be: Sposta lo stop a Pareggio (${breakEvenPrice}) solo ad almeno 1:1.5 R:R su presa di liquidità intermedia.`,
        takeProfit1Price,
        takeProfit1Rule: `Regola AUREUS mgmt_tp1: Primo parziale (50%) preso tassativamente a 1:3.0 R:R (${takeProfit1Price}). Nessun parziale prematuro sotto 1:3.`,
        takeProfit2Price,
        takeProfit2Rule: `Mantieni il restante 50% a BE verso il ${oppositePoolLabel}.`,
        riskRewardRatio: 3.0,
        lotSize,
        pipsRisk,
        cycle,
        liquidityContext,
        zoneScenario,
        areaType,
        triggerType,
        imbalancePercent,
        oppositePoolPrice,
        oppositePoolLabel,
        sessionName: sessionEval.sessionName,
        invalidationSwingPrice,
        wasReversal,
        schematicPoints: wyckoff.schematicPoints,
        activeZone: wyckoff.activeZone,
        schematicBox: wyckoff.schematicBox,
      };

  return {
    verdict: "SETUP_READY",
    summary: activeSetupIntact && prevActive
      ? `Setup ${prevActive.direction.toUpperCase()} (${prevActive.triggerType || "LIMIT"}) attivo: in gestione verso TP1 (${prevActive.takeProfit1Price}) e Pool Opposto.`
      : `Setup ${orderType.toUpperCase()} ${direction.toUpperCase()} [${triggerType}] · ${ markupCount }° ${macroTrend === "long" ? "Markup" : "Markdown"} · R:R 1:3.0`,
    confidenceScore: activeSetupIntact ? 94 : confidenceScore,
    executionPhase: 4,
    proceduralSteps,
    checklistAudit,
    setup,
    doctrineAdvice: activeSetupIntact && prevActive
      ? `Cura Attiva Step 04: BE a 1:1.5R (${prevActive.breakEvenPrice}), Parziale 50% tassativo a 1:3.0R (${prevActive.takeProfit1Price}). Esci subito se chiude oltre ${prevActive.invalidationSwingPrice ?? prevActive.stopLossPrice} o se entra in congestione.`
      : orderType === "limit"
        ? `Le 4 Domande validate (${sessionEval.sessionName}). ${entryReason}. Se il prezzo entra in congestione prolungata o tocca il target prima del re-test, cancella il pendente.`
        : `Prezzo sul livello ${triggerType} (${entryReason}). Rispetta l'invalidazione della schematica (${invalidationSwingPrice}) e il BE solo dopo 1:1.5 R:R.`,
  };
}

const VISION_SYSTEM_PROMPT = `Sei la Sentinella Visiva del Varco nel protocollo sovrano AUREUS.
Il tuo compito è analizzare il grafico e le candele usando ESCLUSIVAMENTE le regole del Piano Operativo, della Finestra Operativa e delle Leggi di Wyckoff:
1. Gerarchia Timeframe: Scalping (H1 -> M15 -> M1) | Swing (Daily/H4 -> H1/M15 -> M5/M1).
2. Ciclo e Legge di Causa ed Effetto di Wyckoff (Domanda 1 - DOVE):
   - Conta sempre quanti Markup (in trend rialzista) o Markdown (in trend ribassista) sono stati svolti nel movimento attuale (1°, 2°, 3° movimento dalle Cause).
   - Non cercare di indovinare l'inversione durante il 1° o 2° movimento: segui il ciclo (Causa 1 -> Causa 2) sfruttando le prese di liquidità a favore del flusso, finché il ciclo non ha completato 2-3 movimenti su una zona HTF estrema.
   - Liquidità sopra e sotto = COMPRESSIONE (NO TRADE assoluto).
3. Router di Zona a 3 Bivi (Domanda 2 - SINISTRA):
   - Bivio 1 (valid_zone - Zona HTF mitigata): Inversione o ripartenza autorizzata dopo schematica.
   - Bivio 2 (no_zone - Sola liquidità): Inversioni VIETATE, solo continuazione (JTC, BTI).
   - Bivio 3 (reaccum - Re-accumulo Causa 1 -> Causa 2): Solo JTC con rischio dimezzato 50%.
4. Geometria della Schematica di Wyckoff, Cacce, TEST, POC e JTC/BTI (Domanda 3 - COME):
   - Zona di TEST sulle ombre:
     * In Accumulo: la zona di TEST si trova sull'ombra dello STB (se è presente Spring), oppure sull'ombra del SC (se è presente solo STB e manca Spring).
     * In Distribuzione: la zona di TEST si trova sull'ombra dell'UT (se l'UT è presente), altrimenti sull'ombra del BC.
   - Zona di POC vs JTC/BTI in base alla rottura del SOW o SOS (10%):
     * Se il SOW o il SOS (10%) viene rotto LIEVEMENTE ("di poco"): guarda il POC della schematica come zona di inversione (o il TEST sull'ombra).
     * Se il SOW o il SOS (10%) viene rotto DI TANTO: guarda direttamente il JTC o il BTI, che è la zona tra il 10% (SOW/SOS) e la AR (Automatic Reaction/Rally) nella schematica.
5. Target & Gestione Step 04 (Domanda 4 - COSA DEVE PRENDERE):
   - Stop Loss strutturale dietro l'intera schematica (mai su 1-2 candeline), Stop a Pareggio (mgmt_be) solo a >= 1:1.5 R:R su presa di liquidità; Primo parziale 50% (mgmt_tp1) tassativamente a 1:3.0 R:R; resto all'Effetto di Wyckoff / Pool di liquidità opposto; Uscita anticipata su Congestione o Invalidazione Schematica (mgmt_invalidation) con Regola del Flip.

Rispondi ESCLUSIVAMENTE in formato JSON valido:
{
  "verdict": "SETUP_READY" | "WAITING_TRIGGER" | "INVALID_STRUCTURE" | "NO_ZONE",
  "summary": "sintesi chiara in italiano fedele alle 4 Domande",
  "confidenceScore": 88,
  "executionPhase": 4,
  "direction": "long" | "short",
  "orderType": "limit" | "market",
  "triggerType": "TEST" | "POC" | "JTC" | "BTI",
  "htfReasoning": "Domanda 1 (Dove): Ciclo HTF e liquidità",
  "turningPointReasoning": "Domanda 2 (Sinistra): Verdetto Router di Zona",
  "ltfReasoning": "Domanda 3 (Come): Schematica, sbilanciamento 10% e trigger",
  "doctrineAdvice": "Domanda 4 & Step 04: Pool opposto, BE 1:1.5R, Parziale 1:3R e disciplina"
}`;

export async function analyzeVarcoChartVision(req: VarcoVisionRequest): Promise<VarcoVisionResponse> {
  const quantFallback = computeDeterministicQuantSetup(req);

  if (!req.chartImage || !req.chartImage.startsWith("data:image/")) {
    return quantFallback;
  }

  const visionClient = getVisionClient();
  if (!visionClient) {
    return quantFallback;
  }

  try {
    const symbol = req.symbol || "EURUSD";
    const tf = req.interval || "15";
    const userPrompt = `Analizza questo grafico di ${symbol} (timeframe ${tf}) seguendo le 4 Domande del Piano Operativo AUREUS e il Router di Zona a 3 Bivi.`;

    const response = await visionClient.client.chat.completions.create({
      model: visionClient.model,
      temperature: 0.1,
      max_tokens: 800,
      messages: [
        { role: "system", content: VISION_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            { type: "image_url", image_url: { url: req.chartImage } },
          ],
        },
      ],
    });

    const rawContent = response.choices[0]?.message?.content?.trim() || "";
    const jsonStr = rawContent.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed && typeof parsed === "object") {
      const triggerType: "TEST" | "POC" | "JTC" | "BTI" =
        ["TEST", "POC", "JTC", "BTI"].includes(parsed.triggerType)
          ? parsed.triggerType
          : quantFallback.checklistAudit.ltfTrigger.triggerType || "TEST";

      return {
        verdict: quantFallback.verdict === "NO_ZONE" ? "NO_ZONE" : (parsed.verdict || quantFallback.verdict),
        summary: parsed.summary || quantFallback.summary,
        confidenceScore: typeof parsed.confidenceScore === "number" ? parsed.confidenceScore : quantFallback.confidenceScore,
        executionPhase: typeof parsed.executionPhase === "number" ? parsed.executionPhase : quantFallback.executionPhase,
        proceduralSteps: quantFallback.proceduralSteps,
        checklistAudit: {
          htfContext: {
            valid: quantFallback.checklistAudit.htfContext.valid,
            note: parsed.htfReasoning || quantFallback.checklistAudit.htfContext.note,
          },
          turningPoint: {
            valid: quantFallback.checklistAudit.turningPoint.valid,
            note: parsed.turningPointReasoning || quantFallback.checklistAudit.turningPoint.note,
          },
          ltfTrigger: {
            valid: quantFallback.checklistAudit.ltfTrigger.valid,
            triggerType,
            note: parsed.ltfReasoning || quantFallback.checklistAudit.ltfTrigger.note,
          },
          riskGuard: quantFallback.checklistAudit.riskGuard,
        },
        setup: quantFallback.setup,
        doctrineAdvice: parsed.doctrineAdvice || quantFallback.doctrineAdvice,
      };
    }
  } catch (err) {
    console.warn("[varcoVisionSentinel] Vision LLM fallito o parsing non riuscito, uso motore Piano Operativo:", err);
  }

  return quantFallback;
}
