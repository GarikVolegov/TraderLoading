import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DICT, SUPPORTED_LANGUAGES } from "./lib/i18n";

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

const italianKeys = new Set(Object.keys(DICT.it));
for (const lang of SUPPORTED_LANGUAGES.filter((code) => code !== "it")) {
  const keys = new Set(Object.keys(DICT[lang]));
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
    if (/\.(test|static\.test)\./.test(entry.name)) continue;
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

const localizedSurfaceNeedles: Record<string, string[]> = {
  "components/BillingSubscriptionPanel.tsx": [
    "Abbonamento",
    "Piano Pro, rinnovo",
    "Verifico stato abbonamento",
    "Annulla rinnovo",
    "Riattiva abbonamento",
    "Apri fattura Stripe",
  ],
  "components/admin/AdminShell.tsx": [
    "Admin Console",
    "Admin navigation",
    "Ruolo:",
    "verifica in corso",
    "Torna all'app",
  ],
  "components/account-bridge/AccountBridgeWorkspace.tsx": [
    "Conto reale MT5 attivo",
    "Demo adapter attivo",
    "Collega conto FP Trading",
    "Sicurezza conto reale",
    "Nessun conto collegato",
    "Ticket ordine",
    "Posizioni aperte",
  ],
  "components/BackgroundPresetsManager.tsx": [
    "Sfondi Personalizzati",
    "Limite di 6 sfondi",
    "Sfondo aggiunto",
    "Aggiungi sfondo",
    "Massimo 6 sfondi",
  ],
};

for (const [file, needles] of Object.entries(localizedSurfaceNeedles)) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  for (const needle of needles) {
    assert.equal(
      source.includes(needle),
      false,
      `${file} should route visible copy through i18n, found hardcoded copy: ${needle}`,
    );
  }
}

const legacyHardcodedCopyFiles = new Set<string>();

const visibleTextPattern = /(?<![=!<>])>\s*([^<>{}`\n]*[A-Za-zÀ-ÿ][^<>{}`\n]*)\s*<(?=[/A-Za-z])/;
const visibleAttributePattern = /(aria-label|placeholder|title)="([^"]*[A-Za-zÀ-ÿ][^"]*)"/;
const visibleMessagePattern = /(toast\(|confirm\(|setMessage\(|setLocalMessage\(|new Notification\()[^"\n]*["']([^"']*[A-Za-zÀ-ÿ][^"']*)["']/;

function isAllowedVisibleLiteral(value: string): boolean {
  const normalized = value.trim();
  const technicalTerms = new Set([
    "Account",
    "Balance",
    "BE",
    "B/E",
    "Broker",
    "CLR",
    "Demo",
    "ENTRY",
    "Entry",
    "Equity",
    "Exit",
    "FX Blue",
    "FX Blue Account Sync",
    "Live",
    "MT4",
    "MT5",
    "P&L",
    "P&L $",
    "SL",
    "STOP LOSS",
    "Stop Loss",
    "TP",
    "TAKE PROFIT",
    "Take Profit",
    "Trade",
    "0 ?",
    "userLevel &&",
    "Win Rate",
    "XP",
  ]);
  return (
    normalized === ""
    || normalized === "TraderLoadings"
    || normalized === "TraderLoading"
    || technicalTerms.has(normalized)
    || normalized.includes("terminal64.exe")
  );
}

function hasUntranslatedVisibleCopy(source: string, file: string): boolean {
  return source.split(/\r?\n/).some((line) => {
    if (/=>|Promise<|ReturnType<|Dispatch<|SetStateAction<|interface |type /.test(line)) {
      return false;
    }

    if (file.endsWith(".tsx")) {
      const textMatch = line.match(visibleTextPattern);
      if (textMatch && !isAllowedVisibleLiteral(textMatch[1])) return true;

      const attrMatch = line.match(visibleAttributePattern);
      if (attrMatch && !isAllowedVisibleLiteral(attrMatch[2])) return true;
    }

    const messageMatch = line.match(visibleMessagePattern);
    if (messageMatch && !line.includes("t(") && !isAllowedVisibleLiteral(messageMatch[2])) return true;

    return false;
  });
}

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) out.push(absolutePath);
  }
  return out;
}

const copyScanRoot = fileURLToPath(new URL(".", import.meta.url));
const copyScanFiles = ["components", "pages", "contexts", "lib"]
  .flatMap((dir) => collectSourceFiles(join(copyScanRoot, dir)))
  .filter((file) => !/[/\\]components[/\\]ui[/\\]/.test(file))
  .filter((file) => !/\.(test|static\.test)\./.test(file))
  .filter((file) => !/(^|[/\\])i18n\.ts$/.test(file))
  .filter((file) => !/(^|[/\\])production-copy\.static\.test\.ts$/.test(file));

const newHardcodedCopyFiles = copyScanFiles
  .filter((file) => {
    const source = readFileSync(file, "utf8");
    return hasUntranslatedVisibleCopy(source, file);
  })
  .map((file) => file.replace(copyScanRoot, "").replace(/\\/g, "/"))
  .filter((file) => !legacyHardcodedCopyFiles.has(file))
  .sort();

assert.deepEqual(
  newHardcodedCopyFiles,
  [],
  "New UI/client files with visible hardcoded copy must use i18n or be explicitly reviewed in the legacy baseline",
);

console.log("production copy static checks passed");
