import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const component = fs.readFileSync(
  path.join(currentDir, "CookieConsentPopup.tsx"),
  "utf8",
);
const app = fs.readFileSync(path.join(currentDir, "..", "App.tsx"), "utf8");

// GDPR: il banner deve offrire un rifiuto esplicito quando GA è configurato,
// ricordare la risposta (accept O decline) e avere copy localizzata via t().
assert.match(component, /hasRespondedToCookieConsent/);
assert.match(component, /acceptCookieConsent/);
assert.match(component, /declineCookieConsent/);
assert.match(component, /t\("cookie\.banner\.analytics"\)/);
assert.match(component, /t\("cookie\.banner\.technical"\)/);
assert.match(component, /t\("cookie\.banner\.decline"\)/);
assert.doesNotMatch(component, />Accetta</);
assert.match(app, /CookieConsentPopup/);
assert.match(app, /<CookieConsentPopup \/>/);

console.log("cookie consent popup integration checks passed");
