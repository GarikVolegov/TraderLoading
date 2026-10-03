# Watchlist → Claude Design sparkline rows (daily) — implementation plan

> Spec: [2026-07-03-watchlist-claude-design-daily-design.md](../specs/2026-07-03-watchlist-claude-design-daily-design.md)
> Branch: `feat/community-management` (shared, multi-agent → commit with **pathspec only**).
> Gate per task: targeted tests; final: `pnpm typecheck` + `pnpm test` + frontend build
> (`ALLOW_MISSING_CLERK_KEY=1`). TDD: write/adjust the test first, watch it fail, implement.

## Task 1 — backend pure service `services/watchlistQuotes.ts` (+ unit test)

**Files:** new `artifacts/api-server/src/services/watchlistQuotes.ts`,
new `artifacts/api-server/src/services/watchlistQuotes.test.ts` (node assert style,
mirror `volatility.test.ts`).

- `WATCHLIST_MAX_PAIRS = 12`, `WATCHLIST_SPARK_POINTS = 30`.
- `parseWatchlistPairsParam(raw: unknown, supported: (s: string) => boolean)` →
  `{ pairs: string[] }`: split on `,`, trim, uppercase, strip `/`, drop empties,
  dedupe preserving order, cap at 12. Returns all pairs (supported or not).
- `buildWatchlistItem(pair, candles | null, supported)` → item per spec §2:
  last ≤30 closes oldest→newest, `price` = last close, `changePct` from last two
  closes (null when <2 bars), `time` = last bar time, nulls/`[]` when no data.
- Types: `WatchlistItem`, `WatchlistResponse`.

Test cases: parsing (lowercase, `eur/usd`, dupes, >12 cap, junk), item building
(normal, 1 bar → changePct null, 0 bars → nulls, >30 bars → windowed, flat series).

**Commit:** `feat(api): pure watchlist-quotes helpers (parse + item building)`

## Task 2 — route `GET /tools/watchlist` in `routes/tools.ts`

**Files:** modify `artifacts/api-server/src/routes/tools.ts`.

New section after volatility, reusing its SWR pattern with own state:
`WATCHLIST_FRESH_TTL_SECONDS = 120`, `WATCHLIST_STALE_TTL_SECONDS = 7d`,
fresh/stale keys `watchlist:v1:<pair>` / `watchlist:stale:v1:<pair>`, in-memory
last-good map, per-pair in-flight dedupe, warm concurrency cap 3 (own small
slot helpers, same shape as volatility's). Refresh = `getCandles(pair, "D1")` →
`buildWatchlistItem`. Handler: parse pairs (400 on none valid), for each pair
fresh→lastGood→stale→null-item (and `ensureWarm` when not fresh); always 200
with `{ items }` in request order.

**Commit:** `feat(api): /tools/watchlist SWR endpoint over the D1 candle chain`

## Task 3 — frontend pure helpers (+ test)

**Files:** modify `artifacts/trader-dashboard/src/components/tradingViewWatchlist.ts`,
`tradingViewWatchlist.test.ts`.

- Remove `TRADING_VIEW_MINI_SYMBOL_SCRIPT`, `TradingViewMiniSymbolConfig`,
  `buildTradingViewMiniSymbolConfig` (component import updated in Task 4;
  run the frontend test file to confirm no other consumer).
- Add `formatWatchlistPrice(pair: string, price: number): string` — decimals by
  pair-catalog category: JPY-quoted 3, metal 2, index 1, crypto 2 (0 if ≥1000),
  default 5. Uses `getPairEntry`; unknown pair → 5 (forex-shaped default).
- Add `WatchlistItem`/`WatchlistResponse` client types (mirror server shape).

Test first: drop embed asserts, add format cases (EURUSD 1.08423→"1.08423",
USDJPY 3, XAUUSD 2, US30 1, BTCUSD ≥1000→0 decimals, ETHUSD <1000→2).

**Commit:** `feat(ui): watchlist price formatting + client types, drop embed config`

## Task 4 — component rewrite (+ static test) + i18n keys

**Files:** modify `artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.tsx`,
rewrite `TradingViewWatchlistWidget.static.test.ts`, add keys to all 5
`lib/i18n/dict.*.ts`.

- Static test first (spec §4 assertions), then rewrite the component body per
  spec §3 (useQuery + apiFetch, kit rows with `Sparkline`, whole-row `<a>` deep
  link, skeleton/unsupported/error states, chrome untouched).
- Replace `auto.ui.eda58f52bd` usage with new `tradingview.watchlist.error`;
  add `tradingview.watchlist.daily`. All 5 languages, clean accents (mojibake test).
- Keep: `useBackground`/`selectedPairs`/`resolveWatchlistPairs`,
  `mapCatalogPairToTradingViewSymbol`, `buildTradingViewDeepLink`, isMobile
  target logic, settings gear, live badge, `WidgetHeader` chrome.

**Commit:** `feat(ui): watchlist rows onto Claude Design daily sparklines (no more TradingView iframes)`

## Task 5 — gate + docs + push

- `pnpm typecheck`; `pnpm test`; frontend build with `ALLOW_MISSING_CLERK_KEY=1`.
- Update CLAUDE.md §6/§7 (watchlist now native Claude Design rows on
  `/tools/watchlist`) and the session memory.
- Push (`git push`), verify with `git show --stat HEAD` (multi-agent branch:
  expect HEAD to move under you; never `git add -A`).

**Commit:** `docs(claude): watchlist native Claude Design rows + /tools/watchlist`
