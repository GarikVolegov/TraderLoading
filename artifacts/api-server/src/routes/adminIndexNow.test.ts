import assert from "node:assert/strict";
import { CANONICAL_INDEXNOW_URLS, INDEXNOW_HOST, INDEXNOW_KEY, INDEXNOW_KEY_LOCATION } from "./adminIndexNow.js";

assert.equal(INDEXNOW_HOST, "aureus-os.app");
assert.equal(INDEXNOW_KEY, "8f7b2c9e4a1d6e3f5b0a7c9d1e4f2a8b");
assert.equal(INDEXNOW_KEY_LOCATION, "https://aureus-os.app/8f7b2c9e4a1d6e3f5b0a7c9d1e4f2a8b.txt");

assert.ok(CANONICAL_INDEXNOW_URLS.length >= 45, `expected >=45 URLs, got ${CANONICAL_INDEXNOW_URLS.length}`);

// Every URL must belong to the canonical https://aureus-os.app host
for (const url of CANONICAL_INDEXNOW_URLS) {
  assert.ok(url.startsWith("https://aureus-os.app/"), `invalid host in url: ${url}`);
}

console.log("admin IndexNow router static checks passed");
