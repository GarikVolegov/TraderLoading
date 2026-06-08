import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("./Settings.tsx", import.meta.url), "utf8");

assert.match(dashboard, /URLSearchParams\(window\.location\.search\)\.get\("layout"\) === "edit"/);
assert.doesNotMatch(dashboard, />\s*Layout\s*</);
assert.match(settings, /Modifica layout dashboard/);
assert.match(settings, /navigate\("\/\?layout=edit"\)/);

console.log("dashboard layout settings entry checks passed");
