import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const tickerSource = readFileSync(new URL("./MacroNewsTicker.tsx", import.meta.url), "utf8");

assert.match(css, /\.animate-marquee\s*\{\s*animation:\s*marquee 420s linear infinite;/);
assert.match(css, /\.animate-marquee:hover\s*\{\s*animation-play-state:\s*paused;/);
assert.match(tickerSource, /className="inline-flex animate-marquee gap-8"/);

console.log("macro news ticker speed static checks passed");
