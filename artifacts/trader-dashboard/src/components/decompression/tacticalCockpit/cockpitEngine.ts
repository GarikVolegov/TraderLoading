/**
 * LIMEN PROTOCOL — Il Cockpit Tattico dell'Ordine (Trans-Limen Tactical Battlefield 3D)
 * Motore di simulazione a turni, campagne storiche, IA algoritmica e risolutore di posizionamento.
 */

import {
  GridCoordinate,
  TileType,
  TacticalUnit,
  TelegraphedSweep,
  GridTileState,
  ScenarioMission,
  TacticalDoctrine,
  CockpitPersistence,
} from "./cockpitTypes";

// =================================================================
// 1. SCENARI STORICI REALI (1987 .. 2026)
// =================================================================

export const SCENARIO_MISSIONS: ScenarioMission[] = [
  {
    id: 1,
    year: "1987",
    name: "Il Black Monday",
    subtitle: "Contenimento del Sell-Off a Cascata",
    historicalContext:
      "19 Ottobre 1987: il Dow cede il 22.6% in un solo giorno a causa dei primi programmi di portfolio insurance a catena.",
    doctrineRule: "Posiziona l'Order Block sulla linea centrale prima che l'Algoritmo travolga il Bastione.",
    gridRows: 7,
    gridCols: 7,
    turnsToSurvive: 4,
    rewardAurei: 35,
    initialUnits: [
      {
        id: "vault-1",
        type: "core_vault",
        name: "Bastione di Capitale",
        position: [6, 3],
        integrity: 100,
        maxIntegrity: 100,
        movementRange: 1,
        costAP: 2,
        hasActedThisTurn: false,
      },
      {
        id: "hunter-1",
        type: "sweep_hunter",
        name: "Sweep Hunter",
        position: [5, 1],
        integrity: 50,
        maxIntegrity: 50,
        movementRange: 3,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "block-1",
        type: "order_block",
        name: "Order Block Fort",
        position: [4, 3],
        integrity: 80,
        maxIntegrity: 80,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "sentinel-1",
        type: "risk_sentinel",
        name: "Risk Sentinel",
        position: [5, 4],
        integrity: 60,
        maxIntegrity: 60,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
    ],
    specialTiles: [
      { coord: [2, 1], type: "liquidity_pool", yieldValue: 15 },
      { coord: [2, 5], type: "liquidity_pool", yieldValue: 15 },
      { coord: [4, 3], type: "mitigation_zone" },
      { coord: [3, 2], type: "fair_value_gap" },
      { coord: [3, 4], type: "fair_value_gap" },
    ],
    generateSweepsForTurn: (turn) => {
      if (turn === 1) {
        return [
          {
            id: "sweep-1",
            type: "directional_sweep",
            targetCoordinates: [
              [0, 3],
              [1, 3],
              [2, 3],
              [3, 3],
            ],
            intensity: 35,
            vectorName: "Cascata Vendite Sell-Program Colonna 3",
            warningMessage: "Spike ribassista in arrivo sulla colonna centrale. Intercetta con l'Order Block!",
            turnsRemaining: 1,
          },
        ];
      }
      if (turn === 2) {
        return [
          {
            id: "sweep-2a",
            type: "directional_sweep",
            targetCoordinates: [
              [1, 1],
              [2, 1],
              [3, 1],
            ],
            intensity: 30,
            vectorName: "Sweep Liquidità Flanco Sinistro",
            warningMessage: "L'Algoritmo punta al Pool di Sinistra. Evacua o scuda con il Sentinel!",
            turnsRemaining: 1,
          },
          {
            id: "sweep-2b",
            type: "directional_sweep",
            targetCoordinates: [
              [1, 5],
              [2, 5],
              [3, 5],
            ],
            intensity: 30,
            vectorName: "Sweep Liquidità Flanco Destro",
            warningMessage: "Spike parallelo sul flanco opposto.",
            turnsRemaining: 1,
          },
        ];
      }
      return [
        {
          id: "sweep-3",
          type: "black_swan_shock",
          targetCoordinates: [
            [3, 0],
            [3, 1],
            [3, 2],
            [3, 3],
            [3, 4],
            [3, 5],
            [3, 6],
          ],
          intensity: 45,
          vectorName: "Onda d'Urto Margin Call Interbancaria",
          warningMessage: "Cigno Nero: shock orizzontale sull'intera linea 3!",
          turnsRemaining: 1,
        },
      ];
    },
  },
  {
    id: 2,
    year: "1992",
    name: "La Rottura della Sterlina",
    subtitle: "La Scommessa Asimmetrica di Soros",
    historicalContext:
      "16 Settembre 1992 (Mercoledì Nero): la Bank of England viene costretta a svalutare ed uscire dallo SME sotto pressione speculativa istituzionale.",
    doctrineRule: "Cattura i pool di sterline prima che la banca centrale esaurisca le sue riserve.",
    gridRows: 7,
    gridCols: 7,
    turnsToSurvive: 5,
    rewardAurei: 45,
    initialUnits: [
      {
        id: "vault-2",
        type: "core_vault",
        name: "Bastione Quantum Fund",
        position: [6, 3],
        integrity: 100,
        maxIntegrity: 100,
        movementRange: 1,
        costAP: 2,
        hasActedThisTurn: false,
      },
      {
        id: "hunter-2",
        type: "sweep_hunter",
        name: "Sweep Hunter",
        position: [5, 2],
        integrity: 50,
        maxIntegrity: 50,
        movementRange: 3,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "block-2",
        type: "order_block",
        name: "Order Block Fort",
        position: [4, 4],
        integrity: 80,
        maxIntegrity: 80,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "sentinel-2",
        type: "risk_sentinel",
        name: "Risk Sentinel",
        position: [5, 5],
        integrity: 60,
        maxIntegrity: 60,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
    ],
    specialTiles: [
      { coord: [1, 2], type: "liquidity_pool", yieldValue: 20 },
      { coord: [1, 4], type: "liquidity_pool", yieldValue: 20 },
      { coord: [3, 3], type: "fair_value_gap" },
      { coord: [5, 3], type: "mitigation_zone" },
    ],
    generateSweepsForTurn: (turn) => {
      if (turn <= 2) {
        return [
          {
            id: `sweep-soros-${turn}`,
            type: "directional_sweep",
            targetCoordinates: [
              [turn, 1],
              [turn, 2],
              [turn, 3],
            ],
            intensity: 30,
            vectorName: "Intervento Difensivo Bank of England",
            warningMessage: "Acquisti disperati a sostegno del peg. Manovra lo Sweep Hunter al riparo.",
            turnsRemaining: 1,
          },
        ];
      }
      return [
        {
          id: `sweep-depeg-${turn}`,
          type: "black_swan_shock",
          targetCoordinates: [
            [2, turn],
            [3, turn],
            [4, turn],
            [5, turn],
          ],
          intensity: 40,
          vectorName: "Onda di Rottura del Peg SME",
          warningMessage: "De-peg confermato: violenta accelerazione della volatilità sulla colonna!",
          turnsRemaining: 1,
        },
      ];
    },
  },
  {
    id: 3,
    year: "2000",
    name: "Lo Scoppio delle Dot-Com",
    subtitle: "Filtrare l'Euforia Irrazionale",
    historicalContext:
      "Marzo 2000: il Nasdaq raggiunge il picco storico per poi crollare del 78%. I falsi pool di liquidità tecnologica intrappolano i trader retail.",
    doctrineRule: "Non inseguire i falsi segnali: raggruppa le unità attorno ai nodi di valore reale.",
    gridRows: 7,
    gridCols: 7,
    turnsToSurvive: 5,
    rewardAurei: 50,
    initialUnits: [
      {
        id: "vault-3",
        type: "core_vault",
        name: "Bastione di Capitale",
        position: [6, 2],
        integrity: 100,
        maxIntegrity: 100,
        movementRange: 1,
        costAP: 2,
        hasActedThisTurn: false,
      },
      {
        id: "hunter-3",
        type: "sweep_hunter",
        name: "Sweep Hunter",
        position: [5, 1],
        integrity: 50,
        maxIntegrity: 50,
        movementRange: 3,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "block-3",
        type: "order_block",
        name: "Order Block Fort",
        position: [4, 2],
        integrity: 80,
        maxIntegrity: 80,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "sentinel-3",
        type: "risk_sentinel",
        name: "Risk Sentinel",
        position: [5, 3],
        integrity: 60,
        maxIntegrity: 60,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
    ],
    specialTiles: [
      { coord: [1, 3], type: "liquidity_pool", yieldValue: 25 },
      { coord: [2, 1], type: "fair_value_gap" },
      { coord: [2, 5], type: "fair_value_gap" },
      { coord: [4, 4], type: "mitigation_zone" },
    ],
    generateSweepsForTurn: (turn) => [
      {
        id: `sweep-dotcom-${turn}`,
        type: "directional_sweep",
        targetCoordinates: [
          [turn - 1, 1],
          [turn - 1, 2],
          [turn - 1, 3],
          [turn - 1, 4],
        ],
        intensity: 35,
        vectorName: "Deflazione a Catena del Multiplo P/E",
        warningMessage: "Collasso delle valutazioni speculative. Mantieni l'Order Block a scudo del Bastione.",
        turnsRemaining: 1,
      },
    ],
  },
  {
    id: 4,
    year: "2008",
    name: "Il Collasso Lehman",
    subtitle: "La Crisi di Controparte Sistemica",
    historicalContext:
      "15 Settembre 2008: il fallimento di Lehman Brothers innesca il panico nel mercato repo interbancario e congela la liquidità globale.",
    doctrineRule: "Usa l'aura del Sentinel per proteggere tutte le unità durante i Cigni Neri simultanei.",
    gridRows: 7,
    gridCols: 7,
    turnsToSurvive: 5,
    rewardAurei: 60,
    initialUnits: [
      {
        id: "vault-4",
        type: "core_vault",
        name: "Bastione di Capitale",
        position: [6, 3],
        integrity: 100,
        maxIntegrity: 100,
        movementRange: 1,
        costAP: 2,
        hasActedThisTurn: false,
      },
      {
        id: "hunter-4",
        type: "sweep_hunter",
        name: "Sweep Hunter",
        position: [5, 1],
        integrity: 50,
        maxIntegrity: 50,
        movementRange: 3,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "block-4",
        type: "order_block",
        name: "Order Block Fort",
        position: [4, 3],
        integrity: 80,
        maxIntegrity: 80,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "sentinel-4",
        type: "risk_sentinel",
        name: "Risk Sentinel",
        position: [5, 4],
        integrity: 60,
        maxIntegrity: 60,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
    ],
    specialTiles: [
      { coord: [0, 3], type: "liquidity_pool", yieldValue: 30 },
      { coord: [2, 2], type: "fair_value_gap" },
      { coord: [2, 4], type: "fair_value_gap" },
      { coord: [5, 2], type: "mitigation_zone" },
      { coord: [5, 4], type: "mitigation_zone" },
    ],
    generateSweepsForTurn: (turn) => [
      {
        id: `sweep-lehman-diag-${turn}`,
        type: "black_swan_shock",
        targetCoordinates: [
          [turn, turn],
          [turn, 6 - turn],
          [turn + 1, turn],
        ],
        intensity: 45,
        vectorName: "Contagio Rischio di Credito Subprime",
        warningMessage: "Sofferenza interbancaria diagonale: serra i ranghi attorno al Sentinel!",
        turnsRemaining: 1,
      },
    ],
  },
  {
    id: 5,
    year: "2010",
    name: "Il Flash Crash",
    subtitle: "Anomalia Algoritmica HFT a Mille Punti",
    historicalContext:
      "6 Maggio 2010: in 36 minuti il mercato azionario perde e recupera quasi 1.000 punti per effetto di algoritmi spoofing e feedback loops.",
    doctrineRule: "Prevedi gli spike istantanei ad alta frequenza. Non farti trovare scoperto.",
    gridRows: 7,
    gridCols: 7,
    turnsToSurvive: 5,
    rewardAurei: 70,
    initialUnits: [
      {
        id: "vault-5",
        type: "core_vault",
        name: "Bastione di Capitale",
        position: [6, 3],
        integrity: 100,
        maxIntegrity: 100,
        movementRange: 1,
        costAP: 2,
        hasActedThisTurn: false,
      },
      {
        id: "hunter-5",
        type: "sweep_hunter",
        name: "Sweep Hunter",
        position: [5, 2],
        integrity: 50,
        maxIntegrity: 50,
        movementRange: 3,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "block-5",
        type: "order_block",
        name: "Order Block Fort",
        position: [3, 3],
        integrity: 80,
        maxIntegrity: 80,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "sentinel-5",
        type: "risk_sentinel",
        name: "Risk Sentinel",
        position: [5, 4],
        integrity: 60,
        maxIntegrity: 60,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
    ],
    specialTiles: [
      { coord: [1, 1], type: "liquidity_pool", yieldValue: 20 },
      { coord: [1, 5], type: "liquidity_pool", yieldValue: 20 },
      { coord: [3, 1], type: "fair_value_gap" },
      { coord: [3, 5], type: "fair_value_gap" },
      { coord: [4, 3], type: "mitigation_zone" },
    ],
    generateSweepsForTurn: (turn) => [
      {
        id: `hft-sweep-${turn}`,
        type: "directional_sweep",
        targetCoordinates: [
          [turn - 1, 2],
          [turn - 1, 3],
          [turn - 1, 4],
          [turn, 3],
        ],
        intensity: 50,
        vectorName: "Algoritmo HFT Spoofing Spike",
        warningMessage: "Spike ad altissima frequenza. La corazza dell'Order Block deve assorbire l'impatto!",
        turnsRemaining: 1,
      },
    ],
  },
  {
    id: 6,
    year: "2015",
    name: "Il De-Peg dello Swiss Franc",
    subtitle: "Lo Shock SNB 1.2000 & Gap Incolmabile",
    historicalContext:
      "15 Gennaio 2015: la Swiss National Bank rimuove all'improvviso il peg con l'Euro a 1.20. I broker falliscono in pochi minuti a causa di gap non coperti.",
    doctrineRule: "Usa il FOLD Conscio o barriere preventive: i gap non offrono prezzo di uscita.",
    gridRows: 8,
    gridCols: 8,
    turnsToSurvive: 6,
    rewardAurei: 85,
    initialUnits: [
      {
        id: "vault-6",
        type: "core_vault",
        name: "Bastione di Capitale",
        position: [7, 3],
        integrity: 100,
        maxIntegrity: 100,
        movementRange: 1,
        costAP: 2,
        hasActedThisTurn: false,
      },
      {
        id: "hunter-6",
        type: "sweep_hunter",
        name: "Sweep Hunter",
        position: [6, 1],
        integrity: 50,
        maxIntegrity: 50,
        movementRange: 3,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "block-6",
        type: "order_block",
        name: "Order Block Fort",
        position: [5, 3],
        integrity: 80,
        maxIntegrity: 80,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "sentinel-6",
        type: "risk_sentinel",
        name: "Risk Sentinel",
        position: [6, 4],
        integrity: 60,
        maxIntegrity: 60,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
    ],
    specialTiles: [
      { coord: [1, 2], type: "liquidity_pool", yieldValue: 30 },
      { coord: [1, 5], type: "liquidity_pool", yieldValue: 30 },
      { coord: [3, 2], type: "fair_value_gap" },
      { coord: [3, 3], type: "fair_value_gap" },
      { coord: [3, 4], type: "fair_value_gap" },
      { coord: [3, 5], type: "fair_value_gap" },
      { coord: [5, 3], type: "mitigation_zone" },
    ],
    generateSweepsForTurn: (turn) => [
      {
        id: `snb-shock-${turn}`,
        type: "black_swan_shock",
        targetCoordinates: [
          [turn + 1, 1],
          [turn + 1, 2],
          [turn + 1, 3],
          [turn + 1, 4],
          [turn + 1, 5],
          [turn + 1, 6],
        ],
        intensity: 55,
        vectorName: "Gap Sismico SNB Peg Removal",
        warningMessage: "Onda sismica da 2.000 pips! Schiera l'Order Block o esegui il FOLD Conscio di sicurezza.",
        turnsRemaining: 1,
      },
    ],
  },
  {
    id: 7,
    year: "2026",
    name: "Il Nesso Quantistico AUREUS",
    subtitle: "La Battaglia della Sovranità Operativa",
    historicalContext:
      "La soglia tra uomo e algoritmo: l'Operatore dell'Ordine domina l'intero book multi-asset contro l'intelligenza artificiale di mercato.",
    doctrineRule: "Maestria assoluta del posizionamento: trasforma ogni sweep avverso in rendimento sovrano.",
    gridRows: 8,
    gridCols: 8,
    turnsToSurvive: 6,
    rewardAurei: 120,
    initialUnits: [
      {
        id: "vault-7",
        type: "core_vault",
        name: "Bastione Sovrano",
        position: [7, 4],
        integrity: 100,
        maxIntegrity: 100,
        movementRange: 1,
        costAP: 2,
        hasActedThisTurn: false,
      },
      {
        id: "hunter-7",
        type: "sweep_hunter",
        name: "Sweep Hunter",
        position: [6, 2],
        integrity: 50,
        maxIntegrity: 50,
        movementRange: 3,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "block-7",
        type: "order_block",
        name: "Order Block Fort",
        position: [4, 4],
        integrity: 90,
        maxIntegrity: 90,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
      {
        id: "sentinel-7",
        type: "risk_sentinel",
        name: "Risk Sentinel",
        position: [6, 5],
        integrity: 70,
        maxIntegrity: 70,
        movementRange: 2,
        costAP: 1,
        hasActedThisTurn: false,
      },
    ],
    specialTiles: [
      { coord: [0, 2], type: "liquidity_pool", yieldValue: 35 },
      { coord: [0, 5], type: "liquidity_pool", yieldValue: 35 },
      { coord: [2, 3], type: "mitigation_zone" },
      { coord: [2, 4], type: "mitigation_zone" },
      { coord: [4, 1], type: "fair_value_gap" },
      { coord: [4, 6], type: "fair_value_gap" },
    ],
    generateSweepsForTurn: (turn) => [
      {
        id: `limen-nexus-sweep-${turn}`,
        type: "directional_sweep",
        targetCoordinates: [
          [turn, 3],
          [turn, 4],
          [turn + 1, 3],
          [turn + 1, 4],
        ],
        intensity: 60,
        vectorName: "Iniezione Algoritmica Quantum Sweep",
        warningMessage: "Attacco al corridoio centrale! Difendi il bastione o incanala il flusso.",
        turnsRemaining: 1,
      },
    ],
  },
];

// =================================================================
// 2. ARSENALE DELL'ORDINE: DOTTRINE TATTICHE SBLOCCABILI
// =================================================================

export const TACTICAL_DOCTRINES: TacticalDoctrine[] = [
  {
    id: "doctrine-iceberg",
    name: "Ordine Iceberg",
    category: "order_type",
    description: "L'Order Block assorbe il primo sweep nemico senza subire alcun danno da drawdown.",
    costAurei: 30,
    effectType: "iceberg_order",
  },
  {
    id: "doctrine-sentinel-aura",
    name: "Aura Espansa del Sentinel",
    category: "defense",
    description: "Estende l'aura protettiva del Sentinel a 2 caselle di raggio invece di 1.",
    costAurei: 45,
    effectType: "trailing_sentinel",
  },
  {
    id: "doctrine-margin-boost",
    name: "Margine di Sicurezza Istituzionale",
    category: "defense",
    description: "Aumenta la corazza iniziale del Bastione di Capitale da 100 a 130 punti.",
    costAurei: 35,
    effectType: "margin_reinforcement",
  },
  {
    id: "doctrine-fvg-teleport",
    name: "Propulsione FVG",
    category: "intel",
    description: "Lo Sweep Hunter può saltare istantaneamente da un Fair Value Gap a qualsiasi altro FVG.",
    costAurei: 50,
    effectType: "fvg_teleport",
  },
  {
    id: "doctrine-instant-mitigation",
    name: "Mitigazione Lampo",
    category: "order_type",
    description: "Fortificare un Order Block ripristina all'istante 20 punti di integrità consumando 1 AP.",
    costAurei: 40,
    effectType: "instant_mitigation",
  },
];

// =================================================================
// 3. PERSISTENZA & STORAGE
// =================================================================

const COCKPIT_PERSISTENCE_KEY = "limen_tactical_cockpit_save_v1";

export function loadCockpitPersistence(): CockpitPersistence {
  if (typeof window === "undefined") {
    return {
      unlockedScenarioId: 1,
      completedScenarioIds: [],
      totalAurei: 50,
      totalDisciplinedFolds: 0,
      unlockedDoctrineIds: [],
      activeBoardSkin: "obsidian_gold",
    };
  }

  try {
    const raw = localStorage.getItem(COCKPIT_PERSISTENCE_KEY);
    if (!raw) {
      const initial: CockpitPersistence = {
        unlockedScenarioId: 1,
        completedScenarioIds: [],
        totalAurei: 50,
        totalDisciplinedFolds: 0,
        unlockedDoctrineIds: [],
        activeBoardSkin: "obsidian_gold",
      };
      localStorage.setItem(COCKPIT_PERSISTENCE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return {
      unlockedScenarioId: 1,
      completedScenarioIds: [],
      totalAurei: 50,
      totalDisciplinedFolds: 0,
      unlockedDoctrineIds: [],
      activeBoardSkin: "obsidian_gold",
    };
  }
}

export function saveCockpitPersistence(data: CockpitPersistence) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COCKPIT_PERSISTENCE_KEY, JSON.stringify(data));
  } catch {}
}

// =================================================================
// 4. LOGICA DI MOVIMENTO E AZIONI
// =================================================================

export function getLegalMovesForUnit(
  unit: TacticalUnit,
  units: TacticalUnit[],
  gridRows: number,
  gridCols: number
): GridCoordinate[] {
  const [ur, uc] = unit.position;
  const moves: GridCoordinate[] = [];
  const range = unit.movementRange;

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if (r === ur && c === uc) continue;

      // Distanza di Manhattan
      const dist = Math.abs(r - ur) + Math.abs(c - uc);
      if (dist <= range) {
        // Nessun'altra unità sulla cella di destinazione
        const isOccupied = units.some((u) => u.id !== unit.id && u.position[0] === r && u.position[1] === c);
        if (!isOccupied) {
          moves.push([r, c]);
        }
      }
    }
  }

  return moves;
}

export function isTileProtectedBySentinel(
  coord: GridCoordinate,
  units: TacticalUnit[],
  sentinelAuraRange: number = 1
): boolean {
  const sentinels = units.filter((u) => u.type === "risk_sentinel" && u.integrity > 0);
  return sentinels.some((s) => {
    const dist = Math.max(Math.abs(s.position[0] - coord[0]), Math.abs(s.position[1] - coord[1]));
    return dist <= sentinelAuraRange;
  });
}
