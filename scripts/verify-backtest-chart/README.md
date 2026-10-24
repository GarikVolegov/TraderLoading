# Isolated backtest chart browser verification

Run from the repository root:

```sh
node scripts/verify-backtest-chart/browser.mjs
```

Requires the installed workspace dependencies, Playwright from `scripts`, and Puppeteer's Chrome from the dashboard. Starts a standalone Vite server on **127.0.0.1:5188**, uses the production chart, settings, drawing workspace, favorites toolbar and preference synchronization hook. Authentication and the preferences endpoint are disposable fixtures; no application database, actual account or existing development server is touched.

The endpoint fixture implements per-account revision checks and an optional slow PUT. Two separate browser contexts simulate devices. Tests cover account isolation, reload, offline retries, both conflict choices, editing during save, favorites persistence/reordering, all drawing families, handle gestures and undo/redo, settings modal shortcut isolation, appearance controls and templates, and desktop/mobile overflow. Screenshots and JSON report are written to `/tmp/traderloadings-chart-qa` (override with `CHART_QA_OUTPUT`).

The stateful engine supplies deterministic candles, empty trading state, and production drawing settings; trade execution and real market-data fetching are deliberately outside this harness. Network tests exercise the real frontend hook against an in-memory compare-and-swap endpoint, not the backend database adapter.
