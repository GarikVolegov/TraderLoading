# Dashboard Gap-Free Masonry Disposition — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's uniform CSS grid (which leaves empty gaps under shorter widgets) with the Claude Design kit's gap-free round-robin flex-column masonry, and pin `ClockWidget` as a full-width banner.

**Architecture:** Extract two pure, unit-tested helpers (`columnsForWidth`, `distributeColumns`) into `Dashboard.layout.ts`. In `Dashboard.tsx`: drop clock from the widget registry and render it once as a pinned banner; keep the existing `SortableWidget` cell + dnd-kit wiring untouched and only swap the **container** — uniform grid in edit mode (unchanged), round-robin flex-column masonry in normal mode.

**Tech Stack:** React 19, TypeScript (strict), Tailwind 4, framer-motion, @dnd-kit, Vitest, `pnpm --filter trader-dashboard`.

## Global Constraints

- **pnpm only.** Toolchain may need PATH export: `export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"`.
- **No raw HSL literals** in new code; colors via tokens. **No `@typescript-eslint/no-explicit-any`** in non-test source (strict).
- **Commit only this change's files** — never `git add -A`. The working tree has unrelated modified files (`PageHeader.tsx`, `bottom-nav-clearance.static.test.ts`, `Chat.friend-requests.static.test.ts`) that must stay untouched.
- **Preserve these exact source patterns** in `Dashboard.tsx` (asserted by `Dashboard.calendar-widget-interaction.static.test.ts`): `const isBodyOpenable = isOpenable && !def.bodyHandlesOwnClicks;`, the affordance `onClick={(event) => { event.stopPropagation(); onOpen(def.id); }}`, `aria-label={`Apri pagina ${def.label}`}`, and the calendar `bodyHandlesOwnClicks: true` registry entry. Leaving `SortableWidget` intact satisfies all four.
- **Keep** `containerClass = "grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start"` (edit-mode container; also keeps the order-test grid string) and **never** introduce CSS `columns-*` masonry (Safari-broken).
- **Storage key stays `tl_dashboard_order_command_center_v1`** (no bump; `loadOrder` filters unknown ids gracefully).
- Commits: semantic, scoped (`feat(ui):` / `feat(dashboard):`). Run from repo root.

---

## Task 1: Pure masonry helpers

**Files:**
- Create: `artifacts/trader-dashboard/src/pages/Dashboard.layout.ts`
- Test: `artifacts/trader-dashboard/src/pages/Dashboard.layout.test.ts`

**Interfaces:**
- Produces: `columnsForWidth(width: number): number` — 3 if `≥1080`, 2 if `≥680`, else 1.
- Produces: `distributeColumns<T>(ids: T[], cols: number): T[][]` — round-robin (`ids[i]` → column `i % n`), `n = max(1, floor(cols))`.

- [ ] **Step 1: Write the failing test**

`artifacts/trader-dashboard/src/pages/Dashboard.layout.test.ts`:
```ts
import assert from "node:assert/strict";
import { columnsForWidth, distributeColumns } from "./Dashboard.layout";

// Breakpoints (kit dashboard-view.jsx): 3 ≥1080, 2 ≥680, else 1.
assert.equal(columnsForWidth(1280), 3);
assert.equal(columnsForWidth(1080), 3);
assert.equal(columnsForWidth(1079), 2);
assert.equal(columnsForWidth(680), 2);
assert.equal(columnsForWidth(679), 1);
assert.equal(columnsForWidth(320), 1);

// Round-robin distribution, gap-free reading order.
assert.deepEqual(distributeColumns(["a", "b", "c", "d", "e"], 3), [["a", "d"], ["b", "e"], ["c"]]);
assert.deepEqual(distributeColumns(["a", "b"], 3), [["a"], ["b"], []]);
assert.deepEqual(distributeColumns(["a", "b", "c"], 1), [["a", "b", "c"]]);
assert.deepEqual(distributeColumns([], 3), [[], [], []]);
// Guards cols < 1 → single column.
assert.deepEqual(distributeColumns(["a", "b"], 0), [["a", "b"]]);

console.log("Dashboard.layout checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
pnpm --filter trader-dashboard exec vitest run src/pages/Dashboard.layout.test.ts
```
Expected: FAIL (`./Dashboard.layout` does not exist).

- [ ] **Step 3: Write minimal implementation**

`artifacts/trader-dashboard/src/pages/Dashboard.layout.ts`:
```ts
/** Viewport width → masonry column count (Claude Design kit: 3 ≥1080, 2 ≥680, else 1). */
export function columnsForWidth(width: number): number {
  return width >= 1080 ? 3 : width >= 680 ? 2 : 1;
}

/**
 * Round-robin distribution of `ids` into `cols` columns: id at index `i` goes to
 * column `i % n`. Each column stacks independently → no interior vertical gaps.
 */
export function distributeColumns<T>(ids: T[], cols: number): T[][] {
  const n = Math.max(1, Math.floor(cols));
  const columns: T[][] = Array.from({ length: n }, () => []);
  ids.forEach((id, i) => columns[i % n].push(id));
  return columns;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm --filter trader-dashboard exec vitest run src/pages/Dashboard.layout.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/Dashboard.layout.ts artifacts/trader-dashboard/src/pages/Dashboard.layout.test.ts
git commit -m "feat(dashboard): pure masonry column helpers"
```

---

## Task 2: Masonry disposition + pinned clock banner in `Dashboard.tsx`

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.order.test.ts`
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tradingview-watchlist.static.test.ts`

**Interfaces:**
- Consumes: `columnsForWidth`, `distributeColumns` from `./Dashboard.layout`.

- [ ] **Step 1: Update the static tests first (they will fail → red)**

In `Dashboard.order.test.ts`, replace the layout comment + `DEFAULT_ORDER` assertion and add masonry/banner assertions. Replace this block:
```ts
// Layout is a uniform responsive grid (CSS masonry `columns` broke on Safari/WebKit:
// see Dashboard.tsx containerClass comment + commit "fix(ui): Safari card grid").
assert.match(source, /grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3/);
assert.doesNotMatch(source, /columns-1 sm:columns-2 xl:columns-3/);
```
with:
```ts
// Normal view = round-robin flex-column masonry (gap-free); edit view keeps a
// uniform grid. CSS masonry `columns` stays banned (broke on Safari/WebKit).
assert.match(source, /grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3/); // edit-mode grid
assert.doesNotMatch(source, /columns-1 sm:columns-2 xl:columns-3/);
assert.match(source, /distributeColumns\(displayOrder, cols\)/); // round-robin masonry
assert.match(source, /<ClockWidget \/>/); // clock pinned as a banner
assert.doesNotMatch(source, /id: "clock"/); // clock left the widget registry
```
And replace the `DEFAULT_ORDER` assertion:
```ts
assert.match(
  source,
  /const DEFAULT_ORDER = \[\s*"clock",\s*"quote",\s*"tradingview-watchlist",\s*"account",\s*"missions",\s*"routine",\s*"checklist",\s*"lot",\s*"journal",\s*"sentiment",\s*"volatility",\s*"cot",\s*"calendar",\s*\];/s,
);
```
with (clock removed):
```ts
assert.match(
  source,
  /const DEFAULT_ORDER = \[\s*"quote",\s*"tradingview-watchlist",\s*"account",\s*"missions",\s*"routine",\s*"checklist",\s*"lot",\s*"journal",\s*"sentiment",\s*"volatility",\s*"cot",\s*"calendar",\s*\];/s,
);
```

In `Dashboard.tradingview-watchlist.static.test.ts`, replace:
```ts
assert.match(
  source,
  /const DEFAULT_ORDER = \[\s*"clock",\s*"quote",\s*"tradingview-watchlist",\s*"account",/s,
);
```
with:
```ts
assert.match(
  source,
  /const DEFAULT_ORDER = \[\s*"quote",\s*"tradingview-watchlist",\s*"account",/s,
);
```

- [ ] **Step 2: Run the tests to verify they fail (red)**

```bash
pnpm --filter trader-dashboard exec vitest run src/pages/Dashboard.order.test.ts src/pages/Dashboard.tradingview-watchlist.static.test.ts
```
Expected: FAIL (`Dashboard.tsx` still has clock in registry / no masonry yet).

- [ ] **Step 3: Edit `Dashboard.tsx` — imports**

Remove `Clock,` from the lucide import (no longer used) and add the helper import. Change:
```tsx
import {
  GripVertical, Check, RotateCcw,
  Clock, BookOpen, Sunrise, Target, ClipboardCheck,
  CalendarDays, BarChart2, TrendingUp, BookMarked,
  Eye, EyeOff, Wallet, ArrowUpRight, Activity,
} from "lucide-react";
```
to:
```tsx
import {
  GripVertical, Check, RotateCcw,
  BookOpen, Sunrise, Target, ClipboardCheck,
  CalendarDays, BarChart2, TrendingUp, BookMarked,
  Eye, EyeOff, Wallet, ArrowUpRight, Activity,
} from "lucide-react";
```
Then add, right after the `import { useLanguage } ...` line:
```tsx
import { columnsForWidth, distributeColumns } from "./Dashboard.layout";
```
(`ClockWidget` import stays — it becomes the banner.)

- [ ] **Step 4: Edit `Dashboard.tsx` — drop clock from the registry**

Remove the clock entry from `WIDGET_DEFS` (delete this line):
```tsx
  { id: "clock",      label: "Orologio & Sessioni",  icon: Clock,          route: "/clock",                  component: ClockWidget },
```
Remove `"clock",` (first line) from `DEFAULT_ORDER` so it becomes:
```tsx
const DEFAULT_ORDER = [
  "quote",
  "tradingview-watchlist",
  "account",
  "missions",
  "routine",
  "checklist",
  "lot",
  "journal",
  "sentiment",
  "volatility",
  "cot",
  "calendar",
];
```

- [ ] **Step 5: Edit `Dashboard.tsx` — add the `useColumns` hook**

Insert after the `shouldStartLayoutEditing` function (before `// ─── Sortable widget wrapper`):
```tsx
// Responsive masonry column count. CSS `columns` is avoided (Safari mis-measures
// heights); we distribute widgets across flex columns via JS instead.
function useColumns(): number {
  const read = () =>
    typeof window === "undefined" ? 3 : columnsForWidth(window.innerWidth || 1280);
  const [cols, setCols] = useState(read);
  useEffect(() => {
    const onResize = () => setCols(read());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return cols;
}
```

- [ ] **Step 6: Edit `Dashboard.tsx` — read columns + extract `renderCell`**

In the `Dashboard` component, add near the other hooks (after `const prevOrderRef = ...`):
```tsx
  const cols = useColumns();
```
Then, just before the `return (` of the component, add the cell renderer (this is the exact JSX currently inside the grid `.map`, extracted verbatim):
```tsx
  const renderCell = (id: string, i: number) => {
    const def = defMap[id];
    if (!def) return null;
    const isHid = !!hidden[id];
    return (
      <motion.div
        key={id}
        layout={isEditing}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{
          opacity: { delay: i * 0.03, duration: 0.24 },
          y: { delay: i * 0.03, duration: 0.24, ease: [0.22, 1, 0.36, 1] },
          layout: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
        }}
        className={isEditing ? "h-[200px]" : ""}
      >
        <SortableWidget
          def={def}
          isEditing={isEditing}
          isDragActive={activeId !== null}
          isHidden={isHid}
          onToggleHide={handleToggleHide}
          onOpen={handleOpenWidget}
        />
      </motion.div>
    );
  };
```

- [ ] **Step 7: Edit `Dashboard.tsx` — pin the clock banner + switch the container**

Add the pinned clock banner immediately after `<PageHeader ... />` closes and before the edit-mode banner `<AnimatePresence>`:
```tsx
      {/* Clock — pinned full-width banner (kit-faithful), outside the reorderable set */}
      <div className="mb-4">
        <ClockWidget />
      </div>
```
Then replace the existing grid block:
```tsx
        <SortableContext items={displayOrder} strategy={rectSortingStrategy}>
          <div className={containerClass}>
            {displayOrder.map((id, i) => {
              const def = defMap[id];
              if (!def) return null;
              const isHid = !!hidden[id];
              return (
                <motion.div
                  key={id}
                  layout={isEditing}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{
                    opacity: { delay: i * 0.03, duration: 0.24 },
                    y: { delay: i * 0.03, duration: 0.24, ease: [0.22,1,0.36,1] },
                    layout: { duration: 0.28, ease: [0.22,1,0.36,1] },
                  }}
                  className={isEditing ? "h-[200px]" : ""}
                >
                  <SortableWidget
                    def={def}
                    isEditing={isEditing}
                    isDragActive={activeId !== null}
                    isHidden={isHid}
                    onToggleHide={handleToggleHide}
                    onOpen={handleOpenWidget}
                  />
                </motion.div>
              );
            })}
          </div>
        </SortableContext>
```
with the container switch (edit = grid, normal = masonry):
```tsx
        <SortableContext items={displayOrder} strategy={rectSortingStrategy}>
          {isEditing ? (
            <div className={containerClass}>
              {displayOrder.map((id, i) => renderCell(id, i))}
            </div>
          ) : (
            <div className="flex items-start gap-4">
              {distributeColumns(displayOrder, cols).map((colIds, ci) => (
                <div key={ci} className="flex-1 min-w-0 space-y-4">
                  {colIds.map((id) => renderCell(id, displayOrder.indexOf(id)))}
                </div>
              ))}
            </div>
          )}
        </SortableContext>
```
(Leave `DndContext`, `DragOverlay`, `SortableWidget`, `containerClass`, and all handlers exactly as they are.)

- [ ] **Step 8: Run the dashboard static tests (green)**

```bash
pnpm --filter trader-dashboard exec vitest run src/pages/Dashboard.order.test.ts src/pages/Dashboard.tradingview-watchlist.static.test.ts src/pages/Dashboard.calendar-widget-interaction.static.test.ts src/pages/Dashboard.layout-settings.test.ts
```
Expected: PASS (all four).

- [ ] **Step 9: Typecheck the frontend**

```bash
pnpm --filter trader-dashboard typecheck
```
Expected: PASS — no unused `Clock` import, no type errors.

- [ ] **Step 10: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/Dashboard.tsx artifacts/trader-dashboard/src/pages/Dashboard.order.test.ts artifacts/trader-dashboard/src/pages/Dashboard.tradingview-watchlist.static.test.ts
git commit -m "feat(dashboard): gap-free round-robin masonry + pinned clock banner"
```

---

## Task 3: Full gate + visual check

**Files:** none (verification only).

- [ ] **Step 1: Run the frontend test suite**

```bash
pnpm --filter trader-dashboard test
```
Expected: PASS — dashboard tests, i18n parity, contrast, production-copy all green.

- [ ] **Step 2: Full gate**

```bash
pnpm verify
```
Expected: install → codegen → typecheck → test → build all green. (If a pre-existing unrelated failure appears — e.g. `railwayDeploy` — note it; it is not part of this change.)

- [ ] **Step 3: Visual review (real data)**

Start locally (`./dev-up.sh`, then API + Vite, ports 55432/3001/5173), open `/`:
- Clock renders as a full-width banner on top.
- Widgets fill 3 columns (≥1080px) with **no empty vertical gaps**; resize to confirm 2-col (≥680) and 1-col (<680).
- Click-to-open + hover "apri pagina" affordance still work; calendar still owns its own clicks.
- "Modifica layout" (`/?layout=edit`) still drags/reorders/hides in the uniform grid.

- [ ] **Step 4: Push**

```bash
git push
```
(Per project rule: push the branch once the gate is green and the work is committed.)

---

## Self-review notes

- **Spec coverage:** masonry round-robin → Task 1 + Task 2 step 7; pinned clock banner + registry removal → Task 2 steps 3–4, 7; edit mode unchanged → Task 2 step 7 (grid branch + untouched `SortableWidget`/dnd); order update → Task 2 step 4; test updates → Task 2 step 1; helpers as testable units → Task 1; gate → Task 3.
- **Invariants preserved:** `SortableWidget` and its asserted patterns left intact (calendar-interaction test); `containerClass` grid string kept (order test); `tl_dashboard_order_command_center_v1` key kept; no CSS `columns-*`.
- **Type consistency:** `columnsForWidth(width: number): number` and `distributeColumns<T>(ids: T[], cols: number): T[][]` used identically in Task 2 (`distributeColumns(displayOrder, cols)`, `useColumns` via `columnsForWidth`).
- **Out of scope:** widget visual restyle (done), height-balanced masonry (round-robin chosen), dnd redesign.
