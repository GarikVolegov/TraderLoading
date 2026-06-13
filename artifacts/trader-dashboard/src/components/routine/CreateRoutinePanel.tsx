import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import type { CustomRoutine } from "@/pages/Routine.storage";
import { Check, Plus } from "lucide-react";
import type { Program } from "./types";

export function CreateRoutinePanel({
  open,
  onToggle,
  onCreate,
}: {
  open: boolean;
  onToggle: () => void;
  onCreate: (input: Pick<CustomRoutine, "title" | "description" | "template" | "timeLabel">) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [template, setTemplate] = useState<Program>("morning");
  const [timeLabel, setTimeLabel] = useState("");
  const canCreate = title.trim().length >= 3;

  const submit = () => {
    if (!canCreate) return;
    onCreate({
      title,
      description,
      template,
      timeLabel: timeLabel || (template === "morning" ? "Mattina" : "Sera"),
    });
    setTitle("");
    setDescription("");
    setTemplate("morning");
    setTimeLabel("");
  };

  return (
    <div className="rounded-3xl border border-border/30 bg-card/35 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">{uiText("auto.ui.b3be33fc49")}</p>
          <h2 className="mt-1 text-xl font-bold font-mono tracking-tight">{uiText("auto.ui.0619dc0d1f")}</h2>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/15"
        >
          <Plus className="h-4 w-4" />
          Crea routine
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 grid gap-3 rounded-2xl border border-border/25 bg-background/25 p-3 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/55">{uiText("auto.ui.13030dd962")}</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder={uiText("auto.ui.0f3c4e89d3")}
                  className="h-10 w-full rounded-xl border border-border/35 bg-background/40 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/35 focus:border-primary/45"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/55">{uiText("auto.ui.9386b1dfe1")}</span>
                <input
                  value={timeLabel}
                  onChange={(event) => setTimeLabel(event.target.value)}
                  placeholder={uiText("auto.ui.269ebe5fdb")}
                  className="h-10 w-full rounded-xl border border-border/35 bg-background/40 px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/35 focus:border-primary/45"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/55">{uiText("auto.ui.077fe9c54e")}</span>
                <select
                  value={template}
                  onChange={(event) => setTemplate(event.target.value as Program)}
                  className="h-10 w-full rounded-xl border border-border/35 bg-background/40 px-3 text-sm outline-none transition-colors focus:border-primary/45"
                >
                  <option value="morning">{uiText("auto.ui.afa4f508d2")}</option>
                  <option value="evening">{uiText("auto.ui.61246e3a00")}</option>
                </select>
              </label>
              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/55">{uiText("auto.ui.07dfa30eec")}</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={uiText("auto.ui.02b595a212")}
                  className="min-h-20 w-full resize-none rounded-xl border border-border/35 bg-background/40 px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground/35 focus:border-primary/45"
                />
              </label>
              <button
                type="button"
                onClick={submit}
                disabled={!canCreate}
                className="sm:col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity disabled:opacity-40"
              >
                <Check className="h-4 w-4" />
                Salva nuova routine
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
