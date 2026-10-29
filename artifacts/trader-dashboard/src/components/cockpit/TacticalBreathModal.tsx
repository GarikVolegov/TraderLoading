import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  X,
  ShieldCheck,
  Wind,
  Sparkles,
  Flame,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  playBreathInhale,
  playBreathHold,
  playBreathExhale,
  playBreathComplete,
  stopBreathAudio,
  synestheticClick,
} from "@/lib/soundFx";
import { recordBreathAlignmentTimestamp } from "@/lib/bioLockGuard";
import { hapticLight, hapticSovereign, hapticSuccess } from "@/lib/haptics";

export interface TacticalBreathModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onCycleComplete?: (completedCycle: number) => void;
}

export type BreathPhase = "inhale" | "hold" | "exhale" | "complete";

const PHASE_DURATIONS: Record<Exclude<BreathPhase, "complete">, number> = {
  inhale: 4,
  hold: 7,
  exhale: 8,
};

const STOIC_MAXIMS: Record<Exclude<BreathPhase, "complete">, string> = {
  inhale: "Accogli il presente. Rilascia ogni fretta e aspettativa.",
  hold: "Nel silenzio interiore dimora il comando sovrano dell'azione.",
  exhale: "Espelli l'impulso. Riafferma la disciplina inflessibile.",
};

const PHASE_SUBTITLES: Record<Exclude<BreathPhase, "complete">, string> = {
  inhale: "Espansione diaframmatica · Entra presenza",
  hold: "Apnea cosciente · Presidio del Nervo Vago",
  exhale: "Rilascio profondo · Scarico del cortisolo",
};

export function TacticalBreathModal({
  isOpen,
  onClose,
  onComplete,
  onCycleComplete,
}: TacticalBreathModalProps) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<BreathPhase>("inhale");
  const [secondsLeft, setSecondsLeft] = useState<number>(PHASE_DURATIONS.inhale);
  const [progressPct, setProgressPct] = useState<number>(0);
  const [cycle, setCycle] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Callback refs stabili per prevenire riavvii e disconnessioni del timer a causa di ri-render del genitore
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onCycleCompleteRef = useRef(onCycleComplete);
  onCycleCompleteRef.current = onCycleComplete;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const phaseRef = useRef<BreathPhase>(phase);
  phaseRef.current = phase;
  const cycleRef = useRef<number>(cycle);
  cycleRef.current = cycle;
  const isPausedRef = useRef<boolean>(isPaused);
  isPausedRef.current = isPaused;
  const soundEnabledRef = useRef<boolean>(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  // Riferimenti cronometrici ad alta precisione (timestamp-based math)
  const phaseStartTimeRef = useRef<number>(0);
  const pausedAtRef = useRef<number | null>(null);
  const totalPausedTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Esecuzione audio sicura
  const playPhaseAudio = useCallback((targetPhase: BreathPhase, duration: number) => {
    if (!soundEnabledRef.current) return;
    try {
      if (targetPhase === "inhale") {
        playBreathInhale(duration);
      } else if (targetPhase === "hold") {
        playBreathHold(duration);
      } else if (targetPhase === "exhale") {
        playBreathExhale(duration);
      } else if (targetPhase === "complete") {
        playBreathComplete();
      }
    } catch {
      // Guard acustico
    }
  }, []);

  // Transizione deterministica di fase
  const transitionToPhase = useCallback(
    (nextPhase: BreathPhase, nextCycle: number) => {
      setPhase(nextPhase);
      setCycle(nextCycle);
      phaseStartTimeRef.current = performance.now();
      totalPausedTimeRef.current = 0;
      pausedAtRef.current = null;

      if (nextPhase === "complete") {
        setProgressPct(100);
        setSecondsLeft(0);
        hapticSovereign();
        playPhaseAudio("complete", 3.5);
        recordBreathAlignmentTimestamp();
        if (onCompleteRef.current) {
          onCompleteRef.current();
        }
      } else {
        const duration = PHASE_DURATIONS[nextPhase];
        setSecondsLeft(duration);
        setProgressPct(0);
        hapticLight();
        playPhaseAudio(nextPhase, duration);
      }
    },
    [playPhaseAudio]
  );

  // Reset del rituale
  const resetRitual = useCallback(() => {
    stopBreathAudio();
    setIsPaused(false);
    isPausedRef.current = false;
    transitionToPhase("inhale", 1);
  }, [transitionToPhase]);

  // Avvio all'apertura del modale
  useEffect(() => {
    if (isOpen) {
      resetRitual();
    } else {
      stopBreathAudio();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    return () => {
      stopBreathAudio();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isOpen, resetRitual]);

  // Loop cronometrico ad alta precisione a 60fps (immune a timer drift e re-render esterni)
  useEffect(() => {
    if (!isOpen) return;

    let isRunning = true;

    const tick = () => {
      if (!isRunning) return;

      if (isPausedRef.current || phaseRef.current === "complete") {
        animationFrameRef.current = requestAnimationFrame(tick);
        return;
      }

      const currentPhase = phaseRef.current;
      const currentCycle = cycleRef.current;
      const durationSec = PHASE_DURATIONS[currentPhase];
      const now = performance.now();

      // Tempo trascorso escludendo pause
      const elapsedMs = Math.max(0, now - phaseStartTimeRef.current - totalPausedTimeRef.current);
      const elapsedSec = elapsedMs / 1000;
      const remainingSec = Math.max(0, durationSec - elapsedSec);
      const progress = Math.min(100, (elapsedSec / durationSec) * 100);

      // Aggiornamento fluido del progresso visuale e countdown
      setProgressPct(progress);
      setSecondsLeft(Math.max(1, Math.ceil(remainingSec)));

      // Verifica completamento della fase corrente
      if (elapsedSec >= durationSec) {
        if (currentPhase === "inhale") {
          transitionToPhase("hold", currentCycle);
        } else if (currentPhase === "hold") {
          transitionToPhase("exhale", currentCycle);
        } else if (currentPhase === "exhale") {
          recordBreathAlignmentTimestamp();
          if (onCycleCompleteRef.current) {
            onCycleCompleteRef.current(currentCycle);
          }
          if (currentCycle < 4) {
            transitionToPhase("inhale", currentCycle + 1);
          } else {
            transitionToPhase("complete", 4);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isOpen, transitionToPhase]);

  // Gestione Pausa / Riprendi
  const togglePause = () => {
    synestheticClick();
    if (!isPaused) {
      stopBreathAudio();
      pausedAtRef.current = performance.now();
      setIsPaused(true);
      isPausedRef.current = true;
    } else {
      if (pausedAtRef.current) {
        totalPausedTimeRef.current += performance.now() - pausedAtRef.current;
        pausedAtRef.current = null;
      }
      setIsPaused(false);
      isPausedRef.current = false;
      if (phase !== "complete") {
        playPhaseAudio(phase, secondsLeft);
      }
    }
  };

  // Gestione Audio On/Off
  const toggleSound = () => {
    synestheticClick();
    if (soundEnabled) {
      stopBreathAudio();
      setSoundEnabled(false);
      soundEnabledRef.current = false;
    } else {
      setSoundEnabled(true);
      soundEnabledRef.current = true;
      if (!isPaused && phase !== "complete") {
        playPhaseAudio(phase, secondsLeft);
      }
    }
  };

  if (!isOpen) return null;

  // Dimensioni e dinamica di biofeedback
  const radius = 108;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  // Calcolo della scala del respiro
  const orbScale =
    phase === "inhale"
      ? 1.28
      : phase === "hold"
      ? 1.28
      : phase === "exhale"
      ? 0.88
      : 1.0;

  const transitionDuration =
    phase === "inhale"
      ? `${PHASE_DURATIONS.inhale}s`
      : phase === "hold"
      ? "0.4s"
      : phase === "exhale"
      ? `${PHASE_DURATIONS.exhale}s`
      : "0.5s";

  return (
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tactical-breath-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#07080b]/94 backdrop-blur-2xl animate-in fade-in duration-300 select-none overflow-y-auto scrollbar-thin scrollbar-thumb-[#C5A059]/30"
      >
        {/* AMBIENTE SENSORIALE AUREUS — Radiazione Aureo-Ossidiana Immersiva */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
          {/* Alone di respiro radiale profondo */}
          <div
            style={{
              transform: `scale(${isPaused ? 1.0 : orbScale * 1.15})`,
              transition: `transform ${transitionDuration} cubic-bezier(0.4, 0.0, 0.2, 1)`,
            }}
            className={`w-[600px] h-[600px] sm:w-[850px] sm:h-[850px] rounded-full transition-opacity duration-1000 ${
              phase === "complete"
                ? "bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.22)_0%,rgba(16,185,129,0.04)_45%,transparent_70%)]"
                : phase === "inhale"
                ? "bg-[radial-gradient(circle_at_50%_50%,rgba(232,197,106,0.22)_0%,rgba(197,160,89,0.06)_50%,transparent_75%)]"
                : phase === "hold"
                ? "bg-[radial-gradient(circle_at_50%_50%,rgba(197,160,89,0.28)_0%,rgba(197,160,89,0.08)_50%,transparent_75%)]"
                : "bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.08)_0%,rgba(197,160,89,0.03)_40%,transparent_70%)]"
            }`}
          />

          {/* Onde di risonanza concentrica dell'Ordine */}
          <div className="absolute w-[440px] h-[440px] sm:w-[580px] sm:h-[580px] rounded-full border border-[#C5A059]/12 pointer-events-none animate-[pulse_6s_ease-in-out_infinite]" />
          <div className="absolute w-[620px] h-[620px] sm:w-[780px] sm:h-[780px] rounded-full border border-[#C5A059]/6 pointer-events-none" />
        </div>

        {/* CONTENITORE PRINCIPALE SANCTUM */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="relative w-full max-w-xl rounded-2xl border border-[#C5A059]/35 bg-[#07080b]/95 p-5 sm:p-7 shadow-[0_0_60px_rgba(197,160,89,0.20)] flex flex-col items-center text-center overflow-hidden z-10 my-auto"
        >
          {/* Filigrana e texture sottile di sicurezza */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,rgba(197,160,89,0.14),transparent_65%)]" />

          {/* BARRA SUPERIORE — Intestazione e Controlli Audio */}
          <div className="w-full flex items-center justify-between z-10 mb-4 pb-3 border-b border-[#C5A059]/20">
            <div className="flex items-center gap-3 text-left min-w-0">
              <div className="p-2 rounded-xl bg-[#C5A059]/15 border border-[#C5A059]/40 text-[#E8C56A] shadow-[0_0_15px_rgba(197,160,89,0.25)] flex-shrink-0">
                <Wind size={18} className="animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    id="tactical-breath-title"
                    className="font-mono text-xs sm:text-sm uppercase font-black tracking-widest text-[#E8C56A] whitespace-nowrap"
                  >
                    {t("breath.title")}
                  </h2>
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold tracking-wider bg-[#C5A059]/15 border border-[#C5A059]/35 text-[#E8C56A] whitespace-nowrap">
                    4-7-8 Bio-Reset
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono truncate">
                  {t("breath.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={toggleSound}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  soundEnabled
                    ? "bg-[#C5A059]/20 border-[#C5A059]/55 text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.3)]"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                }`}
                title={t("breath.audio_guide")}
                aria-label={t("breath.audio_guide")}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:text-foreground hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10 transition-all cursor-pointer"
                title={t("honor_card.close")}
                aria-label={t("honor_card.close")}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* CENTRO DI BIOFEEDBACK — Il Grande Cuore del Respiro Tattico */}
          <div className="relative flex items-center justify-center w-72 h-72 sm:w-80 sm:h-80 my-2 z-10">
            {/* Anello di Progresso Geometrico ad Altissima Definizione */}
            <svg
              className="w-72 h-72 sm:w-80 sm:h-80 -rotate-90 transform absolute inset-0 pointer-events-none"
              viewBox="0 0 240 240"
            >
              <defs>
                <linearGradient id="aureusBreathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C5A059" />
                  <stop offset="50%" stopColor="#E8C56A" />
                  <stop offset="100%" stopColor="#F3D88C" />
                </linearGradient>
                <filter id="aureusGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Traccia di fondo */}
              <circle
                cx="120"
                cy="120"
                r={radius}
                className="stroke-white/10"
                strokeWidth="3.5"
                fill="transparent"
              />

              {/* Arco progressivo dinamico a 60fps */}
              {phase !== "complete" && (
                <circle
                  cx="120"
                  cy="120"
                  r={radius}
                  stroke="url(#aureusBreathGradient)"
                  strokeWidth="4.5"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  fill="transparent"
                  filter="url(#aureusGlow)"
                  className="transition-[stroke-dashoffset] duration-75 ease-linear"
                />
              )}
            </svg>

            {/* Nucleo Pulsante Organico */}
            <div
              style={{
                transform: `scale(${isPaused ? 1.0 : orbScale})`,
                transition: `transform ${transitionDuration} cubic-bezier(0.4, 0.0, 0.2, 1)`,
              }}
              className={`w-44 h-44 sm:w-50 sm:h-50 rounded-full flex flex-col items-center justify-center border shadow-2xl transition-colors duration-700 relative backdrop-blur-md ${
                phase === "complete"
                  ? "bg-[#10b981]/20 border-[#10b981]/70 shadow-[0_0_50px_rgba(16,185,129,0.45)]"
                  : phase === "inhale"
                  ? "bg-gradient-to-tr from-[#C5A059]/35 to-[#E8C56A]/25 border-[#E8C56A]/75 shadow-[0_0_55px_rgba(232,197,106,0.45)]"
                  : phase === "hold"
                  ? "bg-gradient-to-tr from-[#C5A059]/45 to-[#C5A059]/30 border-[#C5A059]/90 shadow-[0_0_65px_rgba(197,160,89,0.55)]"
                  : "bg-gradient-to-tr from-white/12 to-white/5 border-white/25 shadow-[0_0_30px_rgba(255,255,255,0.12)]"
              }`}
            >
              {phase === "complete" ? (
                <div className="flex flex-col items-center justify-center gap-1.5 animate-in zoom-in-75 duration-300">
                  <ShieldCheck size={48} className="text-[#10b981] animate-bounce" />
                  <span className="font-mono text-xs font-black uppercase tracking-widest text-[#10b981] whitespace-nowrap">
                    100% PRONTO
                  </span>
                </div>
              ) : (
                <>
                  {/* Badge Fase Semantica */}
                  <div className="flex items-center gap-1 mb-1">
                    {phase === "inhale" && <Wind size={13} className="text-[#E8C56A]" />}
                    {phase === "hold" && <ShieldCheck size={13} className="text-[#E8C56A]" />}
                    {phase === "exhale" && <Flame size={13} className="text-white/80" />}
                    <span className="font-mono text-[11px] font-black tracking-widest uppercase text-[#E8C56A] whitespace-nowrap">
                      {phase === "inhale"
                        ? t("breath.phase_inhale")
                        : phase === "hold"
                        ? t("breath.phase_hold")
                        : t("breath.phase_exhale")}
                    </span>
                  </div>

                  {/* Countdown Numerico Monospace Gigante */}
                  <div className="flex items-baseline justify-center">
                    <span className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-foreground whitespace-nowrap drop-shadow-md">
                      {secondsLeft}s
                    </span>
                  </div>

                  {/* Target di Fase Fisiologico */}
                  <span className="font-mono text-[10px] text-muted-foreground uppercase font-bold tracking-wider whitespace-nowrap mt-1">
                    {phase === "inhale"
                      ? "Target 4s"
                      : phase === "hold"
                      ? "Target 7s"
                      : "Target 8s"}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* GUIDA FISIOLOGICA DEL NERVOSO VAGO */}
          {phase !== "complete" && (
            <div className="z-10 text-[11px] font-mono text-[#E8C56A]/90 tracking-wide uppercase font-semibold mb-2">
              {PHASE_SUBTITLES[phase]}
            </div>
          )}

          {/* INDICATORI DEI 4 CICLI SOVRANI */}
          {phase !== "complete" ? (
            <div className="z-10 flex flex-col items-center gap-2.5 my-2 w-full">
              {/* Le 4 capsule di ciclo */}
              <div className="grid grid-cols-4 gap-2 w-full max-w-sm px-2">
                {[1, 2, 3, 4].map((c) => {
                  const isDone = c < cycle;
                  const isCurrent = c === cycle;
                  return (
                    <div
                      key={c}
                      className={`h-2.5 rounded-full transition-all duration-500 relative flex items-center justify-center ${
                        isDone
                          ? "bg-[#10b981] shadow-[0_0_12px_rgba(16,185,129,0.7)]"
                          : isCurrent
                          ? "bg-[#C5A059] shadow-[0_0_15px_rgba(197,160,89,0.8)] ring-2 ring-[#E8C56A]/50"
                          : "bg-white/10"
                      }`}
                      title={`${t("breath.cycle")} ${c} / 4`}
                    >
                      {isDone && <CheckCircle2 size={10} className="text-black absolute" />}
                    </div>
                  );
                })}
              </div>

              {/* Informazione testuale ciclo */}
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[#E8C56A] font-bold tracking-wider whitespace-nowrap uppercase">
                  {t("breath.cycle")} {cycle} / 4
                </span>
                <span className="text-white/20">·</span>
                <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                  Protocollo Completo: 76s
                </span>
              </div>

              {/* Massima Stoica dell'Ordine (Zero Shift di Layout) */}
              <div className="min-h-[40px] flex items-center justify-center px-4">
                <p className="text-xs sm:text-[13px] text-slate-300 italic tracking-wide font-serif leading-relaxed">
                  "{STOIC_MAXIMS[phase]}"
                </p>
              </div>
            </div>
          ) : (
            <div className="z-10 flex flex-col items-center gap-2.5 my-3 animate-in fade-in zoom-in-95 duration-500">
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#10b981]/15 border border-[#10b981]/45 text-[#10b981] font-mono text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                <Sparkles size={15} />
                <span>{t("breath.completed_title")}</span>
              </div>
              <p className="text-xs text-slate-300 max-w-md leading-relaxed px-2 font-mono">
                {t("breath.completed_desc")}
              </p>
            </div>
          )}

          {/* PULSANTI DI COMANDO OPERATIVO */}
          <div className="w-full flex flex-wrap items-center justify-center gap-2.5 z-10 pt-4 mt-1 border-t border-[#C5A059]/20">
            {phase !== "complete" ? (
              <>
                {/* Pausa / Riprendi */}
                <button
                  type="button"
                  onClick={togglePause}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border font-mono text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                    isPaused
                      ? "bg-gradient-to-r from-[#C5A059] to-[#E8C56A] text-black border-[#E8C56A] shadow-[0_0_20px_rgba(197,160,89,0.45)] hover:brightness-110 active:scale-95"
                      : "bg-[#C5A059]/15 border-[#C5A059]/50 text-[#E8C56A] hover:bg-[#C5A059]/25 shadow-[0_0_15px_rgba(197,160,89,0.2)] active:scale-95"
                  }`}
                >
                  {isPaused ? <Play size={14} className="fill-current" /> : <Pause size={14} />}
                  <span>{isPaused ? t("breath.resume") : t("breath.pause")}</span>
                </button>

                {/* Riavvia */}
                <button
                  type="button"
                  onClick={resetRitual}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10 text-muted-foreground hover:text-foreground font-mono text-xs transition-all cursor-pointer whitespace-nowrap active:scale-95"
                  title={t("breath.restart")}
                >
                  <RotateCcw size={14} />
                  <span>{t("breath.restart")}</span>
                </button>

                {/* Sblocca Bio-Lock rapido dopo 1 ciclo completo */}
                {cycle >= 2 && onComplete && (
                  <button
                    type="button"
                    onClick={() => {
                      synestheticClick();
                      hapticSuccess();
                      recordBreathAlignmentTimestamp();
                      if (onCompleteRef.current) {
                        onCompleteRef.current();
                      }
                      onClose();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#10b981]/50 bg-[#10b981]/15 hover:bg-[#10b981]/25 text-[#10b981] font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shadow-[0_0_15px_rgba(16,185,129,0.2)] active:scale-95"
                  >
                    <ShieldCheck size={14} />
                    <span>Sblocca Presidio (1 Ciclo OK)</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-6 rounded-xl font-mono text-xs font-black uppercase tracking-widest bg-gradient-to-r from-[#C5A059] via-[#E8C56A] to-[#C5A059] text-black shadow-[0_0_30px_rgba(197,160,89,0.5)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
              >
                {t("breath.close_action")}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
