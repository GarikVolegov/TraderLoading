# Diario (Journal) Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Panoramica" overview to the Diario page matching the downloaded Claude Design, wired to real edge/recap/trade data, keeping every existing tab.

**Architecture:** A new presentational `JournalOverview` component composes five blocks (KPI tiles, equity curve, edge bars, 4-week recap, recent trades) from existing hooks (`useGetJournalEdge`, `useGetJournalEntries`, the four-week recap query). A pure `lib/equityProjection.ts` computes the cumulative-R series and a Monte-Carlo projection (ported deterministically from the kit). `Journal.tsx` gains a `panoramica` tab as the new default; the overview's "detail" affordances call `setTab(...)`.

**Tech Stack:** React 19, TypeScript (strict), TanStack React Query, framer-motion, Tailwind 4, existing `components/ui/*` primitives (`Card`, `CardHeader`, `CardContent`, `StatTile`, `Progress`), `node:test` + `tsx` for unit/static tests.

## Global Constraints

- **No `any`** in non-test source (`@typescript-eslint/no-explicit-any` = error). Tests may use `any`.
- **i18n mandatory:** every user-facing string uses `t("...")`; add each new key to **all 5 languages** in `src/lib/i18n.ts`. No literals passed to `title`/`label`/`subtitle` props (`production-copy.static.test.ts`). No `Ã/â/Â/ð` bytes in DICT values (`i18n.parity.static.test.ts`, `i18n.mojibake.static.test.ts`).
- **No contract change, no new endpoint.** Net R is derived client-side from fetched trades.
- **Reuse, don't fork:** KPI tiles use `StatTile`; edge bars use `Progress`; cards use `Card/CardHeader/CardContent`.
- **Commit after each task.** Branch: `feat/community-management` (already current).
- Run from repo root with toolchain on PATH: `export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"`.
- Run a single test file with: `cd artifacts/trader-dashboard && npx tsx <path-from-src-root>`.

## File Structure

- Create `artifacts/trader-dashboard/src/lib/equityProjection.ts` — pure math: cumulative R + Monte-Carlo bands.
- Create `artifacts/trader-dashboard/src/lib/equityProjection.test.ts` — unit tests.
- Create `artifacts/trader-dashboard/src/components/journal/EquityCurveChart.tsx` — presentational SVG.
- Create `artifacts/trader-dashboard/src/components/journal/EquityCurveChart.static.test.ts` — static checks.
- Create `artifacts/trader-dashboard/src/components/journal/JournalOverview.tsx` — composes the five blocks from real hooks.
- Create `artifacts/trader-dashboard/src/components/journal/JournalOverview.static.test.ts` — static checks.
- Modify `artifacts/trader-dashboard/src/pages/Journal.tsx` — new `panoramica` tab (default) rendering `JournalOverview`.
- Modify `artifacts/trader-dashboard/src/lib/i18n.ts` — new `journal.overview.*` keys × 5 languages.

Reference (already in repo, do not edit): `design-ref/diario/journal-view.jsx` — the exact design source to port (SVG geometry, layout, copy).

---

### Task 1: Pure equity-projection library

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/equityProjection.ts`
- Test: `artifacts/trader-dashboard/src/lib/equityProjection.test.ts`

**Interfaces:**
- Produces:
  - `cumulativeR(rSamples: number[], start?: number): number[]` — running cumulative series, length `rSamples.length + 1`, element 0 = `start` (default 0).
  - `mulberry32(seed: number): () => number`
  - `quantile(sorted: number[], q: number): number`
  - `interface ProjectionBands { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[]; samplePaths: number[][] }`
  - `monteCarloBands(rSamples: number[], opts: { steps: number; start: number; sims?: number; seed?: number; samplePathCount?: number }): ProjectionBands` — each band array has length `steps + 1`, index 0 = `start`.

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/lib/equityProjection.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { cumulativeR, mulberry32, quantile, monteCarloBands } from "./equityProjection";

test("cumulativeR builds a running sum anchored at start", () => {
  assert.deepEqual(cumulativeR([1, -0.5, 2]), [0, 1, 0.5, 2.5]);
  assert.deepEqual(cumulativeR([1, 1], 3), [3, 4, 5]);
  assert.deepEqual(cumulativeR([]), [0]);
});

test("mulberry32 is deterministic for a seed", () => {
  const a = mulberry32(123), b = mulberry32(123);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test("quantile interpolates within a sorted array", () => {
  assert.equal(quantile([0, 10], 0.5), 5);
  assert.equal(quantile([0, 10, 20], 0), 0);
  assert.equal(quantile([0, 10, 20], 1), 20);
});

test("monteCarloBands returns ordered bands of the right length", () => {
  const b = monteCarloBands([1, -1, 2, 0.5], { steps: 10, start: 5, seed: 42 });
  assert.equal(b.p50.length, 11);
  assert.equal(b.p10[0], 5);
  assert.equal(b.p90[0], 5);
  for (let i = 0; i <= 10; i++) {
    assert.ok(b.p10[i] <= b.p50[i] + 1e-9, `p10<=p50 at ${i}`);
    assert.ok(b.p50[i] <= b.p90[i] + 1e-9, `p50<=p90 at ${i}`);
  }
});

test("monteCarloBands is deterministic for a seed", () => {
  const o = { steps: 8, start: 0, seed: 7 } as const;
  assert.deepEqual(monteCarloBands([1, -1, 0.5], o), monteCarloBands([1, -1, 0.5], o));
});

test("monteCarloBands tolerates an empty sample set", () => {
  const b = monteCarloBands([], { steps: 5, start: 2 });
  assert.deepEqual(b.p50, [2, 2, 2, 2, 2, 2]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd artifacts/trader-dashboard && npx tsx src/lib/equityProjection.test.ts`
Expected: FAIL — `Cannot find module './equityProjection'`.

- [ ] **Step 3: Write minimal implementation**

Create `artifacts/trader-dashboard/src/lib/equityProjection.ts`:

```ts
// Pure helpers for the Diario equity curve: realized cumulative-R series and a
// Monte-Carlo projection resampled from the user's own per-trade R distribution.
// Ported deterministically from the design kit (design-ref/diario/journal-view.jsx).

export function cumulativeR(rSamples: number[], start = 0): number[] {
  const out = [start];
  let cum = start;
  for (const r of rSamples) {
    cum += r;
    out.push(cum);
  }
  return out;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

export interface ProjectionBands {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  samplePaths: number[][];
}

export function monteCarloBands(
  rSamples: number[],
  opts: { steps: number; start: number; sims?: number; seed?: number; samplePathCount?: number },
): ProjectionBands {
  const { steps, start, sims = 300, seed = 20260619, samplePathCount = 14 } = opts;
  const cols: number[][] = Array.from({ length: steps + 1 }, () => []);
  const samplePaths: number[][] = [];

  if (rSamples.length === 0) {
    const flat = Array.from({ length: steps + 1 }, () => start);
    return { p10: [...flat], p25: [...flat], p50: [...flat], p75: [...flat], p90: [...flat], samplePaths: [] };
  }

  const rnd = mulberry32(seed);
  for (let s = 0; s < sims; s++) {
    let cum = start;
    const path = [start];
    cols[0].push(start);
    for (let k = 1; k <= steps; k++) {
      cum += rSamples[Math.floor(rnd() * rSamples.length)];
      path.push(cum);
      cols[k].push(cum);
    }
    if (s < samplePathCount) samplePaths.push(path);
  }

  const p10: number[] = [], p25: number[] = [], p50: number[] = [], p75: number[] = [], p90: number[] = [];
  for (const c of cols) {
    const sorted = [...c].sort((a, b) => a - b);
    p10.push(quantile(sorted, 0.1));
    p25.push(quantile(sorted, 0.25));
    p50.push(quantile(sorted, 0.5));
    p75.push(quantile(sorted, 0.75));
    p90.push(quantile(sorted, 0.9));
  }
  return { p10, p25, p50, p75, p90, samplePaths };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd artifacts/trader-dashboard && npx tsx src/lib/equityProjection.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/equityProjection.ts artifacts/trader-dashboard/src/lib/equityProjection.test.ts
git commit -m "feat(journal): pure equity-curve + Monte-Carlo projection helpers"
```

---

### Task 2: EquityCurveChart presentational component

**Files:**
- Create: `artifacts/trader-dashboard/src/components/journal/EquityCurveChart.tsx`
- Test: `artifacts/trader-dashboard/src/components/journal/EquityCurveChart.static.test.ts`

**Interfaces:**
- Consumes: `ProjectionBands` from `@/lib/equityProjection`.
- Produces: `export function EquityCurveChart(props: { realized: number[]; bands: ProjectionBands; projectionSteps: number }): JSX.Element` — `realized` is the historical cumulative-R series (length H); `bands` arrays have length `projectionSteps + 1` and are anchored at `realized[H-1]`.

- [ ] **Step 1: Write the failing static test**

Create `artifacts/trader-dashboard/src/components/journal/EquityCurveChart.static.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/components/journal/EquityCurveChart.tsx", "utf8");

test("renders an svg driven by props, not hardcoded arrays", () => {
  assert.match(src, /<svg/);
  assert.match(src, /props\.realized|\{\s*realized/);
  assert.match(src, /props\.bands|\{\s*realized,\s*bands|bands\b/);
  // No baked-in mock series (the kit's literals must not be copied)
  assert.doesNotMatch(src, /\[0,\s*0\.4,\s*1\.8/);
});

test("draws the historical line, the 80% band and the median", () => {
  assert.match(src, /p10/);
  assert.match(src, /p90/);
  assert.match(src, /p50/);
  assert.match(src, /strokeDasharray/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd artifacts/trader-dashboard && npx tsx src/components/journal/EquityCurveChart.static.test.ts`
Expected: FAIL — `ENOENT ... EquityCurveChart.tsx`.

- [ ] **Step 3: Write the component**

Port the SVG geometry from `design-ref/diario/journal-view.jsx` (the `EquityCurve` function), but take `realized`, `bands`, and `projectionSteps` as props instead of module constants. Create `artifacts/trader-dashboard/src/components/journal/EquityCurveChart.tsx`:

```tsx
import { type ProjectionBands } from "@/lib/equityProjection";

interface EquityCurveChartProps {
  realized: number[];
  bands: ProjectionBands;
  projectionSteps: number;
}

const W = 560;
const H = 150;
const PAD = 8;
const ACCENT_GREEN = "hsl(142 71% 45%)";
const PROJ_BLUE = "hsl(210 90% 62%)";

export function EquityCurveChart({ realized, bands, projectionSteps }: EquityCurveChartProps) {
  const histN = realized.length;
  const span = Math.max(1, histN - 1 + projectionSteps);
  const allV = [...realized, ...bands.p10, ...bands.p90];
  const max = Math.max(...allV, 0);
  const min = Math.min(...allV, 0);
  const xOf = (idx: number) => PAD + (idx / span) * (W - PAD * 2);
  const yOf = (v: number) => H - PAD - ((v - min) / (max - min || 1)) * (H - PAD * 2);

  const histPts = realized.map((v, i) => [xOf(i), yOf(v)] as const);
  const histLine = histPts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const lastPt = histPts[histPts.length - 1] ?? [xOf(0), yOf(0)];
  const histArea = `${histLine} L${lastPt[0].toFixed(1)},${H} L${(histPts[0]?.[0] ?? PAD).toFixed(1)},${H} Z`;

  const px = (k: number) => xOf(histN - 1 + k);
  const bandPath = (lo: number[], hi: number[]) => {
    const up = hi.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
    const down = lo.map((_, k) => `L${px(lo.length - 1 - k).toFixed(1)},${yOf(lo[lo.length - 1 - k]).toFixed(1)}`).join(" ");
    return `${up} ${down} Z`;
  };
  const medianLine = bands.p50.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const simPath = (path: number[]) => path.map((v, k) => `${k === 0 ? "M" : "L"}${px(k).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const divX = px(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="eqfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT_GREEN} stopOpacity="0.28" />
          <stop offset="100%" stopColor={ACCENT_GREEN} stopOpacity="0" />
        </linearGradient>
      </defs>

      <path d={bandPath(bands.p10, bands.p90)} fill={PROJ_BLUE} fillOpacity="0.1" />
      <path d={bandPath(bands.p25, bands.p75)} fill={PROJ_BLUE} fillOpacity="0.14" />
      {bands.samplePaths.map((p, i) => (
        <path key={i} d={simPath(p)} fill="none" stroke={PROJ_BLUE} strokeOpacity="0.12" strokeWidth="1" />
      ))}
      <path d={medianLine} fill="none" stroke={PROJ_BLUE} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />

      <line x1={divX} y1={PAD} x2={divX} y2={H - PAD} stroke="hsl(var(--border))" strokeWidth="1" strokeDasharray="3 3" />

      <path d={histArea} fill="url(#eqfill)" />
      <path d={histLine} fill="none" stroke={ACCENT_GREEN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {histPts.length > 0 && <circle cx={lastPt[0]} cy={lastPt[1]} r="3.5" fill={ACCENT_GREEN} />}
      {bands.p50.length > 0 && <circle cx={px(projectionSteps)} cy={yOf(bands.p50[projectionSteps])} r="3" fill={PROJ_BLUE} />}
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd artifacts/trader-dashboard && npx tsx src/components/journal/EquityCurveChart.static.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/journal/EquityCurveChart.tsx artifacts/trader-dashboard/src/components/journal/EquityCurveChart.static.test.ts
git commit -m "feat(journal): EquityCurveChart presentational SVG"
```

---

### Task 3: i18n keys for the overview

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/i18n.ts`

**Interfaces:**
- Produces: keys under `journal.overview.*` present in **all 5 languages**. Keys (English reference values shown; translate per language, Italian matches the design kit copy):
  - `journal.overview.new_trade` → IT "Nuovo Trade"
  - `journal.overview.kpi_total` → IT "Totale Trade"
  - `journal.overview.kpi_winrate` → IT "Win Rate"
  - `journal.overview.kpi_net` → IT "P&L netto"
  - `journal.overview.kpi_pf` → IT "Profit Factor"
  - `journal.overview.equity_title` → IT "Equity Curve"
  - `journal.overview.equity_subtitle` → IT "Realizzato + proiezione Monte Carlo · 1 mese"
  - `journal.overview.legend_realized` → IT "Realizzato"
  - `journal.overview.legend_band` → IT "Intervallo 80%"
  - `journal.overview.legend_median` → IT "Mediana proiettata"
  - `journal.overview.edge_title` → IT "Edge"
  - `journal.overview.edge_subtitle` → IT "Scomposizione del vantaggio"
  - `journal.overview.edge_expectancy` → IT "Expectancy"
  - `journal.overview.edge_payoff` → IT "Avg win / Avg loss"
  - `journal.overview.edge_discipline` → IT "Disciplina (piano rispettato)"
  - `journal.overview.edge_revenge` → IT "Revenge-trade"
  - `journal.overview.edge_detail` → IT "Vedi dettaglio"
  - `journal.overview.recap_title` → IT "Recap 4 settimane"
  - `journal.overview.recap_subtitle` → IT "Sintesi generata sui tuoi trade"
  - `journal.overview.recap_open` → IT "Apri recap"
  - `journal.overview.recap_empty` → IT "Nessun recap generato per questo periodo."
  - `journal.overview.recap_judgment` → IT "Giudizio generale"
  - `journal.overview.recap_well` → IT "Cosa è andato bene"
  - `journal.overview.recap_wrong` → IT "Cosa è andato storto"
  - `journal.overview.recap_patterns` → IT "Pattern individuati"
  - `journal.overview.trades_title` → IT "Trade recenti"
  - `journal.overview.trades_subtitle` → IT "I tuoi ultimi trade registrati"
  - `journal.overview.trades_empty` → IT "Nessun trade registrato."
  - `journal.tab.overview` → IT "Panoramica"

- [ ] **Step 1: Find the dictionary shape**

Run: `cd artifacts/trader-dashboard && rg -n '"journal.tab.trades"' src/lib/i18n.ts`
Read the surrounding block for each language (the file holds one object per language). Note how an existing `journal.*` key is written in each of the 5 language objects.

- [ ] **Step 2: Add every key above to all 5 languages**

For each of the 5 language objects, add the `journal.overview.*` and `journal.tab.overview` keys next to the existing `journal.*` keys. Use the Italian values verbatim above for the IT object; provide faithful translations for the others. **Avoid** the bytes `Ã â Â ð` in any value (e.g. write `è`, `À` correctly as UTF-8, never mojibake).

- [ ] **Step 3: Verify parity, mojibake, and copy tests pass**

Run:
```bash
cd artifacts/trader-dashboard
npx tsx src/lib/i18n.parity.static.test.ts
npx tsx src/lib/i18n.mojibake.static.test.ts
```
Expected: both PASS (no missing keys across languages, no forbidden bytes).

- [ ] **Step 4: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/i18n.ts
git commit -m "i18n(journal): keys for the Diario overview (5 languages)"
```

---

### Task 4: JournalOverview component (real data)

**Files:**
- Create: `artifacts/trader-dashboard/src/components/journal/JournalOverview.tsx`
- Test: `artifacts/trader-dashboard/src/components/journal/JournalOverview.static.test.ts`

**Interfaces:**
- Consumes: `cumulativeR`, `monteCarloBands` from `@/lib/equityProjection`; `EquityCurveChart` from `./EquityCurveChart`; `useGetJournalEdge`, `getGetJournalEdgeQueryKey`, `useGetJournalEntries`, `getGetJournalEntriesQueryKey` from `@workspace/api-client-react`; `getJournalRecapPeriod` from `@/lib/journalRecapPeriods`; `fetchJournalRecap`, `journalRecapQueryKey` from `@/lib/journalRecapsApi`; `parseTradeContent`, `tradeRMultiple` from `@/lib/parseTradeContent`; `StatTile`, `Progress`, `Card`, `CardHeader`, `CardContent`, `Badge`, `Button` from `@/components/ui/*`; `useLanguage`, `useDateLocale` from `@/contexts/LanguageContext`.
- Produces: `export function JournalOverview(props: { onNavigate: (tab: "edge" | "recap-mensile") => void }): JSX.Element`.

- [ ] **Step 1: Write the failing static test**

Create `artifacts/trader-dashboard/src/components/journal/JournalOverview.static.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = fs.readFileSync("src/components/journal/JournalOverview.tsx", "utf8");

test("reads real data hooks, not mock arrays", () => {
  assert.match(src, /useGetJournalEdge/);
  assert.match(src, /useGetJournalEntries/);
  assert.match(src, /fetchJournalRecap/);
  assert.match(src, /getJournalRecapPeriod\(\s*"four_week"/);
  // mock literals from the kit must not survive
  assert.doesNotMatch(src, /JOURNAL_TRADES|"128"|"\+24\.6R"/);
});

test("composes the five sections via real primitives + chart", () => {
  assert.match(src, /StatTile/);
  assert.match(src, /EquityCurveChart/);
  assert.match(src, /Progress/);
  assert.match(src, /tradeRMultiple/);
  assert.match(src, /onNavigate/);
});

test("every visible string is i18n'd", () => {
  assert.match(src, /journal\.overview\./);
  // no obvious hardcoded Italian copy
  assert.doesNotMatch(src, /Nuovo Trade|Recap 4 settimane|Trade recenti/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd artifacts/trader-dashboard && npx tsx src/components/journal/JournalOverview.static.test.ts`
Expected: FAIL — `ENOENT ... JournalOverview.tsx`.

- [ ] **Step 3: Write the component**

Create `artifacts/trader-dashboard/src/components/journal/JournalOverview.tsx`. Data mapping:
- KPIs from `edge.overall`: total = `closedTrades`; winRate = `winRate`; **net R = last value of `cumulativeR(rSamples)`** (derived from trades, not the cash `netProfit`); PF = `profitFactor`.
- `rSamples` = per-trade R from `entries`: `entries.map(e => tradeRMultiple(parseTradeContent(e.content))).filter((r): r is number => r !== null)`, oldest→newest (sort by `tradeDate` ascending).
- Equity: `realized = cumulativeR(rSamples)`; `bands = monteCarloBands(rSamples, { steps: 20, start: realized.at(-1) ?? 0 })`.
- Edge bars: Expectancy (`overall.expectancyR`, bar `clamp(expectancyR/1 *100)`), Payoff (`overall.avgWinR/|overall.avgLossR|`), Disciplina (`100 - (discipline.stopDiscipline?.pct ?? 0)`), Revenge (`highlights.postLoss?.trades ?? 0`, bar small).
- Recap: `period = getJournalRecapPeriod("four_week")`; `useQuery({ queryKey: journalRecapQueryKey(period), queryFn: () => fetchJournalRecap(period) })`; show `overallJudgment`, `wentWell`, `wentWrong`, `patterns` (empty → `recap_empty` + "Apri recap" → `onNavigate("recap-mensile")`).
- Recent trades: last 5 entries (sort by `tradeDate` desc), each: pair = `parsed.symbol ?? e.title`; dir badge from `parsed.direction` (LONG/SHORT) when present; note = `e.title`; date = `e.tradeDate` (format with `useDateLocale`); R via `tradeRMultiple` toned by `e.result`.

```tsx
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Plus, LineChart, Activity, Sparkles, List, TrendingUp, ArrowRight } from "lucide-react";
import {
  useGetJournalEdge,
  getGetJournalEdgeQueryKey,
  useGetJournalEntries,
  getGetJournalEntriesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/StatTile";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage, useDateLocale } from "@/contexts/LanguageContext";
import { getJournalRecapPeriod } from "@/lib/journalRecapPeriods";
import { fetchJournalRecap, journalRecapQueryKey } from "@/lib/journalRecapsApi";
import { parseTradeContent, tradeRMultiple } from "@/lib/parseTradeContent";
import { cumulativeR, monteCarloBands } from "@/lib/equityProjection";
import { EquityCurveChart } from "./EquityCurveChart";

const PROJECTION_STEPS = 20;

function fmtR(v: number | null): string {
  if (v === null) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}R`;
}
function clampPct(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function JournalOverview({ onNavigate }: { onNavigate: (tab: "edge" | "recap-mensile") => void }) {
  const { t } = useLanguage();
  const dateLocale = useDateLocale();

  const { data: edge } = useGetJournalEdge({
    query: { queryKey: getGetJournalEdgeQueryKey(), refetchInterval: 30_000 },
  });
  const { data: entries } = useGetJournalEntries({
    query: { queryKey: getGetJournalEntriesQueryKey(), refetchInterval: 30_000 },
  });

  const recapPeriod = useMemo(() => getJournalRecapPeriod("four_week"), []);
  const recapQuery = useQuery({
    queryKey: journalRecapQueryKey(recapPeriod),
    queryFn: () => fetchJournalRecap(recapPeriod),
  });

  const rSamples = useMemo(() => {
    if (!entries) return [] as number[];
    return [...entries]
      .sort((a, b) => a.tradeDate.localeCompare(b.tradeDate))
      .map((e) => tradeRMultiple(parseTradeContent(e.content) ?? {}))
      .filter((r): r is number => r !== null);
  }, [entries]);

  const realized = useMemo(() => cumulativeR(rSamples), [rSamples]);
  const bands = useMemo(
    () => monteCarloBands(rSamples, { steps: PROJECTION_STEPS, start: realized[realized.length - 1] ?? 0 }),
    [rSamples, realized],
  );
  const netR = realized[realized.length - 1] ?? 0;

  const overall = edge?.overall;
  const payoff =
    overall?.avgWinR != null && overall?.avgLossR != null && overall.avgLossR !== 0
      ? Math.abs(overall.avgWinR / overall.avgLossR)
      : null;
  const disciplinePct = 100 - (edge?.discipline.stopDiscipline?.pct ?? 0);
  const revenge = edge?.highlights.postLoss?.trades ?? 0;

  const recentTrades = useMemo(() => {
    if (!entries) return [];
    return [...entries]
      .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
      .slice(0, 5)
      .map((e) => {
        const parsed = parseTradeContent(e.content) ?? {};
        return {
          id: e.id,
          pair: parsed.symbol ?? e.title,
          dir: parsed.direction,
          note: e.title,
          date: e.tradeDate,
          r: tradeRMultiple(parsed),
          result: e.result,
        };
      });
  }, [entries]);

  const edgeBars = [
    { l: t("journal.overview.edge_expectancy"), v: fmtR(overall?.expectancyR ?? null), pct: clampPct(((overall?.expectancyR ?? 0) / 1) * 100) },
    { l: t("journal.overview.edge_payoff"), v: payoff === null ? "—" : payoff.toFixed(1), pct: clampPct((payoff ?? 0) * 33) },
    { l: t("journal.overview.edge_discipline"), v: `${clampPct(disciplinePct)}%`, pct: clampPct(disciplinePct) },
    { l: t("journal.overview.edge_revenge"), v: String(revenge), pct: revenge === 0 ? 4 : Math.min(100, revenge * 20) },
  ];

  const recap = recapQuery.data;
  const recapBlocks = recap
    ? [
        { k: t("journal.overview.recap_judgment"), text: recap.overallJudgment },
        { k: t("journal.overview.recap_well"), text: recap.wentWell },
        { k: t("journal.overview.recap_wrong"), text: recap.wentWrong },
        { k: t("journal.overview.recap_patterns"), text: recap.patterns },
      ].filter((b) => b.text)
    : [];

  return (
    <div className="space-y-4">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t("journal.overview.kpi_total")} value={overall ? String(overall.closedTrades) : "—"} size="lg" />
        <StatTile label={t("journal.overview.kpi_winrate")} value={overall?.winRate != null ? `${overall.winRate}%` : "—"} tone="success" size="lg" />
        <StatTile label={t("journal.overview.kpi_net")} value={fmtR(netR)} tone={netR >= 0 ? "primary" : "destructive"} size="lg" />
        <StatTile label={t("journal.overview.kpi_pf")} value={overall?.profitFactor != null ? overall.profitFactor.toFixed(1) : "—"} size="lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {/* Equity curve */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LineChart className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">{t("journal.overview.equity_title")}</p>
                <p className="text-xs text-muted-foreground">{t("journal.overview.equity_subtitle")}</p>
              </div>
            </div>
            <Badge variant="secondary"><TrendingUp className="mr-1 h-3 w-3" />{fmtR(netR)}</Badge>
          </CardHeader>
          <CardContent className="pt-2">
            <EquityCurveChart realized={realized} bands={bands} projectionSteps={PROJECTION_STEPS} />
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3.5 rounded bg-[hsl(142_71%_45%)]" />{t("journal.overview.legend_realized")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-3.5 rounded border border-[hsl(210_90%_62%/0.4)] bg-[hsl(210_90%_62%/0.22)]" />{t("journal.overview.legend_band")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-0 w-3.5 border-t-2 border-dashed border-[hsl(210_90%_62%)]" />{t("journal.overview.legend_median")}</span>
            </div>
          </CardContent>
        </Card>

        {/* Edge breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-semibold">{t("journal.overview.edge_title")}</p>
                <p className="text-xs text-muted-foreground">{t("journal.overview.edge_subtitle")}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onNavigate("edge")}>
              {t("journal.overview.edge_detail")}<ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {edgeBars.map((m) => (
              <div key={m.l}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{m.l}</span>
                  <span className="font-mono font-bold">{m.v}</span>
                </div>
                <Progress value={m.pct} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* 4-week recap */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t("journal.overview.recap_title")}</p>
              <p className="text-xs text-muted-foreground">{t("journal.overview.recap_subtitle")}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onNavigate("recap-mensile")}>
            {t("journal.overview.recap_open")}<ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {recapBlocks.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {recapBlocks.map((b) => (
                <div key={b.k} className="rounded-lg border border-border/40 bg-secondary/30 p-3.5">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">{b.k}</p>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{b.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("journal.overview.recap_empty")}</p>
          )}
        </CardContent>
      </Card>

      {/* Recent trades */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <List className="h-4 w-4 text-primary" />
          <div>
            <p className="text-sm font-semibold">{t("journal.overview.trades_title")}</p>
            <p className="text-xs text-muted-foreground">{t("journal.overview.trades_subtitle")}</p>
          </div>
        </CardHeader>
        {recentTrades.length > 0 ? (
          <div>
            {recentTrades.map((tr) => (
              <div key={tr.id} className="flex items-center gap-3.5 border-t border-border/20 px-4 py-3">
                <span className="w-20 shrink-0 font-mono text-sm font-bold">{tr.pair}</span>
                {tr.dir && <Badge variant={/long/i.test(tr.dir) ? "secondary" : "destructive"}>{tr.dir.toUpperCase()}</Badge>}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px]">{tr.note}</p>
                  <p className="text-[11px] text-muted-foreground/60">{format(parseISO(tr.date), "d MMM yyyy", { locale: dateLocale })}</p>
                </div>
                <span className={`font-mono text-base ${tr.result === "win" ? "text-success" : tr.result === "loss" ? "text-destructive" : "text-muted-foreground"}`}>{fmtR(tr.r)}</span>
              </div>
            ))}
          </div>
        ) : (
          <CardContent><p className="py-6 text-center text-sm text-muted-foreground">{t("journal.overview.trades_empty")}</p></CardContent>
        )}
      </Card>
    </div>
  );
}
```

Note: confirm `Badge` variants available (`rg -n "variant" src/components/ui/badge.tsx`); if `secondary`/`destructive` aren't both present, use the closest existing variants. Confirm `CardHeader` accepts `className` (it does — `rg -n "CardHeader" src/components/ui/card.tsx`).

- [ ] **Step 4: Run the static test + typecheck**

Run:
```bash
cd artifacts/trader-dashboard
npx tsx src/components/journal/JournalOverview.static.test.ts
pnpm typecheck
```
Expected: static test PASS (3 tests); typecheck clean. Fix any type mismatches against the real `edge`/`entry` shapes.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/journal/JournalOverview.tsx artifacts/trader-dashboard/src/components/journal/JournalOverview.static.test.ts
git commit -m "feat(journal): JournalOverview panoramica wired to real edge/recap/trades"
```

---

### Task 5: Wire the Panoramica tab into the Journal page

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Journal.tsx`

**Interfaces:**
- Consumes: `JournalOverview` from `@/components/journal/JournalOverview`.

- [ ] **Step 1: Add the import and extend the Tab union**

In `pages/Journal.tsx`, add near the other imports:
```tsx
import { JournalOverview } from "@/components/journal/JournalOverview";
```
Change the `Tab` type (currently line ~44) to include `panoramica`:
```tsx
type Tab = "panoramica" | "trades" | "edge" | "idee" | "obiettivi" | "recap-settimanale" | "recap-mensile";
```

- [ ] **Step 2: Make panoramica the default and first tab**

In the `Journal` component, change the state default:
```tsx
const [tab, setTab] = useState<Tab>("panoramica");
```
Add to the front of the `tabs` array:
```tsx
{ id: "panoramica", labelKey: "journal.tab.overview", icon: TrendingUp },
```
Add `TrendingUp` to the existing `lucide-react` import (it already imports `TrendingUp`? if not, add it). Confirm with `rg -n "TrendingUp" src/pages/Journal.tsx` — it is already imported (line 4).

- [ ] **Step 3: Render the overview in the switch**

In the `AnimatePresence` block, add as the first branch:
```tsx
{tab === "panoramica" && <JournalOverview onNavigate={setTab} />}
```
(`setTab` accepts the `Tab` union, which is a superset of `JournalOverview`'s `"edge" | "recap-mensile"` param, so the prop type is compatible.)

- [ ] **Step 4: Verify nothing else asserted the old default**

Run:
```bash
cd artifacts/trader-dashboard
npx tsx src/pages/Journal.recap.static.test.ts
pnpm typecheck
```
Expected: PASS / clean. (The recap static test does not assert tabs; if any other Journal test fails on the new tab set, update it to include `panoramica`.)

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/Journal.tsx
git commit -m "feat(journal): Panoramica overview as the default Diario tab"
```

---

### Task 6: Full verification gate

**Files:** none (verification only).

- [ ] **Step 1: Run the gate**

Run from repo root:
```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
pnpm verify
```
Expected: install → codegen → typecheck → test → build all green. In particular the i18n static tests (`production-copy`, `i18n.parity`, `i18n.mojibake`) and the new unit/static tests must pass.

- [ ] **Step 2: Manual smoke (optional but recommended)**

With the dev server running, open `/journal`: Panoramica shows by default with real KPIs, an equity curve + projection, edge bars, the latest 4-week recap (or empty state), and recent trades. "Vedi dettaglio" → Edge tab; "Apri recap" → Recap mensile tab. On mobile the page title is hidden (prior change) and the tab strip scrolls.

- [ ] **Step 3: Push**

```bash
git push
```

## Self-Review

**Spec coverage:**
- §2 structure (Panoramica default + all tabs kept, `setTab` links) → Task 5. ✓
- §3.1 header/new-trade → the page's existing `PageHeader`; the overview's KPIs/sections → Task 4. (New-trade button: the page header already lacks one; if desired, the "Nuovo Trade" action lives on `TradesTab`. The overview focuses on read-only insight — opening the entry modal from the overview is out of scope here; the `journal.overview.new_trade` key is reserved for a follow-up. **Adjust:** drop the `new_trade` key to avoid an unused-key smell — see fix below.)
- §3.2 KPI tiles from edge + derived net R → Task 4. ✓
- §3.3 equity curve + Monte Carlo → Tasks 1, 2, 4. ✓
- §3.3 edge bars → Task 4. ✓
- §3.4 recap 2×2 → Task 4. ✓
- §3.5 recent trades → Task 4. ✓
- §4 isolation (JournalOverview + pure lib) → Tasks 1–4. ✓
- §5 i18n → Task 3. ✓
- §6 testing → Tasks 1,2,4 tests + Task 6 gate. ✓

**Fix from self-review:** Remove `journal.overview.new_trade` from Task 3's key list — there is no consumer in Task 4 (the overview is read-only; entry creation stays on the Trade tab), and an unused key adds noise. Keep all other keys.

**Placeholder scan:** none — all steps carry real code/commands.

**Type consistency:** `ProjectionBands` produced in Task 1, consumed in Tasks 2 & 4. `monteCarloBands(rSamples, { steps, start, ... })` signature matches between definition (Task 1) and calls (Tasks 2 test, Task 4). `JournalOverview({ onNavigate })` with param `"edge" | "recap-mensile"` matches `setTab` (superset) in Task 5. `cumulativeR`/`tradeRMultiple` names consistent across tasks.
