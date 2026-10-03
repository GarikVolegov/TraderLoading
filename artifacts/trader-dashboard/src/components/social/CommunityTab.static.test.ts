import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./CommunityTab.tsx", import.meta.url), "utf8");

// Adversarial-review findings (2026-07-14):
// 1. joinCommunity/leaveCommunity swallowed errors silently (notify: false) —
//    the exact pattern already fixed one file over in CommunityGeneralSettings.
assert.doesNotMatch(src, /context: "community join", notify: false/);
assert.doesNotMatch(src, /context: "community leave", notify: false/);
assert.match(src, /context: "community join", toast, fallbackMessage: t\("errors\.mutation\.generic"\)/);
assert.match(src, /context: "community leave", toast, fallbackMessage: t\("errors\.mutation\.generic"\)/);

// 2. The auto-select-first-channel effect depended only on communityDetail?.id,
//    so a same-id background refetch that flips channels from absent (cover-only,
//    pending join) to populated (approved) never re-ran it — the content pane
//    stayed on the empty placeholder despite the now-unlocked sidebar.
assert.match(
  src,
  /\[communityDetail\?\.id, communityDetail\?\.channels\?\.length, selectedChannelId\]/,
);

console.log("CommunityTab static checks passed");
