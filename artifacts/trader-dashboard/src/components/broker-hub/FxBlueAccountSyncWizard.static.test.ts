import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./FxBlueAccountSyncWizard.tsx", import.meta.url), "utf8");
const i18nDict = await readFile(new URL("../../lib/i18n.ts", import.meta.url), "utf8");

assert.match(source, /FX Blue Account Sync/);
assert.match(source, /https:\/\/diagnostics\.fxblue\.com\/accountsync\.aspx/);
assert.match(source, /password investor\/read-only/i);
// L'avviso sulla password master è passato all'i18n: chiave nel wizard, copy nel catalogo.
assert.match(source, /uiText\("auto\.ui\.f3e32e2b66"\)/);
assert.match(i18nDict, /"auto\.ui\.f3e32e2b66":\s*"[^"]*Non inserire la password master/);
assert.match(source, /Sola lettura/);
assert.match(source, /uiText\("fxblue\.existing_title"\)/);
assert.match(i18nDict, /"fxblue\.existing_title":\s*"Hai già configurato FX Blue\?"/);
assert.match(source, /Collega profilo già sincronizzato/);
assert.match(source, /connectExistingSync/);
assert.match(source, /createFxBlueSetupIntent/);
assert.match(source, /verifyFxBlueProfile/);
assert.match(source, /completeFxBlueSetupIntent/);
assert.match(source, /const existingSyncReady = Boolean\(fxBlueProfileRef\.trim\(\)\)/);
assert.match(source, /fxBlueProfileRef: fxBlueProfileRef\.trim\(\)/);
assert.equal(source.includes("placeOrder("), false);
assert.equal(source.includes("tradingEnabled: true"), false);

console.log("fx blue account sync wizard static checks passed");
