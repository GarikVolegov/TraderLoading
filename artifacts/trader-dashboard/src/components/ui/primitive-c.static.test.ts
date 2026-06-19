import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const file of ["dialog", "popover", "dropdown-menu", "sheet", "tooltip"]) {
  const src = readFileSync(new URL(`./${file}.tsx`, import.meta.url), "utf8");
  assert.match(src, /glass-raised/, `${file}.tsx content surface must use glass-raised`);
}

console.log("primitive C static checks passed");
