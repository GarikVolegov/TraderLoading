import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("./MacroNewsTicker.tsx", import.meta.url), "utf8");
assert.doesNotMatch(source, /animate-marquee|MARQUEE_PIXELS_PER_SECOND|setInterval/);
assert.match(source, /min-h-11/);
assert.match(source, /truncate/);
console.log("macro preview speed checks passed");
