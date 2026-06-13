import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./QuoteWidget.tsx", import.meta.url), "utf8");

assert.doesNotMatch(
  source,
  /<AnimatePresence mode="wait">\s*\{\s*quote\s*\?/s,
  'QuoteWidget should not animate the full card with AnimatePresence mode="wait"',
);

assert.match(
  source,
  /<AnimatePresence initial=\{false\} mode="wait">/,
  "QuoteWidget should animate only quote content after the first quote renders",
);

assert.match(
  source,
  /key=\{`\$\{quote\.text\}\s*::\s*\$\{quote\.author \?\? ""\}`\}/,
  "Animated quote content should be keyed by text and author",
);

assert.match(
  source,
  /<div className="relative rounded-2xl border border-border\/30 bg-card\/60 backdrop-blur-sm px-5 py-4 overflow-hidden group hover:border-primary\/25 transition-all duration-300">/,
  "The styled quote card shell should remain a stable non-keyed div",
);

console.log("quote widget animation static checks passed");
