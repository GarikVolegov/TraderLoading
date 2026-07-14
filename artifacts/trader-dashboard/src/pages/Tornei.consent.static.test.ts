import assert from "node:assert/strict";
import fs from "node:fs";

// Finding (live tornei driver): enrollTornei's `consent` param is recorded
// server-side as the user's agreement to the contest rules + public
// pseudonymous leaderboard (i18n key "tornei.consent", defined in all 5
// dicts) — but it was hardcoded `true` on every enroll click with no consent
// UI ever shown. The user must actually confirm before consent is recorded.
const src = fs.readFileSync("src/pages/Tornei.tsx", "utf8");

assert.match(
  src,
  /window\.confirm\(t\("tornei\.consent"\)\)/,
  "enrolling must show the consent text and require confirmation before recording consent:true",
);
assert.match(src, /onEnroll=\{handleEnroll\}/, "both enroll CTAs (Arena + Percorso) must route through the consent gate");
assert.doesNotMatch(
  src,
  /onEnroll=\{\(\) => enrollMutation\.mutate\(\)\}/,
  "no enroll CTA may call enrollMutation.mutate() directly, bypassing the consent confirmation",
);

console.log("tornei consent gate checks passed");
