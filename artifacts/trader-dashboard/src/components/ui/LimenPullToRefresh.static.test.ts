import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

test("LimenPullToRefresh static checks", () => {
  const content = fs.readFileSync("src/components/ui/LimenPullToRefresh.tsx", "utf8");

  // Must export LimenPullToRefresh component
  assert.match(content, /export function LimenPullToRefresh/);

  // Must wire haptics and acoustic synesthesia
  assert.match(content, /hapticLight/);
  assert.match(content, /hapticSuccess/);
  assert.match(content, /synestheticClick/);

  // Must handle touch events
  assert.match(content, /onTouchStart/);
  assert.match(content, /onTouchMove/);
  assert.match(content, /onTouchEnd/);

  // Must not contain forbidden debug tags
  assert.doesNotMatch(content, /\bDB\b/);
  assert.doesNotMatch(content, /\bMOCK\b/);
  assert.doesNotMatch(content, /\bTEST\b/);

  console.log("LimenPullToRefresh static checks passed with 100% precision!");
});
