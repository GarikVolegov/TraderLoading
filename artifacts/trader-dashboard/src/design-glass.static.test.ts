import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

for (const cls of ["glass-bar", "glass-panel", "glass-raised", "glass-inset", "glass-glow-accent"]) {
  assert.match(css, new RegExp(`\\.${cls}[\\s,{]`), `index.css must define .${cls}`);
}
// Historical material names now share opaque panels and quiet borders.
assert.match(css, /background: hsl\(var\(--card\)\)/);
assert.match(css, /border: 1px solid hsl\(var\(--border\)\)/);
assert.doesNotMatch(css, /backdrop-filter|--glass-alpha/, "content surfaces are opaque, without layered blur");
// legacy aliases must still be defined (so existing markup keeps working)
for (const cls of ["tl-panel", "glass-card", "card-glow-primary", "metric-card"]) {
  assert.match(css, new RegExp(`\\.${cls}[\\s,{]`), `legacy .${cls} must remain defined`);
}
console.log("shared opaque material checks passed");
