import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./FxBlueAccountSyncWizard.tsx", import.meta.url), "utf8");

assert.match(source, /FX Blue Account Sync/);
assert.match(source, /https:\/\/diagnostics\.fxblue\.com\/accountsync\.aspx/);
assert.match(source, /password investor\/read-only/i);
assert.match(source, /Non inserire la password master/);
assert.match(source, /Sola lettura/);
assert.match(source, /createFxBlueSetupIntent/);
assert.match(source, /verifyFxBlueProfile/);
assert.match(source, /completeFxBlueSetupIntent/);
assert.equal(source.includes("placeOrder("), false);
assert.equal(source.includes("tradingEnabled: true"), false);

console.log("fx blue account sync wizard static checks passed");
