import { motion } from "framer-motion";
import type { Answers } from "./types";

export function ReflectionStep({ answers, onChange }: { answers: Answers; onChange: (a: Answers) => void }) {
  const reflection = (answers.reflection as Record<string, string> | undefined) ?? {};

  const set = (k: string, v: string) =>
    onChange({ ...answers, reflection: { ...reflection, [k]: v } });

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {[
        { key: "good",    label: "Cosa hai fatto bene oggi?",         placeholder: "Sii specifico e generoso con te stesso…" },
        { key: "improve", label: "Cosa faresti diversamente?",        placeholder: "Identifica 1-2 comportamenti concreti…" },
        { key: "lesson",  label: "La lezione principale di oggi:",    placeholder: "Una frase che ricorderai domani…" },
      ].map(({ key, label, placeholder }, i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex flex-col gap-1.5"
        >
          <label className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
            {label}
          </label>
          <textarea
            value={reflection[key] ?? ""}
            onChange={(e) => set(key, e.target.value)}
            rows={2}
            placeholder={placeholder}
            className="w-full rounded-xl border border-border/50 bg-card/60 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </motion.div>
      ))}
    </div>
  );
}
