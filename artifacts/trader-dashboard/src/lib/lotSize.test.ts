import assert from "node:assert/strict";
import { estimateLotSize } from "./lotSize";
assert.equal(estimateLotSize("100", "30", 10), "0.33");
assert.equal(estimateLotSize("100", "29", 10), "0.34");
assert.equal(estimateLotSize("0", "20", 10), "0.00");
for (const [risk, stop, divisor] of [["-1", "20", 10], ["100", "0", 10], ["100", "20", 0], ["Infinity", "20", 10], ["10oops", "20", 10], ["", "20", 10]] as const) assert.equal(estimateLotSize(risk, stop, divisor), null);
assert.equal(estimateLotSize("100", "20", Number.NaN), null);
console.log("Lot estimate finite inputs, zero and conservative rounding passed");
