# Dashboard Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved desktop Command Center dashboard layout.

**Architecture:** Reuse the existing widget registry and drag-and-drop dashboard, but add desktop-specific column spans and a new default order. Shrink the desktop shell sidebar and widen the content area without changing mobile navigation.

**Tech Stack:** React, Vite, Tailwind CSS, Framer Motion, dnd-kit.

---

## File Structure

- Modify `artifacts/trader-dashboard/src/pages/Dashboard.tsx`: desktop widget order, spans, command center header and grid classes.
- Modify `artifacts/trader-dashboard/src/components/PageLayout.tsx`: compact desktop sidebar offset and wider max width.
- Modify `artifacts/trader-dashboard/src/components/TopNav.tsx`: align header with compact sidebar.
- Modify `artifacts/trader-dashboard/src/components/BottomNav.tsx`: icon-first compact desktop sidebar.
- Modify `artifacts/trader-dashboard/src/index.css`: desktop command center utility classes.

## Tasks

### Task 1: Desktop Shell

- [ ] Change desktop content offset from `lg:pl-48` to a compact sidebar width.
- [ ] Change desktop top nav left offset to match.
- [ ] Convert desktop sidebar to an icon-first rail while preserving mobile bottom nav.

### Task 2: Dashboard Grid

- [ ] Add `desktopSpan` metadata to widget definitions.
- [ ] Reset local storage keys for the new Command Center layout.
- [ ] Change desktop grid to `lg:grid-cols-12`.
- [ ] Set default desktop order: clock, quote, routine, checklist, calendar, missions, sentiment, volatility, cot.

### Task 3: Polish And Verification

- [ ] Add command center surface classes for cards and page spacing.
- [ ] Run `pnpm --filter @workspace/trader-dashboard run typecheck`.
- [ ] Run `pnpm --filter @workspace/trader-dashboard run build`.
- [ ] Run `pnpm run verify:runtime`.

## Self-Review

- Covers all approved design requirements.
- No placeholder tasks remain.
- Verification commands are concrete.
