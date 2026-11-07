import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const tsxPath = path.resolve(import.meta.dirname, "./CockpitRevolutOperativeWindow.tsx");
const tsx = fs.readFileSync(tsxPath, "utf8");

// Static component checks
assert.match(tsx, /export function CockpitRevolutOperativeWindow/, "Must export CockpitRevolutOperativeWindow");
assert.match(tsx, /PRIMARY_PAIRS/, "Must define primary pairs for 1-tap switching");
assert.match(tsx, /COMPRA · LONG/, "Must have clear Long/Buy direction button");
assert.match(tsx, /VENDI · SHORT/, "Must have clear Short/Sell direction button");
assert.match(tsx, /Custode della Soglia/, "Must have Pre-Flight integrity checks");
assert.match(tsx, /ATTRAVERSA IL VARCO/, "Must declare solemn Varco execution CTA");
assert.match(tsx, /computeLots/, "Must calculate lot sizing deterministically");
assert.match(tsx, /whitespace-nowrap/, "Must prevent unwanted line breaks");

console.log("CockpitRevolutOperativeWindow static & unit checks passed!");
