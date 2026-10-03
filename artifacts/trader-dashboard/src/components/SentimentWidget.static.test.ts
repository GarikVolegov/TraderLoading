import assert from "node:assert/strict";
import fs from "node:fs";

// Without MYFXBOOK_EMAIL/PASSWORD the backend serves static demo numbers as
// real sentiment data (finding: misleading, only a 9px caption disclosed it).
// The widget must hide itself entirely instead of showing demo data as real.
const src = fs.readFileSync("src/components/SentimentWidget.tsx", "utf8");

assert.match(
  src,
  /if\s*\(data\s*&&\s*!data\.hasCredentials\)\s*return null;/,
  "the widget must return null when the sentiment data has no real credentials behind it",
);
assert.doesNotMatch(
  src,
  /Dati dimostrativi/,
  "the old 'demo data' disclosure caption must be removed now that the widget hides itself instead",
);

console.log("SentimentWidget static checks passed");
