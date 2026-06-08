import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { buildSettingsUpdateData, serializeSettings } = await import("./settings.js");

const existingSettings = {
  id: 1,
  notificationPrefs: JSON.stringify({ alerts: true, __language: "en" }),
  tradingSessions: JSON.stringify([{ id: "london" }]),
  calendarCurrencies: JSON.stringify(["EUR", "USD"]),
  calendarImpacts: JSON.stringify(["high"]),
  selectedPairs: JSON.stringify(["EURUSD"]),
  alarmConfigs: JSON.stringify({
    version: 1,
    calls: [{ id: "risk-desk", callerName: "Banca - Ufficio Risk", time: "09:00", days: [1] }],
  }),
};

const emptyUpdate = buildSettingsUpdateData({}, existingSettings);
assert.deepEqual(emptyUpdate, { updateData: {} });
assert.deepEqual(serializeSettings(existingSettings), {
  ...existingSettings,
  language: "en",
  tradingSessions: [{ id: "london" }],
  calendarCurrencies: ["EUR", "USD"],
  calendarImpacts: ["high"],
  selectedPairs: ["EURUSD"],
  alarmConfigs: {
    version: 1,
    calls: [{ id: "risk-desk", callerName: "Banca - Ufficio Risk", time: "09:00", days: [1] }],
  },
});

const languageUpdate = buildSettingsUpdateData({ language: "fr" }, existingSettings);
assert.deepEqual(languageUpdate, {
  updateData: {
    notificationPrefs: JSON.stringify({ alerts: true, __language: "fr" }),
  },
});

const invalidLotDivisor = buildSettingsUpdateData({ lotDivisor: 0 }, existingSettings);
assert.equal(invalidLotDivisor.error, "lotDivisor must be a number >= 1");

const alarmUpdate = buildSettingsUpdateData(
  { alarmConfigs: { version: 1, calls: [{ id: "desk", callerName: "Risk Desk", time: "10:30", days: [] }] } },
  existingSettings,
);
assert.deepEqual(alarmUpdate, {
  updateData: {
    alarmConfigs: JSON.stringify({ version: 1, calls: [{ id: "desk", callerName: "Risk Desk", time: "10:30", days: [] }] }),
  },
});

console.log("settings route helper checks passed");
