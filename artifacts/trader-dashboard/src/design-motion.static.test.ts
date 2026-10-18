import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

// named vocabulary present
for (const cls of [
  "animate-fade-in-up", "animate-scale-in", "animate-float",
  "animate-glow-pulse", "animate-border-glow", "animate-shimmer", "card-hover",
]) {
  assert.match(css, new RegExp(`\\.${cls}[\\s,:{]`), `index.css must define .${cls}`);
}
// motion tokens are actually referenced (not hardcoded everywhere)
assert.match(css, /var\(--ease-glass\)/, "animations should use --ease-glass");
assert.match(css, /\.card-hover\s*\{[^}]*border-color var\(--dur-base\) var\(--ease-out\)/, "interactive cards use a restrained border transition");
assert.doesNotMatch(css, /animation:\s*(?:float|glow-pulse|border-spin)[^;]*infinite/, "decorative motion must not loop");
// reduced-motion guard still present
assert.match(css, /prefers-reduced-motion:\s*reduce/, "reduced-motion guard required");

console.log("design motion static checks passed");
