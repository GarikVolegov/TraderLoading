import assert from "node:assert/strict";
import fs from "node:fs";

// The creator payout card must hide itself entirely when Stripe Connect isn't
// configured (`available: false`), instead of offering an onboard button that
// always 402s (finding: dead-end CTA).
const src = fs.readFileSync("src/components/settings/CreatorPayoutSettings.tsx", "utf8");

assert.match(
  src,
  /if\s*\(account\s*&&\s*!account\.available\)\s*return null;/,
  "the card must return null when the account payload marks Stripe Connect unavailable",
);

console.log("CreatorPayoutSettings static checks passed");
