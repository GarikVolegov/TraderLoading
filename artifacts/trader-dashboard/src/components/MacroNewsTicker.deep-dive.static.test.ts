import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("./MacroNewsTicker.tsx", import.meta.url), "utf8");
assert.match(source, /newsArticleReference\(article\)/);
assert.match(source, /vista: "notizie"/);
assert.match(source, /params\.set\("article", newsArticleReference\(article\)\)/);
assert.doesNotMatch(source, /MacroNewsDetailDialog|deepDive/);
console.log("macro preview deep-dive checks passed");
