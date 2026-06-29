# Dashboard Widget Disposition — Gap-Free Masonry (from Claude Design kit)

**Date:** 2026-06-29
**Branch:** feat/community-management
**Status:** Design approved (key decisions confirmed), pending spec review

## 1. Goal

Make the **arrangement** of the dashboard widgets match the Claude Design
dashboard kit: all widgets tidily packed, **no empty vertical gaps**, in a
sensible order. The widgets themselves were already restyled onto the kit
(see recent `feat(dashboard): … Claude Design` commits); this work is purely
about the **layout/disposition**, which the earlier widgets-refresh spec left
explicitly out of scope.

## 2. Problem

`Dashboard.tsx` (normal view) lays widgets out in a **uniform CSS grid**:

```
grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-start
```

Every widget is one same-width cell; with `items-start` each grid row is as
tall as its tallest widget, so **shorter widgets leave empty space below them**
within a row. CSS `columns` masonry was tried before and reverted (breaks on
Safari/WebKit — see the `containerClass` comment and `Dashboard.order.test.ts`).

The `ClockWidget` is a **full-width horizontal banner** (time · daily quote ·
date · session pill) but currently sits in a single 1/3-width grid cell, where
it is cramped.

## 3. Target (Claude Design kit `ui_kits/dashboard/dashboard-view.jsx`)

The kit solves both problems:

1. **Clock pinned as a full-width banner** at the top, *outside* the widget flow.
2. Remaining widgets distributed **round-robin across N flex columns** (N = 1/2/3
   by viewport width), each column an independent vertical stack:

   ```js
   const columns = Array.from({ length: cols }, () => []);
   visible.forEach((id, i) => columns[i % cols].push(id)); // gap-free
   ```
   ```jsx
   <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
     {columns.map(colIds => (
       <div style={{ flex:1, minWidth:0 }}>
         {colIds.map(id => <DashCell def={…} />)}
       </div>
     ))}
   </div>
   ```

Because each column stacks independently, there are **no interior vertical
gaps**. Reading order stays left→right, top→bottom (widget `i` → column `i % N`).

## 4. Design (production `Dashboard.tsx`)

### 4.1 Confirmed decisions
- **Clock → pinned full-width banner** on top, kit-faithful. It is **removed
  from the widget registry** (`WIDGET_DEFS` / `DEFAULT_ORDER`), so it is no
  longer reorderable or hideable in "Modifica layout". (User-confirmed.)
- **Round-robin** column distribution (kit-faithful), not height-balanced.
  (User-confirmed.) Eliminates the interior gaps the user reported; column
  bottoms may stay slightly uneven, which is acceptable and matches the kit.

### 4.2 Normal (non-editing) view
- Render `<ClockWidget />` once as a banner above everything.
- Compute `cols` from viewport width via a small `useColumns()` hook
  (3 ≥ 1080px, 2 ≥ 680px, else 1; SSR/test-safe default). CSS `columns` is **not**
  used (Safari).
- Distribute the visible widgets (excluding clock) round-robin into `cols` flex
  columns; render each column as a vertical stack with `gap`/`margin-bottom`
  between cells.
- Each cell keeps: click-to-open navigation, the `bodyHandlesOwnClicks` guard
  (`closest("button,a,input,select,textarea,label")`), and the hover
  "apri pagina" (`ArrowUpRight`) affordance — behaviour unchanged.
- Entry stagger animation preserved.

### 4.3 Edit ("Modifica layout") view — unchanged
- Stays a **uniform fixed-height grid** with dnd-kit drag-to-reorder + hide/show,
  which already mirrors the kit's edit mode. Keeps the
  `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` container (also keeps that
  string present for the order test). Clock no longer appears here (it left the
  registry). `?layout=edit` deep-link + settings entry untouched.

### 4.4 Order
- `DEFAULT_ORDER` becomes the kit order minus the now-pinned clock:
  `["quote", "tradingview-watchlist", "account", "missions", "routine",
  "checklist", "lot", "journal", "sentiment", "volatility", "cot", "calendar"]`.
- `loadOrder()` already filters saved IDs against `DEFAULT_ORDER` and appends
  missing ones, so persisted orders containing the old `"clock"` id degrade
  gracefully — **no storage-key bump, no migration** (`…_v1` kept).

## 5. Components / boundaries
- `useColumns()` — pure viewport→column-count hook (window-guarded).
- `distributeColumns(ids, cols)` — pure round-robin splitter (unit-testable in
  isolation, no DOM).
- Banner render (clock), normal masonry render, and edit-grid render are three
  clearly separated branches of `Dashboard`.

## 6. Testing & gates
- **New unit test** for `distributeColumns` (round-robin correctness, edge cases:
  fewer widgets than columns, 1 column, empty).
- **Update `Dashboard.order.test.ts`:** new `DEFAULT_ORDER` (clock removed);
  update the layout comment; keep `doesNotMatch(/columns-1 sm:columns-2/)` (still
  true) and keep the edit-mode `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`
  assertion; add an assertion for the round-robin masonry (`% cols` /
  flex-column distribution) in normal view.
- `Dashboard.layout-settings.test.ts`, `Dashboard.calendar-widget-interaction`,
  `Dashboard.tradingview-watchlist` — must stay green (behaviour preserved).
- `pnpm typecheck` + `pnpm test` green; `pnpm verify` before done.
- No raw HSL literals; no `@typescript-eslint/no-explicit-any` in non-test source.

## 7. Out of scope
- Widget visual restyle (already done).
- Edit-mode interaction redesign / dnd-kit replacement.
- Height-balanced masonry (round-robin chosen).
- Any data/contract change.

## 8. Risks
| Risk | Mitigation |
|---|---|
| Order test brittle on `DEFAULT_ORDER` | Update test in same change; keep `…_v1` key. |
| Reading order surprises users (column-major) | Round-robin keeps row 0 = first N widgets; matches kit. |
| Clock no longer hideable | User-confirmed; it is a fixed banner by design. |
| Resize jank from `useColumns` | Cheap state, listener cleaned up; debounce only if needed. |
| Touching unrelated uncommitted files | Commit only this change's files; never `git add -A`. |
