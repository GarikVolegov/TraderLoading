# Guided Journal Recaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build guided weekly and four-week journal recap forms that are editable only during their allowed weekend windows and readable afterward.

**Architecture:** Add a dedicated `journal_recaps` database table and journal recap API endpoints. Keep period calculation in focused frontend and backend helpers, then render a guided review panel inside the existing journal recap tabs while leaving trade statistics intact.

**Tech Stack:** TypeScript, React, Express, Drizzle ORM, Zod, date-fns, pnpm/tsx tests.

---

## File Structure

- Create `artifacts/trader-dashboard/src/lib/journalRecapPeriods.ts`: frontend date window helpers.
- Create `artifacts/trader-dashboard/src/lib/journalRecapPeriods.test.ts`: focused frontend period tests.
- Create `artifacts/trader-dashboard/src/lib/journalRecapsApi.ts`: frontend API wrapper for recap GET/PUT.
- Create `artifacts/trader-dashboard/src/pages/Journal.recap.static.test.ts`: static UI regression test for labels and fields.
- Modify `artifacts/trader-dashboard/src/pages/Journal.tsx`: add guided recap panel to `RecapTab`.
- Modify `artifacts/trader-dashboard/src/lib/i18n.ts`: update Italian tab copy and add recap strings.
- Modify `lib/db/src/schema/journal.ts`: add `journalRecapsTable`.
- Create `artifacts/api-server/src/services/journalRecapPeriods.ts`: server-side period validation and edit-window helpers.
- Create `artifacts/api-server/src/services/journalRecapPeriods.test.ts`: server helper tests.
- Modify `artifacts/api-server/src/routes/journal.ts`: add recap GET/PUT routes before `/journal/:id`.
- Modify `artifacts/api-server/src/routes/journal.test.ts`: assert `/journal/recaps` is registered before dynamic journal routes.

## Task 1: Frontend Period Helpers

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/journalRecapPeriods.test.ts`
- Create: `artifacts/trader-dashboard/src/lib/journalRecapPeriods.ts`

- [ ] **Step 1: Write the failing helper test**

```ts
import assert from "node:assert/strict";
import {
  FOUR_WEEK_ANCHOR_ISO,
  getJournalRecapPeriod,
  isJournalRecapEditable,
  getNextJournalRecapWindow,
} from "./journalRecapPeriods.js";

assert.equal(FOUR_WEEK_ANCHOR_ISO, "2026-06-08");

const weekly = getJournalRecapPeriod("weekly", new Date("2026-06-13T12:00:00+02:00"));
assert.equal(weekly.periodStart, "2026-06-08");
assert.equal(weekly.periodEnd, "2026-06-14");
assert.equal(weekly.editWindowStart, "2026-06-13");
assert.equal(weekly.editWindowEnd, "2026-06-14");
assert.equal(isJournalRecapEditable(weekly, new Date("2026-06-13T10:00:00+02:00")), true);
assert.equal(isJournalRecapEditable(weekly, new Date("2026-06-12T10:00:00+02:00")), false);

const fourWeek = getJournalRecapPeriod("four_week", new Date("2026-07-04T12:00:00+02:00"));
assert.equal(fourWeek.periodStart, "2026-06-08");
assert.equal(fourWeek.periodEnd, "2026-07-05");
assert.equal(fourWeek.editWindowStart, "2026-07-04");
assert.equal(fourWeek.editWindowEnd, "2026-07-05");
assert.equal(isJournalRecapEditable(fourWeek, new Date("2026-07-05T09:00:00+02:00")), true);
assert.equal(isJournalRecapEditable(fourWeek, new Date("2026-07-03T09:00:00+02:00")), false);

const nextFourWeek = getNextJournalRecapWindow("four_week", new Date("2026-06-20T12:00:00+02:00"));
assert.equal(nextFourWeek.editWindowStart, "2026-07-04");
assert.equal(nextFourWeek.editWindowEnd, "2026-07-05");

console.log("journal recap frontend period checks passed");
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/lib/journalRecapPeriods.test.ts`

Expected: FAIL because `src/lib/journalRecapPeriods.ts` does not exist.

- [ ] **Step 3: Implement the minimal helper**

```ts
import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfWeek,
} from "date-fns";

export type JournalRecapKind = "weekly" | "four_week";

export interface JournalRecapPeriod {
  kind: JournalRecapKind;
  periodStart: string;
  periodEnd: string;
  editWindowStart: string;
  editWindowEnd: string;
}

export const FOUR_WEEK_ANCHOR_ISO = "2026-06-08";

function iso(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function localDay(date: Date): Date {
  return startOfDay(date);
}

export function getJournalRecapPeriod(kind: JournalRecapKind, baseDate = new Date()): JournalRecapPeriod {
  const base = localDay(baseDate);
  if (kind === "weekly") {
    const start = startOfWeek(base, { weekStartsOn: 1 });
    const end = endOfWeek(base, { weekStartsOn: 1 });
    return {
      kind,
      periodStart: iso(start),
      periodEnd: iso(end),
      editWindowStart: iso(addDays(end, -1)),
      editWindowEnd: iso(end),
    };
  }

  const anchor = parseISO(FOUR_WEEK_ANCHOR_ISO);
  const elapsedDays = Math.max(0, differenceInCalendarDays(base, anchor));
  const cycleIndex = Math.floor(elapsedDays / 28);
  const start = addDays(anchor, cycleIndex * 28);
  const end = addDays(start, 27);
  return {
    kind,
    periodStart: iso(start),
    periodEnd: iso(end),
    editWindowStart: iso(addDays(end, -1)),
    editWindowEnd: iso(end),
  };
}

export function isJournalRecapEditable(period: JournalRecapPeriod, now = new Date()): boolean {
  const day = localDay(now);
  return isWithinInterval(day, {
    start: parseISO(period.editWindowStart),
    end: parseISO(period.editWindowEnd),
  });
}

export function getNextJournalRecapWindow(kind: JournalRecapKind, now = new Date()): Pick<JournalRecapPeriod, "editWindowStart" | "editWindowEnd"> {
  const current = getJournalRecapPeriod(kind, now);
  if (localDay(now).getTime() <= parseISO(current.editWindowEnd).getTime()) {
    return { editWindowStart: current.editWindowStart, editWindowEnd: current.editWindowEnd };
  }
  const nextBase = kind === "weekly" ? addDays(parseISO(current.periodEnd), 1) : addDays(parseISO(current.periodEnd), 1);
  const next = getJournalRecapPeriod(kind, nextBase);
  return { editWindowStart: next.editWindowStart, editWindowEnd: next.editWindowEnd };
}
```

- [ ] **Step 4: Run the test and verify GREEN**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/lib/journalRecapPeriods.test.ts`

Expected: PASS and print `journal recap frontend period checks passed`.

## Task 2: Server Period Helpers And Schema

**Files:**
- Create: `artifacts/api-server/src/services/journalRecapPeriods.test.ts`
- Create: `artifacts/api-server/src/services/journalRecapPeriods.ts`
- Modify: `lib/db/src/schema/journal.ts`

- [ ] **Step 1: Write the failing server helper test**

```ts
import assert from "node:assert/strict";
import {
  getJournalRecapPeriodForDate,
  isJournalRecapPeriodEditable,
  validateJournalRecapPeriod,
} from "./journalRecapPeriods.js";

const weekly = getJournalRecapPeriodForDate("weekly", new Date("2026-06-14T08:00:00Z"));
assert.equal(weekly.periodStart, "2026-06-08");
assert.equal(weekly.periodEnd, "2026-06-14");
assert.equal(isJournalRecapPeriodEditable(weekly, new Date("2026-06-14T08:00:00Z")), true);
assert.equal(isJournalRecapPeriodEditable(weekly, new Date("2026-06-15T08:00:00Z")), false);

const fourWeek = getJournalRecapPeriodForDate("four_week", new Date("2026-07-05T08:00:00Z"));
assert.equal(fourWeek.periodStart, "2026-06-08");
assert.equal(fourWeek.periodEnd, "2026-07-05");
assert.equal(isJournalRecapPeriodEditable(fourWeek, new Date("2026-07-04T08:00:00Z")), true);
assert.equal(isJournalRecapPeriodEditable(fourWeek, new Date("2026-07-06T08:00:00Z")), false);

assert.equal(validateJournalRecapPeriod("four_week", "2026-06-08", "2026-07-05"), true);
assert.equal(validateJournalRecapPeriod("four_week", "2026-06-09", "2026-07-05"), false);

console.log("journal recap server period checks passed");
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm --filter @workspace/api-server exec tsx src/services/journalRecapPeriods.test.ts`

Expected: FAIL because `src/services/journalRecapPeriods.ts` does not exist.

- [ ] **Step 3: Implement server helper**

Use the same date logic as the frontend helper in `artifacts/api-server/src/services/journalRecapPeriods.ts`, exporting `JournalRecapKind`, `JournalRecapPeriod`, `FOUR_WEEK_ANCHOR_ISO`, `getJournalRecapPeriodForDate`, `isJournalRecapPeriodEditable`, and `validateJournalRecapPeriod`.

- [ ] **Step 4: Run the helper test and verify GREEN**

Run: `pnpm --filter @workspace/api-server exec tsx src/services/journalRecapPeriods.test.ts`

Expected: PASS and print `journal recap server period checks passed`.

- [ ] **Step 5: Add database schema**

In `lib/db/src/schema/journal.ts`, import `uniqueIndex` and add:

```ts
export const journalRecapsTable = pgTable("journal_recaps", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  overallJudgment: text("overall_judgment").notNull().default(""),
  wentWell: text("went_well").notNull().default(""),
  wentWrong: text("went_wrong").notNull().default(""),
  improvements: text("improvements").notNull().default(""),
  patterns: text("patterns").notNull().default(""),
  focusAreas: text("focus_areas").notNull().default(""),
  nextPeriodExpectations: text("next_period_expectations").notNull().default(""),
  nextPeriodGoals: text("next_period_goals").notNull().default(""),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("journal_recaps_user_kind_period_idx").on(table.userId, table.kind, table.periodStart, table.periodEnd),
]);

export type JournalRecap = typeof journalRecapsTable.$inferSelect;
```

## Task 3: API Routes

**Files:**
- Modify: `artifacts/api-server/src/routes/journal.test.ts`
- Modify: `artifacts/api-server/src/routes/journal.ts`

- [ ] **Step 1: Extend the route order test**

Add these assertions to `artifacts/api-server/src/routes/journal.test.ts`:

```ts
const recapsIndex = stack.indexOf("/journal/recaps");
assert.ok(recapsIndex >= 0, "journal recaps route should be registered");
assert.ok(recapsIndex < dynamicEntryIndex, "journal recaps route must be registered before /journal/:id");
```

- [ ] **Step 2: Run the route test and verify RED**

Run: `pnpm --filter @workspace/api-server exec tsx src/routes/journal.test.ts`

Expected: FAIL because `/journal/recaps` is not registered.

- [ ] **Step 3: Implement GET and PUT routes before `/journal/:id`**

In `artifacts/api-server/src/routes/journal.ts`:

```ts
import { journalEntriesTable, journalImagesTable, journalRecapsTable, missionsTable, profileTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  getJournalRecapPeriodForDate,
  isJournalRecapPeriodEditable,
  validateJournalRecapPeriod,
  type JournalRecapKind,
} from "../services/journalRecapPeriods.js";
```

Add schemas and helpers:

```ts
const recapKinds = ["weekly", "four_week"] as const;
const JournalRecapQuery = z.object({
  kind: z.enum(recapKinds),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const JournalRecapBody = JournalRecapQuery.extend({
  overallJudgment: z.string().max(4000).default(""),
  wentWell: z.string().max(4000).default(""),
  wentWrong: z.string().max(4000).default(""),
  improvements: z.string().max(4000).default(""),
  patterns: z.string().max(4000).default(""),
  focusAreas: z.string().max(4000).default(""),
  nextPeriodExpectations: z.string().max(4000).default(""),
  nextPeriodGoals: z.string().max(4000).default(""),
});

function recapUserFilter(userId: string | null) {
  return userId ? eq(journalRecapsTable.userId, userId) : isNull(journalRecapsTable.userId);
}
```

Add the routes before `router.get("/journal/:id", ...)`:

```ts
router.get("/journal/recaps", async (req, res) => {
  const userId = getUserId(req);
  const query = JournalRecapQuery.parse(req.query);
  const [recap] = await db
    .select()
    .from(journalRecapsTable)
    .where(and(
      eq(journalRecapsTable.kind, query.kind),
      eq(journalRecapsTable.periodStart, query.periodStart),
      eq(journalRecapsTable.periodEnd, query.periodEnd),
      recapUserFilter(userId),
    ));
  res.json(recap ?? null);
});

router.put("/journal/recaps", async (req, res) => {
  const userId = getUserId(req);
  const body = JournalRecapBody.parse(req.body);
  if (!validateJournalRecapPeriod(body.kind as JournalRecapKind, body.periodStart, body.periodEnd)) {
    res.status(400).json({ error: "Invalid recap period" });
    return;
  }
  const period = getJournalRecapPeriodForDate(body.kind as JournalRecapKind, new Date(body.periodEnd));
  if (!isJournalRecapPeriodEditable(period, new Date())) {
    res.status(403).json({ error: "Recap editing window is closed" });
    return;
  }
  const values = {
    kind: body.kind,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    overallJudgment: body.overallJudgment.trim(),
    wentWell: body.wentWell.trim(),
    wentWrong: body.wentWrong.trim(),
    improvements: body.improvements.trim(),
    patterns: body.patterns.trim(),
    focusAreas: body.focusAreas.trim(),
    nextPeriodExpectations: body.nextPeriodExpectations.trim(),
    nextPeriodGoals: body.nextPeriodGoals.trim(),
    userId,
    updatedAt: new Date(),
  };
  const [existing] = await db
    .select({ id: journalRecapsTable.id })
    .from(journalRecapsTable)
    .where(and(
      eq(journalRecapsTable.kind, body.kind),
      eq(journalRecapsTable.periodStart, body.periodStart),
      eq(journalRecapsTable.periodEnd, body.periodEnd),
      recapUserFilter(userId),
    ));
  const [saved] = existing
    ? await db.update(journalRecapsTable).set(values).where(eq(journalRecapsTable.id, existing.id)).returning()
    : await db.insert(journalRecapsTable).values(values).returning();
  res.json(saved);
});
```

- [ ] **Step 4: Run route and helper tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/routes/journal.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/journalRecapPeriods.test.ts
```

Expected: both PASS.

## Task 4: Frontend API Wrapper

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/journalRecapsApi.ts`

- [ ] **Step 1: Add API wrapper**

```ts
import { apiJSON, type RelativeApiOptions } from "./apiFetch";
import type { JournalRecapKind, JournalRecapPeriod } from "./journalRecapPeriods";

export interface JournalRecapPayload {
  kind: JournalRecapKind;
  periodStart: string;
  periodEnd: string;
  overallJudgment: string;
  wentWell: string;
  wentWrong: string;
  improvements: string;
  patterns: string;
  focusAreas: string;
  nextPeriodExpectations: string;
  nextPeriodGoals: string;
}

export interface JournalRecap extends JournalRecapPayload {
  id: number;
  createdAt?: string;
  updatedAt?: string;
}

export const emptyJournalRecapFields = {
  overallJudgment: "",
  wentWell: "",
  wentWrong: "",
  improvements: "",
  patterns: "",
  focusAreas: "",
  nextPeriodExpectations: "",
  nextPeriodGoals: "",
};

export const journalRecapQueryKey = (period: JournalRecapPeriod) => [
  "/api/journal/recaps",
  period.kind,
  period.periodStart,
  period.periodEnd,
] as const;

export function fetchJournalRecap(period: JournalRecapPeriod, options?: RelativeApiOptions): Promise<JournalRecap | null> {
  const params = new URLSearchParams({
    kind: period.kind,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  });
  return apiJSON<JournalRecap | null>(`journal/recaps?${params.toString()}`, undefined, options);
}

export function saveJournalRecap(payload: JournalRecapPayload, options?: RelativeApiOptions): Promise<JournalRecap> {
  return apiJSON<JournalRecap>("journal/recaps", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, options);
}
```

## Task 5: Guided Recap UI

**Files:**
- Create: `artifacts/trader-dashboard/src/pages/Journal.recap.static.test.ts`
- Modify: `artifacts/trader-dashboard/src/pages/Journal.tsx`
- Modify: `artifacts/trader-dashboard/src/lib/i18n.ts`

- [ ] **Step 1: Write failing static UI test**

```ts
import fs from "node:fs";
import assert from "node:assert/strict";

const journal = fs.readFileSync("src/pages/Journal.tsx", "utf8");
const i18n = fs.readFileSync("src/lib/i18n.ts", "utf8");

for (const token of [
  "overallJudgment",
  "wentWell",
  "wentWrong",
  "improvements",
  "patterns",
  "focusAreas",
  "nextPeriodExpectations",
  "nextPeriodGoals",
  "fetchJournalRecap",
  "saveJournalRecap",
]) {
  assert.match(journal, new RegExp(token));
}

assert.match(i18n, /Recap 4 settimane/);
assert.match(i18n, /Giudizio generale/);
assert.match(i18n, /Pattern individuati/);

console.log("journal recap UI static checks passed");
```

- [ ] **Step 2: Run static test and verify RED**

Run: `pnpm --filter @workspace/trader-dashboard exec tsx src/pages/Journal.recap.static.test.ts`

Expected: FAIL because the guided recap UI is not implemented.

- [ ] **Step 3: Update imports and tab labels**

In `Journal.tsx`, add `useEffect` to React imports, import `Textarea`, query hooks, API wrapper functions, and period helpers.

Change `RecapTab` mode from `"week" | "month"` to `"weekly" | "four_week"`. Change the tab label for the former monthly tab to `journal.tab.four_week` and render `<RecapTab mode="four_week" />`.

- [ ] **Step 4: Add recap loading and save state inside `RecapTab`**

Inside `RecapTab`, derive:

```ts
const recapPeriod = useMemo(() => getJournalRecapPeriod(mode, periodInfo.start), [mode, periodInfo.start]);
const recapEditable = isJournalRecapEditable(recapPeriod);
const recapQuery = useQuery({
  queryKey: journalRecapQueryKey(recapPeriod),
  queryFn: () => fetchJournalRecap(recapPeriod),
});
const [recapDraft, setRecapDraft] = useState(emptyJournalRecapFields);
```

Use `useEffect` to load `recapDraft` from `recapQuery.data` or reset to empty fields.

Create a mutation with `saveJournalRecap`, invalidate `journalRecapQueryKey(recapPeriod)`, and show success/error toasts.

- [ ] **Step 5: Render the guided panel below stats**

Add a card-like panel with eight `Textarea` fields using these labels:

- `journal.recap.overall_judgment`
- `journal.recap.went_well`
- `journal.recap.went_wrong`
- `journal.recap.improvements`
- `journal.recap.patterns`
- `journal.recap.focus_areas`
- `journal.recap.next_expectations`
- `journal.recap.next_goals`

If `recapEditable` is false, disable the fields and hide the save button. If no recap exists, show `journal.recap.locked`.

- [ ] **Step 6: Add i18n strings**

Add Italian strings:

```ts
"journal.tab.four_week": "Recap 4 settimane",
"journal.recap.title": "Review guidata",
"journal.recap.locked": "Questo recap si puo' compilare solo nel weekend previsto.",
"journal.recap.saved": "Recap salvato.",
"journal.recap.save": "Salva recap",
"journal.recap.overall_judgment": "Giudizio generale",
"journal.recap.went_well": "Cosa e' andato bene",
"journal.recap.went_wrong": "Criticita'",
"journal.recap.improvements": "Aspetti su cui migliorare",
"journal.recap.patterns": "Pattern individuati",
"journal.recap.focus_areas": "1/2 aree su cui lavorare",
"journal.recap.next_expectations": "Cosa aspettarsi dal prossimo periodo",
"journal.recap.next_goals": "Obiettivi per il prossimo periodo",
```

Add equivalent English keys so the app does not show raw keys when language is English.

- [ ] **Step 7: Run frontend tests**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/journalRecapPeriods.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/pages/Journal.recap.static.test.ts
```

Expected: both PASS.

## Task 6: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused verification**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/journalRecapPeriods.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/journal.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/journalRecapPeriods.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/pages/Journal.recap.static.test.ts
pnpm --filter @workspace/trader-dashboard typecheck
pnpm --filter @workspace/api-server typecheck
```

Expected: focused tests pass and both package typechecks complete without TypeScript errors.

- [ ] **Step 2: Database note**

After deployment, run `pnpm db:push` against the target database so Drizzle creates `journal_recaps`.

## Self-Review

- Spec coverage: the plan covers dedicated persistence, weekly weekend windows, four-week cycles from June 8, 2026, server-side edit enforcement, readable locked recaps, UI copy, and tests.
- Placeholder scan: no TBD/TODO/implement-later markers are present.
- Type consistency: `weekly` and `four_week` are used consistently as recap kinds; field names match across schema, API payload, frontend API wrapper, and UI draft state.
