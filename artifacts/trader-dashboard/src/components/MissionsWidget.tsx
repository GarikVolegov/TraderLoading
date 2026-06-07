import { useQueryClient } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import { CheckCircle2, Circle, Target, Zap, ChevronRight, CalendarPlus, ArrowRight, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  useGetMissions, useCompleteMission,
  getGetMissionsQueryKey, getGetProfileQueryKey,
  type Mission,
} from "@workspace/api-client-react";
import { downloadICS } from "@/utils/icsExport";
import { useLanguage } from "@/contexts/LanguageContext";

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

export function MissionsWidget() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: missions, isLoading } = useGetMissions();

  const completeMutation = useCompleteMission({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getGetMissionsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        toast({
          title: t("missions.completed_toast"),
          description: t("missions.xp_earned", { xp: data.mission.xpReward }),
          className: "bg-card border-primary text-foreground",
        });
        if (data.levelUp) {
          const end = Date.now() + 3000;
          const frame = () => {
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#22c55e","#3b82f6","#10b981"] });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#22c55e","#3b82f6","#10b981"] });
            if (Date.now() < end) requestAnimationFrame(frame);
          };
          frame();
          toast({
            title: t("missions.level_up"),
            description: t("missions.level_up_desc", { level: data.profile.level }),
            className: "bg-primary text-primary-foreground border-none shadow-[0_0_30px_rgba(34,197,94,0.5)] font-bold",
            duration: 6000,
          });
        }
      }
    }
  });

  const completed = missions?.filter(m => m.completed) ?? [];
  const pending   = missions?.filter(m => !m.completed) ?? [];
  const totalXp   = completed.reduce((s, m) => s + m.xpReward, 0);
  const totalPossible = missions?.reduce((s, m) => s + m.xpReward, 0) ?? 0;
  const progress  = totalPossible > 0 ? (totalXp / totalPossible) * 100 : 0;

  return (
    <Card className="overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/25">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-bold font-mono tracking-tight">{t("missions.title")}</p>
            <p className="text-[10px] text-muted-foreground/50">
              {completed.length}/{(missions?.length ?? 0)} completate
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
          <Zap className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-primary font-mono">+{totalXp} XP</span>
        </div>
      </div>

      {/* XP progress bar */}
      {missions && missions.length > 0 && (
        <div className="px-4 pt-2.5 pb-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Progresso XP</span>
            <span className="text-[9px] text-muted-foreground/60 font-mono">{totalXp}/{totalPossible}</span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <CardContent className="p-0 flex-1">
        {isLoading && (
          <div className="p-6 flex justify-center">
            <div className="w-7 h-7 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {!isLoading && (!missions || missions.length === 0) && (
          <Link href="/settings">
            <div className="px-4 py-4 flex items-center gap-3 text-muted-foreground hover:text-foreground hover:bg-secondary/20 transition-colors cursor-pointer group">
              <Settings className="w-4 h-4 opacity-40 group-hover:opacity-70 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{t("missions.empty")}</p>
                <span className="text-xs flex items-center gap-1 text-primary mt-0.5">
                  {t("missions.empty_link")} <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        )}

        {missions && missions.length > 0 && (
          <div className="divide-y divide-border/25">
            <AnimatePresence initial={false}>
              {[...pending, ...completed].map((mission, idx) => (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: mission.completed ? 0.55 : 1, x: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.25 }}
                  className={`px-4 py-3 flex items-center gap-3 hover:bg-secondary/15 transition-colors ${mission.completed ? "grayscale" : ""}`}
                >
                  {/* Status icon */}
                  <button
                    onClick={() => !mission.completed && completeMutation.mutate({ id: mission.id })}
                    disabled={mission.completed || completeMutation.isPending}
                    className="shrink-0 transition-transform active:scale-90"
                  >
                    {mission.completed
                      ? <CheckCircle2 className="w-5 h-5 text-primary" />
                      : <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-primary/60 transition-colors" />
                    }
                  </button>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold leading-snug truncate ${mission.completed ? "line-through text-muted-foreground" : ""}`}>
                      {mission.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 leading-snug truncate mt-0.5">
                      {mission.description}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold font-mono text-accent/80 bg-secondary/50 px-1.5 py-0.5 rounded-md border border-border/30">
                      {mission.xpReward}xp
                    </span>
                    <button
                      onClick={() => exportMissionToCalendar(mission)}
                      className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                      title={t("missions.add_calendar")}
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                    </button>
                    {!mission.completed && (
                      <button
                        onClick={() => completeMutation.mutate({ id: mission.id })}
                        disabled={completeMutation.isPending}
                        className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold transition-all group border border-primary/20 hover:border-primary/35"
                      >
                        {t("missions.complete_button")}
                        <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
