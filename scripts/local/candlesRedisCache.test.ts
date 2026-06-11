import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const source = read("artifacts/api-server/src/services/candles.ts");

assert.match(source, /import \{\s*getJsonCache,\s*setJsonCache\s*\} from "\.\.\/lib\/cache\.js"/);
assert.match(source, /function candleCacheKey/);
// v2: la chiave include startDate per il replay storico.
assert.match(source, /candles:v2:\$\{symbol\}:\$\{interval\}:\$\{startDate \?\? "latest"\}/);
assert.match(source, /function candleCacheTtlSeconds/);
assert.match(source, /await getJsonCache<CandlesResult>/);
assert.match(source, /await setJsonCache/);
assert.match(source, /cache\.set\(cacheKey/);

console.log("candles redis cache checks passed");
