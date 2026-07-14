import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./ProPage.tsx", import.meta.url), "utf8");

// Adversarial-review finding (2026-07-14): the compare-plans card's upgrade
// CTA isn't inside the hero's `billing.isLoading` ternary, so `checkoutAvailable`'s
// fail-open default (`?? true`) rendered it fully clickable for the entire
// billing-query fetch window on every page visit, not just a narrow race —
// a click during that window opens checkout only to 503, the exact
// dead-end-CTA pattern this audit batch existed to remove.
assert.match(src, /!billing\.isLoading && !isPro && checkoutAvailable &&/);
assert.match(src, /!billing\.isLoading && !isPro && !checkoutAvailable &&/);

console.log("ProPage checkout gate checks passed");
