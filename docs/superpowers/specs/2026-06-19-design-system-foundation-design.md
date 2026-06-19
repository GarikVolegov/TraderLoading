# Design System Foundation — "Liquid Glass / Neutral Futurism" (Phase 0)

**Date:** 2026-06-19
**Status:** Design — awaiting user review
**Scope:** Foundation only. Surface rollout (landing / app / admin) is later, phased work.

## 1. Goal

Establish a **single, uniform design-system foundation** that all three surfaces
(landing page, logged-in app, admin) consume from one source of truth. The aesthetic is
**futuristic, liquid-glass, with a neutral-but-representative palette** (refined desaturated
jade on a cool graphite glass base), every primitive detailed and tastefully animated.

This phase delivers the **backbone**: tokens, glass material, motion system, refactored core
primitives, a living reference page, and backward-compatible aliasing so the existing 222
components inherit the refreshed look without being touched. It does **not** redesign any
bespoke page — that is the job of later, per-surface phases.

### Success criteria

- One token layer (`src/index.css` `@theme` + `:root`) drives color, surface, glass, radius,
  spacing, and motion for the whole app.
- A documented liquid-glass **material system** (4 tiers) replaces ad-hoc `bg-card/NN backdrop-blur`.
- A documented **motion system** (tokenized easings/durations + a small named vocabulary),
  fully `prefers-reduced-motion`-aware.
- ~10 **core primitives** refactored to consume the tokens/material.
- A `/styleguide` **reference route** renders every token, primitive, state, and motion — the
  single visual source of truth and verification surface.
- Existing class names (`.tl-panel`, `.glass-card`, `.card-hover`, neon-glow, badges, etc.)
  keep working as **aliases** over the new material, so nothing visually regresses or breaks.
- `pnpm verify` stays green (typecheck + existing static tests + build).

### Out of scope (explicitly)

- Bespoke redesign of landing / dashboard / admin pages (later phases).
- **Light mode** — the product is dark-only today; liquid glass reads best on dark. YAGNI now.
- New component *inventions* beyond the core set listed in §6.
- Any `/design-sync` upload to claude.ai/design (optional, much later).

## 2. Design language

Cool **graphite/ink** neutral base. Refined, **desaturated jade** as the single chrome accent
(focus, links, active states, primary CTA). **Trading P&L colors stay functional and vivid**
(win green / loss red / break-even amber) — journal/edge code depends on them; they are not part
of the neutralized chrome.

Surfaces are **liquid glass**: translucent, blurred, with a signature top **light hairline**,
a soft **inner glow**, a subtle **specular gradient**, and optional fine **grain**. Motion is
**calm and physical** — spring-eased lifts, gentle enters, no gratuitous bouncing.

## 3. Token layer

Convention unchanged: HSL channels in `:root`, surfaced via `hsl(var(--x))` and mapped in
`@theme inline`. Values below are the **target**; exact final values are tuned against the
`/styleguide` page during implementation, but must stay within ±a few % of these and pass the
contrast checks in §8.

### 3.1 Neutral ramp (cool graphite)

```
--surface-0  220 24%  5%   /* app background            */
--surface-1  220 18%  9%   /* card / panel              */
--surface-2  220 16% 12%   /* raised: modal/popover     */
--surface-3  220 14% 16%   /* inset / hover fill        */
--border-subtle 220 12% 20%
--border-strong 220 12% 30%
--text-hi    210 20% 96%   /* foreground                */
--text-lo    215 14% 66%   /* muted-foreground          */
--text-faint 215 12% 46%
```

Legacy aliases re-pointed to the ramp so existing utilities cascade automatically:
`--background→surface-0`, `--card/--popover→surface-1/2`, `--secondary/--muted→surface-2/3`,
`--foreground→text-hi`, `--muted-foreground→text-lo`, `--border→border-subtle`,
`--input→border-strong`, plus `--tl-surface-panel`, `--tl-surface-raised`, `--tl-border-strong`.

### 3.2 Accent + semantics

```
--accent-jade        160 34% 48%   /* chrome accent: focus, link, active, primary CTA */
--accent-jade-soft   160 28% 60%   /* hover/secondary accent text                      */
--accent-foreground  220 24%  6%

/* Functional trading semantics — kept vivid, unchanged in spirit */
--success 150 64% 46%   /* win  */
--destructive 0 75% 60% /* loss */
--warning 38 92% 55%    /* break-even */
```

`--primary` and `--ring` re-point to `--accent-jade`. Session colors
(`--session-asian/london/ny/...`) are retained as-is (functional domain colors).

### 3.3 Glass material tokens

```
--glass-blur-bar     16px
--glass-blur-panel   20px
--glass-blur-raised  28px
--glass-blur-inset    8px
--glass-tint         220 18% 10%   /* base fill hue, applied at per-tier alpha */
--glass-border       210 30% 80%   /* hairline color (low alpha)              */
--glass-highlight    210 40% 92%   /* top light line (low alpha)              */
--glass-shadow       0 0% 0%       /* drop shadow base                        */
--glass-glow         160 34% 48%   /* optional accent inner glow (jade)       */
```

### 3.4 Radius, spacing, elevation, motion

- **Radius:** keep `--radius: 0.625rem`; formalize `--radius-sm/md/lg/xl/2xl/pill`.
- **Spacing rhythm:** document the existing 2/3/4 Tailwind scale usage; no new scale.
- **Elevation:** four tiers tied to glass tiers (`--elev-bar/panel/raised/overlay`).
- **Motion tokens:**
  ```
  --ease-glass  cubic-bezier(0.22, 1, 0.36, 1)
  --ease-spring cubic-bezier(0.34, 1.56, 0.64, 1)
  --ease-out    cubic-bezier(0.16, 1, 0.3, 1)
  --dur-fast 120ms  --dur-base 200ms  --dur-slow 360ms  --dur-slower 600ms
  ```

## 4. Liquid-glass material system

Four named tiers, authored once in `@layer components`, consuming §3.3 tokens. Each renders the
signature details: translucent tinted fill, `backdrop-blur`, hairline border, top light line
(via a `::before` 1px gradient), soft inner glow, layered drop shadow. All degrade gracefully
where `backdrop-filter` is unsupported (solid fallback fill).

| Class | Use | Blur | Notes |
|---|---|---|---|
| `glass-bar` | nav, toolbars, sticky headers | 16px | thin, strong top hairline |
| `glass-panel` | cards, widgets (default) | 20px | full signature: hairline + inner glow + shadow |
| `glass-raised` | modals, popovers, dropdowns | 28px | stronger blur + shadow, higher tint alpha |
| `glass-inset` | wells, secondary fills | 8px | recessed, inner top-shadow instead of glow |

Optional modifiers: `glass-grain` (fine noise overlay), `glass-glow-accent` (jade inner glow for
featured cards). **Legacy `.tl-panel`, `.glass-card`, `.card-glow-primary`, `.metric-card`,
`.tl-toolbar`, neon-glow utilities are re-expressed on top of these tiers** so existing markup
upgrades for free.

## 5. Motion system

Tokenized (§3.4) and consolidated into a small, reusable vocabulary. Existing keyframes
(`fade-in-up`, `scale-in`, `float`, `glow-pulse`, `shimmer`, `border-spin`, `marquee`,
`count-up`, `slide-in-right`) are kept but normalized to the motion tokens. Named utilities:

- **Enter:** `animate-fade-in-up`, `animate-scale-in` (one-shot, `--ease-glass`).
- **Hover/press:** `card-hover` (spring lift), global `:active` press (scale 0.97) — already present, retuned.
- **Ambient:** `animate-float`, `animate-glow-pulse`, `animate-border-glow`, `animate-shimmer`.
- **Stagger:** `delay-0…500` helpers (present) for sequenced entrance.

All wrapped by the existing `@media (prefers-reduced-motion: reduce)` guard, which already
neutralizes animation/transition durations globally.

## 6. Core primitives (the uniform, shared layer)

Refactor these `src/components/ui/*` primitives to consume the new tokens/material. Public props
and exported names are preserved (no consumer churn); only internals/classes change.

1. **card.tsx** — default to `glass-panel`; `glass-glow-accent` opt-in; spring `card-hover`.
2. **button.tsx** — variants retuned: `default` (jade), `secondary`, `ghost`, `outline`,
   plus a new `glass` variant (`glass-bar` fill); jade focus ring; press feedback.
3. **surface/panel** — formalize `.tl-panel` as a small `Surface` primitive wrapper (thin).
4. **input.tsx / textarea.tsx** — `glass-inset` well, jade focus ring (align with `.tl-input`).
5. **badge.tsx** — map to the `.badge-*` token families (success/danger/warning/primary/muted).
6. **dialog.tsx / popover.tsx / dropdown-menu.tsx / sheet.tsx** — `glass-raised`, overlay scrim.
7. **tabs.tsx** — jade active indicator, glass track.
8. **tooltip.tsx** — `glass-raised` mini.
9. **separator.tsx / skeleton.tsx** — border-subtle / `animate-shimmer` on surface tokens.

Each refactor must keep its existing `*.static.test.ts` (e.g. `modal.static.test.ts`) passing.

## 7. `/styleguide` living reference

A single route rendering every token swatch, every glass tier, the motion vocabulary, and each
core primitive in all its states. Purpose: source of truth + manual visual verification + the
later seed for `/design-sync`.

- **i18n constraint:** this is a **design-reference surface, not product copy**, so it should be
  exempt from `production-copy.static.test.ts`. Preferred resolution: add the styleguide file path
  to that test's exclusion scope; if the test offers no exclusion mechanism, fall back to wrapping
  labels in `t()`. The plan must inspect the test first and pick the workable option.
  See [[i18n-enforced-new-ui]].
- **Access:** route registered but kept out of primary nav; gate behind dev/admin (decided in plan).

## 8. Testing strategy

- **Contrast unit test:** assert `text-hi`/`text-lo`/`accent-foreground` over `surface-0..3`
  meet WCAG AA (≥4.5 normal / ≥3 large). Computed from the HSL tokens.
- **Token presence test:** assert required CSS vars exist in `index.css` (guards accidental drops).
- **Existing static tests:** all current `*.static.test.ts` (modal, landing liquid-glass-nav,
  production-copy, pro-gates, etc.) must stay green — aliasing makes this achievable.
- **Manual:** `/styleguide` reviewed against the three accent/glass details before sign-off.
- **Gate:** `pnpm verify` (install → codegen → typecheck → test → build).

## 9. Rollout safety & sequencing

1. Land tokens + glass + motion + aliases first → whole app inherits the new look, **zero**
   per-component edits, verify green.
2. Refactor core primitives → still token-driven, verify green.
3. Build `/styleguide` → verify and tune token values visually.
4. (Later phases, separate specs) migrate bespoke landing → app → admin surfaces onto the system.

## 10. Risks

- **`backdrop-filter` performance** on heavy pages (Dashboard) → cap blur tiers, provide solid
  fallback, test on Safari (recent commit history shows Safari-specific fixes).
- **Token drift breaking a `.static.test.ts`** that asserts a specific class/structure → keep
  class names as aliases; run the full static suite after the token swap.
- **Contrast regressions** from desaturation → the §8 contrast test is the guardrail.
