/**
 * LIMEN PROTOCOL — L'Architetto dei Flussi (3D Spatial Logic & Resource Routing)
 * React UI Shell, 3D Canvas Diorama, Pressure / Flow Gauges, Level Campaign & Zen Meditative Mode.
 */

import { useEffect, useRef, useState, useMemo } from "react";
import {
  initFluid3dEngine,
  Fluid3dController,
} from "./fluid3dEngine";
import {
  FluidLevel,
  FluidNode,
  FluidPersistence,
} from "./fluidTypes";
import {
  FLUID_LEVELS,
  generateZenLevel,
  evaluateGridCircuit,
  loadFluidPersistence,
  saveFluidPersistence,
} from "./fluidEngine";
import { addMasterAurei, loadMasterVault } from "../unifiedArcadeStore";
import { gameAudio } from "../gameAudioSynthesizer";
import {
  RotateCcw,
  Play,
  Pause,
  Trophy,
  Shield,
  Zap,
  Sparkles,
  HelpCircle,
  Clock,
  Compass,
  ArrowRight,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Wind,
  Droplet,
  Layers,
  Coins,
} from "lucide-react";

interface FluidArchitectGameProps {
  onClose?: () => void;
  activeTradeContext?: {
    symbol?: string;
    direction?: string;
    durationMinutes?: number;
  };
}

export function FluidArchitectGame({ onClose, activeTradeContext }: FluidArchitectGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Fluid3dController | null>(null);

  // Persistence
  const [persistence, setPersistence] = useState<FluidPersistence>(() => loadFluidPersistence());

  // Game Mode: "campaign" | "zen"
  const [activeMode, setActiveMode] = useState<"campaign" | "zen">("campaign");
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);

  // Active Level & Grid State
  const [activeLevel, setActiveLevel] = useState<FluidLevel>(() => FLUID_LEVELS[0]);
  const [gridNodes, setGridNodes] = useState<FluidNode[][]>([]);

  // Simulation State
  const [isFlowRunning, setIsFlowRunning] = useState(false);
  const [currentQuota, setCurrentQuota] = useState(0);
  const [drawdownPressure, setDrawdownPressure] = useState(0);
  const [flowRate, setFlowRate] = useState(0);
  const [isVaultConnected, setIsVaultConnected] = useState(false);

  // Modals
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [earnedAurei, setEarnedAurei] = useState(0);
  const [earnedStars, setEarnedStars] = useState(3);

  // -------------------------------------------------------------
  // INITIALIZE THREE.JS 3D ENGINE
  // -------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const controller = initFluid3dEngine(containerRef.current, {
      onNodeRotate: (row, col) => {
        handleNodeClick(row, col);
      },
    });

    engineRef.current = controller;
    loadLevel(activeLevel);

    return () => {
      controller.dispose();
      engineRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------
  // LEVEL SETUP & GRID GENERATION
  // -------------------------------------------------------------

  function loadLevel(level: FluidLevel) {
    setActiveLevel(level);

    // Build 2D grid of FluidNodes
    const grid: FluidNode[][] = Array(level.gridRows)
      .fill(null)
      .map((_, r) =>
        Array(level.gridCols)
          .fill(null)
          .map((_, c) => ({
            id: `node_${r}_${c}`,
            row: r,
            col: c,
            type: "empty",
            rotation: 0,
            isFixed: false,
            isActive: false,
            currentFlowRate: 0,
            fluidType: "clean_emerald",
          }))
      );

    level.nodes.forEach((n) => {
      if (grid[n.row] && grid[n.row][n.col]) {
        grid[n.row][n.col] = {
          id: `node_${n.row}_${n.col}`,
          row: n.row,
          col: n.col,
          type: n.type,
          rotation: n.rotation,
          isFixed: n.isFixed || false,
          isActive: false,
          currentFlowRate: 0,
          fluidType: n.fluidType || "clean_emerald",
        };
      }
    });

    setGridNodes(grid);
    setCurrentQuota(0);
    setDrawdownPressure(0);
    setFlowRate(0);
    setIsVaultConnected(false);
    setIsFlowRunning(false);

    if (engineRef.current) {
      engineRef.current.setGridState(grid, level.gridRows, level.gridCols);
    }
  }

  // -------------------------------------------------------------
  // ROTATION INTERACTION
  // -------------------------------------------------------------

  function handleNodeClick(row: number, col: number) {
    setGridNodes((prev) => {
      const next = prev.map((r) => r.map((cell) => ({ ...cell })));
      const target = next[row][col];
      if (target && !target.isFixed) {
        target.rotation = (target.rotation + 90) % 360;
      }

      // Re-evaluate circuit connectivity
      const evalResult = evaluateGridCircuit(next, activeLevel.gridRows, activeLevel.gridCols);
      setDrawdownPressure(evalResult.drawdownPressure);
      setFlowRate(evalResult.flowRate);
      setIsVaultConnected(evalResult.isVaultReached);

      if (engineRef.current) {
        engineRef.current.updateActiveNodes(
          evalResult.activeNodeIds,
          evalResult.flowRate,
          evalResult.isVaultReached
        );
      }

      return next;
    });
  }

  // -------------------------------------------------------------
  // REAL-TIME FLOW LOOP
  // -------------------------------------------------------------
  useEffect(() => {
    if (!isFlowRunning) return;

    const interval = setInterval(() => {
      // Evaluate current grid
      const evalResult = evaluateGridCircuit(gridNodes, activeLevel.gridRows, activeLevel.gridCols);
      setDrawdownPressure(evalResult.drawdownPressure);
      setFlowRate(evalResult.flowRate);
      setIsVaultConnected(evalResult.isVaultReached);

      if (evalResult.drawdownPressure >= 100) {
        // Drawdown burst
        if (engineRef.current) {
          engineRef.current.triggerBurstEffect();
        }
        setIsFlowRunning(false);
      } else if (evalResult.isVaultReached) {
        // Vault filling smoothly
        setCurrentQuota((prev) => {
          const next = prev + 8;
          if (next >= activeLevel.targetQuota) {
            handleLevelComplete();
            return activeLevel.targetQuota;
          }
          return next;
        });
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isFlowRunning, gridNodes, activeLevel]);

  function toggleFlow() {
    const nextState = !isFlowRunning;
    setIsFlowRunning(nextState);

    if (nextState) {
      gameAudio.playHydraulicRush();
      const evalResult = evaluateGridCircuit(gridNodes, activeLevel.gridRows, activeLevel.gridCols);
      setDrawdownPressure(evalResult.drawdownPressure);
      setFlowRate(evalResult.flowRate);
      setIsVaultConnected(evalResult.isVaultReached);

      if (engineRef.current) {
        engineRef.current.updateActiveNodes(
          evalResult.activeNodeIds,
          evalResult.flowRate,
          evalResult.isVaultReached
        );
      }
    }
  }

  function handleVentPressure() {
    gameAudio.playSlide();
    setDrawdownPressure((prev) => Math.max(0, prev - 35));
  }

  function handleLevelComplete() {
    setIsFlowRunning(false);
    if (engineRef.current) {
      engineRef.current.triggerVictory();
    }

    const reward = activeLevel.rewardAurei;
    setEarnedAurei(reward);
    addMasterAurei(reward);
    setEarnedStars(drawdownPressure === 0 ? 3 : 2);

    const updated: FluidPersistence = {
      ...persistence,
      unlockedLevelIndex: Math.max(persistence.unlockedLevelIndex, currentLevelIndex + 1),
      levelStars: {
        ...persistence.levelStars,
        [activeLevel.id]: 3,
      },
      totalLitersChanneled: persistence.totalLitersChanneled + activeLevel.targetQuota,
    };
    saveFluidPersistence(updated);
    setPersistence(updated);
    setShowVictoryModal(true);
  }

  function restartCurrentLevel() {
    loadLevel(activeLevel);
  }

  function switchMode(mode: "campaign" | "zen") {
    setActiveMode(mode);
    if (mode === "campaign") {
      loadLevel(FLUID_LEVELS[currentLevelIndex] || FLUID_LEVELS[0]);
    } else {
      const zen = generateZenLevel();
      loadLevel(zen);
    }
  }

  return (
    <div className="w-full h-full relative flex flex-col font-mono select-none overflow-hidden text-foreground bg-[#07080b]">
      {/* ========================================================= */}
      {/* HEADER: TELEMETRY & MODE SWITCHER                         */}
      {/* ========================================================= */}
      <div className="p-2 sm:p-2.5 bg-[#0d0f14]/95 border-b border-[#C5A059]/20 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-black/50 border border-white/10">
            <button
              type="button"
              onClick={() => switchMode("campaign")}
              className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeMode === "campaign"
                  ? "bg-[#C5A059] text-black shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Compass size={13} />
              <span>La Via delle Ere</span>
            </button>

            <button
              type="button"
              onClick={() => switchMode("zen")}
              className={`px-3 py-1 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeMode === "zen"
                  ? "bg-[#C5A059] text-black shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Droplet size={13} />
              <span>Flusso Zen Infinito</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] text-xs font-bold uppercase tracking-wider">
            <span>{activeLevel.title}</span>
          </div>
        </div>

        {/* Center: Live Trade Telemetry Context */}
        {activeTradeContext?.symbol && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px]">
            <Clock size={12} className="animate-spin text-emerald-400" />
            <span className="font-bold">{activeTradeContext.symbol}</span>
            <span className="text-white font-medium whitespace-nowrap">
              {activeTradeContext.durationMinutes || 18} min a mani ferme
            </span>
          </div>
        )}

        {/* Right Counters */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] font-bold tabular-nums whitespace-nowrap">
            <Coins size={13} />
            <span>{loadMasterVault().masterAurei} Aurei</span>
          </div>

          <button
            type="button"
            onClick={restartCurrentLevel}
            className="p-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-[#C5A059]/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Riavvia circuito"
          >
            <RotateCcw size={15} />
          </button>

          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="p-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-[#C5A059]/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Moduli Meccanici & Valvole dell'Astrolabio"
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECONDARY STRIP: GAUGES & LEVEL SELECTOR                  */}
      {/* ========================================================= */}
      <div className="px-3 py-1.5 bg-[#090b10] border-b border-[#C5A059]/15 flex items-center justify-between gap-3 overflow-x-auto z-10 scrollbar-none">
        {/* Left: Telemetry Gauges (Pressure & Vault Quota) */}
        <div className="flex items-center gap-4 text-xs">
          {/* Pressure Gauge */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase whitespace-nowrap">
              Pressione Drawdown:
            </span>
            <div className="w-20 h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
              <div
                className={`h-full transition-all duration-200 ${
                  drawdownPressure > 60
                    ? "bg-rose-500"
                    : drawdownPressure > 30
                    ? "bg-amber-400"
                    : "bg-emerald-400"
                }`}
                style={{ width: `${drawdownPressure}%` }}
              />
            </div>
            <span
              className={`font-mono text-[11px] font-bold ${
                drawdownPressure > 60 ? "text-rose-400" : "text-slate-300"
              }`}
            >
              {drawdownPressure}%
            </span>
          </div>

          {/* Vault Quota */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground uppercase whitespace-nowrap">
              Caveau Rendimento:
            </span>
            <div className="w-24 h-2 bg-black/60 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-linear-to-r from-[#C5A059] to-emerald-400 transition-all duration-300"
                style={{ width: `${Math.min(100, (currentQuota / activeLevel.targetQuota) * 100)}%` }}
              />
            </div>
            <span className="font-mono text-[11px] text-[#E8C56A] font-bold whitespace-nowrap">
              {currentQuota} / {activeLevel.targetQuota}L
            </span>
          </div>
        </div>

        {/* Right: Campaign Era Chips or Zen Indicator */}
        {activeMode === "campaign" ? (
          <div className="flex items-center gap-1">
            {FLUID_LEVELS.map((lvl, idx) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => {
                  setCurrentLevelIndex(idx);
                  loadLevel(lvl);
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeLevel.id === lvl.id
                    ? "bg-[#C5A059] text-black"
                    : "bg-black/40 text-muted-foreground hover:text-white border border-white/10"
                }`}
              >
                Era {idx + 1}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-bold">
            <Droplet size={13} />
            <span>Circuito Procedurale Infinito</span>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 3D VIEWPORT CANVAS (NATIVE THREE.JS)                      */}
      {/* ========================================================= */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
        <div ref={containerRef} className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing" />

        {/* Floating Hint Overlay */}
        <div className="absolute top-3 left-4 pointer-events-none z-20">
          <div className="px-3 py-1.5 rounded-lg bg-black/75 border border-white/10 backdrop-blur-xs text-[11px] text-muted-foreground">
            Clicca sui condotti 3D per ruotarli di 90° e sigillare il circuito.
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BOTTOM ACTION BAR (FLOW VALVE & PRESSURE VENT)            */}
      {/* ========================================================= */}
      <div className="p-2 sm:p-2.5 bg-[#0d0f14]/95 border-t border-[#C5A059]/20 flex flex-wrap items-center justify-between gap-2 z-10 text-xs">
        {/* Left: Circuit Status */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase">Stato Circuito:</span>
          {isVaultConnected ? (
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-bold flex items-center gap-1 text-[10px]">
              <CheckCircle2 size={11} />
              <span>CAVEAU CONNESSO (Portata 100%)</span>
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold flex items-center gap-1 text-[10px]">
              <AlertTriangle size={11} />
              <span>CIRCUITO APERTO (Allinea i canali)</span>
            </span>
          )}
        </div>

        {/* Right Operational Buttons */}
        <div className="flex items-center gap-2">
          {/* Pressure Vent Button */}
          {drawdownPressure > 40 && (
            <button
              type="button"
              onClick={handleVentPressure}
              className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/35 hover:bg-rose-500/25 text-rose-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer animate-pulse"
              title="Sfoga la sovrapressione prima che esplodano le guarnizioni!"
            >
              <Wind size={13} />
              <span>SFIATO DI SICUREZZA</span>
            </button>
          )}

          {/* Toggle Flow Valve */}
          <button
            type="button"
            onClick={toggleFlow}
            className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md ${
              isFlowRunning
                ? "bg-amber-400 text-black hover:bg-amber-300"
                : "bg-[#C5A059] text-black hover:bg-[#E8C56A]"
            }`}
          >
            {isFlowRunning ? <Pause size={14} /> : <Play size={14} />}
            <span>{isFlowRunning ? "FERMA FLUSSO" : "APRI VALVOLA FLUSSO"}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* VICTORY MODAL                                             */}
      {/* ========================================================= */}
      {showVictoryModal && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d0f14] border border-[#C5A059]/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 size={28} />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground uppercase tracking-tight">
                Quota di Liquidità Raggiunta!
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Il flusso istituzionale è stato convogliato nel Caveau senza subire perdite di drawdown.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-around text-xs font-mono">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Valutazione</span>
                <strong className="text-base text-[#E8C56A]">{"★".repeat(earnedStars)}</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Aurei Conquistati</span>
                <strong className="text-base text-emerald-400">+{earnedAurei} Aurei</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowVictoryModal(false);
                if (activeMode === "campaign") {
                  const nextIndex = (currentLevelIndex + 1) % FLUID_LEVELS.length;
                  setCurrentLevelIndex(nextIndex);
                  loadLevel(FLUID_LEVELS[nextIndex]);
                } else {
                  loadLevel(generateZenLevel());
                }
              }}
              className="w-full py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#E8C56A] text-black font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <span>Avanza alla Prossima Era di Liquidità</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* RULES / MODULES CHEAT SHEET                               */}
      {/* ========================================================= */}
      {showRulesModal && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d0f14] border border-[#C5A059]/30 rounded-2xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-2.5">
              <h3 className="text-sm font-bold text-[#E8C56A] uppercase tracking-wider">
                I Moduli Meccanici dell'Astrolabio dei Flussi
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
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 space-y-0.5">
                <strong className="text-emerald-400 block">Sorgente di Inflow (Source)</strong>
                <span className="text-muted-foreground">Inietta liquidità macro nel sistema verso il primo condotto connesso.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 space-y-0.5">
                <strong className="text-[#E8C56A] block">Caveau di Rendimento (Vault)</strong>
                <span className="text-muted-foreground">Il serbatoio finale: riceve il flusso e completa la quota del livello.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 space-y-0.5">
                <strong className="text-sky-400 block">Filtro Anti-Slippage</strong>
                <span className="text-muted-foreground">Purifica le impurità di spread garantendo passaggio a zero perdite.</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/10 space-y-0.5">
                <strong className="text-amber-400 block">Condensatore di Volume</strong>
                <span className="text-muted-foreground">Accumula e comprime la liquidità rilasciandola senza provocare sovrapressione.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
