# Favorite pairs as single source (macro + calendar + risk-on/off mobile) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the user's favorite pairs the single source of truth for the macro-news currencies and the economic-calendar currencies (removing per-tool manual selectors, falling back to defaults when no favorites), and make the macro risk-on/off detail fully visible on mobile.

**Architecture:** Add one shared pure module (`lib/favoritePairFilters.ts`) that wraps the existing `deriveEffectiveFilterItems` with the macro and calendar currency universes. `MacroNewsTicker` and `CalendarWidget` consume it, drop their manual currency selectors, and the macro sentiment block becomes a responsive (mobile-stacked, untruncated) card.

**Tech Stack:** React 19, TanStack Query, Tailwind 4, `@/contexts/BackgroundContext` (`selectedCurrencies`, derived from `selectedPairs`), `@/lib/toolPairFilters` (`deriveEffectiveFilterItems`), node-based `*.test.ts` static tests run by `pnpm test`.

## Global Constraints

- **TypeScript strict**; `@typescript-eslint/no-explicit-any` = error in non-test source. Remove now-unused imports/consts (eslint no-unused).
- **i18n enforced:** any user-visible string uses `uiText()`/`t()`; new keys go to all 5 languages (`it`, `en`, `es`, `fr`, `de`). No forbidden chars (`Ã` `â` `Â` `ð`). This change introduces **no new visible copy**; only removes UI.
- **Test discovery:** runner picks up any file matching `/\.test\.tsx?$/`. Pure-logic tests are standalone node scripts using `node:assert/strict` + a final `console.log("...checks passed")`. Static tests `readFileSync` the source and assert with `assert.match` / `assert.doesNotMatch`.
- **Single source of truth:** favorites are the only pair/currency control for these tools; when the user has no (supported) favorites, fall back to the full currency set. Non-pair filters (calendar **Impatto**) stay.
- **pnpm only.** Gate: `pnpm verify`. `pnpm lint` on touched files must stay clean (pre-existing lint errors elsewhere on the branch are out of scope). Don't `prettier --write`.
- **Toolchain PATH** (this environment): `export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"`. Run a single test file with: `pnpm --filter ./scripts exec tsx "$PWD/<absolute path to test>"`.
- **Semantic commits with scope** (e.g. `feat(ui):`, `refactor:`).

---

### Task 1: Shared favorite-currency resolver

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/favoritePairFilters.ts`
- Create (test): `artifacts/trader-dashboard/src/lib/favoritePairFilters.test.ts`

**Interfaces:**
- Consumes: `deriveEffectiveFilterItems(input): EffectiveFilterItems` from `./toolPairFilters` (returns `{ items, unsupportedItems, ... }`).
- Produces:
  - `MACRO_CURRENCIES: string[]` = `["EUR","USD","GBP","JPY","CHF","CAD","AUD","NZD","XAU"]`
  - `CALENDAR_CURRENCIES: string[]` = `["USD","EUR","GBP","JPY","AUD","CAD","CHF","NZD","CNY"]`
  - `resolveMacroCurrencies(contextCurrencies: string[]): EffectiveFilterItems`
  - `resolveCalendarCurrencies(selectedCurrencies: string[]): EffectiveFilterItems`

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/lib/favoritePairFilters.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./scripts exec tsx "$PWD/artifacts/trader-dashboard/src/lib/favoritePairFilters.test.ts"`
Expected: FAIL — cannot resolve `./favoritePairFilters`.

- [ ] **Step 3: Write the implementation**

Create `artifacts/trader-dashboard/src/lib/favoritePairFilters.ts`:

```ts
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
```

> Note: `toolPairFilters.ts` already exports `EffectiveFilterItems` (see its `export interface EffectiveFilterItems`). Import the type as shown.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./scripts exec tsx "$PWD/artifacts/trader-dashboard/src/lib/favoritePairFilters.test.ts"`
Expected: PASS — prints `favoritePairFilters checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/favoritePairFilters.ts artifacts/trader-dashboard/src/lib/favoritePairFilters.test.ts
git commit -m "feat(ui): shared favorite-currency resolver for macro + calendar"
```

---

### Task 2: Macro news — favorites-only currencies + mobile risk-on/off card

Rewrite `MacroNewsTicker` to drive currencies solely from favorites (no manual filter, no `localStorage`) and make the sentiment block a responsive, untruncated card.

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/MacroNewsTicker.tsx`
- Create (test): `artifacts/trader-dashboard/src/components/MacroNewsTicker.favorites.static.test.ts`

**Interfaces:**
- Consumes: `resolveMacroCurrencies`, `MACRO_CURRENCIES` from `@/lib/favoritePairFilters`; `useBackground().selectedCurrencies`.
- Produces: unchanged export `MacroNewsTicker()`.

- [ ] **Step 1: Write the failing static test**

Create `artifacts/trader-dashboard/src/components/MacroNewsTicker.favorites.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./MacroNewsTicker.tsx", import.meta.url), "utf8");

// Currencies come from favorites via the shared resolver
assert.match(source, /resolveMacroCurrencies/);
assert.match(source, /from "@\/lib\/favoritePairFilters"/);
assert.match(source, /useBackground\(\)/);

// Manual currency filter fully removed
assert.doesNotMatch(source, /macro-news-currencies/);
assert.doesNotMatch(source, /loadCurrencies/);
assert.doesNotMatch(source, /saveCurrencies/);
assert.doesNotMatch(source, /toggleCurrency/);
assert.doesNotMatch(source, /selectAll/);
assert.doesNotMatch(source, /Filtra per valuta/);

// Query still keyed by the derived currencies
assert.match(source, /queryKey: \["macro-news", MACRO_NEWS_QUERY_VERSION, currenciesKey\]/);

// Risk-on/off block: responsive (stacks on mobile) and not truncated
assert.match(source, /data\.sentiment/);
assert.match(source, /sm:flex-row/);
assert.doesNotMatch(source, /line-clamp-2/);

console.log("macro news favorites checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./scripts exec tsx "$PWD/artifacts/trader-dashboard/src/components/MacroNewsTicker.favorites.static.test.ts"`
Expected: FAIL — current source still contains `macro-news-currencies`, `Filtra per valuta`, `line-clamp-2`, etc.

- [ ] **Step 3: Replace the imports + currency constants**

In `MacroNewsTicker.tsx`, replace the toolPairFilters import line:

```tsx
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";
```

with:

```tsx
import { resolveMacroCurrencies, MACRO_CURRENCIES } from "@/lib/favoritePairFilters";
```

Then delete the local `ALL_CURRENCIES` constant block (the `const ALL_CURRENCIES = [ ... ];` array) and the `STORAGE_KEY` constant line:

```tsx
const STORAGE_KEY = "macro-news-currencies";
```

> `CURRENCY_FLAGS`, `IMPACT_DOT`, `IMPACT_STYLES`, `SENTIMENT_STYLES`, `DIRECTION_ICONS`, the marquee constants, and everything else in that block stay.

- [ ] **Step 4: Remove the localStorage currency helpers**

Delete the two functions `loadCurrencies()` and `saveCurrencies()` (the whole `function loadCurrencies(): string[] { ... }` and `function saveCurrencies(currencies: string[]) { ... }` blocks).

- [ ] **Step 5: Update `fetchMacroNews` to use `MACRO_CURRENCIES`**

In `fetchMacroNews`, change the length comparison so the param is sent only for a real subset:

```tsx
  if (currencies.length > 0 && currencies.length < MACRO_CURRENCIES.length) {
    params.set("currencies", currencies.join(","));
  }
```

(Replaces the previous `currencies.length < ALL_CURRENCIES.length` check; rest of the function is unchanged.)

- [ ] **Step 6: Rewire the component state to favorites-only**

In `MacroNewsTicker()`, replace this block:

```tsx
  const [selectedCurrencies, setSelectedCurrencies] =
    useState<string[]>(loadCurrencies);
  const forceNextRef = useRef(false);
  const marqueeTrackRef = useRef<HTMLDivElement | null>(null);
  const [marqueeDurationSeconds, setMarqueeDurationSeconds] = useState(
    DEFAULT_MARQUEE_DURATION_SECONDS,
  );
  const { selectedCurrencies: contextCurrencies } = useBackground();

  const pairDerivedCurrencies = useMemo(() => {
    const valid = contextCurrencies.filter((c) => ALL_CURRENCIES.includes(c));
    return valid.length > 0 ? valid : null;
  }, [contextCurrencies]);

  useEffect(() => {
    if (pairDerivedCurrencies) {
      setSelectedCurrencies(pairDerivedCurrencies);
      saveCurrencies(pairDerivedCurrencies);
    }
  }, [pairDerivedCurrencies]);

  useEffect(() => {
    saveCurrencies(selectedCurrencies);
  }, [selectedCurrencies]);

  const macroFilter = useMemo(
    () =>
      deriveEffectiveFilterItems({
        requestedItems: pairDerivedCurrencies ?? selectedCurrencies,
        supportedItems: ALL_CURRENCIES,
        defaultItems: selectedCurrencies,
      }),
    [pairDerivedCurrencies, selectedCurrencies],
  );
  const isPairDerivedMode = pairDerivedCurrencies !== null;
  const effectiveCurrencies = macroFilter.items;
```

with:

```tsx
  const forceNextRef = useRef(false);
  const marqueeTrackRef = useRef<HTMLDivElement | null>(null);
  const [marqueeDurationSeconds, setMarqueeDurationSeconds] = useState(
    DEFAULT_MARQUEE_DURATION_SECONDS,
  );
  const { selectedCurrencies: contextCurrencies } = useBackground();

  const macroFilter = useMemo(
    () => resolveMacroCurrencies(contextCurrencies),
    [contextCurrencies],
  );
  const effectiveCurrencies = macroFilter.items;
```

- [ ] **Step 7: Remove the `toggleCurrency` / `selectAll` callbacks**

Delete the `toggleCurrency` (`const toggleCurrency = useCallback(...)`) and `selectAll` (`const selectAll = useCallback(...)`) blocks. (`useCallback` stays imported — still used elsewhere, e.g. `handleEmbedError` is not here, but verify no unused import: if `useCallback` becomes unused after this, also remove it from the React import. Check with typecheck/lint in Step 11.)

- [ ] **Step 8: Replace the filter UI with the unsupported-coverage note**

In the Sheet body, replace this whole block:

```tsx
            {isPairDerivedMode ? (
              macroFilter.unsupportedItems.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Alcune coppie preferite non sono coperte dalle notizie macro:{" "}
                  {macroFilter.unsupportedItems.join(", ")}.
                </p>
              )
            ) : (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  Filtra per valuta
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={selectAll}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                      selectedCurrencies.length === ALL_CURRENCIES.length
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    Tutte
                  </button>
                  {ALL_CURRENCIES.map((cur) => {
                    const active = selectedCurrencies.includes(cur);
                    return (
                      <label
                        key={cur}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                          active
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-secondary/40 text-muted-foreground hover:border-primary/30"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleCurrency(cur)}
                          className="sr-only"
                        />
                        <span
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
                            active
                              ? "bg-primary border-primary"
                              : "border-muted-foreground/40"
                          }`}
                        >
                          {active && (
                            <Check className="w-2.5 h-2.5 text-primary-foreground" />
                          )}
                        </span>
                        {CURRENCY_FLAGS[cur]} {cur}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
```

with:

```tsx
            {macroFilter.unsupportedItems.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Alcune coppie preferite non sono coperte dalle notizie macro:{" "}
                {macroFilter.unsupportedItems.join(", ")}.
              </p>
            )}
```

> This removes the only use of `Check` and `CURRENCY_FLAGS` *in the filter*. `CURRENCY_FLAGS` is still used by `tickerItems` (keep it). `Check` (from lucide-react) is now unused — remove `Check` from the lucide-react import list. Verify in Step 11.

- [ ] **Step 9: Make the risk-on/off block a responsive, untruncated card**

Replace the sentiment block:

```tsx
            {data?.sentiment && (
              <div className="flex items-center gap-3">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                    SENTIMENT_STYLES[data.sentiment] ??
                    SENTIMENT_STYLES["neutrale"]
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  {data.sentiment.toUpperCase()}
                  {data.sentimentIntensity && (
                    <span className="opacity-70 font-bold">· {data.sentimentIntensity.toUpperCase()}</span>
                  )}
                </div>
                {data.summary && (
                  <p className="text-xs text-muted-foreground italic flex-1 line-clamp-2">
                    &ldquo;{data.summary}&rdquo;
                  </p>
                )}
              </div>
            )}
```

with:

```tsx
            {data?.sentiment && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div
                  className={`inline-flex w-fit items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                    SENTIMENT_STYLES[data.sentiment] ??
                    SENTIMENT_STYLES["neutrale"]
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  {data.sentiment.toUpperCase()}
                  {data.sentimentIntensity && (
                    <span className="opacity-70 font-bold">· {data.sentimentIntensity.toUpperCase()}</span>
                  )}
                </div>
                {data.summary && (
                  <p className="text-xs text-muted-foreground italic sm:flex-1">
                    &ldquo;{data.summary}&rdquo;
                  </p>
                )}
              </div>
            )}
```

- [ ] **Step 10: Run the new static test (expect pass)**

Run: `pnpm --filter ./scripts exec tsx "$PWD/artifacts/trader-dashboard/src/components/MacroNewsTicker.favorites.static.test.ts"`
Expected: PASS — prints `macro news favorites checks passed`.

- [ ] **Step 11: Typecheck + lint + existing macro static tests**

Run: `export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"; pnpm typecheck 2>&1 | tail -5`
Expected: Done (no errors). Fix any "declared but never read" (`useCallback`, `Check`, `CURRENCY_FLAGS` only if truly unused) by removing the unused import/symbol.

Run the three existing macro static tests + lint on the file:
```
for t in deep-dive clean-card speed; do pnpm --filter ./scripts exec tsx "$PWD/artifacts/trader-dashboard/src/components/MacroNewsTicker.$t.static.test.ts"; done
pnpm --filter @workspace/trader-dashboard exec eslint src/components/MacroNewsTicker.tsx
```
Expected: all three print their "checks passed"; eslint reports no errors for this file.

- [ ] **Step 12: Commit**

```bash
git add artifacts/trader-dashboard/src/components/MacroNewsTicker.tsx artifacts/trader-dashboard/src/components/MacroNewsTicker.favorites.static.test.ts
git commit -m "feat(ui): macro news currencies driven by favorites; risk-on/off detail visible on mobile"
```

---

### Task 3: Economic calendar — currencies from favorites

Drive the calendar's currency filter from favorites and remove the manual currency toggle. Keep the **Impatto** filter.

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/CalendarWidget.tsx`
- Create (test): `artifacts/trader-dashboard/src/components/CalendarWidget.favorites.static.test.ts`

**Interfaces:**
- Consumes: `resolveCalendarCurrencies` from `@/lib/favoritePairFilters`; `useBackground().selectedCurrencies`, `.calendarImpacts`, `.setCalendarImpacts`.
- Produces: unchanged export `CalendarWidget()`.

- [ ] **Step 1: Write the failing static test**

Create `artifacts/trader-dashboard/src/components/CalendarWidget.favorites.static.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./scripts exec tsx "$PWD/artifacts/trader-dashboard/src/components/CalendarWidget.favorites.static.test.ts"`
Expected: FAIL — source still contains `toggleCurrency`, `calendarCurrencies`, etc.

- [ ] **Step 3: Add the resolver import**

After the existing `import { uiText } from "@/contexts/LanguageContext";` line, add:

```tsx
import { resolveCalendarCurrencies } from "@/lib/favoritePairFilters";
```

Then delete the local `CURRENCIES` constant line:

```tsx
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD", "CNY"] as const;
```

- [ ] **Step 4: Rewire currencies to favorites**

Replace:

```tsx
  const { calendarCurrencies, setCalendarCurrencies, calendarImpacts, setCalendarImpacts } = useBackground();
  const selectedCurrencies = useMemo(() => new Set(calendarCurrencies), [calendarCurrencies]);
  const selectedImpacts = useMemo(() => new Set(calendarImpacts), [calendarImpacts]);
```

with:

```tsx
  const { selectedCurrencies: favoriteCurrencies, calendarImpacts, setCalendarImpacts } = useBackground();
  const selectedCurrencies = useMemo(
    () => new Set(resolveCalendarCurrencies(favoriteCurrencies).items),
    [favoriteCurrencies],
  );
  const selectedImpacts = useMemo(() => new Set(calendarImpacts), [calendarImpacts]);
```

- [ ] **Step 5: Remove the `toggleCurrency` callback**

Delete the whole `const toggleCurrency = useCallback((currency: string) => { ... }, [...]);` block. Keep `toggleImpact`.

- [ ] **Step 6: Remove the Valute filter section (keep Impatto)**

In the `filtersOpen` panel, delete the currency section block:

```tsx
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{uiText("auto.ui.04fe77cf1d")}</p>
              <div className="flex flex-wrap gap-1.5">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCurrency(c)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                      selectedCurrencies.has(c)
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-secondary/40 text-muted-foreground border border-border/50 hover:border-primary/30"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
```

Leave the **Impatto** section (`uiText("auto.ui.f150e87d33")` + the `IMPACT_CONFIG` buttons) exactly as-is.

- [ ] **Step 7: Run the new static test (expect pass)**

Run: `pnpm --filter ./scripts exec tsx "$PWD/artifacts/trader-dashboard/src/components/CalendarWidget.favorites.static.test.ts"`
Expected: PASS — prints `calendar favorites checks passed`.

- [ ] **Step 8: Typecheck + lint + existing calendar static tests**

```
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
pnpm typecheck 2>&1 | tail -5
pnpm --filter ./scripts exec tsx "$PWD/artifacts/trader-dashboard/src/components/CalendarWidget.bank-holiday-filter.static.test.ts"
pnpm --filter ./scripts exec tsx "$PWD/artifacts/trader-dashboard/src/components/CalendarWidget.no-missions.static.test.ts"
pnpm --filter @workspace/trader-dashboard exec eslint src/components/CalendarWidget.tsx
```
Expected: typecheck Done; both existing tests print their "checks passed"; eslint clean for the file. Fix any "declared but never read" (e.g. `useCallback` if now unused) by removing it from the React import.

> `BackgroundContext` `calendarCurrencies`/`syncCalendarFromPairs` stay untouched (used elsewhere); the widget simply no longer reads/writes the currency setting. `useUpdateUserSettings`/`saveSettings` remain for the impact toggle.

- [ ] **Step 9: Commit**

```bash
git add artifacts/trader-dashboard/src/components/CalendarWidget.tsx artifacts/trader-dashboard/src/components/CalendarWidget.favorites.static.test.ts
git commit -m "feat(ui): economic calendar currencies driven by favorite pairs"
```

---

### Task 4: Full gate

**Files:** none (verification only).

- [ ] **Step 1: Run the full gate**

Run: `export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"; pnpm verify 2>&1 | tail -30`
Expected: install → codegen → typecheck → test all green (`Test summary: N passed, 0 failed`). The build step stops only at the known `VITE_CLERK_PUBLISHABLE_KEY` env gate; confirm the frontend bundles with the documented preview flag:

Run: `ALLOW_MISSING_CLERK_KEY=1 pnpm --filter @workspace/trader-dashboard exec vite build --config vite.config.ts 2>&1 | tail -4`
Expected: `✓ built in …`.

- [ ] **Step 2: No commit** (verification only; nothing changed).

---

## Self-Review

**1. Spec coverage:**
- §4.1 macro favorites-only + fallback + remove manual filter/localStorage → Task 2 (steps 3–8) + Task 1. ✓
- §4.1 keep "unsupported coverage" note → Task 2 step 8 (`macroFilter.unsupportedItems`). ✓
- §4.2 risk-on/off responsive, untruncated on mobile → Task 2 step 9 (`sm:flex-row`, no `line-clamp-2`). ✓
- §4.3 calendar currencies from favorites, remove currency toggle, keep Impatto → Task 3. ✓
- §4.4 rest already compliant → no tasks (documented in spec). ✓
- §5 pure helper TDD + updated/new static tests → Task 1 + new static tests in Tasks 2 & 3; existing macro/calendar static tests re-run (steps 11/8). ✓
- §6 i18n: no new copy; removed UI only → no i18n task needed (`auto.ui.04fe77cf1d` becomes unused but stays in dict; parity preserved). ✓

**2. Placeholder scan:** No TBD/TODO; every code step has complete content. ✓

**3. Type consistency:** `resolveMacroCurrencies`/`resolveCalendarCurrencies` return `EffectiveFilterItems` (has `.items`, `.unsupportedItems`) — consumed as such in Tasks 2 (`.items`, `.unsupportedItems`) and 3 (`.items`). `MACRO_CURRENCIES` used in Task 2 step 5. `useBackground().selectedCurrencies` is `string[]` (BackgroundContext) → matches resolver param. ✓
