import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./BrokerHubWorkspace.tsx", import.meta.url), "utf8");
const i18nDict = await readFile(new URL("../../lib/i18n/dict.it.ts", import.meta.url), "utf8");

assert.match(source, /ConnectAccountWizard/);
// Il badge "Sola lettura" è passato all'i18n e resta legato a !capabilities.placeOrders.
assert.match(source, /uiText\("auto\.ui\.6c3cdfe1cc"\)/);
assert.match(i18nDict, /"auto\.ui\.6c3cdfe1cc":\s*"Sola lettura"/);
assert.doesNotMatch(source, /Terminale/);
assert.doesNotMatch(source, /Ordini/);
assert.doesNotMatch(source, /Ticket ordine/);
assert.doesNotMatch(source, /hub\.placeOrder/);
assert.doesNotMatch(source, /hub\.closePosition/);
assert.doesNotMatch(source, /Invia live/);

console.log("broker hub workspace fx blue static checks passed");
