import { useState, useEffect } from "react";
import {
  type ExpeditionRunState,
  type ExpeditionNode,
  type DisciplineCard,
  type MarketEnemy,
  type OracleDilemma,
  type Relic,
} from "./chroniclesTypes";
import {
  STARTER_DECK,
  UNLOCKABLE_CARDS,
  SECTOR_ENEMIES,
  ORACLE_DILEMMAS,
  EXPEDITION_RELICS,
  generateExpeditionSectorNodes,
} from "./chroniclesTacticalData";
import {
  saveChroniclesPersistence,
  loadChroniclesPersistence,
} from "./chroniclesCampaignData";
import { gameAudio } from "../gameAudioSynthesizer";
import {
  Shield,
  Heart,
  Zap,
  Sword,
  Sparkles,
  Compass,
  RotateCcw,
  Trophy,
  CheckCircle2,
  AlertTriangle,
  Coins,
  ArrowRight,
  BookOpen,
} from "lucide-react";

interface TacticalExpeditionGameProps {
  onClose?: () => void;
  activeTradeContext?: {
    symbol?: string;
    direction?: string;
  };
}

export function TacticalExpeditionGame({ onClose, activeTradeContext }: TacticalExpeditionGameProps) {
  const [nodes, setNodes] = useState<ExpeditionNode[]>(() => generateExpeditionSectorNodes(1));
  const [state, setState] = useState<ExpeditionRunState>(() => createInitialState());
  const [viewMode, setViewMode] = useState<"map" | "battle" | "oracle" | "oasis" | "bazaar" | "victory" | "gameover">("map");
  const [combatLog, setCombatLog] = useState<string[]>(["Incontro iniziato. Mantieni la calma."]);

  function createInitialState(): ExpeditionRunState {
    const deck = [...STARTER_DECK];
    return {
      isActive: true,
      sector: 1,
      currentStep: 0,
      currentNodeId: null,
      sanity: 80,
      maxSanity: 100,
      mana: 3,
      maxMana: 3,
      capitalAurei: 50,
      deck,
      hand: [],
      discardPile: [],
      drawPile: [...deck],
      relics: [],
      activeShield: 0,
      currentEnemy: null,
      currentDilemma: null,
    };
  }

  // Draw cards into hand helper
  const drawCards = (count: number, currentState: ExpeditionRunState): ExpeditionRunState => {
    let drawPile = [...currentState.drawPile];
    let discardPile = [...currentState.discardPile];
    const hand = [...currentState.hand];

    for (let i = 0; i < count; i++) {
      if (drawPile.length === 0) {
        if (discardPile.length === 0) break;
        drawPile = [...discardPile].sort(() => Math.random() - 0.5);
        discardPile = [];
      }
      const card = drawPile.pop();
      if (card) hand.push(card);
    }

    return {
      ...currentState,
      drawPile,
      discardPile,
      hand,
    };
  };

  // Start node event
  const enterNode = (node: ExpeditionNode) => {
    const updatedNodes = nodes.map((n) =>
      n.id === node.id ? { ...n, available: false } : n,
    );
    setNodes(updatedNodes);

    if (node.type === "battle" || node.type === "boss") {
      const enemies = SECTOR_ENEMIES[state.sector] || SECTOR_ENEMIES[1];
      const enemyTemplate =
        node.type === "boss"
          ? SECTOR_ENEMIES[4][0]
          : enemies[Math.floor(Math.random() * enemies.length)];

      const activeEnemy: MarketEnemy = {
        ...enemyTemplate,
        currentHp: enemyTemplate.maxHp,
      };

      let withCards: ExpeditionRunState = {
        ...state,
        currentEnemy: activeEnemy,
        mana: state.maxMana,
        activeShield: state.relics.some((r) => r.id === "relic_steady_hand") ? 3 : 0,
        hand: [],
        discardPile: [],
        drawPile: [...state.deck].sort(() => Math.random() - 0.5),
      };
      withCards = drawCards(4, withCards);

      setState(withCards);
      setCombatLog([`Anomalia rilevata: ${activeEnemy.name}. ${activeEnemy.title}`]);
      setViewMode("battle");
    } else if (node.type === "oracle") {
      const dilemma = ORACLE_DILEMMAS[Math.floor(Math.random() * ORACLE_DILEMMAS.length)];
      setState((prev) => ({ ...prev, currentDilemma: dilemma }));
      setViewMode("oracle");
    } else if (node.type === "oasis") {
      setViewMode("oasis");
    } else if (node.type === "bazaar") {
      setViewMode("bazaar");
    }
  };

  // Play a Discipline Card in Combat
  const playCard = (card: DisciplineCard, cardIndex: number) => {
    if (state.mana < card.costMana || !state.currentEnemy) return;

    gameAudio.playCoin();
    let currentEnemy = { ...state.currentEnemy };
    let activeShield = state.activeShield;
    let sanity = state.sanity;
    let capitalAurei = state.capitalAurei;
    let hand = state.hand.filter((_, idx) => idx !== cardIndex);
    let discardPile = [...state.discardPile, card];
    let mana = state.mana - card.costMana;
    let logMsg = `Hai giocato ${card.name}. `;

    // Apply Card Effects
    if (card.shieldGain) {
      activeShield += card.shieldGain;
      logMsg += `+${card.shieldGain} Barriera. `;
    }

    if (card.damageValue) {
      let dmg = card.damageValue;
      if (state.relics.some((r) => r.id === "relic_gann_sextant")) dmg += 4;
      currentEnemy.currentHp = Math.max(0, currentEnemy.currentHp - dmg);
      logMsg += `-${dmg} HP al nemico. `;
    }

    if (card.sanityHeal) {
      let heal = card.sanityHeal;
      if (state.relics.some((r) => r.id === "relic_discipline_stone")) heal += 5;
      sanity = Math.min(state.maxSanity, sanity + heal);
      logMsg += `+${heal} Integrità. `;
    }

    if (card.specialEffect === "convert_coins") {
      capitalAurei += card.effectValue || 10;
      logMsg += `+${card.effectValue} Aurei acquisiti. `;
    }

    setCombatLog((prev) => [logMsg, ...prev.slice(0, 4)]);

    // Check Enemy Defeated
    if (currentEnemy.currentHp <= 0) {
      gameAudio.playVictory();
      setCombatLog((prev) => [`Vittoria! ${currentEnemy.name} è stato dissolto dall'Ordine.`, ...prev]);

      // Complete step
      completeStep({
        ...state,
        currentEnemy: null,
        activeShield: 0,
        sanity,
        capitalAurei: capitalAurei + 30,
        hand: [],
        discardPile,
      });
      return;
    }

    setState((prev) => ({
      ...prev,
      currentEnemy,
      activeShield,
      sanity,
      capitalAurei,
      hand,
      discardPile,
      mana,
    }));
  };

  // End Player Turn -> Enemy Attacks
  const endTurn = () => {
    if (!state.currentEnemy) return;

    const enemy = state.currentEnemy;
    let activeShield = state.activeShield;
    let sanity = state.sanity;
    let logMsg = `${enemy.name} agisce: ${enemy.nextIntent.description}. `;

    if (enemy.nextIntent.type === "attack" || enemy.nextIntent.type === "squeeze") {
      const incoming = enemy.nextIntent.value;
      if (activeShield >= incoming) {
        activeShield -= incoming;
        gameAudio.playShieldAbsorb();
        logMsg += `L'attacco è stato completamente assorbito dallo scudo!`;
      } else {
        const damageToSanity = incoming - activeShield;
        activeShield = 0;
        sanity = Math.max(0, sanity - damageToSanity);
        gameAudio.playCrash();
        logMsg += `Scudo infranto! Subisci -${damageToSanity} Integrità Mentale.`;
      }
    } else if (enemy.nextIntent.type === "debuff") {
      sanity = Math.max(0, sanity - enemy.nextIntent.value);
      logMsg += `L'ansia penetra nella mente: -${enemy.nextIntent.value} Integrità.`;
    }

    setCombatLog((prev) => [logMsg, ...prev.slice(0, 4)]);

    // Check Player Defeat
    if (sanity <= 0) {
      setViewMode("gameover");
      return;
    }

    // Prepare Next Turn
    let nextState: ExpeditionRunState = {
      ...state,
      sanity,
      activeShield: state.relics.some((r) => r.id === "relic_steady_hand") ? 3 : 0,
      mana: state.maxMana,
      discardPile: [...state.discardPile, ...state.hand],
      hand: [],
    };
    nextState = drawCards(4, nextState);
    setState(nextState);
  };

  // Complete Step and advance on Map
  const completeStep = (nextState: ExpeditionRunState) => {
    const nextStepIndex = nextState.currentStep + 1;

    // Check Sector Clear
    if (nextStepIndex >= 5) {
      if (nextState.sector >= 4) {
        // Complete Grand Expedition!
        const p = loadChroniclesPersistence();
        saveChroniclesPersistence({
          totalExpeditionsWon: p.totalExpeditionsWon + 1,
          totalAureiWallet: p.totalAureiWallet + nextState.capitalAurei + 150,
        });
        setViewMode("victory");
        return;
      } else {
        // Advance to next sector
        const nextSector = nextState.sector + 1;
        setNodes(generateExpeditionSectorNodes(nextSector));
        setState({
          ...nextState,
          sector: nextSector,
          currentStep: 0,
        });
        setViewMode("map");
        return;
      }
    }

    // Advance to next step within sector
    const updatedNodes = nodes.map((n) =>
      n.stepIndex === nextStepIndex ? { ...n, available: true } : n,
    );
    setNodes(updatedNodes);
    setState({
      ...nextState,
      currentStep: nextStepIndex,
    });
    setViewMode("map");
  };

  // Restart Expedition
  const handleRestart = () => {
    setState(createInitialState());
    setNodes(generateExpeditionSectorNodes(1));
    setViewMode("map");
  };

  return (
    <div className="relative w-full h-full min-h-[500px] select-none overflow-hidden bg-[#07080b] rounded-xl border border-[#C5A059]/25 flex flex-col justify-between font-mono text-xs text-foreground">
      {/* Top Telemetry Header */}
      <div className="p-3 sm:p-4 bg-[#0d0f14] border-b border-[#C5A059]/20 flex items-center justify-between gap-3">
        {/* Left: Sector & Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold text-foreground tracking-tight uppercase">
              Settore {state.sector}/4
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-muted-foreground text-[11px]">
            <Compass size={13} className="text-[#E8C56A]" />
            <span>Tappa {state.currentStep + 1}/5</span>
          </div>
        </div>

        {/* Center: Live Trade Tracking Pill */}
        {activeTradeContext?.symbol && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C5A059]/15 border border-[#C5A059]/35 text-[11px] text-[#E8C56A]">
            <span>Trade in Corso:</span>
            <strong>{activeTradeContext.symbol} {activeTradeContext.direction?.toUpperCase()}</strong>
            <span className="text-emerald-400 pl-1">· Mani Lontane dal Book</span>
          </div>
        )}

        {/* Right: Sanity & Aurei */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300">
            <Heart size={13} className="fill-red-500 text-red-500" />
            <span className="font-bold tabular-nums whitespace-nowrap">
              {state.sanity}/{state.maxSanity}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-[#C5A059]/40 text-[#E8C56A]">
            <Coins size={13} />
            <span className="font-bold tabular-nums whitespace-nowrap">
              {state.capitalAurei}
            </span>
          </div>
        </div>
      </div>

      {/* VIEW 1: MAP VIEW */}
      {viewMode === "map" && (
        <div className="flex-1 p-4 sm:p-6 flex flex-col justify-center items-center">
          <div className="max-w-xl w-full text-center mb-6">
            <h2 className="text-lg font-bold text-foreground uppercase tracking-wider mb-1">
              Topografia del Mercato · Settore {state.sector}
            </h2>
            <p className="text-xs text-muted-foreground">
              Scegli la tua rotta tattica. Ogni nodo mette alla prova la tua padronanza decisionale.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-2xl py-4 overflow-x-auto">
            {nodes.map((node, idx) => {
              const isPast = node.stepIndex < state.currentStep;
              const isCurrent = node.available;

              return (
                <div key={node.id} className="flex sm:flex-col items-center gap-2">
                  <button
                    type="button"
                    disabled={!isCurrent}
                    onClick={() => enterNode(node)}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all ${
                      isPast
                        ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-400 opacity-60"
                        : isCurrent
                        ? "bg-[#C5A059]/20 border-[#C5A059] text-[#E8C56A] shadow-[0_0_20px_rgba(197,160,89,0.3)] scale-105 cursor-pointer hover:bg-[#C5A059]/30"
                        : "bg-black/30 border-white/5 text-muted-foreground/30 opacity-40 cursor-not-allowed"
                    }`}
                  >
                    {node.type === "battle" && <Sword size={18} />}
                    {node.type === "oracle" && <BookOpen size={18} />}
                    {node.type === "oasis" && <Sparkles size={18} />}
                    {node.type === "bazaar" && <Coins size={18} />}
                    {node.type === "boss" && <Trophy size={18} className="text-red-400" />}

                    <span className="text-[9px] uppercase font-bold tracking-tight">
                      {node.type}
                    </span>
                  </button>

                  <span className="text-[10px] text-muted-foreground hidden sm:block truncate max-w-[80px]">
                    {node.title}
                  </span>

                  {idx < nodes.length - 1 && (
                    <ArrowRight size={14} className="text-muted-foreground/30 sm:hidden" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Relics Row */}
          {state.relics.length > 0 && (
            <div className="mt-8 flex items-center gap-2 p-2.5 rounded-xl bg-black/40 border border-white/10">
              <span className="text-[10px] text-muted-foreground">Reliquie Attive:</span>
              {state.relics.map((relic) => (
                <span
                  key={relic.id}
                  title={`${relic.name}: ${relic.description}`}
                  className="px-2 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E8C56A] text-[10px] font-bold"
                >
                  {relic.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: COMBAT VIEW */}
      {viewMode === "battle" && state.currentEnemy && (
        <div className="flex-1 p-3 sm:p-5 flex flex-col justify-between">
          {/* Enemy Arena */}
          <div className="flex flex-col items-center justify-center p-4 bg-black/40 border border-white/10 rounded-2xl relative">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
              {state.currentEnemy.title}
            </span>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {state.currentEnemy.name}
            </h3>

            {/* Enemy HP Bar */}
            <div className="w-48 sm:w-64 bg-black/60 border border-white/10 rounded-full h-3.5 my-2.5 overflow-hidden">
              <div
                className="bg-red-500 h-full transition-all duration-300"
                style={{
                  width: `${(state.currentEnemy.currentHp / state.currentEnemy.maxHp) * 100}%`,
                }}
              />
            </div>
            <div className="text-[11px] font-bold text-red-400 tabular-nums">
              {state.currentEnemy.currentHp} / {state.currentEnemy.maxHp} HP
            </div>

            {/* Enemy Intent Badge */}
            <div className="mt-2 px-3 py-1 rounded-full bg-red-950/40 border border-red-500/40 text-[10px] text-red-300 flex items-center gap-1.5 animate-pulse">
              <AlertTriangle size={12} />
              <span>Intento Nemico: {state.currentEnemy.nextIntent.description}</span>
            </div>
          </div>

          {/* Combat Log */}
          <div className="my-2 p-2 bg-black/30 rounded-lg border border-white/5 text-[10px] text-muted-foreground space-y-0.5 max-h-16 overflow-y-auto">
            {combatLog.map((log, i) => (
              <p key={i}>{log}</p>
            ))}
          </div>

          {/* Player Defense & Mana Status */}
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-bold">
                <Shield size={14} />
                <span>Barriera: {state.activeShield}</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                <Zap size={14} />
                <span>Punti Mana: {state.mana}/{state.maxMana}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={endTurn}
              className="py-1.5 px-3 rounded-lg bg-[#C5A059] hover:bg-[#d8b167] text-black font-bold text-xs cursor-pointer transition-all"
            >
              Termina Turno
            </button>
          </div>

          {/* Hand of Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {state.hand.map((card, idx) => {
              const canPlay = state.mana >= card.costMana;

              return (
                <button
                  key={`${card.id}_${idx}`}
                  type="button"
                  disabled={!canPlay}
                  onClick={() => playCard(card, idx)}
                  className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                    canPlay
                      ? "bg-[#0d0f14] border-[#C5A059]/40 hover:border-[#C5A059] hover:scale-[1.02] cursor-pointer shadow-md"
                      : "bg-black/40 border-white/5 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-foreground">{card.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                      {card.costMana}⚡
                    </span>
                  </div>
                  <p className="text-[9.5px] text-muted-foreground leading-snug">
                    {card.description}
                  </p>
                  <span className="mt-2 text-[8px] uppercase tracking-wider text-muted-foreground/60">
                    {card.type}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: ORACLE DILEMMA */}
      {viewMode === "oracle" && state.currentDilemma && (
        <div className="flex-1 p-6 flex flex-col items-center justify-center max-w-xl mx-auto text-center">
          <div className="w-10 h-10 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/35 flex items-center justify-center text-[#E8C56A] mb-3">
            <BookOpen size={20} />
          </div>

          <h3 className="text-base font-bold text-foreground uppercase tracking-wider mb-2">
            {state.currentDilemma.title}
          </h3>
          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            {state.currentDilemma.scenarioText}
          </p>

          <div className="space-y-3 w-full">
            {state.currentDilemma.choices.map((choice, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  let sanity = state.sanity + (choice.effect.sanityDelta || 0);
                  let capitalAurei = state.capitalAurei + (choice.effect.coinsDelta || 0);
                  let relics = [...state.relics];
                  if (choice.effect.relicReward) relics.push(choice.effect.relicReward);
                  let deck = [...state.deck];
                  if (choice.effect.cardReward) deck.push(choice.effect.cardReward);

                  completeStep({
                    ...state,
                    sanity: Math.max(0, Math.min(state.maxSanity, sanity)),
                    capitalAurei,
                    relics,
                    deck,
                    currentDilemma: null,
                  });
                }}
                className="w-full p-3.5 rounded-xl bg-[#0d0f14] border border-[#C5A059]/30 hover:border-[#C5A059] text-left text-xs text-foreground transition-all cursor-pointer hover:bg-[#C5A059]/10"
              >
                <div className="font-bold text-[#E8C56A] mb-1">Scelta {i + 1}</div>
                <div>{choice.text}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: OASIS */}
      {viewMode === "oasis" && (
        <div className="flex-1 p-6 flex flex-col items-center justify-center max-w-md mx-auto text-center">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 mb-3">
            <Sparkles size={20} />
          </div>

          <h3 className="text-base font-bold text-foreground uppercase tracking-wider mb-2">
            Oasi di Consolidamento
          </h3>
          <p className="text-xs text-muted-foreground mb-6">
            Prenditi un istante di decompressione totale. Scegli come nutrire il tuo equilibrio.
          </p>

          <div className="space-y-3 w-full">
            <button
              type="button"
              onClick={() => {
                completeStep({
                  ...state,
                  sanity: Math.min(state.maxSanity, state.sanity + 25),
                });
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#0d0f14] border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-300 font-bold text-xs transition-all cursor-pointer flex items-center justify-between"
            >
              <span>Meditazione della Presenza</span>
              <span>+25 Integrità Mentale</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const bonusCard = UNLOCKABLE_CARDS[Math.floor(Math.random() * UNLOCKABLE_CARDS.length)];
                completeStep({
                  ...state,
                  deck: [...state.deck, bonusCard],
                });
              }}
              className="w-full py-3 px-4 rounded-xl bg-[#0d0f14] border border-[#C5A059]/40 hover:bg-[#C5A059]/10 text-[#E8C56A] font-bold text-xs transition-all cursor-pointer flex items-center justify-between"
            >
              <span>Studio della Schematica</span>
              <span>+1 Carta Rara al Mazzo</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 5: BAZAAR */}
      {viewMode === "bazaar" && (
        <div className="flex-1 p-6 flex flex-col items-center justify-center max-w-lg mx-auto text-center">
          <div className="w-10 h-10 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/35 flex items-center justify-center text-[#E8C56A] mb-3">
            <Coins size={20} />
          </div>

          <h3 className="text-base font-bold text-foreground uppercase tracking-wider mb-2">
            Bazar delle Reliquie
          </h3>
          <p className="text-xs text-muted-foreground mb-6">
            Spendi il capitale accumulato per acquisire reliquie permanenti per la spedizione.
          </p>

          <div className="space-y-3 w-full">
            {EXPEDITION_RELICS.slice(1, 3).map((relic) => {
              const hasRelic = state.relics.some((r) => r.id === relic.id);
              const canAfford = state.capitalAurei >= 40;

              return (
                <div
                  key={relic.id}
                  className="p-3 rounded-xl bg-[#0d0f14] border border-white/10 flex items-center justify-between text-left"
                >
                  <div>
                    <strong className="text-xs text-foreground block">{relic.name}</strong>
                    <span className="text-[10px] text-muted-foreground">{relic.description}</span>
                  </div>

                  {hasRelic ? (
                    <span className="text-[10px] text-emerald-400 font-bold">Già Posseduta</span>
                  ) : (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => {
                        completeStep({
                          ...state,
                          capitalAurei: state.capitalAurei - 40,
                          relics: [...state.relics, relic],
                        });
                      }}
                      className="py-1.5 px-3 rounded-lg bg-[#C5A059] text-black font-bold text-xs hover:bg-[#d8b167] disabled:opacity-40 cursor-pointer"
                    >
                      40 Aurei
                    </button>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => completeStep(state)}
              className="w-full py-2 text-muted-foreground hover:text-foreground text-xs mt-3 cursor-pointer"
            >
              Prosegui senza acquistare
            </button>
          </div>
        </div>
      )}

      {/* VIEW 6: GRAND VICTORY */}
      {viewMode === "victory" && (
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-[#C5A059]/20 border border-[#C5A059] flex items-center justify-center text-[#E8C56A] mb-4 shadow-[0_0_30px_rgba(197,160,89,0.3)]">
            <Trophy size={28} />
          </div>

          <h2 className="text-xl font-bold text-foreground uppercase tracking-tight mb-2">
            SPEDIZIONE TRIONFALE
          </h2>
          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            Hai attraversato tutti i 4 Settori del Mercato e sconfitto L'Ombra della Deriva. La tua mente ha trionfato sull'illusione.
          </p>

          <button
            type="button"
            onClick={handleRestart}
            className="w-full py-3 px-4 rounded-xl bg-[#C5A059] hover:bg-[#d8b167] text-black font-bold text-xs cursor-pointer shadow-lg transition-all"
          >
            Nuova Spedizione
          </button>
        </div>
      )}

      {/* VIEW 7: GAME OVER */}
      {viewMode === "gameover" && (
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-center max-w-md mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-red-950/40 border border-red-500/50 flex items-center justify-center text-red-400 mb-4">
            <AlertTriangle size={28} />
          </div>

          <h2 className="text-xl font-bold text-foreground uppercase tracking-tight mb-2">
            INTEGRITÀ ESAURITA
          </h2>
          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            La pressione del mercato ha consumato la tua riserva di calma. Respira, ristabilisci il rigore interiore e ricomincia.
          </p>

          <button
            type="button"
            onClick={handleRestart}
            className="w-full py-3 px-4 rounded-xl bg-[#C5A059] hover:bg-[#d8b167] text-black font-bold text-xs cursor-pointer shadow-lg transition-all"
          >
            Ricomincia Spedizione
          </button>
        </div>
      )}
    </div>
  );
}
