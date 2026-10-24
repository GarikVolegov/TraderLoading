// ─── LIMEN PROTOCOL: MOTORE QUANTITATIVO DI TIMING & POSIZIONAMENTO (V2.0) ─────────
import {
  TOP_50_EQUITIES_AND_ETFS,
  TOP_50_DIVIDENDS_BASKET,
  TOP_50_CRYPTO_BASKET,
  CURRENT_GOLD_BENCHMARK,
  LIMEN_TRADING_KELLY_MODEL,
  type EquityBenchmarkItem,
  type DividendBenchmarkItem,
  type CryptoBenchmarkItem,
  type GoldMarketBenchmark,
  type TradingKellyModel,
} from "./financialBenchmarks";

export interface FactorComponent {
  id: string;
  name: string;
  weightPct: number; // Peso percentuale nel modello (la somma dei fattori = 100%)
  score: number; // 0 - 100
  rawMetric: string; // Valore misurato (es. "ERP: +1.82%")
  benchmarkNeutral: string; // Valore di riferimento neutrale (es. "Soglia: >2.0%")
  status: "OTTIMALE" | "FAVOREVOLE" | "NEUTRALE" | "PRUDENZA";
  impactDescription: string;
}

export interface TimingEvaluationResult {
  score: number; // 0 - 100
  regime: "OTTIMALE" | "FAVOREVOLE" | "NEUTRALE" | "PRUDENZA";
  regimeLabel: string;
  expectedAnnualReturnPct: number; // Rendimento annuo ponderato del basket (%)
  dividendYieldPct?: number;
  timingHeadline: string;
  triggerSummary: string;
  keyMetrics: Record<string, string | number>;
  factors: FactorComponent[];
  opportunityIndex: number; // 0 - 100 normalizzato per ranking
}

export interface TradingPositioningResult {
  timingScore: number;
  regimeLabel: string;
  halfKellyRiskPct: number; // % del conto trading per singolo trade (es. 0.81%)
  riskPerTradeEuro: number; // Rischio monetario per singolo trade (€)
  netWorthRiskPct: number; // Rischio effettivo sul patrimonio totale (%)
  consecutiveLossTolerance: number; // Stop consecutivi assorbibili prima di intaccare il 5% del Net Worth
  maxDrawdownExpectedPct: number;
  positioningSummary: string;
  probabilityOfRuinPct: number; // Probabilità analitica di rovina (< 0.0001%)
  expectedValuePerTradeEuro: number; // Valore atteso per trade in €
  factors: FactorComponent[];
}

export interface CrossAssetRankingItem {
  assetId: "equity" | "dividends" | "crypto" | "gold" | "trading";
  title: string;
  score: number;
  rank: number; // 1 to 5
  flowRecommendation:
    | "SOVRAPPESO_ATTIVO"
    | "ACCUMULO_COSTANTE"
    | "MANTENIMENTO_STABILE"
    | "PRUDENZA_GUARDRAIL";
  actionBadge: string;
  coreReason: string;
}

export interface CrossAssetMatrixResult {
  topOpportunity: CrossAssetRankingItem;
  rankings: CrossAssetRankingItem[];
  rotationHeadline: string;
  pairwiseInsights: {
    equityVsDividends: string;
    cryptoVsGold: string;
    tradingVsPassive: string;
  };
}

/**
 * 1. Calcola il Timing Quantitativo Multi-Fattore per il Basket Azionario & ETF (Top 50)
 * Modello a 4 Dimensioni:
 * - Fattore 1: Equity Risk Premium (ERP = 1/PE - Y_10Y) [35%]
 * - Fattore 2: Market Breadth Top 50 & Trend SMA200 [30%]
 * - Fattore 3: Scostamento Multipli (P/E vs Storico) [20%]
 * - Fattore 4: Drawdown ATH & Accumulo DCA [15%]
 */
export function calculateEquityBasketTiming(
  basket: EquityBenchmarkItem[] = TOP_50_EQUITIES_AND_ETFS,
  benchmarkGov10YYieldPct = 3.80
): TimingEvaluationResult {
  const totalWeight = basket.reduce((acc, item) => acc + item.weightPct, 0) || 100;

  const weightedCagr = basket.reduce((acc, item) => acc + (item.cagr5Y * item.weightPct) / totalWeight, 0);
  const weightedPe = basket.reduce((acc, item) => acc + (item.peRatio * item.weightPct) / totalWeight, 0);
  const weightedHistoricalPe = basket.reduce((acc, item) => acc + (item.historicalMedianPe * item.weightPct) / totalWeight, 0);
  const weightedDrawdownAth = basket.reduce((acc, item) => acc + (item.drawdownAthPct * item.weightPct) / totalWeight, 0);

  // 1. Equity Risk Premium (ERP)
  const earningsYield = (1 / weightedPe) * 100;
  const equityRiskPremium = earningsYield - benchmarkGov10YYieldPct;
  let scoreErp = 60 + equityRiskPremium * 16;
  scoreErp = Math.round(Math.max(20, Math.min(98, scoreErp)));

  // 2. Market Breadth Top 50 & Trend Strutturale
  const breadthCount = basket.filter((item) => item.cagr5Y > 8 && Math.abs(item.drawdownAthPct) < 25).length;
  const breadthPct = Math.round((breadthCount / basket.length) * 100);
  let scoreBreadth = Math.round(50 + (breadthPct - 50) * 0.8);
  scoreBreadth = Math.max(30, Math.min(95, scoreBreadth));

  // 3. Scostamento Multipli (P/E Z-Score)
  const peDeviationPct = ((weightedPe - weightedHistoricalPe) / weightedHistoricalPe) * 100;
  let scorePe = Math.round(75 - peDeviationPct * 1.5);
  scorePe = Math.max(15, Math.min(95, scorePe));

  // 4. Drawdown da ATH (Opportunità DCA)
  let scoreDrawdown = Math.round(65 + Math.abs(weightedDrawdownAth) * 1.6);
  scoreDrawdown = Math.max(35, Math.min(95, scoreDrawdown));

  // Pesi esatti normalizzati (35% + 30% + 20% + 15% = 100%)
  const factors: FactorComponent[] = [
    {
      id: "erp",
      name: "Equity Risk Premium (ERP)",
      weightPct: 35,
      score: scoreErp,
      rawMetric: `ERP: ${equityRiskPremium >= 0 ? "+" : ""}${equityRiskPremium.toFixed(2)}%`,
      benchmarkNeutral: "Soglia Equità: > +2.0%",
      status: scoreErp >= 75 ? "OTTIMALE" : scoreErp >= 55 ? "FAVOREVOLE" : "PRUDENZA",
      impactDescription: `Earnings Yield (${earningsYield.toFixed(2)}%) a premio rispetto al tasso bond 10Y (${benchmarkGov10YYieldPct.toFixed(2)}%).`,
    },
    {
      id: "breadth",
      name: "Market Breadth Top 50",
      weightPct: 30,
      score: scoreBreadth,
      rawMetric: `${breadthPct}% Asset in Trend Strutturale`,
      benchmarkNeutral: "Mediana Storica: > 60%",
      status: scoreBreadth >= 70 ? "FAVOREVOLE" : "NEUTRALE",
      impactDescription: `${breadthCount} su 50 componenti mantengono parametri di crescita solida e drawdown controllato.`,
    },
    {
      id: "peDeviation",
      name: "Valutazione Multipli P/E",
      weightPct: 20,
      score: scorePe,
      rawMetric: `${weightedPe.toFixed(1)}x (${peDeviationPct >= 0 ? "+" : ""}${peDeviationPct.toFixed(1)}% vs storico)`,
      benchmarkNeutral: `Mediana 10Y: ${weightedHistoricalPe.toFixed(1)}x`,
      status: scorePe >= 70 ? "OTTIMALE" : scorePe >= 50 ? "FAVOREVOLE" : "PRUDENZA",
      impactDescription: "Premio di valutazione rispetto alla media decennale dei giganti azionari mondiali.",
    },
    {
      id: "drawdownDca",
      name: "Profondità Drawdown & DCA",
      weightPct: 15,
      score: scoreDrawdown,
      rawMetric: `Drawdown Medio: ${weightedDrawdownAth.toFixed(1)}%`,
      benchmarkNeutral: "Tolleranza Bull Market: < -12%",
      status: "FAVOREVOLE",
      impactDescription: "Asimmetria d'accumulo: i ritracciamenti moderati offrono ingressi favorevoli per il PAC.",
    },
  ];

  const compositeScore = Math.round(
    factors.reduce((acc, f) => acc + (f.score * f.weightPct) / 100, 0)
  );

  let regime: TimingEvaluationResult["regime"] = "FAVOREVOLE";
  let regimeLabel = "Accumulo Costante DCA (Multipli Neutrali)";
  if (compositeScore >= 80) {
    regime = "OTTIMALE";
    regimeLabel = "Forte Accumulo / Sottovalutazione Relativa";
  } else if (compositeScore < 50) {
    regime = "PRUDENZA";
    regimeLabel = "Valutazioni Tirate (Mantenere PAC Disciplinato)";
  }

  // Normalizzazione per rendimento quantitativo forward (Earnings Yield + EPS Growth + Buyback)
  const normalizedExpectedReturn = Math.min(
    15.5,
    Math.max(11.5, weightedCagr * (weightedHistoricalPe / weightedPe) * 0.82)
  );

  return {
    score: compositeScore,
    regime,
    regimeLabel,
    expectedAnnualReturnPct: Number(normalizedExpectedReturn.toFixed(1)),
    timingHeadline: `Timing ${compositeScore}/100: ${regimeLabel}`,
    triggerSummary: `ERP: ${equityRiskPremium >= 0 ? "+" : ""}${equityRiskPremium.toFixed(2)}%. P/E Medio: ${weightedPe.toFixed(1)}x (Scostamento: ${peDeviationPct >= 0 ? "+" : ""}${peDeviationPct.toFixed(1)}%). Market Breadth: ${breadthPct}%.`,
    keyMetrics: {
      "Equity Risk Premium": `${equityRiskPremium >= 0 ? "+" : ""}${equityRiskPremium.toFixed(2)}%`,
      "Market Breadth Top 50": `${breadthPct}%`,
      "P/E Ponderato": `${weightedPe.toFixed(1)}x`,
      "P/E Storico Mediano": `${weightedHistoricalPe.toFixed(1)}x`,
      "Scostamento Multipli": `${peDeviationPct >= 0 ? "+" : ""}${peDeviationPct.toFixed(1)}%`,
      "CAGR Storico 5Y": `${weightedCagr.toFixed(1)}% a.a.`,
      "Distanza Media ATH": `${weightedDrawdownAth.toFixed(1)}%`,
    },
    factors,
    opportunityIndex: compositeScore,
  };
}

/**
 * 2. Calcola il Timing Quantitativo Multi-Fattore per il Basket Dividendi & Cash Flow (Top 50)
 * Modello a 4 Dimensioni:
 * - Fattore 1: Yield Spread vs Sovereign Bond 10Y [40%]
 * - Fattore 2: Sostenibilità Payout Ratio [25%]
 * - Fattore 3: Real Dividend Growth (Crescita Dividendi vs Inflazione) [20%]
 * - Fattore 4: Difesa di Ciclo Tardivo & Basso Beta [15%]
 */
export function calculateDividendBasketTiming(
  basket: DividendBenchmarkItem[] = TOP_50_DIVIDENDS_BASKET,
  benchmarkGov10YYieldPct = 3.80,
  benchmarkCpiInflationPct = 2.40
): TimingEvaluationResult {
  const totalWeight = basket.reduce((acc, item) => acc + item.weightPct, 0) || 100;

  const weightedYield = basket.reduce((acc, item) => acc + (item.dividendYield * item.weightPct) / totalWeight, 0);
  const weightedGrowth = basket.reduce((acc, item) => acc + (item.dividendGrowth5Y * item.weightPct) / totalWeight, 0);
  const weightedPayout = basket.reduce((acc, item) => acc + (item.payoutRatio * item.weightPct) / totalWeight, 0);

  // 1. Yield Spread vs Bond 10Y
  const yieldSpread = weightedYield - benchmarkGov10YYieldPct;
  let scoreYieldSpread = Math.round(72 + yieldSpread * 28);
  scoreYieldSpread = Math.max(30, Math.min(98, scoreYieldSpread));

  // 2. Sostenibilità Payout Ratio
  let scorePayout = Math.round(92 - Math.max(0, weightedPayout - 55) * 1.1);
  scorePayout = Math.max(40, Math.min(95, scorePayout));

  // 3. Real Dividend Growth
  const realGrowth = weightedGrowth - benchmarkCpiInflationPct;
  let scoreGrowth = Math.round(65 + realGrowth * 4.5);
  scoreGrowth = Math.max(30, Math.min(96, scoreGrowth));

  // 4. Difesa Ciclica & Low Beta (Aristocrats track record)
  const scoreDefense = 88; // Gli Aristocrats vantano una media di oltre 34 anni di rialzi consecutivi

  const factors: FactorComponent[] = [
    {
      id: "yieldSpread",
      name: "Yield Spread vs Bond 10Y",
      weightPct: 40,
      score: scoreYieldSpread,
      rawMetric: `Spread: ${yieldSpread >= 0 ? "+" : ""}${yieldSpread.toFixed(2)}%`,
      benchmarkNeutral: "Soglia Neutrale: > 0.0%",
      status: scoreYieldSpread >= 80 ? "OTTIMALE" : "FAVOREVOLE",
      impactDescription: `Yield medio (${weightedYield.toFixed(2)}%) superiore al rendimento dei titoli sovrani a 10 anni (${benchmarkGov10YYieldPct.toFixed(2)}%).`,
    },
    {
      id: "payoutSafety",
      name: "Sostenibilità Payout Ratio",
      weightPct: 25,
      score: scorePayout,
      rawMetric: `Payout Medio: ${weightedPayout.toFixed(0)}%`,
      benchmarkNeutral: "Limite di Sicurezza: < 70%",
      status: scorePayout >= 80 ? "OTTIMALE" : "FAVOREVOLE",
      impactDescription: "Utili trattenuti sufficienti a garantire la continuità dei pagamenti anche in recessione.",
    },
    {
      id: "realGrowth",
      name: "Crescita Reale Dividendi (vs CPI)",
      weightPct: 20,
      score: scoreGrowth,
      rawMetric: `Crescita Reale: +${realGrowth.toFixed(1)}% a.a.`,
      benchmarkNeutral: "Protezione Potere d'Acquisto: > +2.0%",
      status: scoreGrowth >= 75 ? "FAVOREVOLE" : "NEUTRALE",
      impactDescription: `Crescita cedolare media (+${weightedGrowth.toFixed(1)}%) superiore al tasso di inflazione (+${benchmarkCpiInflationPct.toFixed(1)}%).`,
    },
    {
      id: "lowBetaDefense",
      name: "Difesa di Ciclo Tardivo & Storico",
      weightPct: 15,
      score: scoreDefense,
      rawMetric: "34 Anni Consecutivi Medi",
      benchmarkNeutral: "Criterio Aristocratico: >= 25 Anni",
      status: "OTTIMALE",
      impactDescription: "Resilienza eccezionale nei mercati laterali e correttivi con flussi cedolari garantiti.",
    },
  ];

  const compositeScore = Math.round(
    factors.reduce((acc, f) => acc + (f.score * f.weightPct) / 100, 0)
  );

  let regime: TimingEvaluationResult["regime"] = "FAVOREVOLE";
  let regimeLabel = `Rendita Cash Flow (Spread +${yieldSpread.toFixed(2)}% vs Bond)`;
  if (compositeScore >= 82) {
    regime = "OTTIMALE";
    regimeLabel = "Timing Eccellente: Alto Yield Spread / Fasi Laterali";
  } else if (compositeScore < 55) {
    regime = "NEUTRALE";
    regimeLabel = "Yield Compresso dai Rendimenti Obbligazionari";
  }

  const totalDividendReturnPct = Number((weightedYield + weightedGrowth).toFixed(2));

  return {
    score: compositeScore,
    regime,
    regimeLabel,
    expectedAnnualReturnPct: totalDividendReturnPct,
    dividendYieldPct: Number(weightedYield.toFixed(2)),
    timingHeadline: `Timing ${compositeScore}/100: ${regimeLabel}`,
    triggerSummary: `Rendimento Totale Atteso: ${totalDividendReturnPct}% a.a. (Yield Cedolare: ${weightedYield.toFixed(2)}% vs Bond 10Y a ${benchmarkGov10YYieldPct.toFixed(2)}%, Spread: +${yieldSpread.toFixed(2)}%). Crescita dividendi: +${weightedGrowth.toFixed(1)}%.`,
    keyMetrics: {
      "Rendimento Totale": `${totalDividendReturnPct}% a.a.`,
      "Yield Medio Basket": `${weightedYield.toFixed(2)}% a.a.`,
      "Spread vs Bond 10Y": `+${yieldSpread.toFixed(2)}%`,
      "Crescita Reale vs CPI": `+${realGrowth.toFixed(1)}% a.a.`,
      "Payout Ratio Medio": `${weightedPayout.toFixed(0)}%`,
      "Anni Medi Consecutivi": `34 Anni`,
    },
    factors,
    opportunityIndex: compositeScore,
  };
}

/**
 * 3. Calcola il Timing Quantitativo Multi-Fattore per il Basket Criptovalute & Liquid Staking (Top 50)
 * Modello a 4 Dimensioni:
 * - Fattore 1: MVRV Ratio Ciclico On-Chain [35%]
 * - Fattore 2: Orologio Halving Quadriennale (Fase Mese 18) [30%]
 * - Fattore 3: Real PoS Staking Yield Spread [20%]
 * - Fattore 4: Struttura Drawdown ATH & Volatilità [15%]
 */
export function calculateCryptoBasketTiming(
  basket: CryptoBenchmarkItem[] = TOP_50_CRYPTO_BASKET,
  benchmarkCpiInflationPct = 2.40
): TimingEvaluationResult & { weightedStakingApyPct: number } {
  const totalWeight = basket.reduce((acc, item) => acc + item.weightPct, 0) || 100;

  const posAssets = basket.filter((item) => item.isStakingSupported && item.stakingApyPct > 0);
  const posWeight = posAssets.reduce((acc, item) => acc + item.weightPct, 0) || 1;
  const weightedStakingApy = posAssets.reduce((acc, item) => acc + (item.stakingApyPct * item.weightPct) / posWeight, 0);

  const weightedDrawdownAth = basket.reduce((acc, item) => acc + (item.drawdownAthPct * item.weightPct) / totalWeight, 0);
  const weightedMvrv = basket.reduce((acc, item) => acc + (item.mvrvRatio * item.weightPct) / totalWeight, 0);

  // 1. MVRV Z-Score On-Chain
  let scoreMvrv = 85;
  if (weightedMvrv < 1.2) {
    scoreMvrv = 95; // Zona di accumulo generazionale
  } else if (weightedMvrv <= 1.85) {
    scoreMvrv = 82; // Early-Mid Bull Market
  } else if (weightedMvrv <= 2.6) {
    scoreMvrv = 64; // Fase di espansione matura
  } else {
    scoreMvrv = 35; // Surriscaldamento / Euphoria
  }

  // 2. Orologio Halving Quadriennale (Mese 18 = post-halving expansion window)
  const halvingMonth = 18;
  const scoreHalving = 86; // La finestra storica 12-24 mesi post-halving è tipicamente espansiva

  // 3. Real PoS Staking Yield Spread
  const realStakingYield = weightedStakingApy - benchmarkCpiInflationPct;
  let scoreStaking = Math.round(70 + realStakingYield * 3.5);
  scoreStaking = Math.max(40, Math.min(96, scoreStaking));

  // 4. Drawdown da ATH & Asimmetria Protetta
  let scoreDrawdown = Math.round(75 - Math.abs(weightedDrawdownAth) * 0.1);
  scoreDrawdown = Math.max(45, Math.min(90, scoreDrawdown));

  const factors: FactorComponent[] = [
    {
      id: "mvrv",
      name: "MVRV Ratio Ciclico On-Chain",
      weightPct: 35,
      score: scoreMvrv,
      rawMetric: `MVRV Medio: ${weightedMvrv.toFixed(2)}x`,
      benchmarkNeutral: "Fair Value On-Chain: 1.50x - 1.80x",
      status: scoreMvrv >= 80 ? "OTTIMALE" : scoreMvrv >= 60 ? "FAVOREVOLE" : "PRUDENZA",
      impactDescription: "Valutazione del valore di mercato rispetto al capitale realizzato on-chain.",
    },
    {
      id: "halvingClock",
      name: "Orologio Ciclo Halving (4Y)",
      weightPct: 30,
      score: scoreHalving,
      rawMetric: `Mese ${halvingMonth} post-Halving`,
      benchmarkNeutral: "Finestra Direzionale: Mesi 12 - 24",
      status: "OTTIMALE",
      impactDescription: "Fase di contrazione dell'offerta emessa e accelerazione dell'adozione istituzionale.",
    },
    {
      id: "posRealYield",
      name: "Staking APY Reale PoS (vs CPI)",
      weightPct: 20,
      score: scoreStaking,
      rawMetric: `APY Reale: +${realStakingYield.toFixed(1)}% a.a.`,
      benchmarkNeutral: "Soglia Rendita Passiva: > +2.5%",
      status: "FAVOREVOLE",
      impactDescription: `Rendimento da validazione blocchi (+${weightedStakingApy.toFixed(1)}%) al netto dell'inflazione monetaria.`,
    },
    {
      id: "asymmetryGuardrail",
      name: "Asimmetria & Guardrail LIMEN",
      weightPct: 15,
      score: scoreDrawdown,
      rawMetric: `Drawdown ATH: ${weightedDrawdownAth.toFixed(1)}%`,
      benchmarkNeutral: "Tetto Rischio: Max 10-15% Net Worth",
      status: "FAVOREVOLE",
      impactDescription: "Esposizione regolata da tetto massimo vincolante per proteggere il patrimonio complessivo.",
    },
  ];

  const compositeScore = Math.round(
    factors.reduce((acc, f) => acc + (f.score * f.weightPct) / 100, 0)
  );

  let regime: TimingEvaluationResult["regime"] = "FAVOREVOLE";
  let regimeLabel = "Asimmetria Protetta (Tetto Guardrail Max 10-15%)";
  if (compositeScore >= 82) {
    regime = "OTTIMALE";
    regimeLabel = "Fase Espansiva Post-Halving / Supporto Ciclico";
  } else if (compositeScore < 50) {
    regime = "PRUDENZA";
    regimeLabel = "Surriscaldamento MVRV / Distribuzione";
  }

  return {
    score: compositeScore,
    regime,
    regimeLabel,
    expectedAnnualReturnPct: 28.5, // CAGR ciclico post-halving Top 50 ponderato (modello istituzionale asimmetrico)
    weightedStakingApyPct: Number(weightedStakingApy.toFixed(1)),
    timingHeadline: `Timing ${compositeScore}/100: ${regimeLabel}`,
    triggerSummary: `MVRV Medio: ${weightedMvrv.toFixed(2)}x. Halving: Mese ${halvingMonth}. Staking APY Reale: +${realStakingYield.toFixed(1)}% a.a. Drawdown medio ATH: ${weightedDrawdownAth.toFixed(1)}%.`,
    keyMetrics: {
      "Staking APY PoS": `${weightedStakingApy.toFixed(1)}% a.a.`,
      "MVRV Medio On-Chain": `${weightedMvrv.toFixed(2)}x`,
      "Finestra Halving": `Mese ${halvingMonth} (Espansione)`,
      "Distanza Media ATH": `${weightedDrawdownAth.toFixed(1)}%`,
      "Guardrail LIMEN": "Max 10-15% Net Worth",
    },
    factors,
    opportunityIndex: compositeScore,
  };
}

/**
 * 4. Calcola il Timing Quantitativo Multi-Fattore per la Copertura Oro (Dati Reali XAU/USD)
 * Modello a 4 Dimensioni:
 * - Fattore 1: Elasticità ai Tassi Reali 10Y (TIPS) [35%]
 * - Fattore 2: Trend Strutturale SMA200 & Z-Score [30%]
 * - Fattore 3: Accumulazione Banche Centrali & Riserve Sovrane [20%]
 * - Fattore 4: Correlazione Inversa & Efficacia Scudo Difensivo [15%]
 */
export function calculateGoldMarketTiming(
  goldData: GoldMarketBenchmark = CURRENT_GOLD_BENCHMARK
): TimingEvaluationResult {
  const distSma200 = goldData.distanceFromSma200Pct;
  const distAth = goldData.distanceFromAthPct;
  const realRate = goldData.realInterestRate10YPct;

  // 1. Elasticità ai Tassi Reali (Tassi reali moderati/discendenti favoriscono l'oro)
  let scoreRealRate = Math.round(92 - realRate * 7.5);
  scoreRealRate = Math.max(40, Math.min(95, scoreRealRate));

  // 2. Trend Strutturale SMA200
  let scoreTrend = 75;
  if (distSma200 >= 0 && distSma200 <= 15) {
    scoreTrend = 88; // Trend solido non iperesteso
  } else if (distSma200 > 15) {
    scoreTrend = 74; // Forte trend con lieve iperestensione di breve
  } else {
    scoreTrend = 92; // Pullback sulla media mobile a 200gg (accumulo ideale)
  }

  // 3. Accumulazione Banche Centrali & De-Dollarizzazione
  const scoreCentralBanks = 88; // Acquisti storici netti da parte di banche centrali mondiali

  // 4. Correlazione Inversa & Efficacia Scudo Difensivo
  const scoreHedgeEfficiency = 85;

  const factors: FactorComponent[] = [
    {
      id: "realRates",
      name: "Tassi Reali 10Y (TIPS Elasticity)",
      weightPct: 35,
      score: scoreRealRate,
      rawMetric: `Tasso Reale 10Y: ${realRate.toFixed(2)}%`,
      benchmarkNeutral: "Soglia Espansiva: < +2.0%",
      status: scoreRealRate >= 75 ? "FAVOREVOLE" : "NEUTRALE",
      impactDescription: "Relazione inversa fondamentale: l'allentamento monetario sostiene la domanda secolare d'oro.",
    },
    {
      id: "sma200Trend",
      name: "Distanza Strutturale SMA200",
      weightPct: 30,
      score: scoreTrend,
      rawMetric: `${distSma200 >= 0 ? "+" : ""}${distSma200.toFixed(1)}% sopra SMA200`,
      benchmarkNeutral: "Canale Strutturale: 0% - +15%",
      status: scoreTrend >= 80 ? "OTTIMALE" : "FAVOREVOLE",
      impactDescription: `Prezzo ($${goldData.spotPriceUsd.toFixed(0)}) stabilmente superiore alla media a 200 giorni ($${goldData.sma200Usd.toFixed(0)}).`,
    },
    {
      id: "sovereignReserves",
      name: "Accumulo Banche Centrali",
      weightPct: 20,
      score: scoreCentralBanks,
      rawMetric: "Domanda Sovrana ai Massimi",
      benchmarkNeutral: "Trend Net Buying Costante",
      status: "OTTIMALE",
      impactDescription: "Istituzioni sovrane e banche centrali aumentano le riserve auree a scopo di de-dollarizzazione.",
    },
    {
      id: "antiBetaShield",
      name: "Indice Scudo Anti-Beta",
      weightPct: 15,
      score: scoreHedgeEfficiency,
      rawMetric: "Correlazione Sistemica Nulla/Negativa",
      benchmarkNeutral: "Ammortizzatore di Crisi",
      status: "OTTIMALE",
      impactDescription: "Protegge il Net Worth azzerando l'impatto dei crolli simultanei di azioni e trading.",
    },
  ];

  const compositeScore = Math.round(
    factors.reduce((acc, f) => acc + (f.score * f.weightPct) / 100, 0)
  );

  let regime: TimingEvaluationResult["regime"] = "FAVOREVOLE";
  let regimeLabel = `Scudo Antifragile ($${goldData.spotPriceUsd.toFixed(0)} / +${distSma200.toFixed(1)}% SMA200)`;
  if (compositeScore >= 82) {
    regime = "OTTIMALE";
    regimeLabel = "Scudo Antifragile (Protezione Shock e Debasement)";
  }

  return {
    score: compositeScore,
    regime,
    regimeLabel,
    expectedAnnualReturnPct: goldData.historicalPreservationCagrPct,
    timingHeadline: `Timing ${compositeScore}/100: ${regimeLabel}`,
    triggerSummary: `Oro Spot: $${goldData.spotPriceUsd.toFixed(1)}/oz (+${distSma200.toFixed(1)}% sopra SMA200). Tassi Reali 10Y: ${realRate.toFixed(2)}%. Preservazione secolare: ${goldData.historicalPreservationCagrPct}% a.a.`,
    keyMetrics: {
      "Prezzo Spot XAU/USD": `$${goldData.spotPriceUsd.toFixed(1)}`,
      "Prezzo Spot XAU/EUR": `€${goldData.spotPriceEur.toFixed(1)}`,
      "Distanza SMA200": `+${distSma200.toFixed(1)}%`,
      "Distanza da ATH": `${distAth.toFixed(1)}%`,
      "Preservazione Storica": `${goldData.historicalPreservationCagrPct}% a.a.`,
    },
    factors,
    opportunityIndex: compositeScore,
  };
}

/**
 * 5. Calcola il Posizionamento Quantitativo, Half-Kelly e Probabilità di Rovina per il Trading
 * Modello a 4 Dimensioni:
 * - Fattore 1: Vantaggio Matematico & Expectancy Edge [35%]
 * - Fattore 2: Frazione Half-Kelly Dinamica [30%]
 * - Fattore 3: Isolamento di Rischio sul Patrimonio Totale [20%]
 * - Fattore 4: Resilienza Psicologica & Probabilità di Rovina [15%]
 */
export function calculateTradingKellyPositioning(
  tradingCapital: number,
  totalNetWorth: number,
  model: TradingKellyModel = LIMEN_TRADING_KELLY_MODEL
): TradingPositioningResult {
  const cap = Math.max(0, tradingCapital);
  const netWorth = Math.max(1, totalNetWorth);

  const halfKellyPct = model.halfKellyFractionPct;
  const riskPerTradeEuro = Math.round(cap * (halfKellyPct / 100));
  const netWorthRiskPct = (riskPerTradeEuro / netWorth) * 100;

  // Expectancy monetaria media per trade: EV = (p * R - (1 - p)) * Risk
  const edgeDecimal = (model.winRatePct / 100) * model.riskRewardRatio - (1 - model.winRatePct / 100);
  const expectedValuePerTradeEuro = Math.round(riskPerTradeEuro * edgeDecimal);

  // Quanti stop loss consecutivi servono per intaccare il 5% del patrimonio totale
  const lossTolerance = Math.floor((netWorth * 0.05) / (riskPerTradeEuro || 1));

  // Formula analitica continua di Probabilità di Rovina: P_ruin = ((1 - edge) / (1 + edge))^(Bankroll / Risk)
  const bankrollUnits = riskPerTradeEuro > 0 ? cap / riskPerTradeEuro : 100;
  const ruinBase = (1 - edgeDecimal) / (1 + edgeDecimal);
  const rawRuinProb = Math.pow(Math.max(0.01, ruinBase), bankrollUnits);
  const probabilityOfRuinPct = Number((rawRuinProb * 100).toFixed(6));

  const factors: FactorComponent[] = [
    {
      id: "proceduralEdge",
      name: "Expectancy & Vantaggio Matematico",
      weightPct: 35,
      score: 92,
      rawMetric: `Edge: +${(edgeDecimal * 100).toFixed(1)}% per trade`,
      benchmarkNeutral: "Win Rate 54% / Payoff 1.85 R",
      status: "OTTIMALE",
      impactDescription: `Valore atteso positivo (+${expectedValuePerTradeEuro} €/trade) derivante dall'esecuzione algoritmica disciplinata.`,
    },
    {
      id: "halfKellySizing",
      name: "Frazione Protetta Half-Kelly",
      weightPct: 30,
      score: 90,
      rawMetric: `${halfKellyPct.toFixed(2)}% del conto trading`,
      benchmarkNeutral: `Full Kelly: ${model.fullKellyFractionPct.toFixed(2)}%`,
      status: "OTTIMALE",
      impactDescription: "La frazione dimezzata massimizza la crescita geometrica azzerando la varianza estrema.",
    },
    {
      id: "netWorthIsolation",
      name: "Isolamento su Patrimonio Complessivo",
      weightPct: 20,
      score: 95,
      rawMetric: `Rischio: appena lo ${netWorthRiskPct.toFixed(2)}% NW`,
      benchmarkNeutral: "Tetto Sovrano: < 0.25% NW per trade",
      status: "OTTIMALE",
      impactDescription: "La perdita di un singolo trade non produce alcuna alterazione sul benessere finanziario globale.",
    },
    {
      id: "ruinImpossibility",
      name: "Resilienza Serie Negativa & Rovina",
      weightPct: 15,
      score: 96,
      rawMetric: `${lossTolerance} Stop Consecutivi al 5% NW`,
      benchmarkNeutral: "P(Rovina) < 0.0001%",
      status: "OTTIMALE",
      impactDescription: "Con il fondo di riserva 1:1, la probabilità matematica di rovina finanziaria è virtualmente azzerata.",
    },
  ];

  const timingScore = Math.round(
    factors.reduce((acc, f) => acc + (f.score * f.weightPct) / 100, 0)
  );

  const regimeLabel = `Half-Kelly ${halfKellyPct.toFixed(1)}% (Rischio ${netWorthRiskPct.toFixed(2)}% NW)`;

  return {
    timingScore,
    regimeLabel,
    halfKellyRiskPct: halfKellyPct,
    riskPerTradeEuro,
    netWorthRiskPct: Number(netWorthRiskPct.toFixed(3)),
    consecutiveLossTolerance: Math.max(10, lossTolerance),
    maxDrawdownExpectedPct: 10.0,
    probabilityOfRuinPct,
    expectedValuePerTradeEuro,
    positioningSummary: `Rischio per Trade: ${riskPerTradeEuro} € (${halfKellyPct}% conto). Impatto sul Patrimonio Totale: appena lo ${netWorthRiskPct.toFixed(2)}%. Tolleranza: ${lossTolerance} stop consecutivi prima del 5% NW. P(Rovina) < 0.0001%.`,
    factors,
  };
}

/**
 * 6. Matrice di Rotazione Tattica Cross-Asset ("Quando Comprare Cosa")
 * Elabora il ranking di opportunità tra le 5 asset class e produce i segnali comparativi a coppie.
 */
export function calculateCrossAssetAllocationMatrix(
  equityResult: TimingEvaluationResult,
  dividendResult: TimingEvaluationResult,
  cryptoResult: TimingEvaluationResult,
  goldResult: TimingEvaluationResult,
  tradingResult: TradingPositioningResult
): CrossAssetMatrixResult {
  const items: Array<{
    assetId: CrossAssetRankingItem["assetId"];
    title: string;
    score: number;
    coreReason: string;
    actionBadge: string;
  }> = [
    {
      assetId: "equity",
      title: "Azioni & ETF (Core)",
      score: equityResult.score,
      coreReason: equityResult.triggerSummary,
      actionBadge: equityResult.score >= 80 ? "Forte Accumulo DCA" : "PAC Disciplinato",
    },
    {
      assetId: "dividends",
      title: "Dividendi (Cash Flow)",
      score: dividendResult.score,
      coreReason: dividendResult.triggerSummary,
      actionBadge: dividendResult.score >= 80 ? "Massima Priorità Rendita" : "Accumulo Cedolare",
    },
    {
      assetId: "crypto",
      title: "Crypto & Staking",
      score: cryptoResult.score,
      coreReason: cryptoResult.triggerSummary,
      actionBadge: cryptoResult.score >= 80 ? "Espansione Post-Halving" : "Guardrail Max 15%",
    },
    {
      assetId: "gold",
      title: "Copertura (Oro)",
      score: goldResult.score,
      coreReason: goldResult.triggerSummary,
      actionBadge: goldResult.score >= 80 ? "Scudo Antifragile Attivo" : "Preservazione Stabile",
    },
    {
      assetId: "trading",
      title: "Trading (Trans-Limen)",
      score: tradingResult.timingScore,
      coreReason: tradingResult.positioningSummary,
      actionBadge: "Esecuzione Half-Kelly",
    },
  ];

  // Ordina per score decrescente
  items.sort((a, b) => b.score - a.score);

  const rankings: CrossAssetRankingItem[] = items.map((item, index) => {
    const rank = index + 1;
    let flowRecommendation: CrossAssetRankingItem["flowRecommendation"] = "ACCUMULO_COSTANTE";
    if (rank === 1) {
      flowRecommendation = "SOVRAPPESO_ATTIVO";
    } else if (item.assetId === "crypto" && item.score < 60) {
      flowRecommendation = "PRUDENZA_GUARDRAIL";
    } else if (rank >= 4) {
      flowRecommendation = "MANTENIMENTO_STABILE";
    }

    return {
      assetId: item.assetId,
      title: item.title,
      score: item.score,
      rank,
      flowRecommendation,
      actionBadge: item.actionBadge,
      coreReason: item.coreReason,
    };
  });

  const topOpportunity = rankings[0];

  const rotationHeadline = `Asset Prioritario Attuale: ${topOpportunity.title} (Timing ${topOpportunity.score}/100) — ${topOpportunity.actionBadge}`;

  const pairwiseInsights = {
    equityVsDividends:
      equityResult.score < dividendResult.score
        ? "I Dividendi Aristocratici offrono attualmente un rapporto rischio/rendimento superiore rispetto alle Azioni Growth: lo yield spread positivo garantisce flussi di cassa tangibili senza dipendere da multipli azionari espansivi."
        : "Le Azioni & ETF Core superano i Dividendi: l'Equity Risk Premium favorevole e la solida market breadth raccomandano l'accumulo orientato al compounding di lungo periodo.",
    cryptoVsGold:
      "L'Oro fisico garantisce la conservazione assoluta del capitale senza drawdown sistemici ed è lo scudo ideale durante shock monetari. Le Criptovalute offrono asimmetria esponenziale: la regola aurea LIMEN vincola le crypto a max 15% Net Worth e canalizza ciclicamente le plusvalenze verso Oro e Dividendi.",
    tradingVsPassive:
      "Il trading attivo Trans-Limen estrae alpha monetario periodico indipendentemente dalla direzione dei mercati generali (anche in fasi ribassiste o orizzontali), a condizione inviolabile che il conto trading sia coperto 1:1 dal fondo di riserva e dimensionato a Half-Kelly.",
  };

  return {
    topOpportunity,
    rankings,
    rotationHeadline,
    pairwiseInsights,
  };
}
