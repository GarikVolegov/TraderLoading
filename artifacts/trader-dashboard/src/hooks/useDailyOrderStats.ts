import { useState, useEffect, useCallback } from "react";
import { fetchRoutineHistory, type RoutineHistoryStats, type RoutineHistoryEntry } from "@/lib/routineApi";
import { useRoutineStorage } from "@/hooks/useRoutineStorage";
import { loadRoutineCompletions, getRoutineMetrics } from "@/pages/Routine.storage";
import { checklistDay } from "@/lib/dailyChecklist";

export function useDailyOrderStats() {
  const storage = useRoutineStorage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RoutineHistoryStats>(() => {
    const local = loadRoutineCompletions(storage);
    const m = getRoutineMetrics(local, []);
    const morningCount = local.filter((c) => c.template === "morning").length;
    const eveningCount = local.filter((c) => c.template === "evening").length;
    return {
      currentStreakDays: m.currentStreakDays,
      longestStreakDays: m.currentStreakDays,
      totalCompletions: m.totalCompletions,
      morningCount,
      eveningCount,
      adherenceRate30d: m.totalCompletions > 0 ? Math.min(100, Math.round((local.length / 30) * 100)) : 0,
      avgQualityScore: 90,
      history: local.map((c, i) => ({
        id: i + 1,
        routineId: c.routineId,
        routineTitle: c.routineTitle,
        template: c.template,
        qualityScore: 90,
        answers: c.answers ?? {},
        completionDate: c.date,
        completedAt: c.completedAt,
      })),
    };
  });

  const refresh = useCallback(async () => {
    try {
      const serverStats = await fetchRoutineHistory();
      if (serverStats && typeof serverStats.currentStreakDays === "number") {
        setStats(serverStats);
      }
    } catch {
      // Fallback a localStorage
      const local = loadRoutineCompletions(storage);
      const m = getRoutineMetrics(local, []);
      const morningCount = local.filter((c) => c.template === "morning").length;
      const eveningCount = local.filter((c) => c.template === "evening").length;
      setStats({
        currentStreakDays: m.currentStreakDays,
        longestStreakDays: m.currentStreakDays,
        totalCompletions: m.totalCompletions,
        morningCount,
        eveningCount,
        adherenceRate30d: m.totalCompletions > 0 ? Math.min(100, Math.round((local.length / 30) * 100)) : 0,
        avgQualityScore: 90,
        history: local.map((c, i) => ({
          id: i + 1,
          routineId: c.routineId,
          routineTitle: c.routineTitle,
          template: c.template,
          qualityScore: 90,
          answers: c.answers ?? {},
          completionDate: c.date,
          completedAt: c.completedAt,
        })),
      });
    } finally {
      setLoading(false);
    }
  }, [storage]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 60_000);
    window.addEventListener("tl_routine_history_updated", refresh);
    window.addEventListener("tl_routine_morning_done", refresh);
    window.addEventListener("tl_routine_evening_done", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("tl_routine_history_updated", refresh);
      window.removeEventListener("tl_routine_morning_done", refresh);
      window.removeEventListener("tl_routine_evening_done", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  const today = checklistDay();
  const isMorningDoneToday = stats.history.some(
    (h) => h.completionDate === today && h.template === "morning",
  );
  const isEveningDoneToday = stats.history.some(
    (h) => h.completionDate === today && h.template === "evening",
  );

  return {
    stats,
    loading,
    refresh,
    isMorningDoneToday,
    isEveningDoneToday,
  };
}
