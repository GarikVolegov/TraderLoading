import fs from "node:fs";
import assert from "node:assert/strict";

const journal = fs.readFileSync("src/pages/Journal.tsx", "utf8");
const i18n = fs.readFileSync("src/lib/i18n/dict.it.ts", "utf8");

for (const token of [
  "overallJudgment",
  "wentWell",
  "wentWrong",
  "improvements",
  "patterns",
  "focusAreas",
  "nextPeriodExpectations",
  "nextPeriodGoals",
  "fetchJournalRecap",
  "saveJournalRecap",
]) {
  assert.match(journal, new RegExp(token));
}

assert.match(i18n, /Recap 4 settimane/);
assert.match(i18n, /Giudizio generale/);
assert.match(i18n, /Pattern individuati/);

console.log("journal recap UI static checks passed");
