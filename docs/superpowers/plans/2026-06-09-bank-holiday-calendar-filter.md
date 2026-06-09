# Bank Holiday Calendar Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make bank holidays selectable in the economic calendar impact filter and render them with a white impact color.

**Architecture:** The backend and generated API types already support `impact: "Holiday"`. The implementation changes only the calendar widget filter configuration and adds a static regression test that verifies `Holiday` remains visible in the filter.

**Tech Stack:** React, TypeScript, Vite workspace, Node static tests using `assert`.

---

### Task 1: Calendar Widget Holiday Filter

**Files:**
- Create: `artifacts/trader-dashboard/src/components/CalendarWidget.bank-holiday-filter.static.test.ts`
- Modify: `artifacts/trader-dashboard/src/components/CalendarWidget.tsx`

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/components/CalendarWidget.bank-holiday-filter.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(__dirname, "CalendarWidget.tsx"), "utf8");

assert.match(source, /Holiday:\s*\{[^}]*color:\s*"bg-white"/s);
assert.match(source, /Holiday:\s*\{[^}]*border:\s*"border-white\/40"/s);
assert.match(source, /Holiday:\s*\{[^}]*text:\s*"text-white"/s);
assert.match(source, /Holiday:\s*\{[^}]*label:\s*"Festivo"/s);
assert.doesNotMatch(source, /filter\([^)]*Holiday/);

console.log("calendar widget bank holiday filter static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter trader-dashboard exec tsx src/components/CalendarWidget.bank-holiday-filter.static.test.ts`

Expected: FAIL because `Holiday` still uses blue classes and the filter excludes `Holiday`.

- [ ] **Step 3: Write minimal implementation**

In `artifacts/trader-dashboard/src/components/CalendarWidget.tsx`, change the `Holiday` config to:

```ts
Holiday: { color: "bg-white", border: "border-white/40", text: "text-white", label: "Festivo" },
```

Then change the filter rendering from:

```tsx
{(Object.keys(IMPACT_CONFIG) as Impact[]).filter(i => i !== "Holiday").map((impact) => {
```

to:

```tsx
{(Object.keys(IMPACT_CONFIG) as Impact[]).map((impact) => {
```

- [ ] **Step 4: Run targeted test to verify it passes**

Run: `pnpm --filter trader-dashboard exec tsx src/components/CalendarWidget.bank-holiday-filter.static.test.ts`

Expected: PASS with `calendar widget bank holiday filter static checks passed`.

- [ ] **Step 5: Run related calendar tests**

Run: `pnpm --filter trader-dashboard exec tsx src/lib/calendarApi.test.ts`

Expected: PASS with `calendar api checks passed`.

- [ ] **Step 6: Commit implementation**

```bash
git add docs/superpowers/specs/2026-06-09-bank-holiday-calendar-filter-design.md docs/superpowers/plans/2026-06-09-bank-holiday-calendar-filter.md artifacts/trader-dashboard/src/components/CalendarWidget.tsx artifacts/trader-dashboard/src/components/CalendarWidget.bank-holiday-filter.static.test.ts
git commit -m "feat(calendar): show bank holidays in impact filter"
```

## Self-Review

- Spec coverage: Task 1 covers the visible filter option, white impact classes, saved preference reuse, and unchanged backend/API scope.
- Placeholder scan: no placeholders remain.
- Type consistency: the test checks the existing `Holiday` impact key and does not introduce new API types.
