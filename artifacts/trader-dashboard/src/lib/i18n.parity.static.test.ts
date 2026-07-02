import assert from "node:assert/strict";
import { SUPPORTED_LANGUAGES } from "./i18n";
import { DICT } from "./i18n/all";

// Garanzia "a 360 gradi": ogni chiave deve esistere in TUTTE le lingue
// supportate, con valore non vuoto e gli stessi placeholder {var}.
// Aggiungere una chiave solo in una lingua fa fallire questo test.

const PLACEHOLDER_RE = /\{[a-zA-Z0-9_]+\}/g;
const MOJIBAKE_RE = /Ã|â|ð|Â/;

function placeholders(value: string): string {
  return (value.match(PLACEHOLDER_RE) ?? []).sort().join(",");
}

const baseKeys = Object.keys(DICT.it).sort();
assert.ok(baseKeys.length > 0, "il dizionario it non puo essere vuoto");

for (const lang of SUPPORTED_LANGUAGES) {
  const keys = Object.keys(DICT[lang]).sort();
  const keySet = new Set(keys);
  const baseSet = new Set(baseKeys);

  const missing = baseKeys.filter((k) => !keySet.has(k));
  const extra = keys.filter((k) => !baseSet.has(k));
  assert.deepEqual(missing, [], `[${lang}] chiavi mancanti rispetto a "it": ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `[${lang}] chiavi extra non presenti in "it": ${extra.join(", ")}`);

  for (const key of keys) {
    const value = DICT[lang][key];
    assert.ok(
      typeof value === "string" && value.trim().length > 0,
      `[${lang}] valore vuoto per "${key}"`,
    );
    assert.equal(
      MOJIBAKE_RE.test(value),
      false,
      `[${lang}] possibile mojibake in "${key}": ${value}`,
    );
    assert.equal(
      placeholders(value),
      placeholders(DICT.it[key]),
      `[${lang}] placeholder diversi da "it" per "${key}"`,
    );
  }
}

console.log(`i18n parity checks passed (${baseKeys.length} chiavi x ${SUPPORTED_LANGUAGES.length} lingue)`);
