import assert from "node:assert/strict";
import { initials, countdownParts, fmtR, pad2 } from "./format";

// ── initials ─────────────────────────────────────────────────────────────────
{
  assert.equal(initials("Marco Rossi"), "MR");
  assert.equal(initials("Sara"), "SA");
  assert.equal(initials("  "), "?");
  assert.equal(initials("Anna Maria Conti"), "AC");
}

// ── countdownParts ───────────────────────────────────────────────────────────
{
  const now = Date.UTC(2025, 0, 1, 0, 0, 0);
  const target = Date.UTC(2025, 0, 3, 4, 5, 6); // +2d 4h 5m 6s
  const c = countdownParts(target, now);
  assert.deepEqual([c.d, c.h, c.m, c.s, c.done], [2, 4, 5, 6, false]);
  const past = countdownParts(now - 1000, now);
  assert.equal(past.done, true);
  assert.deepEqual([past.d, past.h, past.m, past.s], [0, 0, 0, 0]);
}

// ── fmtR / pad2 ──────────────────────────────────────────────────────────────
{
  assert.equal(fmtR(12.34), "+12.3R");
  assert.equal(fmtR(-3), "-3.0R");
  assert.equal(fmtR(null), "—");
  assert.equal(pad2(5), "05");
  assert.equal(pad2(12), "12");
}

console.log("format.test.ts: all assertions passed");
