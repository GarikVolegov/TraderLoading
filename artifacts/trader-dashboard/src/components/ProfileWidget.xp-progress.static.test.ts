import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ProfileWidget.tsx", import.meta.url), "utf8");

assert.doesNotMatch(
  source,
  /profile\.xp\s*%\s*XP_PER_LEVEL/,
  "Profile XP progress must use cumulative XP instead of resetting with modulo at each level",
);

assert.match(
  source,
  /nextLevelXpTarget/,
  "Profile XP progress should display the cumulative XP target for the next level",
);

console.log("profile cumulative XP progress checks passed");
