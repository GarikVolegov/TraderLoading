# TraderLoading — SEO & GEO keyword strategy

> Living reference for the keyword targeting behind TraderLoading.com's organic
> and generative-engine (AI answer) visibility. Implemented in
> [`src/lib/seo.ts`](../../artifacts/trader-dashboard/src/lib/seo.ts) (URL/hreflang),
> [`src/lib/i18n.ts`](../../artifacts/trader-dashboard/src/lib/i18n.ts) (`seo.*` copy keys, 5 languages),
> the dedicated pages in [`src/pages/seo/`](../../artifacts/trader-dashboard/src/pages/seo/),
> and the static head in [`index.html`](../../artifacts/trader-dashboard/index.html).

## Honest expectation

On-page + technical SEO/GEO makes TraderLoading the strongest *possible* candidate and
reliably wins **brand**, **mid/long-tail** and **high-intent** searches plus **AI-engine
citations**. It cannot, by code alone, guarantee #1 for raw head terms ("trading", "finanza")
— those are won with off-site authority (backlinks, domain age, traffic), see the checklist at
the end. Everything controllable in the repo is covered here.

## URL & language scheme

- English is served at the **root** and is the `x-default`.
- Other languages use a `/{lang}` prefix: `/it`, `/es`, `/fr`, `/de`.
- Each topic/marketing page has a **localized slug**, prefixed for non-English
  (English slugs avoid colliding with the authenticated app routes, e.g. the app owns
  `/backtest`, so the English page is `/backtesting`).
- Every page emits `canonical` + full `hreflang` (5 languages + `x-default`) via the
  [`<Seo>`](../../artifacts/trader-dashboard/src/components/Seo.tsx) component, and is listed
  in the multilingual `sitemap.xml`.

| Page (key) | EN | IT | ES | FR | DE |
|---|---|---|---|---|---|
| landing | `/` | `/it` | `/es` | `/fr` | `/de` |
| trading-journal | `/trading-journal` | `/it/diario-trading` | `/es/diario-de-trading` | `/fr/journal-de-trading` | `/de/trading-tagebuch` |
| backtest | `/backtesting` | `/it/backtest` | `/es/backtesting` | `/fr/backtest` | `/de/backtesting` |
| macro-news | `/macro-news` | `/it/notizie-macro` | `/es/noticias-macro` | `/fr/actualites-macro` | `/de/makro-news` |
| risk-tools | `/risk-management` | `/it/gestione-rischio` | `/es/gestion-riesgo` | `/fr/gestion-risque` | `/de/risikomanagement` |
| pricing | `/pricing` | `/it/prezzi` | `/es/precios` | `/fr/tarifs` | `/de/preise` |
| guide | `/guide` | `/it/guida` | `/es/guia` | `/fr/guide` | `/de/anleitung` |
| about | `/about` | `/it/chi-siamo` | `/es/sobre-nosotros` | `/fr/a-propos` | `/de/ueber-uns` |
| contact | `/contact` | `/it/contatti` | `/es/contacto` | `/fr/contact` | `/de/kontakt` |

## Keyword clusters → page mapping

### Brand (all pages, esp. landing) — own these outright
TraderLoading, trader loading, traderloading, traderloading.com, traderloading app,
traderloading login, trader loading app.

### English core
- **trading-journal:** trading journal, automated trading journal, MT4/MT5 trading journal,
  forex trading journal, trade tracking, R-multiple, equity curve, win rate.
- **backtest:** backtest, backtesting, chart replay, forex backtesting, backtest trading
  strategy, trading simulator, candle by candle, strategy testing.
- **macro-news:** macro news, macroeconomics, macroeconomic analysis, economic calendar,
  forex news, market sentiment, financial news, trading analysis, finance.
- **risk-tools:** risk management, position size calculator, lot size calculator, money
  management, Monte Carlo, daily loss limit, risk analysis.
- **landing/pricing:** all-in-one trading workspace, free trading app, trading dashboard.

### Italian (primary market — default fallback locale)
diario di trading, giornale di trading, diario trading automatico, backtest, backtest trading,
replay grafico, notizie macro, macroeconomia, analisi macroeconomica, calendario economico,
gestione del rischio, calcolatore lotti, calcolatore position size, disciplina di trading,
psicologia del trading, dashboard di trading, analisi trading, **trading**, **finanza**.

### Spanish / French / German (localized equivalents)
- **ES:** diario de trading, backtesting, noticias macro, macroeconomía, calendario económico,
  gestión de riesgo, calculadora de lotes, análisis de trading, finanzas.
- **FR:** journal de trading, backtest, actus macro, macroéconomie, calendrier économique,
  gestion du risque, calculateur de lot, analyse de trading, finance.
- **DE:** Trading-Tagebuch, Handelstagebuch, Backtesting, Makro-News, Makroökonomie,
  Wirtschaftskalender, Risikomanagement, Positionsgrößenrechner, Trading-Analyse, Finanzen.

### Long-tail / question (GEO — feeds AI answers + FAQ schema)
"come tenere un diario di trading", "miglior software di backtest forex", "come calcolare la
size della posizione", "cos'è l'R-multiple", "how to backtest a trading strategy",
"best forex macro news aggregator", "how to calculate position size",
"how does FX Blue account sync work".

## On-page conventions (applied)

- **Titles:** `Primary keyword — secondary | TraderLoading` (≤ ~60 chars). One `<h1>` per page
  with the primary keyword; `<h2>`/`<h3>` for sections.
- **Descriptions:** 1–2 sentences, primary + secondary keywords, ends with "Free"/"Start free".
- **Keywords meta:** per-page `seo.<page>.meta.keywords` (low Google weight; some engines/GEO read it).
- **Structured data (JSON-LD):** site-wide `WebApplication` + `Organization` + `WebSite`
  (in `index.html`); per page `BreadcrumbList`, `FAQPage` (topic + pricing), `SoftwareApplication`
  (topics) / `Product` with Free+Pro offers (pricing).
- **GEO:** `public/llms.txt` lists every page + facts; `robots.txt` explicitly welcomes GPTBot,
  OAI-SearchBot, PerplexityBot, ClaudeBot, Google-Extended, Applebot-Extended, Bingbot.
- **Prerendering:** `scripts/prerender.ts` snapshots each route × language to static HTML so
  non-JS crawlers see full content (best-effort; never breaks the build).

## Off-site / operational checklist (NOT in the repo — required for head terms)

- [x] Confirm the production static server serves prerendered `<route>/index.html` directly
      (no redirect hop) — done in the Phase 1 SEO/GEO technical hardening
      (`docs/superpowers/specs/2026-07-10-seo-geo-technical-hardening-design.md`):
      `artifacts/api-server/src/lib/staticSnapshot.ts` resolves the snapshot and
      `serveFrontendApp` sends it directly, before `express.static`'s redirect-then-serve default.
- [ ] Verify domain in **Google Search Console** + **Bing Webmaster Tools**; submit
      `https://traderloading.com/sitemap.xml`; request indexing for the landing + topic pages.
      These are user-executed steps (require owning the Google/Bing accounts); nothing here can
      be automated from the repo. Concrete runbook:
      1. **Google Search Console**: at https://search.google.com/search-console, add property
         `traderloading.com` (Domain property, or URL-prefix `https://traderloading.com/`). Verify
         via the **HTML file** method: download the `google<code>.html` file GSC gives you and drop
         it directly into `artifacts/trader-dashboard/public/` (it's served as a static file with no
         code change) — commit and deploy, then click "Verify" in GSC. Once verified: Sitemaps →
         submit `https://traderloading.com/sitemap.xml`; then URL Inspection → request indexing for
         `/`, `/it`, `/trading-journal`, `/backtesting`, `/guide` (the highest-intent pages) so
         Google crawls them proactively instead of waiting for organic discovery.
      2. **Bing Webmaster Tools**: at https://www.bing.com/webmasters, same flow (Bing also serves
         ChatGPT/Copilot's web search, so this feeds GEO too). Bing supports **importing verified
         GSC sites directly** — use that instead of a second manual verification.
      3. **Confirm crawlability post-deploy**: after the Phase 1 code changes ship,
         `curl -sI https://traderloading.com/about` — expect `HTTP/1.1 200` with no redirect, and
         `curl -s https://traderloading.com/about | grep -c '<h1'` — expect `1` (confirms the
         prerendered snapshot, not the empty SPA shell, is what's served).
- [ ] Set **GA4**: create a GA4 property, copy the Measurement ID (`G-XXXXXXX`), set it as
      `VITE_GA_MEASUREMENT_ID` in the Railway service variables (it's a `[BUILD]`-time var — see
      `.env.railway.example`), redeploy. Already wired to no-op safely without it
      (`src/lib/analytics.ts`) and to respect cookie consent once set.
- [ ] Create + consistently link official social profiles (X, Instagram, YouTube) and add them
      to the `Organization.sameAs` array in `index.html` once URLs are real.
- [ ] Earn backlinks: Product Hunt launch, trading communities/forums, broker/affiliate
      directories, guest posts, comparison articles.
- [ ] Add real `AggregateRating` JSON-LD only once backed by genuine, verifiable reviews.
- [ ] Optional next pages to populate for more long-tail coverage: a real blog, a status page,
      and per-broker / per-pair landing pages (Phase 2 — see
      `docs/superpowers/specs/2026-07-10-seo-geo-technical-hardening-design.md` for the Phase 1
      this builds on).
