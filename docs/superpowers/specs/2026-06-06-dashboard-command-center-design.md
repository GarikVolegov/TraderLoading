# Dashboard Command Center Design

## Goal

Redesign the TraderLoadings dashboard for desktop as a dense operational command center while preserving the current dark trading identity, forest background support, and existing widget behavior.

## Approved Direction

The approved visual direction is **A. Command Center** from the visual companion. Desktop should feel like a trading workstation, not a stretched mobile grid.

## Design Requirements

- Use a compact icon-first desktop sidebar to free horizontal space.
- Keep mobile and tablet navigation behavior intact.
- Use a desktop 12-column dashboard grid.
- Place Clock, Quote, and Routine in the first desktop row.
- Give Checklist and Calendar equal large priority in the second desktop row.
- Place Missions, Sentiment, Volatility, and COT as compact secondary panels.
- Keep layout editing, drag-and-drop ordering, and widget visibility controls.
- Reset dashboard local storage keys so the new desktop ordering appears cleanly.
- Maintain existing backend/API behavior.

## Verification

- `pnpm --filter @workspace/trader-dashboard run typecheck`
- `pnpm --filter @workspace/trader-dashboard run build`
- `pnpm run verify:runtime`

## Self-Review

- No placeholders remain.
- Scope is limited to desktop dashboard shell and layout.
- Existing widgets are reused rather than redesigned deeply.
