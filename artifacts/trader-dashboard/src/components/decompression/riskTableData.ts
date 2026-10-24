/**
 * LIMEN PROTOCOL — Il Banco del Rischio (Trans-Limen Roguelite Poker 3D)
 * Logic engine, 52-card deck generator, hand evaluator, Sigils compendium & persistence.
 */

import {
  MarketCard,
  MarketHandType,
  MarketSuit,
  HandEvaluation,
  SigilCard,
  StartingDeck,
  RoundRequirement,
  MarketVoucher,
  RiskTablePersistence,
} from "./riskTableTypes";

// -------------------------------------------------------------
// 1. CARTE DI MERCATO (52 CARDS)
// -------------------------------------------------------------

export const SUIT_INFO: Record<MarketSuit, { label: string; color: string; hex: string; symbol: string }> = {
  liquidity: { label: "Liquidità", color: "text-emerald-400", hex: "#10b981", symbol: "💧" },
  structure: { label: "Struttura", color: "text-[#E8C56A]", hex: "#C5A059", symbol: "🏛️" },
  volume: { label: "Volume", color: "text-sky-400", hex: "#38bdf8", symbol: "📊" },
  volatility: { label: "Volatilità", color: "text-rose-400", hex: "#ef4444", symbol: "⚡" },
};

export function getRankLabel(rank: number): string {
  switch (rank) {
    case 11:
      return "M15"; // Jack equivalent: Timeframe 15m
    case 12:
      return "H1"; // Queen equivalent: Timeframe 1h
    case 13:
      return "H4"; // King equivalent: Timeframe 4h
    case 14:
      return "D1"; // Ace equivalent: Daily Candle
    default:
      return rank.toString();
  }
}

export function getBaseChipsForRank(rank: number): number {
  if (rank === 14) return 11;
  if (rank >= 11) return 10;
  return rank;
}

export function generateStandardDeck(): MarketCard[] {
  const suits: MarketSuit[] = ["liquidity", "structure", "volume", "volatility"];
  const deck: MarketCard[] = [];

  for (const suit of suits) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({
        id: `card_${suit}_${rank}`,
        rank,
        suit,
        baseChips: getBaseChipsForRank(rank),
        foil: "none",
      });
    }
  }

  return shuffleDeck(deck);
}

export function shuffleDeck<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// -------------------------------------------------------------
// 2. VALUTAZIONE DELLE MANI DI MERCATO (POKER LOGIC)
// -------------------------------------------------------------

export const HAND_BASE_SCORES: Record<
  MarketHandType,
  { name: string; baseChips: number; baseMult: number; description: string }
> = {
  high_card: {
    name: "Candela Singola",
    baseChips: 5,
    baseMult: 1,
    description: "La singola carta con il rango più elevato sul book.",
  },
  pair: {
    name: "Doppio Livello",
    baseChips: 10,
    baseMult: 2,
    description: "2 carte dello stesso rango (es. doppio M15 o doppio 8).",
  },
  two_pair: {
    name: "Range Strutturale",
    baseChips: 20,
    baseMult: 2,
    description: "2 coppie distinte che delimitano un canale di prezzo.",
  },
  three_of_a_kind: {
    name: "Tris di Conferma",
    baseChips: 30,
    baseMult: 3,
    description: "3 carte identiche di confluenza su timeframe differenti.",
  },
  straight: {
    name: "Scala di Ciclo",
    baseChips: 35,
    baseMult: 4,
    description: "5 carte in sequenza continua di timeframe o valori.",
  },
  flush: {
    name: "Allineamento di Flusso",
    baseChips: 40,
    baseMult: 4,
    description: "5 carte che condividono lo stesso Seme di mercato.",
  },
  full_house: {
    name: "Full House Wyckoff",
    baseChips: 45,
    baseMult: 5,
    description: "Un Tris di Accumulazione e una Coppia di Spring.",
  },
  four_of_a_kind: {
    name: "Blocco Istituzionale",
    baseChips: 60,
    baseMult: 7,
    description: "4 carte dello stesso rango: dominanza totale degli algoritmi.",
  },
  straight_flush: {
    name: "Convergenza dei Timeframe",
    baseChips: 100,
    baseMult: 8,
    description: "5 carte consecutive dello stesso identico Seme.",
  },
  royal_flush: {
    name: "La Convergenza Sovrana",
    baseChips: 150,
    baseMult: 10,
    description: "La sequenza massima (10, M15, H1, H4, D1) dello stesso Seme.",
  },
};

export function evaluateMarketHand(
  selectedCards: MarketCard[],
  activeSigils: SigilCard[] = [],
  isSqueeze: boolean = false
): HandEvaluation {
  if (selectedCards.length === 0) {
    return {
      handType: "high_card",
      handName: "Nessuna Carta",
      baseChips: 0,
      baseMult: 0,
      scoredCards: [],
      bonusChips: 0,
      bonusMult: 0,
      totalScore: 0,
    };
  }

  // Ordina per rango decrescente
  const sorted = [...selectedCards].sort((a, b) => b.rank - a.rank);

  // Mappa frequenze dei ranghi
  const rankCounts: Record<number, number> = {};
  for (const card of sorted) {
    rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
  }

  // Mappa frequenze dei semi
  const suitCounts: Record<MarketSuit, number> = {
    liquidity: 0,
    structure: 0,
    volume: 0,
    volatility: 0,
  };
  for (const card of sorted) {
    suitCounts[card.suit]++;
  }

  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const isFlush = sorted.length >= 5 && Object.values(suitCounts).some((c) => c >= 5);

  // Controllo Scala (Straight)
  const hasFvgBridge = activeSigils.some((s) => s.effectType === "fvg_straight_bridge");
  const isStraight = checkStraight(sorted, hasFvgBridge);

  let handType: MarketHandType = "high_card";
  let scoredCards = sorted;

  if (isFlush && isStraight) {
    // Verifica se è Royal Flush (10, 11, 12, 13, 14)
    const ranks = sorted.map((c) => c.rank);
    if (ranks.includes(14) && ranks.includes(13) && ranks.includes(12) && ranks.includes(11) && ranks.includes(10)) {
      handType = "royal_flush";
    } else {
      handType = "straight_flush";
    }
  } else if (counts[0] === 4) {
    handType = "four_of_a_kind";
    const quadRank = Number(Object.keys(rankCounts).find((r) => rankCounts[Number(r)] === 4));
    scoredCards = sorted.filter((c) => c.rank === quadRank);
  } else if (counts[0] === 3 && counts[1] >= 2) {
    handType = "full_house";
  } else if (isFlush) {
    handType = "flush";
  } else if (isStraight) {
    handType = "straight";
  } else if (counts[0] === 3) {
    handType = "three_of_a_kind";
    const tripRank = Number(Object.keys(rankCounts).find((r) => rankCounts[Number(r)] === 3));
    scoredCards = sorted.filter((c) => c.rank === tripRank);
  } else if (counts[0] === 2 && counts[1] === 2) {
    handType = "two_pair";
    const pairRanks = Object.keys(rankCounts)
      .filter((r) => rankCounts[Number(r)] === 2)
      .map(Number);
    scoredCards = sorted.filter((c) => pairRanks.includes(c.rank));
  } else if (counts[0] === 2) {
    handType = "pair";
    const pairRank = Number(Object.keys(rankCounts).find((r) => rankCounts[Number(r)] === 2));
    scoredCards = sorted.filter((c) => c.rank === pairRank);
  } else {
    handType = "high_card";
    scoredCards = [sorted[0]];
  }

  const baseDef = HAND_BASE_SCORES[handType];
  let chips = baseDef.baseChips;
  let mult = baseDef.baseMult;

  // Aggiungi fiches delle singole carte valutate
  let cardChips = 0;
  for (const card of scoredCards) {
    cardChips += card.baseChips;
  }
  chips += cardChips;

  // Calcola bonus dai Sigilli (Jokers)
  let bonusChips = 0;
  let bonusMult = 0;

  for (const sigil of activeSigils) {
    switch (sigil.effectType) {
      case "mult_on_suit":
        // es. Breakout Impulsivo: +4 mult se c'è almeno una carta di volatilità
        if (scoredCards.some((c) => c.suit === "volatility")) {
          bonusMult += 4;
        }
        break;

      case "chips_on_suit":
        // es. Cacciatore di Liquidità: +20 chips per ogni carta Smeraldo
        const emeraldCount = scoredCards.filter((c) => c.suit === "liquidity").length;
        bonusChips += emeraldCount * 20;
        break;

      case "mult_on_hand_type":
        // Wyckoff: +3 mult per Full House o Scala
        if (handType === "full_house" || handType === "straight") {
          bonusMult += 5;
        }
        break;

      case "chips_on_pair":
        if (handType === "pair" || handType === "two_pair") {
          bonusChips += 25;
        }
        break;

      case "three_suits_mult":
        const uniqueSuits = new Set(scoredCards.map((c) => c.suit)).size;
        if (uniqueSuits >= 3) {
          bonusMult += 6;
        }
        break;

      case "ace_solo_nuke":
        if (sorted.length === 1 && sorted[0].rank === 14) {
          bonusChips += 100;
          bonusMult += 4;
        }
        break;

      case "fibonacci_mult":
        // Ranghi Fibonacci: 2, 3, 5, 8, 13 (Re)
        const fibCards = scoredCards.filter((c) => [2, 3, 5, 8, 13].includes(c.rank)).length;
        bonusMult += fibCards * 2;
        break;

      case "black_swan_crit":
        // Se c'è un Re o Asso, 25% crit mult
        if (scoredCards.some((c) => c.rank >= 13)) {
          bonusMult += 3;
        }
        break;

      default:
        break;
    }
  }

  chips += bonusChips;
  mult += bonusMult;

  // Effetto SQUEEZE (Piramidazione)
  if (isSqueeze) {
    mult *= 2;
  }

  const totalScore = chips * mult;

  return {
    handType,
    handName: baseDef.name,
    baseChips: baseDef.baseChips,
    baseMult: baseDef.baseMult,
    scoredCards,
    bonusChips,
    bonusMult,
    totalScore,
  };
}

function checkStraight(sortedCards: MarketCard[], allowGap: boolean = false): boolean {
  if (sortedCards.length < 5) return false;

  // Prendi ranghi unici ordinati decrescenti
  const uniqueRanks = Array.from(new Set(sortedCards.map((c) => c.rank))).sort((a, b) => b - a);
  if (uniqueRanks.length < 5) return false;

  // Verifica sequenza continua di 5 ranghi
  for (let i = 0; i <= uniqueRanks.length - 5; i++) {
    const slice = uniqueRanks.slice(i, i + 5);
    const isConsecutive =
      slice[0] - slice[1] === 1 &&
      slice[1] - slice[2] === 1 &&
      slice[2] - slice[3] === 1 &&
      slice[3] - slice[4] === 1;

    if (isConsecutive) return true;

    // Se ha l'FVG Sigil, consente 1 solo salto di 2
    if (allowGap) {
      const diffs = [
        slice[0] - slice[1],
        slice[1] - slice[2],
        slice[2] - slice[3],
        slice[3] - slice[4],
      ];
      const gapCount = diffs.filter((d) => d === 2).length;
      const normalCount = diffs.filter((d) => d === 1).length;
      if (gapCount === 1 && normalCount === 3) return true;
    }
  }

  // Verifica Ace-Low Straight (14, 5, 4, 3, 2)
  if (
    uniqueRanks.includes(14) &&
    uniqueRanks.includes(5) &&
    uniqueRanks.includes(4) &&
    uniqueRanks.includes(3) &&
    uniqueRanks.includes(2)
  ) {
    return true;
  }

  return false;
}

// -------------------------------------------------------------
// 3. COMPENDIO DEI SIGILLI (20+ JOKERS DI MERCATO)
// -------------------------------------------------------------

export const SIGIL_CATALOG: SigilCard[] = [
  {
    id: "sigil_mano_ferma",
    name: "La Mano Ferma",
    title: "Sigillo della Disciplina Monastica",
    description: "Il primo FOLD conscio di ogni Ante restituisce l'intero capitale e dona +4 Aurei.",
    lore: "Chi sa tagliare le perdite senza esitazione ha già vinto il 90% della guerra psicologica.",
    costAurei: 4,
    rarity: "comune",
    iconName: "ShieldCheck",
    effectType: "fold_capital_refund",
  },
  {
    id: "sigil_breakout_impulsivo",
    name: "Il Breakout Impulsivo",
    title: "Sigillo della Volatilità Istituzionale",
    description: "+4x Moltiplicatore se la mano contiene almeno 1 carta Volatilità (Rubino).",
    lore: "Quando il prezzo rompe il range con spread ampio, gli algoritmi amplificano l'onda.",
    costAurei: 5,
    rarity: "comune",
    iconName: "Zap",
    effectType: "mult_on_suit",
  },
  {
    id: "sigil_cacciatore_liquidita",
    name: "Cacciatore di Liquidità",
    title: "Sigillo del Book Depth",
    description: "+20 Punti (Chips) per ogni carta di Liquidità (Smeraldo) giocata nella mano.",
    lore: "Gli ordini pendenti non sono barriere, ma carburante per l'inversione.",
    costAurei: 5,
    rarity: "comune",
    iconName: "Droplet",
    effectType: "chips_on_suit",
  },
  {
    id: "sigil_oracolo_wyckoff",
    name: "L'Oracolo di Wyckoff",
    title: "Sigillo delle Fasi Strutturali",
    description: "Le mani 'Full House' e 'Scala' ricevono +5x Moltiplicatore.",
    lore: "Dall'Accumulazione al Markup: ogni ciclo rispetta l'impronta della Smart Money.",
    costAurei: 6,
    rarity: "rara",
    iconName: "Compass",
    effectType: "mult_on_hand_type",
  },
  {
    id: "sigil_hft_algorithm",
    name: "Algoritmo HFT",
    title: "Sigillo della Frequenza Quantitativa",
    description: "Le mani 'Doppio Livello' (Coppia) ricevono permanentemente +25 Punti Chips.",
    lore: "Migliaia di micro-esecuzioni al millisecondo creano una fortezza di liquidità.",
    costAurei: 5,
    rarity: "comune",
    iconName: "Cpu",
    effectType: "chips_on_pair",
  },
  {
    id: "sigil_piramidazione_sovrana",
    name: "Piramidazione Sovrana",
    title: "Sigillo dello Squeeze Perfetto",
    description: "Attivare lo SQUEEZE triplica il punteggio finale anziché raddoppiarlo.",
    lore: "Aggiungere size sul vincitore è l'arte suprema che separa il retail dal gestore.",
    costAurei: 7,
    rarity: "rara",
    iconName: "TrendingUp",
    effectType: "squeeze_enhancer",
  },
  {
    id: "sigil_scalper_freddo",
    name: "Lo Scalper Freddo",
    title: "Sigillo dell'Efficienza di Risorsa",
    description: "Ogni Scarto non utilizzato al superamento del round si converte in +2 Aurei.",
    lore: "Non sprecare munizioni: l'economia del gesto è la virtù del cecchino.",
    costAurei: 6,
    rarity: "comune",
    iconName: "Coins",
    effectType: "unused_discard_aurei",
  },
  {
    id: "sigil_macro_driver",
    name: "Il Macro-Driver",
    title: "Sigillo dell'Intermarket Analysis",
    description: "+6x Moltiplicatore se la mano combinata include carte di almeno 3 Semi diversi.",
    lore: "Valute, indici, materie prime e tassi: la confluenza totale genera la certezza statistica.",
    costAurei: 6,
    rarity: "rara",
    iconName: "Globe",
    effectType: "three_suits_mult",
  },
  {
    id: "sigil_fvg_bridge",
    name: "Il Vuoto di Liquidità (FVG)",
    title: "Sigillo dell'Imbalance Primaria",
    description: "Consente alle Scale di chiudersi anche con 1 solo 'gap' mancante di 2 livelli.",
    lore: "Il mercato tornerà sempre a richiudere l'imbalance prima di proseguire la sua marcia.",
    costAurei: 7,
    rarity: "rara",
    iconName: "GitCommit",
    effectType: "fvg_straight_bridge",
  },
  {
    id: "sigil_candela_istituzionale",
    name: "Candela Istituzionale",
    title: "Sigillo del Daily Marubozu",
    description: "Se giochi una singola carta di rango Asso (D1) da sola, ottieni +100 Chips e +4x Mult.",
    lore: "Una singola candela Daily piena d'intento cancella intere settimane di range rumoroso.",
    costAurei: 6,
    rarity: "comune",
    iconName: "Flame",
    effectType: "ace_solo_nuke",
  },
  {
    id: "sigil_fibonacci_aureo",
    name: "Il Fibonacci Aureo",
    title: "Sigillo della Geometria Sacra",
    description: "+2x Moltiplicatore per ogni carta giocata appartenente ai ranghi 2, 3, 5, 8 e 13 (H4).",
    lore: "La spirale aurea pulsa nei ritracciamenti come nel cuore delle galassie.",
    costAurei: 6,
    rarity: "comune",
    iconName: "Eye",
    effectType: "fibonacci_mult",
  },
  {
    id: "sigil_cigno_nero",
    name: "Il Cigno Nero",
    title: "Sigillo dell'Outlier Probabilistico",
    description: "Le carte di figura (H4, D1) aumentano il moltiplicatore di +3x costante.",
    lore: "L'evento raro che distrugge gli ingenui è la sorgente della più grande abbondanza del preparato.",
    costAurei: 7,
    rarity: "rara",
    iconName: "Sparkles",
    effectType: "black_swan_crit",
  },
  {
    id: "sigil_stop_loss_acciaio",
    name: "Stop Loss d'Acciaio",
    title: "Sigillo della Preservazione",
    description: "Se fallisci un round con punteggio entro il 15% dal target, vieni comunque promosso.",
    lore: "Arrotondare il rendimento alla disciplina: il rigore vale quanto il punto.",
    costAurei: 8,
    rarity: "sovrana",
    iconName: "Shield",
    effectType: "stop_loss_cushion",
  },
  {
    id: "sigil_riserva_sovrana",
    name: "La Riserva Sovrana",
    title: "Sigillo del Tesoro Centrale",
    description: "Ricevi +1 Aureo di interesse per ogni 10 Aurei conservati nel caveau a fine round.",
    lore: "Il capitale attrae capitale: la gestione monetaria crea la sovranità.",
    costAurei: 8,
    rarity: "sovrana",
    iconName: "Crown",
    effectType: "wealth_interest",
  },
];

// -------------------------------------------------------------
// 4. MAZZI DI PARTENZA (STARTING DECKS)
// -------------------------------------------------------------

export const STARTING_DECKS: StartingDeck[] = [
  {
    id: "deck_iniziato",
    name: "Mazzo dell'Iniziato",
    subtitle: "Configurazione Standard Bilanciata",
    description: "52 Carte standard, 4 Mani per round, 3 Scarti e 100% Integrità di partenza.",
    unlocked: true,
    costAureiToUnlock: 0,
    startingAurei: 4,
    bonusHands: 0,
    bonusDiscards: 0,
    bonusMaxIntegrity: 0,
  },
  {
    id: "deck_market_maker",
    name: "Mazzo del Market Maker",
    subtitle: "Liquidità Primaria & HFT",
    description: "+1 Scarto permanente, parte con 12 Aurei e il Sigillo 'Algoritmo HFT' già equipaggiato.",
    unlocked: false,
    costAureiToUnlock: 15,
    startingAurei: 12,
    bonusHands: 0,
    bonusDiscards: 1,
    bonusMaxIntegrity: 0,
    innateSigilId: "sigil_hft_algorithm",
  },
  {
    id: "deck_disciplina",
    name: "Mazzo della Disciplina Stoica",
    subtitle: "L'Arte Suprema del FOLD",
    description: "Integrità estesa al 130%. Il FOLD conscio paga il triplo degli Aurei di salvaguardia.",
    unlocked: false,
    costAureiToUnlock: 25,
    startingAurei: 8,
    bonusHands: 0,
    bonusDiscards: 0,
    bonusMaxIntegrity: 30,
    innateSigilId: "sigil_mano_ferma",
  },
];

// -------------------------------------------------------------
// 5. PROGRESSIONE DEI ROUND (ANTE 1..8+)
// -------------------------------------------------------------

export const ROUND_PROGRESSION: RoundRequirement[] = [
  {
    ante: 1,
    name: "Ciclo I: L'Apertura Asiatica",
    subtitle: "Test di liquidità a basso volume",
    targetScore: 250,
    rewardAurei: 4,
  },
  {
    ante: 2,
    name: "Ciclo II: Breakout di Francoforte",
    subtitle: "Iniezione di volatilità europea",
    targetScore: 600,
    rewardAurei: 5,
  },
  {
    ante: 3,
    name: "Ciclo III: Il Varco di Londra",
    subtitle: "Caccia agli stop loss sui massimi",
    targetScore: 1200,
    rewardAurei: 6,
  },
  {
    ante: 4,
    name: "Ciclo IV: BOSS — L'Uscita CPI",
    subtitle: "Shock sui tassi: le carte volatilità valgono doppio",
    targetScore: 2500,
    rewardAurei: 10,
    specialModifier: "volatility_storm",
  },
  {
    ante: 5,
    name: "Ciclo V: Wall Street Open",
    subtitle: "Il mercato dei giganti istituzionali",
    targetScore: 4500,
    rewardAurei: 8,
  },
  {
    ante: 6,
    name: "Ciclo VI: Il Fix di Londra delle 16:00",
    subtitle: "Ribilanciamento fondi sovrani",
    targetScore: 8000,
    rewardAurei: 9,
  },
  {
    ante: 7,
    name: "Ciclo VII: La Conferenza FOMC",
    subtitle: "Vietati gli scarti nel primo turno",
    targetScore: 14000,
    rewardAurei: 12,
    specialModifier: "no_discards",
  },
  {
    ante: 8,
    name: "Ciclo VIII: BOSS FINALE — Il Titano dell'Orso",
    subtitle: "La resa dei conti contro la Deriva Emotiva",
    targetScore: 25000,
    rewardAurei: 25,
    specialModifier: "boss_bear_blind",
  },
];

// -------------------------------------------------------------
// 6. VOUCHER & SHOP ITEMS
// -------------------------------------------------------------

export const SHOP_VOUCHERS: MarketVoucher[] = [
  {
    id: "voucher_hand_extra",
    name: "Contratto Overtime",
    description: "+1 Mano giocabile per il prossimo Ciclo.",
    costAurei: 4,
    type: "extra_hand",
  },
  {
    id: "voucher_discard_extra",
    name: "Rimescolamento Book",
    description: "+1 Scarto disponibile per il prossimo Ciclo.",
    costAurei: 3,
    type: "extra_discard",
  },
  {
    id: "voucher_integrity_elixir",
    name: "Balsamo Monastico",
    description: "Ripristina +40% di Integrità Mentale.",
    costAurei: 4,
    type: "integrity_restore",
  },
  {
    id: "voucher_qe_grant",
    name: "Iniezione Quantitativa",
    description: "Ricevi immediatamente +10 Aurei nel caveau.",
    costAurei: 6,
    type: "aurei_grant",
  },
];

// -------------------------------------------------------------
// 7. PERSISTENZA LOCALSTORAGE
// -------------------------------------------------------------

const PERSISTENCE_KEY = "limen_risk_table_save_v1";

export function loadRiskTablePersistence(): RiskTablePersistence {
  if (typeof window === "undefined") {
    return {
      totalAurei: 10,
      highestAnteWon: 0,
      totalHandsPlayed: 0,
      totalDisciplinedFolds: 0,
      unlockedDecks: ["deck_iniziato"],
      unlockedSigilIds: [],
      selectedDeckId: "deck_iniziato",
    };
  }

  try {
    const raw = localStorage.getItem(PERSISTENCE_KEY);
    if (!raw) {
      const init: RiskTablePersistence = {
        totalAurei: 10,
        highestAnteWon: 0,
        totalHandsPlayed: 0,
        totalDisciplinedFolds: 0,
        unlockedDecks: ["deck_iniziato"],
        unlockedSigilIds: [],
        selectedDeckId: "deck_iniziato",
      };
      localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(init));
      return init;
    }
    return JSON.parse(raw);
  } catch {
    return {
      totalAurei: 10,
      highestAnteWon: 0,
      totalHandsPlayed: 0,
      totalDisciplinedFolds: 0,
      unlockedDecks: ["deck_iniziato"],
      unlockedSigilIds: [],
      selectedDeckId: "deck_iniziato",
    };
  }
}

export function saveRiskTablePersistence(data: RiskTablePersistence) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(data));
  } catch {}
}
