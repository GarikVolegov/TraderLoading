import assert from "node:assert/strict";
import {
  appendRoutineCompletion,
  createCustomRoutine,
  getRoutineMetrics,
  loadCustomRoutines,
  loadRoutineCompletions,
  readMoodForDate,
  ROUTINE_CUSTOM_KEY,
  ROUTINE_HISTORY_KEY,
  saveMoodForDate,
  ZEN_MOOD_KEY,
} from "./Routine.storage.js";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

const storage = new MemoryStorage() as Storage;

assert.deepEqual(loadCustomRoutines(storage), []);
assert.deepEqual(loadRoutineCompletions(storage), []);

const custom = createCustomRoutine(
  {
    title: "Pre market focus",
    description: "Routine prima della sessione NY",
    template: "morning",
    timeLabel: "14:00",
  },
  storage,
  new Date("2026-06-07T08:00:00.000Z"),
);

assert.equal(custom.title, "Pre market focus");
assert.equal(custom.template, "morning");
assert.match(custom.id, /^custom-/);
assert.equal(loadCustomRoutines(storage).length, 1);

appendRoutineCompletion(
  {
    routineId: "morning",
    routineTitle: "Programma Mattutino",
    template: "morning",
    answers: { emotion: "calm" },
  },
  storage,
  new Date("2026-06-06T08:30:00.000Z"),
);

appendRoutineCompletion(
  {
    routineId: custom.id,
    routineTitle: custom.title,
    template: custom.template,
    answers: { emotion: "confident" },
  },
  storage,
  new Date("2026-06-07T08:30:00.000Z"),
);

const completions = loadRoutineCompletions(storage);
assert.equal(completions.length, 2);
assert.equal(completions[1].routineId, custom.id);
assert.equal(completions[1].date, "2026-06-07");

const metrics = getRoutineMetrics(completions, loadCustomRoutines(storage));
assert.equal(metrics.totalCompletions, 2);
assert.equal(metrics.customRoutineCount, 1);
assert.equal(metrics.currentStreakDays, 2);
assert.equal(metrics.byRoutine.length, 2);
assert.deepEqual(
  metrics.byRoutine.map((item) => [item.routineId, item.completions]),
  [["morning", 1], [custom.id, 1]],
);

storage.setItem(ROUTINE_CUSTOM_KEY, "not-json");
storage.setItem(ROUTINE_HISTORY_KEY, "not-json");
assert.deepEqual(loadCustomRoutines(storage), []);
assert.deepEqual(loadRoutineCompletions(storage), []);

console.log("routine storage checks passed");

// ── Zen mood check-in persistence ────────────────────────────────────────────
{
  const moodStorage = new MemoryStorage() as Storage;
  const today = new Date("2026-07-12T09:00:00Z");
  const yesterday = new Date("2026-07-11T09:00:00Z");

  assert.equal(readMoodForDate(today, moodStorage), null);

  saveMoodForDate("calm", today, moodStorage);
  assert.equal(readMoodForDate(today, moodStorage), "calm");
  assert.equal(readMoodForDate(yesterday, moodStorage), null);

  // Same-day re-selection overwrites instead of appending.
  saveMoodForDate("tense", today, moodStorage);
  assert.equal(readMoodForDate(today, moodStorage), "tense");
  assert.equal(
    (JSON.parse(moodStorage.getItem(ZEN_MOOD_KEY) ?? "[]") as unknown[]).length,
    1,
  );

  saveMoodForDate("tired", yesterday, moodStorage);
  assert.equal(readMoodForDate(yesterday, moodStorage), "tired");

  // Corrupted payload degrades to "no mood recorded".
  moodStorage.setItem(ZEN_MOOD_KEY, "not-json");
  assert.equal(readMoodForDate(today, moodStorage), null);

  console.log("zen mood storage checks passed");
}
