import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@clerk/react";
import { checklistDay, checklistStorageKey, readDailyChecklist } from "@/lib/dailyChecklist";
import { reportClientError } from "@/lib/clientErrorReporter";
const EVENT = "tl:daily-checklist";
function subscribe(sync: () => void) {
  const timer = window.setInterval(sync, 1000);
  window.addEventListener("storage", sync);
  window.addEventListener(EVENT, sync);
  window.addEventListener("focus", sync);
  return () => { clearInterval(timer); window.removeEventListener("storage", sync); window.removeEventListener(EVENT, sync); window.removeEventListener("focus", sync); };
}
export function useDailyChecklist(items: { id: number }[] | undefined) {
  const { userId } = useAuth();
  const key = userId ? checklistStorageKey(userId) : null;
  const readRaw = useCallback(() => {
    try { return key ? localStorage.getItem(key) : null; } catch { return null; }
  }, [key]);
  // The day is part of the snapshot, so an open tab resets at Rome midnight.
  const snapshot = useCallback(() => `${checklistDay()}|${key}|${readRaw()}`, [key, readRaw]);
  useSyncExternalStore(subscribe, snapshot, () => "");
  const read = () => readDailyChecklist(readRaw(), (items ?? []).map(item => item.id));
  const checked = read();
  const update = (id?: number) => {
    if (!key) return;
    const next = id === undefined ? new Set<number>() : read();
    if (id !== undefined) { if (next.has(id)) next.delete(id); else next.add(id); }
    try {
      localStorage.setItem(key, JSON.stringify({ date: checklistDay(), checked: [...next] }));
      window.dispatchEvent(new Event(EVENT));
    } catch (error) { reportClientError(error, { context: "checklist confirmation save", notify: true }); }
  };
  return { checked, toggle: update, reset: () => update() };
}
