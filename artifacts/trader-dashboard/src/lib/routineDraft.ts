import { checklistDay } from "./dailyChecklist";
import type { AccountStorage } from "./accountStorage";
export interface RoutineDraft { day: string; stepIdx: number; answers: Record<string, unknown> }
export function routineDraftKey(program: string) { return `routine_draft_v1:${program}`; }
export function readRoutineDraft(storage: AccountStorage | undefined, program: string, steps: number, now = new Date()): RoutineDraft | null {
  try {
    const draft = JSON.parse(storage?.getItem(routineDraftKey(program)) ?? "null");
    if (!draft || draft.day !== checklistDay(now) || !Number.isInteger(draft.stepIdx) || draft.stepIdx < 0 || draft.stepIdx >= steps || !draft.answers || typeof draft.answers !== "object" || Array.isArray(draft.answers)) return null;
    return draft;
  } catch { return null; }
}
