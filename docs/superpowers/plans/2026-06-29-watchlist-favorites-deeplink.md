# Watchlist favorites + TradingView deep-link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the dashboard "Watchlist Realtime" widget render only the user's favorite pairs (`selectedPairs`), and make tapping a pair open the TradingView app on the device (falling back to the logged-in web chart).

**Architecture:** Extract pure TradingView-symbol helpers into a standalone module (`tradingViewWatchlist.ts`), then rewrite the widget to read `selectedPairs` from `useBackground()`, map each catalog symbol to a TradingView symbol, render the existing live mini-embed per pair, overlay a deep-link anchor (same-tab on mobile for app handoff, new tab on desktop), and turn the gear into a shortcut to `/settings?section=pairs`. The manual editor / localStorage list is removed.

**Tech Stack:** React 19, Wouter (`Link`), Tailwind 4, TradingView embed widget, `@workspace/pair-catalog`, project i18n (`uiText`), node-based `*.test.ts` static tests run by `pnpm test`.

## Global Constraints

- **TypeScript strict**; `@typescript-eslint/no-explicit-any` = error in non-test source.
- **i18n enforced:** every user-visible string uses `uiText()`/`t()`; new keys added to **all 5 languages** (`it`, `en`, `es`, `fr`, `de`) — `production-copy.static.test.ts` fails the build otherwise. Never pass string literals to a `title`/`aria-label`/`subtitle`/`label` prop.
- **No mojibake:** `i18n.parity.static.test.ts` forbids the characters `Ã` `â` `Â` `ð` in any dictionary value.
- **Test discovery:** runner picks up any file matching `/\.test\.tsx?$/`. Pure-logic tests are standalone node scripts using `node:assert/strict` + a final `console.log("...checks passed")`.
- **pnpm only.** The gate is `pnpm verify`. Don't run `prettier --write` on files.
- **Semantic commits with scope** (e.g. `feat(ui):`, `refactor:`).

---

### Task 1: Pure TradingView-symbol helpers

Extract the pure logic into its own module so it's testable without the React/context import graph.

**Files:**
- Create: `artifacts/trader-dashboard/src/components/tradingViewWatchlist.ts`
- Create (test): `artifacts/trader-dashboard/src/components/tradingViewWatchlist.test.ts`

**Interfaces:**
- Consumes: `getPairEntry(symbol: string): PairEntry | undefined` from `@workspace/pair-catalog` (categories: `forex-major | forex-minor | forex-exotic | metal | index | crypto`).
- Produces:
  - `mapCatalogPairToTradingViewSymbol(symbol: string): string`
  - `buildTradingViewDeepLink(symbol: string): string`
  - `buildTradingViewMiniSymbolConfig(symbol: string): TradingViewMiniSymbolConfig`
  - `TRADING_VIEW_MINI_SYMBOL_SCRIPT: string`
  - `interface TradingViewMiniSymbolConfig`

- [ ] **Step 1: Write the failing test**

Create `artifacts/trader-dashboard/src/components/tradingViewWatchlist.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  TRADING_VIEW_MINI_SYMBOL_SCRIPT,
  buildTradingViewDeepLink,
  buildTradingViewMiniSymbolConfig,
  mapCatalogPairToTradingViewSymbol,
} from "./tradingViewWatchlist";

// Forex → FX: prefix (majors, minors, exotics)
assert.equal(mapCatalogPairToTradingViewSymbol("EURUSD"), "FX:EURUSD");
assert.equal(mapCatalogPairToTradingViewSymbol(" eurusd "), "FX:EURUSD");
assert.equal(mapCatalogPairToTradingViewSymbol("USDMXN"), "FX:USDMXN");
assert.equal(mapCatalogPairToTradingViewSymbol("CHFJPY"), "FX:CHFJPY");

// Metals → OANDA:
assert.equal(mapCatalogPairToTradingViewSymbol("XAUUSD"), "OANDA:XAUUSD");
assert.equal(mapCatalogPairToTradingViewSymbol("XAGUSD"), "OANDA:XAGUSD");

// Indices → CAPITALCOM, with TradingView naming
assert.equal(mapCatalogPairToTradingViewSymbol("US30"), "CAPITALCOM:US30");
assert.equal(mapCatalogPairToTradingViewSymbol("NAS100"), "CAPITALCOM:US100");
assert.equal(mapCatalogPairToTradingViewSymbol("SPX500"), "CAPITALCOM:US500");

// Crypto → COINBASE:
assert.equal(mapCatalogPairToTradingViewSymbol("BTCUSD"), "COINBASE:BTCUSD");
assert.equal(mapCatalogPairToTradingViewSymbol("ETHUSD"), "COINBASE:ETHUSD");

// Fallbacks for symbols not in the catalog
assert.equal(mapCatalogPairToTradingViewSymbol("ZZZZZZ"), "FX:ZZZZZZ"); // 6-letter → assume forex
assert.equal(mapCatalogPairToTradingViewSymbol("FOO"), "FOO"); // not 6-letter → raw

// Deep link = TradingView universal chart URL with encoded symbol
assert.equal(
  buildTradingViewDeepLink("FX:EURUSD"),
  "https://www.tradingview.com/chart/?symbol=FX%3AEURUSD",
);
assert.equal(
  buildTradingViewDeepLink("OANDA:XAUUSD"),
  "https://www.tradingview.com/chart/?symbol=OANDA%3AXAUUSD",
);

// Mini-symbol embed config unchanged behaviour
const config = buildTradingViewMiniSymbolConfig("FX:EURUSD");
assert.equal(config.symbol, "FX:EURUSD");
assert.equal(config.colorTheme, "dark");
assert.equal(config.locale, "it");
assert.equal(config.isTransparent, true);
assert.equal(config.width, "100%");
assert.equal(config.dateRange, "1D");
assert.equal(config.autosize, true);

assert.match(TRADING_VIEW_MINI_SYMBOL_SCRIPT, /embed-widget-mini-symbol-overview\.js/);

console.log("tradingView watchlist helper checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/components/tradingViewWatchlist.test.ts`
Expected: FAIL — cannot resolve `./tradingViewWatchlist` (module not created yet).

- [ ] **Step 3: Write the implementation**

Create `artifacts/trader-dashboard/src/components/tradingViewWatchlist.ts`:

```ts
import { getPairEntry } from "@workspace/pair-catalog";

export const TRADING_VIEW_MINI_SYMBOL_SCRIPT =
  "https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";

const TRADING_VIEW_CHART_URL = "https://www.tradingview.com/chart/";

const TRADING_VIEW_INDEX_SYMBOLS: Record<string, string> = {
  US30: "CAPITALCOM:US30",
  NAS100: "CAPITALCOM:US100",
  SPX500: "CAPITALCOM:US500",
};

const TRADING_VIEW_CRYPTO_SYMBOLS: Record<string, string> = {
  BTCUSD: "COINBASE:BTCUSD",
  ETHUSD: "COINBASE:ETHUSD",
};

export interface TradingViewMiniSymbolConfig {
  symbol: string;
  width: string;
  height: string;
  locale: string;
  dateRange: string;
  colorTheme: "dark";
  isTransparent: boolean;
  autosize: boolean;
  largeChartUrl: string;
  chartOnly: boolean;
  noTimeScale: boolean;
}

/** Map a pair-catalog symbol (e.g. "EURUSD", "XAUUSD", "US30", "BTCUSD") to a TradingView symbol. */
export function mapCatalogPairToTradingViewSymbol(symbol: string): string {
  const sym = symbol.trim().toUpperCase();
  const entry = getPairEntry(sym);
  if (entry) {
    if (entry.category === "metal") return `OANDA:${sym}`;
    if (entry.category === "index") return TRADING_VIEW_INDEX_SYMBOLS[sym] ?? `CAPITALCOM:${sym}`;
    if (entry.category === "crypto") return TRADING_VIEW_CRYPTO_SYMBOLS[sym] ?? `COINBASE:${sym}`;
    return `FX:${sym}`; // forex-major / forex-minor / forex-exotic
  }
  if (/^[A-Z]{6}$/.test(sym)) return `FX:${sym}`; // unknown but forex-shaped
  return sym; // give the raw symbol to the embed, which surfaces its own error state
}

/** TradingView universal chart link. On iOS/Android the OS routes this to the app if installed. */
export function buildTradingViewDeepLink(symbol: string): string {
  const url = new URL(TRADING_VIEW_CHART_URL);
  url.searchParams.set("symbol", symbol);
  return url.toString();
}

export function buildTradingViewMiniSymbolConfig(symbol: string): TradingViewMiniSymbolConfig {
  return {
    symbol,
    width: "100%",
    height: "100%",
    locale: "it",
    dateRange: "1D",
    colorTheme: "dark",
    isTransparent: true,
    autosize: true,
    largeChartUrl: "",
    chartOnly: false,
    noTimeScale: true,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/components/tradingViewWatchlist.test.ts`
Expected: PASS — prints `tradingView watchlist helper checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/tradingViewWatchlist.ts artifacts/trader-dashboard/src/components/tradingViewWatchlist.test.ts
git commit -m "feat(ui): pure TradingView-symbol helpers for watchlist (mapping + deep-link)"
```

---

### Task 2: i18n keys for the new watchlist copy

Add the new strings to all 5 language blocks. Existing reused keys (`tradingview.watchlist.subtitle`, `tradingview.watchlist.live`) stay; obsolete editor keys may remain unused.

**Files:**
- Modify: `artifacts/trader-dashboard/src/lib/i18n.ts`

**Interfaces:**
- Produces (new keys): `tradingview.watchlist.empty_title`, `tradingview.watchlist.empty_desc` (overwrite existing value), `tradingview.watchlist.choose_pairs`, `tradingview.watchlist.manage`, `tradingview.watchlist.open_aria` (with `{symbol}` param).

- [ ] **Step 1: Add the keys to the `it` block**

Find the `it` watchlist line `"tradingview.watchlist.live": "Live",` (around line 4541). Immediately after it, insert:

```ts
    "tradingview.watchlist.empty_title": "Nessun pair preferito",
    "tradingview.watchlist.choose_pairs": "Scegli i tuoi pair",
    "tradingview.watchlist.manage": "Gestisci pair preferiti",
    "tradingview.watchlist.open_aria": "Apri {symbol} su TradingView",
```

Then change the existing `it` value:
```ts
    "tradingview.watchlist.empty_desc": "Scegli i tuoi pair preferiti per popolare la watchlist.",
```

- [ ] **Step 2: Add the keys to the `en` block**

After the `en` `"tradingview.watchlist.live": "Live",` (around line 4668), insert:

```ts
    "tradingview.watchlist.empty_title": "No favorite pairs",
    "tradingview.watchlist.choose_pairs": "Choose your pairs",
    "tradingview.watchlist.manage": "Manage favorite pairs",
    "tradingview.watchlist.open_aria": "Open {symbol} on TradingView",
```

Change the existing `en` value:
```ts
    "tradingview.watchlist.empty_desc": "Choose your favorite pairs to fill the watchlist.",
```

- [ ] **Step 3: Add the keys to the `es` block**

After the `es` `"tradingview.watchlist.live": "Live",` (around line 4795), insert:

```ts
    "tradingview.watchlist.empty_title": "Sin pares favoritos",
    "tradingview.watchlist.choose_pairs": "Elige tus pares",
    "tradingview.watchlist.manage": "Gestionar pares favoritos",
    "tradingview.watchlist.open_aria": "Abrir {symbol} en TradingView",
```

Change the existing `es` value:
```ts
    "tradingview.watchlist.empty_desc": "Elige tus pares favoritos para llenar la watchlist.",
```

- [ ] **Step 4: Add the keys to the `fr` block**

After the `fr` `"tradingview.watchlist.live": "Live",` (around line 4922), insert:

```ts
    "tradingview.watchlist.empty_title": "Aucune paire favorite",
    "tradingview.watchlist.choose_pairs": "Choisissez vos paires",
    "tradingview.watchlist.manage": "Gerer les paires favorites",
    "tradingview.watchlist.open_aria": "Ouvrir {symbol} sur TradingView",
```

Change the existing `fr` value:
```ts
    "tradingview.watchlist.empty_desc": "Choisissez vos paires favorites pour remplir la watchlist.",
```

> Note: `Gerer` is written without the accent on the first `e` deliberately — keep it ASCII to stay clear of the mojibake test; an accented `é` (U+00E9) is also allowed, but `Gérer` must never become the forbidden `Gârer`/`Ã`. Plain `Gerer` is the safe choice.

- [ ] **Step 5: Add the keys to the `de` block**

After the `de` `"tradingview.watchlist.live": "Live",` (around line 5049), insert:

```ts
    "tradingview.watchlist.empty_title": "Keine bevorzugten Paare",
    "tradingview.watchlist.choose_pairs": "Paare auswaehlen",
    "tradingview.watchlist.manage": "Bevorzugte Paare verwalten",
    "tradingview.watchlist.open_aria": "{symbol} auf TradingView oeffnen",
```

Change the existing `de` value:
```ts
    "tradingview.watchlist.empty_desc": "Waehle deine bevorzugten Paare, um die Watchlist zu fuellen.",
```

> Note: German umlauts are spelled out (`ae`/`oe`/`ue`) to keep values ASCII and unambiguous; the umlaut form (`ä`/`ö`/`ü`, U+00E4/F6/FC) is allowed by the mojibake test, but ASCII avoids any encoding surprise.

- [ ] **Step 6: Verify i18n tests pass**

Run: `pnpm --filter ./scripts exec tsx scripts/local/run-tests.ts` (or `pnpm test`) and confirm `i18n.parity.static.test.ts` and `production-copy.static.test.ts` pass.
Expected: PASS (parity = same key set across all 5 langs; no forbidden chars).

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/i18n.ts
git commit -m "feat(i18n): watchlist favorites empty-state + deep-link copy (5 langs)"
```

---

### Task 3: Rewrite the widget + its static test

Rewrite the component to consume the pure module and `selectedPairs`, remove the editor/storage, and rewrite the structural static test (readFileSync-based, no module import — keeps it independent of the React/context graph).

**Files:**
- Modify (full rewrite): `artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.tsx`
- Modify (full rewrite): `artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.static.test.ts`

**Interfaces:**
- Consumes: `mapCatalogPairToTradingViewSymbol`, `buildTradingViewDeepLink`, `buildTradingViewMiniSymbolConfig`, `TradingViewMiniSymbolConfig`, `TRADING_VIEW_MINI_SYMBOL_SCRIPT` from `./tradingViewWatchlist`; `useBackground()` → `{ selectedPairs: string[]; settingsLoaded: boolean }`; `useIsMobile(): boolean`; `getPairLabel(symbol): string` from `@workspace/pair-catalog`; `Link` from `wouter`.
- Produces: `export function TradingViewWatchlistWidget()` (unchanged name/signature — Dashboard registry untouched).

- [ ] **Step 1: Rewrite the static test (failing first)**

Replace the entire contents of `artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.static.test.ts` with:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./TradingViewWatchlistWidget.tsx", import.meta.url), "utf8");

// Live mini-embed retained, other embed kinds still excluded
assert.match(source, /embed-widget-mini-symbol-overview\.js|TRADING_VIEW_MINI_SYMBOL_SCRIPT/);
assert.doesNotMatch(source, /embed-widget-market-quotes\.js/);
assert.doesNotMatch(source, /embed-widget-single-quote\.js/);

// Driven by favorites from the shared context, not a local list
assert.match(source, /useBackground\(\)/);
assert.match(source, /selectedPairs/);

// Manual editor / localStorage list fully removed
assert.doesNotMatch(source, /tl_tradingview_watchlist_symbols_v1/);
assert.doesNotMatch(source, /SymbolEditorDialog/);
assert.doesNotMatch(source, /tradingViewWatchlistStorage/);
assert.doesNotMatch(source, /suggestTradingViewSymbols/);

// Pure helpers imported from the dedicated module
assert.match(source, /from "\.\/tradingViewWatchlist"/);
assert.match(source, /mapCatalogPairToTradingViewSymbol/);
assert.match(source, /buildTradingViewDeepLink/);

// Tap → deep link; mobile same-tab for app handoff, desktop new tab
assert.match(source, /href=\{buildTradingViewDeepLink\(/);
assert.match(source, /isMobile \? "_self" : "_blank"/);

// Gear → favorites settings shortcut
assert.match(source, /\/settings\?section=pairs/);
assert.match(source, /tradingview\.watchlist\.manage/);

// New empty-state copy
assert.match(source, /tradingview\.watchlist\.empty_title/);
assert.match(source, /tradingview\.watchlist\.choose_pairs/);

// LIVE badge retained
assert.match(source, /tradingview\.watchlist\.live/);

console.log("tradingview watchlist widget structure checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.static.test.ts`
Expected: FAIL — the current widget still imports `tradingViewWatchlistStorage`, `SymbolEditorDialog`, etc., so the `doesNotMatch`/`match` assertions fail.

- [ ] **Step 3: Rewrite the widget component**

Replace the entire contents of `artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.tsx` with:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, RefreshCw, Settings } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent } from "./ui/card";
import { WidgetHeader } from "./ui/WidgetHeader";
import { useBackground } from "@/contexts/BackgroundContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { getPairLabel } from "@workspace/pair-catalog";
import { uiText } from "@/contexts/LanguageContext";
import {
  TRADING_VIEW_MINI_SYMBOL_SCRIPT,
  buildTradingViewDeepLink,
  buildTradingViewMiniSymbolConfig,
  mapCatalogPairToTradingViewSymbol,
} from "./tradingViewWatchlist";

const PAIR_PREFERENCES_PATH = "/settings?section=pairs";

function TradingViewMiniSymbolEmbed({
  symbol,
  reloadKey,
  onError,
}: {
  symbol: string;
  reloadKey: number;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const configKey = useMemo(() => `${symbol}::${reloadKey}`, [symbol, reloadKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const widgetTarget = document.createElement("div");
    widgetTarget.className = "tradingview-widget-container__widget h-[116px]";
    container.appendChild(widgetTarget);

    const script = document.createElement("script");
    script.src = TRADING_VIEW_MINI_SYMBOL_SCRIPT;
    script.async = true;
    script.type = "text/javascript";
    script.onerror = onError;
    script.text = JSON.stringify(buildTradingViewMiniSymbolConfig(symbol));
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [configKey, onError, symbol]);

  return <div ref={containerRef} className="tradingview-widget-container h-[116px] w-full overflow-hidden" />;
}

export function TradingViewWatchlistWidget() {
  const { selectedPairs, settingsLoaded } = useBackground();
  const isMobile = useIsMobile();
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleEmbedError = useCallback(() => setLoadError(true), []);

  const retry = () => {
    setLoadError(false);
    setReloadKey((value) => value + 1);
  };

  return (
    <Card className="relative overflow-hidden">
      <WidgetHeader
        icon={<Activity className="h-3.5 w-3.5" />}
        iconTone="accent"
        title={uiText("auto.ui.b97144823c")}
        subtitle={uiText("tradingview.watchlist.subtitle")}
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
              <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]" />
              {uiText("tradingview.watchlist.live")}
            </span>
            <Link
              href={PAIR_PREFERENCES_PATH}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/40 bg-background/35 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
              title={uiText("tradingview.watchlist.manage")}
              aria-label={uiText("tradingview.watchlist.manage")}
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </div>
        }
        className="border-b border-border/40"
      />

      <CardContent className="space-y-2 p-2">
        {!settingsLoaded ? (
          <div className="min-h-[116px] animate-pulse rounded-lg border border-border/35 bg-background/25" />
        ) : selectedPairs.length === 0 ? (
          <div className="flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/50 bg-secondary/15 p-3 text-center">
            <p className="text-sm font-bold">{uiText("tradingview.watchlist.empty_title")}</p>
            <p className="max-w-[240px] text-xs text-muted-foreground">
              {uiText("tradingview.watchlist.empty_desc")}
            </p>
            <Link
              href={PAIR_PREFERENCES_PATH}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {uiText("tradingview.watchlist.choose_pairs")}
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5 overflow-x-hidden">
            {selectedPairs.map((pair) => {
              const tvSymbol = mapCatalogPairToTradingViewSymbol(pair);
              const label = getPairLabel(pair);
              return (
                <div
                  key={pair}
                  className="relative overflow-hidden rounded-md border border-border/35 bg-background/25"
                >
                  <TradingViewMiniSymbolEmbed symbol={tvSymbol} reloadKey={reloadKey} onError={handleEmbedError} />
                  <a
                    href={buildTradingViewDeepLink(tvSymbol)}
                    target={isMobile ? "_self" : "_blank"}
                    rel="noopener noreferrer"
                    className="absolute inset-0 z-10 block touch-manipulation rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    aria-label={uiText("tradingview.watchlist.open_aria", { symbol: label })}
                    title={uiText("tradingview.watchlist.open_aria", { symbol: label })}
                  />
                </div>
              );
            })}
          </div>
        )}

        {loadError && (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <span>{uiText("auto.ui.eda58f52bd")}</span>
            <button
              type="button"
              onClick={retry}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-destructive/30 hover:bg-destructive/10"
              title={uiText("auto.ui.f360775cb8")}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run the static test to verify it passes**

Run: `pnpm --filter ./scripts exec tsx artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.static.test.ts`
Expected: PASS — prints `tradingview watchlist widget structure checks passed`.

- [ ] **Step 5: Run the full gate**

Run: `pnpm verify`
Expected: PASS — install → codegen → typecheck → test → build all green. In particular: typecheck passes (no references to removed exports anywhere), `Dashboard.tradingview-watchlist.static.test.ts` still passes (registry unchanged), `production-copy.static.test.ts` and `i18n.parity.static.test.ts` pass.

If typecheck reports any other file importing the removed exports (`tradingViewWatchlistStorage`, `normalizeTradingViewSymbol`, `suggestTradingViewSymbols`, `DEFAULT_TRADING_VIEW_WATCHLIST_SYMBOLS`, `buildTradingViewChartUrl`), update that importer to the new module/helpers; none are expected outside the rewritten files.

- [ ] **Step 6: Commit**

```bash
git add artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.tsx artifacts/trader-dashboard/src/components/TradingViewWatchlistWidget.static.test.ts
git commit -m "feat(ui): watchlist shows favorite pairs, taps deep-link to TradingView app"
```

---

## Self-Review

**1. Spec coverage:**
- §3 favorites as source → Task 3 (`useBackground().selectedPairs`) + Task 1 mapping. ✓
- §3 mapping table (forex/metal/index/crypto + fallback) → Task 1. ✓
- §4 deep-link helper + mobile same-tab / desktop new-tab → Task 1 (`buildTradingViewDeepLink`) + Task 3 (`isMobile ? "_self" : "_blank"`). ✓
- §5 gear → `/settings?section=pairs` → Task 3. ✓
- §6 empty state + CTA → Task 3 + Task 2 copy. ✓
- §3 removals (storage/editor/suggestions/normalize/defaults/invalid UI) → Task 3 rewrite + static-test `doesNotMatch` asserts. ✓
- §7 i18n 5 langs, no mojibake → Task 2. ✓
- §8 TDD tests (pure helpers + static rewrite; Dashboard registry test untouched) → Tasks 1 & 3. ✓
- §9 keep mini-embed format; no API/contract change → Task 3 keeps embed; no contract files touched. ✓

**2. Placeholder scan:** No TBD/TODO; every code step has complete content. ✓

**3. Type consistency:** `mapCatalogPairToTradingViewSymbol`, `buildTradingViewDeepLink`, `buildTradingViewMiniSymbolConfig`, `TRADING_VIEW_MINI_SYMBOL_SCRIPT`, `TradingViewMiniSymbolConfig` named identically across Task 1 (definition), its test, and Task 3 (consumption). `useBackground()` fields (`selectedPairs`, `settingsLoaded`) match `BackgroundContext`. `getPairLabel` signature matches catalog. ✓
