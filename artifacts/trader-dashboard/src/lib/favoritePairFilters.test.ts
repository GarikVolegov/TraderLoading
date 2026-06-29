import assert from "node:assert/strict";
import {
  CALENDAR_CURRENCIES,
  MACRO_CURRENCIES,
  resolveCalendarCurrencies,
  resolveMacroCurrencies,
} from "./favoritePairFilters";

// Macro: favorites' covered currencies only
assert.deepEqual(resolveMacroCurrencies(["EUR", "USD"]).items, ["EUR", "USD"]);
// Macro: no favorites → fall back to all macro currencies
assert.deepEqual(resolveMacroCurrencies([]).items, MACRO_CURRENCIES);
// Macro: only-unsupported favorites → fall back to all, and report unsupported
const macroBtc = resolveMacroCurrencies(["BTC"]);
assert.deepEqual(macroBtc.items, MACRO_CURRENCIES);
assert.deepEqual(macroBtc.unsupportedItems, ["BTC"]);
// Macro: mixed → keep supported, report unsupported
const macroMixed = resolveMacroCurrencies(["EUR", "BTC"]);
assert.deepEqual(macroMixed.items, ["EUR"]);
assert.deepEqual(macroMixed.unsupportedItems, ["BTC"]);

// Calendar: favorites' covered currencies only
assert.deepEqual(resolveCalendarCurrencies(["USD"]).items, ["USD"]);
// Calendar: no favorites → fall back to all calendar currencies
assert.deepEqual(resolveCalendarCurrencies([]).items, CALENDAR_CURRENCIES);
// Calendar: XAU is not a calendar currency → unsupported, fall back
const calXau = resolveCalendarCurrencies(["XAU"]);
assert.deepEqual(calXau.items, CALENDAR_CURRENCIES);
assert.deepEqual(calXau.unsupportedItems, ["XAU"]);

console.log("favoritePairFilters checks passed");
