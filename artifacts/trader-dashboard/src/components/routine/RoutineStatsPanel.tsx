import { motion } from "framer-motion";

export function RoutineStatsPanel({
  streakDays,
  totalCompletions,
  morningCount,
  eveningCount,
}: {
  streakDays: number;
  totalCompletions: number;
  morningCount: number;
  eveningCount: number;
}) {
  const stats = [
    { label: "Streak", value: `${streakDays}g` },
    { label: "Completate", value: String(totalCompletions) },
    { label: "Mattutine", value: String(morningCount) },
    { label: "Serali", value: String(eveningCount) },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.24 }}
      className="rounded-3xl border border-border/30 bg-card/35 p-4 sm:p-5"
    >
      <p className="font-mono text-base font-bold tracking-tight">Le tue statistiche</p>
      <p className="mt-0.5 text-xs text-muted-foreground/50">Costanza nella routine</p>

      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {stats.map(({ label, value }) => (
          <div
            key={label}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl border border-border/40 bg-secondary/55 p-2.5 text-center shadow-[inset_0_1px_0_hsl(var(--foreground)/0.04)]"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/85">{label}</span>
            <span className="font-mono text-lg font-bold tabular-nums tracking-tight">{value}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
