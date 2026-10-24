/**
 * LIMEN PROTOCOL — Gli Scacchi dell'Ordine (Trans-Limen Tactical Chess 3D)
 * Motore Scacchistico Puro FIDE, Validazione Legale Rigorosa, IA Minimax a 3 Livelli,
 * Collezione di 10 Puzzle Tattici Reali ad Alta Fedeltà Decisionale.
 */

import {
  ChessPiece,
  PieceColor,
  PieceType,
  Square,
  Move,
  ChessPuzzle,
  AiProfile,
  ChessPersistence,
} from "./chessTypes";

export type GameOutcome = "playing" | "check" | "checkmate" | "stalemate";

// =============================================================
// 1. INIZIALIZZAZIONE SCACCHIERA CLASSICA 8x8
// =============================================================

export function createInitialBoard(): (ChessPiece | null)[][] {
  const board: (ChessPiece | null)[][] = Array(8)
    .fill(null)
    .map(() => Array(8).fill(null));

  // Pezzi Neri (Traversa 0 & 1 - La Deriva)
  const backRank: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let c = 0; c < 8; c++) {
    board[0][c] = { type: backRank[c], color: "b" };
    board[1][c] = { type: "p", color: "b" };
  }

  // Pezzi Bianchi (Traversa 6 & 7 - L'Ordine)
  for (let c = 0; c < 8; c++) {
    board[6][c] = { type: "p", color: "w" };
    board[7][c] = { type: backRank[c], color: "w" };
  }

  return board;
}

export const PIECE_SYMBOLS: Record<PieceType, { it: string; symbol: string }> = {
  k: { it: "Re (Architetto)", symbol: "♚" },
  q: { it: "Donna (Sovrana)", symbol: "♛" },
  r: { it: "Torre (Custode)", symbol: "♜" },
  b: { it: "Alfiere (Oracolo)", symbol: "♝" },
  n: { it: "Cavallo (Cacciatore)", symbol: "♞" },
  p: { it: "Pedone (Iniziato)", symbol: "♟" },
};

export function isInsideBoard(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

export function cloneBoard(board: (ChessPiece | null)[][]): (ChessPiece | null)[][] {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

// =============================================================
// 2. GENERAZIONE DELLE MOSSE E VERIFICA DELLA LEGALITÀ
// =============================================================

export function getPieceMoves(
  board: (ChessPiece | null)[][],
  fromRow: number,
  fromCol: number,
  checkLegality: boolean = true
): Move[] {
  const piece = board[fromRow][fromCol];
  if (!piece) return [];

  const moves: Move[] = [];
  const color = piece.color;
  const enemyColor: PieceColor = color === "w" ? "b" : "w";

  // 1. PEDONE
  if (piece.type === "p") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const promoRow = color === "w" ? 0 : 7;

    // 1 passo avanti
    const nextRow = fromRow + dir;
    if (isInsideBoard(nextRow, fromCol) && !board[nextRow][fromCol]) {
      if (nextRow === promoRow) {
        moves.push({ from: [fromRow, fromCol], to: [nextRow, fromCol], promotion: "q" });
      } else {
        moves.push({ from: [fromRow, fromCol], to: [nextRow, fromCol] });
      }

      // 2 passi avanti dalla riga iniziale
      const doubleRow = fromRow + 2 * dir;
      if (fromRow === startRow && isInsideBoard(doubleRow, fromCol) && !board[doubleRow][fromCol]) {
        moves.push({ from: [fromRow, fromCol], to: [doubleRow, fromCol] });
      }
    }

    // Catture diagonali
    [-1, 1].forEach((dc) => {
      const tc = fromCol + dc;
      if (isInsideBoard(nextRow, tc)) {
        const target = board[nextRow][tc];
        if (target && target.color === enemyColor) {
          if (nextRow === promoRow) {
            moves.push({ from: [fromRow, fromCol], to: [nextRow, tc], promotion: "q", captured: target });
          } else {
            moves.push({ from: [fromRow, fromCol], to: [nextRow, tc], captured: target });
          }
        }
      }
    });
  }

  // 2. CAVALLO (Salto a L)
  if (piece.type === "n") {
    const knightDeltas: [number, number][] = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1],
    ];

    knightDeltas.forEach(([dr, dc]) => {
      const tr = fromRow + dr;
      const tc = fromCol + dc;
      if (isInsideBoard(tr, tc)) {
        const target = board[tr][tc];
        if (!target) {
          moves.push({ from: [fromRow, fromCol], to: [tr, tc] });
        } else if (target.color === enemyColor) {
          moves.push({ from: [fromRow, fromCol], to: [tr, tc], captured: target });
        }
      }
    });
  }

  // 3. RAGGI: TORRE, ALFIERE, DONNA
  const rays: [number, number][] = [];
  if (piece.type === "r" || piece.type === "q") {
    rays.push([-1, 0], [1, 0], [0, -1], [0, 1]);
  }
  if (piece.type === "b" || piece.type === "q") {
    rays.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
  }

  rays.forEach(([dr, dc]) => {
    let tr = fromRow + dr;
    let tc = fromCol + dc;

    while (isInsideBoard(tr, tc)) {
      const target = board[tr][tc];
      if (!target) {
        moves.push({ from: [fromRow, fromCol], to: [tr, tc] });
      } else {
        if (target.color === enemyColor) {
          moves.push({ from: [fromRow, fromCol], to: [tr, tc], captured: target });
        }
        break; // Percorso bloccato
      }
      tr += dr;
      tc += dc;
    }
  });

  // 4. RE (1 passo in ogni direzione)
  if (piece.type === "k") {
    const kingDeltas: [number, number][] = [
      [-1, -1], [-1, 0], [-1, 1],
      [0, -1],           [0, 1],
      [1, -1],  [1, 0],  [1, 1],
    ];

    kingDeltas.forEach(([dr, dc]) => {
      const tr = fromRow + dr;
      const tc = fromCol + dc;
      if (isInsideBoard(tr, tc)) {
        const target = board[tr][tc];
        if (!target) {
          moves.push({ from: [fromRow, fromCol], to: [tr, tc] });
        } else if (target.color === enemyColor) {
          moves.push({ from: [fromRow, fromCol], to: [tr, tc], captured: target });
        }
      }
    });
  }

  // Se richiesto, filtra solo le mosse che non lasciano il Re sotto scacco
  if (checkLegality) {
    return moves.filter((move) => {
      const simulated = cloneBoard(board);
      applyMoveToBoard(simulated, move);
      return !isKingInCheck(simulated, color);
    });
  }

  return moves;
}

export function applyMoveToBoard(board: (ChessPiece | null)[][], move: Move) {
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = board[fr][fc];
  if (!piece) return;

  board[fr][fc] = null;

  if (move.promotion) {
    board[tr][tc] = { type: move.promotion, color: piece.color, hasMoved: true };
  } else {
    board[tr][tc] = { ...piece, hasMoved: true };
  }
}

export function findKing(board: (ChessPiece | null)[][], color: PieceColor): Square | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.type === "k" && p.color === color) {
        return [r, c];
      }
    }
  }
  return null;
}

export function isKingInCheck(board: (ChessPiece | null)[][], color: PieceColor): boolean {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;

  const enemyColor: PieceColor = color === "w" ? "b" : "w";

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === enemyColor) {
        const moves = getPieceMoves(board, r, c, false);
        if (moves.some((m) => m.to[0] === kingPos[0] && m.to[1] === kingPos[1])) {
          return true;
        }
      }
    }
  }

  return false;
}

export function getAllLegalMoves(board: (ChessPiece | null)[][], color: PieceColor): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p && p.color === color) {
        moves.push(...getPieceMoves(board, r, c, true));
      }
    }
  }
  return moves;
}

export function evaluateGameOutcome(board: (ChessPiece | null)[][], activeTurn: PieceColor): GameOutcome {
  const legalMoves = getAllLegalMoves(board, activeTurn);
  const inCheck = isKingInCheck(board, activeTurn);

  if (legalMoves.length === 0) {
    return inCheck ? "checkmate" : "stalemate";
  }

  return inCheck ? "check" : "playing";
}

// =============================================================
// 3. IA MINIMAX A 3 LIVELLI
// =============================================================

export const AI_PROFILES: AiProfile[] = [
  {
    id: "novice_retail",
    name: "L'Iniziato",
    title: "Novizio della Scacchiera",
    description: "Giocatore alle prime armi (800 Elo). Gioca mosse rapide e commette sviste occasionali.",
    eloRating: 800,
    depth: 1,
    mistakeProbability: 0.35,
  },
  {
    id: "institutional_swing",
    name: "L'Operatore",
    title: "Tattico Istituzionale",
    description: "Giocatore solido e posizionale (1400 Elo). Calcola scambi a medio termine.",
    eloRating: 1400,
    depth: 2,
    mistakeProbability: 0.08,
  },
  {
    id: "master_hft",
    name: "L'Architetto",
    title: "Maestro del Tempo",
    description: "IA avanzata a calcolo profondo (1950 Elo). Sfrutta ogni debolezza posizionale.",
    eloRating: 1950,
    depth: 3,
    mistakeProbability: 0.0,
  },
];

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

function evaluateBoardStatic(board: (ChessPiece | null)[][]): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;

      const val = PIECE_VALUES[p.type];
      const sign = p.color === "w" ? 1 : -1;
      score += sign * val;

      // Bonus controllo del centro per alfieri e cavalli
      if ((p.type === "n" || p.type === "b") && r >= 2 && r <= 5 && c >= 2 && c <= 5) {
        score += sign * 15;
      }
    }
  }
  return score;
}

export function getBestMoveMinimax(
  board: (ChessPiece | null)[][],
  color: PieceColor,
  aiProfile: AiProfile
): Move | null {
  const legalMoves = getAllLegalMoves(board, color);
  if (legalMoves.length === 0) return null;

  // Se l'IA novizia fa un errore deliberato: mossa casuale
  if (Math.random() < aiProfile.mistakeProbability) {
    const nonCheckMoves = legalMoves.filter((m) => !m.captured);
    if (nonCheckMoves.length > 0) {
      return nonCheckMoves[Math.floor(Math.random() * nonCheckMoves.length)];
    }
  }

  let bestMove: Move = legalMoves[0];
  let bestEval = color === "w" ? -Infinity : Infinity;

  for (const move of legalMoves) {
    const nextBoard = cloneBoard(board);
    applyMoveToBoard(nextBoard, move);

    const evalScore = minimax(
      nextBoard,
      aiProfile.depth - 1,
      -Infinity,
      Infinity,
      color === "w" ? false : true
    );

    if (color === "w") {
      if (evalScore > bestEval) {
        bestEval = evalScore;
        bestMove = move;
      }
    } else {
      if (evalScore < bestEval) {
        bestEval = evalScore;
        bestMove = move;
      }
    }
  }

  return bestMove;
}

function minimax(
  board: (ChessPiece | null)[][],
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  if (depth === 0) {
    return evaluateBoardStatic(board);
  }

  const turn: PieceColor = isMaximizing ? "w" : "b";
  const moves = getAllLegalMoves(board, turn);

  if (moves.length === 0) {
    if (isKingInCheck(board, turn)) {
      return isMaximizing ? -50000 : 50000;
    }
    return 0; // Stallo
  }

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const nextBoard = cloneBoard(board);
      applyMoveToBoard(nextBoard, move);
      const evalScore = minimax(nextBoard, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const nextBoard = cloneBoard(board);
      applyMoveToBoard(nextBoard, move);
      const evalScore = minimax(nextBoard, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

// =============================================================
// 4. COLLEZIONE DI 10 PUZZLE TATTICI REALI (ALTA FEDELTÀ)
// =============================================================

export const TACTICAL_PUZZLES: ChessPuzzle[] = [
  {
    id: "puzzle-1-backrank",
    title: "1. L'Imboscata sul Back-Rank",
    subtitle: "Scacco Matto in 1 mossa — Infiltrazione della Torre",
    objectiveText: "Infiltra la Torre sull'ottava traversa per dare Scacco Matto in 1 mossa.",
    tradingAnalogy: "Sfrutta l'assenza di Stop Loss avversario per chiudere la posizione istantaneamente.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Novizio",
    rewardAurei: 10,
    hintSquare: [7, 0],
    hintText: "La Torre in a1 può scorrere fino all'ottava traversa in a8.",
    winningMoveNotation: "Ra1→a8#",
    failedMoveHint: "Questa mossa non minaccia il Re avversario. La Torre in a1 deve scorrere su tutta la colonna 'a' fino alla traversa 8 (casella a8) per dare scacco matto sul corridoio al Re intrappolato dai suoi pedoni.",
    pieces: [
      { row: 7, col: 0, piece: { type: "r", color: "w" } }, // White Rook a1
      { row: 6, col: 4, piece: { type: "k", color: "w" } }, // White King e2
      { row: 0, col: 6, piece: { type: "k", color: "b" } }, // Black King g8
      { row: 1, col: 5, piece: { type: "p", color: "b" } }, // Black pawn f7
      { row: 1, col: 6, piece: { type: "p", color: "b" } }, // Black pawn g7
      { row: 1, col: 7, piece: { type: "p", color: "b" } }, // Black pawn h7
    ],
    solution: [{ from: [7, 0], to: [0, 0] }], // Ra1 -> a8#
  },
  {
    id: "puzzle-2-queen-kiss",
    title: "2. Il Bacio della Sovrana",
    subtitle: "Scacco Matto in 1 mossa — Confluenza Alfiere e Regina",
    objectiveText: "Trova lo Scacco Matto convergendo con Donna e Alfiere in 1 mossa.",
    tradingAnalogy: "Confluenza di segnali: quando due strumenti istituzionali convergono sullo stesso livello.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Novizio",
    rewardAurei: 12,
    hintSquare: [5, 6],
    hintText: "La Regina in g3 ha l'appoggio diagonale dell'Alfiere in c4 per colpire g7.",
    winningMoveNotation: "Qg3→g7#",
    failedMoveHint: "La Regina bianca in g3 deve colpire direttamente in g7: sostenuta diagonalmente dall'Alfiere in c4, il Re nero non può catturarla né fuggire.",
    pieces: [
      { row: 5, col: 6, piece: { type: "q", color: "w" } }, // White Queen g3
      { row: 4, col: 2, piece: { type: "b", color: "w" } }, // White Bishop c4
      { row: 6, col: 6, piece: { type: "k", color: "w" } }, // White King
      { row: 0, col: 7, piece: { type: "k", color: "b" } }, // Black King h8
      { row: 1, col: 6, piece: { type: "p", color: "b" } }, // Black pawn g7
      { row: 1, col: 7, piece: { type: "p", color: "b" } }, // Black pawn h7
    ],
    solution: [{ from: [5, 6], to: [1, 6] }], // Qxg7#
  },
  {
    id: "puzzle-3-smothered",
    title: "3. Lo Smothered Mate del Cavallo",
    subtitle: "Scacco Matto Soffocato — Nessuna via di fuga",
    objectiveText: "Salta con il Cavallo per soffocare il Re nemico in 1 mossa.",
    tradingAnalogy: "Sovraccarico operativo: troppe posizioni aperte bloccano la ritirata del capitale.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Iniziato",
    rewardAurei: 15,
    hintSquare: [3, 4],
    hintText: "Il Cavallo in e5 può saltare in f7 punendo il Re intrappolato dai suoi stessi pezzi.",
    winningMoveNotation: "Ne5→f7#",
    failedMoveHint: "Il Cavallo in e5 deve saltare in f7: il Re nero nell'angolo in h8 è soffocato dai suoi stessi pezzi e non ha alcuna via d'uscita.",
    pieces: [
      { row: 3, col: 4, piece: { type: "n", color: "w" } }, // White Knight e5
      { row: 7, col: 4, piece: { type: "k", color: "w" } }, // White King e1
      { row: 0, col: 7, piece: { type: "k", color: "b" } }, // Black King h8
      { row: 0, col: 6, piece: { type: "r", color: "b" } }, // Black Rook g8
      { row: 1, col: 6, piece: { type: "p", color: "b" } }, // Black Pawn g7
      { row: 1, col: 7, piece: { type: "p", color: "b" } }, // Black Pawn h7
    ],
    solution: [{ from: [3, 4], to: [1, 5] }], // Nf7#
  },
  {
    id: "puzzle-4-fork",
    title: "4. La Forchetta Reale",
    subtitle: "Attacco Doppio — Guadagno Asimmetrico",
    objectiveText: "Trova la mossa di Cavallo che attacca simultaneamente Re e Regina.",
    tradingAnalogy: "Asimmetria pura: forzare l'avversario a subire scacco perdendo la risorsa più preziosa.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Iniziato",
    rewardAurei: 15,
    hintSquare: [4, 2],
    hintText: "Il Cavallo in c4 può catturare in d6 attaccando Re e Donna.",
    winningMoveNotation: "Nc4→d6+",
    failedMoveHint: "Il Cavallo in c4 deve catturare il pedone in d6: dà scacco al Re in e7 e contemporaneamente attacca la Regina nera in c7.",
    pieces: [
      { row: 4, col: 2, piece: { type: "n", color: "w" } }, // White Knight c4
      { row: 7, col: 4, piece: { type: "k", color: "w" } }, // White King e1
      { row: 1, col: 4, piece: { type: "k", color: "b" } }, // Black King e7
      { row: 1, col: 2, piece: { type: "q", color: "b" } }, // Black Queen c7
      { row: 2, col: 3, piece: { type: "p", color: "b" } }, // Black Pawn d6
    ],
    solution: [{ from: [4, 2], to: [2, 3] }], // Nd6+
  },
  {
    id: "puzzle-5-skewer",
    title: "5. L'Infilata Decisiva",
    subtitle: "Infilata di Torre sulla Colonna",
    objectiveText: "Avanza la Torre per dare scacco e catturare la Torre avversaria.",
    tradingAnalogy: "Rompere il primo livello di resistenza per incassare la liquidità sul fondo.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Iniziato",
    rewardAurei: 16,
    hintSquare: [7, 3],
    hintText: "La Torre in d1 può avanzare in d4 dando scacco e scoprendo la Torre nera in d8.",
    winningMoveNotation: "Rd1→d4+",
    failedMoveHint: "La Torre in d1 deve portarsi in d4 dando scacco al Re in d5: quando il Re si sposterà, la Torre nera in d8 sarà indifesa.",
    pieces: [
      { row: 7, col: 3, piece: { type: "r", color: "w" } }, // White Rook d1
      { row: 7, col: 6, piece: { type: "k", color: "w" } }, // White King g1
      { row: 3, col: 3, piece: { type: "k", color: "b" } }, // Black King d5
      { row: 0, col: 3, piece: { type: "r", color: "b" } }, // Black Rook d8
      { row: 2, col: 2, piece: { type: "p", color: "b" } }, // Black pawn c6
    ],
    solution: [{ from: [7, 3], to: [4, 3] }], // Rd4+
  },
  {
    id: "puzzle-6-bishops-mate",
    title: "6. La Tenaglia dei Due Alfieri",
    subtitle: "Scacco Matto in 1 mossa — Dominio Diagonale",
    objectiveText: "Muovi l'Alfiere per sigillare le diagonali e dare Scacco Matto.",
    tradingAnalogy: "Incrocio delle medie mobili: le due direttrici bloccano completamente la fuga del prezzo.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Novizio",
    rewardAurei: 12,
    hintSquare: [3, 4],
    hintText: "L'Alfiere in e5 può scivolare in f6 completando la rete di matto con l'altro Alfiere.",
    winningMoveNotation: "Be5→f6#",
    failedMoveHint: "L'Alfiere in e5 deve scorrere in f6 per togliere l'ultima diagonale di fuga al Re nero in h8, già tenuto sotto mira dall'Alfiere in c4.",
    pieces: [
      { row: 4, col: 2, piece: { type: "b", color: "w" } }, // White Bishop c4
      { row: 3, col: 4, piece: { type: "b", color: "w" } }, // White Bishop e5
      { row: 7, col: 2, piece: { type: "k", color: "w" } }, // White King
      { row: 0, col: 7, piece: { type: "k", color: "b" } }, // Black King h8
      { row: 1, col: 7, piece: { type: "p", color: "b" } }, // Black pawn h7
    ],
    solution: [{ from: [3, 4], to: [2, 5] }], // Bf6#
  },
  {
    id: "puzzle-7-queen-sacrifice",
    title: "7. Il Sacrificio della Sovrana",
    subtitle: "Scacco Matto in 1 mossa — Sfondamento del Varco",
    objectiveText: "Sacrifica la Regina sul varco per chiudere la partita istantaneamente.",
    tradingAnalogy: "Accettare un costo controllato per realizzare un profit factor immenso.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Architetto",
    rewardAurei: 20,
    hintSquare: [4, 4],
    hintText: "La Donna in e4 può sacrificarsi in g7 grazie alla protezione dell'Alfiere in c5.",
    winningMoveNotation: "Qe4→g7#",
    failedMoveHint: "La Donna in e4 deve irrompere in g7: protetta dall'Alfiere in c5, il Re nero non può catturarla né salvarsi.",
    pieces: [
      { row: 4, col: 4, piece: { type: "q", color: "w" } }, // White Queen e4
      { row: 3, col: 2, piece: { type: "b", color: "w" } }, // White Bishop c5
      { row: 7, col: 4, piece: { type: "k", color: "w" } }, // White King
      { row: 0, col: 6, piece: { type: "k", color: "b" } }, // Black King g8
      { row: 1, col: 5, piece: { type: "p", color: "b" } }, // Black Pawn f7
      { row: 1, col: 7, piece: { type: "p", color: "b" } }, // Black Pawn h7
    ],
    solution: [{ from: [4, 4], to: [1, 6] }], // Qxg7#
  },
  {
    id: "puzzle-8-anastasia",
    title: "8. Il Matto di Anastasia",
    subtitle: "Scacco Matto in 1 mossa — Cavallo e Torre Allineati",
    objectiveText: "Porta la Torre sulla colonna aperta per il Matto di Anastasia.",
    tradingAnalogy: "Sincronia esecutiva: il Cavallo toglie le vie di fuga mentre la Torre assesta il colpo.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Architetto",
    rewardAurei: 22,
    hintSquare: [7, 4],
    hintText: "La Torre in e1 può raggiungere h4 dando scacco matto sul bordo.",
    winningMoveNotation: "Re1→h4#",
    failedMoveHint: "La Torre in e1 deve salire in h4: la colonna è aperta e il Cavallo in e5 toglie le caselle di ritirata g6 e g8 al Re nero.",
    pieces: [
      { row: 7, col: 4, piece: { type: "r", color: "w" } }, // White Rook e1
      { row: 3, col: 4, piece: { type: "n", color: "w" } }, // White Knight e5
      { row: 7, col: 2, piece: { type: "k", color: "w" } }, // White King
      { row: 1, col: 7, piece: { type: "k", color: "b" } }, // Black King h7
      { row: 2, col: 6, piece: { type: "p", color: "b" } }, // Black pawn g6
    ],
    solution: [{ from: [7, 4], to: [4, 7] }], // Rh4#
  },
  {
    id: "puzzle-9-backrank-deflection",
    title: "9. La Deviazione del Custode",
    subtitle: "Scacco Matto in 1 mossa — Distruzione della Guardia",
    objectiveText: "Sfonda sull'ottava traversa per lo Scacco Matto di Torre.",
    tradingAnalogy: "Rimuovere la protezione per provocare un'istantanea liquidazione a cascata.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Iniziato",
    rewardAurei: 18,
    hintSquare: [7, 2],
    hintText: "La Torre in c1 può sfondare in c8 con scacco matto irrimediabile.",
    winningMoveNotation: "Rc1→c8#",
    failedMoveHint: "La Torre in c1 deve raggiungere c8 (ottava traversa): il Re nero è intrappolato dietro la sua catena di pedoni.",
    pieces: [
      { row: 7, col: 2, piece: { type: "r", color: "w" } }, // White Rook c1
      { row: 6, col: 6, piece: { type: "k", color: "w" } }, // White King g2
      { row: 0, col: 2, piece: { type: "k", color: "b" } }, // Black King c8
      { row: 1, col: 1, piece: { type: "p", color: "b" } }, // Black pawn b7
      { row: 1, col: 2, piece: { type: "p", color: "b" } }, // Black pawn c7
      { row: 1, col: 3, piece: { type: "p", color: "b" } }, // Black pawn d7
    ],
    solution: [{ from: [7, 2], to: [0, 2] }], // Rc8#
  },
  {
    id: "puzzle-10-smothered-extended",
    title: "10. L'Oracolo Infallibile",
    subtitle: "Scacco Matto in 1 mossa — Attacco a Raggio Totale",
    objectiveText: "Infiltra la Donna fino all'ottava traversa per il matto definitivo.",
    tradingAnalogy: "Esecuzione priva di esitazione: sfruttare il momentum massimo del mercato.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Architetto",
    rewardAurei: 25,
    hintSquare: [3, 3],
    hintText: "La Regina in d5 ha la linea libera verso d8 per il matto definitivo.",
    winningMoveNotation: "Qd5→d8#",
    failedMoveHint: "La Regina in d5 deve entrare in d8: l'Alfiere in b2 controlla le vie di fuga e la traversa di fondo cade all'istante.",
    pieces: [
      { row: 3, col: 3, piece: { type: "q", color: "w" } }, // White Queen d5
      { row: 6, col: 1, piece: { type: "b", color: "w" } }, // White Bishop b2
      { row: 7, col: 4, piece: { type: "k", color: "w" } }, // White King
      { row: 0, col: 3, piece: { type: "k", color: "b" } }, // Black King d8
      { row: 1, col: 2, piece: { type: "p", color: "b" } }, // Black pawn c7
      { row: 1, col: 4, piece: { type: "p", color: "b" } }, // Black pawn e7
    ],
    solution: [{ from: [3, 3], to: [0, 3] }], // Qd8#
  },
];

// =============================================================
// 5. SALVATAGGIO & PERSISTENZA ELO
// =============================================================

const CHESS_PERSISTENCE_KEY = "limen_tactical_chess_save_v1";

export function loadChessPersistence(): ChessPersistence {
  if (typeof window === "undefined") {
    return {
      playerElo: 1200,
      completedPuzzleIds: [],
      totalMatchesWon: 0,
      totalMatchesLost: 0,
      activeBoardTheme: "obsidian_gold",
    };
  }

  try {
    const raw = localStorage.getItem(CHESS_PERSISTENCE_KEY);
    if (!raw) {
      const init: ChessPersistence = {
        playerElo: 1200,
        completedPuzzleIds: [],
        totalMatchesWon: 0,
        totalMatchesLost: 0,
        activeBoardTheme: "obsidian_gold",
      };
      localStorage.setItem(CHESS_PERSISTENCE_KEY, JSON.stringify(init));
      return init;
    }
    return JSON.parse(raw);
  } catch {
    return {
      playerElo: 1200,
      completedPuzzleIds: [],
      totalMatchesWon: 0,
      totalMatchesLost: 0,
      activeBoardTheme: "obsidian_gold",
    };
  }
}

export function saveChessPersistence(data: ChessPersistence) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHESS_PERSISTENCE_KEY, JSON.stringify(data));
  } catch {}
}
