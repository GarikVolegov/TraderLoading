import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export interface RoutineCompletionPayload {
  routineId: string;
  routineTitle: string;
  template: "morning" | "evening";
  answers: Record<string, unknown>;
}

export interface RoutineHistoryEntry {
  id: number;
  routineId: string;
  routineTitle: string;
  template: "morning" | "evening";
  qualityScore: number;
  answers: Record<string, unknown>;
  completionDate: string;
  completedAt: string;
}

export interface RoutineHistoryStats {
  currentStreakDays: number;
  longestStreakDays: number;
  totalCompletions: number;
  morningCount: number;
  eveningCount: number;
  adherenceRate30d: number;
  avgQualityScore: number;
  history: RoutineHistoryEntry[];
}

export function recordRoutineCompletion(
  payload: RoutineCompletionPayload,
  options?: RelativeApiOptions,
): Promise<{ id: number; qualityScore: number; completionDate: string }> {
  return apiJSON("routines/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, options);
}

export function fetchRoutineHistory(
  options?: RelativeApiOptions,
): Promise<RoutineHistoryStats> {
  return apiJSON("routines/history", { method: "GET" }, options);
}
