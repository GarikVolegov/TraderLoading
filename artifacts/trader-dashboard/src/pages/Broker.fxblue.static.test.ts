import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const brokerPage = await readFile(new URL("./Broker.tsx", import.meta.url), "utf8");
const cloudConnect = await readFile(new URL("../components/broker-hub/CloudAccountConnect.tsx", import.meta.url), "utf8");

assert.match(brokerPage, /BrokerHubWorkspace/);
assert.match(brokerPage, /FX Blue Account Sync/);
assert.doesNotMatch(brokerPage, /CloudAccountConnect/);
assert.doesNotMatch(brokerPage, /Opzioni avanzate/);
assert.doesNotMatch(brokerPage, /MetaTrader senza installare nulla/);

assert.match(cloudConnect, /FxBlueAccountSyncWizard/);
assert.match(cloudConnect, /FX Blue Account Sync/);
assert.doesNotMatch(cloudConnect, /createConnectionIntent/);
assert.doesNotMatch(cloudConnect, /completeConnectionIntent/);
assert.doesNotMatch(cloudConnect, /MetaApi/);

console.log("broker page fx blue static checks passed");
