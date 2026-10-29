/**
 * AUREUS PROTOCOL // ARCHITETTURA PATRIMONIALE & MERCATO DEI CAPITALI
 * propFirmAndBrokers.ts — Modulo Quantitativo Prop Firm, Funnel 2 Fasi & Broker Sovrani
 *
 * Fornisce:
 * 1. Catalogo e Analisi Operativa Approfondita delle Top Prop Firm (Regole, Restrizioni, Analisi Recensioni)
 * 2. Valutatore Diretto di Compatibilità per l'Operatore (Stile di Trading vs Regole Prop)
 * 3. Catalogo Istituzionale dei Migliori Broker: FP Markets, XM, Tickmill, IC Markets, IBKR
 * 4. Calcolatore di Attrito di Costo Broker (Spread + Commissioni su volumi mensili)
 * 5. Motore Funnel a 2 Fasi (Fase 1: 10%, Fase 2: 5%) & Protocollo Ibrido "Prop-to-Wealth"
 */

export interface PropFirmAccountTier {
  sizeEuro: number;
  feeEuro: number;
  phase1TargetPct: number;
  phase2TargetPct: number;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
}

export interface PropFirmOperationalRules {
  minTradingDays: number;
  weekendHolding: {
    allowed: boolean;
    details: string;
    swingAccountAvailable: boolean;
  };
  newsTrading: {
    allowed: boolean;
    details: string;
    restrictions2MinWindow: boolean;
  };
  eaAndAlgos: {
    allowed: boolean;
    details: string;
    copyTradingAllowed: boolean;
  };
  consistencyRule: {
    required: boolean;
    details: string;
  };
  drawdownRule: {
    type: "BALANCE_BASED" | "EQUITY_BASED" | "TRAILING_EQUITY";
    resetTime: string;
    explanation: string;
  };
  inactivityDaysLimit: number;
}

export interface PropFirmReviewAnalysis {
  trustpilotScore: number;
  reviewCount: string;
  positiveReviewsPct: number; // es. 88%
  negativeReviewsPct: number; // es. 5%
  topPraises: string[];
  topComplaints: string[];
  payoutReliability: "IMPECCABILE" | "ECCELLENTE" | "BUONO";
  averagePayoutTimeHours: number;
  communitySentiment: string;
}

export interface PropFirmProfile {
  id: "ftmo" | "the5ers" | "fundednext" | "alphacapital" | "fundingpips";
  name: string;
  country: string;
  foundedYear: number;
  trustpilotScore: number;
  reviewCount: string;
  headline: string;
  tiers: PropFirmAccountTier[];
  standardPhase1TargetPct: number;
  standardPhase2TargetPct: number;
  maxDailyDrawdownPct: number;
  maxTotalDrawdownPct: number;
  drawdownType: "BALANCE_BASED" | "EQUITY_BASED" | "TRAILING_EQUITY";
  payoutSplitPct: number;
  payoutSplitMaxPct: number;
  feeRefundPct: number;
  payoutFrequency: string;
  platforms: string[];
  instruments: string[];
  leverageMax: string;
  rules: PropFirmOperationalRules;
  reviews: PropFirmReviewAnalysis;
  strengths: string[];
  drawbacks: string[];
  limenVerdict: string;
  recommendedFor: string;
  badgeTone: "gold" | "emerald" | "slate";
}

export interface BrokerCostFriction {
  eurUsdSpreadPips: number;
  commissionRoundTurnEuroPerLot: number;
  overnightSwapEstimateLong: string;
  overnightSwapEstimateShort: string;
}

export interface BrokerProfile {
  id: "fpmarkets" | "xm" | "tickmill" | "icmarkets" | "ibkr";
  name: string;
  brandTitle: string;
  headquarters: string;
  foundedYear: number;
  regulations: string[];
  executionModel: "TRUE_ECN" | "ULTRA_LOW_SPREAD" | "PRO_ECN" | "DMA_INSTITUTIONAL" | "STP_RAW";
  friction: BrokerCostFriction;
  minDepositEuro: number;
  platforms: string[];
  taxRegimeSupported: "DICHIARATIVO_SOLO" | "AMMINISTRATO_DISPONIBILE";
  custodyRating: string;
  strengths: string[];
  drawbacks: string[];
  limenVerdict: string;
  roleInPortfolio: string;
  badgeTone: "gold" | "emerald" | "slate";
}

export interface UserTradingPreferences {
  tradesNews: boolean;
  holdsOverWeekend: boolean;
  usesEaOrBot: boolean;
  prefersZeroMinDays: boolean;
  preferredPlatform: "any" | "cTrader" | "MT5" | "MT4" | "TradingView" | "DXtrade";
  maxFeeBudgetEuro: number;
}

export interface PropCompatibilityResult {
  propId: string;
  matchScorePct: number;
  verdict: "COMPATIBILITÀ PERFETTA" | "BUONA COMPATIBILITÀ" | "ATTENZIONE RESTRIZIONI" | "NON CONSIGLIATO";
  pros: string[];
  cautions: string[];
}

export interface PropSimulationParams {
  accountSizeEuro: number;
  challengeFeeEuro: number;
  winRatePct: number;
  riskRewardRatio: number;
  riskPerTradePct: number;
  expectedMonthlyReturnPct: number;
  payoutSplitPct?: number;
  feeRefundPct?: number;
  tradesPerDay?: number;
}

export interface PropFunnelSimulationResult {
  accountSizeEuro: number;
  challengeFeeEuro: number;
  riskPerTradeEuro: number;
  riskPerTradePct: number;
  
  // Funnel Fase 1
  phase1TargetPct: number;
  phase1TargetEuro: number;
  tradesNeededPhase1: number;
  daysEstimatedPhase1: number;
  passProbabilityPhase1Pct: number;

  // Funnel Fase 2
  phase2TargetPct: number;
  phase2TargetEuro: number;
  tradesNeededPhase2: number;
  daysEstimatedPhase2: number;
  passProbabilityPhase2Pct: number;

  // Risultato Globale Qualificazione
  totalTradesEstimated: number;
  totalDaysEstimated: number;
  passProbabilityTotalPct: number;
  consecutiveLossTolerance: number;
  expectedCyclesToPass: number;
  expectedTotalCostEuro: number;

  // Proiezione Finanziata & Asimmetria di Capitale
  monthlyGrossProfitEuro: number;
  monthlyNetPayoutEuro: number;
  firstPayoutWithRefundEuro: number;
  directBrokerMonthlyProfitEuro: number;
  initialCapitalRoiMultiplier: number;
  expectedValueCycleEuro: number;
  efficiencyIndex: number;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 1. TOP 5 PROP FIRM: ANALISI OPERATIVA REGOLE E RECENSIONI UTENTI
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const TOP_5_PROP_FIRMS: PropFirmProfile[] = [
  {
    id: "ftmo",
    name: "FTMO",
    country: "Repubblica Ceca (Praga)",
    foundedYear: 2014,
    trustpilotScore: 4.8,
    reviewCount: "22.500+",
    headline: "Il Gold Standard Globale: Oltre 10 anni di pagamenti garantiti e solidità indiscutibile.",
    tiers: [
      { sizeEuro: 25000, feeEuro: 250, phase1TargetPct: 10, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 50000, feeEuro: 345, phase1TargetPct: 10, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 100000, feeEuro: 540, phase1TargetPct: 10, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 200000, feeEuro: 1080, phase1TargetPct: 10, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
    ],
    standardPhase1TargetPct: 10,
    standardPhase2TargetPct: 5,
    maxDailyDrawdownPct: 5,
    maxTotalDrawdownPct: 10,
    drawdownType: "BALANCE_BASED",
    payoutSplitPct: 80,
    payoutSplitMaxPct: 90,
    feeRefundPct: 100,
    payoutFrequency: "Bi-settimanale / On-Demand (entro 8h)",
    platforms: ["MetaTrader 4", "MetaTrader 5", "cTrader", "DXtrade"],
    instruments: ["Forex", "Indici", "Materie Prime", "Crypto", "Azioni CFD"],
    leverageMax: "1:100 (Forex)",
    rules: {
      minTradingDays: 4,
      weekendHolding: {
        allowed: false,
        details: "Vietato sul conto Standard (chiusura obbligatoria venerdì alle 23:59 CE(S)T). Consentito senza restrizioni sull'account FTMO Swing.",
        swingAccountAvailable: true,
      },
      newsTrading: {
        allowed: false,
        details: "Sul conto Standard è vietato aprire o chiudere trade 2 minuti prima e 2 minuti dopo news macro ad alto impatto. Sul conto Swing è 100% consentito.",
        restrictions2MinWindow: true,
      },
      eaAndAlgos: {
        allowed: true,
        details: "EA e indicatori personalizzati consentiti; vietati arbitraggi di latenza, tick scalping ad altissima frequenza e copy trading pubblico da terzi.",
        copyTradingAllowed: true,
      },
      consistencyRule: {
        required: false,
        details: "Nessuna regola di consistenza di lotti obbligatoria: il trader gestisce la size in autonomia.",
      },
      drawdownRule: {
        type: "BALANCE_BASED",
        resetTime: "00:00 CE(S)T",
        explanation: "Il limite di perdita giornaliera (5%) è calcolato rigorosamente sul saldo (balance) di inizio giornata a mezzanotte, garantendo chiarezza matematica.",
      },
      inactivityDaysLimit: 30,
    },
    reviews: {
      trustpilotScore: 4.8,
      reviewCount: "22.500+",
      positiveReviewsPct: 88,
      negativeReviewsPct: 5,
      topPraises: [
        "Velocità dei payout senza rivali: pagamenti processati mediamente in meno di 8 ore via bonifico bancario SEPA o crypto.",
        "Assistenza clienti in live chat reattiva e cordiale in oltre 15 lingue, compreso supporto in italiano.",
        "Piattaforma proprietaria FTMO Quick Trade Manager per calcolo lotti automatico e dashboard metrica impeccabile.",
      ],
      topComplaints: [
        "Regola dei 2 minuti sulle news sul conto Standard ha causato squalifiche a chi non ha optato per il conto Swing.",
        "Target Fase 1 al 10% richiede tempo e disciplina per chi non ha fretta.",
        "Spread variabili in allargamento naturale durante il rollover notturno tra le 23:00 e le 00:15.",
      ],
      payoutReliability: "IMPECCABILE",
      averagePayoutTimeHours: 8,
      communitySentiment: "La prop firm più rispettata e affidabile della storia del retail trading. Zero ritardi sistemici sui pagamenti.",
    },
    strengths: [
      "Oltre 10 anni di storico ininterrotto senza mai un mancato pagamento verificato",
      "Daily Drawdown basato sul saldo iniziale a mezzanotte (Balance-based puro)",
      "Opzione Conto Swing gratuita per chi vuole tradare le news e mantenere posizioni over-weekend",
      "Scaling Plan che incrementa il conto del +25% ogni 4 mesi consecutivi in profitto",
    ],
    drawbacks: [
      "Target Fase 1 del 10% (più alto rispetto all'8% di The5ers o FundedNext)",
      "Minimo 4 giorni di trading richiesti per completare le fasi",
    ],
    limenVerdict: "La fortezza dorata: la prima scelta assoluta per il capitale principale dell'operatore.",
    recommendedFor: "Trader rigorosi che esigono certezza matematica sui pagamenti e reputazione di massimo livello.",
    badgeTone: "gold",
  },
  {
    id: "the5ers",
    name: "The5ers (The 5%ers)",
    country: "Israele / Regno Unito",
    foundedYear: 2016,
    trustpilotScore: 4.8,
    reviewCount: "18.200+",
    headline: "L'Architettura dello Scaling: Target Fase 1 ribassato all'8% e raddoppio capitale fino a $4M.",
    tiers: [
      { sizeEuro: 25000, feeEuro: 215, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 50000, feeEuro: 285, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 100000, feeEuro: 465, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 200000, feeEuro: 920, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
    ],
    standardPhase1TargetPct: 8,
    standardPhase2TargetPct: 5,
    maxDailyDrawdownPct: 5,
    maxTotalDrawdownPct: 10,
    drawdownType: "BALANCE_BASED",
    payoutSplitPct: 80,
    payoutSplitMaxPct: 100,
    feeRefundPct: 100,
    payoutFrequency: "Bi-settimanale (dopo 14 giorni)",
    platforms: ["MetaTrader 5"],
    instruments: ["Forex", "Indici", "Metalli"],
    leverageMax: "1:100",
    rules: {
      minTradingDays: 0,
      weekendHolding: {
        allowed: true,
        details: "Consentito sul modello High Stakes; vietato solo su alcuni conti Bootcamp ad alta leva.",
        swingAccountAvailable: true,
      },
      newsTrading: {
        allowed: true,
        details: "News trading 100% consentito senza alcuna finestra temporale restrittiva.",
        restrictions2MinWindow: false,
      },
      eaAndAlgos: {
        allowed: true,
        details: "EA consentiti previa approvazione di unicità procedurale.",
        copyTradingAllowed: true,
      },
      consistencyRule: {
        required: false,
        details: "Nessuna restrizione sul peso percentuale del singolo trade sul profitto totale.",
      },
      drawdownRule: {
        type: "BALANCE_BASED",
        resetTime: "00:00 GMT",
        explanation: "Max Drawdown 10% statico e Daily Drawdown 5% calcolato sul balance iniziale.",
      },
      inactivityDaysLimit: 30,
    },
    reviews: {
      trustpilotScore: 4.8,
      reviewCount: "18.200+",
      positiveReviewsPct: 89,
      negativeReviewsPct: 4,
      topPraises: [
        "Piano di scaling reale più potente del mercato: con il 10% di profitto raddoppiano il capitale fino a 4 milioni di dollari.",
        "Target Fase 1 all'8% rende la qualificazione molto più rapida e meno stressante rispetto a FTMO.",
        "Zero giorni minimi di trading: un trader abile può passare la fase anche in 24-48 ore.",
      ],
      topComplaints: [
        "Piattaforma disponibile quasi esclusivamente su MT5 (assenza di cTrader nativo).",
        "Regole di stop loss obbligatorio su alcuni conti Bootcamp storici che hanno sorpreso trader novizi.",
        "Commissioni su alcuni cross valutari esotici leggermente superiori a FTMO.",
      ],
      payoutReliability: "IMPECCABILE",
      averagePayoutTimeHours: 12,
      communitySentiment: "Fondata e gestita da trader per trader. Apprezzatissima per la serietà istituzionale e l'apertura a news e swing trading.",
    },
    strengths: [
      "Target Fase 1 all'8% (risparmio del 20% di sforzo rispetto a FTMO)",
      "Zero giorni minimi di trading (qualificazione istantanea)",
      "News trading e mantenimento weekend totalmente liberi",
      "Scaling esponenziale fino a 4.000.000 $",
    ],
    drawbacks: [
      "Supporto piattaforme limitato principalmente a MetaTrader 5",
      "Offerta di crypto limitata rispetto ad altre prop",
    ],
    limenVerdict: "La migliore prop al mondo per chi cerca regole operative libere e scaling aggressivo sul lungo termine.",
    recommendedFor: "Swing trader e day trader che operano durante i comunicati macroeconomici senza restrizioni.",
    badgeTone: "emerald",
  },
  {
    id: "fundednext",
    name: "FundedNext",
    country: "Emirati Arabi Uniti (Dubai)",
    foundedYear: 2022,
    trustpilotScore: 4.7,
    reviewCount: "15.800+",
    headline: "Asimmetria Unica: 15% di profit sharing già durante le challenge e garanzia payout in 24h.",
    tiers: [
      { sizeEuro: 25000, feeEuro: 199, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 50000, feeEuro: 299, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 100000, feeEuro: 499, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 200000, feeEuro: 999, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
    ],
    standardPhase1TargetPct: 8,
    standardPhase2TargetPct: 5,
    maxDailyDrawdownPct: 5,
    maxTotalDrawdownPct: 10,
    drawdownType: "BALANCE_BASED",
    payoutSplitPct: 80,
    payoutSplitMaxPct: 95,
    feeRefundPct: 100,
    payoutFrequency: "Bi-settimanale con garanzia 24h",
    platforms: ["cTrader", "MetaTrader 5", "DXtrade"],
    instruments: ["Forex", "Indici", "Materie Prime", "Crypto"],
    leverageMax: "1:100",
    rules: {
      minTradingDays: 0,
      weekendHolding: {
        allowed: true,
        details: "Consentito senza restrizioni su tutti i conti Stellar 2-Step.",
        swingAccountAvailable: true,
      },
      newsTrading: {
        allowed: true,
        details: "News trading consentito sia nelle challenge che sui conti finanziati Stellar.",
        restrictions2MinWindow: false,
      },
      eaAndAlgos: {
        allowed: true,
        details: "EA e copy trading consentiti purché non utilizzino strategie tossiche o latenze.",
        copyTradingAllowed: true,
      },
      consistencyRule: {
        required: false,
        details: "Nessuna regola di consistenza sui conti Stellar a 2 fasi.",
      },
      drawdownRule: {
        type: "BALANCE_BASED",
        resetTime: "00:00 UTC",
        explanation: "Daily Drawdown basato sul balance iniziale della giornata a mezzanotte.",
      },
      inactivityDaysLimit: 30,
    },
    reviews: {
      trustpilotScore: 4.7,
      reviewCount: "15.800+",
      positiveReviewsPct: 87,
      negativeReviewsPct: 6,
      topPraises: [
        "15% di profit sharing pagato anche sui profitti fatti in Fase 1 e 2 al momento del primo accredito.",
        "Payout Guarantee: Se il payout impiega più di 24 ore, ti pagano $1.000 extra oltre al tuo prelievo.",
        "Piattaforma cTrader impeccabile con esecuzione rapida e interfaccia moderna.",
      ],
      topComplaints: [
        "Regole di reset temporale delle 24 ore a volte fraintese nei fine settimana bancari.",
        "Spread variabili nelle ore notturne asiatiche su alcune coppie minori.",
        "Processo di KYC iniziale rigoroso con verifica biometrica richiesta.",
      ],
      payoutReliability: "ECCELLENTE",
      averagePayoutTimeHours: 16,
      communitySentiment: "Crescita vertiginosa e grande popolarità grazie alla promessa mantenuta del 15% di split sulle challenge e supporto cTrader nativo.",
    },
    strengths: [
      "15% di guadagno riconosciuto anche sulle fasi di test quando si ottiene il conto funded",
      "Garanzia payout 24 ore o risarcimento di $1.000",
      "Pieno supporto a cTrader per chi odia MetaTrader",
      "Target Fase 1 all'8% e zero giorni minimi di trading",
    ],
    drawbacks: [
      "Azienda più giovane rispetto al decennio storico di FTMO (fondata nel 2022)",
      "Verifiche KYC stringenti prima dell'erogazione dei contratti funded",
    ],
    limenVerdict: "La formula finanziariamente più ricca per rientrare dal costo della fee sin dal primissimo prelievo.",
    recommendedFor: "Trader moderni amanti di cTrader che vogliono monetizzare anche lo sforzo della prova.",
    badgeTone: "gold",
  },
  {
    id: "alphacapital",
    name: "Alpha Capital Group",
    country: "Regno Unito (Londra)",
    foundedYear: 2021,
    trustpilotScore: 4.7,
    reviewCount: "9.800+",
    headline: "Zero Commissioni su Indici: Brokerage ECN proprio ACG Markets e 110% di rimborso fee.",
    tiers: [
      { sizeEuro: 25000, feeEuro: 195, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 50000, feeEuro: 275, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 100000, feeEuro: 465, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 200000, feeEuro: 895, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
    ],
    standardPhase1TargetPct: 8,
    standardPhase2TargetPct: 5,
    maxDailyDrawdownPct: 5,
    maxTotalDrawdownPct: 10,
    drawdownType: "BALANCE_BASED",
    payoutSplitPct: 80,
    payoutSplitMaxPct: 90,
    feeRefundPct: 110,
    payoutFrequency: "Bi-settimanale",
    platforms: ["cTrader", "MetaTrader 5"],
    instruments: ["Forex", "Indici USA ed Europei", "Metalli"],
    leverageMax: "1:100",
    rules: {
      minTradingDays: 0,
      weekendHolding: {
        allowed: true,
        details: "Consentito il mantenimento posizioni over-weekend.",
        swingAccountAvailable: true,
      },
      newsTrading: {
        allowed: true,
        details: "News trading consentito senza vincoli restrittivi.",
        restrictions2MinWindow: false,
      },
      eaAndAlgos: {
        allowed: true,
        details: "EA consentiti; vietati arbitraggi di feed e grid ad alta frequenza incontrollati.",
        copyTradingAllowed: true,
      },
      consistencyRule: {
        required: false,
        details: "Nessuna consistency rule sui lotti per il modello Alpha Pro standard.",
      },
      drawdownRule: {
        type: "BALANCE_BASED",
        resetTime: "00:00 server time",
        explanation: "Daily Drawdown calcolato sul balance di mezzanotte.",
      },
      inactivityDaysLimit: 30,
    },
    reviews: {
      trustpilotScore: 4.7,
      reviewCount: "9.800+",
      positiveReviewsPct: 86,
      negativeReviewsPct: 6,
      topPraises: [
        "Zero commissioni su NASDAQ (NAS100), Dow Jones (US30), S&P500 e DAX (GER40): risparmio colossale per gli index trader.",
        "Rimborso maggiorato al 110% della fee: al primo prelievo ricevi la fee più un bonus extra del 10%.",
        "Broker ECN proprietario (Alpha Capital Markets) con spread eccellenti e feed TradingView Pro.",
      ],
      topComplaints: [
        "Catalogo crypto e asset esotici ridotto rispetto a giganti come FTMO.",
        "Regole molto rigide contro stili di arbitraggio di latenza sui contratti indici.",
      ],
      payoutReliability: "ECCELLENTE",
      averagePayoutTimeHours: 14,
      communitySentiment: "La prop firm preferita dalla comunità dei trader di indici americani ed europei per l'assenza totale di commissioni sui lotti.",
    },
    strengths: [
      "Zero commissioni su NAS100, US30, SPX500 e GER40",
      "Rimborso del 110% della challenge fee al primo payout",
      "Piattaforma cTrader nativa e strumenti di analisi TradingView integrati",
      "Target Fase 1 all'8% e zero giorni minimi obbligatori",
    ],
    drawbacks: [
      "Minore varietà di strumenti crypto",
      "Monitoraggio rigoroso dell'arbitraggio di latenza",
    ],
    limenVerdict: "La scelta al vertice per chiunque trada primariamente indici azionari mondiali.",
    recommendedFor: "Trader specialisti su US100 / US30 che vogliono azzerare i costi di transazione.",
    badgeTone: "slate",
  },
  {
    id: "fundingpips",
    name: "Funding Pips",
    country: "Emirati Arabi Uniti (Dubai)",
    foundedYear: 2022,
    trustpilotScore: 4.6,
    reviewCount: "26.000+",
    headline: "Prezzo Minimo & Payout ogni 5 Giorni: Il miglior rapporto costo/opportunità del settore.",
    tiers: [
      { sizeEuro: 25000, feeEuro: 145, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 50000, feeEuro: 240, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 100000, feeEuro: 370, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
      { sizeEuro: 200000, feeEuro: 740, phase1TargetPct: 8, phase2TargetPct: 5, maxDailyDrawdownPct: 5, maxTotalDrawdownPct: 10 },
    ],
    standardPhase1TargetPct: 8,
    standardPhase2TargetPct: 5,
    maxDailyDrawdownPct: 5,
    maxTotalDrawdownPct: 10,
    drawdownType: "BALANCE_BASED",
    payoutSplitPct: 80,
    payoutSplitMaxPct: 90,
    feeRefundPct: 100,
    payoutFrequency: "Ogni 5 Giorni di Trading (post-1° payout)",
    platforms: ["cTrader", "Match-Trader", "TradeLocker"],
    instruments: ["Forex", "Indici", "Materie Prime", "Crypto"],
    leverageMax: "1:100",
    rules: {
      minTradingDays: 0,
      weekendHolding: {
        allowed: true,
        details: "Consentito mantenere posizioni aperte nel fine settimana.",
        swingAccountAvailable: true,
      },
      newsTrading: {
        allowed: true,
        details: "Consentito il trading durante le news macro.",
        restrictions2MinWindow: false,
      },
      eaAndAlgos: {
        allowed: true,
        details: "EA consentiti previa conformità alle linee guida sul rischio.",
        copyTradingAllowed: true,
      },
      consistencyRule: {
        required: false,
        details: "Nessuna consistency rule restrittiva sul modello standard a 2 fasi.",
      },
      drawdownRule: {
        type: "BALANCE_BASED",
        resetTime: "00:00 UTC",
        explanation: "Daily Drawdown basato sul saldo a mezzanotte.",
      },
      inactivityDaysLimit: 30,
    },
    reviews: {
      trustpilotScore: 4.6,
      reviewCount: "26.000+",
      positiveReviewsPct: 84,
      negativeReviewsPct: 8,
      topPraises: [
        "Costo della challenge da 100k a soli ~370 €: il 30% in meno rispetto a FTMO a parità di capitale.",
        "Payout consentiti ogni 5 giorni di trading effettivo una volta finanziati: rotazione di liquidità rapidissima.",
        "Esecuzione pulita su cTrader con interfaccia leggera e scattante.",
      ],
      topComplaints: [
        "Non supporta più MetaTrader dopo i ban retail MetaQuotes del 2024.",
        "Assistenza clienti a volte intasata a causa dell'enorme volume di utenti attratti dai prezzi bassi.",
        "Azienda più sensibile alla volatilità rispetto alla corazzata FTMO.",
      ],
      payoutReliability: "BUONO",
      averagePayoutTimeHours: 24,
      communitySentiment: "La scelta di massa per i trader con budget ridotto che cercano la massima frequenza di prelievo e costi minimi.",
    },
    strengths: [
      "Il prezzo di challenge più accessibile del mercato (~370 € per 100k)",
      "Prelievi ogni 5 giorni di trading (ciclo finanziario ultra-veloce)",
      "Target Fase 1 all'8% e zero giorni minimi",
      "Piattaforma cTrader ottimizzata",
    ],
    drawbacks: [
      "Assenza di MetaTrader 4 / 5",
      "Capitalizzazione societaria inferiore a FTMO o The5ers",
    ],
    limenVerdict: "Lo strumento tattico per chi vuole tentare più challenge con un budget complessivo contenuto.",
    recommendedFor: "Trader con budget iniziale limitato che operano su cTrader e vogliono flussi di prelievo frequenti.",
    badgeTone: "slate",
  },
];

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 2. ALBO D'ORO: I MIGLIORI BROKER SOVRANI (FP MARKETS, XM, TICKMILL, IC, IBKR)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export const TOP_5_BROKERS: BrokerProfile[] = [
  {
    id: "fpmarkets",
    name: "FP Markets",
    brandTitle: "FP Markets (FP Trading)",
    headquarters: "Sydney, Australia (Filiali UE regolamentate a Cipro)",
    foundedYear: 2005,
    regulations: ["ASIC (Australia)", "CySEC (UE/Cipro)", "FSCA (Sud Africa)", "FSA"],
    executionModel: "TRUE_ECN",
    friction: {
      eurUsdSpreadPips: 0.0,
      commissionRoundTurnEuroPerLot: 5.5, // $3.00 per lato ($6.00 RT)
      overnightSwapEstimateLong: "-5.80 € / lotto / notte",
      overnightSwapEstimateShort: "+1.20 € / lotto / notte",
    },
    minDepositEuro: 100,
    platforms: ["cTrader", "TradingView", "MetaTrader 4", "MetaTrader 5", "Iress"],
    taxRegimeSupported: "DICHIARATIVO_SOLO",
    custodyRating: "AAA (National Australia Bank - NAB, Conti Segregati)",
    strengths: [
      "True ECN di livello istituzionale: spread raw da 0.0 pip con liquidità profonda aggregata Tier-1",
      "Server ultra-veloci nel data center Equinix NY4 di New York (latenza sub-millisecondo)",
      "Supporto sia a cTrader che a TradingView e MetaTrader, con perfetta parità di esecuzione",
      "Presenza sul mercato ininterrotta dal 2005 e pluripremiato per il servizio clienti e la trasparenza",
    ],
    drawbacks: [
      "In Italia opera esclusivamente in Regime Dichiarativo (richiede compilazione Quadri RT/RW)",
      "Leva massima limitata a 1:30 per clienti residenti nell'Unione Europea (regolamentazione ESMA)",
    ],
    limenVerdict: "Uno dei migliori broker ECN al mondo per affidabilità, esecuzione su NY4 e supporto a cTrader e TradingView.",
    roleInPortfolio: "Conto Personale Sovrano ECN (Day Trading & Scalping Professionale)",
    badgeTone: "gold",
  },
  {
    id: "xm",
    name: "XM Group",
    brandTitle: "XM (XM.com)",
    headquarters: "Cipro / Regno Unito / Australia (Oltre 10 Milioni di Clienti)",
    foundedYear: 2009,
    regulations: ["FCA (Regno Unito)", "CySEC (UE/Cipro)", "ASIC (Australia)", "FSC"],
    executionModel: "ULTRA_LOW_SPREAD",
    friction: {
      eurUsdSpreadPips: 0.6,
      commissionRoundTurnEuroPerLot: 0.0, // ZERO commissioni sul conto XM Ultra Low!
      overnightSwapEstimateLong: "-6.20 € / lotto / notte",
      overnightSwapEstimateShort: "+0.80 € / lotto / notte",
    },
    minDepositEuro: 5,
    platforms: ["MetaTrader 4", "MetaTrader 5", "XM Mobile App", "WebTrader"],
    taxRegimeSupported: "DICHIARATIVO_SOLO",
    custodyRating: "AAA (Banche Internazionali di Primo Livello, Fondi Segregati)",
    strengths: [
      "Conto XM Ultra Low: ZERO commissioni per lotto e spread ultra-competitivi da 0.6 pip all-inclusive",
      "Politica No-Requotes rigorosa: il 99.35% degli ordini è eseguito in meno di 1 secondo senza rifiuti",
      "Deposito minimo simbolico di soli 5 € e prelievi istantanei senza alcuna commissione di trasferimento",
      "Disponibilità di conti Micro (1 lotto micro = 1.000 unità) ideali per affinare il money management",
    ],
    drawbacks: [
      "Non offre spread a 0.0 pip raw con commissione separata, preferendo il modello all-inclusive",
      "Assenza di cTrader (supporta solo l'ecosistema MetaTrader ed app proprietaria)",
    ],
    limenVerdict: "La migliore scelta per chi vuole zero commissioni sui lotti, certezza assoluta di esecuzione e zero riquotazioni.",
    roleInPortfolio: "Conto Zero-Commissioni & Micro-Positioning (Swing Trading & PAC)",
    badgeTone: "emerald",
  },
  {
    id: "tickmill",
    name: "Tickmill",
    brandTitle: "Tickmill Group",
    headquarters: "Londra, Regno Unito (Filiali CySEC a Cipro e Seychelles)",
    foundedYear: 2014,
    regulations: ["FCA (Regno Unito)", "CySEC (UE/Cipro)", "FSA (Seychelles)"],
    executionModel: "PRO_ECN",
    friction: {
      eurUsdSpreadPips: 0.0,
      commissionRoundTurnEuroPerLot: 3.6, // Solo $2.00 per lato ($4.00 RT) - Record Mondiale
      overnightSwapEstimateLong: "-5.20 € / lotto / notte",
      overnightSwapEstimateShort: "+1.10 € / lotto / notte",
    },
    minDepositEuro: 100,
    platforms: ["MetaTrader 4", "MetaTrader 5", "Tickmill Web"],
    taxRegimeSupported: "DICHIARATIVO_SOLO",
    custodyRating: "AA (Barclays Bank Londra)",
    strengths: [
      "LE COMMISSIONI ECN PIÙ BASSE AL MONDO: $2 per lato ($4 round turn per lotto pieno)",
      "Risparmio matematico del 35%-40% sulle spese di trading rispetto alla media del settore",
      "Server LD4 a Londra con esecuzione media a 0.20s, ideale per Expert Advisor e algo-trading",
      "VPS gratuito offerto ai trader con volumi regolari e spread raw reali da 0.0 pip",
    ],
    drawbacks: [
      "Manca il supporto nativo a cTrader e TradingView (disponibile solo su MT4/MT5)",
      "Regime Dichiarativo (nessun sostituto d'imposta per trader italiani)",
    ],
    limenVerdict: "La scelta al millimetro per gli operatori ad alta frequenza dove ogni punto base di commissione conta.",
    roleInPortfolio: "Motore Algoritmico a Bassissime Commissioni (Massima Efficienza di Costo)",
    badgeTone: "slate",
  },
  {
    id: "icmarkets",
    name: "IC Markets",
    brandTitle: "IC Markets Global",
    headquarters: "Sydney, Australia (CySEC, ASIC, SCB)",
    foundedYear: 2007,
    regulations: ["ASIC (Australia)", "CySEC (UE/Cipro)", "SCB (Bahamas)"],
    executionModel: "TRUE_ECN",
    friction: {
      eurUsdSpreadPips: 0.0,
      commissionRoundTurnEuroPerLot: 6.0, // $3.50 per lato ($7.00 RT)
      overnightSwapEstimateLong: "-5.90 € / lotto / notte",
      overnightSwapEstimateShort: "+1.15 € / lotto / notte",
    },
    minDepositEuro: 200,
    platforms: ["cTrader", "MetaTrader 4", "MetaTrader 5", "TradingView"],
    taxRegimeSupported: "DICHIARATIVO_SOLO",
    custodyRating: "AAA (NAB & Barclays)",
    strengths: [
      "Oltre $1.000 Miliardi di volume mensile: profondità interbancaria ineguagliata",
      "Connessioni in fibra ottica diretta nei server Equinix NY4 e LD4",
      "Zero restrizioni su stop loss ravvicinati, scalping estremo o news trading",
    ],
    drawbacks: [
      "Commissioni round turn ($7 RT) leggermente più alte rispetto a Tickmill ($4 RT)",
      "Regime Dichiarativo per i residenti in Italia",
    ],
    limenVerdict: "Il punto di riferimento industriale assoluto per liquidità e velocità di riempimento degli ordini.",
    roleInPortfolio: "Colosso della Liquidità Globale ECN",
    badgeTone: "gold",
  },
  {
    id: "ibkr",
    name: "Interactive Brokers (IBKR)",
    brandTitle: "Interactive Brokers LLC",
    headquarters: "Greenwich, Connecticut, USA (NASDAQ: IBKR)",
    foundedYear: 1978,
    regulations: ["SEC & FINRA (USA)", "CBI (Banca Centrale Irlanda)", "FCA (UK)", "CSSF"],
    executionModel: "DMA_INSTITUTIONAL",
    friction: {
      eurUsdSpreadPips: 0.1,
      commissionRoundTurnEuroPerLot: 3.5,
      overnightSwapEstimateLong: "Benchmark Interbancario",
      overnightSwapEstimateShort: "Benchmark Interbancario",
    },
    minDepositEuro: 0,
    platforms: ["Trader Workstation (TWS)", "IBKR Desktop", "TradingView", "Mobile App"],
    taxRegimeSupported: "DICHIARATIVO_SOLO",
    custodyRating: "SOVRANO (Capitale Proprio > 14 Miliardi $, Protezione SIPC $500k)",
    strengths: [
      "Accesso a oltre 150 mercati mondiali: Azioni reali, ETF UCITS, Futures CME/Eurex e Obbligazioni",
      "Custodia titoli reale (non CFD sintetici): i titoli sono intestati e protetti via SIPC fino a $500.000",
      "Commissioni istituzionali minime su azioni e futures reali",
    ],
    drawbacks: [
      "Piattaforma professionale complessa per trader alle prime armi",
      "Regime Dichiarativo in Italia",
    ],
    limenVerdict: "La fortezza patrimoniale suprema: il depositario naturale per il PAC, ETF a lungo termine e Futures reali.",
    roleInPortfolio: "Fortezza Patrimoniale ETF, Dividendi & Futures Reali",
    badgeTone: "gold",
  },
];

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 3. MOTORE DI VALUTAZIONE DIRETTA DI COMPATIBILITÀ (STYLE VS PROP)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function calculatePropFirmCompatibility(
  prop: PropFirmProfile,
  preferences: UserTradingPreferences
): PropCompatibilityResult {
  let score = 100;
  const pros: string[] = [];
  const cautions: string[] = [];

  // 1. News Trading
  if (preferences.tradesNews) {
    if (prop.rules.newsTrading.restrictions2MinWindow) {
      score -= 25;
      cautions.push(`Restrizione News: su conto standard è vietato operare 2 min prima e dopo eventi macro. Obbligatorio conto Swing.`);
    } else {
      score += 5;
      pros.push(`News Trading 100% libero senza finestre di divieto.`);
    }
  }

  // 2. Weekend Holding
  if (preferences.holdsOverWeekend) {
    if (!prop.rules.weekendHolding.allowed) {
      score -= 20;
      cautions.push(`Mantenimento Weekend: conto standard vieta posizioni aperte il venerdì sera. Necessario conto dedicato Swing.`);
    } else {
      score += 5;
      pros.push(`Mantenimento posizioni nel fine settimana consentito senza penalità.`);
    }
  }

  // 3. EA / Bot
  if (preferences.usesEaOrBot) {
    if (prop.rules.eaAndAlgos.allowed) {
      pros.push(`Algoritmi ed EA personalizzati pienamente supportati.`);
    } else {
      score -= 30;
      cautions.push(`Restrizioni severe sull'utilizzo di Expert Advisors.`);
    }
  }

  // 4. Zero Min Trading Days
  if (preferences.prefersZeroMinDays) {
    if (prop.rules.minTradingDays === 0) {
      score += 10;
      pros.push(`Zero giorni minimi di trading: passaggio immediato appena raggiunto il target.`);
    } else {
      score -= 10;
      cautions.push(`Richiede un minimo di ${prop.rules.minTradingDays} giorni operativi per completare ogni fase.`);
    }
  }

  // 5. Piattaforma preferita
  if (preferences.preferredPlatform !== "any") {
    const hasPlatform = prop.platforms.some((p) =>
      p.toLowerCase().includes(preferences.preferredPlatform.toLowerCase())
    );
    if (!hasPlatform) {
      score -= 25;
      cautions.push(`Piattaforma ${preferences.preferredPlatform} NON disponibile (disponibili: ${prop.platforms.join(", ")}).`);
    } else {
      pros.push(`Piattaforma ${preferences.preferredPlatform} supportata nativamente.`);
    }
  }

  // 6. Budget
  const tier100k = prop.tiers.find((t) => t.sizeEuro === 100000);
  if (tier100k && preferences.maxFeeBudgetEuro > 0 && tier100k.feeEuro > preferences.maxFeeBudgetEuro) {
    score -= 15;
    cautions.push(`Costo account 100k (${tier100k.feeEuro} €) supera il tuo budget target.`);
  }

  const finalScore = Math.max(10, Math.min(100, score));

  let verdict: PropCompatibilityResult["verdict"] = "COMPATIBILITÀ PERFETTA";
  if (finalScore < 60) verdict = "NON CONSIGLIATO";
  else if (finalScore < 75) verdict = "ATTENZIONE RESTRIZIONI";
  else if (finalScore < 90) verdict = "BUONA COMPATIBILITÀ";

  return {
    propId: prop.id,
    matchScorePct: finalScore,
    verdict,
    pros,
    cautions,
  };
}

export type TradedAssetCategory = "EURUSD" | "GOLD" | "US100";

/**
 * Calcola l'attrito monetario comparato di trading su base mensile (Spread + Commissioni)
 * Supporta EUR/USD, Oro (XAU/USD) e Indici Azionari (US100 / Nasdaq)
 */
export function calculateBrokerMonthlyFrictionEuro(
  broker: BrokerProfile,
  monthlyLotsTraded: number,
  asset: TradedAssetCategory = "EURUSD"
): {
  spreadCostEuro: number;
  commissionCostEuro: number;
  totalCostEuro: number;
  savingsVsBenchmarkEuro: number;
} {
  const lots = Math.max(1, monthlyLotsTraded);

  let spreadPips = broker.friction.eurUsdSpreadPips;
  let pipValueEuro = 9.2;
  let benchmarkSpreadPips = 1.2;

  if (asset === "GOLD") {
    pipValueEuro = 9.2;
    benchmarkSpreadPips = 0.45;
    spreadPips = broker.id === "fpmarkets" ? 0.12 : broker.id === "xm" ? 0.25 : broker.id === "tickmill" ? 0.15 : 0.18;
  } else if (asset === "US100") {
    pipValueEuro = 9.2;
    benchmarkSpreadPips = 2.4;
    spreadPips = broker.id === "fpmarkets" ? 1.0 : broker.id === "xm" ? 1.5 : broker.id === "tickmill" ? 1.0 : 1.2;
  }

  const spreadCostEuro = Math.round(spreadPips * pipValueEuro * lots);
  const commissionCostEuro = Math.round(broker.friction.commissionRoundTurnEuroPerLot * lots);
  const totalCostEuro = spreadCostEuro + commissionCostEuro;

  // Benchmark di confronto: Broker medio retail (all-inclusive)
  const benchmarkCostEuro = Math.round(benchmarkSpreadPips * pipValueEuro * lots);
  const savingsVsBenchmarkEuro = Math.max(0, benchmarkCostEuro - totalCostEuro);

  return {
    spreadCostEuro,
    commissionCostEuro,
    totalCostEuro,
    savingsVsBenchmarkEuro,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 4. MOTORE MATEMATICO FUNNEL 2 FASI & ASIMMETRIA DI CAPITALE
 * ═══════════════════════════════════════════════════════════════════════════
 */
function estimatePhasePassProbability(
  targetPct: number,
  maxDrawdownPct: number,
  winRatePct: number,
  riskRewardRatio: number,
  riskPerTradePct: number
): number {
  if (riskPerTradePct <= 0) return 0;
  
  const p = winRatePct / 100;
  const edge = p * riskRewardRatio - (1 - p);
  
  const targetUnits = targetPct / riskPerTradePct;
  const drawdownUnits = maxDrawdownPct / riskPerTradePct;
  
  if (edge <= 0) {
    const raw = drawdownUnits / (targetUnits + drawdownUnits);
    return Math.max(5, Math.min(45, Math.round(raw * 100)));
  }

  const ratio = (1 - Math.min(0.9, edge)) / (1 + Math.min(0.9, edge));
  const num = 1 - Math.pow(ratio, drawdownUnits);
  const den = 1 - Math.pow(ratio, drawdownUnits + targetUnits);
  
  const prob = den > 0 ? (num / den) * 100 : 50;
  return Math.max(10, Math.min(92, Math.round(prob)));
}

export function calculatePropFunnelSimulation(
  params: PropSimulationParams
): PropFunnelSimulationResult {
  const accountSize = Math.max(1000, params.accountSizeEuro);
  const fee = Math.max(10, params.challengeFeeEuro);
  const riskPct = Math.max(0.1, Math.min(2.5, params.riskPerTradePct));
  const winRate = Math.max(30, Math.min(80, params.winRatePct));
  const rr = Math.max(1.0, Math.min(5.0, params.riskRewardRatio));
  const monthlyReturn = Math.max(0.5, Math.min(20, params.expectedMonthlyReturnPct));
  const payoutSplit = params.payoutSplitPct ?? 80;
  const refundPct = params.feeRefundPct ?? 100;
  const tradesPerDay = params.tradesPerDay ?? 1.5;

  const riskPerTradeEuro = Math.round(accountSize * (riskPct / 100));

  const phase1TargetPct = 10;
  const phase2TargetPct = 5;
  const maxTotalDDPct = 10;

  const phase1TargetEuro = Math.round(accountSize * (phase1TargetPct / 100));
  const phase2TargetEuro = Math.round(accountSize * (phase2TargetPct / 100));

  const p = winRate / 100;
  const evPerTradeInR = p * rr - (1 - p);
  const evPerTradeEuro = riskPerTradeEuro * evPerTradeInR;

  const safeEv = Math.max(riskPerTradeEuro * 0.15, evPerTradeEuro);
  const tradesNeededPhase1 = Math.max(10, Math.round(phase1TargetEuro / safeEv));
  const tradesNeededPhase2 = Math.max(6, Math.round(phase2TargetEuro / safeEv));

  const daysEstimatedPhase1 = Math.max(5, Math.round(tradesNeededPhase1 / tradesPerDay));
  const daysEstimatedPhase2 = Math.max(4, Math.round(tradesNeededPhase2 / tradesPerDay));

  const passProbabilityPhase1Pct = estimatePhasePassProbability(
    phase1TargetPct,
    maxTotalDDPct,
    winRate,
    rr,
    riskPct
  );

  const passProbabilityPhase2Pct = estimatePhasePassProbability(
    phase2TargetPct,
    maxTotalDDPct,
    winRate,
    rr,
    riskPct
  );

  const rawTotalProb = (passProbabilityPhase1Pct / 100) * (passProbabilityPhase2Pct / 100);
  const passProbabilityTotalPct = Number((rawTotalProb * 100).toFixed(1));

  const consecutiveLossTolerance = Math.floor(maxTotalDDPct / riskPct);
  const expectedCyclesToPass = passProbabilityTotalPct > 0 ? Number((100 / passProbabilityTotalPct).toFixed(1)) : 10;

  const refundEuro = Math.round(fee * (refundPct / 100));
  const expectedTotalCostEuro = Math.round(expectedCyclesToPass * fee - refundEuro);

  const monthlyGrossProfitEuro = Math.round(accountSize * (monthlyReturn / 100));
  const monthlyNetPayoutEuro = Math.round(monthlyGrossProfitEuro * (payoutSplit / 100));
  const firstPayoutWithRefundEuro = monthlyNetPayoutEuro + refundEuro;

  const directBrokerMonthlyProfitEuro = Number((fee * (monthlyReturn / 100)).toFixed(2));

  const initialCapitalRoiMultiplier = directBrokerMonthlyProfitEuro > 0
    ? Number((monthlyNetPayoutEuro / directBrokerMonthlyProfitEuro).toFixed(1))
    : 1;

  const expectedValueCycleEuro = Math.round(monthlyNetPayoutEuro + refundEuro - (fee * expectedCyclesToPass));

  const efficiencyIndex = Math.min(
    99,
    Math.round(
      (passProbabilityTotalPct * 0.4) +
      (Math.min(200, initialCapitalRoiMultiplier) / 200 * 40) +
      (consecutiveLossTolerance >= 15 ? 20 : (consecutiveLossTolerance / 15) * 20)
    )
  );

  return {
    accountSizeEuro: accountSize,
    challengeFeeEuro: fee,
    riskPerTradeEuro,
    riskPerTradePct: riskPct,
    phase1TargetPct,
    phase1TargetEuro,
    tradesNeededPhase1,
    daysEstimatedPhase1,
    passProbabilityPhase1Pct,
    phase2TargetPct,
    phase2TargetEuro,
    tradesNeededPhase2,
    daysEstimatedPhase2,
    passProbabilityPhase2Pct,
    totalTradesEstimated: tradesNeededPhase1 + tradesNeededPhase2,
    totalDaysEstimated: daysEstimatedPhase1 + daysEstimatedPhase2,
    passProbabilityTotalPct,
    consecutiveLossTolerance,
    expectedCyclesToPass,
    expectedTotalCostEuro,
    monthlyGrossProfitEuro,
    monthlyNetPayoutEuro,
    firstPayoutWithRefundEuro,
    directBrokerMonthlyProfitEuro,
    initialCapitalRoiMultiplier,
    expectedValueCycleEuro,
    efficiencyIndex,
  };
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 5. IL PROTOCOLLO IBRIDO AUREUS (PROP-TO-WEALTH PIPELINE)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export interface HybridWealthPipeline {
  allocatedTradingCapitalEuro: number;
  propChallengeBudgetEuro: number;
  propFundedTargetNominalEuro: number;
  sovereignBrokerReserveEuro: number;
  payoutDistribution: {
    toSovereignBrokerPct: number;
    toSovereignBrokerEuro: number;
    toWealthPacEtfPct: number;
    toWealthPacEtfEuro: number;
    toTaxAndRiskShieldPct: number;
    toTaxAndRiskShieldEuro: number;
  };
  narrativeSummary: string;
}

export function calculateHybridLimenAllocation(
  tradingCapitalEuro: number,
  monthlyEstimatedPayoutEuro: number = 2400
): HybridWealthPipeline {
  const cap = Math.max(1000, tradingCapitalEuro);
  const challengeBudget = Math.min(cap * 0.2, 1600);
  const sovereignBrokerReserve = cap - challengeBudget;

  const toBroker = Math.round(monthlyEstimatedPayoutEuro * 0.5);
  const toPac = Math.round(monthlyEstimatedPayoutEuro * 0.3);
  const toShield = Math.round(monthlyEstimatedPayoutEuro * 0.2);

  return {
    allocatedTradingCapitalEuro: cap,
    propChallengeBudgetEuro: Math.round(challengeBudget),
    propFundedTargetNominalEuro: challengeBudget >= 1080 ? 200000 : 100000,
    sovereignBrokerReserveEuro: Math.round(sovereignBrokerReserve),
    payoutDistribution: {
      toSovereignBrokerPct: 50,
      toSovereignBrokerEuro: toBroker,
      toWealthPacEtfPct: 30,
      toWealthPacEtfEuro: toPac,
      toTaxAndRiskShieldPct: 20,
      toTaxAndRiskShieldEuro: toShield,
    },
    narrativeSummary:
      "Il Protocollo Ibrido AUREUS protegge integralmente il tuo patrimonio: rischi solo una frazione minima in challenge fee, generando flussi di cassa istituzionali che finanziano il tuo conto broker personale (FP Markets, XM, Tickmill) e il PAC patrimoniale a lungo termine, a rischio rovina zero.",
  };
}
