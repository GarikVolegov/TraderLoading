import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/pages/Journal.tsx", "utf8");
assert.match(src, /parseJournalTab\(search\)/, "tab comes from the URL");
assert.match(src, /updateWorkspaceQuery/, "view switches preserve unrelated query context");
assert.match(src, /<SectionTabs/, "local navigation keeps global destinations available");
for (const tab of ["panoramica", "trades", "piano", "revisione"]) {
  assert.match(src, new RegExp(`tab === "${tab}"`));
}
assert.match(src, /<JournalPlan/);
assert.match(src, /<RecapTab key=/, "recap state belongs to its kind and period");
assert.match(src, /<BrokerWorkspace/, "accounts remain available inside Trade");
console.log("journal workspace checks passed");
