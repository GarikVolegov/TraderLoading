# Journal Dashboard Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an accessible, interactive trading journal widget for the dashboard.

**Architecture:** Keep summary logic in a pure helper file with focused tests, then render it through a standalone `JournalWidget` component. Register the widget in the existing dashboard widget registry so it inherits reorder, hide, and open behavior from the current dashboard shell.

**Tech Stack:** React, TypeScript, Vite, date-fns, lucide-react, TanStack Query generated hooks, node `assert` tests via `tsx`.

---

## File Structure

- Create `artifacts/trader-dashboard/src/components/JournalWidget.helpers.ts`
  - Owns date parsing, result labels, weekly stat derivation, today's count, and latest entry selection.
- Create `artifacts/trader-dashboard/src/components/JournalWidget.helpers.test.ts`
  - Verifies summary behavior with local fixtures and invalid dates.
- Create `artifacts/trader-dashboard/src/components/JournalWidget.tsx`
  - Owns UI, API query hook usage, modal state, internal action propagation handling, loading/error/empty states.
- Create `artifacts/trader-dashboard/src/components/JournalWidget.static.test.ts`
  - Verifies the widget source uses the modal and propagation guards, and dashboard registration is present.
- Modify `artifacts/trader-dashboard/src/pages/Dashboard.tsx`
  - Imports `JournalWidget`, adds the widget definition, and places `journal` in default order after `checklist`.

## Task 1: Journal Summary Helpers

**Files:**
- Create: `artifacts/trader-dashboard/src/components/JournalWidget.helpers.test.ts`
- Create: `artifacts/trader-dashboard/src/components/JournalWidget.helpers.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `artifacts/trader-dashboard/src/components/JournalWidget.helpers.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  getJournalResultMeta,
  getJournalWidgetSummary,
  safeParseJournalDate,
  type JournalWidgetEntry,
} from "./JournalWidget.helpers.js";

const entries: JournalWidgetEntry[] = [
  {
    id: 1,
    title: "London breakout",
    content: "Followed the plan",
    tradeDate: "2026-06-08",
    result: "win",
    tags: "breakout",
    images: [],
    createdAt: "2026-06-08T08:00:00.000Z",
    updatedAt: "2026-06-08T08:00:00.000Z",
  },
  {
    id: 2,
    title: "NY reversal",
    content: "Cut early",
    tradeDate: "2026-06-09",
    result: "loss",
    tags: null,
    images: [],
    createdAt: "2026-06-09T13:00:00.000Z",
    updatedAt: "2026-06-09T13:00:00.000Z",
  },
  {
    id: 3,
    title: "Friday review",
    content: "",
    tradeDate: "2026-06-12",
    result: "breakeven",
    tags: null,
    images: [],
    createdAt: "2026-06-12T16:00:00.000Z",
    updatedAt: "2026-06-12T16:00:00.000Z",
  },
  {
    id: 4,
    title: "Bad date",
    content: "Should not crash stats",
    tradeDate: "not-a-date",
    result: "win",
    tags: null,
    images: [],
    createdAt: "2026-06-13T16:00:00.000Z",
    updatedAt: "2026-06-13T16:00:00.000Z",
  },
];

assert.equal(safeParseJournalDate("2026-06-08")?.toISOString().slice(0, 10), "2026-06-08");
assert.equal(safeParseJournalDate("not-a-date"), null);

const summary = getJournalWidgetSummary(entries, new Date("2026-06-08T12:00:00.000Z"));
assert.equal(summary.todayCount, 1);
assert.equal(summary.weekly.total, 3);
assert.equal(summary.weekly.wins, 1);
assert.equal(summary.weekly.losses, 1);
assert.equal(summary.weekly.breakevens, 1);
assert.equal(summary.weekly.winRate, 33);
assert.equal(summary.latestEntry?.id, 4);

const empty = getJournalWidgetSummary([], new Date("2026-06-08T12:00:00.000Z"));
assert.equal(empty.todayCount, 0);
assert.equal(empty.weekly.total, 0);
assert.equal(empty.weekly.winRate, 0);
assert.equal(empty.latestEntry, null);

assert.deepEqual(getJournalResultMeta("win"), { label: "Win", tone: "success" });
assert.deepEqual(getJournalResultMeta("loss"), { label: "Loss", tone: "danger" });
assert.deepEqual(getJournalResultMeta("breakeven"), { label: "Break Even", tone: "warning" });
assert.deepEqual(getJournalResultMeta("none"), { label: "Non segnato", tone: "muted" });

console.log("journal widget helper checks passed");
```

- [ ] **Step 2: Run helper tests and verify they fail**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/components/JournalWidget.helpers.test.ts
```

Expected: FAIL because `JournalWidget.helpers.js` cannot be resolved.

- [ ] **Step 3: Implement helper functions**

Create `artifacts/trader-dashboard/src/components/JournalWidget.helpers.ts`:

```ts
import { endOfWeek, isSameDay, isWithinInterval, parseISO, startOfWeek } from "date-fns";

export type JournalWidgetEntry = {
  id: number;
  title: string;
  content: string;
  tradeDate: string;
  result: string;
  tags: string | null;
  images: Array<{ id: number; url: string }>;
  createdAt: string;
  updatedAt: string;
};

export type JournalResultTone = "success" | "danger" | "warning" | "muted";

export type JournalWidgetSummary = {
  todayCount: number;
  weekly: {
    total: number;
    wins: number;
    losses: number;
    breakevens: number;
    winRate: number;
  };
  latestEntry: JournalWidgetEntry | null;
};

export function safeParseJournalDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getJournalResultMeta(result: string): { label: string; tone: JournalResultTone } {
  if (result === "win") return { label: "Win", tone: "success" };
  if (result === "loss") return { label: "Loss", tone: "danger" };
  if (result === "breakeven") return { label: "Break Even", tone: "warning" };
  return { label: "Non segnato", tone: "muted" };
}

function getComparableEntryDate(entry: JournalWidgetEntry): Date | null {
  return safeParseJournalDate(entry.tradeDate) ?? safeParseJournalDate(entry.createdAt);
}

export function getJournalWidgetSummary(
  entries: JournalWidgetEntry[] | undefined,
  now: Date = new Date(),
): JournalWidgetSummary {
  const list = entries ?? [];
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const validTradeDates = list
    .map((entry) => ({ entry, date: safeParseJournalDate(entry.tradeDate) }))
    .filter((item): item is { entry: JournalWidgetEntry; date: Date } => item.date !== null);

  const todayCount = validTradeDates.filter(({ date }) => isSameDay(date, now)).length;
  const weeklyEntries = validTradeDates
    .filter(({ date }) => isWithinInterval(date, { start: weekStart, end: weekEnd }))
    .map(({ entry }) => entry);

  const wins = weeklyEntries.filter((entry) => entry.result === "win").length;
  const losses = weeklyEntries.filter((entry) => entry.result === "loss").length;
  const breakevens = weeklyEntries.filter((entry) => entry.result === "breakeven").length;
  const total = weeklyEntries.length;

  const latestEntry = [...list].sort((a, b) => {
    const aDate = getComparableEntryDate(a)?.getTime() ?? 0;
    const bDate = getComparableEntryDate(b)?.getTime() ?? 0;
    return bDate - aDate;
  })[0] ?? null;

  return {
    todayCount,
    weekly: {
      total,
      wins,
      losses,
      breakevens,
      winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
    },
    latestEntry,
  };
}
```

- [ ] **Step 4: Run helper tests and verify they pass**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/components/JournalWidget.helpers.test.ts
```

Expected: PASS with `journal widget helper checks passed`.

- [ ] **Step 5: Commit helper files**

Run:

```bash
git add artifacts/trader-dashboard/src/components/JournalWidget.helpers.ts artifacts/trader-dashboard/src/components/JournalWidget.helpers.test.ts
git commit -m "feat: add journal widget summary helpers"
```

Expected: commit includes only the two helper files.

## Task 2: Journal Widget Component

**Files:**
- Create: `artifacts/trader-dashboard/src/components/JournalWidget.tsx`
- Create: `artifacts/trader-dashboard/src/components/JournalWidget.static.test.ts`

- [ ] **Step 1: Write the failing static component test**

Create `artifacts/trader-dashboard/src/components/JournalWidget.static.test.ts`:

```ts
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
assert.match(dashboardSource, /"checklist",\s*"journal",\s*"sentiment"/s);

console.log("journal widget static checks passed");
```

- [ ] **Step 2: Run static test and verify it fails**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/components/JournalWidget.static.test.ts
```

Expected: FAIL because `JournalWidget.tsx` does not exist.

- [ ] **Step 3: Implement `JournalWidget.tsx`**

Create `artifacts/trader-dashboard/src/components/JournalWidget.tsx`:

```tsx
import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Loader2,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JournalEntryModal } from "@/components/JournalEntryModal";
import { useDateLocale } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { useGetJournalEntries } from "@workspace/api-client-react";
import {
  getJournalResultMeta,
  getJournalWidgetSummary,
  safeParseJournalDate,
  type JournalResultTone,
  type JournalWidgetEntry,
} from "./JournalWidget.helpers";

const RESULT_TONE_CLASS: Record<JournalResultTone, string> = {
  success: "border-emerald-500/35 bg-emerald-500/12 text-emerald-300",
  danger: "border-red-500/35 bg-red-500/12 text-red-300",
  warning: "border-amber-500/35 bg-amber-500/12 text-amber-300",
  muted: "border-border/45 bg-secondary/45 text-muted-foreground",
};

function stopWidgetPropagation(event: React.SyntheticEvent) {
  event.stopPropagation();
}

function Metric({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className="rounded-md border border-border/35 bg-secondary/30 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase leading-none text-muted-foreground">
        <Icon className={cn("h-3 w-3", tone)} />
        <span>{label}</span>
      </div>
      <p className={cn("mt-1.5 font-mono text-lg font-black leading-none tabular-nums", tone)}>
        {value}
      </p>
    </div>
  );
}

export function JournalWidget() {
  const [, navigate] = useLocation();
  const dateLocale = useDateLocale();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: entries, isLoading, isError } = useGetJournalEntries();

  const summary = useMemo(
    () => getJournalWidgetSummary(entries as JournalWidgetEntry[] | undefined),
    [entries],
  );

  const latest = summary.latestEntry;
  const latestDate = safeParseJournalDate(latest?.tradeDate) ?? safeParseJournalDate(latest?.createdAt);
  const latestMeta = getJournalResultMeta(latest?.result ?? "none");

  const openNewTrade = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    setIsModalOpen(true);
  };

  const openJournal = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    navigate("/journal");
  };

  return (
    <>
      <Card className="h-full overflow-hidden border-border/30 bg-card/60 backdrop-blur-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h3 className="truncate text-base font-black leading-tight">Diario Trading</h3>
              </div>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Riepilogo rapido e inserimento trade
              </p>
            </div>
            <div className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 text-center">
              <p className="font-mono text-lg font-black leading-none text-primary">{summary.todayCount}</p>
              <p className="mt-0.5 text-[0.55rem] font-bold uppercase leading-none text-primary/75">oggi</p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex min-h-[9rem] items-center justify-center rounded-md border border-border/35 bg-secondary/25">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-label="Caricamento diario" />
            </div>
          ) : isError ? (
            <div className="rounded-md border border-border/40 bg-secondary/25 p-4">
              <p className="text-sm font-bold text-foreground">Diario non disponibile</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                Apri la pagina completa per riprovare.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3 h-9 px-2 text-primary"
                onClick={openJournal}
                onPointerDown={(event) => event.stopPropagation()}
                aria-label="Apri pagina diario"
              >
                Apri diario
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          ) : !latest ? (
            <div className="rounded-md border border-dashed border-border/45 bg-secondary/20 p-4 text-center">
              <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/35" />
              <p className="mt-2 text-sm font-bold">Nessun trade registrato</p>
              <p className="mx-auto mt-1 max-w-[14rem] text-xs leading-snug text-muted-foreground">
                Crea il primo trade per iniziare a vedere statistiche e recap.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Win" value={summary.weekly.wins} icon={TrendingUp} tone="text-emerald-300" />
                <Metric label="Loss" value={summary.weekly.losses} icon={TrendingDown} tone="text-red-300" />
                <Metric label="Rate" value={`${summary.weekly.winRate}%`} icon={BarChart3} tone="text-primary" />
              </div>

              <div className="rounded-md border border-border/35 bg-secondary/25 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[0.62rem] font-bold uppercase text-muted-foreground">Ultimo trade</p>
                    <p className="mt-1 truncate text-sm font-black leading-tight">{latest.title}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-md border px-2 py-1 text-[0.62rem] font-bold leading-none",
                      RESULT_TONE_CLASS[latestMeta.tone],
                    )}
                  >
                    {latestMeta.label}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>
                    {latestDate ? format(latestDate, "d MMM yyyy", { locale: dateLocale }) : "Data recente"}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-snug text-muted-foreground/85">
                  {latest.content || "Nessuna nota per questo trade."}
                </p>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-2 border-t border-border/35 pt-3">
            <Button
              type="button"
              className="h-10"
              onClick={openNewTrade}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Crea nuovo trade dal widget diario"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nuovo trade
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={openJournal}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="Apri pagina diario"
            >
              Apri
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div onClick={stopWidgetPropagation} onPointerDown={(event) => event.stopPropagation()}>
        <JournalEntryModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          entry={null}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Run static test and verify component-related checks still fail on dashboard registration**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/components/JournalWidget.static.test.ts
```

Expected: FAIL because `Dashboard.tsx` has not registered `JournalWidget` yet.

- [ ] **Step 5: Commit widget component files**

Run:

```bash
git add artifacts/trader-dashboard/src/components/JournalWidget.tsx artifacts/trader-dashboard/src/components/JournalWidget.static.test.ts
git commit -m "feat: add journal dashboard widget"
```

Expected: commit includes only the widget component and static test.

## Task 3: Dashboard Registration

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx`

- [ ] **Step 1: Register the widget import**

Modify imports in `artifacts/trader-dashboard/src/pages/Dashboard.tsx`:

```ts
import { JournalWidget } from "@/components/JournalWidget";
```

- [ ] **Step 2: Add the widget definition**

Add this item to `WIDGET_DEFS` after the checklist item:

```ts
{ id: "journal",    label: "Diario Trading",       icon: BookOpen,       route: "/journal",                 component: JournalWidget },
```

- [ ] **Step 3: Add default order placement**

Add `"journal"` after `"checklist"` in `DEFAULT_ORDER`:

```ts
const DEFAULT_ORDER = [
  "clock",
  "quote",
  "account",
  "missions",
  "routine",
  "checklist",
  "journal",
  "sentiment",
  "volatility",
  "cot",
  "calendar",
];
```

- [ ] **Step 4: Run helper and static tests**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/components/JournalWidget.helpers.test.ts
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/components/JournalWidget.static.test.ts
```

Expected: both commands PASS.

- [ ] **Step 5: Commit dashboard registration**

Run:

```bash
git add artifacts/trader-dashboard/src/pages/Dashboard.tsx
git commit -m "feat: register journal dashboard widget"
```

Expected: commit includes only the dashboard registration changes.

## Task 4: Verification

**Files:**
- Verify: `artifacts/trader-dashboard/src/components/JournalWidget.tsx`
- Verify: `artifacts/trader-dashboard/src/components/JournalWidget.helpers.ts`
- Verify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx`

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/components/JournalWidget.helpers.test.ts
pnpm --filter @workspace/trader-dashboard exec node --import tsx src/components/JournalWidget.static.test.ts
```

Expected: both commands PASS.

- [ ] **Step 2: Run dashboard typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run dashboard build**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run build
```

Expected: PASS and Vite emits the production build.

- [ ] **Step 4: Run root verification when typecheck/build pass**

Run:

```bash
pnpm run verify
```

Expected: PASS. If unrelated pre-existing worktree changes fail verification, record the exact failing command and error while keeping the journal widget focused checks as evidence.

- [ ] **Step 5: Final manual checks**

Start the local runtime:

```bash
pnpm run start:local
```

Expected: the app starts and exposes the dashboard URL in local logs or terminal output.

Manual checks:

- dashboard displays "Diario Trading";
- "Nuovo trade" opens `JournalEntryModal`;
- saving a trade closes the modal and refreshes widget data;
- "Apri" navigates to `/journal`;
- clicking the widget shell navigates to `/journal`;
- clicking internal buttons does not trigger widget shell navigation first;
- Layout mode still allows hiding and reordering the journal widget.

## Self-Review

Spec coverage:

- Dashboard widget: Task 3 registers it in the dashboard registry.
- Interactive create action: Task 2 opens `JournalEntryModal`.
- Summary data: Task 1 derives today, weekly, and latest-entry data.
- Accessibility: Task 2 uses buttons, labels, textual statuses, and propagation guards.
- Error/loading/empty states: Task 2 implements all three states.
- Verification: Task 4 covers focused tests, typecheck, build, root verify, and manual checks.

Placeholder scan:

- The plan contains no deferred implementation markers.

Type consistency:

- `JournalWidgetEntry`, `JournalWidgetSummary`, and `JournalResultTone` are defined in Task 1 and imported consistently in Task 2.
