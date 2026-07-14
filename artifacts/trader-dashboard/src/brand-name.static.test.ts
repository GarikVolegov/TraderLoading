import assert from "node:assert/strict";
import fs from "node:fs";
import { listSettingsFeatureFiles } from "./pages/settingsFeatureSource";

const officialName = "TraderLoading";
const forbiddenNames = /TraderLOADING|TRADERLOADING/;
const splitAllCapsBrand = /TRADER[\s\S]{0,120}LOADING/;

const files = [
  "index.html",
  "public/manifest.json",
  "public/sw.js",
  "src/components/AuthPageShell.tsx",
  "src/components/BottomNav.tsx",
  "src/components/TopNav.tsx",
  "src/pages/LandingPage.tsx",
  ...listSettingsFeatureFiles(),
  "src/lib/rewardsLibrary.ts",
];

for (const file of files) {
  const contents = fs.readFileSync(file, "utf8");

  assert.doesNotMatch(contents, forbiddenNames, `${file} must use ${officialName}`);
  assert.doesNotMatch(contents, splitAllCapsBrand, `${file} must not split ${officialName} as all caps`);
}

// Check all five dictionary files
const dictFiles = ["dict.it.ts", "dict.en.ts", "dict.es.ts", "dict.fr.ts", "dict.de.ts"];
for (const dictFile of dictFiles) {
  const filePath = `src/lib/i18n/${dictFile}`;
  const contents = fs.readFileSync(filePath, "utf8");

  assert.doesNotMatch(contents, forbiddenNames, `${filePath} must use ${officialName}`);
  assert.doesNotMatch(contents, splitAllCapsBrand, `${filePath} must not split ${officialName} as all caps`);
}

const index = fs.readFileSync("index.html", "utf8");
assert.match(index, /<title>TraderLoading[^<]*<\/title>/);
assert.match(index, /apple-mobile-web-app-title" content="TraderLoading"/);

const manifest = JSON.parse(fs.readFileSync("public/manifest.json", "utf8"));
assert.equal(manifest.name, officialName);
assert.equal(manifest.short_name, officialName);

console.log("brand name static checks passed");
