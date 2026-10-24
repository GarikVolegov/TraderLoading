import { useEffect, useRef, useState } from "react";
import {
  createBullRunnerEngine,
  type BullRunnerController,
} from "./bullRunnerEngine";
import { gameAudio } from "./gameAudioSynthesizer";
import {
  CAMPAIGN_CHAPTERS,
  loadChroniclesPersistence,
  saveChroniclesPersistence,
} from "./chronicles/chroniclesCampaignData";
import { addMasterAurei } from "./unifiedArcadeStore";
import { type CampaignChapter, type BullRunnerSkills } from "./chronicles/chroniclesTypes";
import { ChroniclesSkillTreeModal } from "./chronicles/ChroniclesSkillTreeModal";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Shield,
  Zap,
  Flame,
  Trophy,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Coins,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  Lock,
  CheckCircle2,
} from "lucide-react";

interface BullRunnerGameProps {
  onClose?: () => void;
  activeTradeContext?: {
    symbol?: string;
    direction?: string;
    durationMinutes?: number;
  };
}

export function BullRunnerGame({ onClose, activeTradeContext }: BullRunnerGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<BullRunnerController | null>(null);

  const [chronicles, setChronicles] = useState(() => loadChroniclesPersistence());
  const [selectedChapterId, setSelectedChapterId] = useState<number>(() => chronicles.unlockedChapter);
  const currentChapter: CampaignChapter =
    CAMPAIGN_CHAPTERS.find((c) => c.id === selectedChapterId) || CAMPAIGN_CHAPTERS[0];

  const [gameState, setGameState] = useState<"ready" | "running" | "paused" | "over" | "victory">("ready");
  const [score, setScore] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [coins, setCoins] = useState(0);
  const [distance, setDistance] = useState(0);
  const [spikesAvoided, setSpikesAvoided] = useState(0);
  const [hasShield, setHasShield] = useState(false);
  const [shieldCharges, setShieldCharges] = useState(1);
  const [hasBoost, setHasBoost] = useState(false);
  const [bossHp, setBossHp] = useState<number | null>(null);
  const [bossMaxHp, setBossMaxHp] = useState<number>(6);

  const [isAudioOn, setIsAudioOn] = useState(() => gameAudio.isEnabled());
  const [skillModalOpen, setSkillModalOpen] = useState(false);

  // Detachment session timer
  const [detachmentSeconds, setDetachmentSeconds] = useState(0);
  const sessionStartTime = useRef<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setDetachmentSeconds(Math.floor((Date.now() - sessionStartTime.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Initialize Three.js Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const controller = createBullRunnerEngine(
      containerRef.current,
      {
        onScoreUpdate: ({ score, multiplier, coins, distance, spikesAvoided }) => {
          setScore(score);
          setMultiplier(multiplier);
          setCoins(coins);
          setDistance(distance);
          setSpikesAvoided(spikesAvoided);
        },
        onGameOver: () => {
          setGameState("over");
        },
        onChapterComplete: (chapterId, coinsEarned) => {
          const nextUnlocked = Math.min(5, Math.max(chapterId + 1, chronicles.unlockedChapter));
          const completed = Array.from(new Set([...chronicles.completedChapters, chapterId]));
          addMasterAurei(coinsEarned);
          const updated = saveChroniclesPersistence({
            unlockedChapter: nextUnlocked,
            completedChapters: completed,
            totalAureiWallet: chronicles.totalAureiWallet + coinsEarned,
          });
          setChronicles(updated);
          setGameState("victory");
        },
        onBossHpUpdate: (hp, max) => {
          setBossHp(hp);
          setBossMaxHp(max);
        },
        onShieldChange: (shield, charges) => {
          setHasShield(shield);
          setShieldCharges(charges);
        },
        onBoostChange: (boost) => setHasBoost(boost),
        onStateChange: (state) => setGameState(state),
      },
      currentChapter,
      chronicles.bullSkills,
    );

    controllerRef.current = controller;

    return () => {
      controller?.dispose();
      controllerRef.current = null;
    };
  }, []);

  const handleSelectChapter = (chapter: CampaignChapter) => {
    if (chapter.id > chronicles.unlockedChapter) return;
    setSelectedChapterId(chapter.id);
    controllerRef.current?.setChapter(chapter);
    setGameState("ready");
  };

  const handleStart = () => {
    controllerRef.current?.setChapter(currentChapter);
    controllerRef.current?.start();
    setGameState("running");
  };

  const handlePause = () => {
    controllerRef.current?.pause();
    setGameState("paused");
  };

  const handleResume = () => {
    controllerRef.current?.resume();
    setGameState("running");
  };

  const handleRestart = () => {
    controllerRef.current?.restart();
    setGameState("running");
  };

  const handleNextChapter = () => {
    if (selectedChapterId < 5) {
      const nextChapter = CAMPAIGN_CHAPTERS.find((c) => c.id === selectedChapterId + 1);
      if (nextChapter) {
        handleSelectChapter(nextChapter);
      }
    }
  };

  const toggleSound = () => {
    const next = gameAudio.toggle();
    setIsAudioOn(next);
  };

  return (
    <div className="relative w-full h-full min-h-[500px] select-none overflow-hidden bg-[#07080b] rounded-xl border border-[#C5A059]/25 flex flex-col justify-between font-mono">
      {/* 3D WebGL Canvas */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top HUD */}
      <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between gap-2 pointer-events-none">
        {/* Left: Score & Multiplier */}
        <div className="flex items-center gap-3">
          <div className="bg-[#0d0f14]/85 backdrop-blur-md border border-[#C5A059]/30 rounded-lg px-3 py-1.5 shadow-[0_0_15px_rgba(197,160,89,0.1)]">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/80">
              Punteggio
            </div>
            <div className="text-lg sm:text-xl font-bold text-[#E8C56A] tabular-nums tracking-tight whitespace-nowrap">
              {score.toLocaleString()}
            </div>
          </div>

          <div
            className={`px-2.5 py-1.5 rounded-lg border backdrop-blur-md text-xs font-bold transition-all ${
              multiplier >= 5
                ? "bg-red-500/20 border-red-500/50 text-red-400 animate-pulse"
                : multiplier >= 3
                ? "bg-[#C5A059]/20 border-[#C5A059]/60 text-[#E8C56A]"
                : multiplier >= 2
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                : "bg-black/60 border-white/10 text-muted-foreground"
            }`}
          >
            <div className="flex items-center gap-1">
              <Flame size={13} className={multiplier > 1 ? "animate-bounce" : ""} />
              <span className="whitespace-nowrap">{multiplier}x Indice</span>
            </div>
          </div>
        </div>

        {/* Center: Chapter Objective Progress / Boss HP */}
        <div className="hidden sm:flex flex-col items-center">
          {currentChapter.isBossChapter && bossHp !== null ? (
            <div className="bg-red-950/70 border border-red-500/50 rounded-full px-4 py-1.5 flex items-center gap-2.5 text-xs text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse">
              <AlertTriangle size={13} className="text-red-400" />
              <span>Titano dell'Orso:</span>
              <strong className="text-white font-bold">{bossHp}/{bossMaxHp} HP</strong>
            </div>
          ) : (
            <div className="bg-black/80 backdrop-blur-md border border-[#C5A059]/30 rounded-full px-4 py-1 flex items-center gap-2.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-muted-foreground">Progresso Capitolo:</span>
              <strong className="text-foreground tabular-nums whitespace-nowrap">
                {distance} / {currentChapter.targetMeters} m
              </strong>
            </div>
          )}
        </div>

        {/* Right: Coins, Arsenal & Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {hasShield && (
            <div className="px-2 py-1 rounded bg-[#C5A059]/25 border border-[#C5A059]/60 text-[#E8C56A] flex items-center gap-1 text-[11px] font-bold animate-pulse">
              <Shield size={12} />
              <span className="tabular-nums">Scudo x{shieldCharges}</span>
            </div>
          )}

          {hasBoost && (
            <div className="px-2 py-1 rounded bg-emerald-500/25 border border-emerald-500/60 text-emerald-300 flex items-center gap-1 text-[11px] font-bold animate-pulse">
              <Zap size={12} />
              <span className="hidden sm:inline">Boost</span>
            </div>
          )}

          <div className="bg-[#0d0f14]/85 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1.5 flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1 text-[#E8C56A]">
              <Coins size={13} />
              <span className="font-bold tabular-nums whitespace-nowrap">{coins}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSkillModalOpen(true)}
            title="Arsenale & Competenze"
            className="p-2 rounded-lg bg-[#0d0f14]/85 border border-[#C5A059]/40 hover:bg-[#C5A059]/15 text-[#E8C56A] transition-all cursor-pointer"
          >
            <Sparkles size={16} />
          </button>

          <button
            type="button"
            onClick={toggleSound}
            title={isAudioOn ? "Silenzia audio" : "Attiva audio"}
            className="p-2 rounded-lg bg-[#0d0f14]/85 border border-white/10 hover:border-[#C5A059]/40 text-muted-foreground hover:text-[#E8C56A] transition-all cursor-pointer"
          >
            {isAudioOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {gameState === "running" && (
            <button
              type="button"
              onClick={handlePause}
              title="Pausa"
              className="p-2 rounded-lg bg-[#0d0f14]/85 border border-white/10 hover:border-[#C5A059]/40 text-muted-foreground hover:text-[#E8C56A] transition-all cursor-pointer"
            >
              <Pause size={16} />
            </button>
          )}
        </div>
      </div>

      {/* SCREEN: CHAPTER SELECT & BRIEFING (READY STATE) */}
      {gameState === "ready" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-2xl w-full bg-[#0d0f14] border border-[#C5A059]/35 rounded-2xl p-5 sm:p-6 shadow-[0_0_40px_rgba(197,160,89,0.18)] flex flex-col gap-5">
            {/* Chapter Selection Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 overflow-x-auto gap-2">
              {CAMPAIGN_CHAPTERS.map((ch) => {
                const isUnlocked = ch.id <= chronicles.unlockedChapter;
                const isSelected = ch.id === selectedChapterId;
                const isCompleted = chronicles.completedChapters.includes(ch.id);

                return (
                  <button
                    key={ch.id}
                    type="button"
                    disabled={!isUnlocked}
                    onClick={() => handleSelectChapter(ch)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                      isSelected
                        ? "bg-[#C5A059] text-black border-[#C5A059] shadow-md cursor-pointer"
                        : isUnlocked
                        ? "bg-black/40 border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 cursor-pointer"
                        : "bg-black/20 border-white/5 text-muted-foreground/30 cursor-not-allowed"
                    }`}
                  >
                    {!isUnlocked ? (
                      <Lock size={11} />
                    ) : isCompleted ? (
                      <CheckCircle2 size={11} className={isSelected ? "text-black" : "text-emerald-400"} />
                    ) : null}
                    <span>Cap. {ch.id}</span>
                  </button>
                );
              })}
            </div>

            {/* Chapter Details & Lore */}
            <div className="text-left space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-[#E8C56A] tracking-widest">
                  Briefing Operativo
                </span>
                <span className="text-xs text-muted-foreground">
                  Ricompensa: <strong className="text-[#E8C56A]">+{currentChapter.rewardAurei} Aurei</strong>
                </span>
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-foreground">
                {currentChapter.title}
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {currentChapter.lorePreamble}
              </p>

              <blockquote className="p-3 rounded-xl bg-black/40 border-l-2 border-[#C5A059] text-xs text-[#E8C56A]/90 italic">
                "{currentChapter.doctrineQuote}"
              </blockquote>

              <div className="p-3 rounded-xl bg-black/50 border border-white/10 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Obiettivo Principale:</span>
                <strong className="text-foreground">
                  {currentChapter.isBossChapter
                    ? "Sconfiggi il Titano dell'Orso con le Sfere di Breakout"
                    : `Percorri ${currentChapter.targetMeters} metri`}
                </strong>
              </div>
            </div>

            {/* Launch CTA */}
            <button
              type="button"
              onClick={handleStart}
              className="w-full py-3.5 px-6 rounded-xl bg-[#C5A059] hover:bg-[#d8b167] text-black font-bold text-sm shadow-[0_0_20px_rgba(197,160,89,0.3)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Play size={16} fill="currentColor" />
              <span>Avvia Corsa del Capitolo</span>
            </button>
          </div>
        </div>
      )}

      {/* SCREEN: VICTORY SCREEN */}
      {gameState === "victory" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-4 text-center">
          <div className="max-w-md w-full bg-[#0d0f14] border border-[#C5A059] rounded-2xl p-6 shadow-[0_0_50px_rgba(197,160,89,0.25)] flex flex-col gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#C5A059]/20 border border-[#C5A059] mx-auto flex items-center justify-center text-[#E8C56A]">
              <Trophy size={28} />
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                Capitolo Superato con Gloria
              </span>
              <h2 className="text-xl font-bold text-foreground mt-1">
                {currentChapter.title}
              </h2>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              La disciplina operativa ha trionfato sulla pressione del mercato. Hai acquisito{" "}
              <strong className="text-[#E8C56A]">+{currentChapter.rewardAurei} Aurei</strong> nel tuo Arsenale.
            </p>

            <div className="space-y-2 mt-2">
              {selectedChapterId < 5 && (
                <button
                  type="button"
                  onClick={handleNextChapter}
                  className="w-full py-3 px-4 rounded-xl bg-[#C5A059] hover:bg-[#d8b167] text-black font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-lg"
                >
                  <span>Prossimo Capitolo</span>
                  <ChevronRight size={14} />
                </button>
              )}

              <button
                type="button"
                onClick={() => setGameState("ready")}
                className="w-full py-2.5 px-4 rounded-xl border border-white/10 hover:border-white/20 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
              >
                Torna al Selettore Capitoli
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN: GAME OVER */}
      {gameState === "over" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-4 text-center">
          <div className="max-w-sm w-full bg-[#0d0f14] border border-red-500/40 rounded-2xl p-6 shadow-[0_0_40px_rgba(239,68,68,0.2)] flex flex-col gap-4">
            <h3 className="text-lg font-bold text-foreground">IMPATTO SULL'OSTACOLO</h3>
            <p className="text-xs text-muted-foreground">
              La corsa si è interrotta. Nessun cedimento: l'esperienza accumulata affila i riflessi.
            </p>

            <div className="bg-black/50 border border-white/10 rounded-xl p-3 text-xs space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Distanza:</span>
                <strong className="text-foreground">{distance} m</strong>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Aurei Raccolti:</span>
                <strong className="text-[#E8C56A]">{coins}</strong>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full py-2.5 px-4 rounded-xl bg-[#C5A059] hover:bg-[#d8b167] text-black font-bold text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw size={14} />
                <span>Riprova Capitolo</span>
              </button>
              <button
                type="button"
                onClick={() => setGameState("ready")}
                className="w-full py-2 px-4 rounded-xl border border-white/10 hover:border-white/20 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
              >
                Cambia Capitolo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAUSED OVERLAY */}
      {gameState === "paused" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-center">
          <div className="max-w-xs w-full bg-[#0d0f14] border border-[#C5A059]/40 rounded-2xl p-6 shadow-2xl space-y-3">
            <h3 className="text-lg font-bold text-foreground">CORSA SOSPESA</h3>
            <p className="text-xs text-muted-foreground">Il trade attivo prosegue indisturbato.</p>
            <button
              type="button"
              onClick={handleResume}
              className="w-full py-2.5 px-4 rounded-xl bg-[#C5A059] text-black font-bold text-xs cursor-pointer hover:bg-[#d8b167]"
            >
              Riprendi
            </button>
          </div>
        </div>
      )}

      {/* Skill Tree Modal */}
      <ChroniclesSkillTreeModal
        open={skillModalOpen}
        onOpenChange={setSkillModalOpen}
        onSkillsUpdated={(newSkills, newWallet) => {
          controllerRef.current?.setSkills(newSkills);
          setChronicles((prev) => ({
            ...prev,
            bullSkills: newSkills,
            totalAureiWallet: newWallet,
          }));
        }}
      />
    </div>
  );
}
