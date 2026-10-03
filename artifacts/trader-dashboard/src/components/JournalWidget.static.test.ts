import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const widgetSource = readFileSync(new URL("./JournalWidget.tsx", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("../pages/Dashboard.tsx", import.meta.url), "utf8");
const i18nDict = readFileSync(new URL("../lib/i18n/dict.it.ts", import.meta.url), "utf8");

assert.match(widgetSource, /JournalEntryModal/);
assert.match(widgetSource, /useGetJournalEntries/);
assert.match(widgetSource, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
assert.match(widgetSource, /event\.stopPropagation\(\)/);
// Le aria-label sono passate all'i18n: il widget referenzia la chiave e il
// catalogo contiene la copy italiana.
assert.match(widgetSource, /aria-label=\{uiText\("auto\.ui\.8a919429ca"\)\}/);
assert.match(i18nDict, /"auto\.ui\.8a919429ca":\s*"Crea nuovo trade dal widget diario"/);
assert.match(widgetSource, /aria-label=\{uiText\("journal\.open_page"\)\}/);
assert.match(i18nDict, /"journal\.open_page":\s*"Apri pagina diario"/);
assert.match(widgetSource, /getJournalWidgetSummary/);
assert.match(dashboardSource, /JournalWidget/);
assert.match(dashboardSource, /id: "journal"/);
assert.match(dashboardSource, /"checklist",\s*"lot",\s*"journal",\s*"sentiment"/s);

console.log("journal widget static checks passed");
