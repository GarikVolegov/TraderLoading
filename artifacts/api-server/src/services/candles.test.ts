import assert from "node:assert/strict";
import { isTwelveDataEnabled } from "./candles.js";

assert.equal(isTwelveDataEnabled(undefined), false);
assert.equal(isTwelveDataEnabled(""), false);
assert.equal(isTwelveDataEnabled(" demo "), false);
assert.equal(isTwelveDataEnabled("td_live_key"), true);

console.log("candles provider checks passed");
