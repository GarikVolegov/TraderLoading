import { motion } from "framer-motion";
import { Star, Target, Flame } from "lucide-react";
import type { Answers } from "./types";

export function GoalsStep({ answers, onChange }: { answers: Answers; onChange: (a: Answers) => void }) {
  const goals = (answers.goals as Record<string, string> | undefined) ?? {};

  const set = (k: string, v: string) =>
    onChange({ ...answers, goals: { ...goals, [k]: v } });

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg mx-auto">
      {[
        { key: "target",   label: "Target pip giornaliero",      placeholder: "es. 30 pips", icon: Target },
        { key: "maxloss",  label: "Perdita massima accettabile",  placeholder: "es. 1% del conto", icon: Flame },
        { key: "focus",    label: "Pair o mercato di focus",      placeholder: "es. EUR/USD, XAU/USD", icon: Star },
      ].map(({ key, label, placeholder, icon: Icon }, i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex flex-col gap-1.5"
        >
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
            <Icon className="w-3.5 h-3.5 text-primary/60" />
            {label}
          </label>
          <input
            type="text"
            value={goals[key] ?? ""}
            onChange={(e) => set(key, e.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-border/50 bg-card/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all font-mono"
          />
        </motion.div>
      ))}
    </div>
  );
}
