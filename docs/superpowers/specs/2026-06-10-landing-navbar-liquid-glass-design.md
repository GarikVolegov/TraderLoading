# Landing Navbar Liquid Glass Design

## Goal

Turn the public landing page header into a floating liquid-glass pill while preserving the existing navigation behavior, localization, and sign-in/sign-up actions.

## Selected Direction

Use the visual option 2, "Neon liquid":

- A centered, floating, rounded pill instead of a full-width bordered bar.
- Dark translucent glass with strong backdrop blur.
- Subtle green/blue liquid tint and a fine luminous border.
- A diagonal shine layer inside the pill for a liquid reflection effect.
- The primary "Empezar" action remains visually dominant.

## Scope

Change only the landing page navbar in `artifacts/trader-dashboard/src/pages/LandingPage.tsx`.

Keep:

- Current logo, nav labels, language selector, and route targets.
- Desktop and mobile responsive behavior.
- Existing i18n keys and language dropdown behavior.

## Validation

Run the dashboard typecheck after the change. If practical, inspect the page locally to confirm the pill floats cleanly and text remains readable on narrow and wide screens.
