import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("./billing.ts", import.meta.url), "utf8");

// A chargeback/refund must revoke the Stripe Pro entitlement, otherwise access
// stays active after the money is pulled back.
assert.match(src, /event\.type === "charge\.dispute\.created" \|\| event\.type === "charge\.refunded"/);
assert.match(src, /revokeStripeProForCustomer/);
// Revocation must not touch manual/internal (tornei) entitlements.
assert.match(src, /row\.source !== "stripe" \|\| row\.manualOverride/);
// currentPeriodEnd + invoice subscription id read the pinned-API locations.
assert.match(src, /subscriptionCurrentPeriodEnd\(subscription\)/);
assert.match(src, /invoiceSubscriptionId\(invoice\)/);
// The dead top-level invoice.subscription read must be gone (comments may mention it).
assert.doesNotMatch(src, /typeof invoice\.subscription ===/);

console.log("billing dispute/refund static checks passed");
