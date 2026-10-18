import { checklistDay } from "@/lib/dailyChecklist";
import type { AccountStorage } from "@/lib/accountStorage";
import { appendRoutineCompletion } from "@/pages/Routine.storage";
import type { Program, Answers } from "./types";

export function todayKey() {
  return checklistDay();
}

export function loadCompletion(p: Program, storage?: AccountStorage): boolean {
  try {
    const raw = storage?.getItem(`tl_session_${p}_v2`);
    if (!raw) return false;
    const { date } = JSON.parse(raw) as { date: string };
    return date === todayKey();
  } catch {
    return false;
  }
}

export function saveRoutineCompletion(
  p: Program,
  answers: Answers,
  options: {
    routineId?: string;
    routineTitle?: string;
    markDailyProgram?: boolean;
    storage?: AccountStorage;
  } = {},
) {
  try {
  if (options.markDailyProgram !== false) {
    options.storage?.setItem(
      `tl_session_${p}_v2`,
      JSON.stringify({ date: todayKey(), answers }),
    );
  }

  appendRoutineCompletion({
    routineId: options.routineId ?? p,
    routineTitle:
      options.routineTitle ??
      (p === "morning" ? "Programma Mattutino" : "Programma Serale"),
    template: p,
    answers,
  }, options.storage);
  } catch { /* Server confirmation is authoritative; this browser cache is optional. */ }
}
