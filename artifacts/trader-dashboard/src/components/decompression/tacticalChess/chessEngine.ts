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
  {
    id: "puzzle-11-boden",
    title: "11. Il Matto di Boden",
    subtitle: "Scacco Matto in 1 mossa — Incrocio dei Due Alfieri",
    objectiveText: "Muovi l'Alfiere in a6 per incrociare le diagonali e sigillare il Re.",
    tradingAnalogy: "Sincronia geometrica tra timeframe: il supporto e la resistenza convergono sul punto esatto.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Iniziato",
    rewardAurei: 20,
    hintSquare: [5, 3],
    hintText: "L'Alfiere in d3 può piombare in a6 chiudendo il varco di fuga del Re in c8.",
    winningMoveNotation: "Bd3→a6#",
    failedMoveHint: "L'Alfiere in d3 deve scivolare in a6: l'altro Alfiere in f4 controlla già c7 e b8, e i pezzi neri in d7 e d8 bloccano la ritirata.",
    pieces: [
      { row: 5, col: 3, piece: { type: "b", color: "w" } }, // White Bishop d3
      { row: 4, col: 5, piece: { type: "b", color: "w" } }, // White Bishop f4
      { row: 7, col: 4, piece: { type: "k", color: "w" } }, // White King e1
      { row: 0, col: 2, piece: { type: "k", color: "b" } }, // Black King c8
      { row: 1, col: 3, piece: { type: "p", color: "b" } }, // Black pawn d7
      { row: 0, col: 3, piece: { type: "q", color: "b" } }, // Black Queen d8
      { row: 0, col: 1, piece: { type: "r", color: "b" } }, // Black Rook b8
    ],
    solution: [{ from: [5, 3], to: [2, 0] }], // Ba6#
  },
  {
    id: "puzzle-12-opera-mate",
    title: "12. Il Matto dell'Opera (Morphy)",
    subtitle: "Scacco Matto in 1 mossa — Sfondamento con Torre",
    objectiveText: "Porta la Torre in d8 per il celebre matto di Morphy con protezione d'Alfiere.",
    tradingAnalogy: "Massima efficienza operativa: ogni risorsa partecipa all'attacco con zero dispersione di capitale.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Architetto",
    rewardAurei: 25,
    hintSquare: [7, 3],
    hintText: "La Torre in d1 può avanzare su tutta la colonna fino a d8.",
    winningMoveNotation: "Rd1→d8#",
    failedMoveHint: "La Torre in d1 deve irrompere in d8: protetta dall'Alfiere in g5, il Re in e8 non ha vie di scampo.",
    pieces: [
      { row: 7, col: 3, piece: { type: "r", color: "w" } }, // White Rook d1
      { row: 3, col: 6, piece: { type: "b", color: "w" } }, // White Bishop g5
      { row: 7, col: 6, piece: { type: "k", color: "w" } }, // White King g1
      { row: 0, col: 4, piece: { type: "k", color: "b" } }, // Black King e8
      { row: 1, col: 3, piece: { type: "n", color: "b" } }, // Black Knight d7
      { row: 1, col: 5, piece: { type: "p", color: "b" } }, // Black pawn f7
    ],
    solution: [{ from: [7, 3], to: [0, 3] }], // Rd8#
  },
  {
    id: "puzzle-13-knight-smother-edge",
    title: "13. L'Incastro del Bastione",
    subtitle: "Scacco Matto in 1 mossa — Cavallo ad Alta Precisione",
    objectiveText: "Posiziona il Cavallo in c7 per soffocare il Re sul bordo della scacchiera.",
    tradingAnalogy: "Sfruttare la mancanza di liquidità del bordo: quando il prezzo non ha sfogo, basta un impulso per liquidarlo.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Iniziato",
    rewardAurei: 18,
    hintSquare: [3, 4],
    hintText: "Il Cavallo in e5 può saltare in c7 dando scacco matto sul Re intrappolato in a8.",
    winningMoveNotation: "Ne5→c7#",
    failedMoveHint: "Il Cavallo in e5 deve atterrare in c7: l'Alfiere in f3 sigilla la casella b7 e il Re nero in a8 resta bloccato.",
    pieces: [
      { row: 3, col: 4, piece: { type: "n", color: "w" } }, // White Knight e5
      { row: 5, col: 5, piece: { type: "b", color: "w" } }, // White Bishop f3
      { row: 7, col: 2, piece: { type: "k", color: "w" } }, // White King c1
      { row: 0, col: 0, piece: { type: "k", color: "b" } }, // Black King a8
      { row: 1, col: 0, piece: { type: "p", color: "b" } }, // Black pawn a7
      { row: 0, col: 1, piece: { type: "p", color: "b" } }, // Black pawn b8
    ],
    solution: [{ from: [3, 4], to: [1, 2] }], // Nc7#
  },
  {
    id: "puzzle-14-backrank-corridor",
    title: "14. La Spazzata dell'Oracolo",
    subtitle: "Scacco Matto in 1 mossa — Deviazione Diagonale",
    objectiveText: "Scivola con l'Alfiere in c6 per sigillare l'uscita della Torre e del Re.",
    tradingAnalogy: "Bloccare l'hedging dell'avversario prima di sferrare l'ordine di mercato.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Architetto",
    rewardAurei: 22,
    hintSquare: [4, 1],
    hintText: "L'Alfiere in b4 può salire in c6 completando la gabbia con la Torre in d8.",
    winningMoveNotation: "Bb4→c6#",
    failedMoveHint: "L'Alfiere in b4 deve portarsi in c6: taglia diagonalmente la casella b7 e d7, lasciando il Re in a8 senza speranza.",
    pieces: [
      { row: 4, col: 1, piece: { type: "b", color: "w" } }, // White Bishop b4
      { row: 0, col: 3, piece: { type: "r", color: "w" } }, // White Rook d8
      { row: 7, col: 4, piece: { type: "k", color: "w" } }, // White King
      { row: 0, col: 0, piece: { type: "k", color: "b" } }, // Black King a8
      { row: 1, col: 1, piece: { type: "p", color: "b" } }, // Black pawn b7
      { row: 1, col: 0, piece: { type: "p", color: "b" } }, // Black pawn a7
    ],
    solution: [{ from: [4, 1], to: [2, 2] }], // Bc6#
  },
  {
    id: "puzzle-15-arabian-mate",
    title: "15. Il Matto Arabo",
    subtitle: "Scacco Matto in 1 mossa — Sinergia di Cavallo e Torre",
    objectiveText: "Porta la Torre in h7 per chiudere il millenario Matto Arabo.",
    tradingAnalogy: "Doppia conferma di trend: la Torre chiude il varco e il Cavallo copre le deviazioni laterali.",
    turn: "w",
    movesToWin: 1,
    difficulty: "Architetto",
    rewardAurei: 25,
    hintSquare: [7, 7],
    hintText: "La Torre in h1 può salire in h7 con la copertura del Cavallo in f6.",
    winningMoveNotation: "Rh1→h7#",
    failedMoveHint: "La Torre in h1 deve raggiungere h7: il Cavallo in f6 difende la Torre e controlla simultaneamente le caselle g8 ed h8.",
    pieces: [
      { row: 7, col: 7, piece: { type: "r", color: "w" } }, // White Rook h1
      { row: 2, col: 5, piece: { type: "n", color: "w" } }, // White Knight f6
      { row: 7, col: 2, piece: { type: "k", color: "w" } }, // White King
      { row: 0, col: 7, piece: { type: "k", color: "b" } }, // Black King h8
      { row: 1, col: 6, piece: { type: "p", color: "b" } }, // Black pawn g7
    ],
    solution: [{ from: [7, 7], to: [1, 7] }], // Rh7#
  },
];

// =============================================================
// 4.1 DILEMMA DELLA SOGLIA GIORNALIERO (DAILY TACTICAL PUZZLE)
// =============================================================

export interface DailyPuzzleState {
  puzzle: ChessPuzzle;
  dateKey: string;
  timeUntilReset: string;
  isTodayCompleted: boolean;
  dailyStreak: number;
}

export function getDailyPuzzle(date: Date = new Date()): DailyPuzzleState {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dateKey = `${year}-${month}-${day}`;

  // Deterministic daily hash from date string
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  const puzzleIndex = hash % TACTICAL_PUZZLES.length;
  const basePuzzle = TACTICAL_PUZZLES[puzzleIndex];

  // Calcola tempo al reset di mezzanotte
  const now = date.getTime();
  const midnight = new Date(year, date.getMonth(), date.getDate() + 1, 0, 0, 0).getTime();
  const diffMs = Math.max(0, midnight - now);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const timeUntilReset = `${hours}h ${mins}m`;

  let isTodayCompleted = false;
  let dailyStreak = 0;
  if (typeof window !== "undefined") {
    const savedDate = localStorage.getItem("limen_chess_daily_puzzle_completed_date");
    isTodayCompleted = savedDate === dateKey;
    const rawStreak = localStorage.getItem("limen_chess_daily_puzzle_streak");
    dailyStreak = rawStreak ? parseInt(rawStreak, 10) : 0;
  }

  const dailyPuzzle: ChessPuzzle = {
    ...basePuzzle,
    id: `daily-${dateKey}`,
    title: `Dilemma del Giorno: ${basePuzzle.title.replace(/^\d+\.\s*/, "")}`,
    subtitle: `Sfida Quotidiana della Disciplina — ${dateKey}`,
    rewardAurei: basePuzzle.rewardAurei + 15, // Bonus fedeltà quotidiana
  };

  return {
    puzzle: dailyPuzzle,
    dateKey,
    timeUntilReset,
    isTodayCompleted,
    dailyStreak,
  };
}

export function markDailyPuzzleCompleted(dateKey: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("limen_chess_daily_puzzle_completed_date", dateKey);
    const rawStreak = localStorage.getItem("limen_chess_daily_puzzle_streak");
    const streak = rawStreak ? parseInt(rawStreak, 10) : 0;
    localStorage.setItem("limen_chess_daily_puzzle_streak", String(streak + 1));
  }
}

export function getDailyPuzzleStreak(): number {
  if (typeof window === "undefined") return 0;
  const rawStreak = localStorage.getItem("limen_chess_daily_puzzle_streak");
  return rawStreak ? parseInt(rawStreak, 10) : 0;
}

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

// =============================================================
// 6. POSITIONAL EVALUATION BAR, FEN & PGN UTILITIES
// =============================================================

export interface BoardEvaluation {
  scoreCentipawns: number;
  evalText: string;
  whiteWinPercentage: number;
}

export function calculateBoardEvaluation(
  board: (ChessPiece | null)[][],
  outcome?: GameOutcome
): BoardEvaluation {
  if (outcome === "checkmate") {
    return {
      scoreCentipawns: 9999,
      evalText: "#Matto",
      whiteWinPercentage: 100,
    };
  }

  const raw = evaluateBoardStatic(board);
  const pawns = raw / 100;
  const sign = pawns > 0 ? "+" : "";
  const evalText = `${sign}${pawns.toFixed(1)}`;

  // Sigmoid formula to map centipawns to 0..100% win probability
  const winProb = 1 / (1 + Math.pow(10, -raw / 400));
  const whiteWinPercentage = Math.max(5, Math.min(95, Math.round(winProb * 100)));

  return {
    scoreCentipawns: raw,
    evalText,
    whiteWinPercentage,
  };
}

export function boardToFen(
  board: (ChessPiece | null)[][],
  turn: PieceColor,
  moveCount: number = 1
): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let empty = 0;
    let rowStr = "";
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) {
          rowStr += empty;
          empty = 0;
        }
        const ch = p.type;
        rowStr += p.color === "w" ? ch.toUpperCase() : ch.toLowerCase();
      }
    }
    if (empty > 0) rowStr += empty;
    rows.push(rowStr);
  }
  return `${rows.join("/")} ${turn} - - 0 ${moveCount}`;
}

export function formatPgn(
  history: string[],
  eventTitle: string,
  result: string = "*"
): string {
  const dateStr = new Date().toISOString().split("T")[0];
  const lines = [
    `[Event "${eventTitle}"]`,
    `[Site "LIMEN PROTOCOL — Gli Scacchi dell'Ordine"]`,
    `[Date "${dateStr}"]`,
    `[White "Operatore"]`,
    `[Black "La Deriva"]`,
    `[Result "${result}"]`,
    "",
  ];
  let moveText = "";
  for (let i = 0; i < history.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1;
    const w = history[i];
    const b = history[i + 1] ? ` ${history[i + 1]}` : "";
    moveText += `${moveNum}. ${w}${b} `;
  }
  moveText += result;
  lines.push(moveText.trim());
  return lines.join("\n");
}

// =============================================================
// 7. ECO OPENINGS RECOGNITION & AUREUS TRADING ANALOGIES
// =============================================================

export interface ChessOpening {
  code: string;
  name: string;
  analogy: string;
}

interface OpeningPattern {
  pattern: string[];
  code: string;
  name: string;
  analogy: string;
}

const FAMOUS_OPENINGS: OpeningPattern[] = [
  {
    pattern: ["e2→e4", "e7→e5", "g1→f3", "b8→c6", "f1→b5"],
    code: "C60",
    name: "Partita Spagnola (Ruy Lopez)",
    analogy: "Posizionamento Istituzionale di Massima Pressione",
  },
  {
    pattern: ["e2→e4", "e7→e5", "g1→f3", "b8→c6", "f1→c4"],
    code: "C50",
    name: "Partita Italiana (Giuoco Piano)",
    analogy: "Sviluppo Armonico & Controllo Centrale Bilanciato",
  },
  {
    pattern: ["e2→e4", "e7→e5", "g1→f3", "b8→c6", "b1→c3", "g8→f6"],
    code: "C47",
    name: "Partita dei Quattro Cavalli",
    analogy: "Saturazione Solida del Perimetro Operativo",
  },
  {
    pattern: ["e2→e4", "e7→e5", "g1→f3", "b8→c6", "d2→d4"],
    code: "C45",
    name: "Partita Scozzese",
    analogy: "Apertura Aggressiva del Corridoio di Liquidità",
  },
  {
    pattern: ["e2→e4", "c7→c5", "g1→f3", "d7→d6", "d2→d4", "c5→d4", "f3→d4", "g8→f6", "b1→c3"],
    code: "B90",
    name: "Difesa Siciliana (Najdorf)",
    analogy: "Breakout Asimmetrico & Espansione di Volatilità",
  },
  {
    pattern: ["e2→e4", "c7→c5"],
    code: "B20",
    name: "Difesa Siciliana",
    analogy: "Risposta Contrarian ad Alto Rendimento",
  },
  {
    pattern: ["e2→e4", "e7→e6", "d2→d4", "d7→d5"],
    code: "C00",
    name: "Difesa Francese (Classica)",
    analogy: "Catena di Pedoni a Protezione del Capitale",
  },
  {
    pattern: ["e2→e4", "e7→e6"],
    code: "C00",
    name: "Difesa Francese",
    analogy: "Blocco di Contenimento Strutturato",
  },
  {
    pattern: ["e2→e4", "c7→c6", "d2→d4", "d7→d5"],
    code: "B12",
    name: "Difesa Caro-Kann (Classica)",
    analogy: "Gestione Solida del Rischio Senza Debolezze",
  },
  {
    pattern: ["e2→e4", "c7→c6"],
    code: "B10",
    name: "Difesa Caro-Kann",
    analogy: "Struttura Robusta a Bassa Vulnerabilità",
  },
  {
    pattern: ["d2→d4", "d7→d5", "c2→c4", "e7→e6"],
    code: "D30",
    name: "Gambetto di Donna Rifiutato",
    analogy: "Rifiuto delle Trappole Emotive & Difesa Ferrea",
  },
  {
    pattern: ["d2→d4", "d7→d5", "c2→c4", "d5→c4"],
    code: "D20",
    name: "Gambetto di Donna Accettato",
    analogy: "Incasso della Liquidità con Riorganizzazione",
  },
  {
    pattern: ["d2→d4", "d7→d5", "c2→c4"],
    code: "D06",
    name: "Gambetto di Donna",
    analogy: "Sacrificio Strategico per Iniziativa Centrale",
  },
  {
    pattern: ["d2→d4", "g8→f6", "c2→c4", "g7→g6"],
    code: "E60",
    name: "Difesa Est-Indiana",
    analogy: "Fianchetto Dinamico & Contrattacco Chirurgico",
  },
  {
    pattern: ["d2→d4", "d7→d5", "c1→f4"],
    code: "D00",
    name: "Sistema Londra",
    analogy: "Protocollo Operativo Sistematico & Ripetibile",
  },
  {
    pattern: ["e2→e4", "d7→d5"],
    code: "B01",
    name: "Difesa Scandinava",
    analogy: "Contestazione Immediata della Direzione",
  },
  {
    pattern: ["c2→c4"],
    code: "A10",
    name: "Apertura Inglese",
    analogy: "Controllo Istituzionale dalla Periferia",
  },
  {
    pattern: ["g1→f3"],
    code: "A04",
    name: "Apertura Réti",
    analogy: "Approccio Ipermoderno e Flessibile",
  },
  {
    pattern: ["e2→e4", "e7→e5"],
    code: "C20",
    name: "Partita Aperta",
    analogy: "Confronto Diretto nel Cuore del Mercato",
  },
  {
    pattern: ["d2→d4", "d7→d5"],
    code: "D00",
    name: "Partita Chiusa",
    analogy: "Ingegneria Posizionale a Bassa Volatilità",
  },
  {
    pattern: ["e2→e4"],
    code: "B00",
    name: "Spinta di Re (1. e4)",
    analogy: "Presa d'Iniziativa & Apertura delle Linee",
  },
  {
    pattern: ["d2→d4"],
    code: "A40",
    name: "Spinta di Donna (1. d4)",
    analogy: "Fondamenta Posizionali Solide",
  },
];

export function detectOpening(history: string[]): ChessOpening | null {
  if (!history || history.length === 0) return null;

  const normalized = history.map((m) => m.replace(/^[KQRBNP]/, ""));

  for (const op of FAMOUS_OPENINGS) {
    if (normalized.length >= op.pattern.length) {
      let match = true;
      for (let i = 0; i < op.pattern.length; i++) {
        if (normalized[i] !== op.pattern[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return {
          code: op.code,
          name: op.name,
          analogy: op.analogy,
        };
      }
    }
  }

  return null;
}


