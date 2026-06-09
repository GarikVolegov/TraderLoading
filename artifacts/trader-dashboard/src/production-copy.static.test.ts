import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

const newsSource = readFileSync(new URL("pages/News.tsx", import.meta.url), "utf8");
assert.match(newsSource, /Apri articolo/);
assert.doesNotMatch(newsSource, /Sito fonte/);

console.log("production copy static checks passed");
