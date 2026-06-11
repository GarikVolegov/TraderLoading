import assert from "node:assert/strict";
import { DICT, SUPPORTED_LANGUAGES } from "./i18n";

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

// Guardia anti "copia non tradotta": un'ondata di chiavi con lo stesso testo
// italiano in tutte le lingue (com'è successo con la mappa auto.ui recovered)
// deve far fallire il test. I termini tecnici legittimamente identici
// (Win Rate, Stop Loss, Broker Hub, ...) restano ampiamente sotto la soglia
// (al momento della scrittura: 27-34 per lingua).
const MAX_IDENTICAL_TO_IT = 80;
for (const lang of SUPPORTED_LANGUAGES) {
  if (lang === "it") continue;
  const identical = baseKeys.filter(
    (key) =>
      DICT[lang][key] === DICT.it[key] &&
      /[a-zà-ù]{4,}/i.test(DICT.it[key]) &&
      DICT.it[key].split(" ").length >= 2,
  );
  assert.ok(
    identical.length <= MAX_IDENTICAL_TO_IT,
    `[${lang}] ${identical.length} valori identici all'italiano (max ${MAX_IDENTICAL_TO_IT}): ` +
      `probabile blocco di chiavi non tradotte. Esempi: ${identical.slice(0, 5).join(", ")}`,
  );
}

console.log(`i18n parity checks passed (${baseKeys.length} chiavi x ${SUPPORTED_LANGUAGES.length} lingue)`);
