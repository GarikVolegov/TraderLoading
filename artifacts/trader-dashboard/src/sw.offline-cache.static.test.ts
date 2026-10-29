import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("public/sw.js", "utf8");

assert.match(source, /aureus-assets-v\d+/, "SW must define an assets cache bucket");
assert.match(source, /aureus-pages-v\d+/, "SW must define a pages cache bucket");
assert.match(source, /url\.pathname\.startsWith\("\/api\/"\)/, "API endpoints must never be cached in Service Worker");
assert.match(source, /url\.pathname\.startsWith\("\/assets\/"\)/, "Hashed static assets must be cached");
assert.match(source, /event\.request\.mode === "navigate"/, "Navigations must have an offline cache fallback");

console.log("service worker offline cache checks passed");
