import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export interface RoutineCompletionPayload {
  routineId: string;
  routineTitle: string;
  template: "morning" | "evening";
  answers: Record<string, unknown>;
}

export interface RoutineCompetitionEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl: string | null;
  totalCompletions: number;
  currentStreakDays: number;
  avgQualityScore: number;
  completedToday: boolean;
  score: number;
  isCurrentUser: boolean;
}

export const routineCompetitionQueryKey = ["/api/routines/competition"] as const;

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

export function fetchRoutineCompetition(options?: RelativeApiOptions): Promise<RoutineCompetitionEntry[]> {
  return apiJSON<RoutineCompetitionEntry[]>("routines/competition", undefined, options);
}
