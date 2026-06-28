# Landing page rebuild — faithful port of the Claude Design marketing kit

**Date:** 2026-06-27
**Status:** Draft (awaiting review)
**Target file:** `artifacts/trader-dashboard/src/pages/LandingPage.tsx`
**Source design:** `design-ref/landing/` (downloaded from the *TraderLoading Design System* Claude Design project, `ui_kits/landing/`)

## 1. Goal

Replace the current marketing landing page with a faithful port of the full-funnel
design built in Claude Design. The current page has hero + 4 features + pricing + FAQ +
footer; the design adds a floating product mock, an animated stats bar, a 6-card bento
features grid, a "how it works" band, a 3-row product showcase with live mini-visuals,
testimonials, a final CTA band, and a richer footer with sitemap + socials.

Visual language, copy, section order and motion follow the design. Everything else
(routing, auth CTAs, SEO/meta/JSON-LD, i18n, design tokens) follows **existing project
conventions**, not the standalone design kit.

## 2. Section inventory (final page order)

1. **Nav pill** — keep current liquid-glass pill (already passes `LandingPage.liquid-glass-nav.static.test.ts`). Add in-page anchor links (Funzioni/Come funziona/Prezzi/FAQ) + Accedi + Inizia gratis + language `<select>` (kept).
2. **Hero** — pulsing badge, gradient headline ("…non di più."), subtitle, dual CTAs (sign-up / demo→sign-in), trust row (no card / read-only broker / 5 languages), and the floating **Command-Center ProductMock** (window chrome, live session clock+badge, equity sparkline, missions, KPI tiles).
3. **Stats bar** — 4 count-up metrics in a glass panel.
4. **Features (bento)** — 6 cards; the *Diario* card is the 2×2 big card with Edge stat tiles + sparkline.
5. **How it works** — 3 numbered steps.
6. **Showcase** — 3 alternating rows (News AI, Backtest replay, gamified discipline) each with a live mini-visual (news cards, candle replay + BUY/SELL, missions panel).
7. **Testimonials** — 3 rated trader stories.
8. **Pricing** — Free vs Pro (0€ / 7€), "Più scelto" badge.
9. **FAQ** — accordion (keep existing `FAQ_ITEMS` + JSON-LD; can extend copy).
10. **Final CTA** band.
11. **Footer** — brand blurb + 3 sitemap columns + legal/support links + social row.

## 3. Token & styling strategy

- The design's inline styles reference `--tl-fg`, `--tl-fg-muted`, `--tl-font-mono`,
  `--tl-border`, `--tl-bg`, `--tl-ease-out`, `--tl-ease-spring` and keyframes
  `tl-pulse / tl-floaty / tl-float-a|b` + class `.tl-app-bg` / `.tl-draw`. **These do
  not exist in this repo** (only `--tl-border` does) — they belong to Claude Design's
  own `styles.css`.
- Port maps them to the **existing project utilities** the current page already uses:
  `text-foreground`, `text-muted-foreground`, `bg-card`, `border-border`, `bg-primary`,
  `text-primary`, `bg-secondary`, `font-mono`, etc. (all backed by `index.css` tokens:
  `--primary`, `--card`, `--secondary`, `--accent`, `--muted-foreground`, `--background`).
- Decorative colors used as literals in the design (e.g. blue `217 91% 60%`, violet
  `262 83% 65%`, amber `38 92% 50%`, red `0 84% 60%` for P&L/impact semantics) are kept
  as Tailwind arbitrary values / inline hsl where no token exists — consistent with the
  current page already using `from-blue-500/10`, `shadow-[0_0_30px_rgba(34,197,94,…)]`.
- Tailwind-first; small page-local keyframes (float for the mock, pulse) added via the
  existing animation utilities (`animate-pulse`) or a scoped `<style>`/index.css addition
  guarded by `prefers-reduced-motion`.

## 4. Animation strategy

- Reuse **`framer-motion`** (already a dependency, already used on this page) for
  scroll-reveal entrances (`whileInView` + `viewport={{ once: true }}`) — replaces the
  design's custom `Reveal`/IntersectionObserver.
- A small typed **`CountUp`** component (IntersectionObserver + rAF, no new dep) for the
  stats bar.
- Floating product mock + pulse dots via CSS animation; all motion respects
  `prefers-reduced-motion`.

## 5. i18n strategy (the bulk of the work)

- All visible copy routes through `t("landing.*")`. New keys added to **all 5 languages**
  (it/en/es/fr/de) in `lib/i18n.ts`, or `production-copy.static.test.ts` + `pnpm verify`
  fail. Italian is the source; en/es/fr/de are proper translations (not placeholders).
- Reuse existing `landing.*` keys where present (hero badge/title/subtitle/CTAs, pricing,
  FAQ, footer rights/privacy/terms/support, nav).
- New key namespaces: `landing.nav.*` (anchor links), `landing.hero.trust.*`,
  `landing.mock.*`, `landing.stats.*`, `landing.features.*` (6×{title,desc} + big-card stat
  labels + section eyebrow/title/lede), `landing.how.*` (3 steps + eyebrow/title),
  `landing.showcase.*` (3×{eyebrow,title,desc,points[]} + news/visual labels),
  `landing.testimonials.*` (3×{role,text} + eyebrow/title), `landing.cta.*`,
  `landing.footer.cols.*`.
- Allowed-literal technical terms (per the test's allowlist) stay as text: `Win Rate`,
  `P&L`, `Equity`, `XP`, `Live`, `MT4`, `MT5`, `TraderLoading`. Proper nouns (trader
  first names, "Stripe", "FX Blue", ticker `XAU/USD`, timeframes `M15/H1/H4`) stay literal.
- Watch the scanner: never pass a raw literal to a `title`/`aria-label`/`placeholder`
  attribute (use `t()`); avoid `>Italian text<` outside `t()`.

## 6. Test strategy

- **Keep green:** `LandingPage.liquid-glass-nav.static.test.ts` (preserve the nav pill
  class patterns: `rounded-full`, `backdrop-blur-[30px]`, `from-primary/15`,
  `from-blue-500/10`, `bg-[linear-gradient(115deg`, and *not* the old header style) and
  `LandingPage.faq.static.test.ts` (keep `FAQ_ITEMS`, `landing-faq-jsonld`, FAQPage JSON-LD,
  meta/og/twitter logic).
- **i18n completeness** enforced by `production-copy.static.test.ts` (every it key in all
  langs; every `t()` key exists).
- **New (optional) static test** asserting the new sections exist (stats/bento/showcase/
  testimonials/CTA) so the rebuild can't silently regress to the old layout.
- **Gate:** `pnpm verify` (typecheck + tests + build) must pass before commit.

## 6b. Functional behavior — everything interactive must really work

The copy/numbers/testimonials stay as **fake sample content**, but no element may be a
dead decorative mockup. Each interactive piece is wired to actually behave:

- **CTAs** ("Inizia gratis", "Passa a Pro", final CTA, Free/Pro buttons) → real
  `setLocation("/sign-up")`; "Accedi" / "Guarda la demo" → `setLocation("/sign-in")`.
- **Nav anchor links** (Funzioni/Come funziona/Prezzi/FAQ) → real in-page smooth-scroll
  to `#features` / `#how` / `#pricing` / `#faq` (each target gets `id` + `scroll-mt`).
- **Language `<select>`** → real `setLanguage` (kept from current page).
- **Nav pill** → really solidifies on scroll (scroll listener toggling background/shadow).
- **FAQ accordion** → really opens/closes (accessible, keyboard-operable).
- **Stats bar** → count-up really animates when scrolled into view (IntersectionObserver).
- **Scroll-reveal** entrances really fire via framer-motion `whileInView`.
- **ProductMock clock** → a **live ticking clock** (real `Date`, Europe/Rome) and the
  session badge reflects the **actual current market session** — reuse the app's existing
  session/clock logic if one exists (search `services`/`lib`/`components` for session
  helpers, e.g. a `SessionBadge`/`getActiveSession`); fall back to a self-contained
  session calc only if none is reusable. Sparkline/missions/KPI tiles remain illustrative.
- All motion still respects `prefers-reduced-motion` (reduced → no float/pulse, instant
  reveal, no smooth-scroll).

## 7. Out of scope / non-goals

- No new backend, routes, or contract changes — purely the public marketing page.
- Stats/testimonials/showcase **numbers and quotes are illustrative sample content** (as in
  the design); not wired to live data. The *interactivity* around them, however, is real
  (§6b) — only the displayed values are fake.
- No new CSS design-tokens introduced; we consume the existing index.css foundation.
- The standalone `design-ref/landing/` kit is kept as reference only (not imported/built).

## 8. Risks

- **Translation volume** (~100 keys × 5 langs) is the main effort and error surface;
  mitigated by adding keys section-by-section and running the i18n static test often.
- The scanner's heuristic for "visible copy" can flag decorative literals — keep mock/
  showcase micro-labels behind `t()` or the technical-term allowlist.
