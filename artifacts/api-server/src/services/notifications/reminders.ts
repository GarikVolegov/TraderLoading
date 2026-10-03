// Pure scheduling predicates for the daily-reminder / goal-reminder / macro-event
// push categories (audit finding 3.3: these previously only fired via an in-tab
// setTimeout, so a closed app never got them despite the UI promising otherwise).
// No per-user timezone is stored for dailyReminderTime/goal.reminderTime (unlike
// scheduledCalls, which carries its own), so these interpret "local" as
// Europe/Rome — the same zone the app already uses for other "local day"
// boundaries (risk guard, tornei cycles).
export const REMINDER_TIMEZONE = "Europe/Rome";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function localTimeHHMM(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
}

/** Whether a "HH:MM" local-time reminder should fire right now (exact-minute
 *  match, matching the scheduler's once-a-minute tick). */
export function isTimeReminderDue(
  reminderTime: string | null | undefined,
  now: Date,
  timezone: string = REMINDER_TIMEZONE,
): boolean {
  if (!reminderTime || !TIME_RE.test(reminderTime)) return false;
  return localTimeHHMM(now, timezone) === reminderTime;
}

/** Local calendar-day key (YYYY-MM-DD) for day-scoped dedup. */
export function localDayKey(now: Date, timezone: string = REMINDER_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Whether a high-impact macro event's pre-alert window is due right now — fires
 *  once, within one scheduler tick of (event time − preMacroMinutes). */
export function isMacroAlertDue(
  eventTimestampMs: number,
  preMacroMinutes: number,
  nowMs: number,
  tickWindowMs: number = 60_000,
): boolean {
  const fireAt = eventTimestampMs - preMacroMinutes * 60_000;
  return nowMs >= fireAt && nowMs - fireAt < tickWindowMs;
}
