import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const {
  calculateRoutineQualityScore,
  buildRoutineCompetitionRows,
} = await import("./routines.js");

assert.equal(calculateRoutineQualityScore({}), 0);
assert.equal(calculateRoutineQualityScore({ emotion: "calm", goals: ["risk", "focus"], note: "ready" }), 60);
assert.equal(calculateRoutineQualityScore({ a: "1", b: "2", c: "3", d: "4", e: "5", f: "6" }), 100);

const rows = buildRoutineCompetitionRows({
  users: [
    { userId: "me", name: "Osman", avatarUrl: null },
    { userId: "friend-a", name: "Ari", avatarUrl: null },
  ],
  completions: [
    { userId: "friend-a", completionDate: "2026-06-07", qualityScore: 80 },
    { userId: "friend-a", completionDate: "2026-06-06", qualityScore: 90 },
    { userId: "me", completionDate: "2026-06-07", qualityScore: 100 },
  ],
  currentUserId: "me",
  today: "2026-06-07",
});

assert.deepEqual(
  rows.map((row) => [row.rank, row.name, row.totalCompletions, row.currentStreakDays, row.avgQualityScore, row.score, row.isCurrentUser]),
  [
    [1, "Ari", 2, 2, 85, 185, false],
    [2, "Osman", 1, 1, 100, 155, true],
  ],
);

console.log("routine competition route checks passed");
