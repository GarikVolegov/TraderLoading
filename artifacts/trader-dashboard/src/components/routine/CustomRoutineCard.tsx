import { motion } from "framer-motion";
import { getRoutineMetrics, type CustomRoutine } from "@/pages/Routine.storage";
import { Sunrise, Moon, Play } from "lucide-react";

export function CustomRoutineCard({
  routine,
  metric,
  onStart,
}: {
  routine: CustomRoutine;
  metric?: ReturnType<typeof getRoutineMetrics>["byRoutine"][number];
  onStart: () => void;
}) {
  const isMorning = routine.template === "morning";
  const accentColor = isMorning ? "#f59e0b" : "#818cf8";
  const Icon = isMorning ? Sunrise : Moon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-3xl border border-border/30 bg-card/30"
    >
      <div className="h-0.75 w-full" style={{ backgroundColor: accentColor }} />
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{routine.title}</p>
            <p className="mt-1 text-xs text-muted-foreground/50">
              {routine.timeLabel} · {isMorning ? "mattutina" : "serale"} · {metric?.completions ?? 0} completamenti
            </p>
          </div>
        </div>
        {routine.description && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground/60">{routine.description}</p>
        )}
        <button
          type="button"
          onClick={onStart}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white transition-transform active:scale-[0.98]"
          style={{ backgroundColor: accentColor }}
        >
          <Play className="h-4 w-4" />
          Avvia routine
        </button>
      </div>
    </motion.div>
  );
}
