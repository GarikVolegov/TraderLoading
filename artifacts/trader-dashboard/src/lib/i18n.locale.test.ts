import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DICT,
  detectLanguageFromLocales,
  normalizeLocaleToLanguage,
  SUPPORTED_LANGUAGES,
} from "./i18n";

assert.equal(normalizeLocaleToLanguage("it-IT"), "it");
assert.equal(normalizeLocaleToLanguage("en_US"), "en");
assert.equal(normalizeLocaleToLanguage("FR-fr"), "fr");
assert.equal(normalizeLocaleToLanguage("pt-BR"), null);
assert.equal(normalizeLocaleToLanguage(""), null);

assert.equal(detectLanguageFromLocales(["pt-BR", "de-DE", "en-US"]), "de");
assert.equal(detectLanguageFromLocales(["zh-CN", "ru-RU"]), null);

const dashboardWidgetAutoKeys = [
  "auto.ui.486c14b32d",
  "auto.ui.b2a1267ce5",
  "auto.ui.2671bbd8db",
  "auto.ui.c61faab915",
  "auto.ui.ab99ace5d7",
  "auto.ui.5ad4db1d5a",
  "auto.ui.e6f450849b",
  "auto.ui.56c86a8f0d",
  "auto.ui.aeecb365d3",
  "auto.ui.03adb6db3f",
  "auto.ui.441ab27370",
  "auto.ui.8a919429ca",
  "auto.ui.e46122f621",
  "auto.ui.a5a9b84cff",
  "auto.ui.88cd2d84dd",
  "auto.ui.6b16da6cad",
  "auto.ui.25c37eced0",
  "auto.ui.482273d7cc",
  "auto.ui.cdac0f1fa1",
  "auto.ui.c992293454",
  "auto.ui.52bfe34c30",
  "auto.ui.de8919508a",
  "auto.ui.6ca10960a1",
  "auto.ui.e598e168c1",
  "auto.ui.c83dbbd3e6",
  "auto.ui.2287204815",
  "auto.ui.bb9c89b228",
  "auto.ui.6e28dfe791",
] as const;

for (const lang of SUPPORTED_LANGUAGES) {
  for (const key of dashboardWidgetAutoKeys) {
    const value = DICT[lang][key];
    assert.ok(value && !value.startsWith("auto.ui."), `[${lang}] broken dashboard widget copy for ${key}`);
  }
}

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absolutePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(absolutePath));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|static\.test)\./.test(entry.name)) {
      out.push(absolutePath);
    }
  }
  return out;
}

const appSourceRoot = fileURLToPath(new URL("..", import.meta.url));
const autoUiKeys = new Set<string>();
for (const dir of ["components", "contexts", "pages"].map((name) => join(appSourceRoot, name))) {
  for (const file of collectSourceFiles(dir)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/\buiText\(\s*["'](auto\.ui\.[a-f0-9]+)["']/g)) {
      autoUiKeys.add(match[1]);
    }
  }
}

for (const key of autoUiKeys) {
  assert.ok(DICT.it[key], `Missing Italian auto UI copy for ${key}`);
}

console.log("i18n locale checks passed");
