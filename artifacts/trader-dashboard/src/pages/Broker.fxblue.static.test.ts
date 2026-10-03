import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const brokerPage = await readFile(new URL("./Broker.tsx", import.meta.url), "utf8");
const cloudConnect = await readFile(new URL("../components/broker-hub/CloudAccountConnect.tsx", import.meta.url), "utf8");
const i18nDict = await readFile(new URL("../lib/i18n/dict.it.ts", import.meta.url), "utf8");

assert.match(brokerPage, /BrokerHubWorkspace/);
// Il sottotitolo "solo FX Blue Account Sync" è passato all'i18n.
assert.match(brokerPage, /t\("page\.broker\.subtitle"\)/);
assert.match(i18nDict, /"page\.broker\.subtitle":\s*"[^"]*FX Blue Account Sync"/);
assert.doesNotMatch(brokerPage, /CloudAccountConnect/);
assert.doesNotMatch(brokerPage, /Opzioni avanzate/);
assert.doesNotMatch(brokerPage, /MetaTrader senza installare nulla/);

assert.match(cloudConnect, /FxBlueAccountSyncWizard/);
// "Solo FX Blue Account Sync" e "Sola lettura" sono passati all'i18n.
assert.match(cloudConnect, /uiText\("auto\.ui\.3c4819ed3b"\)/);
assert.match(i18nDict, /"auto\.ui\.3c4819ed3b":\s*"[^"]*FX Blue Account Sync[^"]*"/);
assert.doesNotMatch(cloudConnect, /createConnectionIntent/);
assert.doesNotMatch(cloudConnect, /completeConnectionIntent/);
assert.doesNotMatch(cloudConnect, /MetaApi/);

console.log("broker page fx blue static checks passed");
