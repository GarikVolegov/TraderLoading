import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { readSettingsFeatureSource } from "./settingsFeatureSource";

const dashboard = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");
const settings = readSettingsFeatureSource();

assert.match(dashboard, /URLSearchParams\(window\.location\.search\)\.get\("layout"\) === "edit"/);
assert.doesNotMatch(dashboard, />\s*Layout\s*</);
assert.match(settings, /auto\.ui\.4432b3c245/);
assert.match(settings, /navigate\("\/\?layout=edit"\)/);

const itDict = readFileSync(new URL("../lib/i18n/dict.it.ts", import.meta.url), "utf8");
assert.match(itDict, /"auto\.ui\.4432b3c245":\s*"Modifica layout dashboard"/);

console.log("dashboard layout settings entry checks passed");
