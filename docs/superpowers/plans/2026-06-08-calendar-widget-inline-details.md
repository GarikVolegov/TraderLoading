# Calendar Widget Inline Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard economic calendar widget expand event details in place instead of navigating to the dedicated calendar page on normal event-row clicks.

**Architecture:** Keep `CalendarWidget` as the owner of event expansion state and data rendering. Update the dashboard widget wrapper so the calendar widget body is treated as internally interactive, while a dedicated open-page button remains responsible for `/calendar` navigation.

**Tech Stack:** React, TypeScript, Wouter, framer-motion, lucide-react, Node static tests with `node:assert`.

---

## File Structure

- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx`
  - Add a widget definition flag for widgets whose body handles its own clicks.
  - Keep page navigation available through an explicit open-page button.
- Create: `artifacts/trader-dashboard/src/pages/Dashboard.calendar-widget-interaction.static.test.ts`
  - Static regression test for the calendar widget interaction contract.

---

### Task 1: RED Test For Calendar Widget Interaction Contract

**Files:**
- Create: `artifacts/trader-dashboard/src/pages/Dashboard.calendar-widget-interaction.static.test.ts`

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/pages/Dashboard.calendar-widget-interaction.static.test.ts` with:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");

assert.match(
  source,
  /\{\s*id:\s*"calendar",[\s\S]*?bodyHandlesOwnClicks:\s*true[\s\S]*?\}/,
  "calendar widget must opt out of body-level dashboard navigation",
);

assert.match(
  source,
  /const isBodyOpenable = isOpenable && !def\.bodyHandlesOwnClicks;/,
  "dashboard body navigation must be disabled for widgets that own their internal clicks",
);

assert.match(
  source,
  /onClick=\{\(event\) => \{\s*event\.stopPropagation\(\);\s*onOpen\(def\.id\);\s*\}\}/s,
  "open-page affordance must explicitly navigate without relying on the whole widget body",
);

assert.match(
  source,
  /aria-label=\{`Apri pagina \$\{def\.label\}`\}/,
  "open-page affordance must expose an accessible label",
);

console.log("dashboard calendar widget interaction checks passed");
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node artifacts/trader-dashboard/src/pages/Dashboard.calendar-widget-interaction.static.test.ts
```

Expected: FAIL with an assertion message about `bodyHandlesOwnClicks`, because `Dashboard.tsx` does not yet contain that flag or the explicit open-page click handler.

---

### Task 2: GREEN Implementation In Dashboard Wrapper

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx`
- Test: `artifacts/trader-dashboard/src/pages/Dashboard.calendar-widget-interaction.static.test.ts`

- [ ] **Step 1: Add the widget definition flag**

In `WidgetDef`, add:

```ts
  bodyHandlesOwnClicks?: boolean;
```

Update the calendar widget definition to:

```ts
  { id: "calendar",   label: "Calendario Avanzato",  icon: CalendarDays,   route: "/calendar",               component: CalendarWidget, bodyHandlesOwnClicks: true },
```

- [ ] **Step 2: Split body navigation from explicit open-page navigation**

Inside `SortableWidget`, replace:

```ts
  const isOpenable = !isEditing && !isHidden && !isDragActive && !!def.route;
```

with:

```ts
  const isOpenable = !isEditing && !isHidden && !isDragActive && !!def.route;
  const isBodyOpenable = isOpenable && !def.bodyHandlesOwnClicks;
```

Replace `if (!isOpenable) return;` in `handleOpen` with:

```ts
    if (!isBodyOpenable) return;
```

Use `isBodyOpenable` for the body shell `cursor-pointer`, `role`, `tabIndex`, `aria-label`, and `onKeyDown` guard.

- [ ] **Step 3: Make the open-page affordance clickable**

Replace the existing affordance `<div>` with:

```tsx
            <button
              type="button"
              style={{ height: "2.25rem", width: "2.25rem" }}
              className="absolute bottom-2.5 right-2.5 z-[5] flex items-center justify-center rounded-full border border-primary/30 bg-card/85 text-primary opacity-0 shadow-lg backdrop-blur-sm transition-opacity duration-200 hover:bg-primary/10 group-hover:opacity-100"
              aria-label={`Apri pagina ${def.label}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpen(def.id);
              }}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
```

- [ ] **Step 4: Run the targeted test and verify it passes**

Run:

```bash
node artifacts/trader-dashboard/src/pages/Dashboard.calendar-widget-interaction.static.test.ts
```

Expected: PASS with `dashboard calendar widget interaction checks passed`.

---

### Task 3: Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run existing dashboard static tests**

Run:

```bash
node artifacts/trader-dashboard/src/pages/Dashboard.order.test.ts
node artifacts/trader-dashboard/src/pages/Dashboard.layout-settings.test.ts
node artifacts/trader-dashboard/src/pages/Dashboard.calendar-widget-interaction.static.test.ts
```

Expected: all three print their success messages and exit 0.

- [ ] **Step 2: Run frontend typecheck**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
```

Expected: exit 0. If unrelated pre-existing errors appear, record the exact files and messages before finishing.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add -- artifacts/trader-dashboard/src/pages/Dashboard.tsx artifacts/trader-dashboard/src/pages/Dashboard.calendar-widget-interaction.static.test.ts docs/superpowers/plans/2026-06-08-calendar-widget-inline-details.md
git commit -m "fix(calendar): keep widget event details inline"
```

Expected: commit includes only the dashboard wrapper change, the new static test, and this plan.

---

## Self-Review

- Spec coverage: Task 2 disables body-level navigation for the calendar widget while keeping the explicit open-page affordance; `CalendarWidget` keeps its existing inline `forecast` and `previous` expansion behavior.
- Placeholder scan: no placeholder, TBD, or deferred implementation steps remain.
- Type consistency: `bodyHandlesOwnClicks` is defined on `WidgetDef` and read only from `def.bodyHandlesOwnClicks` inside `SortableWidget`.
