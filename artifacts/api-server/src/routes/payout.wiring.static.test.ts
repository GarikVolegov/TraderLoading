import assert from "node:assert/strict";
import fs from "node:fs";

// GET /payout/account must expose whether Stripe Connect is configured at all
// ("available"), so the FE can hide the creator payout card instead of showing
// an "onboard" button that always 402s when STRIPE_SECRET_KEY is unset.
const route = fs.readFileSync("src/routes/payout.ts", "utf8");

const accountGet = route.slice(
  route.indexOf('router.get("/payout/account"'),
  route.indexOf('router.post("/payout/account/onboard"'),
);
assert.ok(accountGet.length > 0, "GET /payout/account route must exist");
assert.match(
  accountGet,
  /available:\s*Boolean\(getStripeBillingConfig\(\)\.secretKey\)/,
  "GET /payout/account must expose `available` from the Stripe config",
);

console.log("payout route wiring static checks passed");
