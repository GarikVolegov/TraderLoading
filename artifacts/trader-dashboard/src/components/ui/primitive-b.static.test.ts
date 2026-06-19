import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const input = readFileSync(new URL("./input.tsx", import.meta.url), "utf8");
const textarea = readFileSync(new URL("./textarea.tsx", import.meta.url), "utf8");
const badge = readFileSync(new URL("./badge.tsx", import.meta.url), "utf8");

assert.match(input, /glass-inset/, "Input must use glass-inset well");
assert.match(input, /focus-visible:ring|focus:ring/, "Input must show a focus ring");
assert.match(textarea, /glass-inset/, "Textarea must use glass-inset well");
assert.match(badge, /border/, "Badge keeps bordered pill styling");

console.log("primitive B static checks passed");
