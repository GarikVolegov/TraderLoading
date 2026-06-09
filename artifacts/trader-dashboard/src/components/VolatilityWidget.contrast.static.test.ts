import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./VolatilityWidget.tsx", import.meta.url), "utf8");

assert.doesNotMatch(source, /text-muted-foreground\/(?:40|50|60)\b/);
assert.doesNotMatch(source, /text-(?:primary|destructive|blue-400)\/60\b/);
assert.match(source, /volatility-contrast-card/);

console.log("volatility widget contrast static checks passed");
