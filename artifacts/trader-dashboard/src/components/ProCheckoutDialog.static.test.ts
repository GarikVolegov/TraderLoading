import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ProCheckoutDialog.tsx", import.meta.url), "utf8");

assert.match(source, /EmbeddedCheckoutProvider/);
assert.match(source, /EmbeddedCheckout/);
assert.match(source, /createCheckoutSession/);
assert.match(source, /billingQueryKey/);
assert.match(source, /7 EUR\/mese/);
assert.match(source, /Chiave pubblicabile Stripe mancante/);
// La sessione embedded non è riutilizzabile: il client secret va azzerato alla chiusura.
assert.match(source, /setClientSecret\(null\)/);

console.log("pro checkout dialog static checks passed");
