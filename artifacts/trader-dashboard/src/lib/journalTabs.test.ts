import assert from "node:assert/strict";
import { parseJournalTab, parseJournalPlanView, parseJournalRecapKind } from "./journalTabs";

for (const tab of ["sessioni", "panoramica", "trades", "piano", "revisione"] as const) {
  assert.equal(parseJournalTab(`?t=${tab}`), tab);
}
assert.equal(parseJournalTab(""), "sessioni");
assert.equal(parseJournalTab("?new=1"), "trades");
assert.equal(parseJournalTab("?t=unknown"), "panoramica");
assert.equal(parseJournalTab("t=trades&pair=EURUSD"), "trades");
for (const legacy of ["idee", "obiettivi", "idee-obiettivi"]) {
  assert.equal(parseJournalTab(`?t=${legacy}`), "piano");
  assert.equal(parseJournalPlanView(`?t=${legacy}`), "idee-obiettivi");
}
for (const legacy of ["recap-settimanale", "recap-mensile"]) {
  assert.equal(parseJournalTab(`?t=${legacy}`), "revisione");
}
assert.equal(parseJournalRecapKind("?t=recap-mensile"), "four_week");
assert.equal(parseJournalRecapKind("?t=recap-settimanale"), "weekly");
assert.equal(parseJournalRecapKind("?t=revisione&kind=four_week&period=2026-08-03"), "four_week");
assert.equal(parseJournalRecapKind("?kind=bogus"), "weekly");
assert.equal(parseJournalPlanView("?t=piano&vista=agenda"), "agenda");
assert.equal(parseJournalPlanView("?t=piano&vista=idee-obiettivi"), "idee-obiettivi");
assert.equal(parseJournalPlanView("?t=piano&vista=bogus"), "oggi");
console.log("journal workspace URL checks passed");
