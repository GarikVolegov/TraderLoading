import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./tools.ts", import.meta.url), "utf8");

assert.match(source, /function uniqueMacroToolImageUrl/);
assert.match(source, /function ensureUniqueMacroToolImageUrls/);
assert.match(source, /ensureUniqueMacroToolImageUrls\(articles\)/);
assert.match(source, /const articles = ensureUniqueMacroToolImageUrls\(deduped\.map/);

console.log("macro-news image uniqueness static checks passed");
