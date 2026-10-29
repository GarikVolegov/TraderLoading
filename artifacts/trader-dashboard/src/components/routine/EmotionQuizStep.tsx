import { motion, AnimatePresence } from "framer-motion";
import { Check, Flame, ShieldCheck, Crosshair, Zap, Moon, AlertTriangle, Compass, Award, CheckCircle2, type LucideIcon } from "lucide-react";
import type { Program, Answers } from "./types";

interface EmotionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const EMOTIONS_MORNING: EmotionItem[] = [
  { id: "anxious",    label: "Ansioso / Teso",   icon: AlertTriangle, color: "#ef4444" },
  { id: "tense",      label: "Pressione Alta",  icon: Flame,         color: "#f97316" },
  { id: "neutral",    label: "Stato Neutro",    icon: ShieldCheck,   color: "#94a3b8" },
  { id: "calm",       label: "Calma Lucida",    icon: Crosshair,     color: "#10b981" },
  { id: "confident",  label: "Centrato",        icon: Compass,       color: "#3b82f6" },
  { id: "energetic",  label: "Focus Sovrano",   icon: Zap,           color: "#E8C56A" },
];

const EMOTIONS_EVENING: EmotionItem[] = [
  { id: "frustrated", label: "Frustrazione",    icon: AlertTriangle, color: "#ef4444" },
  { id: "tired",      label: "Affaticato",      icon: Moon,          color: "#64748b" },
  { id: "neutral",    label: "Stato Neutro",    icon: ShieldCheck,   color: "#94a3b8" },
  { id: "satisfied",  label: "Disciplinato",    icon: CheckCircle2,  color: "#3b82f6" },
  { id: "happy",      label: "Conforme al Piano", icon: Crosshair,   color: "#10b981" },
  { id: "proud",      label: "Integrità Alta",  icon: Award,         color: "#E8C56A" },
];

const EMOTION_ADVICE: Record<string, string> = {
  anxious:    "Tensione rilevata. Rallenta il ritmo decisionale, riduci il rischio all'1% e attendi conferme multiple.",
  tense:      "Pressione emotiva attiva: proteggi il capitale. Opera solo se il Custode della Soglia è al 100%.",
  neutral:    "Equilibrio operativo ideale. Nessun attaccamento all'esito: esegui solo secondo protocollo.",
  calm:       "Calma lucida. Lo stato più nobile dell'Operatore: attendi impassibile il Sigillo d'Azione.",
  confident:  "Fiducia presente. Mantieni l'umiltà stoica ed evita qualsiasi forma di overconfidence.",
  energetic:  "Focus sovrano. Incanala l'energia nella rigorosa osservanza delle regole de L'Ordine.",
  frustrated: "Frustrazione post-sessione. Nessun revenge trading: decontamina la mente e stacca i grafici.",
  tired:      "Affaticamento cognitivo. La seduta è conclusa: il riposo disciplinato rigenera il giudizio.",
  satisfied:  "Seduta disciplinata. Non cedere alla compiacenza: domani si ricomincia con la stessa sobrietà.",
  happy:      "Piena conformità. Ricorda che la costanza è il risultato della sottomissione al metodo.",
  proud:      "Integrità difesa con onore. Sigilla la sessione ne Il Libro della Verità.",
};

export function EmotionQuizStep({
  program, answers, onChange,
}: {
  program: Program; answers: Answers; onChange: (a: Answers) => void;
}) {
  const emotions = program === "morning" ? EMOTIONS_MORNING : EMOTIONS_EVENING;
  const selected = answers.emotion as string | undefined;
  const advice = selected ? EMOTION_ADVICE[selected] : null;

  return (
    <div className="flex flex-col gap-5 w-full max-w-xl mx-auto">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {emotions.map((e, i) => {
          const isSelected = selected === e.id;
          const EmotionIcon = e.icon;

          return (
            <motion.button
              key={e.id}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
              onClick={() => onChange({ ...answers, emotion: e.id })}
              className={`relative flex flex-col items-center gap-2.5 p-4 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? "border-[#C5A059]/80 bg-[#C5A059]/15 shadow-[0_0_16px_rgba(197,160,89,0.25)]"
                  : "border-white/10 bg-black/40 hover:border-white/20 hover:bg-white/[0.04]"
              }`}
              whileTap={{ scale: 0.97 }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg border transition-transform"
                style={{
                  backgroundColor: `${e.color}18`,
                  borderColor: `${e.color}45`,
                  color: e.color,
                }}
              >
                <EmotionIcon className="h-5 w-5" />
              </div>

              <span
                className={`font-mono text-xs font-bold uppercase tracking-wider text-center ${
                  isSelected ? "text-[#E8C56A]" : "text-muted-foreground/80"
                }`}
              >
                {e.label}
              </span>

              {isSelected && (
                <div
                  className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center bg-[#C5A059] shadow-sm"
                >
                  <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {advice && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="px-4 py-3 rounded-xl border border-[#C5A059]/30 bg-[#0d0f14]/90 text-xs font-mono text-slate-300 leading-relaxed text-center shadow-md"
          >
            <span className="text-[#E8C56A] font-bold mr-1.5 uppercase">Direttiva:</span>
            {advice}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
