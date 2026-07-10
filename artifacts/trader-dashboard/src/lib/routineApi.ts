import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export interface RoutineCompletionPayload {
  routineId: string;
  routineTitle: string;
  template: "morning" | "evening";
  answers: Record<string, unknown>;
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
