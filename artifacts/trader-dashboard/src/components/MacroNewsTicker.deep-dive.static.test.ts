import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tickerSource = readFileSync(new URL("./MacroNewsTicker.tsx", import.meta.url), "utf8");

assert.match(tickerSource, /deepDive\?:/);
assert.match(tickerSource, /whatHappened: string/);
assert.match(tickerSource, /whyItMatters: string/);
assert.match(tickerSource, /possibleImpact: string/);
assert.match(tickerSource, /Cosa è successo/);
assert.match(tickerSource, /Perché influenza l'asset/);
assert.match(tickerSource, /Come può impattare/);
assert.match(tickerSource, /article\.deepDive/);
assert.match(tickerSource, /representativeMacroImageUrl/);
assert.match(tickerSource, /onError=\{\(event\) => handleMacroNewsImageError\(event, article/);
assert.doesNotMatch(tickerSource, /parentElement!\.style\.display = "none"/);
assert.doesNotMatch(tickerSource, /data:image\/svg\+xml/);
assert.doesNotMatch(tickerSource, /MACRO_IMAGE_THEMES/);

console.log("macro news ticker deep dive static checks passed");
