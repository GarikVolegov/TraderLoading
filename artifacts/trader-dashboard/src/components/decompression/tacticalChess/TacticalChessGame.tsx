/**
 * LIMEN PROTOCOL — Gli Scacchi dell'Ordine (Trans-Limen Tactical Chess 3D)
 * Scacchi Classici Puri FIDE in 3D: Puzzle Tattici ad Alta Fedeltà Decisionale,
 * Duelli Veloci contro IA a 3 Gradi di Elo, Calcolo Punteggio e Caveau Master Aurei.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import {
  initChess3dEngine,
  Chess3dController,
  CameraMode,
} from "./chess3dEngine";
import {
  ChessPiece,
  PieceColor,
  Square,
  Move,
  ChessPuzzle,
  AiProfile,
  ChessPersistence,
} from "./chessTypes";
import {
  createInitialBoard,
  cloneBoard,
  applyMoveToBoard,
  getPieceMoves,
  evaluateGameOutcome,
  findKing,
  AI_PROFILES,
  getBestMoveMinimax,
  TACTICAL_PUZZLES,
  PIECE_SYMBOLS,
  loadChessPersistence,
  saveChessPersistence,
  GameOutcome,
} from "./chessEngine";
import { gameAudio } from "../gameAudioSynthesizer";
import { addMasterAurei, loadMasterVault } from "../unifiedArcadeStore";
import {
  Crown,
  Trophy,
  Shield,
  Zap,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Clock,
  Compass,
  ArrowRight,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Play,
  Coins,
  Lightbulb,
  Volume2,
  VolumeX,
  Camera,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface TacticalChessGameProps {
  onClose?: () => void;
  activeTradeContext?: {
    symbol?: string;
    direction?: string;
    durationMinutes?: number;
  };
}

export function TacticalChessGame({ onClose, activeTradeContext }: TacticalChessGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Chess3dController | null>(null);

  // Persistence State
  const [persistence, setPersistence] = useState<ChessPersistence>(() => loadChessPersistence());
  const [walletAurei, setWalletAurei] = useState(() => loadMasterVault().masterAurei);

  // Game Mode: "puzzle" | "duel"
  const [activeMode, setActiveMode] = useState<"puzzle" | "duel">("puzzle");

  // Duel State
  const [selectedAi, setSelectedAi] = useState<AiProfile>(AI_PROFILES[0]);
  const [board, setBoard] = useState<(ChessPiece | null)[][]>(() => createInitialBoard());
  const [turn, setTurn] = useState<PieceColor>("w");
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMovesForSelected, setLegalMovesForSelected] = useState<Move[]>([]);
  const [outcome, setOutcome] = useState<GameOutcome>("playing");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Keyboard Navigation & Camera State
  const [keyboardCursor, setKeyboardCursor] = useState<Square>([7, 0]);
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("dynamic");

  // State refs to prevent stale closure bugs in 3D event callbacks
  const boardRef = useRef(board);
  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const interactionHandlerRef = useRef<(row: number, col: number) => void>(() => {});
  useEffect(() => {
    interactionHandlerRef.current = handleSquareInteraction;
  });

  // Puzzle State & Didactic Feedback
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [puzzleMoveStep, setPuzzleMoveStep] = useState(0);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [puzzleFailed, setPuzzleFailed] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [lastFailedNotation, setLastFailedNotation] = useState<string>("");
  const [showHint, setShowHint] = useState(false);

  // Modals & Audio
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [earnedAurei, setEarnedAurei] = useState(0);
  const [isAudioOn, setIsAudioOn] = useState(() => gameAudio.isEnabled());

  // Native & Modal Viewport Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    document.addEventListener("webkitfullscreenchange", handleFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      document.removeEventListener("webkitfullscreenchange", handleFsChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if ((document.documentElement as any).webkitRequestFullscreen) {
          await (document.documentElement as any).webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch {
      // Fallback for iframe / strict browser permissions: toggle modal container
      window.dispatchEvent(new CustomEvent("limen:toggle-fullscreen"));
      setIsFullscreen((prev) => !prev);
    }
  };

  const currentPuzzle = useMemo<ChessPuzzle>(() => {
    return TACTICAL_PUZZLES[currentPuzzleIndex] || TACTICAL_PUZZLES[0];
  }, [currentPuzzleIndex]);

  function cycleCameraMode() {
    setCameraMode((prev) => {
      const next: CameraMode =
        prev === "dynamic" ? "tactical" : prev === "tactical" ? "hero" : "dynamic";
      engineRef.current?.setCameraMode(next);
      return next;
    });
  }

  // -------------------------------------------------------------
  // INITIALIZE THREE.JS 3D ENGINE
  // -------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const controller = initChess3dEngine(containerRef.current, {
      onSquareClick: (row, col) => {
        interactionHandlerRef.current(row, col);
      },
      onSquareHover: (row, col) => {
        setHoveredSquare(row !== null && col !== null ? [row, col] : null);
      },
    });

    engineRef.current = controller;
    controller.setCameraMode(cameraMode);

    // Load initial board or puzzle
    if (activeMode === "puzzle") {
      loadPuzzle(currentPuzzle);
    } else {
      const initial = createInitialBoard();
      setBoard(initial);
      boardRef.current = initial;
      controller.setBoardState(initial);
      controller.setCursorSquare([6, 4]);
      setKeyboardCursor([6, 4]);
    }

    return () => {
      controller.dispose();
      engineRef.current = null;
    };
  }, [activeMode]);

  // -------------------------------------------------------------
  // KEYBOARD CONTROLLER (FRECCE/WASD, INVIO/SPAZIO, ESC, C, H, R)
  // -------------------------------------------------------------
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      if (e.key === "ArrowUp" || key === "w") {
        e.preventDefault();
        setKeyboardCursor(([r, c]) => {
          const next: Square = [Math.max(0, r - 1), c];
          engineRef.current?.setCursorSquare(next);
          return next;
        });
      } else if (e.key === "ArrowDown" || key === "s") {
        e.preventDefault();
        setKeyboardCursor(([r, c]) => {
          const next: Square = [Math.min(7, r + 1), c];
          engineRef.current?.setCursorSquare(next);
          return next;
        });
      } else if (e.key === "ArrowLeft" || key === "a") {
        e.preventDefault();
        setKeyboardCursor(([r, c]) => {
          const next: Square = [r, Math.max(0, c - 1)];
          engineRef.current?.setCursorSquare(next);
          return next;
        });
      } else if (e.key === "ArrowRight" || key === "d") {
        e.preventDefault();
        setKeyboardCursor(([r, c]) => {
          const next: Square = [r, Math.min(7, c + 1)];
          engineRef.current?.setCursorSquare(next);
          return next;
        });
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setKeyboardCursor(([r, c]) => {
          interactionHandlerRef.current(r, c);
          return [r, c];
        });
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedSquare(null);
        setLegalMovesForSelected([]);
        engineRef.current?.setSelectedSquare(null);
        setPuzzleFailed(false);
      } else if (key === "c") {
        e.preventDefault();
        cycleCameraMode();
      } else if (key === "f") {
        e.preventDefault();
        toggleFullscreen();
      } else if (key === "h") {
        e.preventDefault();
        handleTriggerHint();
      } else if (key === "r") {
        e.preventDefault();
        restartCurrentScenario();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // -------------------------------------------------------------
  // PUZZLE SYSTEM
  // -------------------------------------------------------------

  function loadPuzzle(puzzle: ChessPuzzle) {
    const freshBoard: (ChessPiece | null)[][] = Array(8)
      .fill(null)
      .map(() => Array(8).fill(null));

    puzzle.pieces.forEach(({ row, col, piece }) => {
      freshBoard[row][col] = { ...piece };
    });

    setBoard(freshBoard);
    boardRef.current = freshBoard;
    setTurn(puzzle.turn);
    setSelectedSquare(null);
    setLegalMovesForSelected([]);
    setPuzzleMoveStep(0);
    setPuzzleSolved(false);
    setPuzzleFailed(false);
    setIsReverting(false);
    setLastFailedNotation("");
    setShowHint(false);
    setOutcome("playing");
    setMoveHistory([]);

    setKeyboardCursor(puzzle.hintSquare);

    if (engineRef.current) {
      engineRef.current.setBoardState(freshBoard);
      engineRef.current.setSelectedSquare(null);
      engineRef.current.setCursorSquare(puzzle.hintSquare);
      engineRef.current.clearSolutionBeacon();
    }
  }

  function restartCurrentScenario() {
    setIsReverting(false);
    setPuzzleFailed(false);
    setLastFailedNotation("");
    engineRef.current?.clearSolutionBeacon();

    if (activeMode === "puzzle") {
      loadPuzzle(currentPuzzle);
    } else {
      const fresh = createInitialBoard();
      setBoard(fresh);
      boardRef.current = fresh;
      setTurn("w");
      setSelectedSquare(null);
      setLegalMovesForSelected([]);
      setOutcome("playing");
      setMoveHistory([]);
      setKeyboardCursor([6, 4]);
      if (engineRef.current) {
        engineRef.current.setBoardState(fresh);
        engineRef.current.setSelectedSquare(null);
        engineRef.current.setCursorSquare([6, 4]);
      }
    }
  }

  function handleTriggerHint() {
    if (activeMode !== "puzzle" || puzzleSolved || isReverting) return;
    setShowHint(true);
    setPuzzleFailed(false);
    gameAudio.playCardSelect();

    const [hr, hc] = currentPuzzle.hintSquare;
    const expected = currentPuzzle.solution[puzzleMoveStep] || currentPuzzle.solution[0];
    const moves = getPieceMoves(boardRef.current, hr, hc, true);
    setSelectedSquare([hr, hc]);
    setLegalMovesForSelected(moves);
    setKeyboardCursor([hr, hc]);

    if (engineRef.current) {
      engineRef.current.setSelectedSquare([hr, hc], moves.map((m) => m.to));
      engineRef.current.showSolutionBeacon([hr, hc], expected.to);
      engineRef.current.setCursorSquare([hr, hc]);
    }
  }

  // -------------------------------------------------------------
  // INTERACTION & MOVE EXECUTION
  // -------------------------------------------------------------

  function handleSquareInteraction(row: number, col: number) {
    if (isAiThinking || outcome === "checkmate" || puzzleSolved || isReverting) return;

    // Synchronize cursor position
    setKeyboardCursor([row, col]);
    engineRef.current?.setCursorSquare([row, col]);

    const currentBoard = boardRef.current;
    const piece = currentBoard[row][col];

    // If clicking own piece of active turn: select it
    if (piece && piece.color === turn) {
      gameAudio.playCardSelect();
      const moves = getPieceMoves(currentBoard, row, col, true);
      setSelectedSquare([row, col]);
      setLegalMovesForSelected(moves);

      if (engineRef.current) {
        engineRef.current.setSelectedSquare(
          [row, col],
          moves.map((m) => m.to)
        );
      }
      return;
    }

    // If clicking a valid destination for the selected piece
    if (selectedSquare) {
      const matchingMove = legalMovesForSelected.find(
        (m) => m.to[0] === row && m.to[1] === col
      );

      if (matchingMove) {
        executePlayerMove(matchingMove);
      } else {
        // Deselect if clicking an invalid square
        setSelectedSquare(null);
        setLegalMovesForSelected([]);
        if (engineRef.current) {
          engineRef.current.setSelectedSquare(null);
        }
      }
    }
  }

  function executePlayerMove(move: Move) {
    if (!engineRef.current || isReverting) return;

    const [fr, fc] = move.from;
    const [tr, tc] = move.to;

    // Snapshot board prior to move execution for clean undo/revert
    const previousBoard = cloneBoard(boardRef.current);

    engineRef.current.animateMove(move.from, move.to, () => {
      const nextBoard = cloneBoard(previousBoard);
      applyMoveToBoard(nextBoard, move);
      setBoard(nextBoard);
      boardRef.current = nextBoard;

      // Deselect in 3D
      setSelectedSquare(null);
      setLegalMovesForSelected([]);
      if (engineRef.current) {
        engineRef.current.setSelectedSquare(null);
        engineRef.current.setCursorSquare([tr, tc]);
      }
      setKeyboardCursor([tr, tc]);

      // Record Move notation
      const movedPiece = previousBoard[fr]?.[fc] || nextBoard[tr][tc];
      const notation = `${movedPiece ? movedPiece.type.toUpperCase() : ""}${String.fromCharCode(
        97 + fc
      )}${8 - fr}→${String.fromCharCode(97 + tc)}${8 - tr}`;
      setMoveHistory((prev) => [...prev, notation]);

      // Check Puzzle Logic
      if (activeMode === "puzzle") {
        verifyPuzzleMove(move, previousBoard, nextBoard, notation);
      } else {
        // Check Duel Logic
        const nextTurn: PieceColor = turn === "w" ? "b" : "w";
        setTurn(nextTurn);

        const nextOutcome = evaluateGameOutcome(nextBoard, nextTurn);
        setOutcome(nextOutcome);

        if (nextOutcome === "check" || nextOutcome === "checkmate") {
          const king = findKing(nextBoard, nextTurn);
          if (king && engineRef.current) {
            engineRef.current.triggerCheckHighlight(king);
          }
        }

        if (nextOutcome === "checkmate") {
          handleVictoryMatch();
        } else if (nextTurn === "b") {
          // Trigger AI turn
          triggerAiTurn(nextBoard);
        }
      }
    });
  }

  // Verify Puzzle Solution with Auto-Revert & Instructive Feedback
  function verifyPuzzleMove(
    playerMove: Move,
    previousBoard: (ChessPiece | null)[][],
    _newBoard: (ChessPiece | null)[][],
    notation: string
  ) {
    const expectedMove = currentPuzzle.solution[puzzleMoveStep];

    const isMatch =
      playerMove.from[0] === expectedMove.from[0] &&
      playerMove.from[1] === expectedMove.from[1] &&
      playerMove.to[0] === expectedMove.to[0] &&
      playerMove.to[1] === expectedMove.to[1];

    if (isMatch) {
      setPuzzleFailed(false);
      engineRef.current?.clearSolutionBeacon();

      const nextStep = puzzleMoveStep + 1;
      setPuzzleMoveStep(nextStep);

      if (nextStep >= currentPuzzle.solution.length) {
        // PUZZLE SOLVED!
        setPuzzleSolved(true);
        if (engineRef.current) {
          engineRef.current.triggerVictory();
        }
        gameAudio.playVictory();

        const totalEarned = currentPuzzle.rewardAurei;
        setEarnedAurei(totalEarned);
        const newMaster = addMasterAurei(totalEarned);
        setWalletAurei(newMaster);

        const updated: ChessPersistence = {
          ...persistence,
          playerElo: persistence.playerElo + 15,
          completedPuzzleIds: Array.from(
            new Set([...persistence.completedPuzzleIds, currentPuzzle.id])
          ),
        };
        saveChessPersistence(updated);
        setPersistence(updated);
        setShowVictoryModal(true);
      }
    } else {
      // Puzzle Move Incorrect - Trigger Auto Revert & Clear Didactic Feedback
      gameAudio.playExplosion();
      setLastFailedNotation(notation);
      setPuzzleFailed(true);
      setIsReverting(true);

      setTimeout(() => {
        if (!engineRef.current) {
          setIsReverting(false);
          return;
        }

        engineRef.current.animateRevert(playerMove.from, playerMove.to, () => {
          // Revert board state in memory
          setBoard(previousBoard);
          boardRef.current = previousBoard;
          engineRef.current?.setBoardState(previousBoard);
          engineRef.current?.setCursorSquare(playerMove.from);
          setKeyboardCursor(playerMove.from);
          setIsReverting(false);
        });
      }, 450);
    }
  }

  // AI Opponent Move in Duel Mode
  function triggerAiTurn(currentBoard: (ChessPiece | null)[][]) {
    setIsAiThinking(true);

    setTimeout(() => {
      const bestMove = getBestMoveMinimax(currentBoard, "b", selectedAi);
      setIsAiThinking(false);

      if (!bestMove || !engineRef.current) return;

      engineRef.current.animateMove(bestMove.from, bestMove.to, () => {
        const nextBoard = cloneBoard(currentBoard);
        applyMoveToBoard(nextBoard, bestMove);
        setBoard(nextBoard);
        setTurn("w");

        const [fr, fc] = bestMove.from;
        const [tr, tc] = bestMove.to;
        const piece = currentBoard[fr][fc];
        const notation = `${piece ? piece.type.toUpperCase() : ""}${String.fromCharCode(
          97 + fc
        )}${8 - fr}→${String.fromCharCode(97 + tc)}${8 - tr}`;
        setMoveHistory((prev) => [...prev, notation]);

        const nextOutcome = evaluateGameOutcome(nextBoard, "w");
        setOutcome(nextOutcome);

        if (nextOutcome === "check" || nextOutcome === "checkmate") {
          const king = findKing(nextBoard, "w");
          if (king && engineRef.current) {
            engineRef.current.triggerCheckHighlight(king);
          }
        }
      });
    }, 550);
  }

  function handleVictoryMatch() {
    if (engineRef.current) {
      engineRef.current.triggerVictory();
    }
    gameAudio.playVictory();
    const reward = 25;
    setEarnedAurei(reward);
    const newMaster = addMasterAurei(reward);
    setWalletAurei(newMaster);

    const updated: ChessPersistence = {
      ...persistence,
      playerElo: persistence.playerElo + 25,
      totalMatchesWon: persistence.totalMatchesWon + 1,
    };
    saveChessPersistence(updated);
    setPersistence(updated);
    setShowVictoryModal(true);
  }

  function toggleSound() {
    const next = gameAudio.toggle();
    setIsAudioOn(next);
  }

  return (
    <div className="w-full h-full relative flex flex-col font-mono select-none overflow-hidden text-foreground bg-[#07080b]">
      {/* ========================================================= */}
      {/* 1. HEADER: TELEMETRY & MODE SWITCHER                      */}
      {/* ========================================================= */}
      <div className="p-2 sm:p-2.5 bg-[#0d0f14]/95 border-b border-[#C5A059]/20 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/50 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setActiveMode("puzzle");
                loadPuzzle(currentPuzzle);
              }}
              className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeMode === "puzzle"
                  ? "bg-[#C5A059] text-black shadow-xs font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Zap size={13} />
              <span>Puzzle Tattici (10)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveMode("duel");
                restartCurrentScenario();
              }}
              className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeMode === "duel"
                  ? "bg-[#C5A059] text-black shadow-xs font-extrabold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Crown size={13} />
              <span>Partita vs IA (3 Livelli)</span>
            </button>
          </div>

          {/* Active Scenario Title */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] text-xs font-bold uppercase tracking-wider">
            <span>
              {activeMode === "puzzle" ? currentPuzzle.title : `Vs ${selectedAi.name}`}
            </span>
          </div>
        </div>

        {/* Center: Live Trade Telemetry Context */}
        {activeTradeContext?.symbol && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px]">
            <Clock size={12} className="animate-spin text-emerald-400" />
            <span className="font-bold">{activeTradeContext.symbol}</span>
            <span className="text-white font-medium whitespace-nowrap">
              {activeTradeContext.durationMinutes || 15} min a mani ferme
            </span>
          </div>
        )}

        {/* Right Counters: Elo, Aurei, Controls */}
        <div className="flex items-center gap-2 text-xs">
          {/* Elo Rating */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] font-bold tabular-nums whitespace-nowrap"
            title="Grado Elo dell'Operatore negli Scacchi dell'Ordine"
          >
            <Trophy size={13} />
            <span>Elo: {persistence.playerElo}</span>
          </div>

          {/* Master Aurei Vault */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] font-bold tabular-nums whitespace-nowrap">
            <Coins size={13} />
            <span>{walletAurei} Aurei</span>
          </div>

          {/* Camera Preset Switcher */}
          <button
            type="button"
            onClick={cycleCameraMode}
            className="px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 hover:bg-[#C5A059]/30 text-[#E8C56A] font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Cambia Regia Cinematografica [Scorciatoia: C]"
          >
            <Camera size={13} className="text-[#C5A059]" />
            <span className="hidden sm:inline text-muted-foreground text-[10px] uppercase">Regia:</span>
            <span className="font-mono uppercase text-[11px] text-white">
              {cameraMode === "dynamic"
                ? "Dinamica"
                : cameraMode === "tactical"
                ? "Tattica"
                : "Ravvicinata"}
            </span>
          </button>

          {/* Fullscreen Mode Switcher */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 hover:bg-[#C5A059]/30 text-[#E8C56A] font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title={isFullscreen ? "Riduci Schermo [Scorciatoia: F]" : "Schermo Intero [Scorciatoia: F]"}
          >
            {isFullscreen ? (
              <Minimize2 size={13} className="text-[#C5A059]" />
            ) : (
              <Maximize2 size={13} className="text-[#C5A059]" />
            )}
            <span className="hidden sm:inline text-muted-foreground text-[10px] uppercase">Vista:</span>
            <span className="font-mono uppercase text-[11px] text-white">
              {isFullscreen ? "Riduci" : "Schermo"}
            </span>
          </button>

          {/* Audio Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className="p-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-[#C5A059]/50 text-muted-foreground hover:text-[#E8C56A] transition-all cursor-pointer"
            title={isAudioOn ? "Disattiva Audio" : "Attiva Audio"}
          >
            {isAudioOn ? <Volume2 size={14} /> : <VolumeX size={14} className="text-rose-400" />}
          </button>

          {/* Restart Button */}
          <button
            type="button"
            onClick={restartCurrentScenario}
            className="p-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-[#C5A059]/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Riavvia lo scenario corrente"
          >
            <RotateCcw size={15} />
          </button>

          {/* Rules / Help */}
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="p-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-[#C5A059]/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Regole FIDE e Confluenze di Mercato"
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. SUB-BANNER: CLEAR OBJECTIVE & PUZZLE STRIP             */}
      {/* ========================================================= */}
      <div className="px-3 py-1.5 bg-[#090b10] border-b border-[#C5A059]/15 flex items-center justify-between gap-2 overflow-x-auto z-10 scrollbar-none">
        {activeMode === "puzzle" ? (
          <div className="flex items-center gap-3 text-xs w-full justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-[#C5A059] uppercase font-bold tracking-widest whitespace-nowrap">
                Obiettivo:
              </span>
              <strong className="text-white font-medium text-xs whitespace-nowrap">
                {currentPuzzle.objectiveText}
              </strong>
              <span className="text-muted-foreground text-[11px] hidden xl:inline italic whitespace-nowrap">
                ("{currentPuzzle.tradingAnalogy}")
              </span>
            </div>

            {/* Puzzle Quick Selector Chips (1..10) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-1">
                {TACTICAL_PUZZLES.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setCurrentPuzzleIndex(idx);
                      loadPuzzle(p);
                    }}
                    className={`w-6 h-6 rounded text-[11px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                      currentPuzzleIndex === idx
                        ? "bg-[#C5A059] text-black shadow-xs font-extrabold"
                        : persistence.completedPuzzleIds.includes(p.id)
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-black/40 text-muted-foreground hover:text-white border border-white/10"
                    }`}
                    title={p.title}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>

              <span className="text-[11px] text-[#E8C56A] font-bold ml-1 hidden sm:inline whitespace-nowrap">
                +{currentPuzzle.rewardAurei} Aurei
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs w-full justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                Avversario IA:
              </span>
              <div className="flex items-center gap-1">
                {AI_PROFILES.map((ai) => (
                  <button
                    key={ai.id}
                    type="button"
                    onClick={() => {
                      setSelectedAi(ai);
                      restartCurrentScenario();
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      selectedAi.id === ai.id
                        ? "bg-[#C5A059] text-black shadow-xs font-extrabold"
                        : "bg-black/40 text-muted-foreground hover:text-white border border-white/10"
                    }`}
                  >
                    {ai.name} ({ai.eloRating} Elo)
                  </button>
                ))}
              </div>
            </div>

            {/* Turn & Status Indicator */}
            <div className="flex items-center gap-2 text-xs">
              {isAiThinking ? (
                <span className="text-[#E8C56A] animate-pulse flex items-center gap-1 font-bold">
                  <Compass size={13} className="animate-spin" />
                  <span>IA sta calcolando la replica...</span>
                </span>
              ) : outcome === "check" ? (
                <span className="text-rose-400 font-bold flex items-center gap-1 animate-pulse">
                  <AlertTriangle size={13} />
                  <span>SCACCO AL RE!</span>
                </span>
              ) : (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping" />
                  <span>Tocca al Bianco (L'Operatore)</span>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3. 3D VIEWPORT CANVAS (NATIVE THREE.JS CLASSICAL)         */}
      {/* ========================================================= */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing"
        />

        {/* Failed move tactical guidance debrief card */}
        {puzzleFailed && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-lg">
            <div className="p-3.5 sm:p-4 rounded-2xl bg-[#0d0f14]/95 border border-rose-500/40 shadow-2xl backdrop-blur-xl space-y-2.5">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                  <AlertTriangle size={15} className="shrink-0 text-rose-400" />
                  <span>Mossa Non Risolutiva: {lastFailedNotation}</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold uppercase whitespace-nowrap">
                  Riprova
                </span>
              </div>

              <p className="text-xs text-white/90 leading-relaxed font-sans">
                {currentPuzzle.failedMoveHint || "Questa mossa non crea una minaccia decisiva. Il Re nemico sfugge o non è sotto scacco matto."}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setPuzzleFailed(false);
                    gameAudio.playCardSelect();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/15 hover:border-white/30 text-white font-bold transition-all cursor-pointer whitespace-nowrap"
                >
                  Ho Capito, Riprovo
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPuzzleFailed(false);
                    const [hr, hc] = currentPuzzle.hintSquare;
                    const expected = currentPuzzle.solution[0];
                    engineRef.current?.showSolutionBeacon([hr, hc], expected.to);
                    gameAudio.playVictory();
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-[#C5A059] hover:bg-[#E8C56A] text-black font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-md whitespace-nowrap"
                >
                  <Sparkles size={13} />
                  <span>Mostra Bersaglio Sulla Scacchiera</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Hint Callout */}
        {showHint && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="px-4 py-2 rounded-xl bg-black/90 border border-[#C5A059]/50 shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs text-[#E8C56A] font-medium">
              <Lightbulb size={15} className="text-[#C5A059] shrink-0" />
              <span>{currentPuzzle.hintText}</span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. BOTTOM TACTICAL HUD: HINT, NOTATION & ACTIONS          */}
      {/* ========================================================= */}
      <div className="p-2 sm:p-2.5 bg-[#0d0f14]/95 border-t border-[#C5A059]/20 flex flex-wrap items-center justify-between gap-2 z-10">
        {/* Left: Move History / Notation */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground hidden sm:inline">
            Ultime Mosse:
          </span>
          <div className="flex items-center gap-1 font-mono text-[11px] text-white">
            {moveHistory.slice(-4).map((m, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded bg-black/50 border border-white/10">
                {m}
              </span>
            ))}
            {moveHistory.length === 0 && (
              <span className="text-muted-foreground/60 text-[11px]">Nessuna mossa ancora eseguita.</span>
            )}
          </div>
        </div>

        {/* Center-Left: Active Square Telemetry */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/50 border border-white/10 text-xs">
          <Compass size={13} className="text-[#C5A059]" />
          <span className="text-[10px] text-muted-foreground uppercase">Casella:</span>
          <span className="font-mono font-bold text-[#E8C56A] uppercase">
            {selectedSquare
              ? `${String.fromCharCode(97 + selectedSquare[1])}${8 - selectedSquare[0]} (Selezionato)`
              : hoveredSquare
              ? `${String.fromCharCode(97 + hoveredSquare[1])}${8 - hoveredSquare[0]}`
              : `${String.fromCharCode(97 + keyboardCursor[1])}${8 - keyboardCursor[0]}`}
          </span>
        </div>

        {/* Center: Keyboard & Mouse Operational HUD Guide */}
        <div className="hidden md:flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
          <span className="px-1.5 py-0.5 rounded bg-black/50 border border-[#C5A059]/35 text-[#E8C56A] font-bold whitespace-nowrap">
            Frecce / WASD
          </span>
          <span className="whitespace-nowrap">Mira</span>
          <span className="px-1.5 py-0.5 rounded bg-black/50 border border-[#C5A059]/35 text-[#E8C56A] font-bold whitespace-nowrap">
            Invio / Spazio
          </span>
          <span className="whitespace-nowrap">Muovi</span>
          <span className="px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-white font-bold whitespace-nowrap">
            C
          </span>
          <span className="whitespace-nowrap">Regia</span>
          <span className="px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-white font-bold whitespace-nowrap">
            F
          </span>
          <span className="whitespace-nowrap">Schermo</span>
          <span className="px-1.5 py-0.5 rounded bg-black/50 border border-white/10 text-white font-bold whitespace-nowrap">
            ESC
          </span>
          <span className="whitespace-nowrap">Annulla</span>
        </div>

        {/* Right: Hint Button & Reset Controls */}
        <div className="flex items-center gap-2">
          {activeMode === "puzzle" && (
            <button
              type="button"
              onClick={handleTriggerHint}
              disabled={puzzleSolved}
              className="px-3 py-1.5 rounded-lg bg-black/50 border border-[#C5A059]/40 hover:bg-[#C5A059]/15 text-[#E8C56A] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              title="Mostra quale pezzo muovere per sbloccare la soluzione"
            >
              <Lightbulb size={14} className="text-[#C5A059]" />
              <span className="whitespace-nowrap">Suggerimento</span>
            </button>
          )}

          <button
            type="button"
            onClick={restartCurrentScenario}
            className="px-3.5 py-1.5 rounded-lg bg-black/50 border border-white/15 hover:border-[#C5A059]/40 text-xs text-muted-foreground hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw size={13} />
            <span className="whitespace-nowrap">Ricomincia</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. VICTORY MODAL                                          */}
      {/* ========================================================= */}
      {showVictoryModal && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d0f14] border border-[#C5A059]/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <Trophy size={24} />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#E8C56A] uppercase tracking-tight">
                {activeMode === "puzzle" ? "Scacco Matto Confermato!" : "Vittoria contro l'IA!"}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {activeMode === "puzzle"
                  ? `Hai risolto "${currentPuzzle.title}" con assoluta precisione decisionale.`
                  : `Hai battuto ${selectedAi.name} dimostrando superiorità posizionale.`}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-around text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Incremento Elo</span>
                <strong className="text-emerald-400 font-mono">+15 Elo</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Nuovo Rating</span>
                <strong className="text-white font-mono">{persistence.playerElo}</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Aurei Conquistati</span>
                <strong className="text-[#E8C56A] font-mono">+{earnedAurei}</strong>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowVictoryModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs font-bold text-muted-foreground hover:text-white transition-all cursor-pointer"
              >
                Rimani sulla Scacchiera
              </button>

              {activeMode === "puzzle" && currentPuzzleIndex < TACTICAL_PUZZLES.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowVictoryModal(false);
                    const nextIdx = currentPuzzleIndex + 1;
                    setCurrentPuzzleIndex(nextIdx);
                    loadPuzzle(TACTICAL_PUZZLES[nextIdx]);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#E8C56A] text-black font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <span>Prossimo Puzzle</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. RULES & COMPENDIUM MODAL                               */}
      {/* ========================================================= */}
      {showRulesModal && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d0f14] border border-[#C5A059]/30 rounded-2xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-2.5">
              <h3 className="text-sm font-bold text-[#E8C56A] uppercase tracking-wider">
                Regole Ufficiali FIDE & Dottrina degli Scacchi
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <strong className="text-white block font-bold">Pezzi e Movimento:</strong>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Scacchi classici autentici al 100%: Re (1 passo), Regina (raggi liberi), Torre (ortogonale), Alfiere (diagonale), Cavallo (salto a 'L' che scavalca i pezzi), Pedone (1 o 2 passi avanti, cattura in diagonale).
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <strong className="text-white block font-bold">Obiettivo: Lo Scacco Matto</strong>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Attaccare il Re nemico in modo che nessuna mossa legale possa salvarlo. Nessuna regola inventata: pura strategia logica, visione posizionale e calcolo ad alta fedeltà.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#C5A059]/10 border border-[#C5A059]/30 space-y-1 text-slate-300">
                <strong className="text-[#E8C56A] block font-bold">Il Valore del Trading:</strong>
                <p className="text-[11px] leading-relaxed">
                  Risolvere puzzle tattici allena l'occhio al riconoscimento immediato dei pattern (breakout, trappole, sacrifici calcolati), mantenendo la mente attiva e disciplinata durante la gestione dei tuoi trade reali.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
