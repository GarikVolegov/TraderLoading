import assert from "node:assert/strict";
import fs from "node:fs";

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
  "src/pages/Settings.tsx",
  "src/lib/i18n.ts",
  "src/lib/rewardsLibrary.ts",
];

for (const file of files) {
  const contents = fs.readFileSync(file, "utf8");

  assert.doesNotMatch(contents, forbiddenNames, `${file} must use ${officialName}`);
  assert.doesNotMatch(contents, splitAllCapsBrand, `${file} must not split ${officialName} as all caps`);
}

const index = fs.readFileSync("index.html", "utf8");
assert.match(index, /<title>TraderLoading[^<]*<\/title>/);
assert.match(index, /apple-mobile-web-app-title" content="TraderLoading"/);

const manifest = JSON.parse(fs.readFileSync("public/manifest.json", "utf8"));
assert.equal(manifest.name, officialName);
assert.equal(manifest.short_name, officialName);

console.log("brand name static checks passed");
