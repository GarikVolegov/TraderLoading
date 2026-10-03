import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./StarRating.tsx", import.meta.url), "utf8");

// Usability audit (live-sweep): readOnly stars used to always render as
// disabled <button>s, which caused a "<button> cannot be a descendant of
// <button>" hydration warning wherever StarRating readOnly is nested inside
// another clickable element (e.g. a community-list row button).
assert.match(src, /if \(!interactive\) \{/);
assert.match(src, /<span key=\{s\} className="cursor-default">/);

console.log("star rating a11y checks passed");
