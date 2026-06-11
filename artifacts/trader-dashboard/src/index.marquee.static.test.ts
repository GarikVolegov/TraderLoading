import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");

assert.match(
  css,
  /\.animate-marquee\s*\{[\s\S]*?animation:\s*marquee\s+var\(--marquee-duration,\s*30s\)\s+linear\s+infinite;/,
);

console.log("marquee ticker duration static checks passed");
