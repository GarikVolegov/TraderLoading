# Tool Filters From User Pairs Design

## Context

TraderLoadings already stores the user's trading instruments in `selectedPairs` through `BackgroundContext`. It also derives `selectedCurrencies` from those pairs using `@workspace/pair-catalog`.

Several tools already read this context, but the behavior is inconsistent:

- `SentimentTool` in `/tools` exposes a local pair filter with manual `Tutti` and `Nessuno` controls.
- `VolatilityTool` narrows its selector to supported user pairs, but the selector is always visible.
- `CotTool` filters by derived currencies without showing a small explicit filter section.
- Dashboard widgets mirror some of these behaviors in compact form.
- The top macro/news ticker has its own currency filter UI and local storage, even though it can now derive currencies from user pairs.

The desired behavior is that filters should be populated directly from the user's pair choices and should stay hidden or compact inside each tool until the user later asks for tool-specific overrides.

## Approved Direction

Use a **small collapsible filter panel** inside each tool.

The panel is read-only for now. It shows which user pairs or derived currencies the tool is using, but it does not allow local per-tool selections. Tool-specific overrides are intentionally not implemented in this phase.

## Goals

- Make `selectedPairs` the primary source for tool filters.
- Use `selectedCurrencies` only when a tool is currency-based rather than pair-based.
- Remove local pair/currency selection behavior from tools unless it is part of the user's global pair onboarding/settings flow.
- Keep filter UI small, enclosed, and collapsible inside each tool.
- Make unsupported pairs clear without expanding the tool UI.
- Preserve existing data fetching, refresh controls, charts, and tool outputs.

## Non-Goals

- Do not add per-tool override storage.
- Do not add a new settings model for tool-specific filters.
- Do not redesign the full `/tools` page.
- Do not change backend tool APIs unless a frontend query must pass a pair or currency parameter differently.
- Do not alter the global pair selection modal or onboarding flow.

## Behavior

Each tool computes an effective filter from global user choices:

- Pair-based tools use `selectedPairs`.
- Currency-based tools use `selectedCurrencies`.
- If the tool supports only a subset of the user's pairs, it uses the supported subset.
- If the user has no selected pairs, the tool may fall back to its current broad default so the interface remains useful during onboarding edge cases.
- If the user has selected pairs but none are supported by a specific tool, the tool falls back to its current supported default and shows a compact unsupported-state note.

The filter panel should show:

- a short title such as `Filtri dai tuoi pair`;
- chips for the effective pairs or currencies;
- a compact support count when applicable, such as `3/5 supportati`;
- a short note when fallback/default data is being used.

The panel should not show:

- `Tutti` or `Nessuno` controls;
- checkboxes for all available pairs/currencies;
- per-tool save/apply buttons;
- hidden disabled override controls.

## Tool Details

### Sentiment

`SentimentTool` should stop maintaining local `selectedPairs` state.

It should:

- sort and filter symbols directly from `selectedPairs`;
- display only matching user pairs when any are available in the sentiment response;
- fall back to all returned symbols if no user pair matches or no pair is selected;
- expose the derived filter only through the small collapsible read-only panel.

The average sentiment score and visible count should be based on the effective visible symbols.

### Volatility

`VolatilityTool` should keep the selected pair control because the tool can show one pair at a time, but its available options should come from the user's supported pair subset.

It should:

- use supported `selectedPairs` as the option list;
- fall back to existing supported pairs only when no user pair is selected or none are supported;
- show the read-only filter panel with the supported subset and support count;
- keep the pair dropdown small and scoped to the effective list.

### COT

`CotTool` should continue using `selectedCurrencies`.

It should:

- filter reports by currencies derived from selected pairs;
- show a compact read-only panel with the derived currencies;
- avoid presenting an independent currency chooser.

### Macro News Ticker

The ticker should use currencies derived from user pairs when they exist.

It should:

- avoid exposing an independent currency checkbox list when pair-derived currencies are active;
- show the derived currencies in a compact read-only filter section;
- keep refresh and article details unchanged.

If there are no selected pairs, the current fallback currency behavior may remain.

## UI Shape

Use a small collapsed button in each relevant tool header or first control row:

- icon: `Filter` or existing compact control style;
- label: `Filtri`;
- optional count, such as `Filtri (3)`;
- open state reveals a bordered panel no larger than needed for chips and a one-line note.

The panel should use the existing dashboard style:

- `rounded-xl` or smaller;
- subtle border;
- compact text;
- chip-style labels using monospace for symbols;
- no page-level cards inside cards.

## Error Handling

- If user settings have not loaded yet, tools may render their current default state.
- If selected pairs are loaded but unsupported, show a compact note rather than an empty chart.
- If API data is unavailable, keep existing error states.
- If an API returns symbols with labels that do not match the catalog, preserve the existing symbol names and show fallback behavior.

## Testing

Frontend tests should cover:

- sentiment uses selected user pairs without local toggle state;
- sentiment falls back when no selected user pair exists in returned symbols;
- volatility option list is derived from supported selected pairs;
- volatility falls back when selected user pairs are unsupported;
- COT filters from derived selected currencies;
- macro ticker does not expose independent currency checkboxes when derived currencies exist.

Manual verification should cover:

- selected pairs including `EURUSD`, `XAUUSD`, and `BTCUSD`;
- a selected pair supported by sentiment but not volatility;
- no selected pairs;
- selected pairs whose currencies map to COT reports;
- mobile and desktop tool layouts.

## Verification

- `pnpm --filter @workspace/trader-dashboard run typecheck`
- targeted frontend tests if test coverage exists for the affected components
- manual check of `/tools` and the top macro ticker

## Self-Review

- No tool-specific override UI is introduced.
- The design keeps `selectedPairs` as the primary source of truth.
- Currency filters are derived, not manually duplicated.
- Unsupported pairs have a compact visible explanation.
- Existing tool data and refresh behavior are preserved.
