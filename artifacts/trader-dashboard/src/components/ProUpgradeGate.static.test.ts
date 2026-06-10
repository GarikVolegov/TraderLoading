import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ProUpgradeGate.tsx", import.meta.url), "utf8");

assert.match(source, /7 EUR\/mese/);
assert.match(source, /Backtesting/);
assert.match(source, /Classifiche/);
assert.match(source, /Collegamento conto/);
assert.match(source, /EmbeddedCheckoutProvider/);
assert.match(source, /EmbeddedCheckout/);
assert.match(source, /fetchBillingStatus/);
assert.match(source, /createCheckoutSession/);

console.log("pro upgrade gate static checks passed");
