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
// "Impatto per il trading" è passato all'i18n: chiave in pagina, copy nel catalogo.
assert.match(pageSource, /t\("news\.impact_for_trading"\)/);
assert.match(
  readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8"),
  /"news\.impact_for_trading":\s*"Impatto per il trading"/,
);

console.log("news deep dive UI static checks passed");
