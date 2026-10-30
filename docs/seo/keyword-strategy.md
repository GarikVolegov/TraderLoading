# AUREUS (AUREUS PROTOCOL) — SEO, SEM & GEO Keyword Strategy

> Living reference for the keyword targeting behind `https://aureus-os.app`'s organic,
> paid (SEM), and generative-engine (GEO / AI answer) visibility. Implemented in
> [`src/lib/seo.ts`](../../artifacts/trader-dashboard/src/lib/seo.ts) (URL/hreflang + Knowledge Graph `@graph`),
> [`src/lib/i18n.ts`](../../artifacts/trader-dashboard/src/lib/i18n.ts) (`seo.*` copy keys, 5 languages),
> [`src/lib/semAttribution.ts`](../../artifacts/trader-dashboard/src/lib/semAttribution.ts) (UTM / GCLID / AI Search referrer attribution),
> the dedicated pages in [`src/pages/seo/`](../../artifacts/trader-dashboard/src/pages/seo/),
> [`public/llms.txt`](../../artifacts/trader-dashboard/public/llms.txt) + [`public/llms-full.txt`](../../artifacts/trader-dashboard/public/llms-full.txt),
> and the static head in [`index.html`](../../artifacts/trader-dashboard/index.html).

## Honest expectation

On-page + technical SEO/GEO makes AUREUS (`https://aureus-os.app`) the strongest *possible* candidate and
reliably wins **brand**, **mid/long-tail** and **high-intent** searches plus **AI-engine
citations** (ChatGPT Search, Perplexity, Claude, Gemini, Copilot). It cannot, by code alone, guarantee #1 for raw head terms ("trading", "finanza")
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
Aureus, AUREUS, Aureus Protocol, AUREUS PROTOCOL, Aureus OS, aureus-os.app, Protocollo Aureus,
Aureus trading, Aureus app, La Forgia del Passato, Il Libro della Verità, Il Custode della Soglia,
Le Prove del Fuoco, Limen Protocol, TraderLoading.

### English core
- **trading-journal:** trading journal, automated trading journal, MT4/MT5 trading journal,
  forex trading journal, trade tracking, R-multiple, equity curve, win rate, The Book of Truth.
- **backtest:** backtest, backtesting, chart replay, forex backtesting, backtest trading
  strategy, trading simulator, candle by candle, strategy testing, The Forge of the Past.
- **macro-news:** macro news, macroeconomics, macroeconomic analysis, economic calendar,
  COT report, forex news, market sentiment, financial news, trading analysis, finance.
- **risk-tools:** risk management, position size calculator, lot size calculator, money
  management, Monte Carlo, daily loss limit, risk analysis, The Guardian of the Threshold.
- **landing/pricing:** sovereign trading operating system, Selection Threshold 10€, Operational Tribute 150€.

### Italian (primary market — default fallback locale)
Aureus, Protocollo Aureus, diario di trading, giornale di trading, diario trading automatico,
La Forgia del Passato, backtest, backtest trading, replay grafico, notizie macro, macroeconomia,
analisi macroeconomica, calendario economico, gestione del rischio, calcolatore lotti,
calcolatore position size, disciplina finanziaria, psicologia del trading, dashboard di trading,
analisi trading, **trading**, **finanza**.

### Spanish / French / German (localized equivalents)
- **ES:** Aureus, diario de trading, backtesting, noticias macro, macroeconomía, calendario económico,
  gestión de riesgo, calculadora de lotes, análisis de trading, finanzas.
- **FR:** Aureus, journal de trading, backtest, actus macro, macroéconomie, calendrier économique,
  gestion du risque, calculateur de lot, analyse de trading, finance.
- **DE:** Aureus, Trading-Tagebuch, Handelstagebuch, Backtesting, Makro-News, Makroökonomie,
  Wirtschaftskalender, Risikomanagement, Positionsgrößenrechner, Trading-Analyse, Finanzen.

### Long-tail / question (GEO — feeds AI answers + FAQ schema)
"cos'è Aureus Protocol", "come tenere un diario di trading", "miglior software di backtest forex",
"come calcolare la size della posizione", "cos'è l'R-multiple", "how to backtest a trading strategy",
"best forex macro news aggregator", "how to calculate position size",
"how does MT4/MT5 read-only account sync work".

## On-page conventions (applied)

- **Titles:** `Primary keyword — secondary | AUREUS` (≤ ~65 chars). One `<h1>` per page
  with the Dual-Keyword Architecture (AUREUS Lore + High-Volume Search Term); `<h2>`/`<h3>` for sections.
- **Descriptions:** 1–2 sentences, primary + secondary keywords + AUREUS entity.
- **Keywords meta:** per-page `seo.<page>.meta.keywords` (low Google weight; some engines/GEO read it).
- **Structured data (JSON-LD):** site-wide 4-node `@graph` (`Organization` + `WebSite` + `SoftwareApplication` + `DefinedTermSet`
  in `index.html` and `aureusKnowledgeGraphJsonLd`); per page `BreadcrumbList`, `FAQPage` (topic + pricing), `SoftwareApplication`
  (topics) / `Product` with 0€ / 10€ / 150€ offers (pricing).
- **GEO:** `public/llms.txt` and `public/llms-full.txt` document the full AUREUS encyclopedic corpus; `robots.txt` explicitly welcomes 18 AI/search crawlers (`GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`, `Google-Extended`, `Applebot-Extended`, `Bingbot`, `DuckAssistBot`, `Meta-ExternalAgent`, `YouBot`, `Cohere-ai`).
- **Prerendering:** `scripts/prerender.ts` snapshots each route × language to static HTML so
  non-JS crawlers see full content (best-effort; never breaks the build).

## Off-site / operational checklist (NOT in the repo — required for head terms)

- [x] Confirm the production static server serves prerendered `<route>/index.html` directly
      (no redirect hop) — `artifacts/api-server/src/lib/staticSnapshot.ts` resolves the snapshot and
      `serveFrontendApp` sends it directly, before `express.static`'s redirect-then-serve default.
- [ ] Verify domain in **Google Search Console** + **Bing Webmaster Tools**; submit
      `https://aureus-os.app/sitemap.xml`; request indexing for the landing + topic pages.
      Concrete runbook:
      1. **Google Search Console**: at https://search.google.com/search-console, add property
         `aureus-os.app` (Domain property, or URL-prefix `https://aureus-os.app/`). Verify
         via DNS TXT or the **HTML file** method (`artifacts/trader-dashboard/public/`). Once verified: Sitemaps →
         submit `https://aureus-os.app/sitemap.xml`; then URL Inspection → request indexing for
         `/`, `/it`, `/trading-journal`, `/backtesting`, `/guide`, `/pricing`, `/about`.
      2. **Bing Webmaster Tools**: at https://www.bing.com/webmasters, import verified GSC site directly
         (Bing powers ChatGPT Search and Microsoft Copilot web search, feeding GEO directly) and enable IndexNow.
      3. **Confirm crawlability post-deploy**:
         `curl -sI https://aureus-os.app/about` — expect `HTTP/1.1 200` with no redirect, and
         `curl -s https://aureus-os.app/about | grep -c '<h1'` — expect `1`.
- [ ] Set **GA4**: create a GA4 property, copy the Measurement ID (`G-XXXXXXX`), set it as
      `VITE_GA_MEASUREMENT_ID` in the deployment environment variables, and redeploy.
- [ ] Create + consistently link official social profiles (X, Instagram, YouTube, Discord) and add them
      to `Organization.sameAs` in `src/lib/seo.ts` and `index.html`.
- [ ] Earn authoritative citations & backlinks: Product Hunt, Trustpilot (`aureus-os.app`), Crunchbase, G2, AlternativeTo, Reddit (`r/Forex`, `r/Daytrading`, `r/ItaliaPersonalFinance`), TradingView ideas.
