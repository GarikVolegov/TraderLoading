import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./tools.ts", import.meta.url), "utf8");

// The RSS fallback must produce a context-aware risk summary, not a feed-source list.
assert.doesNotMatch(source, /summary: `Notizie in tempo reale da/);
assert.match(source, /buildMacroTickerSummary/);

console.log("macro news fallback summary static checks passed");
