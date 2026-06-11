import { useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import {
  Target, Zap, Flame, Trophy, BarChart3,
  CheckCircle2, Circle, ChevronRight, Loader2, CalendarPlus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  useGetMissions, useCompleteMission, useGetProfile,
  getGetMissionsQueryKey, getGetProfileQueryKey,
  type Mission,
} from "@workspace/api-client-react";
import { downloadICS } from "@/utils/icsExport";
import { uiText } from "@/contexts/LanguageContext";

function exportMissionToCalendar(mission: Mission) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  downloadICS(`missione-${mission.id}.ics`, [{
    uid: `mission-${mission.id}-${today.toISOString().slice(0, 10)}@traderloading`,
    summary: `Missione: ${mission.title}`,
    description: mission.description,
    dtstart: start, dtend: end, alarm: 15,
  }]);
}

function StatTile({ icon: Icon, label, value, accent }: {
  icon: React.ElementType; label: string; value: string; accent: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={`h-3.5 w-3.5 ${accent}`} /> {label}
      </div>
      <div className="font-mono text-xl font-bold">{value}</div>
    </div>
  );
}

export default function Missions() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: missions, isLoading } = useGetMissions();
  const { data: profile } = useGetProfile();

  const completeMutation = useCompleteMission({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: getGetMissionsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        toast({ title: "Missione completata", description: `+${data.mission.xpReward} XP` });
        if (data.levelUp) {
          const end = Date.now() + 3000;
          const frame = () => {
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#4ca973", "#3b82f6", "#70c296"] });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#4ca973", "#3b82f6", "#70c296"] });
            if (Date.now() < end) requestAnimationFrame(frame);
          };
          frame();
          toast({
            title: "Level up!",
            description: `Hai raggiunto il livello ${data.profile.level}`,
            className: "bg-primary text-primary-foreground border-none font-bold",
            duration: 6000,
          });
        }
      },
    },
  });

  const completed = missions?.filter((m) => m.completed) ?? [];
  const pending = missions?.filter((m) => !m.completed) ?? [];
  const totalXp = completed.reduce((s, m) => s + m.xpReward, 0);
  const totalPossible = missions?.reduce((s, m) => s + m.xpReward, 0) ?? 0;
  const progress = totalPossible > 0 ? (totalXp / totalPossible) * 100 : 0;

  return (
    <PageLayout>
      <PageHeader
        icon={
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent">
            <Target className="h-4.5 w-4.5" />
          </div>
        }
        title={uiText("auto.ui.0a38d7a6de")}
        subtitle={uiText("auto.ui.41e9873ac5")}
      />

      {/* Profilo / statistiche */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                <span className="text-[9px] uppercase tracking-wider text-primary/70">{uiText("auto.ui.227771829c")}</span>
                <span className="font-mono text-2xl font-bold text-primary">{profile?.level ?? "—"}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold">{profile?.levelName ?? "Trader"}</p>
                <p className="text-xs text-muted-foreground">
                  {profile ? `${profile.xp} XP totali` : "Caricamento…"}
                  {profile?.xpToNextLevel ? ` · ${profile.xpToNextLevel} XP al prossimo livello` : ""}
                </p>
                {profile?.xpToNextLevel ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/50">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
                      style={{ width: `${Math.min(100, (profile.xp / (profile.xp + profile.xpToNextLevel)) * 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <StatTile icon={Flame} label="Streak" value={`${profile?.streak ?? 0}g`} accent="text-orange-400" />
          <StatTile icon={BarChart3} label="Win rate" value={profile?.winRate != null ? `${Math.round(profile.winRate)}%` : "—"} accent="text-green-400" />
          <StatTile icon={Trophy} label="Trade" value={`${profile?.totalTrades ?? 0}`} accent="text-yellow-400" />
        </div>
      </div>

      {/* Progresso XP di oggi */}
      <Card>
        <CardContent className="p-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-bold">
              <Zap className="h-4 w-4 text-primary" /> Progresso di oggi
            </span>
            <span className="font-mono text-xs text-muted-foreground">{totalXp}/{totalPossible} XP · {completed.length}/{missions?.length ?? 0}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary/60">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista missioni */}
      {isLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : !missions || missions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Nessuna missione per oggi. Configura le missioni dalle impostazioni.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border/25">
            <AnimatePresence initial={false}>
              {[...pending, ...completed].map((mission, idx) => (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: mission.completed ? 0.55 : 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  className={`flex items-center gap-3 px-4 py-3.5 hover:bg-secondary/15 ${mission.completed ? "grayscale" : ""}`}
                >
                  <button
                    onClick={() => !mission.completed && completeMutation.mutate({ id: mission.id })}
                    disabled={mission.completed || completeMutation.isPending}
                    className="shrink-0 transition-transform active:scale-90"
                  >
                    {mission.completed
                      ? <CheckCircle2 className="h-5 w-5 text-primary" />
                      : <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-primary/60" />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold leading-snug ${mission.completed ? "text-muted-foreground line-through" : ""}`}>
                      {mission.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-snug text-muted-foreground/60">{mission.description}</p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-md border border-border/30 bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-accent/80">
                      {mission.xpReward}xp
                    </span>
                    <button
                      onClick={() => exportMissionToCalendar(mission)}
                      className="rounded-lg p-1 text-muted-foreground/40 transition-colors hover:bg-secondary/50 hover:text-muted-foreground"
                      title={uiText("auto.ui.89d9091dcd")}
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                    </button>
                    {!mission.completed && (
                      <button
                        onClick={() => completeMutation.mutate({ id: mission.id })}
                        disabled={completeMutation.isPending}
                        className="group flex items-center gap-0.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary transition-all hover:border-primary/35 hover:bg-primary/20"
                      >
                        Completa
                        <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>
      )}
    </PageLayout>
  );
}
