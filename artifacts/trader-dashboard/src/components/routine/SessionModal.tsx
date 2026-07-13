import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { X, ChevronRight, ChevronLeft, SkipForward, Check } from "lucide-react";
import { useDialogA11y } from "@/hooks/useDialogA11y";
import { uiText } from "@/contexts/LanguageContext";
import type { Program, Answers } from "./types";
import { MORNING_STEPS, EVENING_STEPS } from "./sessionSteps";
import { EmotionQuizStep } from "./EmotionQuizStep";
import { BreathingStep } from "./BreathingStep";
import { GratitudeStep } from "./GratitudeStep";
import { VisualizationStep } from "./VisualizationStep";
import { ChecklistStep } from "./ChecklistStep";
import { GoalsStep } from "./GoalsStep";
import { TradeReviewStep } from "./TradeReviewStep";
import { ReflectionStep } from "./ReflectionStep";
import { TomorrowStep } from "./TomorrowStep";
import { CompleteStep } from "./CompleteStep";

export function SessionModal({
  program,
  onClose,
  onComplete,
}: {
  program: Program;
  onClose: () => void;
  onComplete: (answers: Answers) => void;
}) {
  const steps = program === "morning" ? MORNING_STEPS : EVENING_STEPS;
  const [stepIdx, setStepIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [breathingReady, setBreathingReady] = useState(false);
  const [vizDone, setVizDone] = useState(false);

  const isLastStep = stepIdx === steps.length - 1;
  const step = steps[stepIdx];
  const accentColor = program === "morning" ? "#f59e0b" : "#818cf8";

  const canAdvance = () => {
    if (step.type === "emotion-quiz") return !!answers.emotion;
    if (step.type === "breathing") return breathingReady;
    if (step.type === "visualization") return vizDone;
    if (step.type === "complete") return false;
    return true;
  };

  const advance = () => {
    if (isLastStep) {
      onComplete(answers);
      return;
    }
    setStepIdx((i) => i + 1);
    setBreathingReady(false);
  };

  const goBack = () => {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  };

  const Icon = step.icon;
  const panelRef = useRef<HTMLDivElement>(null);
  const { titleId, panelProps } = useDialogA11y({ isOpen: true, onClose, panelRef });

  // Fire confetti when reaching complete step
  useEffect(() => {
    if (step.type === "complete") {
      const colors = program === "morning"
        ? ["#f59e0b", "#fcd34d", "#ffffff"]
        : ["#6366f1", "#a5b4fc", "#ffffff"];
      setTimeout(() => confetti({ particleCount: 100, spread: 70, origin: { y: 0.4 }, colors, scalar: 0.9 }), 200);
    }
  }, [step.type, program]);

  return (
    <motion.div
      ref={panelRef}
      {...panelProps}
      aria-labelledby={titleId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-[hsl(224,71%,2%)]/97 backdrop-blur-sm flex flex-col focus:outline-none"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${accentColor}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div>
            <p className="text-sm font-bold font-mono leading-tight">
              {program === "morning" ? "Programma Mattutino" : "Programma Serale"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Passo {stepIdx + 1} di {steps.length}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          aria-label={uiText("common.close")}
          className="w-8 h-8 rounded-full border border-border/30 flex items-center justify-center hover:border-border/70 hover:bg-card/40 transition-all"
        >
          <X className="w-4 h-4 text-muted-foreground/60" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.25 bg-secondary/50 shrink-0 mx-4 sm:mx-6 mt-3 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: accentColor }}
          animate={{ width: `${((stepIdx + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl mx-auto flex flex-col gap-8">
          {/* Step header */}
          <AnimatePresence mode="wait">
            <motion.div
              key={stepIdx}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <h2 id={titleId} className="text-2xl sm:text-3xl font-bold font-mono tracking-tight">{step.title}</h2>
              <p className="text-sm text-muted-foreground/60 mt-1">{step.subtitle}</p>
            </motion.div>
          </AnimatePresence>

          {/* Step body */}
          <AnimatePresence mode="wait">
            <motion.div
              key={stepIdx}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              {step.type === "emotion-quiz" && (
                <EmotionQuizStep program={program} answers={answers} onChange={setAnswers} />
              )}
              {step.type === "breathing" && (
                <BreathingStep
                  program={program}
                  onReady={() => { setBreathingReady(true); advance(); }}
                />
              )}
              {step.type === "gratitude" && (
                <GratitudeStep program={program} answers={answers} onChange={setAnswers} />
              )}
              {step.type === "visualization" && (
                <VisualizationStep onSkip={() => { setVizDone(true); advance(); }} />
              )}
              {step.type === "checklist" && (
                <ChecklistStep answers={answers} onChange={setAnswers} />
              )}
              {step.type === "goals" && (
                <GoalsStep answers={answers} onChange={setAnswers} />
              )}
              {step.type === "trade-review" && (
                <TradeReviewStep answers={answers} onChange={setAnswers} />
              )}
              {step.type === "reflection" && (
                <ReflectionStep answers={answers} onChange={setAnswers} />
              )}
              {step.type === "tomorrow" && (
                <TomorrowStep answers={answers} onChange={setAnswers} />
              )}
              {step.type === "complete" && (
                <CompleteStep program={program} answers={answers} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom nav — always show back button; hide Avanti only on auto-advancing steps */}
      <div className="border-t border-border/20 px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
        <button
          onClick={stepIdx === 0 ? onClose : goBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/30 text-sm text-muted-foreground/60 hover:text-muted-foreground/90 hover:border-border/60 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          {stepIdx === 0 ? "Chiudi" : "Indietro"}
        </button>

        {step.type !== "breathing" && step.type !== "visualization" && (
          <div className="flex items-center gap-2">
            {step.skippable && (
              <button
                onClick={advance}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Salta
              </button>
            )}
            {step.type === "complete" ? (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => onComplete(answers)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white"
                style={{ backgroundColor: accentColor }}
              >
                <Check className="w-4 h-4" strokeWidth={3} />
                Completa sessione
              </motion.button>
            ) : (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={advance}
                disabled={!canAdvance()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all"
                style={{
                  backgroundColor: canAdvance() ? accentColor : undefined,
                  color: canAdvance() ? "#fff" : undefined,
                  opacity: canAdvance() ? 1 : 0.35,
                  border: canAdvance() ? "none" : "1px solid hsl(var(--border) / 0.4)",
                }}
              >
                Avanti
                <ChevronRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
