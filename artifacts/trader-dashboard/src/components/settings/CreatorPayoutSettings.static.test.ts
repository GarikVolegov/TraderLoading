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

// Adversarial-review finding (2026-07-14): `account` defaults to undefined
// while the query is in flight, so `account && !account.available` never
// fires during the initial fetch — the onboard button rendered fully
// clickable before the server had reported whether Connect is configured.
assert.match(src, /data:\s*account,\s*isLoading/, "the query's isLoading must be read");
assert.match(
  src,
  /if \(isLoading\) return <Skeleton/,
  "must show a loading skeleton (not the onboard button) while the account query is in flight",
);

console.log("CreatorPayoutSettings static checks passed");
