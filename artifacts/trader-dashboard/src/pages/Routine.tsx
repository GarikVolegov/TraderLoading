import { useRoutineStorage } from "@/hooks/useRoutineStorage";
import { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useLocation, useSearch } from "wouter";
import { PageLayout } from "@/components/PageLayout";
import { PageHeader } from "@/components/PageHeader";
import { uiText } from "@/contexts/LanguageContext";
import { getRoutineStartProgram } from "./Routine.helpers";
import { recordRoutineCompletion } from "@/lib/routineApi";
import { Sunrise, Moon, Shield } from "lucide-react";
import type { Program, Answers, ActiveRoutineSession } from "@/components/routine/types";
import { saveRoutineCompletion } from "@/components/routine/completion";
import { MORNING_STEPS, EVENING_STEPS } from "@/components/routine/sessionSteps";
import { SessionModal } from "@/components/routine/SessionModal";
import { ProgramCard } from "@/components/routine/ProgramCard";
import { ZenZone } from "@/components/routine/ZenZone";
import { RoutineStatsPanel } from "@/components/routine/RoutineStatsPanel";
import { synestheticConfirm } from "@/lib/soundFx";
import { useDailyOrderStats } from "@/hooks/useDailyOrderStats";

// Re-exported for @/pages/Routine consumers (RoutineWidget).
export { SessionModal };
export type { Program, Answers };
export { saveRoutineCompletion };

export function RoutineWorkspace({ embedded = false }: { embedded?: boolean }) {
  const storage = useRoutineStorage();
  const [activeSession, setActiveSession] = useState<ActiveRoutineSession | null>(null);
  const [now, setNow] = useState(new Date());
  const [location, setLocation] = useLocation();
  const search = useSearch();

  const { stats, refresh: refreshDailyOrderStats } = useDailyOrderStats();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const requested = getRoutineStartProgram(search);
    if (!requested) return;

    setActiveSession({
      program: requested,
      routineId: requested,
      routineTitle: requested === "morning" ? uiText("auto.ui.17f5f49624") : uiText("auto.ui.f706ef5c94"),
      markDailyProgram: true,
    });
    const params = new URLSearchParams(search);
    params.delete("start");
    setLocation(`${location}${params.size ? `?${params.toString()}` : ""}`, { replace: true });
  }, [search, location, setLocation]);

  const hour = now.getHours();
  const isMorningActive = hour >= 4 && hour < 13;
  const isEveningActive = hour >= 16 && hour < 24;

  const startBaseProgram = (program: Program) => {
    setActiveSession({
      program,
      routineId: program,
      routineTitle: program === "morning" ? uiText("auto.ui.17f5f49624") : uiText("auto.ui.f706ef5c94"),
      markDailyProgram: true,
    });
  };

  const handleComplete = async (session: ActiveRoutineSession, answers: Answers) => {
    synestheticConfirm();
    await recordRoutineCompletion({
      routineId: session.routineId,
      routineTitle: session.routineTitle,
      template: session.program,
      answers,
    });
    saveRoutineCompletion(session.program, answers, {
      routineId: session.routineId,
      routineTitle: session.routineTitle,
      markDailyProgram: session.markDailyProgram,
      storage,
    });
    window.dispatchEvent(new Event("tl_routine_history_updated"));
    if (session.markDailyProgram) {
      window.dispatchEvent(new Event(`tl_routine_${session.program}_done`));
    }
    refreshDailyOrderStats();
    setActiveSession(null);
  };

  return (
    <>
      <div className="space-y-5">
        {embedded ? (
          <div className="border-b border-white/5 pb-3">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
              {uiText("routine.title")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground/80 leading-relaxed">
              {uiText("routine.subtitle")}
            </p>
          </div>
        ) : (
          <PageHeader
            title={uiText("routine.title")}
            subtitle={uiText("routine.subtitle")}
            badge={
              <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#C5A059]/35 bg-[#C5A059]/15 text-[#E8C56A] whitespace-nowrap inline-flex items-center gap-1.5 shadow-sm">
                <Shield className="h-3 w-3 text-[#C5A059]" />
                REGOLA D&apos;ORDINE: ATTIVA · ZERO DERIVA
              </span>
            }
          />
        )}

        {/* Intestazione Sezione Protocolli con micro-telemetria */}
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C5A059]" />
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[#F4F4F6]">
              {uiText("routine.section.guided_programs")}
            </h2>
          </div>
          <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-muted-foreground/75 whitespace-nowrap">
            {uiText("routine.section.guided_programs_count")}
          </span>
        </div>

        {/* I Due Protocolli Operativi: Colonne Bilanciate in Altezza */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
          <ProgramCard
            program="morning"
            label={uiText("auto.ui.17f5f49624")}
            timeLabel="05:00 – 13:00"
            description={uiText("auto.ui.560b2184aa")}
            totalSteps={MORNING_STEPS.length}
            isActive={isMorningActive}
            accentColor="#C5A059"
            accentClass="bg-[#C5A059]/10 text-[#E8C56A]"
            icon={Sunrise}
            delay={0.04}
            onStart={() => startBaseProgram("morning")}
          />
          <ProgramCard
            program="evening"
            label={uiText("auto.ui.f706ef5c94")}
            timeLabel="17:00 – 23:00"
            description={uiText("auto.ui.477912a54a")}
            totalSteps={EVENING_STEPS.length}
            isActive={isEveningActive}
            accentColor="#C5A059"
            accentClass="bg-[#C5A059]/10 text-[#E8C56A]"
            icon={Moon}
            delay={0.08}
            onStart={() => startBaseProgram("evening")}
          />
        </div>

        {/* La Centratura Interiore (ex Zona Zen, zero emoji, box breathing & biometria) */}
        <ZenZone />

        {/* Quadro Telemetrico de L'Ordine (Streak, Aderenza 30d, Chronos Heatmap & Correlazione) */}
        <RoutineStatsPanel
          streakDays={stats.currentStreakDays}
          longestStreakDays={stats.longestStreakDays}
          totalCompletions={stats.totalCompletions}
          morningCount={stats.morningCount}
          eveningCount={stats.eveningCount}
          adherenceRate30d={stats.adherenceRate30d}
          avgQualityScore={stats.avgQualityScore}
          history={stats.history}
        />

        {/* Massima Filosofica Stoica AUREUS */}
        <p className="text-center font-mono text-xs italic text-muted-foreground/50 py-2">
          &ldquo;{uiText("auto.ui.b48f2e2158")}&rdquo;
        </p>
      </div>

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

export default function Routine() {
  return <PageLayout><RoutineWorkspace /></PageLayout>;
}
