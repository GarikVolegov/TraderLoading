import assert from "node:assert/strict";
import {
  getNotificationLanguage,
  getServerNotificationCopy,
} from "./notificationCopy.js";

assert.equal(getNotificationLanguage("it"), "it");
assert.equal(getNotificationLanguage("EN"), "en");
assert.equal(getNotificationLanguage("unknown"), "it");
assert.equal(getNotificationLanguage(null), "it");

assert.equal(getServerNotificationCopy("it").sessionTitle("Londra"), "Sessione Londra aperta");
assert.equal(getServerNotificationCopy("en").sessionTitle("London"), "London session is open");
assert.equal(getServerNotificationCopy("es").chatBody, "Te ha enviado un mensaje");
assert.equal(getServerNotificationCopy("en").socialFollowBody("Alex"), "Alex started following you");
assert.equal(getServerNotificationCopy("it").socialLikeBody("Alex"), "Alex ha messo like al tuo post");

// Finding 3.3: daily-reminder/goal-reminder/macro-event push copy (mirrors the
// client dictionary in lib/notifications.ts so a server push reads identically
// to what the old in-tab notification used to say).
for (const lang of ["it", "en", "es", "fr", "de"] as const) {
  const copy = getServerNotificationCopy(lang);
  assert.ok(copy.dailyReminderTitle, `${lang}: dailyReminderTitle`);
  assert.ok(copy.dailyEmptyBody, `${lang}: dailyEmptyBody`);
  assert.ok(copy.dailyMissionsBody(1, 3), `${lang}: dailyMissionsBody`);
  assert.ok(copy.macroAlertTitle, `${lang}: macroAlertTitle`);
  assert.ok(copy.macroEventBody("EUR: CPI"), `${lang}: macroEventBody`);
  assert.ok(copy.goalReminderTitle, `${lang}: goalReminderTitle`);
}
assert.equal(getServerNotificationCopy("en").dailyMissionsBody(2, 5), "Today's missions: 2 left out of 5.");
assert.equal(getServerNotificationCopy("it").dailyEmptyBody, "Inizia le tue missioni di oggi.");
assert.equal(getServerNotificationCopy("es").goalReminderTitle, "Recordatorio de objetivo");
assert.equal(getServerNotificationCopy("de").macroAlertTitle, "Makroereignis-Alarm");
assert.equal(
  getServerNotificationCopy("fr").macroEventBody("EUR: CPI"),
  "1 evenement a fort impact: EUR: CPI",
);

console.log("server notification copy checks passed");
