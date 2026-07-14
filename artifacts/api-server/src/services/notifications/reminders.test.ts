import assert from "node:assert/strict";
import { isTimeReminderDue, localDayKey, isMacroAlertDue, REMINDER_TIMEZONE } from "./reminders.js";

// Finding 3.3: daily/goal reminders only ever fired via an in-tab setTimeout, so a
// closed app never got them. These pure predicates let a server-side minute-tick
// scheduler decide "is this due right now" without touching the DB/network.

// ── isTimeReminderDue: exact-minute match in Europe/Rome (no per-user timezone
// is stored for these, unlike scheduledCalls) ────────────────────────────────
{
  // 09:00 CEST (summer, UTC+2) = 07:00 UTC.
  const at0700UTC = new Date("2026-07-08T07:00:00.000Z");
  assert.equal(isTimeReminderDue("09:00", at0700UTC), true, "exact minute match, Europe/Rome DST");
  assert.equal(isTimeReminderDue("09:01", at0700UTC), false, "one minute off ⇒ not due");
  assert.equal(isTimeReminderDue("08:59", at0700UTC), false);

  assert.equal(isTimeReminderDue(null, at0700UTC), false, "no reminder set ⇒ never due");
  assert.equal(isTimeReminderDue(undefined, at0700UTC), false);
  assert.equal(isTimeReminderDue("", at0700UTC), false);
  assert.equal(isTimeReminderDue("9:00", at0700UTC), false, "malformed (no leading zero) ⇒ rejected");
  assert.equal(isTimeReminderDue("24:00", at0700UTC), false, "out of range ⇒ rejected");

  // Winter (CET, UTC+1): 09:00 local = 08:00 UTC.
  const winterAt0800UTC = new Date("2026-01-08T08:00:00.000Z");
  assert.equal(isTimeReminderDue("09:00", winterAt0800UTC), true, "DST handled via IANA zone, not a fixed offset");
}

// ── localDayKey: Europe/Rome calendar day, for day-scoped dedup ─────────────
{
  // 23:30 UTC on 2026-07-08 is already 2026-07-09 01:30 in Europe/Rome (summer).
  assert.equal(localDayKey(new Date("2026-07-08T23:30:00.000Z")), "2026-07-09");
  assert.equal(localDayKey(new Date("2026-07-08T09:00:00.000Z")), "2026-07-08");
  assert.equal(REMINDER_TIMEZONE, "Europe/Rome");
}

// ── isMacroAlertDue: fires once, within one tick of (event − preMacroMinutes) ─
{
  const eventAt = Date.parse("2026-07-08T14:30:00.000Z");
  const preMinutes = 15;
  const fireAt = eventAt - preMinutes * 60_000; // 14:15:00

  assert.equal(isMacroAlertDue(eventAt, preMinutes, fireAt), true, "exactly at fire time");
  assert.equal(isMacroAlertDue(eventAt, preMinutes, fireAt + 59_000), true, "still within the same tick window");
  assert.equal(isMacroAlertDue(eventAt, preMinutes, fireAt + 60_000), false, "next tick ⇒ already missed, don't re-fire");
  assert.equal(isMacroAlertDue(eventAt, preMinutes, fireAt - 1_000), false, "before the window ⇒ not yet due");
  assert.equal(isMacroAlertDue(eventAt, preMinutes, eventAt + 1), false, "after the event itself ⇒ too late");
}

console.log("reminder scheduling checks passed");
