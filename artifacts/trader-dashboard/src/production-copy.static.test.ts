import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const files = [
  "lib/i18n.ts",
  "pages/News.tsx",
  "components/MacroNewsTicker.tsx",
  "components/VolatilityWidget.tsx",
  "components/CotWidget.tsx",
  "components/broker-hub/BrokerHubWidget.tsx",
  "components/broker-hub/BrokerHubWorkspace.tsx",
];

const forbiddenVisibleCopy = [
  "Perplexity",
  "RSS Feed",
  "Yahoo Finance",
  "Fonte: Yahoo",
  "CFTC ·",
  "Groq",
  "Benzinga",
  "Finnhub",
  "Polygon",
  "providerStatuses.map",
  "status.provider",
  "Fonte principale",
  "Analisi AI Agent",
  "Â·",
];

for (const file of files) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  for (const forbidden of forbiddenVisibleCopy) {
    assert.equal(
      source.includes(forbidden),
      false,
      `${file} should not expose visible provider/debug copy: ${forbidden}`,
    );
  }
}

const i18nSource = readFileSync(new URL("lib/i18n.ts", import.meta.url), "utf8");
for (const key of ["news.source.ai", "news.source.rss", "news.source.updated"]) {
  assert.match(i18nSource, new RegExp(`"${key}"`), `Missing copy key ${key}`);
}

const languageCodes = ["it", "en", "es", "fr", "de"] as const;
const languageKeys = new Map<string, Set<string>>();

for (let index = 0; index < languageCodes.length; index++) {
  const lang = languageCodes[index];
  const start = i18nSource.indexOf(`  ${lang}: {`);
  const nextStart = languageCodes
    .slice(index + 1)
    .map((nextLang) => i18nSource.indexOf(`  ${nextLang}: {`, start + 1))
    .find((position) => position > start);
  const end = nextStart ?? i18nSource.indexOf("\n};", start);
  const block = i18nSource.slice(start, end);
  languageKeys.set(lang, new Set([...block.matchAll(/"([^"]+)"\s*:/g)].map((match) => match[1])));
}

const italianKeys = languageKeys.get("it") ?? new Set<string>();
for (const lang of languageCodes.filter((code) => code !== "it")) {
  const keys = languageKeys.get(lang) ?? new Set<string>();
  const missing = [...italianKeys].filter((key) => !keys.has(key));
  assert.deepEqual(missing, [], `${lang} should include every Italian i18n key`);
}

const usedTranslationKeys: string[] = [];
function collectTranslationKeys(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTranslationKeys(absolutePath);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    const source = readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(/\bt\(\s*["']([^"']+)["']/g)) {
      usedTranslationKeys.push(match[1]);
    }
  }
}

collectTranslationKeys(fileURLToPath(new URL(".", import.meta.url)));
const missingUsedKeys = [...new Set(usedTranslationKeys)].filter((key) => !italianKeys.has(key));
assert.deepEqual(missingUsedKeys, [], "Every literal t() key should exist in DICT");

const newsSource = readFileSync(new URL("pages/News.tsx", import.meta.url), "utf8");
assert.match(newsSource, /Apri articolo/);
assert.doesNotMatch(newsSource, /Sito fonte/);

console.log("production copy static checks passed");
