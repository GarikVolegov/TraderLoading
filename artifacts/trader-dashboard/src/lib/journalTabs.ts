export type JournalTab =
  | "sessioni"
  | "panoramica"
  | "trades"
  | "piano"
  | "revisione";

const JOURNAL_TABS: readonly JournalTab[] = [
  "sessioni",
  "panoramica",
  "trades",
  "piano",
  "revisione",
];

/** Reads the active `/journal` tab from a location search string (`?t=…`). */
export function parseJournalTab(search: string): JournalTab {
  const params = new URLSearchParams(search);
  const value = params.get("t");
  if (!value) return params.get("new") === "1" ? "trades" : "sessioni";
  if (["idee", "obiettivi", "idee-obiettivi"].includes(value ?? "")) return "piano";
  if (["recap-settimanale", "recap-mensile"].includes(value ?? "")) return "revisione";
  return JOURNAL_TABS.includes(value as JournalTab) ? (value as JournalTab) : "panoramica";
}

export type JournalPlanView = "oggi" | "agenda" | "idee-obiettivi";
export function parseJournalPlanView(search: string): JournalPlanView {
  const params = new URLSearchParams(search);
  if (["idee", "obiettivi", "idee-obiettivi"].includes(params.get("t") ?? "")) return "idee-obiettivi";
  const value = params.get("vista");
  return value === "agenda" || value === "idee-obiettivi" ? value : "oggi";
}

export function parseJournalRecapKind(search: string): "weekly" | "four_week" {
  const params = new URLSearchParams(search);
  if (params.get("t") === "recap-mensile") return "four_week";
  if (params.get("t") === "recap-settimanale") return "weekly";
  return params.get("kind") === "four_week" ? "four_week" : "weekly";
}
