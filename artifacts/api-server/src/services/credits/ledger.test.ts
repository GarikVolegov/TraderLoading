import assert from "node:assert/strict";
import { applyLedger } from "./ledger.js";
import { creditPackFor, packCredits } from "./packs.js";

// Sub-project B: credit ledger math must never let a balance go negative
// (overspend) and only move in whole credits.
assert.deepEqual(applyLedger(100, -30), { ok: true, balance: 70 }); // spend
assert.deepEqual(applyLedger(100, 50), { ok: true, balance: 150 }); // purchase/grant
assert.deepEqual(applyLedger(20, -50), { ok: false, balance: 20 }); // overspend blocked, unchanged
assert.deepEqual(applyLedger(0, -1), { ok: false, balance: 0 });
assert.deepEqual(applyLedger(100, 0.5), { ok: false, balance: 100 }); // non-integer delta rejected
assert.deepEqual(applyLedger(100, Number.NaN), { ok: false, balance: 100 });
assert.deepEqual(applyLedger(50, -50), { ok: true, balance: 0 }); // spend to exactly zero is allowed

// Pack catalog lookups (credits only — price ids are env, resolved separately).
assert.equal(creditPackFor("starter")?.credits, 100);
assert.equal(creditPackFor("plus")?.credits, 500);
assert.equal(creditPackFor("pro")?.credits, 1200);
assert.equal(creditPackFor("nope"), null);
assert.equal(creditPackFor(undefined), null);
assert.equal(packCredits("plus"), 500);
assert.equal(packCredits("nope"), null);

console.log("credit ledger checks passed");
