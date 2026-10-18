import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("./MacroNewsTicker.tsx", import.meta.url), "utf8");
assert.match(source, /selectNewsBrief/);
assert.match(source, /<Link href=\{href\}/);
assert.doesNotMatch(source, /Sheet|Dialog|ArticleCard/);
console.log("macro preview clean-card checks passed");
