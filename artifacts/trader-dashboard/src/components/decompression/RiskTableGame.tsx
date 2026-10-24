import { useEffect, useRef, useState, useMemo } from "react";
import {
  initRiskTableEngine,
  RiskTableController,
} from "./riskTableEngine";
import {
  MarketCard,
  SigilCard,
  MarketVoucher,
  StartingDeck,
  RoundRequirement,
  RiskTablePersistence,
} from "./riskTableTypes";
import {
  generateStandardDeck,
  evaluateMarketHand,
  SUIT_INFO,
  getRankLabel,
  SIGIL_CATALOG,
  STARTING_DECKS,
  ROUND_PROGRESSION,
  SHOP_VOUCHERS,
  HAND_BASE_SCORES,
  loadRiskTablePersistence,
  saveRiskTablePersistence,
} from "./riskTableData";
import { gameAudio } from "./gameAudioSynthesizer";
import {
  addMasterAurei,
  spendMasterAurei,
  loadMasterVault,
} from "./unifiedArcadeStore";
import {
  Coins,
  Shield,
  ShieldCheck,
  Zap,
  Flame,
  RotateCcw,
  Trophy,
  Play,
  Trash2,
  HelpCircle,
  Sparkles,
  TrendingUp,
  ShoppingBag,
  ArrowRight,
  Info,
  Clock,
  Compass,
  Layers,
  X,
} from "lucide-react";

interface RiskTableGameProps {
  onClose?: () => void;
  activeTradeContext?: {
    symbol?: string;
    direction?: string;
    durationMinutes?: number;
  };
}

export function RiskTableGame({ onClose, activeTradeContext }: RiskTableGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<RiskTableController | null>(null);

  // Persistence State
  const [persistence, setPersistence] = useState<RiskTablePersistence>(() => loadRiskTablePersistence());

  // Game Loop State
  const [currentAnteIndex, setCurrentAnteIndex] = useState(0);
  const [drawPile, setDrawPile] = useState<MarketCard[]>([]);
  const [hand, setHand] = useState<MarketCard[]>([]);
  const [discardPile, setDiscardPile] = useState<MarketCard[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [activeSigils, setActiveSigils] = useState<SigilCard[]>([]);

  // Round Counters
  const [roundScore, setRoundScore] = useState(0);
  const [handsRemaining, setHandsRemaining] = useState(4);
  const [discardsRemaining, setDiscardsRemaining] = useState(3);
  const [integrityPct, setIntegrityPct] = useState(100);
  const [walletAurei, setWalletAurei] = useState(() => Math.max(persistence.totalAurei, loadMasterVault().masterAurei));
  const [isSqueeze, setIsSqueeze] = useState(false);

  // Phase & Modals
  const [gamePhase, setGamePhase] = useState<"playing" | "animating" | "bazaar" | "round_won" | "game_over">("playing");
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showDeckModal, setShowDeckModal] = useState(false);
  const [selectedSigilDetail, setSelectedSigilDetail] = useState<SigilCard | null>(null);

  // Bazaar Items
  const [bazaarSigils, setBazaarSigils] = useState<SigilCard[]>([]);
  const [bazaarVouchers, setBazaarVouchers] = useState<MarketVoucher[]>([]);

  // Current Round Definition
  const currentRound = useMemo<RoundRequirement>(() => {
    return ROUND_PROGRESSION[currentAnteIndex] || {
      ante: currentAnteIndex + 1,
      name: `Ciclo ${currentAnteIndex + 1}: Profondità Sovrana`,
      subtitle: "Navigazione oltre la soglia istituzionale",
      targetScore: 25000 + (currentAnteIndex - 7) * 12000,
      rewardAurei: 15,
    };
  }, [currentAnteIndex]);

  // Selected Cards Evaluation
  const selectedCards = useMemo(() => {
    return hand.filter((c) => selectedCardIds.includes(c.id));
  }, [hand, selectedCardIds]);

  const handEvaluation = useMemo(() => {
    return evaluateMarketHand(selectedCards, activeSigils, isSqueeze);
  }, [selectedCards, activeSigils, isSqueeze]);

  // -------------------------------------------------------------
  // INITIALIZE THREE.JS 3D ENGINE
  // -------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const controller = initRiskTableEngine(containerRef.current, {
      onCardToggleSelect: (cardId) => {
        setSelectedCardIds((prev) => {
          if (prev.includes(cardId)) {
            return prev.filter((id) => id !== cardId);
          }
          if (prev.length >= 5) {
            // Massimo 5 carte selezionabili contemporaneamente
            return prev;
          }
          return [...prev, cardId];
        });
      },
    });

    engineRef.current = controller;

    // Start First Game
    startNewRun();

    return () => {
      controller.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync selected cards with 3D engine meshes
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSelectedCards(selectedCardIds);
    }
  }, [selectedCardIds]);

  // -------------------------------------------------------------
  // GAME FLOW LOGIC
  // -------------------------------------------------------------

  function startNewRun() {
    const fullDeck = generateStandardDeck();
    const activeDeckConfig = STARTING_DECKS.find((d) => d.id === persistence.selectedDeckId) || STARTING_DECKS[0];

    // Initial Sigil from deck if present
    const initialSigils: SigilCard[] = [];
    if (activeDeckConfig.innateSigilId) {
      const innate = SIGIL_CATALOG.find((s) => s.id === activeDeckConfig.innateSigilId);
      if (innate) initialSigils.push(innate);
    }

    const initialHand = fullDeck.slice(0, 8);
    const initialDraw = fullDeck.slice(8);

    setCurrentAnteIndex(0);
    setDrawPile(initialDraw);
    setHand(initialHand);
    setDiscardPile([]);
    setSelectedCardIds([]);
    setActiveSigils(initialSigils);

    setRoundScore(0);
    setHandsRemaining(4 + activeDeckConfig.bonusHands);
    setDiscardsRemaining(3 + activeDeckConfig.bonusDiscards);
    setIntegrityPct(100 + activeDeckConfig.bonusMaxIntegrity);
    const masterBalance = loadMasterVault().masterAurei;
    setWalletAurei(Math.max(masterBalance, activeDeckConfig.startingAurei));
    setIsSqueeze(false);
    setGamePhase("playing");

    if (engineRef.current) {
      engineRef.current.setHand(initialHand, []);
    }
  }

  function startNextRound() {
    const fullDeck = generateStandardDeck();
    const nextHand = fullDeck.slice(0, 8);
    const nextDraw = fullDeck.slice(8);

    setDrawPile(nextDraw);
    setHand(nextHand);
    setDiscardPile([]);
    setSelectedCardIds([]);

    setRoundScore(0);
    setHandsRemaining(4);
    setDiscardsRemaining(3);
    setIsSqueeze(false);
    setGamePhase("playing");

    if (engineRef.current) {
      engineRef.current.setHand(nextHand, []);
    }
  }

  // 1. PLAY HAND
  function handlePlayHand() {
    if (selectedCards.length === 0 || gamePhase !== "playing" || handsRemaining <= 0) return;

    setGamePhase("animating");

    if (engineRef.current) {
      engineRef.current.playHandAnimation(selectedCards, () => {
        const addedScore = handEvaluation.totalScore;
        const newScore = roundScore + addedScore;
        const newHands = handsRemaining - 1;

        setRoundScore(newScore);
        setHandsRemaining(newHands);

        // Update persistent stats
        const updatedPersistence: RiskTablePersistence = {
          ...persistence,
          totalHandsPlayed: persistence.totalHandsPlayed + 1,
        };
        saveRiskTablePersistence(updatedPersistence);
        setPersistence(updatedPersistence);

        // Discard played cards and draw new ones
        const playedIds = selectedCards.map((c) => c.id);
        const remainingHand = hand.filter((c) => !playedIds.includes(c.id));
        const needed = 8 - remainingHand.length;
        const drawn = drawPile.slice(0, needed);
        const newDrawPile = drawPile.slice(needed);
        const newHand = [...remainingHand, ...drawn];

        setDiscardPile((prev) => [...prev, ...selectedCards]);
        setHand(newHand);
        setDrawPile(newDrawPile);
        setSelectedCardIds([]);
        setIsSqueeze(false);

        if (engineRef.current) {
          engineRef.current.setHand(newHand, []);
        }

        // Check Round Victory
        if (newScore >= currentRound.targetScore) {
          handleRoundWon();
        } else if (newHands <= 0) {
          // Check Stop Loss Cushion Sigil
          const hasStopLossSigil = activeSigils.some((s) => s.effectType === "stop_loss_cushion");
          const pctAchieved = newScore / currentRound.targetScore;

          if (hasStopLossSigil && pctAchieved >= 0.85) {
            handleRoundWon(true);
          } else {
            handleRoundLoss();
          }
        } else {
          setGamePhase("playing");
        }
      });
    }
  }

  // 2. DISCARD CARDS
  function handleDiscard() {
    if (selectedCards.length === 0 || discardsRemaining <= 0 || gamePhase !== "playing") return;

    gameAudio.playCardSlide();

    const discardIds = selectedCards.map((c) => c.id);
    const remainingHand = hand.filter((c) => !discardIds.includes(c.id));
    const needed = selectedCards.length;
    const drawn = drawPile.slice(0, needed);
    const newDrawPile = drawPile.slice(needed);
    const newHand = [...remainingHand, ...drawn];

    setDiscardPile((prev) => [...prev, ...selectedCards]);
    setHand(newHand);
    setDrawPile(newDrawPile);
    setSelectedCardIds([]);
    setDiscardsRemaining((prev) => prev - 1);

    if (engineRef.current) {
      engineRef.current.setHand(newHand, []);
    }
  }

  // 3. FOLD CONSCIO (DISCIPLINE MECHANIC)
  function handleFoldConscio() {
    if (gamePhase !== "playing") return;

    setGamePhase("animating");

    if (engineRef.current) {
      engineRef.current.playFoldAnimation(() => {
        // Calculate Fold rewards & sanity
        const hasRefundSigil = activeSigils.some((s) => s.effectType === "fold_capital_refund");
        const aureiBonus = hasRefundSigil ? 5 : 2;
        const integrityBonus = 15;

        const newWallet = addMasterAurei(aureiBonus);
        const newIntegrity = Math.min(100, integrityPct + integrityBonus);

        setWalletAurei(newWallet);
        setIntegrityPct(newIntegrity);

        // Update persistence
        const updated: RiskTablePersistence = {
          ...persistence,
          totalAurei: newWallet,
          totalDisciplinedFolds: persistence.totalDisciplinedFolds + 1,
        };
        saveRiskTablePersistence(updated);
        setPersistence(updated);

        // Advance to Bazaar with preserved capital
        openBazaar();
      });
    }
  }

  // 4. SQUEEZE TOGGLE
  function handleToggleSqueeze() {
    if (gamePhase !== "playing") return;
    const nextState = !isSqueeze;
    setIsSqueeze(nextState);

    if (nextState && engineRef.current) {
      engineRef.current.triggerSqueezeBurst();
    }
  }

  // 5. ROUND WON
  function handleRoundWon(wasCushioned: boolean = false) {
    if (engineRef.current) {
      engineRef.current.triggerVictoryFanfare();
    }

    // Calculate Aurei Payout
    let earnedAurei = currentRound.rewardAurei;

    // Check Scalper Freddo Sigil (Bonus per scarti residui)
    const hasScalper = activeSigils.some((s) => s.effectType === "unused_discard_aurei");
    if (hasScalper && discardsRemaining > 0) {
      earnedAurei += discardsRemaining * 2;
    }

    // Check Sovereign Reserve Interest
    const hasReserve = activeSigils.some((s) => s.effectType === "wealth_interest");
    if (hasReserve) {
      earnedAurei += Math.floor(walletAurei / 10);
    }

    const newWallet = addMasterAurei(earnedAurei);
    setWalletAurei(newWallet);

    const highest = Math.max(persistence.highestAnteWon, currentAnteIndex + 1);
    const updated: RiskTablePersistence = {
      ...persistence,
      totalAurei: newWallet,
      highestAnteWon: highest,
    };
    saveRiskTablePersistence(updated);
    setPersistence(updated);

    setTimeout(() => {
      openBazaar();
    }, 900);
  }

  // 6. ROUND LOSS
  function handleRoundLoss() {
    gameAudio.playExplosion();
    const damage = 35;
    const newIntegrity = integrityPct - damage;
    setIntegrityPct(newIntegrity);

    if (newIntegrity <= 0) {
      setGamePhase("game_over");
    } else {
      // Retry round
      startNextRound();
    }
  }

  // 7. BAZAAR DELL'ORDINE (SHOP)
  function openBazaar() {
    // Generate 3 random Sigils not yet equipped
    const equippedIds = activeSigils.map((s) => s.id);
    const availableSigils = SIGIL_CATALOG.filter((s) => !equippedIds.includes(s.id));
    const shuffledSigils = [...availableSigils].sort(() => Math.random() - 0.5).slice(0, 3);

    // Pick 2 vouchers
    const shuffledVouchers = [...SHOP_VOUCHERS].sort(() => Math.random() - 0.5).slice(0, 2);

    setBazaarSigils(shuffledSigils);
    setBazaarVouchers(shuffledVouchers);
    setGamePhase("bazaar");
  }

  function buySigil(sigil: SigilCard) {
    if (walletAurei < sigil.costAurei || activeSigils.length >= 5) return;

    const spendRes = spendMasterAurei(sigil.costAurei);
    if (!spendRes.success) return;

    gameAudio.playShopBuy();
    const newWallet = spendRes.newBalance;
    setWalletAurei(newWallet);
    setActiveSigils((prev) => [...prev, sigil]);
    setBazaarSigils((prev) => prev.filter((s) => s.id !== sigil.id));

    const updated: RiskTablePersistence = {
      ...persistence,
      totalAurei: newWallet,
      unlockedSigilIds: Array.from(new Set([...persistence.unlockedSigilIds, sigil.id])),
    };
    saveRiskTablePersistence(updated);
    setPersistence(updated);
  }

  function sellSigil(sigil: SigilCard) {
    const refund = Math.floor(sigil.costAurei * 0.5);
    gameAudio.playCoin();
    const newWallet = addMasterAurei(refund);
    setWalletAurei(newWallet);
    setActiveSigils((prev) => prev.filter((s) => s.id !== sigil.id));

    const updated: RiskTablePersistence = {
      ...persistence,
      totalAurei: newWallet,
    };
    saveRiskTablePersistence(updated);
    setPersistence(updated);
  }

  function buyVoucher(voucher: MarketVoucher) {
    if (walletAurei < voucher.costAurei) return;

    const spendRes = spendMasterAurei(voucher.costAurei);
    if (!spendRes.success) return;

    gameAudio.playShopBuy();
    let newWallet = spendRes.newBalance;
    setBazaarVouchers((prev) => prev.filter((v) => v.id !== voucher.id));

    if (voucher.type === "extra_hand") {
      setHandsRemaining((prev) => prev + 1);
    } else if (voucher.type === "extra_discard") {
      setDiscardsRemaining((prev) => prev + 1);
    } else if (voucher.type === "integrity_restore") {
      setIntegrityPct((prev) => Math.min(100, prev + 40));
    } else if (voucher.type === "aurei_grant") {
      newWallet = addMasterAurei(10);
    }

    setWalletAurei(newWallet);
    const updated: RiskTablePersistence = {
      ...persistence,
      totalAurei: newWallet,
    };
    saveRiskTablePersistence(updated);
    setPersistence(updated);
  }

  function leaveBazaarAndAdvance() {
    setCurrentAnteIndex((prev) => prev + 1);
    startNextRound();
  }

  return (
    <div className="w-full h-full relative flex flex-col font-mono select-none overflow-hidden text-foreground bg-[#07080b]">
      {/* ========================================================= */}
      {/* HEADER: TELEMETRY & STATUS BAR                            */}
      {/* ========================================================= */}
      <div className="p-2 sm:p-2.5 bg-[#0d0f14]/95 border-b border-[#C5A059]/20 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] text-xs font-bold uppercase tracking-wider">
            <Trophy size={14} className="text-[#C5A059]" />
            <span className="whitespace-nowrap">{currentRound.name}</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <span>Obiettivo:</span>
            <span className="text-white font-bold tracking-tight whitespace-nowrap">
              {currentRound.targetScore.toLocaleString()} Punti
            </span>
          </div>
        </div>

        {/* Center: Live Trade Telemetry (Active Trade Detachment Context) */}
        {activeTradeContext?.symbol && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px]">
            <Clock size={12} className="animate-spin text-emerald-400" />
            <span className="font-bold">{activeTradeContext.symbol}</span>
            <span className="uppercase text-[10px]">({activeTradeContext.direction || "IN CORSO"})</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-white font-medium whitespace-nowrap">
              {activeTradeContext.durationMinutes || 12} min a mani ferme
            </span>
          </div>
        )}

        {/* Right Counters: Integrity, Hands, Discards, Aurei */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs">
          {/* Integrity Meter */}
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/50 border border-white/10"
            title="Indice d'Integrità Mentale: non azzerarlo per non subire tilt."
          >
            <Shield size={13} className={integrityPct < 40 ? "text-rose-400" : "text-emerald-400"} />
            <span className="text-[10px] text-muted-foreground hidden sm:inline">Integrità:</span>
            <span
              className={`font-bold tabular-nums whitespace-nowrap ${
                integrityPct < 40 ? "text-rose-400" : "text-emerald-400"
              }`}
            >
              {integrityPct}%
            </span>
          </div>

          {/* Aurei Wallet */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] font-bold tabular-nums whitespace-nowrap">
            <Coins size={13} />
            <span>{walletAurei} Aurei</span>
          </div>

          {/* Mazzo Rimanente & Compendio Deck Viewer Button */}
          <button
            type="button"
            onClick={() => setShowDeckModal(true)}
            className="p-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-[#C5A059]/50 text-muted-foreground hover:text-[#E8C56A] transition-all cursor-pointer flex items-center gap-1"
            title="Ispezione Mazzo Rimanente & Probabilità Matematiche (EV)"
          >
            <Layers size={14} />
            <span className="text-[10px] hidden sm:inline">Mazzo ({drawPile.length})</span>
          </button>

          {/* Rules / Compendium Button */}
          <button
            type="button"
            onClick={() => setShowRulesModal(true)}
            className="p-1.5 rounded-lg bg-black/40 border border-white/10 hover:border-[#C5A059]/50 text-muted-foreground hover:text-foreground transition-all cursor-pointer"
            title="Combinazioni di Mercato e Regole d'Onore"
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* ACTIVE SIGILS TRAY (TOP BAR OF 5 JOKER SLOTS)              */}
      {/* ========================================================= */}
      <div className="px-3 py-1.5 bg-[#090b10] border-b border-[#C5A059]/15 flex items-center justify-between gap-2 overflow-x-auto z-10 scrollbar-thin">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest whitespace-nowrap">
            Sigilli Attivi ({activeSigils.length}/5):
          </span>

          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3, 4].map((slotIndex) => {
              const sigil = activeSigils[slotIndex];
              if (!sigil) {
                return (
                  <div
                    key={slotIndex}
                    className="w-24 h-8 rounded border border-dashed border-white/10 flex items-center justify-center text-[10px] text-white/20 select-none"
                  >
                    Vuoto
                  </div>
                );
              }
              return (
                <button
                  key={sigil.id}
                  type="button"
                  onClick={() => setSelectedSigilDetail(sigil)}
                  className="px-2 py-1 rounded bg-[#C5A059]/10 border border-[#C5A059]/35 hover:bg-[#C5A059]/20 transition-all flex items-center gap-1.5 cursor-pointer max-w-[140px]"
                >
                  <Sparkles size={11} className="text-[#E8C56A] shrink-0" />
                  <span className="text-[10px] font-bold text-[#E8C56A] truncate">{sigil.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Current Round Score vs Target Progress */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground text-[10px]">Punteggio Ciclo:</span>
          <span className="font-bold text-white tabular-nums tracking-tight whitespace-nowrap">
            {roundScore.toLocaleString()} / {currentRound.targetScore.toLocaleString()}
          </span>
          <div className="w-20 sm:w-28 h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
            <div
              className="h-full bg-linear-to-r from-[#C5A059] to-emerald-400 transition-all duration-300"
              style={{ width: `${Math.min(100, (roundScore / currentRound.targetScore) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3D VIEWPORT CANVAS (NATIVE THREE.JS)                      */}
      {/* ========================================================= */}
      <div className="flex-1 relative w-full h-full overflow-hidden">
        <div ref={containerRef} className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing" />

        {/* Floating 3D HUD: Predicted Hand Scoring Badge */}
        {selectedCards.length > 0 && gamePhase === "playing" && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none z-20">
            <div className="px-4 py-2 rounded-xl bg-black/85 border border-[#C5A059]/50 shadow-2xl backdrop-blur-md flex flex-col items-center gap-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#E8C56A] tracking-wider uppercase">
                <Sparkles size={13} className="text-[#E8C56A]" />
                <span>{handEvaluation.handName}</span>
                {isSqueeze && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 border border-rose-500/40 text-rose-400 font-bold">
                    SQUEEZE 2X
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm font-mono">
                <span className="text-sky-400 font-bold whitespace-nowrap">
                  {handEvaluation.baseChips + handEvaluation.bonusChips} Chips
                </span>
                <span className="text-muted-foreground">×</span>
                <span className="text-rose-400 font-bold whitespace-nowrap">
                  {handEvaluation.baseMult + handEvaluation.bonusMult} Mult
                </span>
                <span className="text-muted-foreground">=</span>
                <span className="text-emerald-400 font-bold text-base whitespace-nowrap">
                  +{handEvaluation.totalScore.toLocaleString()} Punti
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* BOTTOM ACTION BAR (PLAY, DISCARD, FOLD, SQUEEZE)           */}
      {/* ========================================================= */}
      <div className="p-2 sm:p-3 bg-[#0d0f14]/95 border-t border-[#C5A059]/20 flex flex-wrap items-center justify-between gap-2.5 z-10">
        {/* Left: Resource Badges (Mani & Scarti) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs">
            <span className="text-[10px] text-muted-foreground uppercase">Mani Rimaste:</span>
            <strong className="text-base font-bold text-white tabular-nums whitespace-nowrap">
              {handsRemaining}
            </strong>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs">
            <span className="text-[10px] text-muted-foreground uppercase">Scarti:</span>
            <strong className="text-base font-bold text-sky-400 tabular-nums whitespace-nowrap">
              {discardsRemaining}
            </strong>
          </div>
        </div>

        {/* Center: Selected Cards Summary Info & Dismiss Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {selectedCards.length === 0 ? (
            <span className="text-xs text-muted-foreground hidden md:inline">
              Seleziona fino a 5 carte per comporre la tua Mano di Mercato.
            </span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-[#E8C56A] font-bold uppercase tracking-wider hidden sm:inline mr-1">
                Pronte ({selectedCards.length}/5):
              </span>
              {selectedCards.map((card) => {
                const sInfo = SUIT_INFO[card.suit];
                const rankLabel = getRankLabel(card.rank);
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setSelectedCardIds((prev) => prev.filter((id) => id !== card.id));
                      gameAudio.playCardSlide();
                    }}
                    className={`px-2 py-0.5 rounded bg-black/70 border border-[#C5A059]/40 hover:border-rose-500/50 hover:bg-rose-500/10 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      sInfo.color
                    }`}
                    title="Clicca per rimuovere la carta dal setup"
                  >
                    <span>{rankLabel}{sInfo.symbol}</span>
                    <X size={11} className="text-muted-foreground hover:text-white" />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setSelectedCardIds([]);
                  gameAudio.playCardSlide();
                }}
                className="text-[10px] text-muted-foreground hover:text-rose-400 underline ml-1 cursor-pointer"
              >
                Azzera
              </button>
            </div>
          )}
        </div>

        {/* Right: Master Operational Buttons */}
        <div className="flex items-center gap-2">
          {/* FOLD CONSCIO (Discipline Button) */}
          <button
            type="button"
            onClick={handleFoldConscio}
            disabled={gamePhase !== "playing"}
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-xs"
            title="Virtù Suprema del Trader: taglia la mano sfavorevole, preserva il capitale e guadagna disciplina!"
          >
            <ShieldCheck size={14} className="text-emerald-400" />
            <span className="whitespace-nowrap">FOLD CONSCIO</span>
          </button>

          {/* SQUEEZE TOGGLE */}
          <button
            type="button"
            onClick={handleToggleSqueeze}
            disabled={gamePhase !== "playing"}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shadow-xs ${
              isSqueeze
                ? "bg-rose-500 text-white border border-rose-400 animate-pulse"
                : "bg-black/50 border border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
            }`}
            title="Piramidazione ad alto rischio: raddoppia la posta e il moltiplicatore sul setup A+!"
          >
            <Flame size={14} />
            <span className="whitespace-nowrap">SQUEEZE</span>
          </button>

          {/* SCARTA */}
          <button
            type="button"
            onClick={handleDiscard}
            disabled={selectedCards.length === 0 || discardsRemaining <= 0 || gamePhase !== "playing"}
            className="px-3 py-2 rounded-lg bg-black/50 border border-white/15 hover:border-sky-400 hover:bg-sky-500/10 text-sky-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-xs"
          >
            <Trash2 size={14} />
            <span className="whitespace-nowrap">SCARTA</span>
          </button>

          {/* GIOCA MANO */}
          <button
            type="button"
            onClick={handlePlayHand}
            disabled={selectedCards.length === 0 || gamePhase !== "playing" || handsRemaining <= 0}
            className="px-5 py-2 rounded-lg bg-[#C5A059] hover:bg-[#E8C56A] text-black font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-lg hover:shadow-[#C5A059]/20"
          >
            <Play size={14} />
            <span className="whitespace-nowrap">GIOCA MANO</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BAZAAR DELL'ORDINE (SHOP MODAL BETWEEN ROUNDS)             */}
      {/* ========================================================= */}
      {gamePhase === "bazaar" && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-30 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0d0f14] border border-[#C5A059]/30 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={18} className="text-[#C5A059]" />
                  <h3 className="text-base font-bold text-foreground uppercase tracking-wide">
                    Il Bazaar dell'Ordine (Mercato Inter-Ciclo)
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Equipaggia Sigilli, acquista contratti istituzionali e prepara il prossimo Ciclo di Mercato.
                </p>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] font-bold text-sm">
                <Coins size={15} />
                <span className="tabular-nums whitespace-nowrap">{walletAurei} Aurei</span>
              </div>
            </div>

            {/* Sigils Section */}
            <div className="space-y-2">
              <span className="text-[11px] text-[#C5A059] uppercase font-bold tracking-wider block">
                Nuovi Sigilli Disponibili ({activeSigils.length}/5 Slot Occupati):
              </span>

              {bazaarSigils.length === 0 ? (
                <div className="p-3 text-center text-xs text-muted-foreground bg-black/30 rounded-lg">
                  Tutti i Sigilli di questo stock sono stati acquisiti.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {bazaarSigils.map((sigil) => {
                    const canAfford = walletAurei >= sigil.costAurei && activeSigils.length < 5;
                    return (
                      <div
                        key={sigil.id}
                        className="p-3 rounded-xl bg-black/40 border border-white/10 hover:border-[#C5A059]/40 flex flex-col justify-between gap-3 transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-[#E8C56A] truncate">{sigil.name}</span>
                            <span className="text-[9px] uppercase font-mono px-1 py-0.5 rounded bg-white/5 text-muted-foreground">
                              {sigil.rarity}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {sigil.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => buySigil(sigil)}
                          disabled={!canAfford}
                          className="w-full py-1.5 rounded-lg bg-[#C5A059]/15 border border-[#C5A059]/35 hover:bg-[#C5A059]/25 text-[#E8C56A] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Coins size={12} />
                          <span className="whitespace-nowrap">{sigil.costAurei} Aurei</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Vouchers Section */}
            <div className="space-y-2">
              <span className="text-[11px] text-sky-400 uppercase font-bold tracking-wider block">
                Iniezioni & Contratti Operativi:
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bazaarVouchers.map((voucher) => {
                  const canAfford = walletAurei >= voucher.costAurei;
                  return (
                    <div
                      key={voucher.id}
                      className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-white block">{voucher.name}</span>
                        <span className="text-[11px] text-muted-foreground block">{voucher.description}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => buyVoucher(voucher)}
                        disabled={!canAfford}
                        className="px-3 py-1.5 rounded-lg bg-sky-500/15 border border-sky-500/35 hover:bg-sky-500/25 text-sky-400 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                      >
                        <Coins size={12} />
                        <span className="whitespace-nowrap">{voucher.costAurei}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Equipped Sigils Selling Option */}
            {activeSigils.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                  Vendi Sigilli Equipaggiati (Recupera 50% Aurei):
                </span>
                <div className="flex flex-wrap gap-2">
                  {activeSigils.map((sigil) => (
                    <button
                      key={sigil.id}
                      type="button"
                      onClick={() => sellSigil(sigil)}
                      className="px-2.5 py-1 rounded bg-black/60 border border-rose-500/30 hover:border-rose-500 hover:bg-rose-500/10 text-rose-300 text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Vendi {sigil.name}</span>
                      <span className="text-[#E8C56A] font-mono whitespace-nowrap">
                        (+{Math.floor(sigil.costAurei * 0.5)} A)
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Advance Button */}
            <div className="pt-2 border-t border-[#C5A059]/20 flex justify-end">
              <button
                type="button"
                onClick={leaveBazaarAndAdvance}
                className="px-6 py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#E8C56A] text-black font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg hover:shadow-[#C5A059]/25"
              >
                <span>Avanza al Prossimo Ciclo di Mercato</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* GAME OVER MODAL                                           */}
      {/* ========================================================= */}
      {gamePhase === "game_over" && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0d0f14] border border-rose-500/40 rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
              <Shield size={24} />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-rose-400 uppercase tracking-tight">
                Deriva Emotiva: Capitale Esaurito
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                L'Integrità Mentale è stata azzerata. Ricorda: tagliare le mani deboli con il <strong>FOLD CONSCIO</strong> preserva il capitale e garantisce la longevità sul mercato.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex items-center justify-around text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Ciclo Raggiunto</span>
                <strong className="text-white font-mono">{currentAnteIndex + 1}</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Fold Disciplinati</span>
                <strong className="text-emerald-400 font-mono">{persistence.totalDisciplinedFolds}</strong>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block">Aurei Conservati</span>
                <strong className="text-[#E8C56A] font-mono">{walletAurei}</strong>
              </div>
            </div>

            <button
              type="button"
              onClick={startNewRun}
              className="w-full py-2.5 rounded-xl bg-[#C5A059] hover:bg-[#E8C56A] text-black font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <RotateCcw size={15} />
              <span>Nuova Sessione sul Banco del Rischio</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SIGIL DETAIL POPUP                                        */}
      {/* ========================================================= */}
      {selectedSigilDetail && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-xs z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0d0f14] border border-[#C5A059]/40 rounded-xl p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-[#E8C56A]">{selectedSigilDetail.name}</span>
              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#C5A059]/15 border border-[#C5A059]/30 text-[#E8C56A]">
                {selectedSigilDetail.rarity}
              </span>
            </div>
            <p className="text-xs text-white leading-relaxed">{selectedSigilDetail.description}</p>
            <p className="text-[11px] text-muted-foreground italic border-l-2 border-[#C5A059]/50 pl-2">
              "{selectedSigilDetail.lore}"
            </p>
            <button
              type="button"
              onClick={() => setSelectedSigilDetail(null)}
              className="w-full py-1.5 rounded-lg bg-black/60 border border-white/15 text-xs text-muted-foreground hover:text-white transition-all cursor-pointer"
            >
              Chiudi Dettaglio
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* RULES / COMBINAZIONI CHEAT SHEET MODAL                    */}
      {/* ========================================================= */}
      {showRulesModal && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#0d0f14] border border-[#C5A059]/30 rounded-2xl p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-2.5">
              <h3 className="text-sm font-bold text-[#E8C56A] uppercase tracking-wider">
                Le Combinazioni del Banco & Dottrina del Rischio
              </h3>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕ Chiudi
              </button>
            </div>

            <div className="space-y-2">
              {Object.entries(HAND_BASE_SCORES).map(([key, item]) => (
                <div
                  key={key}
                  className="p-2.5 rounded-lg bg-black/40 border border-white/10 flex items-center justify-between gap-2"
                >
                  <div className="space-y-0.5">
                    <strong className="text-xs text-white block">{item.name}</strong>
                    <span className="text-[10px] text-muted-foreground block">{item.description}</span>
                  </div>
                  <div className="text-right text-xs font-mono shrink-0 whitespace-nowrap">
                    <span className="text-sky-400 font-bold">{item.baseChips} Chips</span>
                    <span className="text-muted-foreground"> × </span>
                    <span className="text-rose-400 font-bold">{item.baseMult}x</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-[#C5A059]/10 border border-[#C5A059]/30 space-y-1 text-xs text-slate-300">
              <strong className="text-[#E8C56A] block font-bold">Il Codice del FOLD Conscio:</strong>
              <p className="text-[11px] leading-relaxed">
                Non forzare mai un trade né una mano. Premere <strong>FOLD CONSCIO</strong> chiude il round salvando il capitale, donando Aurei di salvaguardia e rigenerando la tua Integrità Mentale.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* DECK VIEWER & PROBABILISTIC CALCULATOR MODAL (EV)         */}
      {/* ========================================================= */}
      {showDeckModal && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-40 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0d0f14] border border-[#C5A059]/40 rounded-2xl p-5 space-y-4 shadow-2xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#C5A059]/20 pb-2.5">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-[#C5A059]" />
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    Registro Mazzo & Valore Atteso (EV)
                  </h3>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Trasparenza statistica sulle carte residue nel mazzo da 52. Calcola le probabilità della prossima pescata.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowDeckModal(false)}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1 rounded bg-black/40 border border-white/10"
              >
                ✕ Chiudi
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase block">Nel Mazzo (Draw)</span>
                <strong className="text-sm font-bold text-sky-400 tabular-nums whitespace-nowrap">
                  {drawPile.length} / 52 Carte
                </strong>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase block">In Mano</span>
                <strong className="text-sm font-bold text-[#E8C56A] tabular-nums whitespace-nowrap">
                  {hand.length} Carte
                </strong>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase block">Scarti (Cimitero)</span>
                <strong className="text-sm font-bold text-rose-400 tabular-nums whitespace-nowrap">
                  {discardPile.length} Carte
                </strong>
              </div>

              <div className="p-2.5 rounded-xl bg-black/40 border border-emerald-500/25 space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase block">Prob. Figura o Asso</span>
                <strong className="text-sm font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                  {drawPile.length > 0
                    ? `${((drawPile.filter((c) => c.rank >= 10).length / drawPile.length) * 100).toFixed(0)}%`
                    : "0%"}
                </strong>
              </div>
            </div>

            {/* Matrix of 4 suits */}
            <div className="space-y-3">
              {(["liquidity", "structure", "volume", "volatility"] as const).map((suit) => {
                const sInfo = SUIT_INFO[suit];
                const drawCount = drawPile.filter((c) => c.suit === suit).length;
                const handCount = hand.filter((c) => c.suit === suit).length;
                const discardCount = discardPile.filter((c) => c.suit === suit).length;

                return (
                  <div key={suit} className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs border-b border-white/5 pb-1.5">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className={`text-sm ${sInfo.color}`}>
                          {sInfo.symbol}
                        </span>
                        <span className="text-white">{sInfo.label}</span>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-mono">
                        <span className="text-sky-400 font-bold whitespace-nowrap">{drawCount} in Mazzo</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-[#E8C56A] font-bold whitespace-nowrap">{handCount} in Mano</span>
                        <span className="text-muted-foreground">•</span>
                        <span className="text-rose-400 whitespace-nowrap">{discardCount} Scartate</span>
                      </div>
                    </div>

                    {/* Ranks 2 through 14 (Ace) */}
                    <div className="grid grid-cols-13 gap-1">
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((rank) => {
                        const rankLabel = getRankLabel(rank);
                        const isInDraw = drawPile.some((c) => c.suit === suit && c.rank === rank);
                        const isInHand = hand.some((c) => c.suit === suit && c.rank === rank);
                        const isInDiscard = discardPile.some((c) => c.suit === suit && c.rank === rank);

                        let badgeStyle = "bg-black/20 text-white/20 border-white/5";
                        let statusText = "Esaurita";

                        if (isInHand) {
                          badgeStyle = "bg-[#C5A059]/20 text-[#E8C56A] border-[#C5A059]/50 shadow-xs";
                          statusText = "In Mano";
                        } else if (isInDraw) {
                          badgeStyle = "bg-sky-500/15 text-sky-300 border-sky-500/30";
                          statusText = "Nel Mazzo";
                        } else if (isInDiscard) {
                          badgeStyle = "bg-black/40 text-rose-500/40 line-through border-rose-500/20";
                          statusText = "Scartata";
                        }

                        return (
                          <div
                            key={rank}
                            className={`h-7 rounded border flex items-center justify-center text-[11px] font-mono font-bold transition-all ${badgeStyle}`}
                            title={`${rankLabel} di ${sInfo.label}: ${statusText}`}
                          >
                            {rankLabel}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tactical Advice */}
            <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-200 flex items-center gap-2">
              <Info size={14} className="shrink-0 text-sky-400" />
              <span>
                <strong>Regola di Calcolo EV:</strong> Quando la concentrazione di un seme nel mazzo è elevata, scartare le carte deboli per pescare Colore o Scala Colore offre un profitto matematico superiore.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
