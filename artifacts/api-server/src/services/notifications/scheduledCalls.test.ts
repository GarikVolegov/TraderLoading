import assert from "node:assert/strict";
import {
  buildScheduledCallDedupeKey,
  buildScheduledCallPayload,
  getScheduledCallVibration,
  isServerScheduledCallDue,
  parseScheduledCallConfigs,
} from "./scheduledCalls.js";

const config = {
  version: 1,
  calls: [
    {
      id: "risk-desk",
      enabled: true,
      callerName: "Banca - Ufficio Risk",
      department: "Controllo Operativo",
      notificationTitle: "Chiamata dalla banca",
      notificationBody: "Controllo operativo richiesto",
      callMessage: "Verifica il piano prima di operare.",
      time: "09:00",
      days: [1],
      timezone: "Europe/Rome",
      logoText: "BK",
      visualPreset: "bank",
      accentColor: "#c9a227",
      ringtone: "institutional",
      vibration: "urgent",
      requireInteraction: true,
      snoozeMins: 10,
      primaryActionLabel: "Apri chiamata",
      secondaryActionLabel: "Chiudi",
    },
  ],
};

const [call] = parseScheduledCallConfigs(JSON.stringify(config));
assert.equal(call.id, "risk-desk");
assert.equal(call.callerName, "Banca - Ufficio Risk");
assert.deepEqual(parseScheduledCallConfigs("{bad json"), []);
assert.deepEqual(parseScheduledCallConfigs(JSON.stringify({ version: 2, calls: config.calls })), []);
assert.deepEqual(parseScheduledCallConfigs(JSON.stringify({ version: 1, calls: [{ id: "bad" }] })), []);

const mondayNineRome = new Date("2026-06-08T07:00:00.000Z");
assert.equal(isServerScheduledCallDue(call, mondayNineRome), true);
assert.equal(isServerScheduledCallDue({ ...call, time: "09:01" }, mondayNineRome), false);
assert.equal(isServerScheduledCallDue({ ...call, days: [2] }, mondayNineRome), false);
assert.equal(isServerScheduledCallDue({ ...call, days: [] }, mondayNineRome), true);
assert.equal(isServerScheduledCallDue({ ...call, enabled: false }, mondayNineRome), false);

assert.deepEqual(getScheduledCallVibration("urgent"), [300, 120, 300, 120, 500]);
assert.deepEqual(getScheduledCallVibration("silent"), []);

const payload = buildScheduledCallPayload(call, "/trader/");
assert.equal(payload.title, "Chiamata dalla banca");
assert.equal(payload.body, "Controllo operativo richiesto");
assert.equal(payload.tag, "scheduled-call:risk-desk");
assert.equal(payload.requireInteraction, true);
assert.deepEqual(payload.vibrate, [300, 120, 300, 120, 500]);
assert.equal(payload.data?.scheduledCall?.id, "risk-desk");
assert.match(String(payload.data?.url), /^\/trader\/\?scheduledCall=/);

assert.equal(buildScheduledCallDedupeKey("u1", call, mondayNineRome), "u1:risk-desk:2026-06-08T09:00");

console.log("server scheduled call checks passed");
