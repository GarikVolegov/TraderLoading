# Watchlist Realtime → righe sparkline Claude Design (mini grafico daily) — design

> Status: approved to proceed (user: "risolvi/procedi", 2026-07-03). Branch: `feat/community-management`.
> Scope: `artifacts/trader-dashboard` + one small off-contract endpoint in `artifacts/api-server`.

## 1. Goal

Replace the TradingView mini-symbol-overview **iframes** inside the dashboard
"Watchlist Realtime" card with the Claude Design kit's **sparkline-row pattern**,
rendered natively by our design system, with the mini chart on **daily (D1)** data:

```
[ EURUSD          ~~~/\~~/‾‾   1.08423  +0.23% ]
[ GBPUSD          ~\_/~~\_     1.27011  −0.11% ]
[ XAUUSD          __/‾‾\/‾     2 329.4  +0.58% ]
```

Row = pair label · daily sparkline (last ~30 D1 closes) · price · daily change %
(success/destructive by sign). The card chrome (glass Card, `WidgetHeader`, pulsing
"Live" badge, gear → `/settings?section=pairs`) is already on the design system and
stays. The card keeps growing with the number of pairs (no scroll cap).

### Why now

The 2026-06-28 "dashboard widgets design refresh" deliberately kept the TradingView
embed and only aligned the chrome (spec §2 note: the kit's `WatchlistWidget`
sparkline rows "may inform a future fallback only"). The user now asks for full kit
parity ("identico a Claude Design, con il mini grafico in daily"), which an iframe
can never deliver (TradingView's own fonts/colors/layout, intraday `dateRange: "1D"`).

### Design reference

The kit source (`ui_kits/dashboard/widgets.jsx`, Claude Design project
`831a2631-e58c-4c3a-97f8-0c05dedb57e0`) is not reachable in this session (DesignSync
login unavailable). Reconstruction is from in-repo kit ports: the tokenized
`components/ui/Sparkline.tsx` primitive (built to replace the kit's inline sparkline
SVG), the kit row idioms already ported (Routine/BrokerHub/COT), and the refresh
spec's token mapping. When a DesignSync login is available, diff against the kit file
and true up.

## 2. Data — new off-contract endpoint `GET /api/tools/watchlist`

No frontend price/candle source exists once the embeds go (repo "quotes" are
motivational quotes). One batched request serves the whole widget:

```
GET /api/tools/watchlist?pairs=EURUSD,GBPUSD,XAUUSD
200 {
  "items": [
    { "pair": "EURUSD", "price": 1.08423, "changePct": 0.23,
      "spark": [1.081, …, 1.08423],        // last ≤30 D1 closes, oldest→newest
      "time": 1751500800,                   // epoch s of the last bar
      "supported": true },
    { "pair": "USDNOK", "price": null, "changePct": null, "spark": [],
      "time": null, "supported": false }
  ]
}
```

- **Source**: the shared candle chain `getCandles(pair, "D1")`
  (Binance / TwelveData / Dukascopy ahead of Yahoo — Railway-safe).
- **Semantics**: `price` = close of the last D1 bar (the developing daily candle
  when the source provides it); `changePct` = (last close − previous close) /
  previous close × 100; `spark` = last ≤30 closes.
- **SWR caching, volatility-style**: per-pair fresh key (TTL **120 s**) + stale key
  (7 d) via `lib/cache` + in-memory last-good; request never blocks on a slow
  source — cache miss returns the item with `price: null` (client keeps skeleton)
  and kicks a deduped, concurrency-capped (3) background refresh.
- **Validation**: pairs uppercased, `/` stripped, deduped, capped at **12**;
  membership in `SUPPORTED_SYMBOLS` (candle chain) decides `supported`.
- **Off-contract** (direct `apiFetch`, not in openapi.yaml) like tornei/recaps —
  no codegen. Route lives in `routes/tools.ts` (section alongside volatility);
  pure logic in a new `services/watchlistQuotes.ts` (unit-tested).

### Freshness honesty

`getCandles` caches latest-window D1 for 6 h, so FX/metal prices can lag up to
~6 h even though the endpoint re-reads every 2 min (crypto refreshes when its
cache rolls too). That equals the volatility widget's freshness and is acceptable
for a daily-change watchlist v1. The "Live" badge stays (kit chrome, and the widget
does auto-refresh); a real live-price overlay (TwelveData `/price` batch, Binance
ticker) is explicitly **future work** and slots into the same response shape.
With `CANDLE_WAREHOUSE` enabled, latest-window cache drops to 60 s and freshness
improves for free.

## 3. Frontend — `TradingViewWatchlistWidget.tsx` body rewrite

Component/file/registry names stay (`tradingview-watchlist`, label "Watchlist
Realtime") — the tap-through still targets TradingView, and renaming would churn
the shared multi-agent branch.

- **Fetch**: single React Query `useQuery` on
  `/api/tools/watchlist?pairs=…` (`apiFetch`), `refetchInterval` 120 s,
  `staleTime` 110 s, previous data kept while refetching. Pairs still come from
  `resolveWatchlistPairs(selectedPairs)` (favorites, else defaults — never empty).
- **Row (kit sparkline-row)**: one `<a>` per pair (whole row is the deep link —
  replaces the current absolute-overlay hack; keeps `isMobile ? "_self" : "_blank"`,
  `rel`, `aria-label` via `tradingview.watchlist.open_aria`):
  `flex items-center gap-3 rounded-md border border-border/35 bg-background/25
  px-3 py-2 hover:border-primary/40` + focus ring. Content:
  - left: pair label (`text-sm font-bold tracking-tight`) over a muted
    `text-[10px] uppercase` "Daily" caption (new i18n key);
  - middle: `<Sparkline data={spark} tone={sign}>` stretched `flex-1 h-7`
    (tone: `success`/`destructive` by change sign, `primary` when flat);
  - right, text-right: price (`text-sm font-semibold tabular-nums`, formatted
    per pair) over change % (`text-[11px] font-semibold tabular-nums`,
    `text-success`/`text-destructive`, signed, 2 decimals).
- **Price formatting**: pure `formatWatchlistPrice(pair, price)` in
  `tradingViewWatchlist.ts` — JPY-quoted 3 decimals; metals 2; indices 1;
  crypto 2 (0 when ≥ 1000); other FX 5.
- **States**: per-row `Skeleton` while that pair has no data yet (query loading or
  `price: null` warming); unsupported pairs render label + "—" (no spark), still
  deep-linked; query error → existing banner + retry (`auto.ui.eda58f52bd` copy
  becomes stale wording "TradingView non disponibile" → replace with a new
  neutral `tradingview.watchlist.error` key in all 5 langs) wired to `refetch()`.
- **Removed**: `TradingViewMiniSymbolEmbed`, `TRADING_VIEW_MINI_SYMBOL_SCRIPT`,
  `buildTradingViewMiniSymbolConfig` (+ their test assertions). The TradingView
  **deep-link** helpers stay.
- **i18n**: new keys `tradingview.watchlist.daily`, `tradingview.watchlist.error`
  in all 5 dicts; all copy through `uiText`. Mind the mojibake test (no `Ã/â/Â/ð`).

## 4. Tests

- `services/watchlistQuotes.test.ts` (node assert, like `volatility.test.ts`):
  pairs param parsing (case, `/`, dedupe, cap, unsupported), item building
  (spark window, changePct, single-candle/empty edge cases).
- `tradingViewWatchlist.test.ts`: drop embed-config asserts; add
  `formatWatchlistPrice` cases (JPY/metal/index/crypto/FX).
- `TradingViewWatchlistWidget.static.test.ts`: rewrite — asserts **no** TradingView
  embed scripts remain, Sparkline + apiFetch/useQuery usage, whole-row deep link,
  `resolveWatchlistPairs`, live badge + manage keys, skeleton + error + retry.
- `Dashboard.tradingview-watchlist.static.test.ts`: unchanged (registry untouched).

## 5. Out of scope

- Contract (openapi.yaml) changes, live tick prices/WebSocket, warehouse work.
- Any other dashboard widget; dashboard layout/registry.
- Renaming the component/registry id.
