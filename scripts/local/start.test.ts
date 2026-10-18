import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const startSource = readFileSync(new URL("./start.ts", import.meta.url), "utf8");

assert.doesNotMatch(
  startSource,
  /\["--filter",\s*"@workspace\/db",\s*"run",\s*"(?:push-force|push|migrate)"\]/,
  "local start must never change the database schema",
);
assert.match(startSource, /await checkTcp\("127\.0\.0\.1", port\)/, "port checks must work on macOS too");
assert.doesNotMatch(startSource, /(?:unlink|rm).*postmaster\.pid/, "never remove a database process lock");

console.log("local start checks passed");
