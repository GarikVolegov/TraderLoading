# Quote Widget Animation Design

## Goal

Make the dashboard quote rotation feel smooth and intentional. The current animation feels mechanical because each new quote remounts the whole card, waits for the exit animation, then runs nested delayed entrance animations.

## Scope

This change is limited to `artifacts/trader-dashboard/src/components/QuoteWidget.tsx`.

## Current Behavior

`QuoteWidget` uses `AnimatePresence mode="wait"` around the entire card and keys the card by `quote.text`. When the backend refetches every 8 seconds, the full card exits and re-enters. The text and author also animate with their own delayed entrances, so a single quote change feels split into several steps. Quote length changes can make the card feel jumpy.

## Proposed Behavior

Keep the card shell mounted while quotes rotate. Animate only the quote content block when the text or author changes.

The transition should:

- use `AnimatePresence initial={false}` for the inner quote block;
- key the inner block by both text and author;
- use a short fade plus small vertical movement;
- avoid nested delayed text and author animations;
- leave the loading skeleton unchanged;
- preserve the existing card styling, hover glow, quote icon, and accent bar.

## Architecture

The component remains a single React component. The query behavior remains unchanged: it still refetches a random quote every 8 seconds with `staleTime: 0`.

The visual hierarchy becomes:

- outer static card shell;
- decorative quote icon, hover glow, and accent bar;
- inner animated quote content;
- unchanged skeleton when no quote has loaded.

## Testing

Add a focused static test that reads `QuoteWidget.tsx` and verifies:

- the outer `AnimatePresence mode="wait"` pattern is no longer used around the full card;
- `AnimatePresence initial={false}` wraps the animated quote content;
- the animated content key includes both `quote.text` and `quote.author`;
- the full card class remains on a stable non-keyed wrapper.

Run the focused test, then run the dashboard typecheck.
