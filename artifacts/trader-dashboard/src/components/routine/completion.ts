import { appendRoutineCompletion } from "@/pages/Routine.storage";
import type { Program, Answers } from "./types";

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function loadCompletion(p: Program): boolean {
  try {
    const raw = localStorage.getItem(`tl_session_${p}_v2`);
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
  } = {},
) {
  if (options.markDailyProgram !== false) {
    localStorage.setItem(
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
  });
}
