import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/pages/Chat.tsx", "utf8");

// Global destinations stay stable; local navigation owns the three Social spaces.
assert.match(src, /<SectionTabs/);
assert.match(src, /value=\{location\.tab\}/);
assert.doesNotMatch(src, /pendingChat/, "a requested DM must survive reload via its URL");

// The active tab is still derived from the URL (?t=…) so nav links deep-link
// straight into a specific tab, and content still switches accordingly.
assert.match(src, /parseSocialLocation\(useSearch\(\)\)/,
  "active tab must still be read from the ?t= search param");
for (const tab of ["social", "conversazioni", "competizioni"]) {
  assert.match(src, new RegExp(`location.tab === "${tab}"`), `content switches on ${tab}`);
}
assert.match(src, /location\.competitionView === "xp"[\s\S]*ProUpgradeGate feature="leaderboard"[\s\S]*: <TorneiWorkspace embedded/,
  "the XP paywall must not block the tournament workspace");
assert.match(src, /lazy\(\(\) => import\("@\/components\/social\/ConversationsWorkspace"\)\)/);

console.log("Chat hub-tab static checks passed");
