# Dashboard Lot Sizing Widget Design

## Goal

Show the existing lot sizing calculator as a default dashboard widget while keeping it available in the Tools page.

## Design

Reuse `LotCalculatorWidget` from `artifacts/trader-dashboard/src/components/LotCalculatorWidget.tsx` in the dashboard widget registry. Add a new dashboard widget definition with id `lot`, label `Dimensionamento`, a chart icon, and route `/tools?tab=lot`.

The widget is visible by default. Its id is included in `DEFAULT_ORDER` so new users see it immediately and existing users receive it through the current `loadOrder()` missing-widget merge behavior.

Place the widget near the operational pre-trade area, after `checklist` and before `journal`, so it is available during trade preparation without removing the existing Tools tab.

## Data Flow

The widget keeps its existing local input state and reads `lotDivisor` from `BackgroundContext`. No new API or persistence is required.

## Testing

Update the dashboard static order test to require:

- `LotCalculatorWidget` is imported by `Dashboard.tsx`.
- The dashboard widget registry contains id `lot`.
- `DEFAULT_ORDER` includes `lot` after `checklist` and before `journal`.
- The existing dashboard storage key remains unchanged.

## Self Review

No placeholders remain. The scope is a single UI registry addition plus static regression coverage. Existing saved dashboard layouts continue to work because `loadOrder()` appends any ids missing from saved order data.
