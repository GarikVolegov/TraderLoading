/**
 * LIMEN PROTOCOL — Architettura Patrimoniale & Fondamenta di Rischio
 *
 * Filosofia: Il trading non inizia dal grafico, ma dalla struttura finanziaria sottostante.
 * La tenuta psicologica a mercato dipende direttamente dal peso del conto trading
 * rispetto al patrimonio totale e dalla presenza di un fondo di riserva almeno paritario.
 */

export type AccountObjective = "GROWTH" | "INCOME";

export type PsychologicalZone = "OPTIMAL" | "ATTENTION" | "CRITICAL";

export type ExpectationLevel = "SUSTAINABLE" | "CHALLENGING" | "AGGRESSIVE_DANGEROUS";

export type TaxCountry = "IT" | "CH" | "ES" | "FR" | "DE" | "UK" | "OTHER";

export type TaxRegimeMode = "DICHIARATIVO" | "AMMINISTRATO";

export interface TaxDoctrineAssetRule {
  assetKey: string;
  label: string;
  taxRatePct: number;
  taxRateLabel: string;
  category: "REDDITI_DIVERSI" | "REDDITI_CAPITALE" | "IMPOSTA_PATRIMONIALE" | "REGIME_SPECIALE";
  lossCompensable: boolean;
  compensationRules: string;
  notes: string;
}

export interface TaxReportingDuty {
  code: string;
  name: string;
  obligation: string;
  threshold: string;
  penalties: string;
}

export interface TaxPropFirmDoctrine {
  nature: string;
  options: Array<{
    title: string;
    regime: string;
    taxRate: string;
    description: string;
    inpsRate: string;
    suitability: string;
  }>;
  crucialRules: string[];
}

export interface CountryTaxDoctrine {
  countryCode: TaxCountry;
  countryName: string;
  flagEmoji: string;
  standardCapitalGainRatePct: number; // 26% per IT
  governmentBondRatePct: number; // 12.5% per IT
  stampDutyInvestmentsPct: number; // 0.20% per IT (bollo su dossier titoli e IVAFE estero)
  stampDutyCheckingAccountEuro: number; // 34.20€ oltre 5.000€
  cryptoTaxRatePct: number; // 26%
  lossCarryForwardYears: number; // 4 anni in IT
  primaryRegime: TaxRegimeMode;
  assetRules: TaxDoctrineAssetRule[];
  reportingDuties: TaxReportingDuty[];
  propFirmDoctrine: TaxPropFirmDoctrine;
  taxDeadlines: Array<{ period: string; description: string; forms: string }>;
}

export const ITALY_TAX_DOCTRINE: CountryTaxDoctrine = {
  countryCode: "IT",
  countryName: "Italia",
  flagEmoji: "🇮🇹",
  standardCapitalGainRatePct: 26.0,
  governmentBondRatePct: 12.5,
  stampDutyInvestmentsPct: 0.20,
  stampDutyCheckingAccountEuro: 34.2,
  cryptoTaxRatePct: 26.0,
  lossCarryForwardYears: 4,
  primaryRegime: "DICHIARATIVO",
  assetRules: [
    {
      assetKey: "trading",
      label: "Trading Attivo (CFD, Futures, Forex, Azioni)",
      taxRatePct: 26.0,
      taxRateLabel: "26.00% (Imposta Sostitutiva)",
      category: "REDDITI_DIVERSI",
      lossCompensable: true,
      compensationRules: "Compensabile fino a 4 anni successivi con plusvalenze di pari natura (Quadro RT)",
      notes: "Art. 67 lett. c-quater TUIR. Le perdite generano minusvalenze nello 'zainetto fiscale'.",
    },
    {
      assetKey: "equity",
      label: "Core Azionario & ETF (UCITS)",
      taxRatePct: 26.0,
      taxRateLabel: "26.00%",
      category: "REDDITI_CAPITALE",
      lossCompensable: false,
      compensationRules: "Gain = Reddito di Capitale (26%), Loss = Reddito Diverso. Non compensabile tra soli ETF!",
      notes: "Gli ETF ad accumulo evitano il drag fiscale differendo l'imposta al momento della liquidazione.",
    },
    {
      assetKey: "dividends",
      label: "Dividendi & Flussi di Cassa",
      taxRatePct: 26.0,
      taxRateLabel: "26.00% (Netto Frontiera)",
      category: "REDDITI_CAPITALE",
      lossCompensable: false,
      compensationRules: "Non compensabili con minusvalenze pregresse.",
      notes: "Su azioni USA si applica ritenuta convenzionale 15% (W-8BEN) + 26% sul netto frontiera in Italia.",
    },
    {
      assetKey: "crypto",
      label: "Cripto-Attività (Bitcoin, Altcoin, Staking)",
      taxRatePct: 26.0,
      taxRateLabel: "26.00% + 0.20% IVAFE",
      category: "REDDITI_DIVERSI",
      lossCompensable: true,
      compensationRules: "Compensabili con plusvalenze crypto entro i 4 anni solari successivi.",
      notes: "Art. 67 c. 1 lett. c-sexies TUIR. Obbligo monitoraggio Quadro RW senza soglia minima.",
    },
    {
      assetKey: "hedging",
      label: "Titoli di Stato White List & Oro Fisico",
      taxRatePct: 12.5,
      taxRateLabel: "12.50% (White List) / 26% (Oro)",
      category: "REGIME_SPECIALE",
      lossCompensable: true,
      compensationRules: "Minusvalenze su Titoli di Stato imputabili al 48.08% (proporzione 12.5/26).",
      notes: "BTP, BOT, Bund e Treasury beneficiano dell'aliquota agevolata del 12.50%. Scudo ideale per la riserva.",
    },
  ],
  reportingDuties: [
    {
      code: "QUADRO RT",
      name: "Plusvalenze & Minusvalenze Finanziarie",
      obligation: "Dichiarazione delle plusvalenze realizzate e compensazione minusvalenze (broker esteri)",
      threshold: "Obbligatorio per qualsiasi plusvalenza realizzata in regime dichiarativo",
      penalties: "Sanzione ordinaria dal 90% al 180% della maggiore imposta dovuta",
    },
    {
      code: "QUADRO RW",
      name: "Monitoraggio Fiscale & Liquidazione IVAFE / Cripto",
      obligation: "Segnalazione delle attività finanziarie e conti detenuti all'estero (Interactive Brokers, FTMO, Exchange)",
      threshold: "Obbligo di monitoraggio attivo senza soglia minima di detenzione",
      penalties: "Sanzione fissa dal 3% al 15% degli importi non dichiarati (raddoppiata per paradisi fiscali)",
    },
    {
      code: "QUADRO RM",
      name: "Redditi di Capitale Esteri",
      obligation: "Tassazione separata su interessi e proventi esteri non trattenuti alla fonte",
      threshold: "Se percepiti senza applicazione di ritenuta a titolo d'imposta da intermediario residente",
      penalties: "Applicazione delle sanzioni per omessa o infedele dichiarazione",
    },
  ],
  propFirmDoctrine: {
    nature: "Contratti di Demo Trading / Fornitura Dati & Servizi (Bounty/Challenge)",
    options: [
      {
        title: "Regime Forfettario (Partita IVA)",
        regime: "Attività Professionale / Continuativa (Consigliato per payout regolari)",
        taxRate: "5% (primi 5 anni) oppure 15% (aliquota ordinaria)",
        description: "Codice ATECO 62.02.00 / 63.11.00 o 74.90.99. Coefficiente di redditività 67% o 78%.",
        inpsRate: "Gestione Separata INPS ~26% sul reddito imponibile netto",
        suitability: "Traders con payout > 5.000 €/anno o prelievi mensili stabili dalle Prop Firm.",
      },
      {
        title: "Redditi Diversi / Prestazione Occasionale",
        regime: "Attività Saltuaria Priva di Abitualità",
        taxRate: "Aliquota IRPEF a scaglioni (minimo 23%) o ritenuta d'acconto 20%",
        description: "Inquadrabile come obbligazione di fare/permettere (art. 67 c. 1 lett. l TUIR).",
        inpsRate: "Zero INPS se complessivamente sotto i 5.000 €/anno",
        suitability: "Traders all'esordio con payout sporadici ed estemporanei.",
      },
    ],
    crucialRules: [
      "DIVIETO DI COMPENSAZIONE: I compensi prop NON sono redditi finanziari e non possono compensare le minusvalenze CFD in Quadro RT.",
      "CONTRATTI DEMO: La stragrande maggioranza delle prop opera su conti demo con pagamenti qualificati come prestazione di servizi/bonus.",
      "TRACCIABILITÀ COMPLETA: Conservare per 10 anni le invoice/fatture di payout, i contratti di fornitura e i log di accredito bancario.",
    ],
  },
  taxDeadlines: [
    {
      period: "30 Giugno",
      description: "Versamento Saldo Imposte anno precedente + Primo Acconto (Modello F24)",
      forms: "F24 (Codici Tributo: 1100 per imposta sostitutiva, 4043 per IVAFE)",
    },
    {
      period: "30 Novembre",
      description: "Versamento Secondo o Unico Acconto per l'anno in corso (Modello F24)",
      forms: "F24 (Codici Tributo Acconto)",
    },
    {
      period: "T + 4 Anni",
      description: "Scadenza inderogabile per la compensazione delle minusvalenze fiscali accumulate",
      forms: "Verifica e utilizzo del cassetto fiscale / certificazione minusvalenze",
    },
  ],
};

export interface FinancialProfileInput {
  totalNetWorth: number; // Patrimonio totale complessivo (€)
  monthlyExpenses: number; // Spese mensili medie (€)
  liquidityMonthsCovered: number; // Numero di mesi spese da coprire (default: 6, range: 3-12)
  externalStableIncome: number; // Entrate mensili stabili esterne al trading (€)
  hasDependents: boolean; // Presenza di familiari/persone a carico
  taxCountry?: TaxCountry; // Paese di residenza fiscale (default: "IT")
  taxRegime?: TaxRegimeMode; // Regime fiscale broker primario (default: "DICHIARATIVO")
  showNetOfTax?: boolean; // Se mostrare le proiezioni al netto del drag fiscale
}

export interface PillarsAllocation {
  liquidityAllocation: number; // Quota spese correnti (monthlyExpenses * months)
  reserveAllocation: number; // Fondo di Emergenza e Cuscinetto di Recupero Trading
  tradingAllocation: number; // Capitale destinato al conto di Trading attivo
  investmentsAllocation: number; // Capitale destinato a posizionamenti passivi / lungo periodo
  futureProjectsAllocation: number; // Capitale destinato a progetti futuri / spese straordinarie
}

export interface PillarsAllocationPct {
  liquidityPct: number;
  reservePct: number;
  tradingPct: number;
  investmentsPct: number;
  futureProjectsPct: number;
}

export interface AccountStrategicConfig {
  accountObjective: AccountObjective;
  timeHorizonYears: number; // Orizzonte temporale in anni
  expectedMonthlyReturnPct: number; // Aspettativa di rendimento mensile medio (%)
  simulatedDrawdownPct: number; // Percentuale di passivo per lo stress test (default: 10%)
}

export interface FinancialProfile extends FinancialProfileInput, PillarsAllocation, AccountStrategicConfig {
  id?: string;
  userId?: string;
  isCompleted: boolean;
  validatedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  wealthSubAllocations?: WealthSubAllocations;
  monthlyPac?: number;
  targetNetWorth?: number;
}

export interface VitalLiquidityResult {
  liquidityRequired: number;
  liquidityAllocation: number;
  investableCapital: number;
  isSufficient: boolean;
  errorMessage: string | null;
}

export interface ReserveConstraintResult {
  reserveAllocation: number;
  tradingAllocation: number;
  maxAllowedTradingCapital: number;
  isValid: boolean;
  status: "VALID" | "CRITICAL_ERROR";
  errorMessage: string | null;
}

export interface PsychologicalPressureResult {
  tradingWeightPct: number;
  netWorthDrawdownImpactPct: number;
  simulatedDrawdownEuro: number;
  zone: PsychologicalZone;
  headline: string;
  feedback: string;
  badgeTone: "optimal" | "attention" | "critical";
}

export interface ExpectationEvaluationResult {
  level: ExpectationLevel;
  headline: string;
  feedback: string;
  expectedMonthlyProfitEuro: number;
  isWarning: boolean;
}

/**
 * Valori predefiniti iniziali per un profilo finanziario vuoto o nuovo utente.
 */
export const DEFAULT_FINANCIAL_PROFILE: FinancialProfile = {
  totalNetWorth: 50000,
  monthlyExpenses: 2000,
  liquidityMonthsCovered: 6,
  externalStableIncome: 2500,
  hasDependents: false,
  liquidityAllocation: 12000,
  reserveAllocation: 12000,
  tradingAllocation: 8000,
  investmentsAllocation: 12000,
  futureProjectsAllocation: 6000,
  accountObjective: "GROWTH",
  timeHorizonYears: 3,
  expectedMonthlyReturnPct: 3,
  simulatedDrawdownPct: 10,
  taxCountry: "IT",
  taxRegime: "DICHIARATIVO",
  showNetOfTax: true,
  isCompleted: false,
  validatedAt: null,
};

/**
 * Regola 1: Sottrazione Prioritaria della Liquidità Vitale
 * liquidityAllocation = monthlyExpenses * liquidityMonthsCovered
 * investableCapital = totalNetWorth - liquidityAllocation
 */
export function calculateVitalLiquidity(params: {
  totalNetWorth: number;
  monthlyExpenses: number;
  liquidityMonthsCovered: number;
}): VitalLiquidityResult {
  const netWorth = Math.max(0, Number(params.totalNetWorth) || 0);
  const expenses = Math.max(0, Number(params.monthlyExpenses) || 0);
  const months = Math.min(12, Math.max(3, Math.round(Number(params.liquidityMonthsCovered) || 6)));

  const liquidityRequired = expenses * months;
  const liquidityAllocation = Math.min(netWorth, liquidityRequired);
  const investableCapital = Math.max(0, netWorth - liquidityAllocation);
  const isSufficient = netWorth > liquidityRequired;

  return {
    liquidityRequired,
    liquidityAllocation,
    investableCapital,
    isSufficient,
    errorMessage: isSufficient
      ? null
      : "Patrimonio insufficiente: devi prima coprire il tuo fondo di liquidità per le spese correnti.",
  };
}

/**
 * Regola 2: Il Vincolo del Fondo di Riserva (Hard Rule del Metodo)
 * Il Fondo di Riserva deve essere almeno paritario (1:1) o superiore al Capitale di Trading:
 * reserveAllocation >= tradingAllocation
 */
export function checkReserveConstraint(params: {
  totalNetWorth: number;
  liquidityAllocation: number;
  reserveAllocation: number;
  tradingAllocation: number;
  investmentsAllocation?: number;
  futureProjectsAllocation?: number;
}): ReserveConstraintResult {
  const netWorth = Math.max(0, Number(params.totalNetWorth) || 0);
  const liquidity = Math.max(0, Number(params.liquidityAllocation) || 0);
  const investable = Math.max(0, netWorth - liquidity);
  const reserve = Math.max(0, Number(params.reserveAllocation) || 0);
  const trading = Math.max(0, Number(params.tradingAllocation) || 0);
  const investments = Math.max(0, Number(params.investmentsAllocation) || 0);
  const futureProjects = Math.max(0, Number(params.futureProjectsAllocation) || 0);

  // maxAllowedTradingCapital non può superare (investableCapital - investments - futureProjects) / 2
  const remainingForTradingAndReserve = Math.max(0, investable - investments - futureProjects);
  const maxAllowedTradingCapital = Math.floor(remainingForTradingAndReserve / 2);

  const isValid = reserve >= trading;

  return {
    reserveAllocation: reserve,
    tradingAllocation: trading,
    maxAllowedTradingCapital,
    isValid,
    status: isValid ? "VALID" : "CRITICAL_ERROR",
    errorMessage: isValid
      ? null
      : "Violazione Regola di Riserva: Il Fondo di Riserva deve essere almeno pari al Capitale di Trading.",
  };
}

/**
 * Regola 3: Indice di Pressione Psicologica ("Profilo Mario vs Profilo Luigi")
 * Calcola il peso del conto trading sul patrimonio totale e lo stress test di drawdown.
 */
export function calculatePsychologicalPressure(params: {
  totalNetWorth: number;
  reserveAllocation: number;
  tradingAllocation: number;
  externalStableIncome: number;
  monthlyExpenses: number;
  simulatedDrawdownPct?: number;
}): PsychologicalPressureResult {
  const netWorth = Math.max(0, Number(params.totalNetWorth) || 0);
  const reserve = Math.max(0, Number(params.reserveAllocation) || 0);
  const trading = Math.max(0, Number(params.tradingAllocation) || 0);
  const income = Math.max(0, Number(params.externalStableIncome) || 0);
  const expenses = Math.max(0, Number(params.monthlyExpenses) || 0);
  const ddPct = Math.max(1, Math.min(100, Number(params.simulatedDrawdownPct) || 10));

  const tradingWeightPct = netWorth > 0 ? (trading / netWorth) * 100 : 0;
  const simulatedDrawdownEuro = trading * (ddPct / 100);
  const netWorthDrawdownImpactPct = netWorth > 0 ? (simulatedDrawdownEuro / netWorth) * 100 : 0;

  // Classificazione in 3 Zone:
  // 3. ZONA CRITICA: reserveAllocation < tradingAllocation OR tradingWeightPct > 40%
  // 1. ZONA OTTIMALE: reserveAllocation >= tradingAllocation AND tradingWeightPct <= 20% AND externalStableIncome >= monthlyExpenses
  // 2. ZONA DI ATTENZIONE: reserveAllocation >= tradingAllocation MA (tradingWeightPct > 20% OR externalStableIncome < monthlyExpenses)

  if (reserve < trading || tradingWeightPct > 40) {
    return {
      tradingWeightPct,
      netWorthDrawdownImpactPct,
      simulatedDrawdownEuro,
      zone: "CRITICAL",
      headline: "ZONA CRITICA — Rischio Bruciatura / Sovraesposizione",
      feedback:
        "Situazione ad altissima pressione psicologica. Un drawdown del " +
        ddPct +
        "% intacca pesantemente il patrimonio vitale. Altissimo rischio di chiudere i trade in anticipo per paura ('prendere 100€ per fare benzina') e di scivolare in revenge trading e sovraesposizione durante le perdite.",
      badgeTone: "critical",
    };
  }

  if (tradingWeightPct <= 20 && income >= expenses) {
    return {
      tradingWeightPct,
      netWorthDrawdownImpactPct,
      simulatedDrawdownEuro,
      zone: "OPTIMAL",
      headline: "ZONA OTTIMALE — Stato di Tranquillità Operativa",
      feedback:
        "Impatto del -" +
        ddPct +
        "% sul conto di trading = solo -" +
        netWorthDrawdownImpactPct.toFixed(2) +
        "% sul patrimonio totale. Le spese correnti sono coperte dalle entrate stabili e la riserva è integra. Puoi lasciare correre i profitti, attendere la chiusura dei cicli e assorbire periodi negativi senza alcuna ansia o urgenza.",
      badgeTone: "optimal",
    };
  }

  return {
    tradingWeightPct,
    netWorthDrawdownImpactPct,
    simulatedDrawdownEuro,
    zone: "ATTENTION",
    headline: "ZONA DI ATTENZIONE — Pressione Moderata",
    feedback:
      "Struttura accettabile grazie alla riserva paritaria, ma " +
      (income < expenses && tradingWeightPct > 20
        ? `sia le entrate esterne inferiori alle spese correnti, sia il peso del conto trading (${tradingWeightPct.toFixed(1)}% > 20%)`
        : income < expenses
          ? "le entrate esterne inferiori alle spese correnti"
          : `il peso del conto trading (${tradingWeightPct.toFixed(1)}% > 20%)`) +
      " possono generare fretta di monetizzare i trade o pressione sui risultati mensili.",
    badgeTone: "attention",
  };
}

/**
 * Regola 4: Termometro delle Aspettative (Anti-Overrisking)
 */
export function evaluateExpectation(params: {
  expectedMonthlyReturnPct: number;
  tradingAllocation: number;
}): ExpectationEvaluationResult {
  const pct = Math.max(0, Number(params.expectedMonthlyReturnPct) || 0);
  const trading = Math.max(0, Number(params.tradingAllocation) || 0);
  const expectedMonthlyProfitEuro = trading * (pct / 100);

  if (pct <= 3.0) {
    return {
      level: "SUSTAINABLE",
      headline: "Sostenibile / Conservativo (≤ 3% mese)",
      feedback:
        "Approccio orientato alla protezione del capitale e alla costanza nel lungo termine. Compatibile con drawdown contenuti e tenuta emotiva ferrea.",
      expectedMonthlyProfitEuro,
      isWarning: false,
    };
  }

  if (pct <= 6.0) {
    return {
      level: "CHALLENGING",
      headline: "Sfidante (3.1% - 6% mese)",
      feedback:
        "Richiede alta precisione esecutiva, selezione chirurgica dei setup e tolleranza a oscillazioni di capitale moderate.",
      expectedMonthlyProfitEuro,
      isWarning: false,
    };
  }

  return {
    level: "AGGRESSIVE_DANGEROUS",
    headline: "Aggressivo / Pericoloso (> 6% mese)",
    feedback:
      "Attenzione: un target del " +
      pct.toFixed(1) +
      "% mensile fisso ti costringe ad assumere un rischio aggressivo sul mercato. Questo aumenta esponenzialmente il rischio di drawdown profondi, perdita del conto e pressione emotiva.",
    expectedMonthlyProfitEuro,
    isWarning: true,
  };
}

/**
 * Calcola la formula di Allocazione Ottimale AUREUS:
 * 1. Sottrae prioritariamente la liquidità vitale (spese mensili * mesi coperti).
 * 2. Distribuisce il restante capitale investibile garantendo:
 *    - reserveAllocation >= tradingAllocation
 *    - tradingAllocation <= 20% del patrimonio totale (o 15% con carichi familiari/deficit flussi)
 *    - investimenti lungo termine equilibrati (ca. 30-35% investibile)
 *    - progetti futuri / straordinari (residuo esatto)
 * 3. Garantisce che la somma dei 5 pilastri sia ESATTAMENTE pari a totalNetWorth.
 */
export function calculateOptimalLimenAllocation(input: FinancialProfileInput): PillarsAllocation {
  const total = Math.max(0, Math.round(Number(input.totalNetWorth) || 0));
  const expenses = Math.max(0, Math.round(Number(input.monthlyExpenses) || 0));
  const months = Math.min(12, Math.max(3, Math.round(Number(input.liquidityMonthsCovered) || 6)));
  const income = Math.max(0, Number(input.externalStableIncome) || 0);
  const hasDependents = Boolean(input.hasDependents);

  const liquidityRequired = expenses * months;
  const liquidityAllocation = Math.min(total, liquidityRequired);
  const investable = Math.max(0, total - liquidityAllocation);

  if (investable <= 0) {
    return {
      liquidityAllocation: total,
      reserveAllocation: 0,
      tradingAllocation: 0,
      investmentsAllocation: 0,
      futureProjectsAllocation: 0,
    };
  }

  // Se l'utente ha carichi familiari o entrate inferiori alle spese correnti, applichiamo una maggiore prudenza
  const isHighCaution = hasDependents || (income > 0 && income < expenses);

  // Cap trading:
  // Standard: max 20% del patrimonio e max 20% dell'investibile
  // High caution: max 15% del patrimonio e max 15% dell'investibile
  const tradingPctCap = isHighCaution ? 0.15 : 0.20;
  const maxTradingByNetWorth = Math.floor(total * tradingPctCap);
  const maxTradingByInvestable = Math.floor(investable * tradingPctCap);
  let trading = Math.max(0, Math.min(maxTradingByNetWorth, maxTradingByInvestable));

  // Fondo di Riserva:
  // Deve essere ALMENO pari al trading (vincolo 1:1)
  // Standard: ~30% dell'investibile
  // High caution: ~35% dell'investibile
  const reservePctTarget = isHighCaution ? 0.35 : 0.30;
  let reserve = Math.max(trading, Math.floor(investable * reservePctTarget));

  // Investimenti a lungo termine:
  // Standard: ~35% dell'investibile
  // High caution: ~30% dell'investibile
  const investmentsPctTarget = isHighCaution ? 0.30 : 0.35;
  let investments = Math.floor(investable * investmentsPctTarget);

  // Progetti futuri / straordinari: residuo esatto
  let futureProjects = investable - (reserve + trading + investments);

  // Se i progetti futuri risultano negativi (perché investibile è molto piccolo), ribilanciamo
  if (futureProjects < 0) {
    const half = Math.floor(investable / 2);
    trading = Math.floor(half / 2);
    reserve = trading;
    investments = Math.max(0, investable - reserve - trading);
    futureProjects = 0;
  }

  // Risoluzione finale del resto per garantire somma esatta == total
  const sumCurrent = liquidityAllocation + reserve + trading + investments + futureProjects;
  const diff = total - sumCurrent;
  futureProjects += diff;

  return {
    liquidityAllocation,
    reserveAllocation: reserve,
    tradingAllocation: trading,
    investmentsAllocation: investments,
    futureProjectsAllocation: futureProjects,
  };
}

/**
 * Calcola le percentuali relative sul patrimonio totale per i 5 pilastri.
 * La somma delle percentuali è normalizzata esattamente al 100% se totalNetWorth > 0.
 */
export function calculatePillarsPercentages(
  pillars: PillarsAllocation,
  totalNetWorth: number,
): PillarsAllocationPct {
  const total = Math.max(0, Number(totalNetWorth) || 0);
  if (total <= 0) {
    return {
      liquidityPct: 0,
      reservePct: 0,
      tradingPct: 0,
      investmentsPct: 0,
      futureProjectsPct: 0,
    };
  }

  const pLiquidity = (Math.max(0, pillars.liquidityAllocation) / total) * 100;
  const pReserve = (Math.max(0, pillars.reserveAllocation) / total) * 100;
  const pTrading = (Math.max(0, pillars.tradingAllocation) / total) * 100;
  const pInvestments = (Math.max(0, pillars.investmentsAllocation) / total) * 100;
  const pFuture = (Math.max(0, pillars.futureProjectsAllocation) / total) * 100;

  return {
    liquidityPct: Number(pLiquidity.toFixed(1)),
    reservePct: Number(pReserve.toFixed(1)),
    tradingPct: Number(pTrading.toFixed(1)),
    investmentsPct: Number(pInvestments.toFixed(1)),
    futureProjectsPct: Number(pFuture.toFixed(1)),
  };
}

/**
 * Validazione completa del FinancialProfile per lo sblocco operativo a mercato.
 */
export function validateFinancialProfile(profile: Partial<FinancialProfile>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  const total = Number(profile.totalNetWorth) || 0;
  if (total <= 0) {
    errors.push("Il Patrimonio Totale deve essere maggiore di zero.");
  }

  const expenses = Number(profile.monthlyExpenses) || 0;
  if (expenses < 0) {
    errors.push("Le spese mensili non possono essere negative.");
  }

  const liquidity = Number(profile.liquidityAllocation) || 0;
  const reserve = Number(profile.reserveAllocation) || 0;
  const trading = Number(profile.tradingAllocation) || 0;
  const investments = Number(profile.investmentsAllocation) || 0;
  const future = Number(profile.futureProjectsAllocation) || 0;

  if (liquidity < 0 || reserve < 0 || trading < 0 || investments < 0 || future < 0) {
    errors.push("Nessun pilastro di allocazione può avere valore negativo.");
  }

  const sumPillars = liquidity + reserve + trading + investments + future;
  // Tolleranza arrotondamento di 1€
  if (Math.abs(sumPillars - total) > 1) {
    errors.push(
      `La somma dei 5 pilastri (${sumPillars.toFixed(0)} €) deve corrispondere esattamente al Patrimonio Totale (${total.toFixed(0)} €).`,
    );
  }

  // Hard Rule 1:1
  if (trading > reserve) {
    errors.push(
      `Violazione Regola di Riserva: Il Fondo di Riserva (${reserve.toFixed(0)} €) deve essere almeno pari al Capitale di Trading (${trading.toFixed(0)} €).`,
    );
  }

  // Regola Liquidità Vitale
  const months = profile.liquidityMonthsCovered ?? 6;
  const requiredLiquidity = expenses * months;
  if (total <= requiredLiquidity && trading > 0) {
    errors.push(
      "Patrimonio insufficiente per avviare il trading: devi prima coprire il fondo di liquidità vitale.",
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * ─── MOTORE DI SIMULAZIONE MONTE CARLO PER L'ARCHITETTURA PATRIMONIALE ───
 */
export type TradingStyle = "SCALPING" | "DAY_TRADING" | "SWING_TRADING";

export interface MonteCarloSimulationInput {
  initialCapital: number;
  expectedMonthlyReturnPct: number;
  simulatedDrawdownPct: number;
  horizonMonths: number;
  accountObjective: AccountObjective;
  tradingStyle?: TradingStyle;
  winRatePct?: number; // Win Rate reale dell'operatore (es. 54.0%)
  riskRewardRatio?: number; // Rapporto Risk-to-Reward medio (es. 1.85 R)
  tradesPerMonth?: number; // Numero medio di operazioni mensili (es. 20)
  riskPerTradePct?: number; // Quota di rischio per singolo trade (es. 0.81% Half-Kelly)
  iterations?: number;
  seed?: number;
  samplePathCount?: number;
}

export interface HistogramBin {
  rangeLabel: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
  isStartingCapitalBin: boolean;
}

export interface MonthDetail {
  month: number;
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  medianDrawdownPct: number;
  worstDrawdownPct: number;
}

export interface MonteCarloSimulationResult {
  // Percentili di Equity nel tempo (lunghezza horizonMonths + 1)
  p5: number[];
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  p95: number[];

  // Traiettorie stocastiche di esempio
  samplePaths: number[][];
  sampleDrawdownPaths: number[][];

  // Curve di Drawdown Underwater nel tempo
  drawdownP50: number[];
  drawdownP90: number[];

  // Valori Terminali
  endP5: number;
  endP10: number;
  endP25: number;
  endP50: number;
  endP75: number;
  endP90: number;
  endP95: number;

  // Rendimenti Percentuali Terminali
  endP5GainPct: number;
  endP10GainPct: number;
  endP50GainPct: number;
  endP90GainPct: number;
  endP95GainPct: number;

  // Metriche di Rischio e Stress Istituzionali
  maxDrawdownMedianPct: number;
  maxDrawdownP95Pct: number;
  maxDrawdownEstimatedPct: number;
  monthlyVaR95Pct: number;
  monthlyCVaR95Pct: number;

  // Probabilità di Risultato
  probCapitalPreservedPct: number;
  probDoubleCapitalPct: number;
  probSevereDrawdownPct: number;
  riskOfRuinPct: number;

  // Distribuzione e Istogramma Terminale
  histogram: HistogramBin[];
  monthDetails: MonthDetail[];

  // Metadati di Esecuzione
  horizonMonths: number;
  iterations: number;
  tradingStyle: TradingStyle;
}

function mcMulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mcQuantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

/**
 * Esegue la simulazione Monte Carlo Trade-by-Trade ad Alta Fedeltà (AUREUS Dynamic Engine)
 * su N traiettorie stocastiche integrando Win Rate, Risk:Reward (R:R), frequenza operativa,
 * streak di vincite/perdite e code pesanti (Student-t).
 */
export function simulateMonteCarloEquity(
  input: MonteCarloSimulationInput,
): MonteCarloSimulationResult {
  const {
    initialCapital,
    expectedMonthlyReturnPct,
    simulatedDrawdownPct,
    horizonMonths,
    accountObjective,
    tradingStyle = "DAY_TRADING",
    winRatePct = 54.0,
    riskRewardRatio = 1.85,
    tradesPerMonth: customTradesPerMonth,
    riskPerTradePct: customRiskPerTradePct,
    iterations = 1000,
    seed = 20261018,
    samplePathCount = 14,
  } = input;

  const steps = Math.max(1, Math.min(60, horizonMonths));
  const flat = Array.from({ length: steps + 1 }, () => Math.max(0, initialCapital));
  const flatZero = Array.from({ length: steps + 1 }, () => 0);

  if (initialCapital <= 0) {
    return {
      p5: [...flat],
      p10: [...flat],
      p25: [...flat],
      p50: [...flat],
      p75: [...flat],
      p90: [...flat],
      p95: [...flat],
      samplePaths: [],
      sampleDrawdownPaths: [],
      drawdownP50: [...flatZero],
      drawdownP90: [...flatZero],
      endP5: 0,
      endP10: 0,
      endP25: 0,
      endP50: 0,
      endP75: 0,
      endP90: 0,
      endP95: 0,
      endP5GainPct: 0,
      endP10GainPct: 0,
      endP50GainPct: 0,
      endP90GainPct: 0,
      endP95GainPct: 0,
      maxDrawdownMedianPct: 0,
      maxDrawdownP95Pct: 0,
      maxDrawdownEstimatedPct: 0,
      monthlyVaR95Pct: 0,
      monthlyCVaR95Pct: 0,
      probCapitalPreservedPct: 0,
      probDoubleCapitalPct: 0,
      probSevereDrawdownPct: 0,
      riskOfRuinPct: 0,
      histogram: [],
      monthDetails: [],
      horizonMonths: steps,
      iterations,
      tradingStyle,
    };
  }

  const rng = mcMulberry32(seed);

  // Parametri di frequenza e rischio per trade in base allo stile se non specificati
  const defaultTrades = tradingStyle === "SCALPING" ? 35 : tradingStyle === "SWING_TRADING" ? 8 : 20;
  const tradesCount = Math.max(4, Math.min(80, customTradesPerMonth ?? defaultTrades));

  const defaultRisk = tradingStyle === "SCALPING" ? 0.5 : tradingStyle === "SWING_TRADING" ? 1.2 : 0.81;
  const riskFraction = Math.max(0.1, Math.min(3.0, customRiskPerTradePct ?? defaultRisk)) / 100;

  const winProb = Math.max(0.2, Math.min(0.85, winRatePct / 100));
  const rrPayoff = Math.max(0.8, Math.min(5.0, riskRewardRatio));

  // Matrici per colonne temporali (step da 0 a steps)
  const equityCols: number[][] = Array.from({ length: steps + 1 }, () => []);
  const ddCols: number[][] = Array.from({ length: steps + 1 }, () => []);

  const samplePaths: number[][] = [];
  const sampleDrawdownPaths: number[][] = [];
  const endValues: number[] = [];
  const maxDrawdowns: number[] = [];
  const allMonthlyReturns: number[] = [];

  let countDouble = 0;
  let countSevereDD = 0;
  let countRuin = 0;

  for (let s = 0; s < iterations; s++) {
    let cap = initialCapital;
    let peak = initialCapital;
    let maxDrawdownInSim = 0;
    let ruined = false;

    const path: number[] = [initialCapital];
    const ddPath: number[] = [0];
    equityCols[0].push(initialCapital);
    ddCols[0].push(0);

    for (let m = 1; m <= steps; m++) {
      const monthStartCap = cap;

      // Simulazione discreta Trade-by-Trade per il mese corrente
      for (let t = 0; t < tradesCount; t++) {
        if (cap <= 10) break; // Capitale esaurito

        const tradeRiskMoney = cap * riskFraction;
        const uWin = rng();

        if (uWin < winProb) {
          // WIN: Payoff proporzionale a Risk:Reward con dispersione organica (+/- 12%)
          const payoffDispersion = 1 + (rng() - 0.5) * 0.24;
          const gain = tradeRiskMoney * rrPayoff * payoffDispersion;
          cap += gain;
        } else {
          // LOSS: Stop loss eseguito con lieve slippage stocastico (0-6%)
          const slippage = 1 + rng() * 0.06;
          const loss = tradeRiskMoney * slippage;
          cap = Math.max(0, cap - loss);
        }

        // Tracking di Peak e Drawdown ad ogni singolo trade
        if (cap > peak) {
          peak = cap;
        }
        const intraDD = peak > 0 ? ((peak - cap) / peak) * 100 : 0;
        if (intraDD > maxDrawdownInSim) {
          maxDrawdownInSim = intraDD;
        }
      }

      // Shock macro occasionale di mercato (code Student-t con probabilità ~3% di spike)
      if (rng() < 0.03) {
        const macroShockPenalty = cap * (riskFraction * (2.0 + rng() * 2.0));
        cap = Math.max(0, cap - macroShockPenalty);
        if (peak > 0) {
          const ddAfterShock = ((peak - cap) / peak) * 100;
          if (ddAfterShock > maxDrawdownInSim) maxDrawdownInSim = ddAfterShock;
        }
      }

      const monthlyReturn = monthStartCap > 0 ? (cap - monthStartCap) / monthStartCap : 0;
      allMonthlyReturns.push(monthlyReturn);

      // Gestione regime di prelievo / cashflow sostenibile
      if (accountObjective !== "GROWTH" && cap > initialCapital) {
        const surplus = cap - initialCapital;
        // Prelievo sostenibile del 25% del surplus generato, 75% in compounding reale
        cap = initialCapital + surplus * 0.75;
      }

      const currentMonthDD = peak > 0 ? ((peak - cap) / peak) * 100 : 0;

      // Condizione di Rovina (<50% del capitale iniziale in qualsiasi momento)
      if (cap < initialCapital * 0.5) {
        ruined = true;
      }

      path.push(Math.round(cap));
      ddPath.push(Math.round(currentMonthDD * 10) / 10);
      equityCols[m].push(cap);
      ddCols[m].push(currentMonthDD);
    }

    if (maxDrawdownInSim >= 20) countSevereDD++;
    if (ruined) countRuin++;
    if (cap >= initialCapital * 2) countDouble++;

    endValues.push(cap);
    maxDrawdowns.push(maxDrawdownInSim);

    if (s < samplePathCount) {
      samplePaths.push(path);
      sampleDrawdownPaths.push(ddPath);
    }
  }

  // Calcolo Percentili Equity e Drawdown per ogni mese
  const p5: number[] = [];
  const p10: number[] = [];
  const p25: number[] = [];
  const p50: number[] = [];
  const p75: number[] = [];
  const p90: number[] = [];
  const p95: number[] = [];

  const drawdownP50: number[] = [];
  const drawdownP90: number[] = [];
  const monthDetails: MonthDetail[] = [];

  for (let m = 0; m <= steps; m++) {
    const sortedEq = [...equityCols[m]].sort((a, b) => a - b);
    const sortedDD = [...ddCols[m]].sort((a, b) => a - b);

    const v5 = Math.round(mcQuantile(sortedEq, 0.05));
    const v10 = Math.round(mcQuantile(sortedEq, 0.1));
    const v25 = Math.round(mcQuantile(sortedEq, 0.25));
    const v50 = Math.round(mcQuantile(sortedEq, 0.5));
    const v75 = Math.round(mcQuantile(sortedEq, 0.75));
    const v90 = Math.round(mcQuantile(sortedEq, 0.9));
    const v95 = Math.round(mcQuantile(sortedEq, 0.95));

    const dd50 = Math.round(mcQuantile(sortedDD, 0.5) * 10) / 10;
    const dd90 = Math.round(mcQuantile(sortedDD, 0.9) * 10) / 10;
    const ddMax = Math.round(Math.max(...sortedDD) * 10) / 10;

    p5.push(v5);
    p10.push(v10);
    p25.push(v25);
    p50.push(v50);
    p75.push(v75);
    p90.push(v90);
    p95.push(v95);

    drawdownP50.push(dd50);
    drawdownP90.push(dd90);

    monthDetails.push({
      month: m,
      p5: v5,
      p10: v10,
      p25: v25,
      p50: v50,
      p75: v75,
      p90: v90,
      p95: v95,
      medianDrawdownPct: dd50,
      worstDrawdownPct: ddMax,
    });
  }

  // Valori finali
  const endP5 = p5[steps] ?? initialCapital;
  const endP10 = p10[steps] ?? initialCapital;
  const endP25 = p25[steps] ?? initialCapital;
  const endP50 = p50[steps] ?? initialCapital;
  const endP75 = p75[steps] ?? initialCapital;
  const endP90 = p90[steps] ?? initialCapital;
  const endP95 = p95[steps] ?? initialCapital;

  const endP5GainPct = Math.round(((endP5 - initialCapital) / initialCapital) * 1000) / 10;
  const endP10GainPct = Math.round(((endP10 - initialCapital) / initialCapital) * 1000) / 10;
  const endP50GainPct = Math.round(((endP50 - initialCapital) / initialCapital) * 1000) / 10;
  const endP90GainPct = Math.round(((endP90 - initialCapital) / initialCapital) * 1000) / 10;
  const endP95GainPct = Math.round(((endP95 - initialCapital) / initialCapital) * 1000) / 10;

  // Analisi Statistica dei Drawdown
  const sortedMaxDD = [...maxDrawdowns].sort((a, b) => a - b);
  const maxDrawdownMedianPct = Math.round(mcQuantile(sortedMaxDD, 0.5) * 10) / 10;
  const maxDrawdownP95Pct = Math.round(mcQuantile(sortedMaxDD, 0.95) * 10) / 10;
  const maxDrawdownEstimatedPct = Math.round(sortedMaxDD[sortedMaxDD.length - 1] * 10) / 10;

  // Value at Risk (VaR 95%) e Conditional VaR (Expected Shortfall) sui rendimenti mensili
  const sortedReturns = [...allMonthlyReturns].sort((a, b) => a - b);
  const var95Threshold = mcQuantile(sortedReturns, 0.05);
  const monthlyVaR95Pct = Math.round(Math.abs(Math.min(0, var95Threshold)) * 1000) / 10;

  const tailLosses = sortedReturns.filter((r) => r <= var95Threshold);
  const cvar95Mean =
    tailLosses.length > 0 ? tailLosses.reduce((sum, v) => sum + v, 0) / tailLosses.length : var95Threshold;
  const monthlyCVaR95Pct = Math.round(Math.abs(Math.min(0, cvar95Mean)) * 1000) / 10;

  // Probabilità di esito
  const countPreserved = endValues.filter((v) => v >= initialCapital).length;
  const probCapitalPreservedPct = Math.round((countPreserved / iterations) * 100);
  const probDoubleCapitalPct = Math.round((countDouble / iterations) * 100);
  const probSevereDrawdownPct = Math.round((countSevereDD / iterations) * 100);
  const riskOfRuinPct = Math.round((countRuin / iterations) * 1000) / 10;

  // Costruzione Istogramma Terminale a 10 Bins
  const minEnd = Math.min(...endValues);
  const maxEnd = Math.max(...endValues);
  const binStep = Math.max(1, (maxEnd - minEnd) / 10);
  const histogram: HistogramBin[] = [];

  for (let b = 0; b < 10; b++) {
    const bMin = minEnd + b * binStep;
    const bMax = b === 9 ? maxEnd + 1 : bMin + binStep;
    const count = endValues.filter((v) => v >= bMin && v < bMax).length;
    const pct = Math.round((count / iterations) * 1000) / 10;
    const isStarting = initialCapital >= bMin && initialCapital < bMax;

    histogram.push({
      rangeLabel: `${Math.round(bMin / 1000)}k–${Math.round(bMax / 1000)}k`,
      min: Math.round(bMin),
      max: Math.round(bMax),
      count,
      percentage: pct,
      isStartingCapitalBin: isStarting,
    });
  }

  return {
    p5,
    p10,
    p25,
    p50,
    p75,
    p90,
    p95,
    samplePaths,
    sampleDrawdownPaths,
    drawdownP50,
    drawdownP90,
    endP5,
    endP10,
    endP25,
    endP50,
    endP75,
    endP90,
    endP95,
    endP5GainPct,
    endP10GainPct,
    endP50GainPct,
    endP90GainPct,
    endP95GainPct,
    maxDrawdownMedianPct,
    maxDrawdownP95Pct,
    maxDrawdownEstimatedPct,
    monthlyVaR95Pct,
    monthlyCVaR95Pct,
    probCapitalPreservedPct,
    probDoubleCapitalPct,
    probSevereDrawdownPct,
    riskOfRuinPct,
    histogram,
    monthDetails,
    horizonMonths: steps,
    iterations,
    tradingStyle,
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
 * PIANIFICAZIONE PATRIMONIALE A LUNGO TERMINE (AZIONI, ETF, DIVIDENDI, CRYPTO, HEDGING)
 * ───────────────────────────────────────────────────────────────────────────── */

export interface WealthSubAllocations {
  equityAllocation: number; // Quota Azioni & ETF (Core Compounding a lungo termine)
  dividendsAllocation: number; // Quota Titoli & ETF da Dividendo (Flusso di Cassa / Rendita)
  cryptoAllocation: number; // Quota Riserva Crittografica Sovrana (Bitcoin & Alpha Asimmetrico)
  hedgingAllocation: number; // Quota Copertura del Capitale & Oro Rifugio (Capital Hedging)
  cryptoStakingPct?: number; // Quota crypto in staking remunerato (default: 50%)
  cryptoStakingYieldPct?: number; // Rendimento annuo stimato staking PoS (default: 4.5% a.a.)
}

export interface WealthSimulationParams {
  timeHorizonYears: number; // Orizzonte temporale in anni (1, 3, 5, 10, 20)
  monthlySavingsCapacity?: number; // Capacità di risparmio mensile / PAC (€/mese)
  targetNetWorth?: number; // Target di Indipendenza Finanziaria (es. 500.000 €)
  monthlyLivingExpenses?: number; // Spese mensili di vita per il calcolo del Crossover (€/mese)
  equityReturnRatePct?: number; // Rendimento annuo atteso azioni/ETF (default: 8.0%)
  dividendsYieldRatePct?: number; // Yield da dividendo annuo medio (default: 4.5%)
  cryptoReturnRatePct?: number; // Rendimento annuo composto crypto (default: 15.0%)
  hedgingReturnRatePct?: number; // Tasso preservazione capitale/oro (default: 3.0%)
  tradingAnnualReturnRatePct?: number; // Rendimento annuo stimato trading (default: 12.0%)
  reinvestDividends?: boolean; // Se reinvestire i dividendi (compounding) o considerarli cassa (default: true)
  cryptoStakingPct?: number; // Quota crypto allocata a staking PoS/Liquid (default: 50%)
  cryptoStakingYieldPct?: number; // Yield stimato staking PoS (default: 4.5%)
  taxCountry?: TaxCountry; // Paese di residenza fiscale (default: "IT")
  taxRegime?: TaxRegimeMode; // Regime primario (default: "DICHIARATIVO")
  showNetOfTax?: boolean; // Se applicare la detrazione del drag fiscale (default: true)
}

export interface WealthProjectionPoint {
  year: number; // Anno di riferimento o frazione di anno
  stepLabel: string; // "Oggi", "M1", "M6", "S1", "1A", etc.
  stepTimeYears: number; // Tempo trascorso in anni decimali
  baseCapital: number;
  cumulativeInvested: number; // Capitale Iniziale + Totale Versamenti PAC cumulati fino a questo step
  totalProjectedNetWorth: number; // Traiettoria Mediana attesa P50 (Lordo o Netto a seconda di showNetOfTax)
  grossProjectedNetWorth: number; // Traiettoria Lorda Nominale
  taxDragEuro: number; // Drag Fiscale cumulato (€ sottratti da bollo 0.20% + imposte 26%/12.5%)
  p10NetWorth: number; // Fascia Monte Carlo Bear (10° percentile)
  p50NetWorth: number; // Traiettoria Mediana Monte Carlo (50° percentile)
  p90NetWorth: number; // Fascia Monte Carlo Bull (90° percentile)
  equityProjected: number;
  dividendsProjected: number;
  cryptoProjected: number;
  hedgingProjected: number;
  tradingProjected: number;
  reserveCapital: number;
  vitalLiquidityCapital: number;
  annualDividendCashflow: number;
  monthlyDividendCashflow: number;
  annualCryptoStakingCashflow: number;
  monthlyCryptoStakingCashflow: number;
  totalAnnualPassiveCashflow: number; // Dividendi + Staking
  totalMonthlyPassiveCashflow: number; // Dividendi + Staking
  isCrossoverReached: boolean; // Se la rendita passiva totale copre o supera le spese mensili
  isTargetReached: boolean; // Se il NetWorth raggiunge o supera il target
}

export interface SystemicStressTestResult {
  stressedTotalNetWorth: number;
  netWorthImpactEuro: number;
  netWorthImpactPct: number;
  equityImpactEuro: number;
  cryptoImpactEuro: number;
  tradingImpactEuro: number;
  hedgingImpactEuro: number;
  reserveImpactEuro: number;
  survivalShieldScore: number; // Indice da 0 a 100 della protezione del capitale
}

export type StrategyPreset = "DEFENSIVE" | "BALANCED_LIMEN" | "AGGRESSIVE_GROWTH" | "HYBRID_PROP";

export interface AdvisorHealthEvaluation {
  score: number; // 0 - 100
  grade: "SOVRANO (A+)" | "SOLIDO (A)" | "EQUILIBRATO (B)" | "ATTENZIONE (C)";
  savingsRatePct: number;
  crossoverYear: number | null; // Anno esatto in cui i dividendi superano le spese
  targetReachedYear: number | null; // Anno in cui il Net Worth supera il target
  crossoverHeadline: string;
  shieldScore: number;
  recommendations: string[];
}

export interface WealthProjectionResult {
  trajectory: WealthProjectionPoint[];
  endProjectedNetWorth: number;
  grossProjectedNetWorth: number;
  taxDragEuro: number;
  taxDragPct: number;
  isNetOfTaxApplied: boolean;
  estimatedStampDutyTotalEuro: number;
  estimatedCapitalGainTaxEuro: number;
  effectiveGrossCagrPct: number;
  endP10NetWorth: number;
  endP90NetWorth: number;
  totalGainEuro: number;
  totalGainPct: number;
  annualDividendCashflowEnd: number;
  monthlyDividendCashflowEnd: number;
  annualCryptoStakingCashflowEnd: number;
  monthlyCryptoStakingCashflowEnd: number;
  totalAnnualPassiveCashflowEnd: number;
  totalMonthlyPassiveCashflowEnd: number;
  effectiveCagrPct: number;
  cumulativeInvestedEnd: number;
  totalPacContributedEnd: number;
  crossoverYear: number | null;
  targetReachedYear: number | null;
  stepCount: number;
  stepIntervalType: "MONTHLY" | "SEMIANNUAL" | "ANNUAL";
  systemicStressTest: SystemicStressTestResult;
  advisorEvaluation: AdvisorHealthEvaluation;
}

export const DEFAULT_WEALTH_SUB_ALLOCATIONS: WealthSubAllocations = {
  equityAllocation: 7000,
  dividendsAllocation: 3500,
  cryptoAllocation: 1400,
  hedgingAllocation: 2100,
  cryptoStakingPct: 50,
  cryptoStakingYieldPct: 4.5,
};

export const DEFAULT_WEALTH_RATES = {
  equityReturnRatePct: 13.5,
  dividendsYieldRatePct: 9.8,
  cryptoReturnRatePct: 28.5,
  hedgingReturnRatePct: 9.2,
  tradingAnnualReturnRatePct: 36.0,
  cryptoStakingYieldPct: 5.6,
};

export * from "./financialBenchmarks";
export * from "./financialTimingEngine";

/**
 * Applica uno dei 3 Preset Strategici Istituzionali AUREUS al capitale investibile
 */
export function applyStrategyPreset(
  preset: StrategyPreset,
  investmentsCapital: number,
): WealthSubAllocations {
  const cap = Math.max(0, investmentsCapital);
  if (cap === 0) {
    return {
      equityAllocation: 0,
      dividendsAllocation: 0,
      cryptoAllocation: 0,
      hedgingAllocation: 0,
    };
  }

  if (preset === "DEFENSIVE") {
    // Preservazione & Scudo: 30% Equity, 35% Dividendi, 25% Oro/Copertura, 10% Crypto
    const eq = Math.round(cap * 0.30);
    const div = Math.round(cap * 0.35);
    const cry = Math.round(cap * 0.10);
    const hed = Math.max(0, cap - (eq + div + cry));
    return { equityAllocation: eq, dividendsAllocation: div, cryptoAllocation: cry, hedgingAllocation: hed };
  }

  if (preset === "AGGRESSIVE_GROWTH") {
    // Espansione Composta: 60% Equity, 18% Dividendi, 14% Crypto (entro guardrail), 8% Oro
    const eq = Math.round(cap * 0.60);
    const div = Math.round(cap * 0.18);
    const cry = Math.round(cap * 0.14);
    const hed = Math.max(0, cap - (eq + div + cry));
    return { equityAllocation: eq, dividendsAllocation: div, cryptoAllocation: cry, hedgingAllocation: hed };
  }

  if (preset === "HYBRID_PROP") {
    // Pipeline Ibrida Prop-to-Wealth: 50% Equity ad accumulo, 30% Dividendi aristocratici, 12% Copertura Oro, 8% Crypto
    const eq = Math.round(cap * 0.50);
    const div = Math.round(cap * 0.30);
    const cry = Math.round(cap * 0.08);
    const hed = Math.max(0, cap - (eq + div + cry));
    return { equityAllocation: eq, dividendsAllocation: div, cryptoAllocation: cry, hedgingAllocation: hed };
  }

  // BALANCED_LIMEN (Default aureo)
  return calculateOptimalWealthSubAllocations(cap);
}

/**
 * Calcola l'allocazione ottimale dei 4 motori di investimento (Azioni, Dividendi, Crypto, Copertura)
 * a partire dal capitale totale investibile a lungo termine.
 */
export function calculateOptimalWealthSubAllocations(investmentsCapital: number): WealthSubAllocations {
  const cap = Math.max(0, investmentsCapital);
  if (cap === 0) {
    return {
      equityAllocation: 0,
      dividendsAllocation: 0,
      cryptoAllocation: 0,
      hedgingAllocation: 0,
    };
  }

  // Pesi Istituzionali AUREUS:
  // 50% Core Equity & ETF (Compounding globale)
  // 25% Dividendi & Cashflow
  // 10% Riserva Crittografica (Asymmetric Alpha, rigidamente <= 10-15%)
  // 15% Copertura Capitale & Oro (Hedging anti-inflazione e anti-shock)
  const equity = Math.round(cap * 0.5);
  const dividends = Math.round(cap * 0.25);
  const crypto = Math.round(cap * 0.1);
  const hedging = Math.max(0, cap - (equity + dividends + crypto));

  return {
    equityAllocation: equity,
    dividendsAllocation: dividends,
    cryptoAllocation: crypto,
    hedgingAllocation: hedging,
  };
}

/**
 * Calcola le proiezioni multi-asse temporale per l'architettura patrimoniale completa,
 * integrando il piano di accumulo mensile (PAC / DCA) e la diagnosi dell'advisor.
 */
export function calculateWealthProjections(args: {
  liquidityAllocation: number;
  reserveAllocation: number;
  tradingAllocation: number;
  subAllocations: WealthSubAllocations;
  params: WealthSimulationParams;
}): WealthProjectionResult {
  const {
    liquidityAllocation,
    reserveAllocation,
    tradingAllocation,
    subAllocations,
    params,
  } = args;

  const horizonYears = Math.max(1, Math.min(30, Math.round(params.timeHorizonYears || 5)));
  const monthlyPAC = Math.max(0, Math.round(params.monthlySavingsCapacity || 0));
  const targetNW = Math.max(0, Math.round(params.targetNetWorth || 500000));
  const monthlyExpenses = Math.max(500, Math.round(params.monthlyLivingExpenses || 2000));

  const rEquity = (params.equityReturnRatePct ?? DEFAULT_WEALTH_RATES.equityReturnRatePct) / 100;
  const yDiv = (params.dividendsYieldRatePct ?? DEFAULT_WEALTH_RATES.dividendsYieldRatePct) / 100;
  const rCrypto = (params.cryptoReturnRatePct ?? DEFAULT_WEALTH_RATES.cryptoReturnRatePct) / 100;
  const rHedge = (params.hedgingReturnRatePct ?? DEFAULT_WEALTH_RATES.hedgingReturnRatePct) / 100;
  const rTrade = (params.tradingAnnualReturnRatePct ?? DEFAULT_WEALTH_RATES.tradingAnnualReturnRatePct) / 100;
  const reinvestDiv = params.reinvestDividends ?? true;

  const eq0 = Math.max(0, subAllocations.equityAllocation);
  const div0 = Math.max(0, subAllocations.dividendsAllocation);
  const cry0 = Math.max(0, subAllocations.cryptoAllocation);
  const hed0 = Math.max(0, subAllocations.hedgingAllocation);
  const tra0 = Math.max(0, tradingAllocation);
  const res0 = Math.max(0, reserveAllocation);
  const liq0 = Math.max(0, liquidityAllocation);

  const initialNetWorth = liq0 + res0 + tra0 + eq0 + div0 + cry0 + hed0;
  const invTotal = eq0 + div0 + cry0 + hed0;

  // Ripartizione proporzionale del PAC mensile sui 4 motori di investimento
  const pacEquity = invTotal > 0 ? (eq0 / invTotal) * monthlyPAC : monthlyPAC * 0.5;
  const pacDiv = invTotal > 0 ? (div0 / invTotal) * monthlyPAC : monthlyPAC * 0.25;
  const pacCrypto = invTotal > 0 ? (cry0 / invTotal) * monthlyPAC : monthlyPAC * 0.1;
  const pacHedge = Math.max(0, monthlyPAC - (pacEquity + pacDiv + pacCrypto));

  // Funzione attuariale per calcolare montante con versamenti mensili costanti
  const calcFV = (p0: number, r: number, pmtMonthly: number, years: number) => {
    if (years <= 0) return p0;
    const m = years * 12;
    const i = r / 12;
    if (i <= 0) return p0 + pmtMonthly * m;
    const compoundP0 = p0 * Math.pow(1 + i, m);
    const annuity = pmtMonthly * ((Math.pow(1 + i, m) - 1) / i);
    return compoundP0 + annuity;
  };

  // Definizione degli step e della risoluzione temporale adattiva
  let stepIntervalType: "MONTHLY" | "SEMIANNUAL" | "ANNUAL" = "ANNUAL";
  const stepDefinitions: Array<{ tYears: number; label: string }> = [];

  if (horizonYears === 1) {
    stepIntervalType = "MONTHLY";
    for (let m = 0; m <= 12; m++) {
      stepDefinitions.push({
        tYears: m / 12,
        label: m === 0 ? "Oggi" : `M${m}`,
      });
    }
  } else if (horizonYears === 3) {
    stepIntervalType = "SEMIANNUAL";
    for (let s = 0; s <= 6; s++) {
      const t = s * 0.5;
      stepDefinitions.push({
        tYears: t,
        label: s === 0 ? "Oggi" : s % 2 === 0 ? `${t}A` : `${s * 6}M`,
      });
    }
  } else if (horizonYears === 5) {
    stepIntervalType = "SEMIANNUAL";
    for (let s = 0; s <= 10; s++) {
      const t = s * 0.5;
      stepDefinitions.push({
        tYears: t,
        label: s === 0 ? "Oggi" : s % 2 === 0 ? `${t}A` : `S${s}`,
      });
    }
  } else {
    stepIntervalType = "ANNUAL";
    for (let y = 0; y <= horizonYears; y++) {
      stepDefinitions.push({
        tYears: y,
        label: y === 0 ? "Oggi" : `${y}A`,
      });
    }
  }

  const stakingPct = (params.cryptoStakingPct ?? subAllocations.cryptoStakingPct ?? 50) / 100;
  const stakingYield = (params.cryptoStakingYieldPct ?? subAllocations.cryptoStakingYieldPct ?? 4.5) / 100;

  // Stima della volatilità ponderata di portafoglio per il corridoio Monte Carlo
  // Equity: 16%, Div: 12%, Crypto: 55%, Oro: 12%, Trading: 18%
  const totalRiskAssets = invTotal + tra0 || 1;
  const wEq = eq0 / totalRiskAssets;
  const wDiv = div0 / totalRiskAssets;
  const wCry = cry0 / totalRiskAssets;
  const wHed = hed0 / totalRiskAssets;
  const wTra = tra0 / totalRiskAssets;
  const portfolioVol = Math.sqrt(
    Math.pow(wEq * 0.16, 2) +
    Math.pow(wDiv * 0.12, 2) +
    Math.pow(wCry * 0.55, 2) +
    Math.pow(wHed * 0.12, 2) +
    Math.pow(wTra * 0.18, 2) +
    2 * (wEq * 0.16) * (wDiv * 0.12) * 0.7 - // correlazione equity/dividendi
    2 * (wEq * 0.16) * (wHed * 0.12) * 0.2 // decorrelazione oro/equity
  );
  const sigmaP = Math.min(0.35, Math.max(0.08, portfolioVol));

  const trajectory: WealthProjectionPoint[] = [];
  let crossoverYear: number | null = null;
  let targetReachedYear: number | null = null;

  const isNetOfTaxApplied = params.showNetOfTax !== false; // default to true (prudential stoic Limen approach)

  // Calibrazione dei tassi al netto della disciplina erariale italiana (Drag Fiscale)
  // 1. Imposta di bollo sul dossier titoli e IVAFE: 0.20% (0.002) annuo (applicata solo a titoli e crypto)
  // 2. Imposta sostitutiva su capital gain, trading e crypto: 26%
  // 3. Aliquota agevolata White List su titoli di stato (hedging): 12.5%
  // 4. Dividendi: tassazione al 26%
  const stampDutyRate = 0.002;
  const rEquityNet = Math.max(0, rEquity * 0.74 - stampDutyRate);
  const yDivNet = Math.max(0, yDiv * 0.74 - stampDutyRate);
  const rCryptoNet = Math.max(0, rCrypto * 0.74 - stampDutyRate);
  const rHedgeNet = Math.max(0, rHedge * 0.875 - stampDutyRate);
  const rTradeNet = Math.max(0, rTrade * 0.74); // 26% tassazione redditi diversi da trading
  const stakingYieldNet = Math.max(0, stakingYield * 0.74);

  let finalGrossNW = initialNetWorth;
  let finalNetNW = initialNetWorth;

  for (const step of stepDefinitions) {
    const t = step.tYears;
    
    // Modulazione organica dei cicli di mercato (Alti e bassi storici: espansione e ritracciamento)
    const marketCycleWave = t > 0 ? Math.sin(t * 2.1) * 0.038 - Math.cos(t * 3.7) * 0.018 : 0;
    
    // 1. Calcolo Lordo Nominale
    const eqValGross = calcFV(eq0, rEquity, pacEquity, t) * (1 + marketCycleWave);
    const divValGross = reinvestDiv ? calcFV(div0, yDiv, pacDiv, t) : div0 + pacDiv * t * 12;
    const cryValGross = calcFV(cry0, rCrypto, pacCrypto, t) * (1 + marketCycleWave * 1.5);
    const hedValGross = calcFV(hed0, rHedge, pacHedge, t);
    const traValGross = tra0 * Math.pow(1 + rTrade, t) * (1 + marketCycleWave * 0.8);
    const resVal = res0;
    const liqVal = liq0;

    const currentDivStockGross = reinvestDiv ? divValGross : div0 + pacDiv * t * 12;
    const annualDivCashflowGross = currentDivStockGross * yDiv;
    const monthlyDivCashflowGross = annualDivCashflowGross / 12;
    const annualStakingCashflowGross = cryValGross * stakingPct * stakingYield;
    const monthlyStakingCashflowGross = annualStakingCashflowGross / 12;

    const totalAnnualPassiveGross = annualDivCashflowGross + annualStakingCashflowGross;
    const totalMonthlyPassiveGross = monthlyDivCashflowGross + monthlyStakingCashflowGross;
    const totalNWGross = eqValGross + divValGross + cryValGross + hedValGross + traValGross + resVal + liqVal;

    // 2. Calcolo Netto Fiscale Reale (Post-Tax)
    const eqValNet = calcFV(eq0, rEquityNet, pacEquity, t) * (1 + marketCycleWave);
    const divValNet = reinvestDiv ? calcFV(div0, yDivNet, pacDiv, t) : div0 + pacDiv * t * 12;
    const cryValNet = calcFV(cry0, rCryptoNet, pacCrypto, t) * (1 + marketCycleWave * 1.5);
    const hedValNet = calcFV(hed0, rHedgeNet, pacHedge, t);
    const traValNet = tra0 * Math.pow(1 + rTradeNet, t) * (1 + marketCycleWave * 0.8);

    const currentDivStockNet = reinvestDiv ? divValNet : div0 + pacDiv * t * 12;
    const annualDivCashflowNet = currentDivStockNet * (yDiv * 0.74);
    const monthlyDivCashflowNet = annualDivCashflowNet / 12;
    const annualStakingCashflowNet = cryValNet * stakingPct * stakingYieldNet;
    const monthlyStakingCashflowNet = annualStakingCashflowNet / 12;

    const totalAnnualPassiveNet = annualDivCashflowNet + annualStakingCashflowNet;
    const totalMonthlyPassiveNet = monthlyDivCashflowNet + monthlyStakingCashflowNet;
    const totalNWNet = eqValNet + divValNet + cryValNet + hedValNet + traValNet + resVal + liqVal;

    const cumulativeInvested = initialNetWorth + t * 12 * monthlyPAC;
    const stepTaxDrag = Math.max(0, totalNWGross - totalNWNet);

    // Selezione dei valori in base all'impostazione isNetOfTaxApplied
    const activeTotalNW = isNetOfTaxApplied ? totalNWNet : totalNWGross;
    const activeEqVal = isNetOfTaxApplied ? eqValNet : eqValGross;
    const activeDivVal = isNetOfTaxApplied ? divValNet : divValGross;
    const activeCryVal = isNetOfTaxApplied ? cryValNet : cryValGross;
    const activeHedVal = isNetOfTaxApplied ? hedValNet : hedValGross;
    const activeTraVal = isNetOfTaxApplied ? traValNet : traValGross;
    const activeAnnualDivCashflow = isNetOfTaxApplied ? annualDivCashflowNet : annualDivCashflowGross;
    const activeMonthlyDivCashflow = isNetOfTaxApplied ? monthlyDivCashflowNet : monthlyDivCashflowGross;
    const activeAnnualStakingCashflow = isNetOfTaxApplied ? annualStakingCashflowNet : annualStakingCashflowGross;
    const activeMonthlyStakingCashflow = isNetOfTaxApplied ? monthlyStakingCashflowNet : monthlyStakingCashflowGross;
    const activeTotalAnnualPassive = isNetOfTaxApplied ? totalAnnualPassiveNet : totalAnnualPassiveGross;
    const activeTotalMonthlyPassive = isNetOfTaxApplied ? totalMonthlyPassiveNet : totalMonthlyPassiveGross;

    if (t === horizonYears || step === stepDefinitions[stepDefinitions.length - 1]) {
      finalGrossNW = totalNWGross;
      finalNetNW = totalNWNet;
    }

    // Monte Carlo non-lineare basato su code di distribuzione log-normale
    let p10 = activeTotalNW;
    let p90 = activeTotalNW;
    if (t > 0) {
      const sigmaT = sigmaP * Math.sqrt(t);
      const riskCapital = Math.max(0, activeTotalNW - (resVal + liqVal));
      const safeCapital = resVal + liqVal;

      const bearFactor = Math.exp(-1.282 * sigmaT - 0.5 * Math.pow(sigmaP, 2) * t);
      const bullFactor = Math.exp(+1.282 * sigmaT - 0.5 * Math.pow(sigmaP, 2) * t);

      p10 = Math.max(Math.round(cumulativeInvested * 0.75), Math.round(safeCapital + riskCapital * bearFactor));
      p90 = Math.round(safeCapital + riskCapital * bullFactor);
    }

    const isCrossover = activeTotalMonthlyPassive >= monthlyExpenses;
    const isTarget = activeTotalNW >= targetNW;

    if (isCrossover && crossoverYear === null && t > 0) {
      crossoverYear = Math.max(1, Math.round(t * 10) / 10);
    }
    if (isTarget && targetReachedYear === null && t > 0) {
      targetReachedYear = Math.max(1, Math.round(t * 10) / 10);
    }

    trajectory.push({
      year: Math.round(t * 100) / 100,
      stepLabel: step.label,
      stepTimeYears: t,
      baseCapital: initialNetWorth,
      cumulativeInvested: Math.round(cumulativeInvested),
      totalProjectedNetWorth: Math.round(activeTotalNW),
      grossProjectedNetWorth: Math.round(totalNWGross),
      taxDragEuro: Math.round(stepTaxDrag),
      p10NetWorth: Math.round(p10),
      p50NetWorth: Math.round(activeTotalNW),
      p90NetWorth: Math.round(p90),
      equityProjected: Math.round(activeEqVal),
      dividendsProjected: Math.round(activeDivVal),
      cryptoProjected: Math.round(activeCryVal),
      hedgingProjected: Math.round(activeHedVal),
      tradingProjected: Math.round(activeTraVal),
      reserveCapital: Math.round(resVal),
      vitalLiquidityCapital: Math.round(liqVal),
      annualDividendCashflow: Math.round(activeAnnualDivCashflow),
      monthlyDividendCashflow: Math.round(activeMonthlyDivCashflow),
      annualCryptoStakingCashflow: Math.round(activeAnnualStakingCashflow),
      monthlyCryptoStakingCashflow: Math.round(activeMonthlyStakingCashflow),
      totalAnnualPassiveCashflow: Math.round(activeTotalAnnualPassive),
      totalMonthlyPassiveCashflow: Math.round(activeTotalMonthlyPassive),
      isCrossoverReached: isCrossover,
      isTargetReached: isTarget,
    });
  }

  const endPoint = trajectory[trajectory.length - 1]!;
  const endProjectedNetWorth = endPoint.totalProjectedNetWorth;
  const endP10NetWorth = endPoint.p10NetWorth;
  const endP90NetWorth = endPoint.p90NetWorth;
  const totalPacContributedEnd = horizonYears * 12 * monthlyPAC;
  const cumulativeInvestedEnd = initialNetWorth + totalPacContributedEnd;
  const totalGainEuro = Math.max(0, endProjectedNetWorth - cumulativeInvestedEnd);
  const totalGainPct = cumulativeInvestedEnd > 0 ? (totalGainEuro / cumulativeInvestedEnd) * 100 : 0;
  const effectiveCagrPct =
    initialNetWorth > 0 && horizonYears > 0
      ? (Math.pow(endProjectedNetWorth / initialNetWorth, 1 / horizonYears) - 1) * 100
      : 0;

  const grossProjectedNetWorth = Math.round(finalGrossNW);
  const taxDragEuro = Math.max(0, Math.round(finalGrossNW - finalNetNW));
  const grossGainEuro = Math.max(0, finalGrossNW - cumulativeInvestedEnd);
  const taxDragPct = grossGainEuro > 0 ? (taxDragEuro / grossGainEuro) * 100 : finalGrossNW > 0 ? (taxDragEuro / finalGrossNW) * 100 : 0;
  const estimatedStampDutyTotalEuro = Math.round(
    (invTotal * stampDutyRate * horizonYears) + ((monthlyPAC * 12 * horizonYears) / 2) * stampDutyRate * horizonYears
  );
  const estimatedCapitalGainTaxEuro = Math.max(0, taxDragEuro - estimatedStampDutyTotalEuro);
  const effectiveGrossCagrPct =
    initialNetWorth > 0 && horizonYears > 0
      ? (Math.pow(finalGrossNW / initialNetWorth, 1 / horizonYears) - 1) * 100
      : 0;

  // Stress Test Sistemico di Mercato Reale
  const equityImpact = -Math.round(eq0 * 0.3);
  const cryptoImpact = -Math.round(cry0 * 0.5);
  const tradingImpact = -Math.round(tra0 * 0.1);
  const hedgingImpact = Math.round(hed0 * 0.15);
  const reserveImpact = 0;

  const netWorthImpactEuro = equityImpact + cryptoImpact + tradingImpact + hedgingImpact;
  const stressedTotalNetWorth = Math.max(0, initialNetWorth + netWorthImpactEuro);
  const netWorthImpactPct =
    initialNetWorth > 0 ? (netWorthImpactEuro / initialNetWorth) * 100 : 0;
  const shieldScore = Math.min(100, Math.max(10, Math.round(100 - Math.abs(netWorthImpactPct) * 3)));

  // Diagnosi dell'Advisor AUREUS
  const savingsRatePct = monthlyExpenses > 0 && monthlyPAC > 0 ? (monthlyPAC / (monthlyExpenses + monthlyPAC)) * 100 : 0;

  let advisorScore = 60;
  if (reserveAllocation >= tradingAllocation && tradingAllocation > 0) advisorScore += 15;
  if (liquidityAllocation >= monthlyExpenses * 6) advisorScore += 10;
  if (monthlyPAC > 0) advisorScore += 10;
  if (shieldScore >= 75) advisorScore += 5;
  advisorScore = Math.min(100, Math.max(20, advisorScore));

  const grade: AdvisorHealthEvaluation["grade"] =
    advisorScore >= 90
      ? "SOVRANO (A+)"
      : advisorScore >= 80
        ? "SOLIDO (A)"
        : advisorScore >= 65
          ? "EQUILIBRATO (B)"
          : "ATTENZIONE (C)";

  const crossoverHeadline =
    crossoverYear !== null
      ? `Indipendenza Finanziaria (Crossover) stimata in ${crossoverYear} Anni`
      : `Rendita Passiva Totale ${endPoint.totalMonthlyPassiveCashflow.toLocaleString("it-IT")} €/m a ${horizonYears}A`;

  const recommendations: string[] = [];
  if (reserveAllocation < tradingAllocation) {
    recommendations.push("Priorità: Allineare la Riserva 1:1 con il Trading per sbloccare la piena conformità");
  } else {
    recommendations.push("Regola Aurea 1:1 intatta: barriera psicologica pienamente operativa");
  }
  if (monthlyPAC > 0) {
    recommendations.push(`PAC attivo (${monthlyPAC.toLocaleString("it-IT")} €/m): aggiunge ${totalPacContributedEnd.toLocaleString("it-IT")} € di carburante reale`);
  } else {
    recommendations.push("Consiglio Advisor: Definire un PAC mensile anche minimo (es. 200 €/m) per attivare il volano");
  }
  if (cry0 > 0) {
    recommendations.push(`Crypto Staking attivo: ~${Math.round(cry0 * stakingPct).toLocaleString("it-IT")} € generano rendita passiva del 4.5% a.a.`);
  }
  if (cry0 > initialNetWorth * 0.15) {
    recommendations.push("Allerta Volatilità: Quota Crypto superiore al 15% del Net Worth; ribilanciare verso Oro o Dividendi");
  } else {
    recommendations.push("Asset Allocation Bilanciata: Scudo difensivo e motori composti in perfetto equilibrio");
  }

  const advisorEvaluation: AdvisorHealthEvaluation = {
    score: advisorScore,
    grade,
    savingsRatePct,
    crossoverYear,
    targetReachedYear,
    crossoverHeadline,
    shieldScore,
    recommendations,
  };

  return {
    trajectory,
    endProjectedNetWorth,
    grossProjectedNetWorth,
    taxDragEuro,
    taxDragPct,
    isNetOfTaxApplied,
    estimatedStampDutyTotalEuro,
    estimatedCapitalGainTaxEuro,
    effectiveGrossCagrPct,
    endP10NetWorth,
    endP90NetWorth,
    totalGainEuro,
    totalGainPct,
    annualDividendCashflowEnd: endPoint.annualDividendCashflow,
    monthlyDividendCashflowEnd: endPoint.monthlyDividendCashflow,
    annualCryptoStakingCashflowEnd: endPoint.annualCryptoStakingCashflow,
    monthlyCryptoStakingCashflowEnd: endPoint.monthlyCryptoStakingCashflow,
    totalAnnualPassiveCashflowEnd: endPoint.totalAnnualPassiveCashflow,
    totalMonthlyPassiveCashflowEnd: endPoint.totalMonthlyPassiveCashflow,
    effectiveCagrPct,
    cumulativeInvestedEnd,
    totalPacContributedEnd,
    crossoverYear,
    targetReachedYear,
    stepCount: trajectory.length,
    stepIntervalType,
    systemicStressTest: {
      stressedTotalNetWorth,
      netWorthImpactEuro,
      netWorthImpactPct,
      equityImpactEuro: equityImpact,
      cryptoImpactEuro: cryptoImpact,
      tradingImpactEuro: tradingImpact,
      hedgingImpactEuro: hedgingImpact,
      reserveImpactEuro: reserveImpact,
      survivalShieldScore: shieldScore,
    },
    advisorEvaluation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RE-EXPORT: MODULO PROP FIRM, FUNNEL 2 FASI & BROKER SOVRANI
// ═══════════════════════════════════════════════════════════════════════════
export * from "./propFirmAndBrokers.js";

