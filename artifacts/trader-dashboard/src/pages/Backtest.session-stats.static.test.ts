import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backtest = readFileSync(new URL("./Backtest.tsx", import.meta.url), "utf8");

assert.match(backtest, /session\.stats/);
assert.match(backtest, /Win Rate/);
assert.match(backtest, /R:R/);
assert.match(backtest, /auto\.ui\.82907d818c/);
assert.match(backtest, /totalPips/);
assert.match(
  readFileSync(new URL("../lib/i18n/dict.it.ts", import.meta.url), "utf8"),
  /"auto\.ui\.82907d818c":\s*"Profitto"/,
);

console.log("backtest session card stats checks passed");
