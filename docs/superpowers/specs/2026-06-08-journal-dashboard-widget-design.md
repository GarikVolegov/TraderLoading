# Journal Dashboard Widget Design

## Goal

Add a comfortable, accessible, interactive journal widget to the TraderLoadings dashboard. The widget should make the trading journal useful without forcing the user to open the full Journal page first.

## Approved Direction

Use a compact dashboard widget. The widget appears in the existing dashboard widget grid, can be reordered and hidden through the existing Layout mode, and opens the full Journal page when the widget shell is activated.

The widget also exposes direct internal actions, so the user can create a journal entry from the dashboard and inspect recent performance at a glance.

## User Experience

The widget is named "Diario Trading" and uses the existing journal route `/journal`.

In normal dashboard mode it shows:

- today's trade count;
- weekly totals for wins, losses, breakevens, and win rate;
- the latest journal entry with date, result, title, and a short note preview;
- an accessible primary action to create a new trade;
- a secondary action to open the full journal.

When the user activates "Nuovo trade", the existing `JournalEntryModal` opens directly from the widget. Saving the modal invalidates the journal query through the existing modal behavior, so the widget refreshes with the new data.

When no journal entries exist, the widget shows an empty state with one clear action: create the first trade.

## Accessibility Requirements

The widget must use real buttons for every action. Interactive controls must have clear labels, visible focus states, and comfortable tap targets. The widget must not rely on hover-only actions for critical behavior.

The dashboard widget shell can remain keyboard-openable through the existing `SortableWidget` wrapper. Internal buttons must stop pointer and click propagation so the dashboard shell does not navigate away while the user is trying to open the modal.

Status information should be readable in text, not conveyed only by color. Win, loss, breakeven, loading, error, and empty states should have explicit labels.

## Architecture

Create `artifacts/trader-dashboard/src/components/JournalWidget.tsx`.

The component uses:

- `useGetJournalEntries` from `@workspace/api-client-react`;
- `JournalEntryModal` from the existing journal modal;
- date helpers from `date-fns`;
- existing card/button styling patterns from current dashboard widgets;
- `useLanguage` and `useDateLocale` where practical for current journal labels and dates.

Register the widget in `artifacts/trader-dashboard/src/pages/Dashboard.tsx` by importing `JournalWidget`, adding a widget definition with id `journal`, icon `BookOpen`, route `/journal`, and component `JournalWidget`.

Add `journal` to `DEFAULT_ORDER` near other daily workflow widgets, after `checklist` and before market tools. Existing saved orders will preserve the user's order and append the missing widget through `loadOrder`.

## Data Flow

The widget fetches all journal entries with the existing generated query hook. It derives:

- `todayCount`: entries whose `tradeDate` matches today's local date;
- `weeklyStats`: entries whose `tradeDate` falls between the current Monday and Sunday;
- `latestEntry`: most recent entry by `tradeDate`, falling back to `createdAt` when needed.

The widget does not add new backend endpoints or database columns. It reuses the existing journal entry creation flow.

## Error Handling

Loading state displays a compact skeleton within the widget.

If journal loading fails, the widget remains mounted and shows a small unavailable state with a link to open the full journal page.

If data is empty, the widget shows the first-trade empty state and keeps the new-entry action available.

Date parsing should be defensive. Invalid dates are ignored for stats and displayed as a generic recent entry label rather than crashing the widget.

## Testing And Verification

Add focused tests only if existing test infrastructure can cover the logic cheaply. At minimum, verification must include:

- TypeScript typecheck for `@workspace/trader-dashboard`;
- build or root verification if typecheck passes;
- manual review that the dashboard widget appears, the "Nuovo trade" button opens `JournalEntryModal`, internal buttons do not trigger navigation, and Layout mode still supports reorder/hide behavior.

## Scope Boundaries

This iteration does not add backend journal summaries, AI journal analysis, editing the latest trade inline, or chart visualizations. The goal is a reliable, ergonomic dashboard widget with direct journal interaction.
