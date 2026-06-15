import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import { getRoutineMetrics } from "@/pages/Routine.storage";
import { CheckCircle2, Flame, Clock, Layers } from "lucide-react";

function formatRoutineDate(value: string | null): string {
  if (!value) return "Mai";
  try {
    return new Date(value).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Dato non valido";
  }
}

export function RoutineStatsPanel({
  metrics,
}: {
  metrics: ReturnType<typeof getRoutineMetrics>;
}) {
  const stats = [
    { label: "Completamenti", value: metrics.totalCompletions, icon: CheckCircle2, color: "text-primary" },
    { label: "Streak routine", value: `${metrics.currentStreakDays}d`, icon: Flame, color: "text-amber-400" },
    { label: "Routine create", value: metrics.customRoutineCount, icon: Layers, color: "text-sky-300" },
    { label: "Ultima sessione", value: formatRoutineDate(metrics.lastCompletedAt), icon: Clock, color: "text-muted-foreground" },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 }}
      className="rounded-3xl border border-border/30 bg-card/35 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">{uiText("auto.ui.4a1b499566")}</p>
          <h2 className="mt-1 text-xl font-bold font-mono tracking-tight">{uiText("auto.ui.8f36b4e767")}</h2>
        </div>
        <p className="text-xs text-muted-foreground/50">{uiText("auto.ui.1932f475b0")}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-border/25 bg-background/25 p-3">
            <Icon className={`h-4 w-4 ${color}`} />
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/45">{label}</p>
            <p className="mt-1 truncate font-mono text-lg font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border/25">
        {metrics.byRoutine.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground/50">
            Completa una routine per iniziare a vedere le metriche dettagliate.
          </div>
        ) : (
          metrics.byRoutine.map((routine) => (
            <div
              key={routine.routineId}
              className="flex items-center justify-between gap-3 border-b border-border/20 px-4 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{routine.routineTitle}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/45">
                  {routine.template === "morning" ? "Template mattutino" : "Template serale"} · ultima:{" "}
                  {formatRoutineDate(routine.lastCompletedAt)}
                </p>
              </div>
              <div className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary">
                {routine.completions}
              </div>
            </div>
          ))
        )}
      </div>
    </motion.section>
  );
}
