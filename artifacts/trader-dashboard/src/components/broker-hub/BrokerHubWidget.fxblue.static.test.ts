import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./BrokerHubWidget.tsx", import.meta.url), "utf8");

assert.match(source, /Broker Hub/);
assert.match(source, /Collega/);
assert.match(source, /Account/);
assert.doesNotMatch(source, /Ordini/);
assert.doesNotMatch(source, /Send/);
assert.doesNotMatch(source, /"order"/);

console.log("broker hub widget fx blue static checks passed");
