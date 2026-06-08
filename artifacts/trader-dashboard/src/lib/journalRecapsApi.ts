import { apiJSON, type RelativeApiOptions } from "./apiFetch";
import type { JournalRecapKind, JournalRecapPeriod } from "./journalRecapPeriods";

export interface JournalRecapFields {
  overallJudgment: string;
  wentWell: string;
  wentWrong: string;
  improvements: string;
  patterns: string;
  focusAreas: string;
  nextPeriodExpectations: string;
  nextPeriodGoals: string;
}

export interface JournalRecapPayload extends JournalRecapFields {
  kind: JournalRecapKind;
  periodStart: string;
  periodEnd: string;
}

export interface JournalRecap extends JournalRecapPayload {
  id: number;
  createdAt?: string;
  updatedAt?: string;
}

export const emptyJournalRecapFields: JournalRecapFields = {
  overallJudgment: "",
  wentWell: "",
  wentWrong: "",
  improvements: "",
  patterns: "",
  focusAreas: "",
  nextPeriodExpectations: "",
  nextPeriodGoals: "",
};

export const journalRecapQueryKey = (period: JournalRecapPeriod) => [
  "/api/journal/recaps",
  period.kind,
  period.periodStart,
  period.periodEnd,
] as const;

export function fetchJournalRecap(
  period: JournalRecapPeriod,
  options?: RelativeApiOptions,
): Promise<JournalRecap | null> {
  const params = new URLSearchParams({
    kind: period.kind,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  });
  return apiJSON<JournalRecap | null>(`journal/recaps?${params.toString()}`, undefined, options);
}

export function saveJournalRecap(
  payload: JournalRecapPayload,
  options?: RelativeApiOptions,
): Promise<JournalRecap> {
  return apiJSON<JournalRecap>("journal/recaps", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, options);
}
