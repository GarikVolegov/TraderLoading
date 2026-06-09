import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../index.css", import.meta.url), "utf8");
const tickerSource = readFileSync(new URL("./MacroNewsTicker.tsx", import.meta.url), "utf8");

assert.match(css, /\.animate-marquee\s*\{\s*animation:\s*marquee var\(--marquee-duration,\s*30s\) linear infinite;/);
assert.match(css, /\.animate-marquee:hover\s*\{\s*animation-play-state:\s*paused;/);
assert.match(tickerSource, /MARQUEE_PIXELS_PER_SECOND/);
assert.match(tickerSource, /scrollWidth\s*\/\s*2/);
assert.match(tickerSource, /setMarqueeDurationSeconds/);
assert.match(tickerSource, /style=\{marqueeStyle\}/);
assert.match(tickerSource, /ref=\{marqueeTrackRef\}/);
assert.match(tickerSource, /className="inline-flex animate-marquee gap-8"/);

console.log("macro news ticker speed static checks passed");
