/** Daily confirmations are local to this browser, account and Rome trading day. */
export function checklistDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function checklistStorageKey(userId: string): string {
  return `tl_confirmation_session_v2:${userId}`;
}
export function readDailyChecklist(raw: string | null, itemIds: number[], now = new Date()): Set<number> {
  if (!raw) return new Set();
  try {
    const value = JSON.parse(raw);
    if (value.date !== checklistDay(now) || !Array.isArray(value.checked)) return new Set();
    return new Set(value.checked.filter((id: unknown): id is number => typeof id === "number" && itemIds.includes(id)));
  } catch { return new Set(); }
}
