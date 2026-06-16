import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { buildSettingsUpdateData, serializeSettings } = await import("./settings.js");

const existingSettings = {
  id: 1,
  onboardingTutorialCompletedAt: new Date("2026-06-11T08:15:30.000Z"),
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
  onboardingTutorialCompletedAt: "2026-06-11T08:15:30.000Z",
  language: "en",
  tradingSessions: [{ id: "london" }],
  calendarCurrencies: ["EUR", "USD"],
  calendarImpacts: ["high"],
  selectedPairs: ["EURUSD"],
  alarmConfigs: {
    version: 1,
    calls: [{ id: "risk-desk", callerName: "Banca - Ufficio Risk", time: "09:00", days: [1] }],
  },
  riskGuard: { maxConsecutiveLosses: null, maxDailyTrades: null, maxDailyLossR: null },
});

const languageUpdate = buildSettingsUpdateData({ language: "fr" }, existingSettings);
assert.deepEqual(languageUpdate, {
  updateData: {
    notificationPrefs: JSON.stringify({ alerts: true, __language: "fr" }),
  },
});

// riskGuard thresholds merge into notificationPrefs (sanitized: 999 clamps to 100, "2.5" coerces).
const riskGuardUpdate = buildSettingsUpdateData(
  { riskGuard: { maxConsecutiveLosses: 4, maxDailyTrades: 999, maxDailyLossR: "2.5" } },
  existingSettings,
);
assert.deepEqual(riskGuardUpdate, {
  updateData: {
    notificationPrefs: JSON.stringify({
      alerts: true,
      __language: "en",
      __riskGuard: { maxConsecutiveLosses: 4, maxDailyTrades: 100, maxDailyLossR: 2.5 },
    }),
  },
});

const invalidLotDivisor = buildSettingsUpdateData({ lotDivisor: 0 }, existingSettings);
assert.equal(invalidLotDivisor.error, "lotDivisor must be a number >= 1");

const tutorialCompleteUpdate = buildSettingsUpdateData(
  { onboardingTutorialCompletedAt: "2026-06-11T09:00:00.000Z" },
  existingSettings,
);
assert.deepEqual(tutorialCompleteUpdate, {
  updateData: {
    onboardingTutorialCompletedAt: new Date("2026-06-11T09:00:00.000Z"),
  },
});

const tutorialResetUpdate = buildSettingsUpdateData({ onboardingTutorialCompletedAt: null }, existingSettings);
assert.deepEqual(tutorialResetUpdate, {
  updateData: {
    onboardingTutorialCompletedAt: null,
  },
});

const invalidTutorialCompletedAt = buildSettingsUpdateData(
  { onboardingTutorialCompletedAt: "not-a-date" },
  existingSettings,
);
assert.equal(invalidTutorialCompletedAt.error, "onboardingTutorialCompletedAt must be a valid ISO date string or null");

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
