import assert from "node:assert/strict";
import fs from "node:fs";

// Finding (misc live-sweep): the mood-check-in labels ("Teso"/"Neutro"/...)
// were hardcoded Italian, breaking for EN/ES/FR/DE users. Fixed via uiText()
// keys — but uiText() only reflects the language active *when called*, so
// the lookup must happen inside the component's render (recomputed on every
// render), not in a module-level constant (evaluated once at import time,
// which would freeze the labels in whichever language was active on load).
const src = fs.readFileSync("src/components/routine/ZenZone.tsx", "utf8");

const moodMeta = src.slice(src.indexOf("const MOOD_META"), src.indexOf("function MoodCheckIn"));
assert.match(moodMeta, /labelKey:\s*"mood\.tense"/, "MOOD_META must reference i18n keys, not literal Italian labels");
assert.doesNotMatch(
  moodMeta,
  /uiText\(/,
  "uiText() must not be called inside the module-level MOOD_META array (would freeze the label in the load-time language)",
);
assert.match(
  src,
  /const MOODS = MOOD_META\.map\(.*uiText\(m\.labelKey\)/,
  "labels must be built inside MoodCheckIn's render (recomputed on every render) via MOOD_META.map(...)",
);

console.log("ZenZone mood i18n checks passed");
