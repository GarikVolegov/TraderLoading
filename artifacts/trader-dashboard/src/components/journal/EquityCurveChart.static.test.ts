import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/components/journal/EquityCurveChart.tsx", "utf8");

test("renders an svg driven by props, not hardcoded arrays", () => {
  assert.match(src, /<svg/);
  assert.match(src, /realized/);
  assert.match(src, /bands\b/);
  // No baked-in mock series (the kit's literals must not be copied)
  assert.doesNotMatch(src, /\[0,\s*0\.4,\s*1\.8/);
});

test("draws the historical line, the 80% band and the median", () => {
  assert.match(src, /p10/);
  assert.match(src, /p90/);
  assert.match(src, /p50/);
  assert.match(src, /strokeDasharray/);
});
