import {
  type DisciplineCard,
  type MarketEnemy,
  type Relic,
  type OracleDilemma,
  type ExpeditionNode,
} from "./chroniclesTypes";

// -------------------------------------------------------------
// DISCIPLINE DECK (CARTE DELL'ORDINE)
// -------------------------------------------------------------

export const STARTER_DECK: DisciplineCard[] = [
  {
    id: "card_trailing_stop",
    name: "Trailing Stop",
    type: "defense",
    rarity: "common",
    costMana: 1,
    description: "Genera 9 punti di Barriera Protettiva.",
    shieldGain: 9,
  },
  {
    id: "card_trailing_stop_2",
    name: "Trailing Stop",
    type: "defense",
    rarity: "common",
    costMana: 1,
    description: "Genera 9 punti di Barriera Protettiva.",
    shieldGain: 9,
  },
  {
    id: "card_liquidity_hunt",
    name: "Caccia alla Liquidità",
    type: "attack",
    rarity: "common",
    costMana: 1,
    description: "Infligge 10 danni alla resistenza del mercato.",
    damageValue: 10,
  },
  {
    id: "card_liquidity_hunt_2",
    name: "Caccia alla Liquidità",
    type: "attack",
    rarity: "common",
    costMana: 1,
    description: "Infligge 10 danni alla resistenza del mercato.",
    damageValue: 10,
  },
  {
    id: "card_conscious_inaction",
    name: "Inazione Conscia",
    type: "zen",
    rarity: "uncommon",
    costMana: 1,
    description: "Ripristina 8 Integrità Mentale e genera 4 Barriera.",
    sanityHeal: 8,
    shieldGain: 4,
  },
  {
    id: "card_wyckoff_absorb",
    name: "Assorbimento di Wyckoff",
    type: "utility",
    rarity: "uncommon",
    costMana: 2,
    description: "Infligge 14 danni e converte 10 punti in Aurei.",
    damageValue: 14,
    specialEffect: "convert_coins",
    effectValue: 10,
  },
];

export const UNLOCKABLE_CARDS: DisciplineCard[] = [
  {
    id: "card_stoic_breath",
    name: "Respiro Stoico",
    type: "zen",
    rarity: "uncommon",
    costMana: 1,
    description: "Guarisce 15 Integrità Mentale e pesca 1 carta.",
    sanityHeal: 15,
    specialEffect: "draw_cards",
    effectValue: 1,
  },
  {
    id: "card_focused_breakout",
    name: "Breakout Concentrato",
    type: "attack",
    rarity: "uncommon",
    costMana: 2,
    description: "Sferra un fendente istituzionale da 24 danni.",
    damageValue: 24,
  },
  {
    id: "card_fibonacci_shield",
    name: "Scudo Aureo di Fibonacci",
    type: "defense",
    rarity: "legendary",
    costMana: 2,
    description: "Genera 22 punti di Barriera Protettiva.",
    shieldGain: 22,
  },
  {
    id: "card_architect_eye",
    name: "Occhio dell'Architetto",
    type: "utility",
    rarity: "legendary",
    costMana: 1,
    description: "Pesca 2 carte e riduce a 0 il costo della prossima carta.",
    specialEffect: "draw_cards",
    effectValue: 2,
  },
];

// -------------------------------------------------------------
// RELICS (RELIQUIE DEL CAPITALE)
// -------------------------------------------------------------

export const EXPEDITION_RELICS: Relic[] = [
  {
    id: "relic_steady_hand",
    name: "Mano Ferma",
    description: "All'inizio di ogni turno, ottieni automaticamente +3 Barriera Protettiva.",
    iconName: "Shield",
  },
  {
    id: "relic_gann_sextant",
    name: "Sestante di Gann",
    description: "Gli attacchi infliggono +4 danni aggiuntivi alle anomalie.",
    iconName: "Compass",
  },
  {
    id: "relic_discipline_stone",
    name: "Pietra di Disciplina",
    description: "Le carte di tipo 'Zen' guariscono +5 Integrità Mentale addizionale.",
    iconName: "Sparkles",
  },
  {
    id: "relic_order_hourglass",
    name: "Clessidra dell'Ordine",
    description: "Inizi ogni combattimento con 1 Mana aggiuntivo al primo turno.",
    iconName: "Clock",
  },
];

// -------------------------------------------------------------
// MARKET ENEMIES (ANOMALIE DI MERCATO)
// -------------------------------------------------------------

export const SECTOR_ENEMIES: Record<number, MarketEnemy[]> = {
  1: [
    {
      id: "enemy_hft_bot",
      name: "Algoritmo HFT",
      title: "Micro-oscillazioni a frequenza frenetica",
      maxHp: 32,
      currentHp: 32,
      nextIntent: { type: "attack", value: 8, description: "Micro-arbitraggio (8 Danni)" },
      spriteType: "hft_bot",
    },
    {
      id: "enemy_noise",
      name: "Rumore di Notizia",
      title: "Titoli allarmistici senza sostanza",
      maxHp: 38,
      currentHp: 38,
      nextIntent: { type: "debuff", value: 6, description: "Genera Ansia (-6 Integrità)" },
      spriteType: "hft_bot",
    },
  ],
  2: [
    {
      id: "enemy_stop_hunter",
      name: "Cacciatore di Stop",
      title: "Entità predatrice dei massimi e minimi",
      maxHp: 48,
      currentHp: 48,
      nextIntent: { type: "squeeze", value: 14, description: "Caccia Aggressiva (14 Danni)" },
      spriteType: "stop_hunter",
    },
    {
      id: "enemy_fakeout",
      name: "Falsa Rottura",
      title: "Illusione di rottura dei massimi storici",
      maxHp: 52,
      currentHp: 52,
      nextIntent: { type: "attack", value: 12, description: "Reiezione Violenta (12 Danni)" },
      spriteType: "breakout_trap",
    },
  ],
  3: [
    {
      id: "enemy_fomo",
      name: "Spettro del FOMO",
      title: "La voce oscura che incita a entrare in ritardo",
      maxHp: 65,
      currentHp: 65,
      nextIntent: { type: "squeeze", value: 18, description: "Trappola della Cupidigia (18 Danni)" },
      spriteType: "fomo_wraith",
    },
  ],
  4: [
    {
      id: "boss_drift_shadow",
      name: "L'Ombra della Deriva",
      title: "Incarnazione del Tilt, della Rivalsa e della Rovina",
      maxHp: 95,
      currentHp: 95,
      nextIntent: { type: "attack", value: 22, description: "Rivalsa Distruttiva (22 Danni)" },
      spriteType: "drift_shadow_boss",
    },
  ],
};

// -------------------------------------------------------------
// ORACLE DILEMMAS (BIVI DECISIONALI DEL TRADER)
// -------------------------------------------------------------

export const ORACLE_DILEMMAS: OracleDilemma[] = [
  {
    id: "dilemma_social_noise",
    title: "La Riprova Sociale nel Corridoio",
    scenarioText:
      "Nelle chat retail e sui social, centinaia di trader urlano che il mercato sta per crollare e consigliano di chiudere immediatamente la posizione in anticipo per paura.",
    choices: [
      {
        text: "Chiudi le chat, confida nella statistica e mantieni il piano.",
        outcomeText:
          "La mente si schiarisce. La disciplina protegge il trade. Ricevi la reliquia 'Mano Ferma'!",
        effect: {
          sanityDelta: +15,
          relicReward: EXPEDITION_RELICS[0],
        },
      },
      {
        text: "Apri un trade opposto di copertura ('hedge') dettato dal panico.",
        outcomeText:
          "Hai ceduto alla voce della folla. La commissione e il rimorso logorano la mente (-20 Integrità).",
        effect: {
          sanityDelta: -20,
          coinsDelta: +30,
        },
      },
    ],
  },
  {
    id: "dilemma_deep_pullback",
    title: "Il Ritracciamento Profondo",
    scenarioText:
      "Una candela violenta ritraccia a 2 pips dal tuo Stop Loss programmato. Il dito trema sul tasto 'Chiudi a Mercato' per salvare gli ultimi spiccioli.",
    choices: [
      {
        text: "Mani staccate dal mouse. Il rischio era già calcolato ed accettato prima di entrare.",
        outcomeText:
          "Il mercato tocca il livello e rimbalza con precisione millimetrica. L'Integrità cresce trionfalmente!",
        effect: {
          sanityDelta: +25,
          coinsDelta: +50,
        },
      },
      {
        text: "Sposta lo Stop Loss più indietro per evitare di prendere la perdita.",
        outcomeText:
          "Violazione cardine del Codice LIMEN. La Deriva si fa strada nella tua coscienza (-35 Integrità).",
        effect: {
          sanityDelta: -35,
        },
      },
    ],
  },
  {
    id: "dilemma_parabolic_temptation",
    title: "Il Canto delle Sirene del FOMO",
    scenarioText:
      "Un asset sconosciuto sta salendo in verticale del +300%. Tutti festeggiano guadagni effimeri. Senti la tentazione di deviare una frazione del tuo capitale su di esso.",
    choices: [
      {
        text: "Ignora l'illusione. Il tuo metodo ha regole immutabili; non insegui la folla.",
        outcomeText:
          "Pochi minuti dopo l'asset crolla a zero. Ti sei salvato grazie al Codice (+15 Integrità, +1 Carta Rara).",
        effect: {
          sanityDelta: +15,
          cardReward: UNLOCKABLE_CARDS[1],
        },
      },
      {
        text: "Compri sui massimi sperando in un ultimo balzo speculativo.",
        outcomeText:
          "Sei diventato la liquidità d'uscita dei market maker. Integrità compromessa (-30 Integrità).",
        effect: {
          sanityDelta: -30,
        },
      },
    ],
  },
];

// Helper to generate a 5-step expedition sector
export function generateExpeditionSectorNodes(sectorIndex: number): ExpeditionNode[] {
  const steps: ExpeditionNode[] = [];
  const titles = [
    "Soglia di Rilevamento",
    "Bivio delle Emozioni",
    "Oasi di Consolidamento",
    "Bazar dell'Arsenale",
    sectorIndex === 4 ? "Il Santuario della Deriva (Boss)" : "Guardiano del Settore",
  ];

  for (let step = 0; step < 5; step++) {
    let type: ExpeditionNode["type"] = "battle";
    if (step === 1) type = "oracle";
    else if (step === 2) type = "oasis";
    else if (step === 3) type = "bazaar";
    else if (step === 4) type = "boss";

    steps.push({
      id: `node_s${sectorIndex}_step${step}`,
      sectorIndex,
      stepIndex: step,
      laneIndex: 1,
      type,
      title: titles[step],
      completed: false,
      available: step === 0,
    });
  }
  return steps;
}
