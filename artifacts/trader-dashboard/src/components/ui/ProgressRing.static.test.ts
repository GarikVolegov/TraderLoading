import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./ProgressRing.tsx", import.meta.url), "utf8");
assert.match(src, /strokeDashoffset/);
assert.match(src, /var\(--primary\)/);
assert.match(src, /Math\.max\(0, Math\.min\(100/); // value clamped
assert.match(src, /prefers-reduced-motion|reduced/i); // motion guard referenced
console.log("ProgressRing static checks passed");
