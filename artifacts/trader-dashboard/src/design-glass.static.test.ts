import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

for (const cls of ["glass-bar", "glass-panel", "glass-raised", "glass-inset", "glass-glow-accent"]) {
  assert.match(css, new RegExp(`\\.${cls}[\\s,{]`), `index.css must define .${cls}`);
}
// material must use backdrop blur + tint token
assert.match(css, /backdrop-filter:\s*blur/, "glass tiers must use backdrop-filter blur");
assert.match(css, /hsl\(var\(--glass-tint\)/, "glass tiers must fill from --glass-tint");
// legacy aliases must still be defined (so existing markup keeps working)
for (const cls of ["tl-panel", "glass-card", "card-glow-primary", "metric-card"]) {
  assert.match(css, new RegExp(`\\.${cls}[\\s,{]`), `legacy .${cls} must remain defined`);
}
// graceful fallback for no backdrop-filter
assert.match(css, /@supports not/, "glass must provide an @supports fallback");

console.log("design glass static checks passed");
