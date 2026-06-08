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
import { cn } from "@/lib/utils";
import { useGetFriends } from "@workspace/api-client-react";
import { saveRoutineCompletion, SessionModal, type Answers } from "@/pages/Routine";
import { getRoutineMetrics, loadCustomRoutines, loadRoutineCompletions } from "@/pages/Routine.storage";
import { recordRoutineCompletion } from "@/lib/routineApi";
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

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 27;
  const circ = 2 * Math.PI * r;
  const pct = done / total;
  const offset = circ * (1 - pct);
  const color = done === total ? "#58f58b" : done > 0 ? "#ffb36a" : "hsl(var(--border))";

  return (
    <div className="relative h-[4.25rem] w-[4.25rem] shrink-0">
      <svg className="h-[4.25rem] w-[4.25rem] -rotate-90" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r={r} fill="none" stroke="hsl(var(--border)/0.45)" strokeWidth="4" />
        <motion.circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          style={{ filter: done > 0 ? `drop-shadow(0 0 4px ${color})` : "none" }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={done}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="font-mono text-base font-bold leading-none tabular-nums"
            style={{ color }}
          >
            {done}/{total}
          </motion.span>
        </AnimatePresence>
        <span className="mt-0.5 text-[0.42rem] font-bold uppercase leading-none tracking-normal text-primary">
          Sessions
        </span>
      </div>
    </div>
  );
}

function SessionRow({
  label,
  icon: Icon,
  color,
  done,
  time,
  onStart,
}: {
  label: string;
  icon: React.ElementType;
  color: string;
  done: boolean;
  time?: string;
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
          "relative flex min-h-[3.65rem] items-center gap-3 overflow-hidden rounded-md border px-3 transition-all duration-200 hover:border-primary/35 hover:bg-secondary/45",
          done ? "border-primary/22 bg-primary/5" : "border-border/35 bg-secondary/32",
        )}
      >
        {done && (
          <div className="absolute inset-y-0 left-0 w-[3px] bg-primary shadow-[0_0_14px_hsl(var(--primary)/0.85)]" />
        )}

        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
          style={{ background: `${color}24`, borderColor: `${color}35` }}
        >
          <Icon className="h-[1.05rem] w-[1.05rem]" style={{ color }} />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-sm font-bold leading-tight"
            style={{ color: done ? "hsl(var(--foreground))" : color }}
          >
            {label}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <span
              className={cn(
                "text-[0.42rem] font-black uppercase leading-none",
                done ? "text-primary" : "text-muted-foreground/65",
              )}
            >
              {done ? "Completed" : "Upcoming"}
            </span>
            {!done && time && (
              <span className="font-mono text-[0.42rem] font-bold uppercase leading-none text-muted-foreground/55">
                {time}
              </span>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/25 text-primary"
            >
              <Check className="h-3 w-3" strokeWidth={4} />
            </motion.div>
          ) : (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/55" />
            </motion.div>
          )}
        </AnimatePresence>
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

        <CardContent className="space-y-3 p-0">
          <div className="flex items-center gap-4 px-5 pb-3 pt-5">
            <ProgressRing done={done} total={2} />

            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-tight tracking-normal text-foreground">Routine</p>
              <p className="mt-2 truncate text-sm leading-tight text-muted-foreground">{statusCopy}</p>
            </div>

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
          </div>

          <div className="space-y-2 px-3">
            <SessionRow
              label="Programma mattutino"
              icon={Sunrise}
              color="#ff9f3d"
              done={morningDone}
              time="08:00 AM"
              onStart={() => startProgram("morning")}
            />
            <SessionRow
              label="Programma serale"
              icon={Moon}
              color="#63f49a"
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
