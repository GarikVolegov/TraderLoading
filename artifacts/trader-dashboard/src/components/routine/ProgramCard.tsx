import { useState, useEffect, type ElementType } from "react";
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { CheckCircle2, RotateCcw, Play } from "lucide-react";
import type { Program, SessionStep } from "./types";
import { loadCompletion } from "./completion";

export function ProgramCard({
  program,
  label,
  timeLabel,
  description,
  steps,
  isActive,
  accentColor,
  accentClass,
  borderActiveClass,
  icon: CardIcon,
  delay,
  onStart,
}: {
  program: Program;
  label: string;
  timeLabel: string;
  description: string;
  steps: SessionStep[];
  isActive: boolean;
  accentColor: string;
  accentClass: string;
  borderActiveClass: string;
  icon: ElementType;
  delay: number;
  onStart: () => void;
}) {
  const [completed, setCompleted] = useState(() => loadCompletion(program));

  useEffect(() => {
    const handler = () => setCompleted(loadCompletion(program));
    window.addEventListener(`tl_routine_${program}_done`, handler);
    return () => window.removeEventListener(`tl_routine_${program}_done`, handler);
  }, [program]);

  const totalMinutes = program === "morning" ? 25 : 30;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 26 }}
      className={`relative rounded-3xl border overflow-hidden flex flex-col ${
        isActive ? borderActiveClass : "border-border/35"
      }`}
      style={isActive ? { boxShadow: `0 0 60px -12px ${accentColor}25` } : {}}
    >
      {/* Glow */}
      {isActive && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 80% 45% at 50% 0%, ${accentColor}0c 0%, transparent 70%)` }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl ${accentClass} flex items-center justify-center shrink-0`}>
            <CardIcon className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-xl font-mono tracking-tight">{label}</h3>
              {isActive && !completed && (
                <motion.span
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest"
                  style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                >
                  Attivo ora
                </motion.span>
              )}
              {completed && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest bg-primary/15 text-primary">
                  ✓ Completato
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground/55 mt-0.5">
              {timeLabel} · ~{totalMinutes} min
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted-foreground/65 leading-relaxed">{description}</p>

        {/* Step pills */}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {steps.filter((s) => s.type !== "complete").map((s, i) => {
            const StepIcon = s.icon;
            return (
              <div
                key={i}
                className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/25 bg-card/30 text-[10px] text-muted-foreground/50"
              >
                <StepIcon className="w-2.5 h-2.5" />
                {s.title}
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA */}
      <div className="relative z-10 px-5 sm:px-6 pb-5 sm:pb-6 mt-auto">
        {completed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-primary/80">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="font-semibold">{uiText("auto.ui.15d05cfce6")}</span>
            </div>
            <button
              onClick={() => {
                localStorage.removeItem(`tl_session_${program}_v2`);
                setCompleted(false);
              }}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Riavvia
            </button>
          </div>
        ) : (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm text-white transition-all"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              boxShadow: `0 4px 20px ${accentColor}30`,
            }}
          >
            <Play className="w-4 h-4" />
            Inizia {program === "morning" ? "programma mattutino" : "programma serale"}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
