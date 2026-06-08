import assert from "node:assert/strict";
import fs from "node:fs";

const settingsEditor = fs.readFileSync("src/components/ScheduledCallsSettings.tsx", "utf8");
const overlay = fs.readFileSync("src/components/ScheduledCallOverlay.tsx", "utf8");
const runtime = fs.readFileSync("src/components/ScheduledCallRuntime.tsx", "utf8");
const settingsPage = fs.readFileSync("src/pages/Settings.tsx", "utf8");
const app = fs.readFileSync("src/App.tsx", "utf8");

assert.match(settingsEditor, /Chiamate programmate/);
assert.match(settingsEditor, /callerName/);
assert.match(settingsEditor, /department/);
assert.match(settingsEditor, /notificationTitle/);
assert.match(settingsEditor, /notificationBody/);
assert.match(settingsEditor, /callMessage/);
assert.match(settingsEditor, /accentColor/);
assert.match(settingsEditor, /ringtone/);
assert.match(settingsEditor, /vibration/);
assert.match(settingsEditor, /requireInteraction/);
assert.match(settingsEditor, /push\.isSubscribed/);

assert.match(overlay, /Banca - Ufficio Risk/);
assert.match(overlay, /institutional/);
assert.match(overlay, /primaryActionLabel/);
assert.match(overlay, /secondaryActionLabel/);

assert.match(runtime, /decodeScheduledCallFromLocation/);
assert.match(runtime, /isScheduledCallDue/);
assert.match(runtime, /ScheduledCallOverlay/);

assert.match(settingsPage, /ScheduledCallsSettings/);
assert.match(app, /ScheduledCallRuntime/);

console.log("scheduled calls frontend static checks passed");
