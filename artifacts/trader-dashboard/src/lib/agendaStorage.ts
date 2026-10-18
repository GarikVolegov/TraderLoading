import type { AccountStorage } from "./accountStorage";

export const AGENDA_ITEMS_KEY = "tl_calendar_manual_items_v1";
export type ManualItemType = "appointment" | "note" | "review" | "trade-plan";
export type AgendaPriority = "low" | "medium" | "high";
export interface ManualPlannerItem {
  id: string;
  type: ManualItemType;
  title: string;
  notes: string;
  startAt: string;
  endAt: string | null;
  priority: AgendaPriority;
  createdAt: string;
}

export function parseAgendaItems(raw: string | null): ManualPlannerItem[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is ManualPlannerItem => {
      if (!value || typeof value !== "object") return false;
      const item = value as Partial<ManualPlannerItem>;
      return typeof item.id === "string" && typeof item.title === "string" && typeof item.notes === "string"
        && ["appointment", "note", "review", "trade-plan"].includes(item.type ?? "")
        && ["low", "medium", "high"].includes(item.priority ?? "")
        && typeof item.startAt === "string" && Number.isFinite(Date.parse(item.startAt))
        && (item.endAt === null || (typeof item.endAt === "string" && Number.isFinite(Date.parse(item.endAt))))
        && typeof item.createdAt === "string";
    });
  } catch { return []; }
}

/** Caller chooses account-scoped or legacy storage explicitly; no implicit import. */
export function readAgendaItems(storage?: AccountStorage): ManualPlannerItem[] {
  try { return parseAgendaItems(storage?.getItem(AGENDA_ITEMS_KEY) ?? null); }
  catch { return []; }
}

export function mergeAgendaItems(current: ManualPlannerItem[], imported: ManualPlannerItem[]): ManualPlannerItem[] {
  const ids = new Set(current.map(item => item.id));
  const signatures = new Set(current.map(item => `${item.type}|${item.title}|${item.startAt}`));
  const result = [...current];
  for (const item of imported) {
    const signature = `${item.type}|${item.title}|${item.startAt}`;
    if (ids.has(item.id) || signatures.has(signature)) continue;
    result.push(item); ids.add(item.id); signatures.add(signature);
  }
  return result;
}
