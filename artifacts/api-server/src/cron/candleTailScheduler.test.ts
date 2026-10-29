import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./candleTailScheduler.ts", import.meta.url), "utf8");

assert.match(source, /tryAcquireLock\(`cron:candle-tail:\$\{bucket\}`/);
assert.match(source, /task\.stop\(\)/);
assert.match(source, /PRIORITY_HISTORY_SYMBOLS/);
assert.match(source, /tailSymbols/);

console.log("candle tail scheduler distributed locking checks passed");
