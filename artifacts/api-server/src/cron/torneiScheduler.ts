// Scheduler dei Tornei: refresh periodico della classifica materializzata + il
// rollover "ciclo del 7" (chiude/liquida la stagione scaduta, promuove l'upcoming,
// crea la finestra mancante). Modellato su cotScheduler in routes/tools.ts.

import cron, { type ScheduledTask } from "node-cron";
import { db, tournamentSeasonsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { planRollover, type SeasonRow } from "../services/tornei/rolloverPlan.js";
import type { SeasonWindow } from "../services/tornei/seasonWindows.js";
import { getActiveSeason, materializeStandings } from "../services/tornei/store.js";
import { settleSeason } from "../services/tornei/settle.js";
import { reportJobError } from "../lib/observability.js";

async function loadSeasonRows(): Promise<SeasonRow[]> {
  const rows = await db
    .select({
      id: tournamentSeasonsTable.id,
      slug: tournamentSeasonsTable.slug,
      status: tournamentSeasonsTable.status,
      startsAt: tournamentSeasonsTable.startsAt,
      endsAt: tournamentSeasonsTable.endsAt,
      settledAt: tournamentSeasonsTable.settledAt,
    })
    .from(tournamentSeasonsTable);
  return rows;
}

async function createSeason(window: SeasonWindow, now: Date): Promise<void> {
  // Se la finestra contiene `now` nasce già live, altrimenti upcoming.
  const status = window.startsAt <= now && window.endsAt > now ? "live" : "upcoming";
  await db
    .insert(tournamentSeasonsTable)
    .values({
      slug: window.slug,
      label: window.label,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      status,
    })
    .onConflictDoNothing({ target: tournamentSeasonsTable.slug });
}

export async function applyRollover(now: Date = new Date()): Promise<void> {
  const seasons = await loadSeasonRows();
  const plan = planRollover(seasons, now);

  for (const id of plan.toEnd) {
    await db
      .update(tournamentSeasonsTable)
      .set({ status: "ended" })
      .where(eq(tournamentSeasonsTable.id, id));
    await settleSeason(id); // congela premi/certificati (idempotente)
  }
  for (const id of plan.toPromote) {
    await db
      .update(tournamentSeasonsTable)
      .set({ status: "live" })
      .where(eq(tournamentSeasonsTable.id, id));
  }
  if (plan.toCreate) await createSeason(plan.toCreate, now);
}

export async function refreshActiveStandings(): Promise<void> {
  const season = await getActiveSeason();
  if (season && season.status === "live") {
    await materializeStandings(season.id, "r");
  }
}

export function startTorneiScheduler(): { close(): Promise<void> } {
  // Refresh classifica ogni 5 minuti.
  const refreshTask: ScheduledTask = cron.schedule("*/5 * * * *", () => {
    refreshActiveStandings().catch((err) => reportJobError(err, { job: "tornei-refresh" }));
  });
  // Rollover giornaliero (00:10) — idempotente. Liquida la stagione scaduta
  // (settleSeason: XP/Pro/mint), quindi un fallimento silenzioso è inaccettabile.
  const rolloverTask: ScheduledTask = cron.schedule("10 0 * * *", () => {
    applyRollover().catch((err) => reportJobError(err, { job: "tornei-rollover" }));
  });

  // All'avvio: garantisce che esista una stagione e aggiorna subito le standings.
  applyRollover()
    .then(() => refreshActiveStandings())
    .catch((err) => reportJobError(err, { job: "tornei-boot-rollover" }));

  return {
    async close(): Promise<void> {
      refreshTask.stop();
      rolloverTask.stop();
    },
  };
}
