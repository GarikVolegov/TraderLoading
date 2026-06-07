# Dashboard Widget Drawer And Advanced Calendar Design

## Goal

Turn the dashboard into a clickable command hub. Every dashboard widget opens a richer dedicated drawer without leaving the dashboard. The calendar drawer becomes an advanced planner that combines market events, goals, ideas, notes, appointments, missions, news, and journal entries.

## Approved Direction

The selected interaction is option B: a desktop drawer/modal overlay. The dashboard remains visible behind the panel. Widgets are clickable in normal mode and not clickable while Layout mode is active, so drag-and-drop remains reliable.

The calendar behavior is hybrid: the user can create manual notes and appointments, while the app also organizes existing application data into a unified agenda.

## Dashboard Interaction

Each widget in `artifacts/trader-dashboard/src/pages/Dashboard.tsx` gets a target workspace id:

- `clock`: trading sessions and time focus
- `quote`: focus note and daily quote
- `routine`: routine workspace
- `missions`: daily missions workspace
- `checklist`: pre-trade checklist workspace
- `calendar`: advanced calendar planner
- `sentiment`: market sentiment tool
- `volatility`: volatility and ADR tool
- `cot`: COT report tool

Clicking a visible widget opens a drawer. In Layout mode the click target is disabled and only drag/hide controls are active.

## Drawer Shell

Create one reusable drawer component for dashboard workspaces. It should:

- render as a fixed right-side panel on desktop and full-screen panel on mobile/tablet;
- include title, subtitle, icon, close button, and scrollable content;
- close on Escape, backdrop click, and close button;
- keep focus and pointer behavior predictable;
- avoid nested decorative cards; use compact panels and rows inside the drawer.

## Workspace Content

The first implementation can reuse existing feature components where practical:

- Checklist opens a full checklist-oriented panel and links to `/checklist` for the complete page if needed.
- Routine opens routine session actions and links to `/routine`.
- Sentiment, Volatility, and COT use the same data/tool concepts already present in `/tools`.
- Missions show today's missions and completion state.
- Clock shows sessions, current market time, and session status.
- Quote shows the quote and a small daily focus note area.

## Advanced Calendar

The calendar drawer has three visual areas:

1. Today strip: current day, sessions, next high-impact market event, next user item.
2. Planner list: unified agenda grouped by date and source.
3. Composer: create a manual appointment or note with title, type, date/time, optional end time, priority, and notes.

Calendar sources:

- economic events from `GET /api/calendar`;
- goals and ideas from `GET /api/ideas`;
- missions from `GET /api/missions`;
- macro news from `GET /api/news`;
- journal entries from `GET /api/journal`;
- manual planner items from a new local persistence layer in the frontend for this first drawer version.

Manual planner item shape:

```ts
type PlannerItemType = "appointment" | "note" | "review" | "trade-plan";

interface ManualPlannerItem {
  id: string;
  type: PlannerItemType;
  title: string;
  notes: string;
  startAt: string;
  endAt: string | null;
  priority: "low" | "medium" | "high";
  createdAt: string;
}
```

Use `localStorage` for manual planner items in this iteration. A later backend version can promote this to a database table and API without changing the drawer UI contract much.

## Data Flow

Dashboard owns the active workspace id. `DashboardWorkspaceDrawer` receives the active widget definition and renders the correct workspace component.

Calendar workspace fetches existing API data with current generated React Query hooks where available. Manual planner items are loaded from localStorage and merged into a computed `AgendaItem[]`.

The agenda sorts by date ascending and labels each source clearly: market, goal, idea, note, appointment, mission, news, or journal.

## Error Handling

If an API source fails, the drawer still opens and shows available sources. Each source section can display a compact unavailable state rather than failing the whole drawer.

If localStorage parse fails, discard the invalid planner cache and continue with an empty manual list.

## Testing And Verification

Verification must include:

- TypeScript typecheck for `@workspace/trader-dashboard`.
- Dashboard build for `@workspace/trader-dashboard`.
- Runtime verification with `pnpm run verify:runtime`.
- Manual check that normal widget click opens drawer and Layout mode still allows drag/hide controls without opening drawer.

## Scope Boundaries

This iteration does not add a backend database table for planner items. It also does not implement AI scheduling decisions. It prepares the UI and local planner model so backend persistence and AI-assisted organization can be added cleanly later.
