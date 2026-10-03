import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { uiText } from "@/contexts/LanguageContext";
import { getRoutineStartProgram } from "./Routine.helpers";
import { getRoutineMetrics, loadRoutineCompletions } from "./Routine.storage";
import { recordRoutineCompletion } from "@/lib/routineApi";
import { Sunrise, Moon } from "lucide-react";
import type { Program, Answers, ActiveRoutineSession } from "@/components/routine/types";
import { saveRoutineCompletion } from "@/components/routine/completion";
import { MORNING_STEPS, EVENING_STEPS } from "@/components/routine/sessionSteps";
import { SessionModal } from "@/components/routine/SessionModal";
import { ProgramCard } from "@/components/routine/ProgramCard";
import { ZenZone } from "@/components/routine/ZenZone";
import { RoutineStatsPanel } from "@/components/routine/RoutineStatsPanel";

// Re-exported for @/pages/Routine consumers (RoutineWidget).
export { SessionModal };
export type { Program, Answers };
export { saveRoutineCompletion };

export default function Routine() {
  const [activeSession, setActiveSession] = useState<ActiveRoutineSession | null>(null);
  const [now, setNow] = useState(new Date());
  const [location, setLocation] = useLocation();
  const [completionHistory, setCompletionHistory] = useState(() => loadRoutineCompletions());

  const refreshRoutineData = useCallback(() => {
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
      routineTitle: requested === "morning" ? uiText("auto.ui.17f5f49624") : uiText("auto.ui.f706ef5c94"),
      markDailyProgram: true,
    });
    setLocation("/routine", { replace: true });
  }, [location, setLocation]);

  const hour = now.getHours();
  const isMorningActive = hour >= 4 && hour < 13;
  const isEveningActive = hour >= 16 && hour < 24;

  const metrics = getRoutineMetrics(completionHistory, []);
  const morningCount = completionHistory.filter((c) => c.template === "morning").length;
  const eveningCount = completionHistory.filter((c) => c.template === "evening").length;

  const startBaseProgram = (program: Program) => {
    setActiveSession({
      program,
      routineId: program,
      routineTitle: program === "morning" ? uiText("auto.ui.17f5f49624") : uiText("auto.ui.f706ef5c94"),
      markDailyProgram: true,
    });
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
    }).catch(() => {});
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
          title={uiText("routine.title")}
          subtitle={uiText("routine.subtitle")}
          badge={
            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary uppercase tracking-wider">
              {uiText("common.interactive")}
            </span>
          }
        />

        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">{uiText("routine.section.guided_programs")}</h2>
          <span className="font-mono text-[11px] text-muted-foreground/60">{uiText("routine.section.guided_programs_count")}</span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5">
          <ProgramCard
            program="morning"
            label={uiText("auto.ui.17f5f49624")}
            timeLabel="05:00 – 13:00"
            description={uiText("auto.ui.560b2184aa")}
            totalSteps={MORNING_STEPS.length}
            isActive={isMorningActive}
            accentColor="#f59e0b"
            accentClass="bg-amber-500/10 text-amber-400"
            icon={Sunrise}
            delay={0.06}
            onStart={() => startBaseProgram("morning")}
          />
          <ProgramCard
            program="evening"
            label={uiText("auto.ui.f706ef5c94")}
            timeLabel="17:00 – 23:00"
            description={uiText("auto.ui.477912a54a")}
            totalSteps={EVENING_STEPS.length}
            isActive={isEveningActive}
            accentColor="#818cf8"
            accentClass="bg-indigo-500/10 text-indigo-400"
            icon={Moon}
            delay={0.12}
            onStart={() => startBaseProgram("evening")}
          />
        </div>

        <ZenZone />

        <RoutineStatsPanel
          streakDays={metrics.currentStreakDays}
          totalCompletions={metrics.totalCompletions}
          morningCount={morningCount}
          eveningCount={eveningCount}
        />

        <p className="text-center text-sm italic text-muted-foreground/30">
          &ldquo;{uiText("auto.ui.b48f2e2158")}&rdquo;
        </p>
      </PageLayout>

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
