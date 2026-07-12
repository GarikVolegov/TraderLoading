import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pageSource = readFileSync(new URL("./News.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../lib/newsApi.ts", import.meta.url), "utf8");

assert.match(apiSource, /deepDive\?:/);
assert.match(apiSource, /whatHappened: string/);
assert.match(apiSource, /whyItMatters: string/);
assert.match(apiSource, /possibleImpact: string/);

// "Cosa è successo" / "Perché influenza l'asset" / "Come può impattare" sono
// passate all'i18n (chiave in pagina, copy nel catalogo) — stessa convenzione
// di "Impatto per il trading" sotto.
assert.match(pageSource, /uiText\("auto\.ui\.814395b5a9"\)/);
assert.match(pageSource, /uiText\("auto\.ui\.3c4f0698e2"\)/);
assert.match(pageSource, /uiText\("auto\.ui\.cf43d6477f"\)/);
assert.match(pageSource, /article\.deepDive/);
assert.match(pageSource, /t\("news\.impact_for_trading"\)/);

const itDict = readFileSync(new URL("../lib/i18n/dict.it.ts", import.meta.url), "utf8");
assert.match(itDict, /"news\.impact_for_trading":\s*"Impatto per il trading"/);
assert.match(itDict, /"auto\.ui\.814395b5a9":\s*"Cosa è successo"/);
assert.match(itDict, /"auto\.ui\.3c4f0698e2":\s*"Perché influenza l'asset"/);
assert.match(itDict, /"auto\.ui\.cf43d6477f":\s*"Come può impattare"/);

console.log("news deep dive UI static checks passed");
