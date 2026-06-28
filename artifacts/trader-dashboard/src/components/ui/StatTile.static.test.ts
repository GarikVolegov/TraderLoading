import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./StatTile.tsx", import.meta.url), "utf8");
assert.match(src, /label/);
assert.match(src, /value/);
assert.match(src, /font-mono/); // value uses mono
assert.match(src, /text-success|text-destructive|text-primary/); // tonal classes
console.log("StatTile static checks passed");
