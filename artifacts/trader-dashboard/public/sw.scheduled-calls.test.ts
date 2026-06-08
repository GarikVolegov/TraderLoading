import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("public/sw.js", "utf8");

assert.match(source, /scheduledCall/);
assert.match(source, /requireInteraction/);
assert.match(source, /vibrate/);
assert.match(source, /actions/);
assert.match(source, /scheduledCallUrl/);

console.log("scheduled call service worker checks passed");
