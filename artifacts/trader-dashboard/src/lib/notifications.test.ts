import assert from "node:assert/strict";
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationCopy,
  normalizeNotificationPrefs,
  shouldNotifyOnce,
  type NotificationStorage,
} from "./notifications.js";

class MemoryStorage implements NotificationStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

assert.deepEqual(normalizeNotificationPrefs({ sessions: false, brain: false }), {
  ...DEFAULT_NOTIFICATION_PREFS,
  sessions: false,
  brain: false,
});

assert.equal(getNotificationCopy("it").prefs.brain.label, "Brain AI");
assert.equal(getNotificationCopy("it").titles.sessionOpen("Londra"), "Sessione Londra aperta");
assert.equal(getNotificationCopy("en").prefs.dailyReminder.label, "Daily reminder");
assert.equal(getNotificationCopy("en").titles.sessionOpen("London"), "London session is open");
assert.equal(getNotificationCopy("es").titles.goalReminder, "Recordatorio de objetivo");

const storage = new MemoryStorage();
assert.equal(shouldNotifyOnce(storage, "goal-1", new Date("2026-06-07T09:00:00"), 60_000), true);
assert.equal(shouldNotifyOnce(storage, "goal-1", new Date("2026-06-07T09:00:30"), 60_000), false);
assert.equal(shouldNotifyOnce(storage, "goal-1", new Date("2026-06-07T09:02:00"), 60_000), true);

console.log("notification helper checks passed");
