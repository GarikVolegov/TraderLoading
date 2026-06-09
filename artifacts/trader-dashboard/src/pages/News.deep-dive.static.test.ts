import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("./News.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../lib/newsApi.ts", import.meta.url), "utf8");

assert.match(apiSource, /deepDive\?:/);
assert.match(apiSource, /whatHappened: string/);
assert.match(apiSource, /whyItMatters: string/);
assert.match(apiSource, /possibleImpact: string/);

assert.match(pageSource, /Cosa è successo/);
assert.match(pageSource, /Perché influenza l'asset/);
assert.match(pageSource, /Come può impattare/);
assert.match(pageSource, /article\.deepDive/);
assert.match(pageSource, /Impatto per il trading/);

console.log("news deep dive UI static checks passed");
