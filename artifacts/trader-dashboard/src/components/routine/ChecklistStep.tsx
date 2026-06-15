import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import type { Answers } from "./types";

const CHECKLIST_ITEMS = [
  { id: "trend",    label: "Ho analizzato il trend principale su D1/H4" },
  { id: "setup",    label: "C'è un setup valido secondo le mie regole" },
  { id: "sltp",     label: "Ho identificato SL e TP con chiarezza" },
  { id: "risk",     label: "Il rischio è entro il mio limite (max 1-2%)" },
  { id: "events",   label: "Nessun evento macro imminente ad alto impatto" },
  { id: "emotion",  label: "Sono in uno stato emotivo equilibrato" },
];

export function ChecklistStep({
  answers, onChange,
}: {
  answers: Answers; onChange: (a: Answers) => void;
}) {
  const checked = (answers.checklist as string[] | undefined) ?? [];

  const toggle = (id: string) => {
    const next = checked.includes(id)
      ? checked.filter((c) => c !== id)
      : [...checked, id];
    onChange({ ...answers, checklist: next });
  };

  return (
    <div className="flex flex-col gap-2.5 w-full max-w-lg mx-auto">
      {CHECKLIST_ITEMS.map((item, i) => {
        const isChecked = checked.includes(item.id);
        return (
          <motion.button
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 380, damping: 28 }}
            onClick={() => toggle(item.id)}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all duration-200 ${
              isChecked
                ? "border-primary/40 bg-primary/8"
                : "border-border/40 bg-card/40 hover:border-border/70"
            }`}
            whileTap={{ scale: 0.98 }}
          >
            <div
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                isChecked ? "border-primary bg-primary" : "border-border/50"
              }`}
            >
              <AnimatePresence>
                {isChecked && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 20 }}
                  >
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <span
              className={`text-sm font-medium transition-all duration-200 ${
                isChecked ? "line-through text-muted-foreground/40" : "text-foreground"
              }`}
            >
              {item.label}
            </span>
          </motion.button>
        );
      })}
      <p className="text-center text-xs text-muted-foreground/40 mt-1">
        {checked.length}/{CHECKLIST_ITEMS.length} confermati
      </p>
    </div>
  );
}
