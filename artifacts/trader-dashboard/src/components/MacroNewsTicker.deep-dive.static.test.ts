import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const tickerSource = readFileSync(new URL("./MacroNewsTicker.tsx", import.meta.url), "utf8");

assert.match(tickerSource, /deepDive\?:/);
assert.match(tickerSource, /whatHappened: string/);
assert.match(tickerSource, /whyItMatters: string/);
assert.match(tickerSource, /possibleImpact: string/);
assert.match(tickerSource, /Cosa e' successo/);
assert.match(tickerSource, /Perche' influenza l'asset/);
assert.match(tickerSource, /Come puo' impattare/);
assert.match(tickerSource, /article\.deepDive/);

console.log("macro news ticker deep dive static checks passed");
