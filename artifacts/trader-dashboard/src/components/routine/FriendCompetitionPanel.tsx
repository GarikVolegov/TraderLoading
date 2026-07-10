import { motion } from "framer-motion";
import { uiText } from "@/contexts/LanguageContext";
import type { RoutineCompetitionEntry } from "@/lib/routineApi";
import { Crown, Trophy, User } from "lucide-react";

const RANK_ACCENT: Record<number, string> = {
  2: "border-slate-300/45 bg-slate-300/15 text-slate-200",
  3: "border-amber-700/45 bg-amber-700/20 text-amber-500",
};

function FriendRankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-yellow-500/45 bg-yellow-500/15 text-yellow-300">
        <Crown className="h-4 w-4" />
      </div>
    );
  }

  const accent = RANK_ACCENT[rank] ?? "border-border/35 bg-background/35 text-muted-foreground";

  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full border ${accent}`}>
      <span className="font-mono text-xs font-bold">#{rank}</span>
    </div>
  );
}

export function FriendCompetitionPanel({
  rows,
  loading,
}: {
  rows: RoutineCompetitionEntry[];
  loading: boolean;
}) {
  const leader = rows[0] ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28 }}
      className="rounded-3xl border border-border/30 bg-card/35 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">{uiText("auto.ui.36d44db864")}</p>
          <h2 className="mt-1 text-xl font-bold font-mono tracking-tight">{uiText("auto.ui.5c594d8d25")}</h2>
        </div>
        <p className="text-xs text-muted-foreground/50">{uiText("auto.ui.e67915b391")}</p>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-2xl border border-border/20 bg-background/25" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border/30 bg-background/20 px-4 py-6 text-sm text-muted-foreground/50">
          Nessun amico in classifica per ora.
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/8 p-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {leader?.isCurrentUser ? "Stai vincendo tu" : `${leader?.name ?? "Un amico"} sta vincendo`}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/55">
                  Score {leader?.score ?? 0} · {leader?.totalCompletions ?? 0} routine · qualità {leader?.avgQualityScore ?? 0}%
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-border/25">
            {rows.slice(0, 6).map((row) => (
              <div
                key={`${row.rank}-${row.userId ?? row.name}`}
                className={`flex items-center gap-3 border-b border-border/20 px-4 py-3 last:border-b-0 ${
                  row.isCurrentUser ? "bg-primary/8" : "bg-background/15"
                }`}
              >
                <FriendRankBadge rank={row.rank} />
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/40 bg-secondary">
                  {row.avatarUrl ? (
                    <img src={row.avatarUrl} alt={row.name} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground/60" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {row.name}
                    {row.isCurrentUser && <span className="ml-1.5 text-[10px] text-primary/80">{uiText("auto.ui.7f73d79689")}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground/50">
                    {row.totalCompletions} routine · streak {row.currentStreakDays}g · qualità {row.avgQualityScore}%
                  </p>
                </div>
                <div className="shrink-0 rounded-full border border-border/30 bg-secondary/55 px-3 py-1 font-mono text-xs font-bold">
                  {row.score} pts
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.section>
  );
}
