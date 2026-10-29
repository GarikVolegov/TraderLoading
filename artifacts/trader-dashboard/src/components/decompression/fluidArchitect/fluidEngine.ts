/**
 * LIMEN PROTOCOL — L'Architetto dei Flussi (3D Spatial Logic & Resource Routing)
 * Pure TypeScript Graph Solver, Port Matching, Flow Simulator, Level Catalog & Persistence.
 */

import {
  DIRECTION,
  FluidLevel,
  FluidNode,
  FluidPersistence,
  PipeType,
} from "./fluidTypes";

// -------------------------------------------------------------
// 1. PIPE PORT DEFINITIONS & ROTATION
// -------------------------------------------------------------

// Base port configuration at rotation = 0°
const BASE_PORTS: Record<PipeType, number> = {
  straight: DIRECTION.NORTH | DIRECTION.SOUTH,
  elbow: DIRECTION.NORTH | DIRECTION.EAST,
  tee: DIRECTION.NORTH | DIRECTION.EAST | DIRECTION.SOUTH,
  cross: DIRECTION.NORTH | DIRECTION.EAST | DIRECTION.SOUTH | DIRECTION.WEST,
  source: DIRECTION.SOUTH, // Inflows southward by default
  vault: DIRECTION.NORTH,  // Receives flow from the north by default
  filter: DIRECTION.NORTH | DIRECTION.SOUTH,
  capacitor: DIRECTION.NORTH | DIRECTION.SOUTH,
  empty: 0,
};

/**
 * Rotate port bitmask by 90-degree increments
 */
export function getRotatedPorts(pipeType: PipeType, rotationDegrees: number): number {
  let ports = BASE_PORTS[pipeType] || 0;
  const steps = Math.floor((rotationDegrees % 360) / 90);

  for (let s = 0; s < steps; s++) {
    let nextPorts = 0;
    if (ports & DIRECTION.NORTH) nextPorts |= DIRECTION.EAST;
    if (ports & DIRECTION.EAST) nextPorts |= DIRECTION.SOUTH;
    if (ports & DIRECTION.SOUTH) nextPorts |= DIRECTION.WEST;
    if (ports & DIRECTION.WEST) nextPorts |= DIRECTION.NORTH;
    ports = nextPorts;
  }

  return ports;
}

// -------------------------------------------------------------
// 2. GRAPH CONNECTIVITY SOLVER & FLOW TRACE
// -------------------------------------------------------------

export interface FlowTraceResult {
  activeNodeIds: string[];
  isVaultReached: boolean;
  leakCount: number;
  flowRate: number; // 0..100%
  drawdownPressure: number; // 0..100%
}

export function evaluateGridCircuit(
  grid: FluidNode[][],
  gridRows: number,
  gridCols: number
): FlowTraceResult {
  // Find Source nodes
  const sources: FluidNode[] = [];
  let vaultNode: FluidNode | null = null;

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const node = grid[r][c];
      if (node.type === "source") sources.push(node);
      if (node.type === "vault") vaultNode = node;
    }
  }

  if (sources.length === 0) {
    return {
      activeNodeIds: [],
      isVaultReached: false,
      leakCount: 0,
      flowRate: 0,
      drawdownPressure: 0,
    };
  }

  const activeSet = new Set<string>();
  const queue: Array<{ r: number; c: number; fromDir?: number }> = [];

  sources.forEach((src) => {
    activeSet.add(src.id);
    queue.push({ r: src.row, c: src.col });
  });

  let leakCount = 0;
  let isVaultReached = false;

  // Directions mapping: [dr, dc, outPort, inPortOpposite]
  const NEIGHBORS = [
    { dr: -1, dc: 0, outPort: DIRECTION.NORTH, inPort: DIRECTION.SOUTH },
    { dr: 0, dc: 1, outPort: DIRECTION.EAST, inPort: DIRECTION.WEST },
    { dr: 1, dc: 0, outPort: DIRECTION.SOUTH, inPort: DIRECTION.NORTH },
    { dr: 0, dc: -1, outPort: DIRECTION.WEST, inPort: DIRECTION.EAST },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const node = grid[current.r][current.c];
    if (!node || node.type === "empty") continue;

    if (node.type === "vault") {
      isVaultReached = true;
    }

    const currentPorts = getRotatedPorts(node.type, node.rotation);

    for (const { dr, dc, outPort, inPort } of NEIGHBORS) {
      // Check if current node emits fluid in this direction
      if (!(currentPorts & outPort)) continue;

      const nr = current.r + dr;
      const nc = current.c + dc;

      // Out of bounds = leak!
      if (nr < 0 || nr >= gridRows || nc < 0 || nc >= gridCols) {
        if (node.type !== "source") leakCount++;
        continue;
      }

      const neighbor = grid[nr][nc];
      if (!neighbor || neighbor.type === "empty") {
        leakCount++;
        continue;
      }

      const neighborPorts = getRotatedPorts(neighbor.type, neighbor.rotation);

      // Check if neighbor receives fluid from opposite port
      if (neighborPorts & inPort) {
        if (!activeSet.has(neighbor.id)) {
          activeSet.add(neighbor.id);
          queue.push({ r: nr, c: nc });
        }
      } else {
        // Disconnect leak
        leakCount++;
      }
    }
  }

  // Calculate drawdown pressure: rises with leaks, drops when vault is cleanly connected
  let drawdownPressure = Math.min(100, leakCount * 22);
  if (isVaultReached && leakCount === 0) {
    drawdownPressure = 0;
  }

  const flowRate = isVaultReached ? (leakCount === 0 ? 100 : 60) : 0;

  return {
    activeNodeIds: Array.from(activeSet),
    isVaultReached,
    leakCount,
    flowRate,
    drawdownPressure,
  };
}

// -------------------------------------------------------------
// 3. CURATED LEVEL CATALOG (5 ERE ECONOMICHE)
// -------------------------------------------------------------

export const FLUID_LEVELS: FluidLevel[] = [
  {
    id: "era_amsterdam_1602",
    era: "Era I: La Borsa di Amsterdam (1602)",
    title: "La Prima Tubatura di Liquidità",
    subtitle: "Allinea i canali primari per convogliare il capitale iniziale nel caveau.",
    lore: "I mercanti della VOC capirono che il capitale deve scorrere privo di attrito per generare abbondanza.",
    gridRows: 3,
    gridCols: 3,
    targetQuota: 80,
    rewardAurei: 5,
    parTimeSeconds: 45,
    nodes: [
      { row: 0, col: 0, type: "source", rotation: 0, isFixed: true, fluidType: "clean_emerald" }, // Source top-left (outputs S)
      { row: 0, col: 1, type: "elbow", rotation: 90 },
      { row: 0, col: 2, type: "straight", rotation: 0 },
      { row: 1, col: 0, type: "elbow", rotation: 0 },
      { row: 1, col: 1, type: "straight", rotation: 90 },
      { row: 1, col: 2, type: "elbow", rotation: 270 },
      { row: 2, col: 0, type: "straight", rotation: 90 },
      { row: 2, col: 1, type: "straight", rotation: 0 },
      { row: 2, col: 2, type: "vault", rotation: 0, isFixed: true, fluidType: "gold_reserve" }, // Vault bottom-right (accepts N)
    ],
  },
  {
    id: "era_bretton_woods_1944",
    era: "Era II: L'Accordo di Bretton Woods (1944)",
    title: "Il Filtro dell'Ancora Aurea",
    subtitle: "Inserisci il Filtro Anti-Slippage sul corridoio centrale prima del Caveau.",
    lore: "Ancorare le valute all'oro richiede un filtro d'integrità che impedisca la diluizione inflattiva.",
    gridRows: 4,
    gridCols: 4,
    targetQuota: 120,
    rewardAurei: 7,
    parTimeSeconds: 60,
    nodes: [
      { row: 0, col: 1, type: "source", rotation: 0, isFixed: true, fluidType: "clean_emerald" },
      { row: 0, col: 2, type: "straight", rotation: 90 },
      { row: 1, col: 1, type: "elbow", rotation: 90 },
      { row: 1, col: 2, type: "tee", rotation: 0 },
      { row: 2, col: 1, type: "filter", rotation: 90, fluidType: "gold_reserve" },
      { row: 2, col: 2, type: "elbow", rotation: 180 },
      { row: 3, col: 1, type: "elbow", rotation: 270 },
      { row: 3, col: 2, type: "vault", rotation: 0, isFixed: true, fluidType: "gold_reserve" },
      // Decoy tiles
      { row: 1, col: 0, type: "straight", rotation: 0 },
      { row: 2, col: 3, type: "elbow", rotation: 0 },
    ],
  },
  {
    id: "era_nixon_shock_1971",
    era: "Era III: Il Gold Window Shock (1971)",
    title: "La Decompressione della Riserva",
    subtitle: "Attiva il Condensatore di Volume per assorbire lo shock prima che esploda la sovrapressione.",
    lore: "Quando la finestra dell'oro fu chiusa, i flussi impazzirono: solo un condensatore salva il sistema.",
    gridRows: 4,
    gridCols: 4,
    targetQuota: 150,
    rewardAurei: 8,
    parTimeSeconds: 75,
    nodes: [
      { row: 0, col: 0, type: "source", rotation: 0, isFixed: true, fluidType: "clean_emerald" },
      { row: 1, col: 0, type: "tee", rotation: 90 },
      { row: 1, col: 1, type: "capacitor", rotation: 90 },
      { row: 1, col: 2, type: "elbow", rotation: 180 },
      { row: 2, col: 1, type: "straight", rotation: 0 },
      { row: 2, col: 2, type: "tee", rotation: 270 },
      { row: 3, col: 2, type: "straight", rotation: 90 },
      { row: 3, col: 3, type: "vault", rotation: 90, isFixed: true, fluidType: "gold_reserve" },
    ],
  },
  {
    id: "era_astrolabio_sovrano",
    era: "Era IV: L'Astrolabio AUREUS",
    title: "La Confluenza Istituzionale Perfetta",
    subtitle: "Risolvi il circuito a croce con doppio snodo per la consacrazione a Maestro dei Flussi.",
    lore: "La liquidità globale e il controllo conscio convergono in un'architettura indistruttibile.",
    gridRows: 5,
    gridCols: 5,
    targetQuota: 200,
    rewardAurei: 12,
    parTimeSeconds: 90,
    nodes: [
      { row: 0, col: 2, type: "source", rotation: 0, isFixed: true, fluidType: "clean_emerald" },
      { row: 1, col: 2, type: "cross", rotation: 0 },
      { row: 1, col: 1, type: "elbow", rotation: 180 },
      { row: 1, col: 3, type: "elbow", rotation: 90 },
      { row: 2, col: 1, type: "filter", rotation: 0 },
      { row: 2, col: 2, type: "capacitor", rotation: 0 },
      { row: 2, col: 3, type: "filter", rotation: 0 },
      { row: 3, col: 1, type: "elbow", rotation: 270 },
      { row: 3, col: 2, type: "tee", rotation: 180 },
      { row: 3, col: 3, type: "elbow", rotation: 0 },
      { row: 4, col: 2, type: "vault", rotation: 0, isFixed: true, fluidType: "gold_reserve" },
    ],
  },
  {
    id: "era_rate_shock_2022",
    era: "Era V: La Crisi di Liquidità (2022)",
    title: "La Volatilità dell'Intermarket",
    subtitle: "Doppio canale di filtraggio anti-slippage per resistere al drenaggio quantitativo.",
    lore: "Quando le banche centrali ritirano la liquidità, ogni perdita nel circuito minaccia l'insolvenza.",
    gridRows: 5,
    gridCols: 5,
    targetQuota: 220,
    rewardAurei: 15,
    parTimeSeconds: 100,
    nodes: [
      { row: 0, col: 0, type: "source", rotation: 0, isFixed: true, fluidType: "clean_emerald" },
      { row: 0, col: 1, type: "straight", rotation: 90 },
      { row: 0, col: 2, type: "filter", rotation: 90 },
      { row: 0, col: 3, type: "elbow", rotation: 90 },
      { row: 1, col: 3, type: "straight", rotation: 0 },
      { row: 2, col: 3, type: "tee", rotation: 180 },
      { row: 2, col: 2, type: "capacitor", rotation: 90 },
      { row: 2, col: 1, type: "elbow", rotation: 270 },
      { row: 3, col: 1, type: "straight", rotation: 0 },
      { row: 4, col: 1, type: "elbow", rotation: 0 },
      { row: 4, col: 2, type: "filter", rotation: 90 },
      { row: 4, col: 3, type: "straight", rotation: 90 },
      { row: 4, col: 4, type: "vault", rotation: 270, isFixed: true, fluidType: "gold_reserve" },
    ],
  },
  {
    id: "era_quantum_hft",
    era: "Era VI: Il Nesso Quantistico dei Mercati",
    title: "Il Circuito a Confluenza Sovrana",
    subtitle: "Rete ad alta complessità 6x6: canalizza simultaneamente il volume senza cedere alla sovrapressione.",
    lore: "Milioni di ordini al secondo fluiscono nel prisma: solo la mente imperturbabile governa l'infinito.",
    gridRows: 6,
    gridCols: 6,
    targetQuota: 300,
    rewardAurei: 20,
    parTimeSeconds: 120,
    nodes: [
      { row: 0, col: 2, type: "source", rotation: 0, isFixed: true, fluidType: "clean_emerald" },
      { row: 1, col: 2, type: "cross", rotation: 0 },
      { row: 1, col: 1, type: "elbow", rotation: 180 },
      { row: 1, col: 3, type: "straight", rotation: 90 },
      { row: 1, col: 4, type: "elbow", rotation: 90 },
      { row: 2, col: 1, type: "straight", rotation: 0 },
      { row: 2, col: 4, type: "filter", rotation: 0 },
      { row: 3, col: 1, type: "capacitor", rotation: 0 },
      { row: 3, col: 4, type: "elbow", rotation: 270 },
      { row: 3, col: 3, type: "straight", rotation: 90 },
      { row: 3, col: 2, type: "tee", rotation: 0 },
      { row: 4, col: 2, type: "straight", rotation: 0 },
      { row: 5, col: 2, type: "vault", rotation: 0, isFixed: true, fluidType: "gold_reserve" },
    ],
  },
];

// -------------------------------------------------------------
// 4. ZEN PROCEDURAL GENERATOR (MEDITATIVE CIRCUIT)
// -------------------------------------------------------------

export function generateZenLevel(seed: number = Date.now()): FluidLevel {
  const gridRows = 4;
  const gridCols = 4;
  const nodes: FluidLevel["nodes"] = [];

  nodes.push({ row: 0, col: 0, type: "source", rotation: 0, isFixed: true, fluidType: "clean_emerald" });
  nodes.push({ row: 3, col: 3, type: "vault", rotation: 0, isFixed: true, fluidType: "gold_reserve" });

  const pipeTypes: PipeType[] = ["straight", "elbow", "tee", "cross"];
  const rotations = [0, 90, 180, 270];

  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      if ((r === 0 && c === 0) || (r === 3 && c === 3)) continue;
      const type = pipeTypes[Math.floor(Math.random() * pipeTypes.length)];
      const rotation = rotations[Math.floor(Math.random() * rotations.length)];
      nodes.push({ row: r, col: c, type, rotation });
    }
  }

  return {
    id: `zen_${seed}`,
    era: "Modalità Flusso Zen (Meditazione Operativa)",
    title: "Circuito Infinito di Decompressione",
    subtitle: "Riconnetti i canali con calma serena, lontano dall'ansia dei tick di mercato.",
    lore: "Nessun timer, nessuna pressione: allena la mente alla chiarezza delle connessioni.",
    gridRows,
    gridCols,
    targetQuota: 100,
    rewardAurei: 4,
    parTimeSeconds: 120,
    nodes,
  };
}

// -------------------------------------------------------------
// 5. LOCAL PERSISTENCE HELPERS
// -------------------------------------------------------------

const FLUID_PERSISTENCE_KEY = "limen_fluid_architect_save_v1";

export function loadFluidPersistence(): FluidPersistence {
  if (typeof window === "undefined") {
    return {
      unlockedLevelIndex: 0,
      levelStars: {},
      totalLitersChanneled: 0,
      zenPuzzlesSolved: 0,
    };
  }

  try {
    const raw = localStorage.getItem(FLUID_PERSISTENCE_KEY);
    if (!raw) {
      const init: FluidPersistence = {
        unlockedLevelIndex: 0,
        levelStars: {},
        totalLitersChanneled: 0,
        zenPuzzlesSolved: 0,
      };
      localStorage.setItem(FLUID_PERSISTENCE_KEY, JSON.stringify(init));
      return init;
    }
    return JSON.parse(raw);
  } catch {
    return {
      unlockedLevelIndex: 0,
      levelStars: {},
      totalLitersChanneled: 0,
      zenPuzzlesSolved: 0,
    };
  }
}

export function saveFluidPersistence(data: FluidPersistence) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FLUID_PERSISTENCE_KEY, JSON.stringify(data));
  } catch {}
}
