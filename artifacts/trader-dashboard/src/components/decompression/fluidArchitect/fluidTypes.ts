/**
 * LIMEN PROTOCOL — L'Architetto dei Flussi (3D Spatial Logic & Resource Routing)
 * Type definitions, pipe port bitmasks, level structures & fluid dynamics models.
 */

export const DIRECTION = {
  NORTH: 1, // 0001
  EAST: 2,  // 0010
  SOUTH: 4, // 0100
  WEST: 8,  // 1000
} as const;

export type DirectionKey = keyof typeof DIRECTION;

export type PipeType =
  | "straight"    // Straight conduit (N-S or E-W)
  | "elbow"       // 90° curve (e.g., N-E)
  | "tee"         // 3-way junction
  | "cross"       // 4-way intersection
  | "source"      // Central Bank / Liquidity Inflow Source
  | "vault"       // Target Vault (Storage of Return)
  | "filter"      // Anti-Slippage Filter (straight with purifier ring)
  | "capacitor"   // Volume Condenser (stores flow and pulses)
  | "empty";

export interface FluidNode {
  id: string;
  row: number;
  col: number;
  type: PipeType;
  rotation: number; // 0, 90, 180, 270 degrees
  isFixed: boolean; // True for sources and target vaults
  isActive: boolean; // Currently receiving connected flow
  currentFlowRate: number; // 0..100%
  fluidType: "clean_emerald" | "volatile_ruby" | "gold_reserve";
}

export interface FluidLevel {
  id: string;
  era: string;
  title: string;
  subtitle: string;
  lore: string;
  gridRows: number;
  gridCols: number;
  nodes: Array<{
    row: number;
    col: number;
    type: PipeType;
    rotation: number;
    isFixed?: boolean;
    fluidType?: "clean_emerald" | "volatile_ruby" | "gold_reserve";
  }>;
  targetQuota: number; // Total volume to fill target vault (e.g. 100)
  rewardAurei: number;
  parTimeSeconds: number;
}

export interface FluidPersistence {
  unlockedLevelIndex: number;
  levelStars: Record<string, number>; // levelId -> 1..3 stars
  totalLitersChanneled: number;
  zenPuzzlesSolved: number;
}
