# Calendar Widget Inline Details Design

## Goal

Make the dashboard economic calendar widget interactive for USD macro events. Clicking an event row should expand the row in place and show the available `forecast` and `previous` values instead of immediately navigating to the dedicated calendar page.

## Approved Direction

Use the existing inline expansion already present in `CalendarWidget`. The bug is in the dashboard widget wrapper: it treats the whole widget shell as a navigation target to `/calendar`. The fix should let event-row clicks stay inside the calendar widget and reserve page navigation for a separate explicit open-page control.

## Behavior

- In normal dashboard mode, clicking a calendar event with `forecast` or `previous` toggles its inline detail area.
- The detail area shows `Previsione` and `Precedente` when those values exist.
- The dashboard should not navigate to `/calendar` when the user clicks calendar rows, filters, refresh, or other internal calendar controls.
- The dedicated calendar page remains reachable from the dashboard through the existing bottom-right open-page affordance.
- Layout edit mode remains unchanged: drag, hide, and reorder controls continue to work without opening the page.

## Data Flow

No API changes are required. `GET /api/calendar` already maps Forex Factory data into calendar events with:

- `forecast: string | null`
- `previous: string | null`

The generated frontend hook `useGetEconomicCalendar` already supplies those fields to `CalendarWidget`.

## Implementation Shape

Update `Dashboard.tsx` so the calendar widget route is not opened by a click bubbling from inside the widget content. The open-page affordance should become the explicit click target for `/calendar`, rather than being pointer-events disabled.

Keep `CalendarWidget.tsx` behavior focused on its internal expansion state. If needed, add event propagation guards to the calendar event rows so their click cannot trigger the dashboard wrapper navigation.

## Error Handling

No new error states are introduced. If an event has no `forecast` and no `previous`, it remains non-expandable as it does today. If the calendar API returns no events, the existing empty state remains.

## Testing

Add a targeted static/unit test that protects the interaction contract:

- calendar widget rows remain capable of toggling details;
- dashboard page navigation for the calendar is tied to an explicit open-page control, not the entire widget body.

Run the existing dashboard/frontend checks after implementation:

- `pnpm --filter @workspace/trader-dashboard run typecheck`
- relevant targeted tests for dashboard/calendar behavior.

## Scope Boundaries

This work does not add new economic calendar providers, new event fields, or a larger modal. It only fixes the dashboard interaction so the already-available forecast and previous values are accessible from the widget.
