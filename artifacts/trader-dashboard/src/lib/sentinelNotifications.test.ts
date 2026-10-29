import assert from "node:assert/strict";
import {
  evaluateSentinelAlarms,
  CARDIO_DEBOUNCE_MS,
  type SentinelEvaluationInput,
} from "./sentinelNotifications.js";

const baseInput: SentinelEvaluationInput = {
  isSessionActive: true,
  sessionId: "session-alpha-123",
  elapsedSessionMinutes: 45,
  currentBpm: 70,
  isCriticalDrift: false,
  stressReason: "Assetto Sereno",
  lastNotifiedFatigueSessionId: null,
  lastCardioDriftNotificationMs: 0,
  nowMs: 1700000000000,
};

// ── TEST 1: Sessione inerte o non attiva ──
const inactiveResult = evaluateSentinelAlarms({
  ...baseInput,
  isSessionActive: false,
  elapsedSessionMinutes: 100,
  currentBpm: 98,
});
assert.equal(inactiveResult, null, "Inactive session must never trigger alarms");

// ── TEST 2: Sessione attiva < 90 min e cardio Zen (Nessun allarme) ──
const calmResult = evaluateSentinelAlarms(baseInput);
assert.equal(calmResult, null, "Normal calm conditions must not trigger alarms");

// ── TEST 3: Allerta Affaticamento ≥ 90 minuti (Prima volta per la sessione) ──
const fatigueResult = evaluateSentinelAlarms({
  ...baseInput,
  elapsedSessionMinutes: 91,
});
assert.ok(fatigueResult !== null, "Fatigue result must be triggered at >= 90 min");
assert.equal(fatigueResult.type, "fatigue_90m");
assert.match(fatigueResult.title, /Sentinella della Presenza/);
assert.match(fatigueResult.body, /90 min raggiunta/);
assert.equal(fatigueResult.updatedFatigueSessionId, "session-alpha-123");

// ── TEST 4: Non ripete l'allerta 90 min per la medesima sessione già notificata ──
const repeatFatigueResult = evaluateSentinelAlarms({
  ...baseInput,
  elapsedSessionMinutes: 95,
  lastNotifiedFatigueSessionId: "session-alpha-123",
});
assert.equal(repeatFatigueResult, null, "Fatigue alarm must not repeat for the same session ID");

// ── TEST 5: Allerta Cardio Tachicardia / Rischio Deriva (BPM >= 92) ──
const cardioResult = evaluateSentinelAlarms({
  ...baseInput,
  currentBpm: 94,
  stressReason: "Tachicardia Operativa",
  lastCardioDriftNotificationMs: 0,
});
assert.ok(cardioResult !== null, "Cardio alarm must trigger on BPM >= 92");
assert.equal(cardioResult.type, "cardio_drift");
assert.match(cardioResult.title, /94 BPM/);
assert.equal(cardioResult.updatedCardioTimestampMs, baseInput.nowMs);

// ── TEST 6: Cooldown Debounce di 15 min per allerta cardio ──
const cardioRecentResult = evaluateSentinelAlarms({
  ...baseInput,
  currentBpm: 95,
  lastCardioDriftNotificationMs: baseInput.nowMs - (CARDIO_DEBOUNCE_MS - 1000), // 14 min fa
});
assert.equal(cardioRecentResult, null, "Cardio alarm must respect 15 min anti-spam debounce");

const cardioAfterDebounceResult = evaluateSentinelAlarms({
  ...baseInput,
  currentBpm: 95,
  lastCardioDriftNotificationMs: baseInput.nowMs - (CARDIO_DEBOUNCE_MS + 5000), // 15 min e 5 sec fa
});
assert.ok(cardioAfterDebounceResult !== null, "Cardio alarm must trigger again once cooldown expired");
assert.equal(cardioAfterDebounceResult.type, "cardio_drift");

console.log("All sentinelNotifications unit checks passed with 100% precision!");
