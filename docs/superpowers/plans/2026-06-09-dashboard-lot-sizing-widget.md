# Dashboard Lot Sizing Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the existing lot sizing calculator as a default widget in the dashboard.

**Architecture:** Reuse the existing `LotCalculatorWidget` component in the dashboard widget registry. Add `lot` to `DEFAULT_ORDER` after `checklist`, preserving the current dashboard storage key and missing-widget merge behavior for existing users.

**Tech Stack:** React, TypeScript, Vite, static Node assertions.

---

### Task 1: Dashboard Registry

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.order.test.ts`
- Modify: `artifacts/trader-dashboard/src/pages/Dashboard.tsx`

- [ ] **Step 1: Write the failing test**

Update `Dashboard.order.test.ts` so the `DEFAULT_ORDER` assertion expects `lot` after `checklist`, and add assertions that `Dashboard.tsx` imports `LotCalculatorWidget` and registers a widget with `id: "lot"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --dir artifacts/trader-dashboard exec tsx src/pages/Dashboard.order.test.ts`

Expected: FAIL because `Dashboard.tsx` does not yet import or register `LotCalculatorWidget` and `DEFAULT_ORDER` does not include `lot`.

- [ ] **Step 3: Write minimal implementation**

In `Dashboard.tsx`, import `LotCalculatorWidget`, add a `lot` widget definition with label `Dimensionamento`, icon `BarChart2`, route `/tools?tab=lot`, and component `LotCalculatorWidget`, then add `"lot"` to `DEFAULT_ORDER` after `"checklist"`.

- [ ] **Step 4: Run focused test**

Run: `pnpm --dir artifacts/trader-dashboard exec tsx src/pages/Dashboard.order.test.ts`

Expected: PASS with `dashboard order checks passed`.

- [ ] **Step 5: Run typecheck**

Run: `pnpm --dir artifacts/trader-dashboard typecheck`

Expected: PASS.

## Self Review

The plan covers the approved requirement, contains no placeholders, and keeps all behavior scoped to the dashboard registry and existing static coverage.
