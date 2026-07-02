import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./BrokerHubWidget.tsx", import.meta.url), "utf8");
const i18nDict = await readFile(new URL("../../lib/i18n/dict.it.ts", import.meta.url), "utf8");

// Il titolo "Broker Hub" è passato all'i18n: chiave nel widget, copy nel catalogo.
assert.match(source, /uiText\("auto\.ui\.56c86a8f0d"\)/);
assert.match(i18nDict, /"auto\.ui\.56c86a8f0d":\s*"Broker Hub"/);
assert.match(source, /Collega/);
assert.match(source, /Account/);
assert.doesNotMatch(source, /Ordini/);
assert.doesNotMatch(source, /Send/);
assert.doesNotMatch(source, /"order"/);

console.log("broker hub widget fx blue static checks passed");
