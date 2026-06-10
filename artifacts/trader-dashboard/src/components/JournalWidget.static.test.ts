import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const widgetSource = readFileSync(new URL("./JournalWidget.tsx", import.meta.url), "utf8");
const dashboardSource = readFileSync(new URL("../pages/Dashboard.tsx", import.meta.url), "utf8");

assert.match(widgetSource, /JournalEntryModal/);
assert.match(widgetSource, /useGetJournalEntries/);
assert.match(widgetSource, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
assert.match(widgetSource, /event\.stopPropagation\(\)/);
assert.match(widgetSource, /aria-label="Crea nuovo trade dal widget diario"/);
assert.match(widgetSource, /aria-label="Apri pagina diario"/);
assert.match(widgetSource, /getJournalWidgetSummary/);
assert.match(dashboardSource, /JournalWidget/);
assert.match(dashboardSource, /id: "journal"/);
assert.match(dashboardSource, /"checklist",\s*"lot",\s*"journal",\s*"sentiment"/s);

console.log("journal widget static checks passed");
