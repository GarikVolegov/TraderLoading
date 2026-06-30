import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./Wiki.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const bottomNav = readFileSync(new URL("../components/BottomNav.tsx", import.meta.url), "utf8");
const commandPalette = readFileSync(new URL("../components/CommandPalette.tsx", import.meta.url), "utf8");
const i18n = readFileSync(new URL("../lib/i18n.ts", import.meta.url), "utf8");
const addDialog = readFileSync(new URL("../components/archive/ArchiveAddDialog.tsx", import.meta.url), "utf8");

// Route + nav wiring unchanged.
assert.match(app, /const Wiki = lazy\(\(\) => import\("\.\/pages\/Wiki"\)\)/);
assert.match(app, /<Route path="\/wiki" component=\{Wiki\}/);
assert.match(bottomNav, /href: "\/wiki"/);
assert.match(commandPalette, /href: "\/wiki"/);

// Brain AI stays removed.
assert.doesNotMatch(app, /pages\/Brain/);
assert.doesNotMatch(bottomNav, /href: "\/brain"/);
assert.doesNotMatch(commandPalette, /href: "\/brain"/);

// The archive keeps the source CRUD endpoints.
for (const api of ["/wiki/sources", "/wiki/sources/upload", "/wiki/sources/text", "/wiki/sources/url"]) {
  assert.match(page, new RegExp(api.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
// ...and never resurrects the GraphRAG endpoints.
for (const removed of ["/wiki/graph", "/wiki/communities", "/wiki/query", "/wiki/reindex"]) {
  assert.doesNotMatch(page, new RegExp(removed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}

// New Archive structure: three views, type filter, detail modal, add dialog.
assert.match(page, /ArchiveRail/);
assert.match(page, /ArchiveToolbar/);
assert.match(page, /ArchiveGrid/);
assert.match(page, /ArchiveList/);
assert.match(page, /ArchiveBoard/);
assert.match(page, /ArchiveDetailModal/);
assert.match(page, /ArchiveAddDialog/);
assert.match(page, /collectionsFromFolders/);
assert.match(page, /filterSources/);

// Upload still uses react-dropzone with no click-to-open on the page surface.
assert.match(page, /useDropzone/);
assert.match(page, /noClick:\s*true/);
// The explicit file picker lives in the add dialog.
assert.match(addDialog, /useDropzone/);
assert.match(addDialog, /noClick:\s*true/);
assert.match(addDialog, /openPicker/);

// i18n keys exist.
assert.match(i18n, /"wiki\.title": "Archivio"/);
assert.match(i18n, /"archive\.title": "Il tuo archivio"/);
assert.match(i18n, /"archive\.empty\.title": "Inizia il tuo archivio"/);

console.log("wiki page static checks passed");
