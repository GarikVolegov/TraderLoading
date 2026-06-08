import assert from "node:assert/strict";
import {
  createDefaultScheduledCall,
  decodeScheduledCallFromLocation,
  encodeScheduledCallUrl,
  isScheduledCallDue,
  parseScheduledCalls,
  serializeScheduledCalls,
} from "./scheduledCalls.js";

const mondayNine = new Date("2026-06-08T07:00:00.000Z");
const call = createDefaultScheduledCall({
  id: "risk-desk",
  callerName: "Banca - Ufficio Risk",
  department: "Controllo Operativo",
  notificationTitle: "Chiamata dalla banca",
  notificationBody: "Controllo operativo richiesto",
  callMessage: "Verifica il piano prima di aprire nuove posizioni.",
  time: "09:00",
  days: [1],
  timezone: "Europe/Rome",
  logoText: "BK",
  accentColor: "#c9a227",
});

assert.equal(call.visualPreset, "bank");
assert.equal(call.ringtone, "institutional");
assert.equal(call.requireInteraction, true);
assert.equal(call.primaryActionLabel, "Apri chiamata");

const serialized = serializeScheduledCalls([call]);
const parsed = parseScheduledCalls(serialized);
assert.equal(parsed.length, 1);
assert.equal(parsed[0]?.callerName, "Banca - Ufficio Risk");
assert.equal(parsed[0]?.days[0], 1);

assert.deepEqual(parseScheduledCalls(null), []);
assert.deepEqual(parseScheduledCalls("{bad json"), []);
assert.deepEqual(parseScheduledCalls(JSON.stringify({ version: 99, calls: [call] })), []);
assert.deepEqual(parseScheduledCalls(JSON.stringify({ version: 1, calls: [{ id: "bad" }] })), []);

assert.equal(isScheduledCallDue(call, mondayNine), true);
assert.equal(isScheduledCallDue({ ...call, time: "09:01" }, mondayNine), false);
assert.equal(isScheduledCallDue({ ...call, days: [2] }, mondayNine), false);
assert.equal(isScheduledCallDue({ ...call, days: [] }, mondayNine), true);
assert.equal(isScheduledCallDue({ ...call, enabled: false }, mondayNine), false);

const url = encodeScheduledCallUrl(call, "/trader/");
assert.match(url, /^\/trader\/\?scheduledCall=/);
const decoded = decodeScheduledCallFromLocation(url);
assert.equal(decoded?.id, "risk-desk");
assert.equal(decoded?.notificationTitle, "Chiamata dalla banca");
assert.equal(decodeScheduledCallFromLocation("/trader/?scheduledCall=bad-json"), null);

console.log("scheduled call helper checks passed");
