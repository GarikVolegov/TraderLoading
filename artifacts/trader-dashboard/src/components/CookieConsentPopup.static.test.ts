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

assert.match(component, /hasAcceptedCookieConsent/);
assert.match(component, /acceptCookieConsent/);
assert.match(component, /Accetta/);
assert.match(component, /sessione/);
assert.match(component, /aggiornamenti/);
assert.match(app, /CookieConsentPopup/);
assert.match(app, /<CookieConsentPopup \/>/);

console.log("cookie consent popup integration checks passed");
