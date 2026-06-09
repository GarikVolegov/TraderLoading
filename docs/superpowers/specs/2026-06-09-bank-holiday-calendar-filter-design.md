# Bank Holiday Calendar Filter Design

## Summary

The economic calendar already receives `Holiday` events from the Forex Factory feed and the API contract already allows `impact: "Holiday"`. The missing behavior is in the dashboard calendar widget: the impact filter intentionally hides `Holiday`, so users cannot enable bank holidays from the filter UI.

## Goals

- Show `Holiday` as a selectable option in the existing `Impatto` filter.
- Render the holiday impact marker, border, and selected filter text in white.
- Reuse the existing saved `calendarImpacts` preference flow.
- Keep notifications unchanged; bank holidays do not trigger macro alerts.

## Design

Update `CalendarWidget.tsx` only. Keep the existing `IMPACT_CONFIG` map, change the `Holiday` color classes from blue to white, and remove the filter exclusion that currently drops `Holiday` from the impact filter buttons.

When the user selects `Festivo`, the widget filters existing API events where `event.impact === "Holiday"` and displays them in the same list as other economic calendar rows. Holiday rows keep the existing date, country, title, past/upcoming treatment, and optional details behavior.

## Testing

Add a focused static test for `CalendarWidget.tsx` that confirms:

- `Holiday` is not filtered out from the impact filter options;
- `Holiday` uses white visual classes;
- the localized label remains `Festivo`.

This keeps coverage scoped to the behavior being changed without requiring a full React render harness.

## Out Of Scope

- No backend changes.
- No OpenAPI or generated client changes.
- No push notification changes.
- No default preference migration for existing users.
