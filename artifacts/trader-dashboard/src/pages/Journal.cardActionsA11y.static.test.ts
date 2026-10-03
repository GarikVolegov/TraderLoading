import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./Journal.tsx", import.meta.url), "utf8");

// Usability audit (live-sweep): the delete button on a trade card was
// icon-only (Trash2, no visible text) with no accessible name.
assert.match(
  src,
  /text-destructive hover:bg-destructive\/20"\s*\n\s*aria-label=\{uiText\("common\.delete"\)\}/,
);

console.log("journal card actions a11y checks passed");
