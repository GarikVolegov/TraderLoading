import assert from "node:assert/strict";
import fs from "node:fs";

// Bug found live during the usability sweep (drive-onboarding.mjs): this modal
// auto-shows whenever the checklist is empty — which it always is for a brand-new
// user — with no awareness of the mandatory pair-onboarding screen. Both overlays
// are `fixed inset-0 z-[60]`/`z-60` (PairOnboardingScreen.tsx:76), so they can stack
// unpredictably; a Playwright driver clicking the onboarding's "+ EUR/USD" chip got
// its click intercepted by this modal's backdrop instead. The auto-show effect must
// wait until onboarding (pair selection) is done.
const src = fs.readFileSync("src/components/ChecklistSetupModal.tsx", "utf8");

assert.match(
  src,
  /useBackground\(\)/,
  "must read onboarding state (selectedPairs/settingsLoaded) from useBackground()",
);
assert.match(
  src,
  /settingsLoaded\s*&&\s*selectedPairs\.length\s*>\s*0/,
  "must compute an onboarding-done flag gated on settingsLoaded (not just selectedPairs) to avoid a race on the initial render",
);

const effect = src.slice(src.indexOf("useEffect(() => {"), src.indexOf("useEffect(() => {") + 400);
assert.match(
  effect,
  /onboardingDone/,
  "the auto-show effect must gate on the onboarding-done flag — never show while pair onboarding is still pending",
);

console.log("ChecklistSetupModal static checks passed");
