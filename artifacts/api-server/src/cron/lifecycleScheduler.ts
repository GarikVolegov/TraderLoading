// Scheduler delle email di ciclo di vita (welcome / digest settimanale / win-back).
// Protetto da lock distribuito (Redis / in-memory fallback) per evitare esecuzioni
// duplicate su cluster orizzontali (Fargate / Railway / Kubernetes).

import { dispatchLaunchEmails } from "../services/email/launchEmails.js";
import cron, { type ScheduledTask } from "node-cron";
import { runLifecycleEmails } from "../services/email/lifecycleEmails.js";
import { reportJobError } from "../lib/observability.js";
import { tryAcquireLock } from "../lib/distributedLock.js";
import { performSystemHousekeeping } from "../services/systemMaintenance.js";

export function startLifecycleScheduler(): { close(): Promise<void> } {
  // Ogni giorno alle 08:00 (ora del server). L'audience selector deduplica e
  // rispetta intervallo digest / cooldown win-back; il lock distribuito impedisce doppioni fra nodi.
  const task: ScheduledTask = cron.schedule("0 8 * * *", () => {
    void (async () => {
      const dayKey = new Date().toISOString().slice(0, 10);
      if (!(await tryAcquireLock(`cron:email-lifecycle:${dayKey}`, 3600_000))) return;
      await runLifecycleEmails();
    })().catch((err) => reportJobError(err, { job: "email-lifecycle" }));
  });

  // Ogni minuto: smistamento coda email di lancio, con lock distribuito per coordinare i container.
  const launchTask = cron.schedule("* * * * *", () => {
    void (async () => {
      const bucket = Math.floor(Date.now() / 60_000);
      if (!(await tryAcquireLock(`cron:launch-emails:${bucket}`, 50_000))) return;
      await dispatchLaunchEmails();
    })().catch((err) => reportJobError(err, { job: "launch-emails" }));
  });

  // Ogni 15 minuti: bonifica stanze orfane, auto-curazione e telemetria connection pool PostgreSQL
  const maintenanceTask = cron.schedule("*/15 * * * *", () => {
    void (async () => {
      const bucket = Math.floor(Date.now() / (15 * 60_000));
      if (!(await tryAcquireLock(`cron:system-maintenance:${bucket}`, 14 * 60_000))) return;
      await performSystemHousekeeping();
    })().catch((err) => reportJobError(err, { job: "system-maintenance" }));
  });

  return {
    async close(): Promise<void> {
      task.stop();
      launchTask.stop();
      maintenanceTask.stop();
    },
  };
}
