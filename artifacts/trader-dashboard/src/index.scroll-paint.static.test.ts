import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

assert.doesNotMatch(css, /background-attachment\s*:\s*fixed/);
assert.match(css, /body::before/);
assert.match(css, /position:\s*fixed/);
assert.match(css, /transform:\s*translateZ\(0\)/);
assert.match(html, /<meta name="mobile-web-app-capable" content="yes" \/>/);

console.log("scroll paint stability static checks passed");
