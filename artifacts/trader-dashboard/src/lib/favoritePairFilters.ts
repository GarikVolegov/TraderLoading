import { deriveEffectiveFilterItems, type EffectiveFilterItems } from "./toolPairFilters";

/** Currencies the macro-news backend can report on (matches the old ticker universe). */
export const MACRO_CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "XAU"];

/** Currencies the economic calendar covers. */
export const CALENDAR_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"];

function resolveAgainst(requested: string[], supported: string[]): EffectiveFilterItems {
  return deriveEffectiveFilterItems({
    requestedItems: requested,
    supportedItems: supported,
    defaultItems: supported,
  });
}

/** Macro-news currencies from the user's favorites; falls back to all macro currencies. */
export function resolveMacroCurrencies(contextCurrencies: string[]): EffectiveFilterItems {
  return resolveAgainst(contextCurrencies, MACRO_CURRENCIES);
}

/** Economic-calendar currencies from the user's favorites; falls back to all calendar currencies. */
export function resolveCalendarCurrencies(selectedCurrencies: string[]): EffectiveFilterItems {
  return resolveAgainst(selectedCurrencies, CALENDAR_CURRENCIES);
}
