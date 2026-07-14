import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readSettingsFeatureSource } from "../pages/settingsFeatureSource";

const panel = readFileSync(new URL("./BillingSubscriptionPanel.tsx", import.meta.url), "utf8");
const settings = readSettingsFeatureSource();
const i18nDict = readFileSync(new URL("../lib/i18n/dict.it.ts", import.meta.url), "utf8");

// La copy vive nel catalogo i18n: il componente deve referenziare la chiave e
// il catalogo deve contenere la copy italiana attesa.
function assertCopy(source: string, key: string, itCopy: string) {
  const escapedKey = key.replace(/\./g, "\\.");
  assert.match(
    source,
    new RegExp(`t\\("${escapedKey}"`),
    `chiave i18n ${key} non referenziata nel componente`,
  );
  assert.match(
    i18nDict,
    new RegExp(`"${escapedKey}":\\s*"${itCopy}`),
    `copy italiana mancante per ${key}`,
  );
}

assert.match(panel, /useBillingStatus/);
assert.match(panel, /fetchBillingInvoices/);
assert.match(panel, /cancelSubscription/);
assert.match(panel, /resumeSubscription/);
assert.match(panel, /hostedInvoiceUrl/);
assert.doesNotMatch(panel, /queryFn:\s*\(\)\s*=>\s*fetchBillingStatus\(\)/);

assertCopy(panel, "billing.panel.verifying", "Verifico stato abbonamento");
assertCopy(panel, "billing.panel.title", "Abbonamento");
assertCopy(panel, "billing.price_month", "7 EUR/mese");
assertCopy(panel, "billing.panel.cancel_renewal", "Annulla rinnovo");
assertCopy(panel, "billing.panel.resume", "Riattiva abbonamento");
assertCopy(panel, "billing.panel.coverage", "Copertura Pro");
assertCopy(panel, "billing.panel.invoices", "Fatture");
assertCopy(panel, "billing.panel.access_included", "Accesso incluso");

assert.match(settings, /BillingSubscriptionPanel/);
assert.match(settings, /id: "abbonamento"/);

// Adversarial-review finding (2026-07-14): commit b9c4176's own message
// claimed this panel was fixed to show an honest unavailable notice instead
// of a dead-end "Passa a Pro" CTA, but no hunk in that (or any later) commit
// actually touched this file — the upgrade button rendered unconditionally
// regardless of checkoutAvailable.
assert.match(panel, /!status\?\.pro && status\?\.checkoutAvailable &&/);
assert.match(panel, /!status\?\.pro && !status\?\.checkoutAvailable &&/);

console.log("billing subscription panel static checks passed");
