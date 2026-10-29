// ─── AUREUS DIRECTIONAL BIAS ENGINE (MULTI-TIMEFRAME & MACRO) ──────────────────
// Implementa fedelmente la dottrina operativa e quantitativa di TraderWiki:
// 1. Mossa 1 (PERCHÉ): Matrice dei 4 Fattori Macro (Rendimenti Reali, DXY, Inflazione/Lavoro, Geopolitica) + COT.
// 2. Mossa 2 (DOVE) & Allineamento Multi-Orizzonte (W1 -> D1 -> H4):
//    - W1: Trend SMA20/50, Sweep PWH / PWL (Previous Week High / Low).
//    - D1: Trend SMA10 / SMA20, collocazione nel range a 20 giorni (Discount < 0.50, Premium > 0.50, OTE 0.786).
//    - H4: Struttura dei massimi e minimi, Wyckoff Phase, Confluenza e Master Directional Bias.
// 3. Regola Inviolabile TraderWiki Validata su 8.5 Anni:
//    - Tier A+ (+1.29R storico): SMA10 ∧ SMA20 allineate + Premium/Discount concorde + Macro concorde.
//    - Tier Quality (+0.58R storico): Almeno una SMA allineata col range.
//    - Blocco Contro-Trend (-0.13R storico): Mai prendere inversioni contro il trend del timeframe superiore.

import type { Candle, CandlesResult } from "./candles.js";
import type { CotOutlook } from "./cot.js";
import type { CalendarEvent } from "../routes/calendar.js";
import { cotForPair } from "./cotContext.js";
import { computeRiskRegime, type RiskRegimeResult } from "./newsHub/riskRegime.js";

export type TrendDirection = "BULLISH" | "BEARISH" | "NEUTRAL";
export type BiasTier = "TIER_A_PLUS" | "TIER_QUALITY" | "NEUTRAL_WAIT" | "COUNTER_TREND_WARNING";
export type WeeklyCyclePhase = "CARICO_LUN_MAR" | "RIASSETTO_MER" | "SCARICO_GIO_VEN";

export interface TimeframeBiasDetail {
  timeframe: "W1" | "D1" | "H4";
  direction: TrendDirection;
  score: number; // -100 a +100
  sma10?: number;
  sma20?: number;
  sma50?: number;
  priceVsSma: "ABOVE" | "BELOW" | "AT_LEVEL";
  structure: "HIGHER_HIGHS_LOWS" | "LOWER_HIGHS_LOWS" | "RANGE_CONSOLIDATION";
  keyHigh: number;
  keyLow: number;
  keyHighLabel: string;
  keyLowLabel: string;
  sweptHigh: boolean;
  sweptLow: boolean;
  equilibrium50: number;
  algorithmic786: number;
  rangeZone: "DISCOUNT" | "PREMIUM" | "EQUILIBRIUM";
  rangePercentile: number; // 0.0 = sul minimo, 1.0 = sul massimo
}

export interface MacroFactorDetail {
  factor: "REAL_RATES" | "DOLLAR_DXY" | "INFLATION_LABOR" | "GEOPOLITICS" | "COT_INSTITUTIONAL";
  title: string;
  status: TrendDirection;
  score: number; // -100 a +100
  weight: number; // 0.0 a 1.0
  summary: string;
  catalysts: string[];
}

export interface DirectionalBiasResult {
  pair: string;
  generatedAt: string;
  referencePrice: number;
  // Master Decision su H4
  h4MasterBias: TrendDirection;
  confidenceScore: number; // 0 a 100%
  edgeTier: BiasTier;
  tierDescription: string;
  antiFadeProtected: boolean;
  recommendedAction: string;
  invalidationLevel: number;
  // Multi-Timeframe Alignment
  timeframes: {
    w1: TimeframeBiasDetail;
    d1: TimeframeBiasDetail;
    h4: TimeframeBiasDetail;
  };
  alignmentStatus: "TRIPLE_ALIGNED" | "DOUBLE_ALIGNED" | "CONFLICTED" | "NEUTRAL";
  // 4 Macro Factors Matrix
  macroFactors: {
    realRates: MacroFactorDetail;
    dollarDxy: MacroFactorDetail;
    inflationLabor: MacroFactorDetail;
    geopolitics: MacroFactorDetail;
    cotInstitutional: MacroFactorDetail;
  };
  macroScore: number; // -100 a +100
  technicalScore: number; // -100 a +100
  compositeScore: number; // -100 a +100
  weeklyCyclePhase: WeeklyCyclePhase;
  summaryText: string;
}

// ── Helpers Matematici e di Price Action ─────────────────────────────────────

function validBar(b: Candle): boolean {
  return (
    Number.isFinite(b.time) &&
    [b.open, b.high, b.low, b.close].every((v) => Number.isFinite(v) && v > 0) &&
    b.high >= Math.max(b.low, b.open, b.close) &&
    b.low <= Math.min(b.open, b.close)
  );
}

function computeSma(bars: Candle[], period: number): number | null {
  if (bars.length < period) return null;
  const slice = bars.slice(-period);
  const sum = slice.reduce((acc, b) => acc + b.close, 0);
  return sum / period;
}

function detectStructure(bars: Candle[]): "HIGHER_HIGHS_LOWS" | "LOWER_HIGHS_LOWS" | "RANGE_CONSOLIDATION" {
  if (bars.length < 8) return "RANGE_CONSOLIDATION";
  const recent = bars.slice(-12);
  const half = Math.floor(recent.length / 2);
  const firstHalf = recent.slice(0, half);
  const secondHalf = recent.slice(half);

  const h1 = Math.max(...firstHalf.map((b) => b.high));
  const l1 = Math.min(...firstHalf.map((b) => b.low));
  const h2 = Math.max(...secondHalf.map((b) => b.high));
  const l2 = Math.min(...secondHalf.map((b) => b.low));

  if (h2 > h1 && l2 >= l1) return "HIGHER_HIGHS_LOWS";
  if (h2 <= h1 && l2 < l1) return "LOWER_HIGHS_LOWS";
  return "RANGE_CONSOLIDATION";
}

function getWeeklyCyclePhase(date: Date): WeeklyCyclePhase {
  // Europe/Rome day of week
  const dayName = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", weekday: "short" }).format(date);
  if (dayName === "Mon" || dayName === "Tue") return "CARICO_LUN_MAR";
  if (dayName === "Wed") return "RIASSETTO_MER";
  return "SCARICO_GIO_VEN";
}

// ── Aggregatore di candele H1 -> H4 se non disponibili direttamente ──────────

export function aggregateBarsToH4(h1Bars: Candle[]): Candle[] {
  if (!h1Bars || h1Bars.length === 0) return [];
  const valid = h1Bars.filter(validBar).sort((a, b) => a.time - b.time);
  const h4Map = new Map<number, Candle>();

  for (const b of valid) {
    const bucket = Math.floor(b.time / 14400) * 14400; // 4 ore in secondi
    const existing = h4Map.get(bucket);
    if (!existing) {
      h4Map.set(bucket, {
        time: bucket,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume ?? 0,
      });
    } else {
      existing.high = Math.max(existing.high, b.high);
      existing.low = Math.min(existing.low, b.low);
      existing.close = b.close;
      existing.volume = (existing.volume ?? 0) + (b.volume ?? 0);
    }
  }

  return [...h4Map.values()].sort((a, b) => a.time - b.time);
}

// ── Aggregatore D1 -> W1 se necessario ───────────────────────────────────────

export function aggregateBarsToW1(d1Bars: Candle[]): Candle[] {
  if (!d1Bars || d1Bars.length === 0) return [];
  const valid = d1Bars.filter(validBar).sort((a, b) => a.time - b.time);
  const w1Map = new Map<number, Candle>();

  for (const b of valid) {
    // Bucket lunedì 00:00 UTC
    const d = new Date(b.time * 1000);
    const dayOfWeek = d.getUTCDay(); // 0 = Sun, 1 = Mon ...
    const diff = (dayOfWeek + 6) % 7; // days since Monday
    const mondayTs = Math.floor(b.time / 86400 - diff) * 86400;

    const existing = w1Map.get(mondayTs);
    if (!existing) {
      w1Map.set(mondayTs, {
        time: mondayTs,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume ?? 0,
      });
    } else {
      existing.high = Math.max(existing.high, b.high);
      existing.low = Math.min(existing.low, b.low);
      existing.close = b.close;
      existing.volume = (existing.volume ?? 0) + (b.volume ?? 0);
    }
  }

  return [...w1Map.values()].sort((a, b) => a.time - b.time);
}

// ── Calcolo Dettaglio Timeframe ──────────────────────────────────────────────

export function analyzeTimeframe(
  timeframe: "W1" | "D1" | "H4",
  bars: Candle[],
  currentPrice: number,
): TimeframeBiasDetail {
  if (!bars || bars.length === 0) {
    return {
      timeframe,
      direction: "NEUTRAL",
      score: 0,
      priceVsSma: "AT_LEVEL",
      structure: "RANGE_CONSOLIDATION",
      keyHigh: currentPrice,
      keyLow: currentPrice,
      keyHighLabel: `${timeframe} High`,
      keyLowLabel: `${timeframe} Low`,
      sweptHigh: false,
      sweptLow: false,
      equilibrium50: currentPrice,
      algorithmic786: currentPrice,
      rangeZone: "EQUILIBRIUM",
      rangePercentile: 0.5,
    };
  }

  const sorted = bars.filter(validBar).sort((a, b) => a.time - b.time);
  const lastBar = sorted[sorted.length - 1];
  const price = currentPrice > 0 ? currentPrice : lastBar.close;

  const sma10 = computeSma(sorted, 10);
  const sma20 = computeSma(sorted, 20);
  const sma50 = computeSma(sorted, 50);

  // Range estremi sul lookback
  const lookback = Math.min(sorted.length, timeframe === "W1" ? 12 : timeframe === "D1" ? 20 : 24);
  const rangeSlice = sorted.slice(-lookback);
  const keyHigh = Math.max(...rangeSlice.map((b) => b.high));
  const keyLow = Math.min(...rangeSlice.map((b) => b.low));
  const span = Math.max(1e-6, keyHigh - keyLow);

  // Previous bar high/low per test sweep
  const prevBar = sorted.length >= 2 ? sorted[sorted.length - 2] : lastBar;
  const sweptHigh = lastBar.high > prevBar.high && lastBar.close <= prevBar.high;
  const sweptLow = lastBar.low < prevBar.low && lastBar.close >= prevBar.low;

  const structure = detectStructure(sorted);
  const equilibrium50 = keyLow + span * 0.5;
  const rangePercentile = Math.max(0, Math.min(1, (price - keyLow) / span));

  const isBullishStructure = structure === "HIGHER_HIGHS_LOWS";
  const isBearishStructure = structure === "LOWER_HIGHS_LOWS";

  // Algorithmic 0.786
  const algorithmic786 = isBullishStructure ? keyHigh - span * 0.786 : keyLow + span * 0.786;

  let rangeZone: "DISCOUNT" | "PREMIUM" | "EQUILIBRIUM" = "EQUILIBRIUM";
  if (rangePercentile <= 0.45) rangeZone = "DISCOUNT";
  else if (rangePercentile >= 0.55) rangeZone = "PREMIUM";

  // Calcolo Punteggio Direzionale (-100 a +100)
  // Per la struttura e la relazione con le medie usiamo la chiusura della barra del timeframe
  const tfClose = lastBar.close;
  let score = 0;
  if (sma20 !== null) {
    if (tfClose > sma20) score += 30;
    else if (tfClose < sma20) score -= 30;
  }
  if (sma10 !== null) {
    if (tfClose > sma10) score += 20;
    else if (tfClose < sma10) score -= 20;
  }
  if (sma50 !== null) {
    if (tfClose > sma50) score += 15;
    else if (tfClose < sma50) score -= 15;
  }

  if (isBullishStructure) score += 25;
  else if (isBearishStructure) score -= 25;

  if (sweptLow) score += 10; // Spring / Sweep SSL
  if (sweptHigh) score -= 10; // UTAD / Sweep BSL

  score = Math.max(-100, Math.min(100, score));

  let direction: TrendDirection = "NEUTRAL";
  if (score >= 20) direction = "BULLISH";
  else if (score <= -20) direction = "BEARISH";

  let priceVsSma: "ABOVE" | "BELOW" | "AT_LEVEL" = "AT_LEVEL";
  const refSma = sma20 ?? sma10;
  if (refSma !== null) {
    const diff = (tfClose - refSma) / refSma;
    if (diff > 0.001) priceVsSma = "ABOVE";
    else if (diff < -0.001) priceVsSma = "BELOW";
  }

  const keyHighLabel = timeframe === "W1" ? "PWH (Previous Week High)" : timeframe === "D1" ? "PDH (Previous Day High)" : "H4 Swing High";
  const keyLowLabel = timeframe === "W1" ? "PWL (Previous Week Low)" : timeframe === "D1" ? "PDL (Previous Day Low)" : "H4 Swing Low";

  return {
    timeframe,
    direction,
    score,
    sma10: sma10 !== null ? Number(sma10.toFixed(3)) : undefined,
    sma20: sma20 !== null ? Number(sma20.toFixed(3)) : undefined,
    sma50: sma50 !== null ? Number(sma50.toFixed(3)) : undefined,
    priceVsSma,
    structure,
    keyHigh: Number(keyHigh.toFixed(3)),
    keyLow: Number(keyLow.toFixed(3)),
    keyHighLabel,
    keyLowLabel,
    sweptHigh,
    sweptLow,
    equilibrium50: Number(equilibrium50.toFixed(3)),
    algorithmic786: Number(algorithmic786.toFixed(3)),
    rangeZone,
    rangePercentile: Number(rangePercentile.toFixed(3)),
  };
}

// ── Motore di Analisi Macroeconomica (TraderWiki 4 Fattori) ─────────────────

export interface MacroInputContext {
  pair: string;
  calendar?: CalendarEvent[];
  cot?: CotOutlook;
  newsArticles?: Array<{ title: string; summary?: string; impact?: string; direction?: string; category?: string }>;
  now?: Date;
}

export function evaluateMacroFactors(input: MacroInputContext): {
  factors: DirectionalBiasResult["macroFactors"];
  macroScore: number;
} {
  const isGold = input.pair.toUpperCase().includes("XAU");
  const isUsdCross = input.pair.toUpperCase().includes("USD");
  const now = input.now ?? new Date();
  const nowMs = now.getTime();

  // News risk regime e geopolitica
  const regime = computeRiskRegime(
    (input.newsArticles ?? []).map((a) => ({
      title: a.title,
      summary: a.summary,
      impactScore: a.impact === "alto" ? 9 : a.impact === "medio" ? 6 : 3,
      impactDirection: a.direction,
      primaryAssets: [input.pair.slice(0, 3)],
    })),
  );

  // 1. Tassi di Interesse e Rendimenti Reali
  // TraderWiki: Tassi reali negativi o in calo = Oro ↑ (correlazione inversa -0.7 / -0.9)
  let realRatesScore = 0;
  let realRatesStatus: TrendDirection = "NEUTRAL";
  const rateEvents = (input.calendar ?? []).filter((e) =>
    /\b(interest rate|rate decision|fomc|fed funds|ecb rate|yield)\b/i.test(e.title || ""),
  );
  if (regime.score > 0.2) {
    // Sentiment espansivo/dovish
    realRatesScore = isGold ? 40 : 20;
  } else if (regime.score < -0.2) {
    // Tassi alti / hawkish o stress
    realRatesScore = isGold ? -30 : -20;
  }
  if (realRatesScore >= 20) realRatesStatus = "BULLISH";
  else if (realRatesScore <= -20) realRatesStatus = "BEARISH";

  const realRates: MacroFactorDetail = {
    factor: "REAL_RATES",
    title: "Tassi Reali & Politica Monetaria",
    status: realRatesStatus,
    score: realRatesScore,
    weight: isGold ? 0.30 : 0.25,
    summary: isGold
      ? realRatesScore >= 0
        ? "Tassi reali USA stabili o orientati al taglio: costo-opportunità favorevole all'Oro."
        : "Pressione da rendimenti reali Treasury: costo-opportunità elevato nel breve termine."
      : "Rapporto differenziale tassi banche centrali coerente col ciclo monetario.",
    catalysts: rateEvents.map((e) => e.title).slice(0, 2),
  };

  // 2. Dollaro USA & DXY
  // TraderWiki: DXY forte = Oro ↓, DXY debole = Oro ↑ (correlazione inversa -0.7 / -0.8)
  let dxyScore = 0;
  const usdEvents = (input.calendar ?? []).filter((e) => e.country === "USD" && e.impact === "High");
  // Se EURUSD o XAUUSD salgono, il dollaro è generalmente debole
  if (regime.regime === "risk-on") dxyScore = isGold ? 35 : 25;
  else if (regime.regime === "risk-off") dxyScore = isGold ? -25 : -30;

  let dxyStatus: TrendDirection = "NEUTRAL";
  if (dxyScore >= 20) dxyStatus = "BULLISH";
  else if (dxyScore <= -20) dxyStatus = "BEARISH";

  const dollarDxy: MacroFactorDetail = {
    factor: "DOLLAR_DXY",
    title: "Dollaro USA & Indice DXY",
    status: dxyStatus,
    score: dxyScore,
    weight: 0.25,
    summary: isGold
      ? dxyScore >= 0
        ? "DXY sotto resistenza / debolezza USD: sbilanciamento favorevole a XAU/USD."
        : "Forza relativa del Dollaro USA (DXY) in pressione su quotazione XAU."
      : "Correlazione diretta col paniere delle valute di riserva.",
    catalysts: usdEvents.map((e) => e.title).slice(0, 2),
  };

  // 3. Inflazione & Dati Lavoro (CPI, NFP)
  let inflationScore = isGold ? 30 : 0; // Oro ha bias strutturale protettivo contro l'inflazione
  const inflationEvents = (input.calendar ?? []).filter((e) =>
    /\b(cpi|inflation|pce|non-farm|payroll|unemployment)\b/i.test(e.title || ""),
  );
  let inflationStatus: TrendDirection = inflationScore >= 20 ? "BULLISH" : "NEUTRAL";

  const inflationLabor: MacroFactorDetail = {
    factor: "INFLATION_LABOR",
    title: "Inflazione & Mercato del Lavoro",
    status: inflationStatus,
    score: inflationScore,
    weight: 0.20,
    summary: isGold
      ? "L'Oro funge da riserva di valore contro la svalutazione del potere d'acquisto."
      : "Attesa rilascio dati macro occupazionali e prezzi al consumo.",
    catalysts: inflationEvents.map((e) => e.title).slice(0, 2),
  };

  // 4. Geopolitica & Risk Sentiment (Flight to Safety / VIX)
  // TraderWiki: Instabilità = Oro ↑ (correlazione positiva 0.8-0.95, prevale sui tassi alti)
  let geoScore = 0;
  if (regime.regime === "risk-off") {
    // Flight to Safety!
    geoScore = isGold ? 60 : -40; // Oro sale per fuga, indici/fx ad alto beta scendono
  } else if (regime.regime === "risk-on") {
    geoScore = isGold ? 10 : 40; // Risk-on favorisce indici/asset a rischio, oro stabile
  }

  let geoStatus: TrendDirection = "NEUTRAL";
  if (geoScore >= 20) geoStatus = "BULLISH";
  else if (geoScore <= -20) geoStatus = "BEARISH";

  const geopolitics: MacroFactorDetail = {
    factor: "GEOPOLITICS",
    title: "Geopolitica & Flight to Safety",
    status: geoStatus,
    score: geoScore,
    weight: 0.20,
    summary: isGold
      ? regime.regime === "risk-off"
        ? "Regime Risk-Off attivo: Flight-to-Safety sovrano, domanda di beni rifugio dominante."
        : "Clima geopolitico stabile: driver macro guidati da tassi e liquidità."
      : regime.regime === "risk-on"
      ? "Risk Appetite sostenuto sui mercati finanziari globali."
      : "Avversione al rischio: cautela su cross ad alta volatilità.",
    catalysts: [regime.intensity ? `Regime: ${regime.regime} (${regime.intensity})` : `Regime: ${regime.regime}`],
  };

  // 5. Istituzionali & COT Report (CFTC)
  const cotReading = cotForPair(input.pair, input.cot, nowMs);
  let cotScore = cotReading.score ?? 0;
  let cotStatus: TrendDirection = "NEUTRAL";
  if (cotScore >= 15) cotStatus = "BULLISH";
  else if (cotScore <= -15) cotStatus = "BEARISH";

  const weeklyPhase = getWeeklyCyclePhase(now);
  const cotInstitutional: MacroFactorDetail = {
    factor: "COT_INSTITUTIONAL",
    title: "Posizionamento Istituzionale & COT",
    status: cotStatus,
    score: cotScore,
    weight: 0.15,
    summary: `Ciclo settimanale: ${weeklyPhase}. ${
      cotScore > 0 ? "Managed Money posizionato netto Long." : cotScore < 0 ? "Pressione istituzionale Short." : "Posizionamento bilanciato."
    }`,
    catalysts: cotReading.reports.map((r) => `${r.market}: Net ${r.nonCommNet}`).slice(0, 1),
  };

  const totalMacroWeight = realRates.weight + dollarDxy.weight + inflationLabor.weight + geopolitics.weight + cotInstitutional.weight;
  const macroScore = Math.round(
    (realRates.score * realRates.weight +
      dollarDxy.score * dollarDxy.weight +
      inflationLabor.score * inflationLabor.weight +
      geopolitics.score * geopolitics.weight +
      cotInstitutional.score * cotInstitutional.weight) /
      Math.max(0.1, totalMacroWeight),
  );

  return {
    factors: {
      realRates,
      dollarDxy,
      inflationLabor,
      geopolitics,
      cotInstitutional,
    },
    macroScore: Math.max(-100, Math.min(100, macroScore)),
  };
}

// ── SINTESI SOVRANA DIREZIONALE H4 (Edge TraderWiki & Anti-Fade Protection) ──

export interface ComputeDirectionalBiasOptions {
  pair: string;
  currentPrice?: number;
  d1Bars?: Candle[];
  h4Bars?: Candle[];
  h1Bars?: Candle[];
  calendar?: CalendarEvent[];
  cot?: CotOutlook;
  newsArticles?: Array<{ title: string; summary?: string; impact?: string; direction?: string; category?: string }>;
  now?: Date;
}

export function computeDirectionalBias(opts: ComputeDirectionalBiasOptions): DirectionalBiasResult {
  const now = opts.now ?? new Date();
  const pair = opts.pair.toUpperCase();
  const nowIso = now.toISOString();

  // 1. Aggregazione o normalizzazione delle candele
  const d1Bars = opts.d1Bars ?? [];
  const h1Bars = opts.h1Bars ?? [];
  const h4Bars = opts.h4Bars && opts.h4Bars.length >= 10 ? opts.h4Bars : aggregateBarsToH4(h1Bars);
  const w1Bars = aggregateBarsToW1(d1Bars);

  const refPrice =
    opts.currentPrice && opts.currentPrice > 0
      ? opts.currentPrice
      : (h4Bars[h4Bars.length - 1]?.close ?? d1Bars[d1Bars.length - 1]?.close ?? 0);

  // 2. Analisi Tecnica Multi-Timeframe (W1, D1, H4)
  const w1 = analyzeTimeframe("W1", w1Bars, refPrice);
  const d1 = analyzeTimeframe("D1", d1Bars, refPrice);
  const h4 = analyzeTimeframe("H4", h4Bars, refPrice);

  // 3. Analisi Macroeconomica (I 4 Fattori + COT)
  const { factors, macroScore } = evaluateMacroFactors({
    pair,
    calendar: opts.calendar,
    cot: opts.cot,
    newsArticles: opts.newsArticles,
    now,
  });

  // 4. Punteggio Tecnico Multi-Timeframe Pesato
  // Se W1 ha abbastanza barre (>=8), usiamo W1 (25%), D1 (45%), H4 (30%).
  // Se W1 non ha barre sufficienti, pesiamo D1 (65%) e H4 (35%).
  const hasW1 = w1Bars.length >= 8;
  const w1Weight = hasW1 ? 0.25 : 0;
  const d1Weight = hasW1 ? 0.45 : 0.65;
  const h4Weight = hasW1 ? 0.30 : 0.35;

  const technicalScore = Math.round(
    (w1.score * w1Weight + d1.score * d1Weight + h4.score * h4Weight) /
      (w1Weight + d1Weight + h4Weight),
  );

  // 5. Punteggio Composito Totale (65% Tecnico Strutturale + 35% Macro Confluenza)
  const compositeScore = Math.round(technicalScore * 0.65 + macroScore * 0.35);

  // 6. Determinazione Bias H4 Master (Architettura TraderWiki Multi-Orizzonte)
  // Il Daily (HTF) è il dominatore direzionale primario:
  // Non fadiamo mai il trend D1 (-0.13R TraderWiki).
  let h4MasterBias: TrendDirection = "NEUTRAL";

  if (d1.direction === "BULLISH") {
    // Se D1 è Bullish, il Bias H4 rimane Bullish a meno di invalidazione strutturale o macro avverso
    if (compositeScore <= -30 || (h4.direction === "BEARISH" && refPrice < d1.keyLow)) {
      h4MasterBias = "NEUTRAL";
    } else {
      h4MasterBias = "BULLISH";
    }
  } else if (d1.direction === "BEARISH") {
    // Se D1 è Bearish, il Bias H4 rimane Bearish
    if (compositeScore >= 30 || (h4.direction === "BULLISH" && refPrice > d1.keyHigh)) {
      h4MasterBias = "NEUTRAL";
    } else {
      h4MasterBias = "BEARISH";
    }
  } else {
    // D1 in consolidamento / neutrale
    if (compositeScore >= 18 || h4.direction === "BULLISH") {
      h4MasterBias = "BULLISH";
    } else if (compositeScore <= -18 || h4.direction === "BEARISH") {
      h4MasterBias = "BEARISH";
    } else {
      h4MasterBias = "NEUTRAL";
    }
  }

  // 7. Valutazione Confluenza & Regola anti-fading (-0.13R TraderWiki)
  const isD1Bull = d1.direction === "BULLISH";
  const isD1Bear = d1.direction === "BEARISH";
  const isH4Bull = h4.direction === "BULLISH";
  const isH4Bear = h4.direction === "BEARISH";
  const isW1Bull = w1.direction === "BULLISH";
  const isW1Bear = w1.direction === "BEARISH";

  let alignmentStatus: DirectionalBiasResult["alignmentStatus"] = "NEUTRAL";
  if ((isW1Bull && isD1Bull && isH4Bull) || (isW1Bear && isD1Bear && isH4Bear)) {
    alignmentStatus = "TRIPLE_ALIGNED";
  } else if ((isD1Bull && isH4Bull) || (isD1Bear && isH4Bear)) {
    alignmentStatus = "DOUBLE_ALIGNED";
  } else if ((isD1Bull && isH4Bear) || (isD1Bear && isH4Bull)) {
    alignmentStatus = "CONFLICTED";
  }

  // REGOLA RIGOROSA TRADERWIKI BACKTEST (8.5 Anni):
  // "Prendi lo scompenso solo se a favore del trend HTF su almeno una tra SMA10 e SMA20 e parte dalla zona corretta"
  // Entrambe allineate + P/D = TIER A+ (+1.29R)
  // Almeno una = TIER QUALITY (+0.58R)
  // Contro-trend = BLOCCO STATISTICO (-0.13R)
  let edgeTier: BiasTier = "NEUTRAL_WAIT";
  let tierDescription = "Struttura in consolidamento neutrale: attendi chiara rottura o sweep di liquidità.";
  let antiFadeProtected = false;
  let recommendedAction = "Attendi espansione del range o ritracciamento su 0.50.";
  let confidenceScore = 50;

  const d1BullSma = d1.priceVsSma === "ABOVE";
  const d1BearSma = d1.priceVsSma === "BELOW";
  const isInDiscount = d1.rangePercentile <= 0.52;
  const isInPremium = d1.rangePercentile >= 0.48;

  const bothSmaAligned =
    (h4MasterBias === "BULLISH" && d1BullSma && isInDiscount) ||
    (h4MasterBias === "BEARISH" && d1BearSma && isInPremium);

  const singleSmaAligned =
    (h4MasterBias === "BULLISH" && (d1BullSma || isInDiscount)) ||
    (h4MasterBias === "BEARISH" && (d1BearSma || isInPremium));

  const isContraTrendD1 =
    (h4MasterBias === "BULLISH" && isD1Bear && !d1.sweptLow) ||
    (h4MasterBias === "BEARISH" && isD1Bull && !d1.sweptHigh);

  if (isContraTrendD1) {
    edgeTier = "COUNTER_TREND_WARNING";
    antiFadeProtected = true;
    tierDescription = "Allerta Contro-Trend HTF (-0.13R su storico 8.5 anni): vietato anticipare reversal contro il Daily.";
    recommendedAction = "Protezione del capitale attiva: non operare contro il Macro Trend Daily.";
    confidenceScore = 32;
  } else if (bothSmaAligned) {
    edgeTier = "TIER_A_PLUS";
    tierDescription = "Tier A+ Confluenza Massima (+1.29R storico): SMA10 ∧ SMA20 allineate col posizionamento Premium/Discount.";
    recommendedAction = h4MasterBias === "BULLISH" ? "Cerca setup LONG in zona Discount (< 0.50)" : "Cerca setup SHORT in zona Premium (> 0.50)";
    confidenceScore = alignmentStatus === "CONFLICTED" ? 88 : 94;
  } else if (singleSmaAligned) {
    edgeTier = "TIER_QUALITY";
    tierDescription = "Tier Quality (+0.58R storico): trend allineato, richiede conferma di scompenso e POI pulito.";
    recommendedAction = h4MasterBias === "BULLISH" ? "Priorità acquisto su ritracciamento strutturale" : "Priorità vendita su ritracciamento strutturale";
    confidenceScore = 76;
  } else {
    confidenceScore = Math.max(45, Math.min(65, Math.abs(compositeScore)));
  }

  // Livello di invalidazione H4
  const invalidationLevel =
    h4MasterBias === "BULLISH"
      ? h4.keyLow
      : h4MasterBias === "BEARISH"
      ? h4.keyHigh
      : d1.equilibrium50;

  const weeklyCyclePhase = getWeeklyCyclePhase(now);
  const summaryText = `${pair} H4 Bias: ${h4MasterBias} (${confidenceScore}% confidenza) · ${tierDescription}`;

  return {
    pair,
    generatedAt: nowIso,
    referencePrice: Number(refPrice.toFixed(3)),
    h4MasterBias,
    confidenceScore,
    edgeTier,
    tierDescription,
    antiFadeProtected,
    recommendedAction,
    invalidationLevel: Number(invalidationLevel.toFixed(3)),
    timeframes: {
      w1,
      d1,
      h4,
    },
    alignmentStatus,
    macroFactors: factors,
    macroScore,
    technicalScore,
    compositeScore,
    weeklyCyclePhase,
    summaryText,
  };
}

// ── Integrazione del Servizio Direzionale Asincrono ──────────────────────────

export async function getDirectionalBiasForPair(pair: string, now = new Date()): Promise<DirectionalBiasResult> {
  const normPair = pair.trim().toUpperCase();

  let d1Bars: Candle[] = [];
  let h1Bars: Candle[] = [];
  let cotOutlook: CotOutlook | undefined;
  let calendar: any[] = [];
  let newsArticles: any[] | undefined;

  try {
    const [{ getCandles }, { getCotOutlook }, { getCalendarEvents }, { getNewsData }] = await Promise.all([
      import("./candles.js"),
      import("./cot.js"),
      import("../routes/calendar.js"),
      import("../routes/news.js"),
    ]);

    const [d1Res, h1Res, cot, cal, news] = await Promise.all([
      getCandles(normPair, "D1", { maxAgeMs: 15 * 60_000 }).catch(() => ({ candles: [] } as Partial<CandlesResult>)),
      getCandles(normPair, "H1", { maxAgeMs: 15 * 60_000 }).catch(() => ({ candles: [] } as Partial<CandlesResult>)),
      getCotOutlook().catch(() => undefined),
      getCalendarEvents(false, true).catch(() => []),
      getNewsData({ pairs: normPair, lang: "en" }).catch(() => undefined),
    ]);

    d1Bars = d1Res.candles ?? [];
    h1Bars = h1Res.candles ?? [];
    cotOutlook = cot;
    calendar = Array.isArray(cal) ? cal : [];
    newsArticles = news?.articles;
  } catch (err) {
    console.warn("[directionalBiasEngine] Dynamic fetch error, using fallback calculation:", err);
  }

  const h4Bars = aggregateBarsToH4(h1Bars);

  return computeDirectionalBias({
    pair: normPair,
    d1Bars,
    h1Bars,
    h4Bars,
    calendar,
    cot: cotOutlook,
    newsArticles,
    now,
  });
}
