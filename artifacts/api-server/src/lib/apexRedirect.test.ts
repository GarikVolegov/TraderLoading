import assert from "node:assert/strict";

import { apexRedirectTarget } from "./apexRedirect.js";

// Bare apex redirects to the www canonical origin (replaces the old Vercel 308).
assert.equal(
  apexRedirectTarget("traderloading.com", "/"),
  "https://www.traderloading.com/",
);

// Path + query string are preserved.
assert.equal(
  apexRedirectTarget("traderloading.com", "/dashboard?tab=edge&x=1"),
  "https://www.traderloading.com/dashboard?tab=edge&x=1",
);

// Host comparison is case-insensitive and ignores any :port suffix.
assert.equal(
  apexRedirectTarget("TRADERLOADING.COM", "/"),
  "https://www.traderloading.com/",
);
assert.equal(
  apexRedirectTarget("traderloading.com:443", "/news"),
  "https://www.traderloading.com/news",
);

// www, the Railway host, and localhost are left untouched (no redirect).
assert.equal(apexRedirectTarget("www.traderloading.com", "/"), null);
assert.equal(apexRedirectTarget("yjcitgct.up.railway.app", "/"), null);
assert.equal(apexRedirectTarget("localhost", "/"), null);
assert.equal(apexRedirectTarget(undefined, "/"), null);

console.log("apexRedirect: all assertions passed");
