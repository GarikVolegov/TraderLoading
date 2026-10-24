/**
 * LIMEN PROTOCOL — Gli Scacchi dell'Ordine (Trans-Limen Tactical Chess 3D)
 * Type definitions, data models, board coordinates, AI profiles and real tactical puzzles.
 */

export type PieceColor = "w" | "b"; // w: L'Ordine (Oro Imperiale), b: La Deriva (Ossidiana Scura)
export type PieceType = "p" | "r" | "n" | "b" | "q" | "k";

export interface ChessPiece {
  type: PieceType;
  color: PieceColor;
  hasMoved?: boolean;
}

export type Square = [number, number]; // [row, col] where 0..7

export interface Move {
  from: Square;
  to: Square;
  promotion?: PieceType;
  captured?: ChessPiece;
}

export interface ChessPuzzle {
  id: string;
  title: string;
  subtitle: string;
  objectiveText: string;
  tradingAnalogy: string;
  turn: PieceColor;
  movesToWin: number;
  pieces: Array<{ row: number; col: number; piece: ChessPiece }>;
  solution: Array<{ from: [number, number]; to: [number, number] }>;
  hintSquare: [number, number]; // Piece to move
  hintText: string;
  failedMoveHint?: string;
  winningMoveNotation?: string;
  rewardAurei: number;
  difficulty: "Novizio" | "Iniziato" | "Architetto";
}

export type AiPersonality = "novice_retail" | "institutional_swing" | "master_hft";

export interface AiProfile {
  id: AiPersonality;
  name: string;
  title: string;
  description: string;
  eloRating: number;
  depth: number;
  mistakeProbability: number;
}

export interface ChessPersistence {
  playerElo: number;
  completedPuzzleIds: string[];
  totalMatchesWon: number;
  totalMatchesLost: number;
  activeBoardTheme: "obsidian_gold" | "carrara_temple" | "cyber_void";
}
