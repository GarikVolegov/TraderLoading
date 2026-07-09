export type JournalTab =
  | "panoramica"
  | "trades"
  | "idee"
  | "obiettivi"
  | "recap-settimanale"
  | "recap-mensile";

const JOURNAL_TABS: readonly JournalTab[] = [
  "panoramica",
  "trades",
  "idee",
  "obiettivi",
  "recap-settimanale",
  "recap-mensile",
];

/** Reads the active `/journal` tab from a location search string (`?t=…`). */
export function parseJournalTab(search: string): JournalTab {
  const value = new URLSearchParams(search).get("t");
  return JOURNAL_TABS.includes(value as JournalTab) ? (value as JournalTab) : "panoramica";
}
