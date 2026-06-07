import { apiRequest, type RelativeApiOptions } from "./apiFetch";

export type JournalTagSummary = {
  tag: string;
  count: number;
};

export const journalTagsQueryKey = ["journal-tags"] as const;

export async function fetchJournalTags(options?: RelativeApiOptions): Promise<JournalTagSummary[]> {
  const response = await apiRequest("journal/tags", undefined, options);
  if (!response.ok) return [];
  return response.json() as Promise<JournalTagSummary[]>;
}
