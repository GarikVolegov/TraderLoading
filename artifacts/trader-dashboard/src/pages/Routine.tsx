import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { getRoutineStartProgram } from "./Routine.helpers";
import { uiText } from "@/contexts/LanguageContext";
import { createCustomRoutine, getRoutineMetrics, loadCustomRoutines, loadRoutineCompletions, type CustomRoutine } from "./Routine.storage";
import { fetchRoutineCompetition, recordRoutineCompletion, routineCompetitionQueryKey, type RoutineCompetitionEntry } from "@/lib/routineApi";
import { Sunrise, Moon, Wind, Smile, Heart, Check, ClipboardCheck } from "lucide-react";
import type { Program, Answers, ActiveRoutineSession } from "@/components/routine/types";
import { saveRoutineCompletion } from "@/components/routine/completion";
import { MORNING_STEPS, EVENING_STEPS } from "@/components/routine/sessionSteps";
import { SessionModal } from "@/components/routine/SessionModal";
import { ProgramCard } from "@/components/routine/ProgramCard";
import { RoutineStatsPanel } from "@/components/routine/RoutineStatsPanel";
import { CreateRoutinePanel } from "@/components/routine/CreateRoutinePanel";
import { CustomRoutineCard } from "@/components/routine/CustomRoutineCard";
import { FriendCompetitionPanel } from "@/components/routine/FriendCompetitionPanel";

// Re-exported for @/pages/Routine consumers (RoutineWidget).
export { SessionModal };

// Re-exported so existing @/pages/Routine consumers (RoutineWidget) keep working.
export type { Program, Answers };
export { saveRoutineCompletion };

// ─── Program step definitions ─────────────────────────────────────────────────


export default function Routine() {
  const queryClient = useQueryClient();
  const [activeSession, setActiveSession] = useState<ActiveRoutineSession | null>(null);
  const [now, setNow] = useState(new Date());
  const [location, setLocation] = useLocation();
  const [customRoutines, setCustomRoutines] = useState<CustomRoutine[]>(() => loadCustomRoutines());
  const [completionHistory, setCompletionHistory] = useState(() => loadRoutineCompletions());
  const [createOpen, setCreateOpen] = useState(false);
  const { data: friendCompetitionRows = [], isLoading: friendCompetitionLoading } = useQuery<RoutineCompetitionEntry[]>({
    queryKey: routineCompetitionQueryKey,
    queryFn: () => fetchRoutineCompetition(),
  });

  const refreshRoutineData = useCallback(() => {
    setCustomRoutines(loadCustomRoutines());
    setCompletionHistory(loadRoutineCompletions());
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    refreshRoutineData();
    window.addEventListener("storage", refreshRoutineData);
    window.addEventListener("tl_routine_history_updated", refreshRoutineData);
    return () => {
      window.removeEventListener("storage", refreshRoutineData);
      window.removeEventListener("tl_routine_history_updated", refreshRoutineData);
    };
  }, [refreshRoutineData]);

  useEffect(() => {
    const requested = getRoutineStartProgram(location) ?? getRoutineStartProgram(window.location.search);
    if (!requested) return;

    setActiveSession({
      program: requested,
      routineId: requested,
      routineTitle: requested === "morning" ? "Programma Mattutino" : "Programma Serale",
      markDailyProgram: true,
    });
    setLocation("/routine", { replace: true });
  }, [location, setLocation]);

  const hour = now.getHours();
  const isMorningActive = hour >= 4 && hour < 13;
  const isEveningActive = hour >= 16 && hour < 24;

  const metrics = getRoutineMetrics(completionHistory, customRoutines);

  const startBaseProgram = (program: Program) => {
    setActiveSession({
      program,
      routineId: program,
      routineTitle: program === "morning" ? "Programma Mattutino" : "Programma Serale",
      markDailyProgram: true,
    });
  };

  const startCustomRoutine = (routine: CustomRoutine) => {
    setActiveSession({
      program: routine.template,
      routineId: routine.id,
      routineTitle: routine.title,
      markDailyProgram: false,
    });
  };

  const handleCreateRoutine = (input: Pick<CustomRoutine, "title" | "description" | "template" | "timeLabel">) => {
    createCustomRoutine(input);
    refreshRoutineData();
    setCreateOpen(false);
  };

  const handleComplete = (session: ActiveRoutineSession, answers: Answers) => {
    saveRoutineCompletion(session.program, answers, {
      routineId: session.routineId,
      routineTitle: session.routineTitle,
      markDailyProgram: session.markDailyProgram,
    });
    void recordRoutineCompletion({
      routineId: session.routineId,
      routineTitle: session.routineTitle,
      template: session.program,
      answers,
    })
      .then(() => queryClient.invalidateQueries({ queryKey: routineCompetitionQueryKey }))
      .catch(() => {});
    window.dispatchEvent(new Event("tl_routine_history_updated"));
    if (session.markDailyProgram) {
      window.dispatchEvent(new Event(`tl_routine_${session.program}_done`));
    }
    refreshRoutineData();
    setActiveSession(null);
  };

  return (
    <>
      <PageLayout>
        <PageHeader
          title={uiText("auto.ui.a984f8837e")}
          subtitle={uiText("auto.ui.63798f6ffe")}
          badge={
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary uppercase tracking-wider">
              Interattivo
            </span>
          }
        />

        {/* Time hero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
          className="flex items-center justify-between px-4 sm:px-5 py-4 rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm"
        >
          <div>
            <p className="font-mono font-bold text-2xl tabular-nums tracking-tight">
              {now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs text-muted-foreground/45 mt-0.5 capitalize">
              {now.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {isMorningActive && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: "#f59e0b15", color: "#f59e0b", border: "1px solid #f59e0b25" }}
              >
                <Sunrise className="w-3.5 h-3.5" />
                Sessione mattutina attiva
              </div>
            )}
            {isEveningActive && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: "#6366f115", color: "#818cf8", border: "1px solid #6366f125" }}
              >
                <Moon className="w-3.5 h-3.5" />
                Sessione serale attiva
              </div>
            )}
            {!isMorningActive && !isEveningActive && (
              <span className="text-xs text-muted-foreground/35 font-mono">{uiText("auto.ui.d23e045373")}</span>
            )}
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2"
        >
          {[
            { icon: Smile,        label: "Quiz emotivo",    desc: "Check-in stato mentale" },
            { icon: Wind,         label: "Respirazione",    desc: "Box breathing guidato" },
            { icon: Heart,        label: "Gratitudine",     desc: "3 prompt riflessivi" },
            { icon: ClipboardCheck, label: "Checklist",     desc: "Conferma criteri trade" },
          ].map(({ icon: Icon, label, desc }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.05 }}
              className="flex flex-col items-center text-center gap-1.5 py-3 px-2 rounded-2xl border border-border/25 bg-card/20"
            >
              <div className="w-8 h-8 rounded-xl bg-primary/8 border border-primary/15 flex items-center justify-center">
                <Icon className="w-4 h-4 text-primary/70" />
              </div>
              <p className="text-xs font-bold">{label}</p>
              <p className="text-[10px] text-muted-foreground/45 leading-tight">{desc}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Program cards */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
          <ProgramCard
            program="morning"
            label="Programma Mattutino"
            timeLabel="05:00 – 13:00"
            description="7 step interattivi per centrare la mente, caricare l'energia e definire il piano prima di aprire i mercati."
            steps={MORNING_STEPS}
            isActive={isMorningActive}
            accentColor="#f59e0b"
            accentClass="bg-amber-500/10 text-amber-400"
            borderActiveClass="border-amber-500/20"
            icon={Sunrise}
            delay={0.14}
            onStart={() => startBaseProgram("morning")}
          />
          <ProgramCard
            program="evening"
            label="Programma Serale"
            timeLabel="17:00 – 23:00"
            description="7 step interattivi per analizzare la sessione, decomprimersi e preparare la mente al riposo e al giorno dopo."
            steps={EVENING_STEPS}
            isActive={isEveningActive}
            accentColor="#818cf8"
            accentClass="bg-indigo-500/10 text-indigo-400"
            borderActiveClass="border-indigo-500/20"
            icon={Moon}
            delay={0.2}
            onStart={() => startBaseProgram("evening")}
          />
        </div>

        <RoutineStatsPanel metrics={metrics} />

        <FriendCompetitionPanel rows={friendCompetitionRows} loading={friendCompetitionLoading} />

        <CreateRoutinePanel
          open={createOpen}
          onToggle={() => setCreateOpen((open) => !open)}
          onCreate={handleCreateRoutine}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {customRoutines.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/30 bg-card/20 p-5 text-sm text-muted-foreground/50 sm:col-span-2 xl:col-span-3">
              Nessuna routine personalizzata salvata. Crea una routine per aggiungerla alla tua libreria.
            </div>
          ) : (
            customRoutines.map((routine) => (
              <CustomRoutineCard
                key={routine.id}
                routine={routine}
                metric={metrics.byRoutine.find((item) => item.routineId === routine.id)}
                onStart={() => startCustomRoutine(routine)}
              />
            ))
          )}
        </div>

        {/* Footer quote */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-sm italic text-muted-foreground/30 pb-4"
        >
          &ldquo;Il trading di successo è il 20% tecnica e l&apos;80% psicologia.&rdquo;
        </motion.p>
      </PageLayout>

      {/* Session modal */}
      <AnimatePresence>
        {activeSession && (
          <SessionModal
            program={activeSession.program}
            onClose={() => setActiveSession(null)}
            onComplete={(answers) => handleComplete(activeSession, answers)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
