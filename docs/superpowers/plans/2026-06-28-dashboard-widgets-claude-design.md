# Dashboard Widgets → Claude Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle four dashboard widgets (Watchlist Realtime, Routine, Volatilità & ADR, COT) onto the Claude Design system while keeping their real data and behaviour.

**Architecture:** Front-end only (`artifacts/trader-dashboard`). Pure helper functions (TDD-tested) drive the new derived metrics; widgets reuse the existing `ProgressRing`/`StatTile`/`Card` primitives. Volatility moves to a multi-pair `useQueries` grid; COT keeps its bulk fetch and adds diverging bars; new copy is routed through `uiText()` with keys added to all 5 languages.

**Tech Stack:** React 19, TanStack React Query, framer-motion, Tailwind 4, Vitest (node assert static tests), TypeScript strict.

## Global Constraints

- **Package manager:** pnpm only. Run tests from repo root with the toolchain on PATH.
- **Toolchain PATH (this machine):** `export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"` before pnpm/node.
- **No `any`** in non-test source (`@typescript-eslint/no-explicit-any` = error). TS strict.
- **i18n scanner** (`components/production-copy.static.test.ts`): new visible copy must be an expression `{uiText("key")}`, never a bare JSX text child or literal `aria-label`/`placeholder`/`title`. Every key used must exist in `DICT.it` and in all 5 languages.
- **Mojibake** (`i18n.parity.static.test.ts`): no `Ã`/`â`/`Â`/`ð` in any DICT value.
- **Volatility contrast** (`components/VolatilityWidget.contrast.static.test.ts`): keep `volatility-contrast-card` class; never use `text-muted-foreground/40|50|60` or `text-{primary|destructive|blue-400}/60`.
- **Languages:** `["it","en","es","fr","de"]`. Add keys via a typed `Record<Language, Record<string,string>>` block + `for (const lang of SUPPORTED_LANGUAGES) Object.assign(DICT[lang], BLOCK);` so TS enforces parity.
- **Commits:** semantic scope, e.g. `feat(dashboard):`, `test(dashboard):`. End commit messages with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Test run command:** `pnpm --filter @workspace/trader-dashboard test` (Vitest). Single file: append `-- run <path>` (e.g. `pnpm --filter @workspace/trader-dashboard test -- run src/components/VolatilityWidget.helpers.test.ts`).

---

### Task 1: i18n keys for the new widget copy

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/i18n.ts` (append a new translations block + merge loop after the existing `DASHBOARD_WIDGET_AUTO_TRANSLATIONS` merge loop)

**Interfaces:**
- Produces: the following `uiText` keys, present in all 5 languages —
  `vol.adr.exhausted`, `vol.adr.elevated`, `vol.adr.room`, `vol.adr.subtitle`,
  `cot.legend.short`, `cot.legend.long`,
  `routine.discipline.title`, `routine.discipline.subtitle`, `routine.session.start`,
  `routine.session.morning`, `routine.session.evening`.

- [ ] **Step 1: Add the translations block.** In `lib/i18n.ts`, immediately after the `for (const lang of SUPPORTED_LANGUAGES) { Object.assign(DICT[lang], DASHBOARD_WIDGET_AUTO_TRANSLATIONS); }` loop, insert:

```ts
const DASHBOARD_WIDGET_CLAUDE_DESIGN_TRANSLATIONS: Record<Language, Record<string, string>> = {
  it: {
    "vol.adr.exhausted": "Esaurito",
    "vol.adr.elevated": "Elevato",
    "vol.adr.room": "Spazio",
    "vol.adr.subtitle": "% range giornaliero usato",
    "cot.legend.short": "Short",
    "cot.legend.long": "Long",
    "routine.discipline.title": "Disciplina giornaliera",
    "routine.discipline.subtitle": "Completa entrambe per lo streak",
    "routine.session.start": "Avvia",
    "routine.session.morning": "Routine Mattutina",
    "routine.session.evening": "Routine Serale",
  },
  en: {
    "vol.adr.exhausted": "Exhausted",
    "vol.adr.elevated": "Elevated",
    "vol.adr.room": "Room",
    "vol.adr.subtitle": "% of daily range used",
    "cot.legend.short": "Short",
    "cot.legend.long": "Long",
    "routine.discipline.title": "Daily discipline",
    "routine.discipline.subtitle": "Complete both for the streak",
    "routine.session.start": "Start",
    "routine.session.morning": "Morning Routine",
    "routine.session.evening": "Evening Routine",
  },
  es: {
    "vol.adr.exhausted": "Agotado",
    "vol.adr.elevated": "Elevado",
    "vol.adr.room": "Margen",
    "vol.adr.subtitle": "% del rango diario usado",
    "cot.legend.short": "Short",
    "cot.legend.long": "Long",
    "routine.discipline.title": "Disciplina diaria",
    "routine.discipline.subtitle": "Completa ambas para la racha",
    "routine.session.start": "Iniciar",
    "routine.session.morning": "Rutina Matutina",
    "routine.session.evening": "Rutina Nocturna",
  },
  fr: {
    "vol.adr.exhausted": "Epuise",
    "vol.adr.elevated": "Eleve",
    "vol.adr.room": "Marge",
    "vol.adr.subtitle": "% de l'amplitude quotidienne utilisee",
    "cot.legend.short": "Short",
    "cot.legend.long": "Long",
    "routine.discipline.title": "Discipline quotidienne",
    "routine.discipline.subtitle": "Completez les deux pour la serie",
    "routine.session.start": "Demarrer",
    "routine.session.morning": "Routine Matinale",
    "routine.session.evening": "Routine du Soir",
  },
  de: {
    "vol.adr.exhausted": "Erschoepft",
    "vol.adr.elevated": "Erhoeht",
    "vol.adr.room": "Spielraum",
    "vol.adr.subtitle": "% der genutzten Tagesspanne",
    "cot.legend.short": "Short",
    "cot.legend.long": "Long",
    "routine.discipline.title": "Tagesdisziplin",
    "routine.discipline.subtitle": "Beide abschliessen fuer die Serie",
    "routine.session.start": "Starten",
    "routine.session.morning": "Morgenroutine",
    "routine.session.evening": "Abendroutine",
  },
};

for (const lang of SUPPORTED_LANGUAGES) {
  Object.assign(DICT[lang], DASHBOARD_WIDGET_CLAUDE_DESIGN_TRANSLATIONS);
}
```

> Note: French/German values intentionally avoid accented forms that contain `â`/`Â` to satisfy the mojibake guard; `é`/`è`/`ê` are allowed but `â` is not. The values above use plain ASCII where an `â`/`Â` would otherwise appear.

- [ ] **Step 2: Run the i18n static tests.**

Run: `pnpm --filter @workspace/trader-dashboard test -- run src/lib/i18n.parity.static.test.ts src/components/production-copy.static.test.ts`
Expected: PASS (key parity holds; no forbidden chars).

- [ ] **Step 3: Commit.**

```bash
git add artifacts/trader-dashboard/src/lib/i18n.ts
git commit -m "feat(dashboard): i18n keys for Claude Design widget copy

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Watchlist Realtime — remove scroll, grow with pairs

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.tsx:524`
- Check/Modify: `artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.static.test.ts`, `artifacts/trader-dashboard/src/pages/Dashboard.tradingview-watchlist.static.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Inspect the two static tests for assertions on the removed classes.**

Run: `grep -n "max-h-\|overflow-y-auto\|372" artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.static.test.ts artifacts/trader-dashboard/src/pages/Dashboard.tradingview-watchlist.static.test.ts`
Expected: note any assertion that pins `max-h-[372px]` or `overflow-y-auto` on the symbols list (these must be updated in Step 4). The pre-edit test run in Step 2 establishes the baseline.

- [ ] **Step 2: Run the watchlist static tests (baseline).**

Run: `pnpm --filter @workspace/trader-dashboard test -- run src/components/TradingViewWatchlistWidget.static.test.ts src/pages/Dashboard.tradingview-watchlist.static.test.ts`
Expected: PASS (baseline before change).

- [ ] **Step 3: Remove the scroll cap.** In `TradingViewWatchlistWidget.tsx`, change the symbols list container (line ~524) from:

```tsx
          <div className="max-h-[372px] space-y-1.5 overflow-y-auto overflow-x-hidden pr-1">
```

to:

```tsx
          <div className="space-y-1.5 overflow-x-hidden">
```

- [ ] **Step 4: If Step 1 found assertions pinning the removed classes, update them.** Replace any assertion that requires `max-h-[372px]`/`overflow-y-auto` on the symbols list with one that asserts the new intent — the list container does **not** scroll. Example (only if such an assertion exists):

```ts
// was: assert.match(source, /max-h-\[372px\][^"]*overflow-y-auto/);
assert.doesNotMatch(source, /symbols\.map[\s\S]{0,400}overflow-y-auto/);
```

If no such assertion exists, leave the tests unchanged.

- [ ] **Step 5: Run the watchlist static tests + typecheck.**

Run: `pnpm --filter @workspace/trader-dashboard test -- run src/components/TradingViewWatchlistWidget.static.test.ts src/pages/Dashboard.tradingview-watchlist.static.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit.**

```bash
git add artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.tsx artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.static.test.ts artifacts/trader-dashboard/src/pages/Dashboard.tradingview-watchlist.static.test.ts
git commit -m "feat(dashboard): watchlist grows with pairs instead of scrolling

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Volatility helpers (ADR %) — TDD

**Files:**
- Create: `artifacts/trader-dashboard/src/components/VolatilityWidget.helpers.ts`
- Test: `artifacts/trader-dashboard/src/components/VolatilityWidget.helpers.test.ts`

**Interfaces:**
- Produces:
  - `adrPercentUsed(todayPips: number, y1: number): number` — `round(clamp(todayPips / y1 * 100, 0, 100))`; returns `0` when `y1 <= 0` or inputs non-finite.
  - `type AdrLevelKey = "exhausted" | "elevated" | "room"`
  - `adrLevel(pct: number): { key: AdrLevelKey; tone: "destructive" | "warning" | "success" }` — `>=80 → exhausted/destructive`, `>=60 → elevated/warning`, else `room/success`.

- [ ] **Step 1: Write the failing test.** Create `VolatilityWidget.helpers.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { adrPercentUsed, adrLevel } from "./VolatilityWidget.helpers";

test("adrPercentUsed computes percent of ADR used and clamps to 0..100", () => {
  assert.equal(adrPercentUsed(50, 100), 50);
  assert.equal(adrPercentUsed(120, 100), 100); // clamped
  assert.equal(adrPercentUsed(0, 100), 0);
});

test("adrPercentUsed guards bad inputs", () => {
  assert.equal(adrPercentUsed(50, 0), 0);
  assert.equal(adrPercentUsed(50, -10), 0);
  assert.equal(adrPercentUsed(Number.NaN, 100), 0);
});

test("adrLevel maps thresholds to key + tone", () => {
  assert.deepEqual(adrLevel(85), { key: "exhausted", tone: "destructive" });
  assert.deepEqual(adrLevel(80), { key: "exhausted", tone: "destructive" });
  assert.deepEqual(adrLevel(70), { key: "elevated", tone: "warning" });
  assert.deepEqual(adrLevel(60), { key: "elevated", tone: "warning" });
  assert.deepEqual(adrLevel(40), { key: "room", tone: "success" });
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `pnpm --filter @workspace/trader-dashboard test -- run src/components/VolatilityWidget.helpers.test.ts`
Expected: FAIL ("Cannot find module './VolatilityWidget.helpers'").

- [ ] **Step 3: Write minimal implementation.** Create `VolatilityWidget.helpers.ts`:

```ts
export type AdrLevelKey = "exhausted" | "elevated" | "room";

export function adrPercentUsed(todayPips: number, y1: number): number {
  if (!Number.isFinite(todayPips) || !Number.isFinite(y1) || y1 <= 0) return 0;
  const pct = (todayPips / y1) * 100;
  return Math.round(Math.max(0, Math.min(100, pct)));
}

export function adrLevel(pct: number): {
  key: AdrLevelKey;
  tone: "destructive" | "warning" | "success";
} {
  if (pct >= 80) return { key: "exhausted", tone: "destructive" };
  if (pct >= 60) return { key: "elevated", tone: "warning" };
  return { key: "room", tone: "success" };
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `pnpm --filter @workspace/trader-dashboard test -- run src/components/VolatilityWidget.helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add artifacts/trader-dashboard/src/components/VolatilityWidget.helpers.ts artifacts/trader-dashboard/src/components/VolatilityWidget.helpers.test.ts
git commit -m "test(dashboard): ADR percent + level helpers for volatility widget

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Volatility widget — multi-pair ADR ring grid

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/VolatilityWidget.tsx` (rewrite the body; keep header shell + `volatility-contrast-card`)
- Check: `artifacts/trader-dashboard/src/components/VolatilityWidget.contrast.static.test.ts`, `artifacts/trader-dashboard/src/components/dashboard-pro-widgets.static.test.ts`

**Interfaces:**
- Consumes: `adrPercentUsed`, `adrLevel` (Task 3); `ProgressRing` from `@/components/ui/ProgressRing`; `useQueries` from `@tanstack/react-query`; `useBackground`, `deriveEffectiveFilterItems`, `apiFetch`, `uiText` (existing imports).

- [ ] **Step 1: Replace the component body.** Rewrite `VolatilityWidget.tsx`. Keep the top imports for `useMemo`/`useEffect`/`useRef`/`useState` only as needed; the new file:

```tsx
import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { apiFetch } from "@/lib/apiFetch";
import { deriveEffectiveFilterItems } from "@/lib/toolPairFilters";
import { uiText } from "@/contexts/LanguageContext";
import { adrPercentUsed, adrLevel } from "./VolatilityWidget.helpers";

interface VolatilityResult {
  pair: string; currentPrice: number; todayPips: number;
  w1: number; m1: number; m3: number; m6: number; y1: number;
  w1Pct: number | null; label: string; peakDay: string; pipUnit: string;
}

const ALL_VOL_PAIRS = ["EURUSD","GBPUSD","USDJPY","USDCHF","AUDUSD","USDCAD","NZDUSD","EURGBP","EURJPY","GBPJPY","XAUUSD","XAGUSD"];

const LEVEL_LABEL_KEY = {
  exhausted: "vol.adr.exhausted",
  elevated: "vol.adr.elevated",
  room: "vol.adr.room",
} as const;

export function VolatilityWidget() {
  const { selectedPairs: userPairs } = useBackground();

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

  const results = useQueries({
    queries: volPairs.map((pair) => ({
      queryKey: ["widget", "volatility", pair],
      queryFn: () => apiFetch<VolatilityResult>(`/api/tools/volatility?pair=${pair}`),
      staleTime: 15 * 60_000,
      refetchInterval: 15 * 60_000,
    })),
  });

  const anyFetching = results.some((r) => r.isFetching);
  const refetchAll = () => results.forEach((r) => r.refetch());

  return (
    <Card className="volatility-contrast-card relative overflow-hidden bg-card/80 backdrop-blur-sm border-border/60 flex flex-col">
      <div className="widget-header">
        <div className="flex items-center gap-2.5">
          <div className="widget-icon bg-warning/10 border border-warning/20">
            <TrendingUp className="w-4 h-4 text-warning" />
          </div>
          <div>
            <p className="widget-title">{uiText("auto.ui.de8919508a")}</p>
            <p className="widget-subtitle">{uiText("vol.adr.subtitle")}</p>
          </div>
        </div>
        <button
          onClick={refetchAll}
          disabled={anyFetching}
          className="p-1.5 rounded-lg hover:bg-secondary/70 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={uiText("auto.ui.f360775cb8")}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${anyFetching ? "animate-spin" : ""}`} />
        </button>
      </div>

      <CardContent className="p-4 space-y-3 flex-1">
        {volatilityFilter.hasUserSelection && volatilityFilter.unsupportedItems.length > 0 && (
          <p className="text-[9px] text-muted-foreground">
            {volatilityFilter.supportedCount}/{volatilityFilter.requestedCount} {uiText("auto.ui.pairsSupported") || ""}
          </p>
        )}

        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-2.5"
        >
          {volPairs.map((pair, i) => {
            const q = results[i];
            const data = q?.data;
            const pct = data ? adrPercentUsed(data.todayPips, data.y1) : 0;
            const level = adrLevel(pct);
            const toneClass =
              level.tone === "destructive" ? "text-destructive"
              : level.tone === "warning" ? "text-warning"
              : "text-success";
            return (
              <div
                key={pair}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-border/40 bg-secondary/35 px-2 py-3"
              >
                {q?.isError ? (
                  <div className="flex h-[74px] w-[74px] items-center justify-center text-muted-foreground">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                ) : (
                  <ProgressRing value={pct} size={74} stroke={7} tone={level.tone}>
                    <span className="font-mono text-base font-bold tabular-nums text-foreground">
                      {q?.isLoading ? "--" : pct}
                    </span>
                    <span className="text-[8px] text-muted-foreground">%</span>
                  </ProgressRing>
                )}
                <span className="font-mono text-xs font-bold text-foreground">{pair}</span>
                <span className={`text-[9px] font-bold uppercase tracking-[0.04em] ${toneClass}`}>
                  {uiText(LEVEL_LABEL_KEY[level.key])}
                </span>
              </div>
            );
          })}
        </motion.div>
      </CardContent>
    </Card>
  );
}
```

> The `uiText("auto.ui.pairsSupported") || ""` fallback is a guard only; if that key does not exist, replace the `{... pair supportati}` line with the existing pattern from the old file. To stay simple and avoid a missing key, use the literal-free approach: keep the count digits and route the word "pair supportati" through an existing key if present, else omit the trailing word. **Concretely:** delete the `{uiText("auto.ui.pairsSupported") || ""}` token and render only `{volatilityFilter.supportedCount}/{volatilityFilter.requestedCount}` followed by `{uiText("vol.adr.subtitle")}` is wrong — instead just show the ratio: `{volatilityFilter.supportedCount}/{volatilityFilter.requestedCount}`.

- [ ] **Step 1b: Simplify the "supported" note to avoid a missing key.** Replace the supported-note block with:

```tsx
        {volatilityFilter.hasUserSelection && volatilityFilter.unsupportedItems.length > 0 && (
          <p className="text-[9px] text-muted-foreground tabular-nums">
            {volatilityFilter.supportedCount}/{volatilityFilter.requestedCount}
          </p>
        )}
```

- [ ] **Step 2: Run contrast + pro-widgets static tests.**

Run: `pnpm --filter @workspace/trader-dashboard test -- run src/components/VolatilityWidget.contrast.static.test.ts src/components/dashboard-pro-widgets.static.test.ts`
Expected: PASS. If `dashboard-pro-widgets.static.test.ts` asserts on removed markup (period table / bar chart / pair selector), update those assertions to the new ADR-grid markup intent (e.g. assert presence of `ProgressRing` usage and `grid-cols-2`), without weakening coverage.

- [ ] **Step 3: Typecheck.**

Run: `pnpm --filter @workspace/trader-dashboard typecheck` (or `pnpm typecheck` from root)
Expected: PASS (no unused imports, no `any`).

- [ ] **Step 4: Commit.**

```bash
git add artifacts/trader-dashboard/src/components/VolatilityWidget.tsx artifacts/trader-dashboard/src/components/dashboard-pro-widgets.static.test.ts
git commit -m "feat(dashboard): volatility widget as multi-pair ADR ring grid (Claude Design)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: COT helpers (diverging bar width) — TDD

**Files:**
- Create: `artifacts/trader-dashboard/src/components/CotWidget.helpers.ts`
- Test: `artifacts/trader-dashboard/src/components/CotWidget.helpers.test.ts`

**Interfaces:**
- Produces: `cotBarWidth(net: number, maxAbs: number): number` — percent (0..100) of the half-track; `0` when `maxAbs <= 0` or inputs non-finite; `round(|net| / maxAbs * 100)`.

- [ ] **Step 1: Write the failing test.** Create `CotWidget.helpers.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "vitest";
import { cotBarWidth } from "./CotWidget.helpers";

test("cotBarWidth scales |net| against the set max", () => {
  assert.equal(cotBarWidth(50, 100), 50);
  assert.equal(cotBarWidth(-100, 100), 100);
  assert.equal(cotBarWidth(0, 100), 0);
});

test("cotBarWidth guards bad inputs", () => {
  assert.equal(cotBarWidth(50, 0), 0);
  assert.equal(cotBarWidth(50, -1), 0);
  assert.equal(cotBarWidth(Number.NaN, 100), 0);
});
```

- [ ] **Step 2: Run test to verify it fails.**

Run: `pnpm --filter @workspace/trader-dashboard test -- run src/components/CotWidget.helpers.test.ts`
Expected: FAIL ("Cannot find module './CotWidget.helpers'").

- [ ] **Step 3: Write minimal implementation.** Create `CotWidget.helpers.ts`:

```ts
export function cotBarWidth(net: number, maxAbs: number): number {
  if (!Number.isFinite(net) || !Number.isFinite(maxAbs) || maxAbs <= 0) return 0;
  return Math.round((Math.abs(net) / maxAbs) * 100);
}
```

- [ ] **Step 4: Run test to verify it passes.**

Run: `pnpm --filter @workspace/trader-dashboard test -- run src/components/CotWidget.helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add artifacts/trader-dashboard/src/components/CotWidget.helpers.ts artifacts/trader-dashboard/src/components/CotWidget.helpers.test.ts
git commit -m "test(dashboard): COT diverging-bar width helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: COT widget — diverging bars + keep expandable detail

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/CotWidget.tsx` (replace the 4-col tile grid with diverging bars; **keep** the `AnimatePresence` detail panel and footer)
- Check: `artifacts/trader-dashboard/src/components/dashboard-pro-widgets.static.test.ts`

**Interfaces:**
- Consumes: `cotBarWidth` (Task 5); existing `useQuery`, `useBackground`, `deriveEffectiveFilterItems`, `apiFetch`, `uiText`, `WidgetHeader`, recharts.

- [ ] **Step 1: Add the helper import.** At the top of `CotWidget.tsx` add:

```tsx
import { cotBarWidth } from "./CotWidget.helpers";
```

- [ ] **Step 2: Replace the tile grid with diverging bars.** Replace the `<div className="grid grid-cols-4 gap-1.5">…</div>` block (the currency tiles) with a legend + bar list. Insert, in place of that grid:

```tsx
            <div className="flex justify-between px-[38px] text-[9px] font-bold uppercase tracking-[0.08em]">
              <span className="text-destructive">{"◂ "}{uiText("cot.legend.short")}</span>
              <span className="text-success">{uiText("cot.legend.long")}{" ▸"}</span>
            </div>

            <div className="flex flex-col gap-2">
              {(() => {
                const maxAbs = Math.max(1, ...filteredReports.map((r) => Math.abs(r.nonCommNet)));
                return filteredReports.map((r) => {
                  const long = r.nonCommNet >= 0;
                  const isSelected = selected?.currency === r.currency;
                  const width = cotBarWidth(r.nonCommNet, maxAbs) / 2; // half-track each side
                  return (
                    <button
                      key={r.currency}
                      onClick={() => setSelected(isSelected ? null : r)}
                      className={`flex items-center gap-2 rounded-md px-1 py-1 transition-colors ${
                        isSelected ? "bg-primary/10" : "hover:bg-secondary/40"
                      }`}
                    >
                      <span className="w-8 text-left font-mono text-xs font-bold text-foreground">{r.currency}</span>
                      <span className="relative h-[18px] flex-1 overflow-hidden rounded-[5px] bg-secondary/50">
                        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
                        <span
                          className={`absolute top-[2px] bottom-[2px] rounded ${long ? "bg-success left-1/2" : "bg-destructive right-1/2"}`}
                          style={{ width: `${width}%` }}
                        />
                      </span>
                      <span className={`w-10 text-right font-mono text-xs font-bold ${long ? "text-success" : "text-destructive"}`}>
                        {long ? "+" : ""}{(r.nonCommNet / 1000).toFixed(0)}k
                      </span>
                    </button>
                  );
                });
              })()}
            </div>
```

> Keep the existing currency filter chips block (above) and the `<AnimatePresence>` detail panel + footer (below) exactly as they are — clicking a bar still toggles `selected`, driving the existing detail panel.

- [ ] **Step 3: Remove now-unused imports.** If `ArrowUp`/`ArrowDown` are no longer referenced after removing the tile trend arrows, delete them from the lucide-react import to satisfy `noUnusedLocals`.

Run: `grep -n "ArrowUp\|ArrowDown" artifacts/trader-dashboard/src/components/CotWidget.tsx`
Expected: only the import line remains → remove `ArrowUp, ArrowDown` from it.

- [ ] **Step 4: Run pro-widgets static test + typecheck.**

Run: `pnpm --filter @workspace/trader-dashboard test -- run src/components/dashboard-pro-widgets.static.test.ts && pnpm --filter @workspace/trader-dashboard typecheck`
Expected: PASS. If the static test pinned the old tile grid, update the assertion to the diverging-bar intent without weakening it.

- [ ] **Step 5: Commit.**

```bash
git add artifacts/trader-dashboard/src/components/CotWidget.tsx artifacts/trader-dashboard/src/components/dashboard-pro-widgets.static.test.ts
git commit -m "feat(dashboard): COT widget diverging long/short bars (Claude Design), detail kept

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Routine widget — Claude Design look, keep footer

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/RoutineWidget.tsx` (restyle `SessionRow` + top block; keep footer, modal, logic)
- Check: `artifacts/trader-dashboard/src/components/RoutineWidget.helpers.test.ts` (unchanged — helpers untouched)

**Interfaces:**
- Consumes: `uiText` keys from Task 1 (`routine.discipline.*`, `routine.session.*`); existing `ProgressRing`, `SessionModal`, helpers.

- [ ] **Step 1: Restyle `SessionRow`.** Replace the `SessionRow` component body (the `motion.div` content) with the Claude Design row — icon tile + label + check/Start pill:

```tsx
      <motion.div
        layout
        className={cn(
          "flex min-h-[3.25rem] items-center gap-3 rounded-md border px-3 py-2 transition-all duration-200 hover:border-primary/35 hover:bg-secondary/45",
          done ? "border-primary/22 bg-primary/5" : "border-border/35 bg-secondary/32",
        )}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border"
          style={{ background: `hsl(var(--${colorVar}) / 0.14)`, borderColor: `hsl(var(--${colorVar}) / 0.21)` }}
        >
          <Icon className="h-4 w-4" style={{ color: `hsl(var(--${colorVar}))` }} />
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{label}</span>
        {done ? (
          <Check className="h-[1.15rem] w-[1.15rem] text-primary" strokeWidth={3} />
        ) : (
          <span className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-[0.68rem] font-bold text-primary">
            {uiText("routine.session.start")}
          </span>
        )}
      </motion.div>
```

> Remove the now-unused `time`, `AnimatePresence` pending/done block, `Completed`/`Upcoming` text, and the left accent bar inside `SessionRow`. Keep the outer `button` wrapper with `onStart`/`onPointerDown`. Remove the `time` prop from `SessionRow`'s props and its two call sites if unused. Keep `import { Check }`; drop `AnimatePresence` only if no longer used elsewhere in the file (it is still used for the modal + glow — keep it).

- [ ] **Step 2: Replace the top progress block** (the `<div className="flex items-center gap-4 px-5 pb-3">` containing the ProgressRing) with the Claude Design ring + text:

```tsx
          <div className="flex items-center gap-4 px-5 pb-3">
            <ProgressRing value={ringValue} size={58} stroke={6} tone={ringTone}>
              <span className="font-mono text-sm font-bold tabular-nums text-foreground">{done}/2</span>
            </ProgressRing>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{uiText("routine.discipline.title")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{uiText("routine.discipline.subtitle")}</p>
            </div>
          </div>
```

- [ ] **Step 3: Route the two session-row labels through i18n.** Change the two `<SessionRow label="Programma mattutino" .../>` and `label="Programma serale"` to:

```tsx
            <SessionRow
              label={uiText("routine.session.morning")}
              ...
            />
            <SessionRow
              label={uiText("routine.session.evening")}
              ...
            />
```

(keep the rest of each `SessionRow`'s props; drop the `time="08:00 AM"` prop since the row no longer renders time.)

- [ ] **Step 4: Run i18n scanner + typecheck.** This catches any leftover literal JSX text and unused vars.

Run: `pnpm --filter @workspace/trader-dashboard test -- run src/components/production-copy.static.test.ts && pnpm --filter @workspace/trader-dashboard typecheck`
Expected: PASS. If the scanner flags a leftover literal (e.g. a stray `>Sessions<`), wrap it in `{uiText(...)}` with a key added in Task 1's block.

- [ ] **Step 5: Commit.**

```bash
git add artifacts/trader-dashboard/src/components/RoutineWidget.tsx
git commit -m "feat(dashboard): routine widget onto Claude Design rows, streak footer kept

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Full verification + push

**Files:** none (gate only)

- [ ] **Step 1: Run the gate.**

Run: `pnpm verify`
Expected: install → codegen → typecheck → test → build all PASS.

> Known pre-existing failures unrelated to this work (do not block): `railwayDeploy` and `Dashboard.order` per the project memory. If only those fail, proceed; investigate anything else.

- [ ] **Step 2: Manual smoke (optional but recommended).** `pnpm start:local`, open the dashboard, confirm: watchlist grows with added pairs (no inner scrollbar); routine shows ring + 2 styled rows + streak footer; volatility shows the ADR ring grid for selected pairs; COT shows diverging bars and a clicked currency still expands the area-chart detail.

- [ ] **Step 3: Push the branch.**

```bash
git push
```
(If no upstream: `git push -u origin feat/community-management`. Never `--force`; if rejected, report rather than force.)

---

## Self-Review

**Spec coverage:**
- §3.1 Watchlist no-scroll → Task 2. ✓
- §3.2 Routine Claude Design + footer → Task 7 (+ keys Task 1). ✓
- §3.3 Volatility ADR grid + real data → Tasks 3–4. ✓
- §3.4 COT diverging bars + detail → Tasks 5–6. ✓
- §4 helpers (`adrPercentUsed`, `adrLevel`, `cotBarWidth`) → Tasks 3, 5. ✓
- §4 i18n (5 langs) → Task 1. ✓
- §2 build gates (contrast, mojibake, i18n scanner) → enforced in Tasks 1,2,4,6,7 + Task 8 gate. ✓

**Type consistency:** `adrPercentUsed`/`adrLevel`/`cotBarWidth` signatures identical between definition (Tasks 3/5) and use (Tasks 4/6). `ProgressRing` `tone` values (`destructive|warning|success|primary`) match `adrLevel.tone` outputs and `ringTone`. ✓

**Placeholder scan:** Task 4 Step 1 contained a fragile "pairsSupported" guard — superseded by Step 1b which renders only the numeric ratio, removing the missing-key risk. No TBD/TODO remain. ✓
