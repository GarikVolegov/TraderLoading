/**
 * LIMEN PROTOCOL — Il Cockpit Tattico dell'Ordine (Trans-Limen Tactical Battlefield 3D)
 * Definizione tipi rigorosi per simulazione tattica a turni del Book e Gestione del Rischio.
 */

export type GridCoordinate = [number, number]; // [row, col]

export type TileType =
  | "neutral"
  | "liquidity_pool"
  | "fair_value_gap"
  | "mitigation_zone"
  | "danger_zone";

export type TacticalUnitType =
  | "core_vault"
  | "sweep_hunter"
  | "order_block"
  | "risk_sentinel";

export interface TacticalUnit {
  id: string;
  type: TacticalUnitType;
  name: string;
  position: GridCoordinate;
  integrity: number;
  maxIntegrity: number;
  movementRange: number;
  costAP: number;
  hasActedThisTurn: boolean;
  isFortified?: boolean;
}

export type SweepType = "directional_sweep" | "black_swan_shock" | "liquidity_drain";

export interface TelegraphedSweep {
  id: string;
  type: SweepType;
  targetCoordinates: GridCoordinate[];
  intensity: number; // Danni da drawdown se non mitigati
  vectorName: string;
  warningMessage: string;
  turnsRemaining: number; // 1 = colpisce questo turno
}

export interface GridTileState {
  coord: GridCoordinate;
  type: TileType;
  aureiYield?: number;
  isTargetedBySweep?: boolean;
}

export interface ScenarioMission {
  id: number;
  year: string;
  name: string;
  subtitle: string;
  historicalContext: string;
  doctrineRule: string;
  gridRows: number;
  gridCols: number;
  turnsToSurvive: number;
  rewardAurei: number;
  initialUnits: TacticalUnit[];
  specialTiles: { coord: GridCoordinate; type: TileType; yieldValue?: number }[];
  generateSweepsForTurn: (turn: number, rows: number, cols: number) => TelegraphedSweep[];
}

export interface TacticalDoctrine {
  id: string;
  name: string;
  category: "order_type" | "defense" | "intel";
  description: string;
  costAurei: number;
  effectType:
    | "iceberg_order"
    | "trailing_sentinel"
    | "margin_reinforcement"
    | "fvg_teleport"
    | "instant_mitigation";
}

export interface CockpitPersistence {
  unlockedScenarioId: number;
  completedScenarioIds: number[];
  totalAurei: number;
  totalDisciplinedFolds: number;
  unlockedDoctrineIds: string[];
  activeBoardSkin: "obsidian_gold" | "imperial_marble" | "emerald_sanctuary";
}
