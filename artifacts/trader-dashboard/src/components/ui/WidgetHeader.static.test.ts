import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./WidgetHeader.tsx", import.meta.url), "utf8");
assert.match(src, /icon/);
assert.match(src, /title/);
assert.match(src, /subtitle/);
assert.match(src, /action/);
assert.match(src, /iconTone/);
console.log("WidgetHeader static checks passed");
