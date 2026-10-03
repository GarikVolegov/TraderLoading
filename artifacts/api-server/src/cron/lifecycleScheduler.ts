// Scheduler delle email di ciclo di vita (welcome / digest settimanale / win-back).
// Una passata giornaliera sull'intera audience; il gating (RESEND_API_KEY +
// EMAIL_LIFECYCLE_ENABLED) vive dentro runLifecycleEmails, quindi di default è
// un no-op finché l'utente non lo abilita. Modellato su torneiScheduler.

import cron, { type ScheduledTask } from "node-cron";
import { runLifecycleEmails } from "../services/email/lifecycleEmails.js";
import { reportJobError } from "../lib/observability.js";

export function startLifecycleScheduler(): { close(): Promise<void> } {
  // Ogni giorno alle 08:00 (ora del server). L'audience selector deduplica e
  // rispetta intervallo digest / cooldown win-back, quindi una passata al giorno
  // è sufficiente e non rischia doppioni.
  const task: ScheduledTask = cron.schedule("0 8 * * *", () => {
    runLifecycleEmails().catch((err) => reportJobError(err, { job: "email-lifecycle" }));
  });

  return {
    async close(): Promise<void> {
      task.stop();
    },
  };
}
