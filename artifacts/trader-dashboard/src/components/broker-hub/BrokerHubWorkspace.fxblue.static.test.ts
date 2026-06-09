import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./BrokerHubWorkspace.tsx", import.meta.url), "utf8");

assert.match(source, /ConnectAccountWizard/);
assert.match(source, /Sola lettura/);
assert.doesNotMatch(source, /Terminale/);
assert.doesNotMatch(source, /Ordini/);
assert.doesNotMatch(source, /Ticket ordine/);
assert.doesNotMatch(source, /hub\.placeOrder/);
assert.doesNotMatch(source, /hub\.closePosition/);
assert.doesNotMatch(source, /Invia live/);

console.log("broker hub workspace fx blue static checks passed");
