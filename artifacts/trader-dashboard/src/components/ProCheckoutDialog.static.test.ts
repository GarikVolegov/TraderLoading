import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ProCheckoutDialog.tsx", import.meta.url), "utf8");
const i18nDict = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

assert.match(source, /EmbeddedCheckoutProvider/);
assert.match(source, /EmbeddedCheckout/);
assert.match(source, /createCheckoutSession/);
assert.match(source, /billingQueryKey/);
// La copy è passata all'i18n: il dialog referenzia la chiave e il catalogo
// contiene la copy italiana (prezzo incluso).
assert.match(source, /t\("billing\.checkout\.title"\)/);
assert.match(i18nDict, /"billing\.checkout\.title":\s*"[^"]*7 EUR\/mese"/);
assert.match(source, /t\("billing\.checkout\.missing_key"\)/);
assert.match(i18nDict, /"billing\.checkout\.missing_key":\s*"Chiave pubblicabile Stripe mancante\./);
// La sessione embedded non è riutilizzabile: il client secret va azzerato alla chiusura.
assert.match(source, /setClientSecret\(null\)/);

console.log("pro checkout dialog static checks passed");
