import assert from "node:assert/strict";
import fs from "node:fs";

const settings = fs.readFileSync("src/pages/Settings.tsx", "utf8");

assert.match(settings, /from "@clerk\/react"/);
assert.match(settings, /useClerk\(\)/);
assert.match(settings, /signOut\(/);
assert.doesNotMatch(settings, /from "@workspace\/replit-auth-web"/);

console.log("settings auth static checks passed");
