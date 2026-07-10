import { useState, useEffect, type ElementType } from "react";
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { CheckCircle2, RotateCcw, Play } from "lucide-react";
import type { Program } from "./types";
import { loadCompletion } from "./completion";

export function ProgramCard({
  program,
  label,
  timeLabel,
  description,
  totalSteps,
  isActive,
  accentColor,
  accentClass,
  icon: CardIcon,
  delay,
  onStart,
}: {
  program: Program;
  label: string;
  timeLabel: string;
  description: string;
  totalSteps: number;
  isActive: boolean;
  accentColor: string;
  accentClass: string;
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 260, damping: 26 }}
      className="flex flex-col gap-3.5 rounded-3xl border border-border/35 p-5"
      style={isActive ? { borderColor: `${accentColor}4d` } : {}}
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accentClass}`}>
          <CardIcon className="h-5.5 w-5.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-base font-bold tracking-tight">{label}</p>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground/60">{timeLabel}</p>
        </div>
        {isActive && !completed && (
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          >
            Attiva
          </span>
        )}
      </div>

      <p className="text-sm leading-relaxed text-muted-foreground/65">{description}</p>

      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground/50">{totalSteps} step</span>
        {completed ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-primary/80">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              {uiText("auto.ui.15d05cfce6")}
            </span>
            <button
              onClick={() => {
                localStorage.removeItem(`tl_session_${program}_v2`);
                setCompleted(false);
              }}
              className="flex items-center gap-1 text-[11px] text-muted-foreground/35 transition-colors hover:text-muted-foreground/60"
            >
              <RotateCcw className="h-3 w-3" />
              Riavvia
            </button>
          </div>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white transition-transform active:scale-[0.98]"
            style={{ backgroundColor: accentColor }}
          >
            <Play className="h-3.5 w-3.5" />
            Inizia
          </button>
        )}
      </div>
    </motion.div>
  );
}
