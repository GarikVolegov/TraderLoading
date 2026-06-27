# Landing UI Kit

Faithful recreation of the **TraderLoading** public marketing site.

## Sections
- **Nav** — sticky translucent gradient-bordered pill; solidifies on scroll.
- **Hero** — pulsing badge, gradient headline ("non di più"), dual CTAs, trust row, and a floating live **Command Center product mock** (clock, session badge, equity spark, missions, KPIs).
- **Stats bar** — animated count-up metrics.
- **Features** — bento grid (Diario big card w/ Edge stats + spark, News AI, Risk tools, Backtest, Zen, Community).
- **How it works** — three numbered steps.
- **Showcase** — alternating product highlights with live mini-visuals (news cards, candle replay + BUY/SELL, gamified missions).
- **Testimonials** — three rated trader stories.
- **Pricing** — Free vs Pro (7€), "Più scelto".
- **FAQ** — accordion. **Final CTA** band. **Footer** with sitemap + socials.

## Motion
Scroll-reveal entrances (IntersectionObserver; above-the-fold reveals immediately), animated background (drifting aurora + blurred colour orbs), floating product mock, count-up stats, hover lift/glow on cards, smooth-scroll anchors. All respect `prefers-reduced-motion`.

> Note: the static-preview/screenshot tooling re-renders the DOM and can show a blank frame while the live transitions/animations are running — open it in a real browser to see the full animated page.

## Files
- `index.html` — entry point + page-local keyframes (float/aurora) and hover CSS.
- `landing-ui.jsx` — `Icon`, `Reveal`, `CountUp`, `Orbs`, `NavPill`, `ProductMock`.
- `landing.jsx` — all sections + page assembly.
