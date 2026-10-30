import { readRoutineDraft } from "@/lib/routineDraft";
import { useRoutineStorage } from "@/hooks/useRoutineStorage";
import { useState, useEffect, type ElementType } from "react";
import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { CheckCircle2, RotateCcw, ArrowRight, ShieldCheck } from "lucide-react";
import type { Program } from "./types";
import { loadCompletion } from "./completion";

export function ProgramCard({
  program,
  label,
  timeLabel,
  description,
  totalSteps,
  isActive,
  accentColor: _accentColor,
  accentClass: _accentClass,
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
  const storage = useRoutineStorage();
  const [completed, setCompleted] = useState(() => loadCompletion(program, storage));

  useEffect(() => {
    const handler = () => setCompleted(loadCompletion(program, storage));
    handler();
    const timer = window.setInterval(handler, 30_000);
    window.addEventListener(`tl_routine_${program}_done`, handler);
    return () => {
      clearInterval(timer);
      window.removeEventListener(`tl_routine_${program}_done`, handler);
    };
  }, [program, storage]);

  const stepList = program === "morning"
    ? [
        "1. Check-in Tensione Bio-Emotiva",
        "2. Respirazione Quadrata di Centratura",
        "3. Dichiarazione delle Regole Inviolabili",
        "4. Visualizzazione Chirurgica dello Scenario",
        "5. Sigillo di Conformità al Varco",
      ]
    : [
        "1. Verifica della Deriva & Disciplina",
        "2. Decompressione Neurale Cadenzata (4-7-8)",
        "3. Tre Insegnamenti de Il Libro della Verità",
        "4. Confessione & Analisi Onesta della Seduta",
        "5. Sigillo di Chiusura & Riposo Disciplinato",
      ];

  const hasDraft = Boolean(readRoutineDraft(storage, program, totalSteps));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: "easeOut" }}
      className={`group relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 ${
        completed
          ? "border-emerald-500/35 bg-gradient-to-b from-[#0a120e]/90 via-[#090e0c]/85 to-[#07080b]/95 shadow-[0_4px_24px_rgba(16,185,129,0.08)]"
          : isActive
          ? "border-[#C5A059]/45 bg-gradient-to-b from-[#11141d]/95 via-[#0d1017]/90 to-[#07080b]/95 shadow-[0_4px_24px_rgba(197,160,89,0.12)]"
          : "border-[#C5A059]/20 bg-gradient-to-b from-[#0e1118]/85 via-[#0b0d13]/80 to-[#07080b]/95"
      }`}
    >
      {/* Hairline aureo superiore */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/35 to-transparent" />

      <div>
        {/* Header della Card: Icona, Titolo, Finestra CET & Status Chip */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#C5A059]/35 bg-[#C5A059]/10 text-[#E8C56A] shadow-[0_0_12px_rgba(197,160,89,0.15)]">
              <CardIcon className="h-5.5 w-5.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm sm:text-base font-bold uppercase tracking-wide text-foreground leading-snug">
                {label}
              </p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-[#C5A059]/80 whitespace-nowrap">
                {timeLabel} CET
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {completed ? (
              <span className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-400 whitespace-nowrap">
                <ShieldCheck className="h-3 w-3" />
                SIGILLATO
              </span>
            ) : isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded border border-[#C5A059]/40 bg-[#C5A059]/15 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-[#E8C56A] whitespace-nowrap">
                <span className="h-1.5 w-1.5 rounded-full bg-[#E8C56A] animate-pulse" />
                FINESTRA APERTA
              </span>
            ) : (
              <span className="inline-flex items-center rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                IN ATTESA
              </span>
            )}
          </div>
        </div>

        {/* Descrizione Solenne */}
        <p className="mt-3.5 text-xs leading-relaxed text-muted-foreground/80">
          {description}
        </p>

        {/* Sequenza dei 5 step d'ordine */}
        <div className="mt-4 space-y-1.5 rounded-xl border border-white/5 bg-black/40 p-3">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
            <span>Sequenza Operativa</span>
            <span className="whitespace-nowrap font-bold text-[#E8C56A]">{totalSteps} Step</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {stepList.map((step, idx) => (
              <span
                key={idx}
                className="font-mono text-[10px] text-slate-300/80 truncate flex items-center gap-1.5"
              >
                <span className="h-1 w-1 rounded-full bg-[#C5A059]/60 shrink-0" />
                {step}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer della Card: Azione o Stato di Completamento */}
      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-white/5 pt-3">
        <span className="font-mono text-[10.5px] font-semibold text-muted-foreground/70">
          {completed ? "Protocollo archiviato per oggi" : "Esecuzione richiesta dal Protocollo"}
        </span>

        {completed ? (
          <div className="flex items-center justify-end gap-2">
            <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-400 whitespace-nowrap">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {uiText("auto.ui.15d05cfce6")}
            </span>
            <button
              type="button"
              onClick={() => {
                storage?.removeItem(`tl_session_${program}_v2`);
                setCompleted(false);
                window.dispatchEvent(new Event(`tl_routine_${program}_done`));
              }}
              className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:border-[#C5A059]/40 hover:text-[#E8C56A] cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="h-3 w-3" />
              Riavvia
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onStart}
            className="group/btn inline-flex items-center justify-center gap-2 rounded-lg border border-[#C5A059]/60 bg-gradient-to-r from-[#C5A059] via-[#D4AF37] to-[#B38F44] px-4 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-black shadow-[0_0_16px_rgba(197,160,89,0.22)] transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer whitespace-nowrap"
          >
            <span>{hasDraft ? uiText("routine.save.resume") : "Apri Protocollo"}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
