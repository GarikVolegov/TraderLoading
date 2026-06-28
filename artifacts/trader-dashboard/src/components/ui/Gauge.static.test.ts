import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./Gauge.tsx", import.meta.url), "utf8");
assert.equal(src.includes("0 84% 60%"), false, "no raw destructive HSL");
assert.match(src, /var\(--destructive\)/);
assert.match(src, /var\(--warning\)/);
assert.match(src, /var\(--success\)/);
assert.match(src, /Math\.max\(0, Math\.min\(100/); // clamped
console.log("Gauge static checks passed");
