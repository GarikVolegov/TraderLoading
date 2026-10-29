// Servizio di manutenzione e auto-curazione programmata del sistema AUREUS.
// Monitora la reattività del pool PostgreSQL, bonifica stanze o sessioni orfane
// e aggiorna la telemetria del Watchdog sovrano.

import { sql, and, lt, eq } from "drizzle-orm";
import { systemWatchdog } from "../lib/systemWatchdog.js";
import logger from "../lib/logger.js";
import { reportJobError } from "../lib/observability.js";

export interface HousekeepingReport {
  dbPingMs: number;
  prunedOrphanRooms: number;
  durationMs: number;
  status: "completed" | "error";
  error?: string;
}

export async function performSystemHousekeeping(): Promise<HousekeepingReport> {
  const t0 = performance.now();

  if (!process.env.DATABASE_URL) {
    const nowIso = new Date().toISOString();
    systemWatchdog.recordMaintenance({
      status: "completed",
      lastRunAt: nowIso,
      dbPingMs: 0,
      prunedOrphanRooms: 0,
    });
    return {
      dbPingMs: 0,
      prunedOrphanRooms: 0,
      durationMs: 0,
      status: "completed",
    };
  }

  systemWatchdog.recordMaintenance({ status: "running" });

  let dbPingMs = 0;
  let prunedOrphanRooms = 0;

  try {
    const { db, backtestTournamentsTable } = await import("@workspace/db");

    // 1. Probing di latenza del connection pool PostgreSQL
    const pingStart = performance.now();
    await db.execute(sql`SELECT 1`);
    dbPingMs = Math.round((performance.now() - pingStart) * 10) / 10;

    if (dbPingMs > 150) {
      systemWatchdog.recordAnomaly(
        "databaseLag",
        `PostgreSQL pool latency elevated: ${dbPingMs}ms`,
        "warn",
        { latencyMs: dbPingMs },
      );
    }

    // 2. Bonifica stanze orfane/abbandonate nelle Prove del Fuoco (create da oltre 48h con 0 partecipanti)
    const cutoffDate = new Date(Date.now() - 48 * 3600_000);
    const staleResult = await db
      .update(backtestTournamentsTable)
      .set({ status: "ended" })
      .where(
        and(
          eq(backtestTournamentsTable.status, "in_progress"),
          eq(backtestTournamentsTable.participantCount, 0),
          lt(backtestTournamentsTable.createdAt, cutoffDate),
        ),
      );

    // Se l'adattatore restituisce rowCount / rowsAffected
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prunedOrphanRooms = (staleResult as any)?.rowCount ?? 0;

    const durationMs = Math.round(performance.now() - t0);
    const nowIso = new Date().toISOString();

    systemWatchdog.recordMaintenance({
      status: "completed",
      lastRunAt: nowIso,
      dbPingMs,
      prunedOrphanRooms,
    });

    logger.info(
      { dbPingMs, prunedOrphanRooms, durationMs },
      "[AUREUS-MAINTENANCE] Scheduled housekeeping completed successfully",
    );

    return {
      dbPingMs,
      prunedOrphanRooms,
      durationMs,
      status: "completed",
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Math.round(performance.now() - t0);

    systemWatchdog.recordAnomaly(
      "databaseLag",
      `Housekeeping failure: ${errorMsg}`,
      "warn",
      { error: errorMsg },
    );

    systemWatchdog.recordMaintenance({
      status: "error",
      lastError: errorMsg,
    });

    reportJobError(err, { job: "system-housekeeping" });

    return {
      dbPingMs,
      prunedOrphanRooms,
      durationMs,
      status: "error",
      error: errorMsg,
    };
  }
}
