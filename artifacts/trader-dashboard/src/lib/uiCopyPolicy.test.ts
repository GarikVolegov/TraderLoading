import assert from "node:assert/strict";
import {
  cleanProviderCopy,
  containsHiddenProviderName,
  shouldShowProviderLabel,
  simpleStatusLabel,
} from "./uiCopyPolicy";

assert.equal(containsHiddenProviderName("Fonte: Yahoo Finance"), true);
assert.equal(containsHiddenProviderName("Perplexity AI"), true);
assert.equal(containsHiddenProviderName("RSS Feed in tempo reale"), true);
assert.equal(containsHiddenProviderName("Aggiornato ora"), false);

assert.equal(shouldShowProviderLabel("Yahoo Finance"), false);
assert.equal(shouldShowProviderLabel("Reuters"), false);
assert.equal(shouldShowProviderLabel(null), false);

assert.equal(cleanProviderCopy("Fonte: Yahoo Finance · Range H-L"), "");
assert.equal(cleanProviderCopy("Aggiornato ora"), "Aggiornato ora");

assert.equal(simpleStatusLabel("connected"), "Attivo");
assert.equal(simpleStatusLabel("error"), "Non disponibile");
assert.equal(simpleStatusLabel("disabled"), "Non attivo");
assert.equal(simpleStatusLabel("waiting"), "In attesa");

console.log("ui copy policy checks passed");
