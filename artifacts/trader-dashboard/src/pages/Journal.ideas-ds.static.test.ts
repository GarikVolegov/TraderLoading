import fs from "node:fs";
import assert from "node:assert/strict";

// IdeasTab (Idee + Obiettivi) is ported onto the DS: the item list sits inside a
// Card with a CardHeader (icon + title + count Badge), and the item rows use the
// DS border-t row token instead of the old bespoke standalone cards.
const src = fs.readFileSync("src/pages/Journal.tsx", "utf8");
const dictIt = fs.readFileSync("src/lib/i18n/dict.it.ts", "utf8");

// New CardHeader copy keys, present in the Italian source dict.
for (const key of [
  "journal.ideas.list_title",
  "journal.ideas.list_subtitle",
  "journal.goals.list_title",
  "journal.goals.list_subtitle",
]) {
  assert.match(dictIt, new RegExp(`"${key.replace(/\./g, "\\.")}"`), `dict.it.ts must define ${key}`);
  assert.match(src, new RegExp(`"${key.replace(/\./g, "\\.")}"`), `Journal.tsx must use ${key}`);
}

// The old bespoke idea/goal row card (border-border/30 + rounded-xl, IdeasTab-only)
// is replaced by DS border-t rows.
assert.doesNotMatch(src, /border border-border\/30 rounded-xl/,
  "IdeasTab item rows must drop the bespoke standalone-card class");

// The driver still selects idea/goal rows by the `group` class — it must survive.
assert.match(src, /group flex items-start gap-4 border-t/,
  "IdeasTab rows must keep the `group` class on a DS border-t row");

console.log("journal ideas-ds static checks passed");
