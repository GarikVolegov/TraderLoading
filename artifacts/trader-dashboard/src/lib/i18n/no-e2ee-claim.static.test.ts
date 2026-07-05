import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Honest at-rest model (audit 0.2): the UI must not claim end-to-end encryption.
// Scan every dict's values for the forbidden claims and require the honest badge.
for (const file of ["dict.it.ts", "dict.en.ts", "dict.es.ts", "dict.fr.ts", "dict.de.ts"]) {
  const src = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
  // Claim phrases (values only — key names legitimately contain lowercase "e2ee").
  assert.doesNotMatch(src, /end-to-end|end to end|extremo a extremo|bout en bout|Ende-zu-Ende/i, `${file} still claims end-to-end`);
  // "E2EE" appeared only in copy values (uppercase); keys use lowercase "e2ee".
  assert.doesNotMatch(src, /E2EE/, `${file} still says E2EE`);
  assert.match(src, /"chat\.encrypted_badge"/, `${file} missing chat.encrypted_badge`);
}

console.log("no-e2ee-claim static checks passed");
