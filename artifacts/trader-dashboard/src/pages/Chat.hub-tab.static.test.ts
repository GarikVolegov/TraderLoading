import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/pages/Chat.tsx", "utf8");

// Chat's in-page tab strip (social/messaggi/comunita/classifica) duplicated
// exactly what the Community hub in the contextual bottom nav already shows —
// removed in favor of the nav owning tab switching.
assert.doesNotMatch(src, /tabs\.map\(/, "the in-page tab-strip render loop must be removed");
assert.doesNotMatch(src, /border-b-2 border-primary/, "no leftover in-page tab-strip active-state styling");

// The active tab is still derived from the URL (?t=…) so nav links deep-link
// straight into a specific tab, and content still switches accordingly.
assert.match(src, /parseChatTab\(useSearch\(\)\)/,
  "active tab must still be read from the ?t= search param");
for (const tab of ["social", "messaggi", "comunita", "classifica"]) {
  assert.match(src, new RegExp(`activeTab === "${tab}"`), `content still switches on activeTab === "${tab}"`);
}

console.log("Chat hub-tab static checks passed");
