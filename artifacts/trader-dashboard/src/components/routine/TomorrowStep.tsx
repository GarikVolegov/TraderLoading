import { motion } from "framer-motion";
import type { Answers } from "./types";

export function TomorrowStep({ answers, onChange }: { answers: Answers; onChange: (a: Answers) => void }) {
  const tomorrow = (answers.tomorrow as Record<string, string> | undefined) ?? {};

  const set = (k: string, v: string) =>
    onChange({ ...answers, tomorrow: { ...tomorrow, [k]: v } });

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {[
        { key: "pairs",     label: "Pair di focus per domani",           placeholder: "es. EUR/USD, XAU/USD, GBP/JPY" },
        { key: "levels",    label: "Livelli chiave da monitorare",        placeholder: "es. 1.0850 supporto, 2650 resistenza oro" },
        { key: "intention", label: "Intenzione per domani",              placeholder: "es. Seguire il piano senza deviazioni" },
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
            value={tomorrow[key] ?? ""}
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
