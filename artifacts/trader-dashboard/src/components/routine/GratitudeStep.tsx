import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { Heart } from "lucide-react";
import type { Program, Answers } from "./types";

const MORNING_PROMPTS = [
  "Una cosa che mi dà energia stamattina…",
  "Una persona per cui sono grato oggi…",
  "Una qualità di me stesso che apprezzo come trader…",
];

const EVENING_PROMPTS = [
  "Una cosa positiva che è successa oggi nel trading…",
  "Una lezione preziosa che porto con me…",
  "Un progresso — anche piccolo — che ho fatto oggi…",
];

export function GratitudeStep({
  program, answers, onChange,
}: {
  program: Program; answers: Answers; onChange: (a: Answers) => void;
}) {
  const prompts = program === "morning" ? MORNING_PROMPTS : EVENING_PROMPTS;
  const values = (answers.gratitude as string[] | undefined) ?? ["", "", ""];

  const set = (i: number, v: string) => {
    const next = [...values];
    next[i] = v;
    onChange({ ...answers, gratitude: next });
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {prompts.map((prompt, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1, type: "spring", stiffness: 320, damping: 28 }}
          className="flex flex-col gap-2"
        >
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
            <Heart className="w-3.5 h-3.5 text-pink-400" />
            {i + 1}. {prompt}
          </label>
          <textarea
            value={values[i]}
            onChange={(e) => set(i, e.target.value)}
            rows={2}
            placeholder={uiText("auto.ui.c32454a77d")}
            className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </motion.div>
      ))}
    </div>
  );
}
