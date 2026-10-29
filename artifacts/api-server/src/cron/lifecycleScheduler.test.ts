import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./lifecycleScheduler.ts", import.meta.url), "utf8");

assert.match(source, /tryAcquireLock\(`cron:email-lifecycle:\$\{dayKey\}`/);
assert.match(source, /tryAcquireLock\(`cron:launch-emails:\$\{bucket\}`/);
assert.match(source, /task\.stop\(\)/);
assert.match(source, /launchTask\.stop\(\)/);

console.log("lifecycle scheduler distributed locking checks passed");
