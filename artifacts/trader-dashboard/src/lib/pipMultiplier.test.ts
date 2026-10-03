import assert from "node:assert/strict";
import { getPipMultiplier } from "./pipMultiplier.js";

// Pip size varies by instrument; a fixed x10000 (FX 5-digit) is wrong for the rest.
assert.equal(getPipMultiplier("EUR/USD"), 10000);
assert.equal(getPipMultiplier("EURUSD"), 10000);
assert.equal(getPipMultiplier("USD/JPY"), 100);
assert.equal(getPipMultiplier("EURJPY"), 100);
assert.equal(getPipMultiplier("XAU/USD"), 10);
assert.equal(getPipMultiplier("US30"), 1);
assert.equal(getPipMultiplier("NAS100"), 1);
assert.equal(getPipMultiplier("SPX500"), 1);
assert.equal(getPipMultiplier("BTC/USD"), 1);
assert.equal(getPipMultiplier("ETHUSD"), 1);

console.log("pipMultiplier.test.ts: all assertions passed");
