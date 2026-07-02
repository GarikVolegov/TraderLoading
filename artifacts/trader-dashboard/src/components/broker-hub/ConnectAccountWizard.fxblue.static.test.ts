import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./ConnectAccountWizard.tsx", import.meta.url), "utf8");
const i18nDict = await readFile(new URL("../../lib/i18n/dict.it.ts", import.meta.url), "utf8");

assert.match(source, /FxBlueAccountSyncWizard/);
// La copy informativa è passata all'i18n: FX Blue unico metodo, connessione in Sola lettura.
assert.match(source, /uiText\("auto\.ui\.5ce1c6b130"\)/);
assert.match(i18nDict, /"auto\.ui\.5ce1c6b130":\s*"FX Blue Account Sync è l'unico metodo/);
assert.match(source, /uiText\("auto\.ui\.7dec2397a6"\)/);
assert.match(i18nDict, /"auto\.ui\.7dec2397a6":\s*"La connessione resta in Sola lettura/);
assert.match(source, /return \(\s*<div className="grid gap-4 xl:grid-cols-\[minmax\(0,1fr\)_340px\]">/);
assert.doesNotMatch(source, /BROKER_CHOICES/);
assert.doesNotMatch(source, /SmartLink/);
assert.doesNotMatch(source, /createConnectionIntent/);
assert.doesNotMatch(source, /startMt5SmartLink/);
assert.doesNotMatch(source, /importBrokerHistory/);
assert.doesNotMatch(source, /createCompanionPairing/);

console.log("connect account wizard fx blue static checks passed");
