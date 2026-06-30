// Refresh on-demand delle standings dopo un sync conto, con debounce per stagione:
// una raffica di sync (più utenti) coalizza in un solo ricalcolo. Best-effort —
// non deve mai rompere il sync.

import { getActiveSeason, isEnrolled, materializeStandings } from "./store.js";

const DEBOUNCE_MS = 30_000;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export async function scheduleStandingsRefresh(userId: string): Promise<void> {
  const season = await getActiveSeason();
  if (!season || season.status !== "live") return;
  if (!(await isEnrolled(season.id, userId))) return;

  const existing = timers.get(season.id);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    timers.delete(season.id);
    materializeStandings(season.id, "r").catch((err) =>
      console.warn("[tornei] debounced standings refresh failed", err),
    );
  }, DEBOUNCE_MS);
  // Non tenere vivo il processo solo per questo timer.
  if (typeof timer.unref === "function") timer.unref();
  timers.set(season.id, timer);
}
