import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Settings.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /const signup = \(\) => navigate\("\/sign-up"\)/,
  "Settings account actions should route sign-up separately from sign-in",
);
assert.match(
  source,
  /signup=\{signup\}/,
  "Settings should pass the sign-up route to the account CTA",
);
assert.match(
  source,
  /Elimina account/,
  "Settings must expose in-app account deletion",
);
assert.match(
  source,
  /ELIMINA/,
  "Account deletion should require an explicit confirmation phrase",
);
assert.match(
  source,
  /Vuoi ricevere alert utili/,
  "Push notifications should use a value-focused pre-permission prompt",
);
assert.match(
  source,
  /Privacy e dati/,
  "Settings must expose a privacy/data disclosure area",
);
assert.match(
  source,
  /Esporta dati/,
  "Settings must expose a GDPR data export action",
);
assert.match(
  source,
  /\/api\/account\/export/,
  "Data export should call the authenticated account export endpoint",
);

console.log("settings compliance static checks passed");
