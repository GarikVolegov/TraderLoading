import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("./BillingSubscriptionPanel.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../pages/Settings.tsx", import.meta.url), "utf8");

assert.match(panel, /useBillingStatus/);
assert.match(panel, /Verifico stato abbonamento/);
assert.match(panel, /fetchBillingInvoices/);
assert.match(panel, /cancelSubscription/);
assert.match(panel, /resumeSubscription/);
assert.match(panel, /Abbonamento/);
assert.match(panel, /7 EUR\/mese/);
assert.match(panel, /Annulla rinnovo/);
assert.match(panel, /Riattiva abbonamento/);
assert.match(panel, /hostedInvoiceUrl/);
assert.match(panel, /Copertura Pro/);
assert.match(panel, /Cronologia pagamenti/);
assert.match(panel, /Accesso incluso/);
assert.doesNotMatch(panel, /queryFn:\s*\(\)\s*=>\s*fetchBillingStatus\(\)/);
assert.match(settings, /BillingSubscriptionPanel/);
assert.match(settings, /id: "abbonamento"/);

console.log("billing subscription panel static checks passed");
