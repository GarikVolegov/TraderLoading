import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./Sparkline.tsx", import.meta.url), "utf8");

// Token discipline: no raw kit HSL literals.
assert.equal(src.includes("142 71% 45%"), false, "no raw success HSL");
assert.equal(src.includes("0 84% 60%"), false, "no raw destructive HSL");
// Uses tokenized stroke colors.
assert.match(src, /var\(--success\)/);
assert.match(src, /var\(--destructive\)/);
assert.match(src, /var\(--primary\)/);
// Renders an SVG path.
assert.match(src, /<path/);
// Guards a degenerate range (no divide-by-zero).
assert.match(src, /\|\| 1/);
console.log("Sparkline static checks passed");
