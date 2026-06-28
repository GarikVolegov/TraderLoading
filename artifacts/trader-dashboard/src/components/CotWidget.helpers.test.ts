import assert from "node:assert/strict";
import { cotBarWidth } from "./CotWidget.helpers.js";

// cotBarWidth: |net| as a percent of the set max (full-track 0..100)
assert.equal(cotBarWidth(50, 100), 50);
assert.equal(cotBarWidth(-100, 100), 100);
assert.equal(cotBarWidth(0, 100), 0);
assert.equal(cotBarWidth(25, 200), 13); // rounded

// cotBarWidth: guards bad inputs
assert.equal(cotBarWidth(50, 0), 0);
assert.equal(cotBarWidth(50, -1), 0);
assert.equal(cotBarWidth(Number.NaN, 100), 0);
assert.equal(cotBarWidth(50, Number.NaN), 0);

console.log("cot helper checks passed");
