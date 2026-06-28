import assert from "node:assert/strict";
import { adrPercentUsed, adrLevel } from "./VolatilityWidget.helpers.js";

// adrPercentUsed: percent of the 1-year ADR used today, clamped to 0..100
assert.equal(adrPercentUsed(50, 100), 50);
assert.equal(adrPercentUsed(120, 100), 100); // clamped
assert.equal(adrPercentUsed(0, 100), 0);
assert.equal(adrPercentUsed(33, 100), 33);

// adrPercentUsed: guards bad inputs
assert.equal(adrPercentUsed(50, 0), 0);
assert.equal(adrPercentUsed(50, -10), 0);
assert.equal(adrPercentUsed(Number.NaN, 100), 0);
assert.equal(adrPercentUsed(50, Number.NaN), 0);

// adrLevel: thresholds → key + tone
assert.deepEqual(adrLevel(85), { key: "exhausted", tone: "destructive" });
assert.deepEqual(adrLevel(80), { key: "exhausted", tone: "destructive" });
assert.deepEqual(adrLevel(70), { key: "elevated", tone: "warning" });
assert.deepEqual(adrLevel(60), { key: "elevated", tone: "warning" });
assert.deepEqual(adrLevel(40), { key: "room", tone: "success" });
assert.deepEqual(adrLevel(0), { key: "room", tone: "success" });

console.log("volatility helper checks passed");
