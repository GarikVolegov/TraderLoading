/**
 * LIMEN PROTOCOL — Il Cockpit Tattico dell'Ordine (Trans-Limen Tactical Battlefield 3D)
 * Cockpit Tattico a Turni Spaziali: Posizionamento Ordini, Caccia alla Liquidità,
 * Difesa da Stop Hunt e Campagna Storica (1987 .. 2026).
 */

import { useState, useEffect, useRef, useMemo } from "react";
import {
  initCockpit3dEngine,
  Cockpit3dController,
} from "./cockpit3dEngine";
import {
  GridCoordinate,
  TacticalUnit,
  TelegraphedSweep,
  ScenarioMission,
  TacticalDoctrine,
  CockpitPersistence,
} from "./cockpitTypes";
import {
  SCENARIO_MISSIONS,
  TACTICAL_DOCTRINES,
  getLegalMovesForUnit,
  isTileProtectedBySentinel,
  loadCockpitPersistence,
  saveCockpitPersistence,
} from "./cockpitEngine";
import {
  addMasterAurei,
  spendMasterAurei,
  loadMasterVault,
} from "../unifiedArcadeStore";
import { gameAudio } from "../gameAudioSynthesizer";
import {
  Shield,
  ShieldCheck,
  Zap,
  Flame,
  Coins,
  RotateCcw,
  Trophy,
  Play,
  HelpCircle,
  Sparkles,
  Clock,
  Compass,
  Crosshair,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Lock,
  Volume2,
  VolumeX,
  ShoppingBag,
  Info,
} from "lucide-react";

interface TacticalCockpitGameProps {
  onClose?: () => void;
  activeTradeContext?: {
    symbol?: string;
    direction?: string;
    durationMinutes?: number;
  };
}

export function TacticalCockpitGame({
  onClose,
  activeTradeContext,
}: TacticalCockpitGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Cockpit3dController | null>(null);

  // Persistence
  const [persistence, setPersistence] = useState<CockpitPersistence>(() => loadCockpitPersistence());
  const [walletAurei, setWalletAurei] = useState(() =>
    Math.max(persistence.totalAurei, loadMasterVault().masterAurei)
  );

  // Scenario
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
  const currentScenario: ScenarioMission =
    SCENARIO_MISSIONS[selectedScenarioIndex] || SCENARIO_MISSIONS[0];

  // Game Loop State
  const [currentTurn, setCurrentTurn] = useState(1);
  const [actionPoints, setActionPoints] = useState(3);
  const [units, setUnits] = useState<TacticalUnit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [legalMoves, setLegalMoves] = useState<GridCoordinate[]>([]);
  const [activeSweeps, setActiveSweeps] = useState<TelegraphedSweep[]>([]);
  const [collectedPoolsThisRun, setCollectedPoolsThisRun] = useState(0);
  const [absorbedDamageThisRun, setAbsorbedDamageThisRun] = useState(0);

  // Health & Psychology
  const [vaultIntegrity, setVaultIntegrity] = useState(100);
  const [mentalIntegrity, setMentalIntegrity] = useState(100);

  // Phase & Modals
  const [gamePhase, setGamePhase] = useState<
    "operator_turn" | "executing_sweeps" | "victory" | "game_over" | "folded"
  >("operator_turn");
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showBazaarModal, setShowBazaarModal] = useState(false);
  const [isAudioOn, setIsAudioOn] = useState(() => gameAudio.isEnabled());

  // Selected Unit Reference
  const selectedUnit = useMemo(() => {
    return units.find((u) => u.id === selectedUnitId) || null;
  }, [units, selectedUnitId]);

  // All telegraphed target coordinates for 3D overlay
  const telegraphedCoords = useMemo<GridCoordinate[]>(() => {
    return activeSweeps.flatMap((s) => s.targetCoordinates);
  }, [activeSweeps]);

  // -----------------------------------------------------------------
  // INITIALIZE 3D ENGINE
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const controller = initCockpit3dEngine(containerRef.current, {
      onTileClick: (row, col) => {
        handleTileInteraction(row, col);
      },
      onUnitClick: (unitId) => {
        handleUnitInteraction(unitId);
      },
    });

    engineRef.current = controller;
    loadMission(currentScenario);

    return () => {
      controller.dispose();
      engineRef.current = null;
    };
  }, [selectedScenarioIndex]);

  // Sync Legal Move Disks
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setLegalMoveTiles(legalMoves);
    }
  }, [legalMoves]);

  // Sync Targeted Danger Overlay
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setTargetedTiles(telegraphedCoords);
    }
  }, [telegraphedCoords]);

  // -----------------------------------------------------------------
  // MISSION LOADER
  // -----------------------------------------------------------------
  function loadMission(mission: ScenarioMission) {
    const freshUnits = mission.initialUnits.map((u) => ({ ...u }));
    setUnits(freshUnits);
    setSelectedUnitId(null);
    setLegalMoves([]);
    setCurrentTurn(1);
    setActionPoints(3);
    setVaultIntegrity(100);
    setMentalIntegrity(100);
    setCollectedPoolsThisRun(0);
    setAbsorbedDamageThisRun(0);
    setGamePhase("operator_turn");

    const firstTurnSweeps = mission.generateSweepsForTurn(
      1,
      mission.gridRows,
      mission.gridCols
    );
    setActiveSweeps(firstTurnSweeps);

    if (engineRef.current) {
      engineRef.current.setScenario(
        mission.gridRows,
        mission.gridCols,
        mission.specialTiles
      );
      engineRef.current.updateUnits(freshUnits, null);
    }
  }

  function restartMission() {
    loadMission(currentScenario);
  }

  // -----------------------------------------------------------------
  // INTERACTION (UNIT SELECTION & MOVEMENT)
  // -----------------------------------------------------------------
  function handleUnitInteraction(unitId: string) {
    if (gamePhase !== "operator_turn") return;

    const targetUnit = units.find((u) => u.id === unitId);
    if (!targetUnit || targetUnit.integrity <= 0) return;

    gameAudio.playCardSelect();
    setSelectedUnitId(unitId);

    if (actionPoints >= targetUnit.costAP && !targetUnit.hasActedThisTurn) {
      const moves = getLegalMovesForUnit(
        targetUnit,
        units,
        currentScenario.gridRows,
        currentScenario.gridCols
      );
      setLegalMoves(moves);
    } else {
      setLegalMoves([]);
    }

    if (engineRef.current) {
      engineRef.current.updateUnits(units, unitId);
    }
  }

  function handleTileInteraction(row: number, col: number) {
    if (gamePhase !== "operator_turn") return;

    // If unit is selected and clicked on a legal destination: move it
    if (selectedUnit && legalMoves.some(([r, c]) => r === row && c === col)) {
      executeUnitMove(selectedUnit, [row, col]);
      return;
    }

    // Otherwise deselect
    setSelectedUnitId(null);
    setLegalMoves([]);
    if (engineRef.current) {
      engineRef.current.updateUnits(units, null);
    }
  }

  function executeUnitMove(unit: TacticalUnit, destination: GridCoordinate) {
    if (!engineRef.current || actionPoints < unit.costAP) return;

    const fromPos = unit.position;
    const nextAP = actionPoints - unit.costAP;
    setActionPoints(nextAP);
    setLegalMoves([]);

    gameAudio.playSlide();

    engineRef.current.animateUnitMove(unit.id, fromPos, destination, () => {
      // Check if destination is a Liquidity Pool tile
      const poolTile = currentScenario.specialTiles.find(
        (t) =>
          t.coord[0] === destination[0] &&
          t.coord[1] === destination[1] &&
          t.type === "liquidity_pool"
      );

      let earnedPoolAurei = 0;
      if (poolTile) {
        earnedPoolAurei = poolTile.yieldValue || 15;
        gameAudio.playLiquidity();
        setCollectedPoolsThisRun((prev) => prev + 1);
        const newBalance = addMasterAurei(earnedPoolAurei);
        setWalletAurei(newBalance);
        setMentalIntegrity((prev) => Math.min(100, prev + 10));
      }

      const updatedUnits = units.map((u) => {
        if (u.id === unit.id) {
          return {
            ...u,
            position: destination,
            hasActedThisTurn: true,
          };
        }
        return u;
      });

      setUnits(updatedUnits);
      setSelectedUnitId(null);

      if (engineRef.current) {
        engineRef.current.updateUnits(updatedUnits, null);
      }
    });
  }

  // -----------------------------------------------------------------
  // SPECIAL ACTIONS: FORTIFY ORDER BLOCK
  // -----------------------------------------------------------------
  function handleFortifyOrderBlock() {
    if (!selectedUnit || selectedUnit.type !== "order_block" || actionPoints < 1) return;

    gameAudio.playShieldAbsorb();
    setActionPoints((prev) => prev - 1);

    const updated = units.map((u) => {
      if (u.id === selectedUnit.id) {
        return {
          ...u,
          integrity: Math.min(u.maxIntegrity + 20, u.integrity + 25),
          isFortified: true,
          hasActedThisTurn: true,
        };
      }
      return u;
    });

    setUnits(updated);
    setSelectedUnitId(null);
    setLegalMoves([]);
    if (engineRef.current) {
      engineRef.current.updateUnits(updated, null);
    }
  }

  // -----------------------------------------------------------------
  // TURN EXECUTION (L'ESECUZIONE DELL'ALGORITMO)
  // -----------------------------------------------------------------
  function handleExecuteTurn() {
    if (gamePhase !== "operator_turn") return;

    setGamePhase("executing_sweeps");
    gameAudio.playExplosion();

    if (engineRef.current) {
      engineRef.current.triggerSweepExecutionAnimation(activeSweeps, () => {
        resolveTurnSweeps();
      });
    }
  }

  function resolveTurnSweeps() {
    let currentVaultHp = vaultIntegrity;
    let currentMentalHp = mentalIntegrity;
    let earnedDefensiveAurei = 0;

    // Check each sweep impact
    const updatedUnits = units.map((unit) => {
      const isTargeted = activeSweeps.some((s) =>
        s.targetCoordinates.some(([r, c]) => r === unit.position[0] && c === unit.position[1])
      );

      if (!isTargeted) {
        // Reset action for next turn
        return { ...unit, hasActedThisTurn: false, isFortified: false };
      }

      // Check if protected by Sentinel aura
      const isProtected = isTileProtectedBySentinel(unit.position, units);

      if (unit.type === "order_block") {
        // Order Block absorbs impact!
        gameAudio.playShieldAbsorb();
        earnedDefensiveAurei += 10;
        setAbsorbedDamageThisRun((prev) => prev + 25);
        const damage = unit.isFortified ? 10 : 25;
        const remainingHp = Math.max(0, unit.integrity - damage);
        return { ...unit, integrity: remainingHp, hasActedThisTurn: false, isFortified: false };
      }

      if (unit.type === "core_vault") {
        if (!isProtected) {
          // Direct hit on Vault!
          const damage = 35;
          currentVaultHp = Math.max(0, currentVaultHp - damage);
          currentMentalHp = Math.max(0, currentMentalHp - 25);
        }
        return { ...unit, integrity: currentVaultHp, hasActedThisTurn: false };
      }

      if (isProtected) {
        // Sentinel shielded this unit
        return { ...unit, hasActedThisTurn: false };
      }

      // Other units take standard sweep shock
      const remainingHp = Math.max(0, unit.integrity - 30);
      return { ...unit, integrity: remainingHp, hasActedThisTurn: false };
    });

    setUnits(updatedUnits);
    setVaultIntegrity(currentVaultHp);
    setMentalIntegrity(currentMentalHp);

    if (earnedDefensiveAurei > 0) {
      const newMaster = addMasterAurei(earnedDefensiveAurei);
      setWalletAurei(newMaster);
    }

    // Check Victory / Defeat
    if (currentVaultHp <= 0 || currentMentalHp <= 0) {
      setGamePhase("game_over");
      return;
    }

    const nextTurn = currentTurn + 1;
    if (nextTurn > currentScenario.turnsToSurvive) {
      handleScenarioVictory();
      return;
    }

    // Prepare next turn
    setCurrentTurn(nextTurn);
    setActionPoints(3);
    const nextSweeps = currentScenario.generateSweepsForTurn(
      nextTurn,
      currentScenario.gridRows,
      currentScenario.gridCols
    );
    setActiveSweeps(nextSweeps);
    setGamePhase("operator_turn");

    if (engineRef.current) {
      engineRef.current.updateUnits(updatedUnits, null);
    }
  }

  // -----------------------------------------------------------------
  // VICTORY & FOLD CONSCIO
  // -----------------------------------------------------------------
  function handleScenarioVictory() {
    if (engineRef.current) {
      engineRef.current.triggerVictoryFanfare();
    }
    gameAudio.playVictory();

    const reward = currentScenario.rewardAurei;
    const newMaster = addMasterAurei(reward);
    setWalletAurei(newMaster);

    const completed = Array.from(
      new Set([...persistence.completedScenarioIds, currentScenario.id])
    );
    const nextUnlocked = Math.max(persistence.unlockedScenarioId, currentScenario.id + 1);

    const updated: CockpitPersistence = {
      ...persistence,
      completedScenarioIds: completed,
      unlockedScenarioId: nextUnlocked,
      totalAurei: newMaster,
    };
    saveCockpitPersistence(updated);
    setPersistence(updated);

    setGamePhase("victory");
  }

  function handleFoldConscio() {
    if (gamePhase !== "operator_turn") return;

    gameAudio.playFold();
    const foldAureiBonus = 15;
    const newMaster = addMasterAurei(foldAureiBonus);
    setWalletAurei(newMaster);

    const updated: CockpitPersistence = {
      ...persistence,
      totalDisciplinedFolds: persistence.totalDisciplinedFolds + 1,
      totalAurei: newMaster,
    };
    saveCockpitPersistence(updated);
    setPersistence(updated);

    setGamePhase("folded");
  }

  function toggleSound() {
    const next = gameAudio.toggle();
    setIsAudioOn(next);
  }

  return (
    <div className="w-full h-full relative flex flex-col font-mono select-none overflow-hidden text-foreground bg-[#07080b]">
      {/* ========================================================= */}
      {/* 1. TOP TELEMETRY BAR & SCENARIO NAVIGATOR                 */}
      {/* ========================================================= */}
      <div className="p-2 sm:p-2.5 bg-[#0d0f14]/95 border-b border-[#C5A059]/20 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          {/* Mission Indicator Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] text-xs font-bold uppercase tracking-wider">
            <Shield size={14} className="text-[#C5A059]" />
            <span className="whitespace-nowrap">
              {currentScenario.year} · {currentScenario.name}
            </span>
          </div>

          {/* Scenario Selector Chips */}
          <div className="hidden lg:flex items-center gap-1 p-0.5 rounded-lg bg-black/50 border border-white/10">
            {SCENARIO_MISSIONS.map((s, idx) => {
              const isLocked = s.id > persistence.unlockedScenarioId;
              const isCompleted = persistence.completedScenarioIds.includes(s.id);
              const isActive = selectedScenarioIndex === idx;

              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => setSelectedScenarioIndex(idx)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                    isActive
                      ? "bg-[#C5A059] text-black shadow-xs"
                      : isCompleted
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                      : isLocked
                      ? "text-muted-foreground/40 cursor-not-allowed opacity-50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={`${s.year} - ${s.name}`}
                >
                  {isLocked && <Lock size={10} />}
                  <span>{s.year}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Live Detachment Context */}
        {activeTradeContext?.symbol && (
          <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px]">
            <Clock size={12} className="animate-spin text-emerald-400" />
            <span className="font-bold">{activeTradeContext.symbol}</span>
            <span className="text-white font-medium whitespace-nowrap">
              {activeTradeContext.durationMinutes || 20} min di lucidità
            </span>
          </div>
        )}

        {/* Right Counters: AP, Integrity, Aurei, Controls */}
        <div className="flex items-center gap-2 text-xs">
          {/* Action Points (AP) */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/60 border border-[#C5A059]/40 text-[#E8C56A] font-bold"
            title="Margine Operativo: 3 Azioni disponibili per turno"
          >
            <Zap size={13} className="text-[#E8C56A]" />
            <span className="text-[10px] text-muted-foreground uppercase hidden sm:inline">AP:</span>
            <span className="tabular-nums whitespace-nowrap">{actionPoints}/3</span>
          </div>

          {/* Core Vault HP */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-black/50 border border-white/10 text-xs"
            title="Integrità del Bastione di Capitale"
          >
            <Shield size={13} className={vaultIntegrity < 40 ? "text-rose-400" : "text-emerald-400"} />
            <span className="text-[10px] text-muted-foreground uppercase hidden sm:inline">Bastione:</span>
            <span
              className={`font-bold tabular-nums whitespace-nowrap ${
                vaultIntegrity < 40 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {vaultIntegrity}%
            </span>
          </div>

          {/* Master Aurei Vault */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] font-bold tabular-nums whitespace-nowrap">
            <Coins size={13} />
            <span>{walletAurei} Aurei</span>
          </div>

          {/* Audio Toggle */}
          <button
            type="button"
            onClick={toggleSound}
            className="p-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-[#C5A059]/50 text-muted-foreground hover:text-[#E8C56A] transition-all cursor-pointer"
            title={isAudioOn ? "Disattiva Audio" : "Attiva Audio Procedurale"}
          >
            {isAudioOn ? <Volume2 size={14} /> : <VolumeX size={14} className="text-rose-400" />}
          </button>

          {/* Arsenal / Shop Button */}
          <button
            type="button"
            onClick={() => setShowBazaarModal(true)}
            className="p-1.5 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/35 hover:bg-[#C5A059]/25 text-[#E8C56A] transition-all cursor-pointer"
            title="Arsenale dell'Ordine: Dottrine Tattiche"
          >
            <ShoppingBag size={14} />
          </button>

          {/* Rules / Compendium Button */}
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="p-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-[#C5A059]/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Dottrina del Book & Regole Tattiche"
          >
            <HelpCircle size={14} />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. TELEGRAPHED ALERT BANNER                               */}
      {/* ========================================================= */}
      <div className="px-3 py-1.5 bg-[#0d0708] border-b border-rose-500/30 flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2 text-xs truncate">
          <AlertTriangle size={14} className="text-rose-400 shrink-0 animate-pulse" />
          <span className="text-[10px] text-rose-400 uppercase font-bold tracking-wider shrink-0">
            MINACCIA ALGORITMICA TELEGRAFATA:
          </span>
          <span className="text-slate-300 truncate text-[11px]">
            {activeSweeps[0]?.warningMessage || "Nessun vettore immediato rilevato."}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs shrink-0 font-mono">
          <span className="text-[10px] text-muted-foreground">Turno:</span>
          <strong className="text-white whitespace-nowrap">
            {currentTurn} / {currentScenario.turnsToSurvive}
          </strong>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. 3D VIEWPORT CANVAS (NATIVE THREE.JS ISOMETRIC)         */}
      {/* ========================================================= */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
        <div
          ref={containerRef}
          className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing"
        />

        {/* Floating Quick Hint if no unit selected */}
        {!selectedUnit && gamePhase === "operator_turn" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-20">
            <div className="px-3 py-1 rounded-full bg-black/80 border border-[#C5A059]/30 text-[11px] text-[#E8C56A] backdrop-blur-xs flex items-center gap-1.5">
              <Crosshair size={12} />
              <span>Clicca su un Modulo 3D sulla scacchiera per impartire ordini.</span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* 4. BOTTOM TACTICAL COMMAND BAR                            */}
      {/* ========================================================= */}
      <div className="p-2 sm:p-3 bg-[#0d0f14]/95 border-t border-[#C5A059]/20 flex flex-wrap items-center justify-between gap-2.5 z-10">
        {/* Left: Selected Unit Status Card */}
        <div className="flex items-center gap-2.5 min-w-[200px]">
          {selectedUnit ? (
            <div className="flex items-center gap-2.5 p-1.5 px-3 rounded-xl bg-black/60 border border-[#C5A059]/40 text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#E8C56A]">{selectedUnit.name}</span>
                  <span className="text-[9px] uppercase px-1 rounded bg-white/10 text-muted-foreground">
                    Raggio: {selectedUnit.movementRange}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-muted-foreground">Corazza:</span>
                  <strong className="text-emerald-400 font-mono">
                    {selectedUnit.integrity} / {selectedUnit.maxIntegrity}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground hidden sm:block">
              Nessun modulo selezionato. Seleziona una pedina per visualizzare gli ordini.
            </div>
          )}
        </div>

        {/* Center: Contextual Actions for Selected Unit */}
        <div className="flex items-center gap-2">
          {selectedUnit?.type === "order_block" && (
            <button
              type="button"
              onClick={handleFortifyOrderBlock}
              disabled={actionPoints < 1 || selectedUnit.hasActedThisTurn}
              className="px-3.5 py-1.5 rounded-lg bg-black/60 border border-[#C5A059]/50 hover:bg-[#C5A059]/20 text-[#E8C56A] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              title="Fortifica il blocco: aumenta la corazza di assorbimento (+25 HP)"
            >
              <ShieldCheck size={14} className="text-[#C5A059]" />
              <span className="whitespace-nowrap">Fortifica Barriera (1 AP)</span>
            </button>
          )}

          {selectedUnit && (
            <button
              type="button"
              onClick={() => {
                setSelectedUnitId(null);
                setLegalMoves([]);
                if (engineRef.current) engineRef.current.updateUnits(units, null);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-white/25 text-xs text-muted-foreground hover:text-white transition-all cursor-pointer"
            >
              Annulla
            </button>
          )}
        </div>

        {/* Right: Master Turn Execution & Fold Conscio */}
        <div className="flex items-center gap-2">
          {/* FOLD CONSCIO (Hedging di Disciplina) */}
          <button
            type="button"
            onClick={handleFoldConscio}
            disabled={gamePhase !== "operator_turn"}
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            title="Preserva il capitale: ritira le posizioni esposte, incassa il salvataggio ed esci con integrità mentale intatta!"
          >
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="whitespace-nowrap">FOLD CONSCIO</span>
          </button>

          {/* TRASMETTI ORDINI / ESEGUI TURNO */}
          <button
            type="button"
            onClick={handleExecuteTurn}
            disabled={gamePhase !== "operator_turn"}
            className="px-5 py-2 rounded-lg bg-[#C5A059] hover:bg-[#E8C56A] text-black font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 shadow-lg hover:shadow-[#C5A059]/20"
          >
            <Play size={14} />
            <span className="whitespace-nowrap">TRASMETTI ORDINI</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 5. ARSENALE & BAZAAR DELL'ORDINE MODAL                    */}
      {/* ========================================================= */}
      {showBazaarModal && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#0d0f14] border border-[#C5A059]/30 rounded-2xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} className="text-[#C5A059]" />
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Arsenale & Dottrine Tattiche dell'Ordine
                  </h3>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Investi gli Aurei accumulati per sbloccare vantaggi operativi permanenti.
                </p>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] font-bold text-xs">
                <Coins size={14} />
                <span className="tabular-nums whitespace-nowrap">{walletAurei} Aurei</span>
              </div>
            </div>

            {/* Doctrine Cards */}
            <div className="space-y-2.5">
              {TACTICAL_DOCTRINES.map((doctrine) => {
                const isUnlocked = persistence.unlockedDoctrineIds.includes(doctrine.id);
                const canAfford = walletAurei >= doctrine.costAurei;

                return (
                  <div
                    key={doctrine.id}
                    className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-xs text-white block">{doctrine.name}</strong>
                        <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-white/5 text-muted-foreground font-mono">
                          {doctrine.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {doctrine.description}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold">
                          <CheckCircle2 size={14} /> Sbloccato
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => {
                            const spendRes = spendMasterAurei(doctrine.costAurei);
                            if (spendRes.success) {
                              setWalletAurei(spendRes.newBalance);
                              const updated = {
                                ...persistence,
                                totalAurei: spendRes.newBalance,
                                unlockedDoctrineIds: [...persistence.unlockedDoctrineIds, doctrine.id],
                              };
                              saveCockpitPersistence(updated);
                              setPersistence(updated);
                              gameAudio.playShopBuy();
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/35 hover:bg-[#C5A059]/25 text-[#E8C56A] text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Coins size={12} />
                          <span className="whitespace-nowrap">{doctrine.costAurei} Aurei</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setShowBazaarModal(false)}
                className="px-4 py-1.5 rounded-lg bg-black/60 border border-white/15 text-xs text-muted-foreground hover:text-white transition-all cursor-pointer"
              >
                Chiudi Arsenale
              </button>
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
                Dottrina Operativa del Cockpit Tattico
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <strong className="text-white block font-bold">1. La Griglia del Book 3D:</strong>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Il campo rappresenta il book istituzionale. Le celle dorate sono <strong>Zone di Mitigazione</strong>, i rettangoli verdi sono <strong>Pool di Liquidità</strong> (da raccogliere per guadagnare Aurei) e le crepe azzurre sono <strong>Fair Value Gaps</strong>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <strong className="text-white block font-bold">2. I Vettori di Sweep Telegrafati:</strong>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  L'Algoritmo Predatore telegrafa con 1 turno di anticipo le celle che spazzerà via (riquadri rossi). Posiziona l'<strong>Order Block Fort</strong> per intercettare l'attacco: l'impatto verrà mitigato e convertito in rendimento!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1">
                <strong className="text-white block font-bold">3. L'Aura del Risk Sentinel:</strong>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Il Sentinel proietta un'aura protettiva su tutte le caselle adiacenti. Le unità dentro l'aura sono immuni dagli stop hunt.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#C5A059]/10 border border-[#C5A059]/30 space-y-1 text-slate-300">
                <strong className="text-[#E8C56A] block font-bold">4. Il FOLD Conscio:</strong>
                <p className="text-[11px] leading-relaxed">
                  Se una situazione diventa insostenibile, esegui il <strong>FOLD CONSCIO</strong>: preservi il capitale accumulato, ottieni Aurei di salvaguardia e mantieni intatta la tua lucidità mentale.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. VICTORY / DEFEAT / FOLD OVERLAYS                       */}
      {/* ========================================================= */}
      {gamePhase === "victory" && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d0f14] border border-[#C5A059]/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <Trophy size={24} />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#E8C56A] uppercase tracking-tight">
                Vittoria Istituzionale: Mercato Conquistato!
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hai protetto il Bastione di Capitale durante <strong>{currentScenario.name}</strong>, respingendo l'Algoritmo Predatore.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-around text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Liquidità Raccolta</span>
                <strong className="text-emerald-400 font-mono">{collectedPoolsThisRun} Pool</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Danno Mitigato</span>
                <strong className="text-sky-400 font-mono">+{absorbedDamageThisRun} HP</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Premio Aurei</span>
                <strong className="text-[#E8C56A] font-mono">+{currentScenario.rewardAurei}</strong>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={restartMission}
                className="flex-1 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs font-bold text-muted-foreground hover:text-white transition-all cursor-pointer"
              >
                Rigioca Scenario
              </button>
              {selectedScenarioIndex < SCENARIO_MISSIONS.length - 1 && (
                <button
                  type="button"
                  onClick={() => setSelectedScenarioIndex((prev) => prev + 1)}
                  className="flex-1 py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#E8C56A] text-black font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <span>Prossima Era</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {gamePhase === "game_over" && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d0f14] border border-rose-500/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <Shield size={24} />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-rose-400 uppercase tracking-tight">
                Margin Call: Bastione Liquidato
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Gli sweep algoritmici hanno eroso la corazza del Bastione. Ricorda: l'Order Block deve sempre intercettare i vettori marcati in rosso.
              </p>
            </div>

            <button
              type="button"
              onClick={restartMission}
              className="w-full py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#E8C56A] text-black font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <RotateCcw size={15} />
              <span>Riprova la Manovra</span>
            </button>
          </div>
        </div>
      )}

      {gamePhase === "folded" && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d0f14] border border-emerald-500/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              <ShieldCheck size={24} />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-emerald-400 uppercase tracking-tight">
                Disciplina Suprema: Fold Conscio
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Hai riconosciuto l'asimmetria sfavorevole del mercato e hai ritirato le posizioni. Il capitale è salvo e l'integrità mentale è preservata (+15 Aurei di salvaguardia).
              </p>
            </div>

            <button
              type="button"
              onClick={restartMission}
              className="w-full py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#E8C56A] text-black font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <RotateCcw size={15} />
              <span>Torna al Cockpit Tattico</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
