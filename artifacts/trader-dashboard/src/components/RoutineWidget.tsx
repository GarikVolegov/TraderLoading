import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Moon,
  Play,
  Sunrise,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WidgetHeader } from "@/components/ui/WidgetHeader";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { cn } from "@/lib/utils";
import { useGetFriends } from "@workspace/api-client-react";
import { saveRoutineCompletion, SessionModal, type Answers } from "@/pages/Routine";
import { getRoutineMetrics, loadCustomRoutines, loadRoutineCompletions } from "@/pages/Routine.storage";
import { recordRoutineCompletion } from "@/lib/routineApi";
import { uiText } from "@/contexts/LanguageContext";
import {
  getNextRoutineProgram,
  getRoutineSocialMetrics,
  getRoutineStatusCopy,
  type RoutineProgram,
} from "./RoutineWidget.helpers";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadDone(program: "morning" | "evening"): boolean {
  try {
    const raw = localStorage.getItem(`tl_session_${program}_v2`);
    if (!raw) return false;
    const { date } = JSON.parse(raw) as { date: string };
    return date === todayKey();
  } catch {
    return false;
  }
}

function SessionRow({
  label,
  icon: Icon,
  colorVar,
  done,
  onStart,
}: {
  label: string;
  icon: React.ElementType;
  colorVar: string;
  done: boolean;
  onStart: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onStart}
      onPointerDown={(event) => event.stopPropagation()}
      className="block w-full text-left"
    >
      <motion.div
        layout
        className={cn(
          "flex min-h-13 items-center gap-3 rounded-md border px-3 py-2 transition-all duration-200 hover:border-primary/35 hover:bg-secondary/45",
          done ? "border-primary/22 bg-primary/5" : "border-border/35 bg-secondary/32",
        )}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
          style={{ background: `hsl(var(--${colorVar}) / 0.14)`, borderColor: `hsl(var(--${colorVar}) / 0.21)` }}
        >
          <Icon className="h-4 w-4" style={{ color: `hsl(var(--${colorVar}))` }} />
        </div>

        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{label}</span>

        {done ? (
          <Check className="h-[1.15rem] w-[1.15rem] shrink-0 text-primary" strokeWidth={3} />
        ) : (
          <span className="shrink-0 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-[0.68rem] font-bold text-primary">
            {uiText("routine.session.start")}
          </span>
        )}
      </motion.div>
    </button>
  );
}

export function RoutineWidget() {
  const [morningDone, setMorningDone] = useState(false);
  const [eveningDone, setEveningDone] = useState(false);
  const [routineStreakDays, setRoutineStreakDays] = useState(0);
  const [activeSession, setActiveSession] = useState<RoutineProgram | null>(null);
  const { data: friends } = useGetFriends();

  const refresh = () => {
    setMorningDone(loadDone("morning"));
    setEveningDone(loadDone("evening"));
    setRoutineStreakDays(getRoutineMetrics(loadRoutineCompletions(), loadCustomRoutines()).currentStreakDays);
  };

  useEffect(() => {
    refresh();
    window.addEventListener("tl_routine_morning_done", refresh);
    window.addEventListener("tl_routine_evening_done", refresh);
    window.addEventListener("tl_routine_history_updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tl_routine_morning_done", refresh);
      window.removeEventListener("tl_routine_evening_done", refresh);
      window.removeEventListener("tl_routine_history_updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const done = (morningDone ? 1 : 0) + (eveningDone ? 1 : 0);
  const bothDone = done === 2;
  const statusCopy = getRoutineStatusCopy(done);
  const nextProgram = getNextRoutineProgram(morningDone, eveningDone);
  const { activeChallengeFriends } = getRoutineSocialMetrics(friends);

  const startProgram = (program: RoutineProgram) => {
    setActiveSession(program);
  };

  const handleSessionComplete = (program: RoutineProgram, answers: Answers) => {
    saveRoutineCompletion(program, answers);
    void recordRoutineCompletion({
      routineId: program,
      routineTitle: program === "morning" ? "Programma Mattutino" : "Programma Serale",
      template: program,
      answers,
    }).catch(() => {});
    window.dispatchEvent(new Event("tl_routine_history_updated"));
    window.dispatchEvent(new Event(`tl_routine_${program}_done`));
    setActiveSession(null);
    refresh();
  };

  const ringTone = bothDone ? "success" : "warning";
  const ringValue = (done / 2) * 100;

  const headerAction = (
    <button
      type="button"
      onClick={() => nextProgram && startProgram(nextProgram)}
      onPointerDown={(event) => event.stopPropagation()}
      disabled={!nextProgram}
      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-black text-primary transition-colors hover:text-primary/80 disabled:cursor-default disabled:text-muted-foreground/55"
    >
      {!bothDone && <Play className="h-3 w-3 fill-current" />}
      {bothDone ? "Completate" : "Inizia"}
      {!bothDone && <ChevronRight className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="space-y-3">
      <Card className="relative overflow-hidden">
        <AnimatePresence>
          {bothDone && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0"
              style={{
                background: "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary)/0.06) 0%, transparent 70%)",
              }}
            />
          )}
        </AnimatePresence>

        <WidgetHeader
          icon={<Sunrise className="h-4 w-4" />}
          iconTone="warning"
          title={uiText("auto.ui.482273d7cc")}
          subtitle={statusCopy}
          action={headerAction}
        />

        <CardContent className="space-y-3 p-0">
          <div className="flex items-center gap-4 px-5 pb-3">
            <ProgressRing value={ringValue} size={58} stroke={6} tone={ringTone}>
              <span
                className="font-mono text-sm font-bold leading-none tabular-nums"
                style={{ color: bothDone ? "hsl(var(--success))" : done > 0 ? "hsl(var(--warning))" : "hsl(var(--foreground))" }}
              >
                {done}/2
              </span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{uiText("routine.discipline.title")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{uiText("routine.discipline.subtitle")}</p>
            </div>
          </div>

          <div className="space-y-2 px-3 pb-3">
            <SessionRow
              label={uiText("routine.session.morning")}
              icon={Sunrise}
              colorVar="warning"
              done={morningDone}
              onStart={() => startProgram("morning")}
            />
            <SessionRow
              label={uiText("routine.session.evening")}
              icon={Moon}
              colorVar="success"
              done={eveningDone}
              onStart={() => startProgram("evening")}
            />
          </div>

          <div className="flex items-center justify-between border-t border-border/35 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex -space-x-2">
                <div className="h-5 w-5 rounded-full bg-muted" />
                <div className="h-5 w-5 rounded-full bg-muted-foreground/45" />
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <Users className="h-3.5 w-3.5 text-primary sm:hidden" />
                <span className="truncate text-xs font-semibold text-muted-foreground">
                  {activeChallengeFriends} amici in sfida attivi
                </span>
              </div>
            </div>
            <span className="shrink-0 font-mono text-[0.62rem] font-black uppercase tracking-normal text-muted-foreground">
              Streak: {routineStreakDays} {routineStreakDays === 1 ? "giorno" : "giorni"}
            </span>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {activeSession && (
          <SessionModal
            program={activeSession}
            onClose={() => setActiveSession(null)}
            onComplete={(answers) => handleSessionComplete(activeSession, answers)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
