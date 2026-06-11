import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const startSource = readFileSync(new URL("./start.ts", import.meta.url), "utf8");

assert.match(
  startSource,
  /\["--filter",\s*"@workspace\/db",\s*"run",\s*"push-force"\]/,
  "local start must use the non-interactive database push command",
);
assert.doesNotMatch(
  startSource,
  /\["--filter",\s*"@workspace\/db",\s*"run",\s*"push"\]/,
  "local start must not block on the interactive database push command",
);

console.log("local start checks passed");
