# Tool Filters From User Pairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tool filters read from the user's selected pairs, show only compact read-only filter panels, and remove per-tool local filter choices for this phase.

**Architecture:** Add one small pure helper for deriving supported filter items from user choices and tool capabilities, then use it in `/tools` and the macro ticker. UI changes stay local to existing components and preserve current fetch, refresh, chart, and detail behavior.

**Tech Stack:** React, TypeScript, TanStack Query, Framer Motion, lucide-react, Node `assert` script tests, existing pnpm workspace scripts.

---

## File Structure

- Create `artifacts/trader-dashboard/src/lib/toolPairFilters.ts`
  - Pure functions for deriving effective filter items, unsupported items, support count, and fallback state.
- Create `artifacts/trader-dashboard/src/lib/toolPairFilters.test.ts`
  - Node `assert` tests for the helper.
- Modify `artifacts/trader-dashboard/src/pages/Tools.tsx`
  - Add a small reusable read-only filter panel component.
  - Update `SentimentTool`, `VolatilityTool`, and `CotTool`.
- Modify `artifacts/trader-dashboard/src/components/SentimentWidget.tsx`
  - Make compact dashboard sentiment use the same supported-pair helper.
- Modify `artifacts/trader-dashboard/src/components/VolatilityWidget.tsx`
  - Keep the one-pair dropdown but derive options from supported user pairs.
- Modify `artifacts/trader-dashboard/src/components/CotWidget.tsx`
  - Show compact read-only derived-currency filters.
- Modify `artifacts/trader-dashboard/src/components/MacroNewsTicker.tsx`
  - Hide independent currency checkboxes when pair-derived currencies exist and show read-only derived filter chips.

## Task 1: Add Tested Filter Derivation Helper

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/toolPairFilters.ts`
- Test: `artifacts/trader-dashboard/src/lib/toolPairFilters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/lib/toolPairFilters.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  deriveEffectiveFilterItems,
  uniqueItems,
} from "./toolPairFilters.js";

assert.deepEqual(uniqueItems(["EURUSD", "EURUSD", "XAUUSD"]), ["EURUSD", "XAUUSD"]);
assert.deepEqual(uniqueItems(["", "  ", "USD"]), ["USD"]);

assert.deepEqual(
  deriveEffectiveFilterItems({
    requestedItems: ["EURUSD", "XAUUSD", "BTCUSD"],
    supportedItems: ["EURUSD", "GBPUSD", "XAUUSD"],
    defaultItems: ["EURUSD", "GBPUSD"],
  }),
  {
    items: ["EURUSD", "XAUUSD"],
    requestedItems: ["EURUSD", "XAUUSD", "BTCUSD"],
    unsupportedItems: ["BTCUSD"],
    supportedCount: 2,
    requestedCount: 3,
    hasUserSelection: true,
    isFallback: false,
  },
);

assert.deepEqual(
  deriveEffectiveFilterItems({
    requestedItems: [],
    supportedItems: ["EURUSD", "GBPUSD"],
    defaultItems: ["EURUSD"],
  }),
  {
    items: ["EURUSD"],
    requestedItems: [],
    unsupportedItems: [],
    supportedCount: 0,
    requestedCount: 0,
    hasUserSelection: false,
    isFallback: true,
  },
);

assert.deepEqual(
  deriveEffectiveFilterItems({
    requestedItems: ["BTCUSD"],
    supportedItems: ["EURUSD", "GBPUSD"],
    defaultItems: ["EURUSD"],
  }),
  {
    items: ["EURUSD"],
    requestedItems: ["BTCUSD"],
    unsupportedItems: ["BTCUSD"],
    supportedCount: 0,
    requestedCount: 1,
    hasUserSelection: true,
    isFallback: true,
  },
);

assert.deepEqual(
  deriveEffectiveFilterItems({
    requestedItems: ["USD", "EUR", "USD"],
    supportedItems: ["EUR", "USD", "JPY"],
    defaultItems: ["USD"],
  }).items,
  ["USD", "EUR"],
);

console.log("tool pair filter checks passed");
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/toolPairFilters.test.ts
```

Expected: FAIL because `./toolPairFilters.js` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `artifacts/trader-dashboard/src/lib/toolPairFilters.ts`:

```ts
export interface EffectiveFilterItems {
  items: string[];
  requestedItems: string[];
  unsupportedItems: string[];
  supportedCount: number;
  requestedCount: number;
  hasUserSelection: boolean;
  isFallback: boolean;
}

export interface DeriveEffectiveFilterItemsInput {
  requestedItems: string[];
  supportedItems: string[];
  defaultItems: string[];
}

export function uniqueItems(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

export function deriveEffectiveFilterItems(input: DeriveEffectiveFilterItemsInput): EffectiveFilterItems {
  const requestedItems = uniqueItems(input.requestedItems);
  const supportedItems = uniqueItems(input.supportedItems);
  const defaultItems = uniqueItems(input.defaultItems);
  const supportedSet = new Set(supportedItems);
  const matched = requestedItems.filter((item) => supportedSet.has(item));
  const unsupportedItems = requestedItems.filter((item) => !supportedSet.has(item));
  const hasUserSelection = requestedItems.length > 0;
  const isFallback = !hasUserSelection || matched.length === 0;
  const items = isFallback ? defaultItems : matched;

  return {
    items,
    requestedItems,
    unsupportedItems,
    supportedCount: matched.length,
    requestedCount: requestedItems.length,
    hasUserSelection,
    isFallback,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/toolPairFilters.test.ts
```

Expected: PASS and prints `tool pair filter checks passed`.

- [ ] **Step 5: Commit**

Run:

```bash
git add artifacts/trader-dashboard/src/lib/toolPairFilters.ts artifacts/trader-dashboard/src/lib/toolPairFilters.test.ts
git commit -m "feat: add tool pair filter derivation"
```

## Task 2: Update Full Tools Page Filters

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Tools.tsx`

- [ ] **Step 1: Write the failing helper usage test**

No component test harness exists for `Tools.tsx`. Use Task 1's pure helper test as the behavior guard before editing the component.

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/toolPairFilters.test.ts
```

Expected: PASS before component editing starts.

- [ ] **Step 2: Add imports**

In `artifacts/trader-dashboard/src/pages/Tools.tsx`, update the lucide import to include `Filter`, and add the helper import:

```ts
import {
  TrendingUp, TrendingDown, Activity, BarChart2, BarChart3, FileText, Newspaper, FlaskConical,
  RefreshCw, ChevronDown, AlertCircle, Loader2, Filter,
  ArrowUp, ArrowDown, Minus, Plus, Trash2, ArrowLeft, Play,
} from "lucide-react";
```

```ts
import { deriveEffectiveFilterItems, type EffectiveFilterItems } from "@/lib/toolPairFilters";
```

- [ ] **Step 3: Add the read-only panel component near `LoadingCard`**

Add this component after `LoadingCard()`:

```tsx
function ReadOnlyToolFilterPanel({
  open,
  title,
  items,
  summary,
  note,
}: {
  open: boolean;
  title: string;
  items: string[];
  summary?: string;
  note?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</p>
              {summary && <span className="text-[11px] text-muted-foreground">{summary}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((item) => (
                <span key={item} className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold border bg-primary/10 text-primary border-primary/30">
                  {item}
                </span>
              ))}
            </div>
            {note && <p className="text-[11px] text-muted-foreground leading-relaxed">{note}</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function formatFilterSummary(filter: EffectiveFilterItems): string {
  if (!filter.hasUserSelection) return "Default";
  return `${filter.supportedCount}/${filter.requestedCount} supportati`;
}

function formatFilterNote(filter: EffectiveFilterItems, itemName: string): string | undefined {
  if (!filter.hasUserSelection) return `Nessun pair selezionato: uso il default ${itemName}.`;
  if (filter.isFallback) return `Nessuno dei tuoi ${itemName} e' supportato da questo strumento: uso il default disponibile.`;
  if (filter.unsupportedItems.length > 0) return `Non supportati qui: ${filter.unsupportedItems.join(", ")}.`;
  return undefined;
}
```

- [ ] **Step 4: Replace local sentiment filter state**

Inside `SentimentTool`, remove:

```ts
const [selectedPairs, setSelectedPairs] = useState<string[]>([]);
```

Keep `filterOpen`, then replace the sorting/filtering block with:

```ts
const allPairs = data?.symbols?.map((s) => s.name) ?? [];
const [filterOpen, setFilterOpen] = useState(false);

const sentimentFilter = useMemo(
  () =>
    deriveEffectiveFilterItems({
      requestedItems: userPairs,
      supportedItems: allPairs,
      defaultItems: allPairs,
    }),
  [allPairs, userPairs],
);

const visibleSymbols = useMemo(() => {
  if (!data?.symbols) return [];
  const selectedSet = new Set(sentimentFilter.items);
  return data.symbols.filter((symbol) => selectedSet.has(symbol.name));
}, [data?.symbols, sentimentFilter.items]);
```

Remove `togglePair`, `selectAll`, and `selectNone`.

- [ ] **Step 5: Replace the sentiment filter button label**

In `SentimentTool`, replace the filter button contents with:

```tsx
<Filter className="w-3.5 h-3.5" />
Filtri {sentimentFilter.items.length > 0 && `(${sentimentFilter.items.length})`}
<ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
```

- [ ] **Step 6: Replace the sentiment editable filter panel**

Replace the full sentiment `AnimatePresence` filter block with:

```tsx
<ReadOnlyToolFilterPanel
  open={filterOpen}
  title="Filtri dai tuoi pair"
  items={sentimentFilter.items}
  summary={formatFilterSummary(sentimentFilter)}
  note={formatFilterNote(sentimentFilter, "pair")}
/>
```

- [ ] **Step 7: Update volatility derived options**

Inside `VolatilityTool`, replace `volPairs` with:

```ts
const volatilityFilter = useMemo(
  () =>
    deriveEffectiveFilterItems({
      requestedItems: userPairs,
      supportedItems: ALL_VOL_PAIRS,
      defaultItems: ALL_VOL_PAIRS,
    }),
  [userPairs],
);
const volPairs = volatilityFilter.items;
```

Add:

```ts
const [filterOpen, setFilterOpen] = useState(false);
```

after the dropdown `open` state.

- [ ] **Step 8: Add the volatility read-only filter control**

In `VolatilityTool`, after the refresh `Button` in the header row, add:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => setFilterOpen((v) => !v)}
  className={`gap-1.5 ${filterOpen ? "bg-primary/10 text-primary border-primary/30" : ""}`}
>
  <Filter className="w-3.5 h-3.5" />
  Filtri
  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
</Button>
```

Immediately after that header row, add:

```tsx
<ReadOnlyToolFilterPanel
  open={filterOpen}
  title="Pair disponibili"
  items={volatilityFilter.items}
  summary={formatFilterSummary(volatilityFilter)}
  note={formatFilterNote(volatilityFilter, "pair")}
/>
```

- [ ] **Step 9: Add COT read-only derived filter panel**

Inside `CotTool`, add:

```ts
const [filterOpen, setFilterOpen] = useState(false);
const cotCurrencies = useMemo(
  () => selectedCurrencies.filter((currency) => data?.reports?.some((report) => report.currency === currency) ?? false),
  [data?.reports, selectedCurrencies],
);
```

Replace `filteredReports` with:

```ts
const cotFilter = useMemo(
  () =>
    deriveEffectiveFilterItems({
      requestedItems: selectedCurrencies,
      supportedItems: data?.reports?.map((report) => report.currency) ?? [],
      defaultItems: data?.reports?.map((report) => report.currency) ?? [],
    }),
  [data?.reports, selectedCurrencies],
);

const filteredReports = useMemo(() => {
  if (!data?.reports) return [];
  const userCurrSet = new Set(cotFilter.items);
  return data.reports.filter((r) => userCurrSet.has(r.currency));
}, [cotFilter.items, data?.reports]);
```

Remove the unused `cotCurrencies` declaration if it is not referenced after this replacement.

Add a filter button next to refresh:

```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => setFilterOpen((v) => !v)}
  className={`gap-1.5 ${filterOpen ? "bg-primary/10 text-primary border-primary/30" : ""}`}
>
  <Filter className="w-3.5 h-3.5" />
  Filtri
  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filterOpen ? "rotate-180" : ""}`} />
</Button>
```

Add below the header:

```tsx
<ReadOnlyToolFilterPanel
  open={filterOpen}
  title="Valute dai tuoi pair"
  items={cotFilter.items}
  summary={formatFilterSummary(cotFilter)}
  note={formatFilterNote(cotFilter, "valute")}
/>
```

- [ ] **Step 10: Run typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS.

- [ ] **Step 11: Commit**

Run:

```bash
git add artifacts/trader-dashboard/src/pages/Tools.tsx
git commit -m "feat: derive tools filters from user pairs"
```

## Task 3: Update Compact Dashboard Tool Widgets

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/SentimentWidget.tsx`
- Modify: `artifacts/trader-dashboard/src/components/VolatilityWidget.tsx`
- Modify: `artifacts/trader-dashboard/src/components/CotWidget.tsx`

- [ ] **Step 1: Run helper test before widget edits**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/toolPairFilters.test.ts
```

Expected: PASS.

- [ ] **Step 2: Update `SentimentWidget` imports and sorting**

Add:

```ts
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";
```

Replace `sortedSymbols` with:

```ts
const sentimentFilter = useMemo(
  () =>
    deriveEffectiveFilterItems({
      requestedItems: userPairs,
      supportedItems: data?.symbols?.map((symbol) => symbol.name) ?? [],
      defaultItems: data?.symbols?.slice(0, 6).map((symbol) => symbol.name) ?? [],
    }),
  [data?.symbols, userPairs],
);

const sortedSymbols = useMemo(() => {
  if (!data?.symbols) return [];
  const selectedSet = new Set(sentimentFilter.items);
  return data.symbols.filter((symbol) => selectedSet.has(symbol.name)).slice(0, 6);
}, [data?.symbols, sentimentFilter.items]);
```

- [ ] **Step 3: Add compact widget filter note**

After `<FearGreedArc score={avgLong} />`, add:

```tsx
<div className="flex items-center gap-1.5 flex-wrap">
  {sentimentFilter.items.map((pair) => (
    <span key={pair} className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/25">
      {pair}
    </span>
  ))}
  {sentimentFilter.hasUserSelection && sentimentFilter.unsupportedItems.length > 0 && (
    <span className="text-[9px] text-muted-foreground">
      {sentimentFilter.supportedCount}/{sentimentFilter.requestedCount} supportati
    </span>
  )}
</div>
```

- [ ] **Step 4: Update `VolatilityWidget` helper usage**

Add:

```ts
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";
```

Replace `volPairs` with:

```ts
const volatilityFilter = useMemo(
  () =>
    deriveEffectiveFilterItems({
      requestedItems: userPairs,
      supportedItems: ALL_VOL_PAIRS,
      defaultItems: ALL_VOL_PAIRS,
    }),
  [userPairs],
);

const volPairs = volatilityFilter.items;
```

After the pair selector block, add:

```tsx
{volatilityFilter.hasUserSelection && volatilityFilter.unsupportedItems.length > 0 && (
  <p className="text-[9px] text-muted-foreground">
    {volatilityFilter.supportedCount}/{volatilityFilter.requestedCount} pair supportati
  </p>
)}
```

- [ ] **Step 5: Update `CotWidget` helper usage**

Add:

```ts
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";
```

Replace `filteredReports` with:

```ts
const cotFilter = useMemo(
  () =>
    deriveEffectiveFilterItems({
      requestedItems: selectedCurrencies,
      supportedItems: data?.reports?.map((report) => report.currency) ?? [],
      defaultItems: data?.reports?.map((report) => report.currency) ?? [],
    }),
  [data?.reports, selectedCurrencies],
);

const filteredReports = useMemo(() => {
  if (!data?.reports) return [];
  const userCurrSet = new Set(cotFilter.items);
  return data.reports.filter((r) => userCurrSet.has(r.currency));
}, [cotFilter.items, data?.reports]);
```

Before the currency grid, add:

```tsx
<div className="flex items-center gap-1.5 flex-wrap">
  {cotFilter.items.map((currency) => (
    <span key={currency} className="px-1.5 py-0.5 rounded-md text-[9px] font-mono font-bold bg-primary/10 text-primary border border-primary/25">
      {currency}
    </span>
  ))}
  {cotFilter.hasUserSelection && cotFilter.unsupportedItems.length > 0 && (
    <span className="text-[9px] text-muted-foreground">
      {cotFilter.supportedCount}/{cotFilter.requestedCount} valute supportate
    </span>
  )}
</div>
```

- [ ] **Step 6: Run typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add artifacts/trader-dashboard/src/components/SentimentWidget.tsx artifacts/trader-dashboard/src/components/VolatilityWidget.tsx artifacts/trader-dashboard/src/components/CotWidget.tsx
git commit -m "feat: align dashboard widget filters with user pairs"
```

## Task 4: Make Macro Ticker Pair-Derived Filters Read-Only

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/MacroNewsTicker.tsx`

- [ ] **Step 1: Run helper test before ticker edits**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/toolPairFilters.test.ts
```

Expected: PASS.

- [ ] **Step 2: Add helper import**

Add:

```ts
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";
```

- [ ] **Step 3: Add derived-filter state**

After `pairDerivedCurrencies`, add:

```ts
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
```

Replace `currenciesKey` with:

```ts
const effectiveCurrencies = macroFilter.items;

const currenciesKey = useMemo(
  () => [...effectiveCurrencies].sort().join(","),
  [effectiveCurrencies],
);
```

Replace the query function call with:

```ts
return fetchMacroNews(effectiveCurrencies, force);
```

- [ ] **Step 4: Hide checkbox list in pair-derived mode**

Replace the `Valute di interesse` section with:

```tsx
<div>
  <p className="text-xs font-semibold text-muted-foreground mb-2">Valute dai tuoi pair</p>
  {isPairDerivedMode ? (
    <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {effectiveCurrencies.map((cur) => (
          <span
            key={cur}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border border-primary/30 bg-primary/10 text-primary"
          >
            {CURRENCY_FLAGS[cur] ?? ""} {cur}
          </span>
        ))}
      </div>
      {macroFilter.unsupportedItems.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Non supportate qui: {macroFilter.unsupportedItems.join(", ")}.
        </p>
      )}
    </div>
  ) : (
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
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${
              active ? "bg-primary border-primary" : "border-muted-foreground/40"
            }`}>
              {active && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
            </span>
            {CURRENCY_FLAGS[cur]} {cur}
          </label>
        );
      })}
    </div>
  )}
</div>
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add artifacts/trader-dashboard/src/components/MacroNewsTicker.tsx
git commit -m "feat: show macro ticker filters from user pairs"
```

## Task 5: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run helper tests**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/toolPairFilters.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run dashboard typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run dashboard build**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run build
```

Expected: PASS.

- [ ] **Step 4: Manual check**

Start the frontend if no dev server is already running:

```bash
pnpm --filter @workspace/trader-dashboard run dev
```

Check:

- `/tools?tab=sentiment` shows a compact `Filtri` panel populated from selected pairs and no local `Tutti` or `Nessuno`.
- `/tools?tab=volatility` keeps a small pair dropdown limited to supported selected pairs.
- `/tools?tab=cot` shows derived currencies and no independent currency chooser.
- The macro ticker sheet shows read-only derived currencies when selected pairs exist.
- Dashboard widgets show compact derived chips and remain usable.

- [ ] **Step 5: Final commit if verification required changes**

If final verification required code changes, commit them:

```bash
git add artifacts/trader-dashboard/src
git commit -m "fix: polish tool filter verification"
```

If no code changes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: Task 1 centralizes filter derivation; Task 2 covers `/tools`; Task 3 covers compact widgets; Task 4 covers macro ticker; Task 5 covers verification.
- No per-tool override storage or disabled override UI is introduced.
- Unsupported pair behavior is explicit through support counts and compact notes.
- Existing backend APIs remain unchanged.
- Tests protect the core filter derivation behavior before component edits.
