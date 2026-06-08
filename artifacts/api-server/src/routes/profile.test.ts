import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./profile.ts", import.meta.url), "utf8");
const getProfileRoute = source.match(/router\.get\("\/profile"[\s\S]*?\n}\);/);

assert.ok(getProfileRoute, "GET /profile route should exist");
assert.doesNotMatch(
  getProfileRoute[0],
  /updateStreak\(/,
  "GET /profile must not mutate streak; streak should update only after real user actions",
);

console.log("profile route streak read checks passed");
