import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./Wiki.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const bottomNav = readFileSync(new URL("../components/BottomNav.tsx", import.meta.url), "utf8");
const commandPalette = readFileSync(new URL("../components/CommandPalette.tsx", import.meta.url), "utf8");
const i18n = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");

assert.match(app, /const Wiki = lazy\(\(\) => import\("\.\/pages\/Wiki"\)\)/);
assert.match(app, /<Route path="\/wiki" component=\{Wiki\}/);
assert.match(bottomNav, /href: "\/wiki"/);
assert.match(commandPalette, /href: "\/wiki"/);

for (const api of [
  "/wiki/sources",
  "/wiki/sources/upload",
  "/wiki/sources/text",
  "/wiki/sources/url",
  "/wiki/graph",
  "/wiki/communities",
  "/wiki/query",
  "/wiki/reindex",
]) {
  assert.match(page, new RegExp(api.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

assert.match(page, /useDropzone/);
assert.doesNotMatch(page, /accept:\s*\{/);
assert.match(page, /open\s*}\s*=\s*useDropzone/);
assert.match(page, /noClick:\s*true/);
assert.match(page, /onClick=\{open\}/);
assert.match(page, /Scegli file dal computer/);
assert.match(page, /wiki\.ask\.title/);
assert.match(page, /pending_transcription/);
assert.doesNotMatch(page, /auto\.ui\.missing/);
assert.match(page, /statusFilter/);
assert.match(page, /kindFilter/);
assert.match(page, /uploadError/);
assert.match(page, /queryError/);
assert.match(page, /wiki\.upload\.drop_title/);
assert.match(page, /wiki\.sources\.subtitle/);
assert.match(i18n, /"wiki\.ask\.title": "Ask your wiki"/);
assert.match(i18n, /"wiki\.upload\.drop_title": "Trascina qui o scegli file dal computer"/);
assert.match(i18n, /"wiki\.sources\.subtitle": "Mostra tutte le fonti/);

console.log("wiki page static checks passed");
