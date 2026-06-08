import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./ConnectAccountWizard.tsx", import.meta.url), "utf8");

assert.match(source, /FxBlueAccountSyncWizard/);
assert.match(source, /FX Blue Account Sync/);
assert.match(source, /Sola lettura/);
assert.match(source, /return \(\s*<div className="grid gap-4 xl:grid-cols-\[minmax\(0,1fr\)_340px\]">/);
assert.doesNotMatch(source, /BROKER_CHOICES/);
assert.doesNotMatch(source, /SmartLink/);
assert.doesNotMatch(source, /createConnectionIntent/);
assert.doesNotMatch(source, /startMt5SmartLink/);
assert.doesNotMatch(source, /importBrokerHistory/);
assert.doesNotMatch(source, /createCompanionPairing/);

console.log("connect account wizard fx blue static checks passed");
