import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./CalendarWidget.tsx", import.meta.url), "utf8");

// Currencies come from favorites via the shared resolver
assert.match(source, /resolveCalendarCurrencies/);
assert.match(source, /from "@\/lib\/favoritePairFilters"/);

// Manual currency toggle removed
assert.doesNotMatch(source, /toggleCurrency/);
assert.doesNotMatch(source, /setCalendarCurrencies/);
assert.doesNotMatch(source, /calendarCurrencies/);

// Impact filter retained
assert.match(source, /toggleImpact/);
assert.match(source, /IMPACT_CONFIG/);

console.log("calendar favorites checks passed");
