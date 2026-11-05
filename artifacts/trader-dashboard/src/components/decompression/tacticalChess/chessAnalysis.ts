/**
 * LIMEN PROTOCOL — Motore di Analisi Tattica & Disciplina Post-Partita
 * Accuracy Engine FIDE-grade con Classificazione Chirurgica delle Mosse
 * e Debriefing Stoico-Finanziario AUREUS.
 */

import { ChessPiece, PieceColor, Square } from "./chessTypes";
import {
  calculateBoardEvaluation,
  cloneBoard,
  getAllLegalMoves,
  applyMoveToBoard,
  evaluateGameOutcome,
  findKing,
} from "./chessEngine";

export type MoveClassification = "brilliant" | "great" | "best" | "inaccuracy" | "blunder";

export interface MoveAnalysis {
  ply: number; // 0, 1, 2...
  moveNumber: number; // 1, 2, 3...
  turn: PieceColor;
  notation: string;
  from: Square;
  to: Square;
  classification: MoveClassification;
  evalBefore: number; // Centipedoni
  evalAfter: number;
  evalDelta: number; // Guadagno o perdita dal punto di vista di chi muove
  winProbBefore: number;
  winProbAfter: number;
  bestAlternativeNotation?: string;
  debriefTitle: string;
  debriefText: string;
}

export interface GameReviewReport {
  operatorAccuracyPercent: number;
  opponentAccuracyPercent: number;
  disciplineGrade: "Sovrano" | "Maestro" | "Disciplinato" | "Incoerente" | "In Deriva";
  classificationCounts: Record<MoveClassification, number>;
  moves: MoveAnalysis[];
  keyMomentIndex?: number;
  summaryTitle: string;
  summaryDebrief: string;
}

const DEBRIEFS_BY_CLASS: Record<
  MoveClassification,
  Array<{ title: string; text: string }>
> = {
  brilliant: [
    {
      title: "Visione Sovrana",
      text: "Sacrificio posizionale calcolato con precisione millimetrica. L'asimmetria del rischio si trasforma in dominio strutturale.",
    },
    {
      title: "Breakout Asimmetrico",
      text: "Lettura profonda della struttura: hai trovato l'unica linea che sgretola le difese avversarie.",
    },
    {
      title: "Sfondamento del Varco",
      text: "Manovra di livello istituzionale: liquidità assorbita e controllo totale del centro.",
    },
  ],
  great: [
    {
      title: "Precisione Chirurgica",
      text: "Esecuzione inattaccabile. Nessuna dispersione di tempo operativo né concessione di controgioco.",
    },
    {
      title: "Allineamento Strutturale",
      text: "Controllo solido delle diagonali e dei punti di fuga. Rigore matematico rispettato.",
    },
  ],
  best: [
    {
      title: "Disciplina Confermata",
      text: "Mossa solida di sviluppo. Preserva l'integrità del piano senza deviazioni emotive.",
    },
    {
      title: "Tenuta del Supporto",
      text: "Consolidamento delle retrovie e pressione costante sul centro del tabellone.",
    },
  ],
  inaccuracy: [
    {
      title: "Micro-Esposizione",
      text: "Lieve imprecisione posizionale: concedi una frazione di iniziativa che l'avversario potrebbe sfruttare.",
    },
    {
      title: "Ritardo Operativo",
      text: "Sviluppo sub-ottimale di un pezzo minore. Mancata massimizzazione della pressione sul punto debole.",
    },
  ],
  blunder: [
    {
      title: "Rottura dello Stop-Loss",
      text: "Violazione grave delle regole di sicurezza: pezzo sospeso o via di fuga del Sovrano compromessa.",
    },
    {
      title: "Crollo della Struttura",
      text: "Errore decisivo sotto pressione emotiva: l'avversario acquisisce un vantaggio irreversibile.",
    },
  ],
};

/**
 * Analizza retrospettivamente la partita giocata mossa per mossa.
 * Convalida ciascun snapshot rispetto alla variazione di centipedoni e identifica
 * l'accuratezza operativa e la classificazione qualitativa di ciascuna decisione.
 */
export function analyzeGameHistory(
  snapshots: (ChessPiece | null)[][][],
  moveHistory: string[]
): GameReviewReport {
  if (snapshots.length < 2 || moveHistory.length === 0) {
    return {
      operatorAccuracyPercent: 100,
      opponentAccuracyPercent: 100,
      disciplineGrade: "Disciplinato",
      classificationCounts: {
        brilliant: 0,
        great: 0,
        best: 0,
        inaccuracy: 0,
        blunder: 0,
      },
      moves: [],
      summaryTitle: "Partita non conclusa",
      summaryDebrief: "Effettua un numero sufficiente di mosse per sbloccare la telemetria di disciplina.",
    };
  }

  const moves: MoveAnalysis[] = [];
  const counts: Record<MoveClassification, number> = {
    brilliant: 0,
    great: 0,
    best: 0,
    inaccuracy: 0,
    blunder: 0,
  };

  let totalOperatorPenalty = 0;
  let operatorMovesCount = 0;
  let totalOpponentPenalty = 0;
  let opponentMovesCount = 0;

  for (let i = 0; i < moveHistory.length; i++) {
    const prevBoard = snapshots[i];
    const nextBoard = snapshots[i + 1];
    if (!prevBoard || !nextBoard) break;

    const turn: PieceColor = i % 2 === 0 ? "w" : "b";
    const notation = moveHistory[i];

    // Ricava from e to approssimati dalla notazione (es. "Pe2→e4" o "e2→e4")
    const match = notation.match(/([a-h])([1-8])→([a-h])([1-8])/);
    const from: Square = match
      ? [8 - parseInt(match[2], 10), match[1].charCodeAt(0) - 97]
      : [0, 0];
    const to: Square = match
      ? [8 - parseInt(match[4], 10), match[3].charCodeAt(0) - 97]
      : [0, 0];

    const evalBefore = calculateBoardEvaluation(prevBoard, "playing");
    const evalAfter = calculateBoardEvaluation(nextBoard, "playing");

    // Valutazione orientata a chi muove
    const rawDelta =
      turn === "w"
        ? evalAfter.scoreCentipawns - evalBefore.scoreCentipawns
        : evalBefore.scoreCentipawns - evalAfter.scoreCentipawns;

    // Isola se c'era una mossa migliore
    const legalMoves = getAllLegalMoves(prevBoard, turn);
    let bestDelta = -9999;
    let bestMoveNotation: string | undefined = undefined;

    // Campiona le prime mosse legali per calcolare la mossa migliore teorica
    for (let m = 0; m < Math.min(legalMoves.length, 12); m++) {
      const candidateMove = legalMoves[m];
      const testBoard = cloneBoard(prevBoard);
      applyMoveToBoard(testBoard, candidateMove);
      const candEval = calculateBoardEvaluation(testBoard, "playing");
      const candDelta =
        turn === "w"
          ? candEval.scoreCentipawns - evalBefore.scoreCentipawns
          : evalBefore.scoreCentipawns - candEval.scoreCentipawns;

      if (candDelta > bestDelta) {
        bestDelta = candDelta;
        const [cfr, cfc] = candidateMove.from;
        const [ctr, ctc] = candidateMove.to;
        bestMoveNotation = `${String.fromCharCode(97 + cfc)}${8 - cfr}→${String.fromCharCode(
          97 + ctc
        )}`;
      }
    }

    const loss = Math.max(0, (bestDelta > -999 ? bestDelta : 0) - rawDelta);

    let classification: MoveClassification;
    // Criteri per "Brilliant": guadagno di oltre 1.8 pedoni (180 centipedoni) quando la posizione era pari o svantaggio,
    // oppure colpo con sacrificio
    const wasLosingOrEqual =
      turn === "w" ? evalBefore.scoreCentipawns <= 60 : evalBefore.scoreCentipawns >= -60;
    if (rawDelta >= 180 && wasLosingOrEqual) {
      classification = "brilliant";
    } else if (loss <= 20) {
      classification = "best";
    } else if (loss <= 50) {
      classification = "great";
    } else if (loss <= 150) {
      classification = "inaccuracy";
    } else {
      classification = "blunder";
    }

    counts[classification]++;

    const penalty = Math.min(1.0, loss / 200);
    if (turn === "w") {
      totalOperatorPenalty += penalty;
      operatorMovesCount++;
    } else {
      totalOpponentPenalty += penalty;
      opponentMovesCount++;
    }

    const debriefTemplates = DEBRIEFS_BY_CLASS[classification];
    const selectedTemplate = debriefTemplates[i % debriefTemplates.length];

    moves.push({
      ply: i,
      moveNumber: Math.floor(i / 2) + 1,
      turn,
      notation,
      from,
      to,
      classification,
      evalBefore: evalBefore.scoreCentipawns,
      evalAfter: evalAfter.scoreCentipawns,
      evalDelta: rawDelta,
      winProbBefore: evalBefore.whiteWinPercentage,
      winProbAfter: evalAfter.whiteWinPercentage,
      bestAlternativeNotation:
        loss > 45 && bestMoveNotation !== notation ? bestMoveNotation : undefined,
      debriefTitle: selectedTemplate.title,
      debriefText: selectedTemplate.text,
    });
  }

  const opAccuracy =
    operatorMovesCount > 0
      ? Math.round(Math.max(20, Math.min(99.6, (1 - totalOperatorPenalty / operatorMovesCount) * 100)) * 10) / 10
      : 100;

  const oppAccuracy =
    opponentMovesCount > 0
      ? Math.round(Math.max(20, Math.min(99.6, (1 - totalOpponentPenalty / opponentMovesCount) * 100)) * 10) / 10
      : 100;

  let disciplineGrade: GameReviewReport["disciplineGrade"];
  let summaryTitle = "";
  let summaryDebrief = "";

  if (opAccuracy >= 92) {
    disciplineGrade = "Sovrano";
    summaryTitle = "Integrità Esecutiva Sovrana";
    summaryDebrief =
      "Partita condotta con rigore monastico. Nessuna deviazione emotiva rilevata, le linee di liquidità sono state dominate con freddezza geometrica.";
  } else if (opAccuracy >= 82) {
    disciplineGrade = "Maestro";
    summaryTitle = "Controllo Tattico Istituzionale";
    summaryDebrief =
      "Esecuzione solida e conforme al piano. Le rare imperfezioni non hanno compromesso la tenuta del capitale e della posizione.";
  } else if (opAccuracy >= 70) {
    disciplineGrade = "Disciplinato";
    summaryTitle = "Tenuta Operativa Sufficiente";
    summaryDebrief =
      "Presenza costante sul tabellone. Alcune inesattezze nelle fasi di transizione indicano margine di affinamento nella gestione dei varchi.";
  } else if (opAccuracy >= 55) {
    disciplineGrade = "Incoerente";
    summaryTitle = "Segnali di Deriva Emotiva";
    summaryDebrief =
      "Rilevate fluttuazioni eccessive nelle decisioni di medio periodo. La rottura dei presidi posizionali rispecchia un'ansia esecutiva nel trading reale.";
  } else {
    disciplineGrade = "In Deriva";
    summaryTitle = "Deriva Critica — Stop Immediato";
    summaryDebrief =
      "Gravi errori di valutazione e sacrifici non calcolati. È imperativo sospendere l'attività di mercato e ripristinare il controllo conscio prima del prossimo trade.";
  }

  return {
    operatorAccuracyPercent: opAccuracy,
    opponentAccuracyPercent: oppAccuracy,
    disciplineGrade,
    classificationCounts: counts,
    moves,
    summaryTitle,
    summaryDebrief,
  };
}
