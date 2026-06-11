import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ProUpgradeGate.tsx", import.meta.url), "utf8");

assert.match(source, /export type ProFeature = "backtest" \| "leaderboard" \| "broker" \| "wiki"/);
assert.match(source, /billing\.price_month/);
assert.match(source, /billing\.feature\.backtesting/);
assert.match(source, /billing\.feature\.leaderboards/);
assert.match(source, /billing\.feature\.account_sync/);
assert.match(source, /billing\.gate\.wiki\.title/);
assert.match(source, /useBillingStatus/);
assert.doesNotMatch(source, /queryFn:\s*\(\)\s*=>\s*fetchBillingStatus\(\)/);
// Modalità overlay: contenuto visibile ma sfocato e non interattivo, paywall sopra.
assert.match(source, /inert/);
assert.match(source, /pointer-events-none/);
assert.match(source, /blur-\[3px\]/);
// Il flusso Stripe Embedded Checkout vive in ProCheckoutDialog (vedi il suo static test).
assert.match(source, /ProCheckoutDialog/);
assert.match(source, /href="\/pro"/);

console.log("pro upgrade gate static checks passed");
