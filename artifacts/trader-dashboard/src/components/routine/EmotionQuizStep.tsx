import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import type { Program, Answers } from "./types";

const EMOTIONS_MORNING = [
  { id: "anxious",    label: "Ansioso",   emoji: "😰", color: "#ef4444" },
  { id: "tense",      label: "Teso",      emoji: "😤", color: "#f97316" },
  { id: "neutral",    label: "Neutro",    emoji: "😐", color: "#6b7280" },
  { id: "calm",       label: "Calmo",     emoji: "😌", color: "#3b82f6" },
  { id: "confident",  label: "Fiducioso", emoji: "💪", color: "#10b981" },
  { id: "energetic",  label: "Energico",  emoji: "⚡", color: "#f59e0b" },
];

const EMOTIONS_EVENING = [
  { id: "frustrated", label: "Frustrato", emoji: "😤", color: "#ef4444" },
  { id: "tired",      label: "Stanco",    emoji: "😴", color: "#6b7280" },
  { id: "neutral",    label: "Neutro",    emoji: "😐", color: "#6b7280" },
  { id: "satisfied",  label: "Soddisfatto",emoji: "😊",color: "#3b82f6" },
  { id: "happy",      label: "Felice",    emoji: "🎉", color: "#10b981" },
  { id: "proud",      label: "Orgoglioso",emoji: "🏆", color: "#f59e0b" },
];

const EMOTION_ADVICE: Record<string, string> = {
  anxious:    "L'ansia è normale. Respira, segui le regole e riduci il size oggi.",
  tense:      "La tensione può distorcere le decisioni. Vai più piano, size ridotto.",
  neutral:    "Stato ottimale. Mantieni la disciplina e segui il piano.",
  calm:       "Perfetto. La calma è il vantaggio più sottovalutato nel trading.",
  confident:  "Ottimo. Attenzione all'overconfidence — rispetta i limiti.",
  energetic:  "Energia alta. Usa questo stato per la disciplina, non per l'overtrading.",
  frustrated: "Frustrazione visibile. Nessuna operazione prima di sentirti neutro.",
  tired:      "Stanchezza = errori. Valuta una sessione ridotta o un giorno di pausa.",
  satisfied:  "Buon umore. Evita il revenge trading o la compiacenza.",
  happy:      "Ottimo. Ricorda: le emozioni positive portano spesso all'overtrading.",
  proud:      "Meriti ogni successo. Domani riparti dalla disciplina.",
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
    <div className="flex flex-col gap-5 w-full max-w-lg mx-auto">
      <div className="grid grid-cols-3 gap-3">
        {emotions.map((e, i) => (
          <motion.button
            key={e.id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => onChange({ ...answers, emotion: e.id })}
            className={`relative flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border transition-all duration-200 ${
              selected === e.id
                ? "border-2 shadow-lg"
                : "border-border/40 bg-card/40 hover:border-border/70 hover:bg-card/60"
            }`}
            style={selected === e.id ? {
              borderColor: e.color,
              backgroundColor: `${e.color}15`,
              boxShadow: `0 0 20px ${e.color}20`,
            } : {}}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-3xl leading-none">{e.emoji}</span>
            <span
              className="text-xs font-bold"
              style={{ color: selected === e.id ? e.color : undefined }}
            >
              {e.label}
            </span>
            {selected === e.id && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: e.color }}
              >
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </motion.div>
            )}
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {advice && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="px-4 py-3 rounded-xl border border-border/30 bg-card/60 text-sm text-muted-foreground/80 italic text-center"
          >
            {advice}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
