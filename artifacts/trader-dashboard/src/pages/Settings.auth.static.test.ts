import assert from "node:assert/strict";
import { readSettingsFeatureSource } from "./settingsFeatureSource";

const settings = readSettingsFeatureSource();

assert.match(settings, /from "@clerk\/react"/);
assert.match(settings, /useClerk\(\)/);
assert.match(settings, /signOut\(/);
assert.doesNotMatch(settings, /from "@workspace\/replit-auth-web"/);

console.log("settings auth static checks passed");
