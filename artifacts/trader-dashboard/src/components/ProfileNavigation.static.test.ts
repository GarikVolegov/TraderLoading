import assert from "node:assert/strict";
import fs from "node:fs";

const topNav = fs.readFileSync("src/components/TopNav.tsx", "utf8");
const bottomNav = fs.readFileSync("src/components/BottomNav.tsx", "utf8");

assert.match(topNav, /useGetProfile/);
assert.match(bottomNav, /useGetProfile/);

assert.doesNotMatch(topNav, /import \{ Settings,/);
assert.doesNotMatch(topNav, /<Settings className=/);
assert.doesNotMatch(topNav, /UserButton/);
assert.doesNotMatch(bottomNav, /UserButton/);

assert.match(topNav, /href="\/settings"/);
assert.match(bottomNav, /href="\/settings"/);
assert.match(topNav, /profile\.avatarUrl/);
assert.match(bottomNav, /profile\.avatarUrl/);
assert.match(topNav, /images\/avatar-default\.png/);
assert.match(bottomNav, /images\/avatar-default\.png/);

console.log("profile navigation static checks passed");
