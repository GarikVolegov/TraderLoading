import assert from "node:assert/strict";
import { decideLanguageSync } from "./languageSync.js";

const SUPPORTED = ["it", "en", "es", "fr", "de"];

// Fresh device, no explicit local choice → adopt the server preference.
assert.deepEqual(
  decideLanguageSync({
    serverLanguage: "en",
    clientLanguage: "it",
    hasExplicitLocalChoice: false,
    supported: SUPPORTED,
  }),
  { action: "adopt", language: "en" },
);

// Fresh device but server matches the detected language → nothing to do.
assert.deepEqual(
  decideLanguageSync({
    serverLanguage: "it",
    clientLanguage: "it",
    hasExplicitLocalChoice: false,
    supported: SUPPORTED,
  }),
  { action: "none" },
);

// Explicit local choice wins over the server value → write it up.
assert.deepEqual(
  decideLanguageSync({
    serverLanguage: "en",
    clientLanguage: "de",
    hasExplicitLocalChoice: true,
    supported: SUPPORTED,
  }),
  { action: "write" },
);

// Explicit local choice already in sync → no write.
assert.deepEqual(
  decideLanguageSync({
    serverLanguage: "de",
    clientLanguage: "de",
    hasExplicitLocalChoice: true,
    supported: SUPPORTED,
  }),
  { action: "none" },
);

// No server value (fetch failed / legacy row) → write the client language.
assert.deepEqual(
  decideLanguageSync({
    serverLanguage: null,
    clientLanguage: "it",
    hasExplicitLocalChoice: false,
    supported: SUPPORTED,
  }),
  { action: "write" },
);

// Unsupported server value must never be adopted.
assert.deepEqual(
  decideLanguageSync({
    serverLanguage: "xx",
    clientLanguage: "it",
    hasExplicitLocalChoice: false,
    supported: SUPPORTED,
  }),
  { action: "write" },
);

console.log("language sync decision checks passed");
