# Command Center Pro UI/UX Design

## Goal

Refine TraderLoadings into a polished, responsive trading command center across mobile and desktop. The result should improve visual consistency, information hierarchy, touch ergonomics, accessibility, and perceived product quality without changing backend behavior or core feature scope.

## Approved Direction

The approved direction is **Command Center Pro with coach accents**.

TraderLoadings should feel first like an operational workstation for traders: dark, dense, precise, fast to scan, and trustworthy during live decision-making. Motivational, gamified, and wellness features remain part of the product, but they should read as disciplined support layers rather than the dominant visual identity.

## Product Principles

- Desktop prioritizes operational density, fast scanning, and multi-panel workflows.
- Mobile prioritizes quick checks, safe touch interactions, and clear task completion.
- Trading, broker, news, tools, checklist, and calendar surfaces should feel precise and professional.
- Missions, routine, milestones, and zen surfaces may be warmer, but must still share the global design system.
- Global components should carry most of the visual upgrade so individual pages do not drift into unrelated styles.

## Visual System

### Color

Use a dark fintech palette:

- Background: near-black navy, approximately `#020617`.
- Main surfaces: deep slate panels, approximately `#0E1223` and `#1A1E2F`.
- Borders and dividers: slate blue, approximately `#334155`, tuned per opacity.
- Foreground: high-contrast near-white, approximately `#F8FAFC`.
- Muted text: accessible slate, approximately `#94A3B8`.
- Primary accent: operational green, approximately `#22C55E`.
- Destructive: clear red, approximately `#EF4444`.
- Warning: amber only for real caution states.

Green should indicate primary action, positive trading state, availability, progress, or confirmation. Red and amber should be reserved for semantic risk, failure, loss, or caution.

### Typography

Move toward a more technical type system:

- Use **Fira Sans** or an equivalent clean sans for body UI, descriptions, forms, and navigation.
- Use **Fira Code** or an equivalent mono for symbols, pairs, prices, metrics, timestamps, and compact operational labels.
- Keep body text at or above 16px on mobile where users type or read paragraphs.
- Use tabular numerals for metrics and financial values.
- Avoid oversized hero-scale type inside dashboards, panels, cards, sidebars, and compact tool surfaces.

### Shape, Elevation, and Texture

- Reduce overly soft radius values across core application UI.
- Default panel radius should land around 8-12px; modal and sheet radius may reach 16px.
- Avoid decorative orb/blob backgrounds.
- Use subtle borders, restrained elevation, and purposeful blur only where it separates fixed chrome, modals, or overlays.
- Cards should represent individual repeated items or framed tools, not entire page sections nested inside other cards.

### Motion

- Keep micro-interactions in the 150-300ms range.
- Use transform and opacity for animated state changes.
- Respect `prefers-reduced-motion`.
- Press, hover, selected, expanded, loading, success, and disabled states should feel consistent and should not shift layout bounds.
- Page transitions should remain light and non-blocking.

## Desktop UX

Desktop should behave like a trading workstation.

- Keep the compact icon-first sidebar as the primary desktop navigation.
- Keep the top ticker/status bar compact and readable.
- Use wide desktop content constraints consistently.
- Prefer dense, structured grids over masonry where predictability matters.
- Dashboard priority should emphasize session status, broker/account state, market news, checklist, calendar, and routine.
- Tools, broker, news, and analytics pages should use scan-friendly tables, panels, tabs, and toolbars rather than decorative marketing cards.
- Empty, loading, error, and disconnected states should always provide a next action.

## Mobile UX

Mobile should be a quick-control console, not a squeezed desktop.

- Maintain a bottom navigation with no more than five primary items.
- Preserve safe-area spacing above fixed bottom navigation and below fixed top chrome.
- Ensure all primary touch targets are at least 44px by 44px with at least 8px spacing where controls are adjacent.
- Use vertical scrolling as the main gesture and avoid horizontal swipe requirements for critical actions.
- Convert wide tables into card-like rows or place them in deliberate `overflow-x-auto` containers.
- Put secondary controls into menus, drawers, or sheets when they would crowd the main screen.
- Make primary actions visible and easy to reach, especially in broker connection, checklist, tools, and chat workflows.

## Component Scope

The redesign should start with shared foundations before page-specific polish:

- Global CSS tokens and utility classes.
- `PageLayout` and `PageHeader`.
- Desktop sidebar and mobile bottom navigation.
- Top ticker/header chrome.
- `Card`, `Button`, form controls, badges, tabs, dialogs, sheets, tables, skeletons, and empty states.
- Common metric, toolbar, and status panel patterns.

Shared components should define the design language so pages inherit consistency naturally.

## Page Priorities

### Dashboard

Preserve existing widget behavior, visibility controls, drag-and-drop, and widget routes. Improve hierarchy, density, panel rhythm, hover affordances, and mobile stacking.

### Broker

Make account connection, diagnostics, profiles, positions, history, and trading controls feel trustworthy and operational. Forms must have clear labels, helper text, loading feedback, and recovery paths.

### Tools

Make calculators, sentiment, volatility, COT, and related trading utilities easier to scan. Use tabs, segmented controls, compact metric panels, and accessible table/card layouts.

### News

Prioritize source, freshness, relevance, pair impact, and readable summaries. Avoid color-only meaning for importance or sentiment.

### Chat and Brain

Use a focused workspace layout with clear input hierarchy, readable messages, stable loading states, and strong mobile ergonomics.

### Calendar, Checklist, Routine, Missions, Milestones, Zen

Keep these warmer and more motivational, but apply the same token system, spacing rhythm, touch targets, and accessibility rules.

### Landing and Auth

Landing may be more cinematic than the app shell, but should still show the actual product value clearly. Auth screens should align with the refined dark command center palette and component rhythm.

## Accessibility Requirements

- Maintain visible focus states across keyboard navigation.
- Add or preserve `aria-label` for icon-only controls.
- Ensure foreground/background text contrast meets WCAG AA where practical.
- Do not use color as the only indicator of state.
- Use semantic form labels and clear inline errors.
- Keep disabled controls semantically disabled and visually distinct.
- Respect reduced motion.

## Performance and Stability Requirements

- Avoid layout shifts from hover, press, loading, or async content.
- Reserve space for images, charts, skeletons, and fixed chrome.
- Avoid excessive blur and shadow layering on dense pages.
- Keep page transitions and component animations interruptible and lightweight.
- Do not introduce new heavy visual dependencies unless the existing stack cannot support the design.

## Implementation Boundaries

The redesign should not:

- Change backend APIs or data contracts.
- Remove existing user workflows.
- Revert unrelated work currently present in the worktree.
- Replace established Radix/shadcn-style primitives without a clear need.
- Introduce a separate design system package unless local shared components become insufficient.

## Verification Plan

Required verification after implementation:

- `pnpm --filter @workspace/trader-dashboard run typecheck`
- `pnpm --filter @workspace/trader-dashboard run build`
- Targeted tests for any changed behavior.
- Browser verification at mobile and desktop widths, including approximately 375px, 768px, 1024px, and 1440px.
- Visual checks for no horizontal mobile scroll, no incoherent overlap, readable text, visible focus states, stable fixed navigation offsets, and working reduced-motion behavior.

## Self-Review

- No placeholders remain.
- The approved visual direction is explicit.
- Scope covers both mobile and desktop.
- Scope starts with shared UI foundations and then page-level polish.
- Accessibility, performance, and verification requirements are concrete.
- Backend and unrelated worktree changes are explicitly out of scope.
