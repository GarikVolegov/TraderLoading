import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./edgeData.ts", import.meta.url), "utf8");

// The coach must read commission and swap and feed a NET P&L to the analytics,
// so its win/loss, R sign and cash guard match the client diario (which nets
// costs). This locks that in against a regression back to gross-only profit.
assert.match(src, /commission: accountTradesTable\.commission/);
assert.match(src, /swap: accountTradesTable\.swap/);
assert.match(src, /netProfit\(num\(row\.profit\), num\(row\.commission\), num\(row\.swap\)\)/);

console.log("edgeData static checks passed");
