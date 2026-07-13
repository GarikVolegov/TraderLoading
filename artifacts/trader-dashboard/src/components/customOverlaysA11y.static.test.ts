import assert from "node:assert/strict";
import fs from "node:fs";

// Audit finding (a11y, ALTA): ~11 custom overlays (`fixed inset-0` divs outside
// components/ui/dialog) had no dialog semantics, focus-trap, or Escape handling.
// Each must now consume the shared hook extracted from components/ui/modal.tsx.
const FILES = [
  "src/components/SessionCheckinModal.tsx",
  "src/components/UserProfileModal.tsx",
  "src/components/ChecklistSetupModal.tsx",
  "src/components/LevelRewardModal.tsx",
  "src/components/ReviewPromptModal.tsx",
  "src/components/routine/SessionModal.tsx",
  "src/components/ScheduledCallOverlay.tsx",
  "src/components/social/CreateCommunityModal.tsx",
  "src/components/social/CreatePostModal.tsx",
  "src/components/social/CreateChannelModal.tsx",
  "src/components/social/CommunitySettingsModal.tsx",
  "src/components/social/UserProfileModal.tsx",
];

for (const file of FILES) {
  const src = fs.readFileSync(file, "utf8");
  assert.match(src, /useDialogA11y/, `${file} must consume the useDialogA11y hook`);
  assert.match(src, /panelRef/, `${file} must attach panelRef to its overlay panel`);
  assert.match(src, /aria-labelledby=\{titleId\}/, `${file} must label its panel via titleId`);
  assert.match(src, /id=\{titleId\}/, `${file} must set id={titleId} on its title element`);
}

console.log(`custom overlay a11y checks passed (${FILES.length} files)`);
