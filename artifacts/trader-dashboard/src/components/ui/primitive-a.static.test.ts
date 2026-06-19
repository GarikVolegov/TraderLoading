import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const card = readFileSync(new URL("./card.tsx", import.meta.url), "utf8");
const button = readFileSync(new URL("./button.tsx", import.meta.url), "utf8");

assert.match(card, /glass-panel/, "Card must use the glass-panel material");
assert.match(card, /card-hover/, "Card must use the card-hover lift");
assert.match(button, /"glass"/, "buttonVariants must add a 'glass' variant");
assert.match(button, /variant\?:[^;]*"glass"/, "ButtonProps.variant union must include 'glass'");

console.log("primitive A static checks passed");
