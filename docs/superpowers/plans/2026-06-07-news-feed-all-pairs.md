# News Feed All Pairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make TraderLoadings news search, capture, classification, and display work for the user's selected instruments instead of behaving like an XAU/USD-only feed.

**Architecture:** Add normalized pair handling in `@workspace/pair-catalog`, then build News Hub helpers that generate bounded search queries from selected pair profiles. Extend News Hub classification and ranking to be context-aware across forex, metals, indices, and crypto, then update `/api/news`, `/api/tools/macro-news`, and `/news` to expose coverage states and use the dedicated page as the primary workspace.

**Tech Stack:** TypeScript, Express, `ws`, RSS/Google News feeds, React/Vite, TanStack Query, Wouter, Tailwind, Lucide, existing Node `assert` tests executed with `tsx`.

---

## File Structure

- Modify `lib/pair-catalog/src/index.ts`: symbol normalization and reusable pair lookup helpers.
- Create `lib/pair-catalog/src/index.test.ts`: pair normalization and currency extraction tests.
- Create `artifacts/api-server/src/services/newsHub/pairProfiles.ts`: news-specific pair profiles, asset metadata, and selected pair profile normalization.
- Create `artifacts/api-server/src/services/newsHub/pairProfiles.test.ts`: pair profile coverage tests.
- Create `artifacts/api-server/src/services/newsHub/queryPlan.ts`: bounded Google News query generation and cache-key helpers.
- Create `artifacts/api-server/src/services/newsHub/queryPlan.test.ts`: query generation tests for representative instruments.
- Modify `artifacts/api-server/src/services/newsHub/types.ts`: add coverage metadata types.
- Modify `artifacts/api-server/src/services/newsHub/intelligence.ts`: generalized classification rules beyond XAU.
- Modify `artifacts/api-server/src/services/newsHub/intelligence.test.ts`: non-XAU and XAU regression tests.
- Modify `artifacts/api-server/src/services/newsHub/ranking.ts`: context-aware quality scoring.
- Modify `artifacts/api-server/src/services/newsHub/ranking.test.ts`: non-XAU ranking regression tests.
- Modify `artifacts/api-server/src/routes/news.ts`: use pair profiles and query plans for collection, response coverage metadata, and cache key.
- Modify `artifacts/api-server/src/services/newsHub/macroNewsAdapter.ts`: remove XAU-first currency reduction and adapt improved News Hub results.
- Modify `artifacts/api-server/src/services/newsHub/macroNewsAdapter.test.ts`: non-XAU macro adapter tests.
- Modify `artifacts/api-server/src/services/newsHub/socketServer.test.ts`: add non-XAU subscription case.
- Modify `lib/api-spec/openapi.yaml`: stop describing `/api/news` as gold/dollar-only and document query params at source.
- Modify `artifacts/trader-dashboard/src/components/MacroNewsTicker.tsx`: make ticker preview navigate to `/news`, not open the desktop sheet.
- Modify `artifacts/trader-dashboard/src/pages/News.tsx`: add selected-pair inbox layout, coverage states, and inline detail panel on desktop.
- Modify `artifacts/trader-dashboard/src/components/BottomNav.tsx`: add News as a secondary/desktop navigation entry without displacing the five mobile primary tabs.
- Modify `artifacts/trader-dashboard/src/lib/i18n.ts`: replace XAU/USD-only news copy with selected-instrument copy.

---

### Task 1: Pair Catalog Normalization

**Files:**
- Modify: `lib/pair-catalog/src/index.ts`
- Create: `lib/pair-catalog/src/index.test.ts`

- [ ] **Step 1: Write the failing pair catalog tests**

Create `lib/pair-catalog/src/index.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  getCurrenciesFromPairs,
  getPairEntry,
  getPairLabel,
  normalizePairSymbol,
} from "./index.js";

assert.equal(normalizePairSymbol("eurusd"), "EURUSD");
assert.equal(normalizePairSymbol(" EUR/USD "), "EURUSD");
assert.equal(normalizePairSymbol("xag/usd"), "XAGUSD");
assert.equal(normalizePairSymbol("nas100"), "NAS100");

assert.equal(getPairEntry("eur/usd")?.symbol, "EURUSD");
assert.equal(getPairEntry("XAU/USD")?.symbol, "XAUUSD");
assert.equal(getPairEntry("btc/usd")?.symbol, "BTCUSD");

assert.deepEqual(getCurrenciesFromPairs(["eur/usd", " usd/jpy ", "xagusd"]), ["EUR", "JPY", "USD", "XAG"]);
assert.equal(getPairLabel("gbp/usd"), "GBP/USD");
assert.equal(getPairLabel("unknown/pair"), "UNKNOWNPAIR");

console.log("pair catalog checks passed");
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm --filter @workspace/pair-catalog exec tsx src/index.test.ts
```

Expected: FAIL because `normalizePairSymbol` is not exported and slash/lowercase lookup does not work yet.

- [ ] **Step 3: Implement normalization in the pair catalog**

Update `lib/pair-catalog/src/index.ts` by adding `normalizePairSymbol` and using it inside the lookup helpers:

```ts
export function normalizePairSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getPairEntry(symbol: string): PairEntry | undefined {
  const normalized = normalizePairSymbol(symbol);
  return PAIR_CATALOG.find((p) => p.symbol === normalized);
}

export function getCurrenciesFromPairs(symbols: string[]): string[] {
  const currencies = new Set<string>();
  for (const sym of symbols) {
    const entry = getPairEntry(sym);
    if (entry) {
      for (const c of entry.currencies) currencies.add(c);
    }
  }
  return [...currencies].sort();
}

export function getPairLabel(symbol: string): string {
  return getPairEntry(symbol)?.label ?? normalizePairSymbol(symbol);
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```bash
pnpm --filter @workspace/pair-catalog exec tsx src/index.test.ts
```

Expected: PASS and prints `pair catalog checks passed`.

- [ ] **Step 5: Run typecheck for the pair catalog consumer graph**

Run:

```bash
pnpm run typecheck:libs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/pair-catalog/src/index.ts lib/pair-catalog/src/index.test.ts
git commit -m "feat: normalize pair catalog symbols"
```

---

### Task 2: News Pair Profiles and Query Plans

**Files:**
- Create: `artifacts/api-server/src/services/newsHub/pairProfiles.ts`
- Create: `artifacts/api-server/src/services/newsHub/pairProfiles.test.ts`
- Create: `artifacts/api-server/src/services/newsHub/queryPlan.ts`
- Create: `artifacts/api-server/src/services/newsHub/queryPlan.test.ts`

- [ ] **Step 1: Write failing pair profile tests**

Create `artifacts/api-server/src/services/newsHub/pairProfiles.test.ts`:

```ts
import assert from "node:assert/strict";
import { buildSelectedPairProfiles, getAssetProfile } from "./pairProfiles.js";

const profiles = buildSelectedPairProfiles("eur/usd, USDJPY, xagusd, btc/usd, nas100");
assert.deepEqual(profiles.map((profile) => profile.symbol), ["EURUSD", "USDJPY", "XAGUSD", "BTCUSD", "NAS100"]);
assert.deepEqual(profiles[0]?.assets, ["EUR", "USD"]);
assert.equal(profiles[0]?.institutions.includes("ECB"), true);
assert.equal(profiles[1]?.institutions.includes("BoJ"), true);
assert.equal(profiles[2]?.category, "metal");
assert.equal(profiles[3]?.category, "crypto");
assert.equal(profiles[4]?.category, "index");

assert.equal(getAssetProfile("AUD")?.institutions.includes("RBA"), true);
assert.equal(getAssetProfile("CAD")?.keywords.includes("oil"), true);
assert.equal(getAssetProfile("XAG")?.keywords.includes("silver"), true);

console.log("news pair profile checks passed");
```

- [ ] **Step 2: Write failing query plan tests**

Create `artifacts/api-server/src/services/newsHub/queryPlan.test.ts`:

```ts
import assert from "node:assert/strict";
import { buildSelectedPairProfiles } from "./pairProfiles.js";
import { buildNewsQueryPlan, newsQueryCacheKey } from "./queryPlan.js";

const plan = buildNewsQueryPlan(buildSelectedPairProfiles("EURUSD,USDJPY,AUDUSD,XAGUSD,BTCUSD,NAS100"), { maxQueries: 18 });

assert.equal(plan.cacheKey, "AUDUSD,BTCUSD,EURUSD,NAS100,USDJPY,XAGUSD");
assert.equal(plan.queries.length <= 18, true);
assert.equal(plan.queries.some((query) => /EURUSD forex when:2d/i.test(query)), true);
assert.equal(plan.queries.some((query) => /ECB euro/i.test(query)), true);
assert.equal(plan.queries.some((query) => /BoJ yen/i.test(query)), true);
assert.equal(plan.queries.some((query) => /RBA aussie|Australia inflation/i.test(query)), true);
assert.equal(plan.queries.some((query) => /silver|XAGUSD/i.test(query)), true);
assert.equal(plan.queries.some((query) => /bitcoin|BTCUSD/i.test(query)), true);
assert.equal(plan.queries.some((query) => /Nasdaq|NAS100/i.test(query)), true);

assert.equal(newsQueryCacheKey(buildSelectedPairProfiles("usd/jpy, eurusd"), "it"), "EURUSD,USDJPY:it");
assert.equal(newsQueryCacheKey([], "en"), "all:en");

console.log("news query plan checks passed");
```

- [ ] **Step 3: Run the focused tests and verify they fail**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/pairProfiles.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/queryPlan.test.ts
```

Expected: FAIL because the helper modules do not exist yet.

- [ ] **Step 4: Implement pair profiles**

Create `artifacts/api-server/src/services/newsHub/pairProfiles.ts`:

```ts
import { PAIR_CATALOG, getPairEntry, normalizePairSymbol, type PairEntry } from "@workspace/pair-catalog";

export type NewsPairCategory = PairEntry["category"] | "unknown";

export interface AssetNewsProfile {
  asset: string;
  keywords: string[];
  institutions: string[];
  macroDrivers: string[];
}

export interface NewsPairProfile {
  symbol: string;
  label: string;
  category: NewsPairCategory;
  assets: string[];
  keywords: string[];
  institutions: string[];
  macroDrivers: string[];
  known: boolean;
}

const ASSET_PROFILES: Record<string, AssetNewsProfile> = {
  USD: { asset: "USD", keywords: ["dollar", "usd", "dxy", "treasury yields", "Fed", "FOMC", "Powell"], institutions: ["Fed", "FOMC"], macroDrivers: ["CPI", "PCE", "NFP", "jobs", "retail sales", "yields"] },
  EUR: { asset: "EUR", keywords: ["euro", "eur", "eurozone", "ECB", "Lagarde"], institutions: ["ECB"], macroDrivers: ["Eurozone CPI", "PMI", "GDP", "rate decision"] },
  GBP: { asset: "GBP", keywords: ["pound", "sterling", "gbp", "BoE", "Bank of England", "Bailey"], institutions: ["BoE"], macroDrivers: ["UK CPI", "jobs", "GDP", "rate decision"] },
  JPY: { asset: "JPY", keywords: ["yen", "jpy", "BoJ", "Bank of Japan", "Ueda", "intervention"], institutions: ["BoJ"], macroDrivers: ["Japan CPI", "wages", "yield curve control", "intervention"] },
  CHF: { asset: "CHF", keywords: ["swiss franc", "chf", "SNB", "safe haven"], institutions: ["SNB"], macroDrivers: ["Swiss CPI", "risk aversion", "rate decision"] },
  CAD: { asset: "CAD", keywords: ["canadian dollar", "cad", "BoC", "Bank of Canada", "oil"], institutions: ["BoC"], macroDrivers: ["Canada CPI", "jobs", "oil", "rate decision"] },
  AUD: { asset: "AUD", keywords: ["aussie", "australian dollar", "aud", "RBA", "China demand"], institutions: ["RBA"], macroDrivers: ["Australia CPI", "jobs", "China data", "rate decision"] },
  NZD: { asset: "NZD", keywords: ["kiwi", "new zealand dollar", "nzd", "RBNZ"], institutions: ["RBNZ"], macroDrivers: ["New Zealand CPI", "jobs", "rate decision"] },
  XAU: { asset: "XAU", keywords: ["gold", "xau", "bullion", "spot gold", "gold futures", "safe haven"], institutions: [], macroDrivers: ["real yields", "Fed", "inflation", "geopolitics", "dollar"] },
  XAG: { asset: "XAG", keywords: ["silver", "xag", "precious metals", "silver futures", "industrial demand"], institutions: [], macroDrivers: ["real yields", "Fed", "industrial demand", "dollar"] },
  BTC: { asset: "BTC", keywords: ["bitcoin", "btc", "crypto", "spot bitcoin ETF"], institutions: [], macroDrivers: ["ETF flows", "regulation", "liquidity", "risk appetite"] },
  ETH: { asset: "ETH", keywords: ["ethereum", "eth", "crypto", "spot ether ETF"], institutions: [], macroDrivers: ["ETF flows", "regulation", "liquidity", "risk appetite"] },
};

const INDEX_PROFILES: Record<string, Pick<NewsPairProfile, "keywords" | "institutions" | "macroDrivers">> = {
  US30: { keywords: ["Dow Jones", "US30", "blue chip stocks", "Wall Street"], institutions: ["Fed"], macroDrivers: ["yields", "earnings", "risk appetite", "Fed"] },
  NAS100: { keywords: ["Nasdaq", "NAS100", "tech stocks", "mega cap tech"], institutions: ["Fed"], macroDrivers: ["yields", "AI stocks", "earnings", "risk appetite", "Fed"] },
  SPX500: { keywords: ["S&P 500", "SPX500", "US stocks", "Wall Street"], institutions: ["Fed"], macroDrivers: ["yields", "earnings", "risk appetite", "Fed"] },
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function getAssetProfile(asset: string): AssetNewsProfile | undefined {
  return ASSET_PROFILES[asset.toUpperCase()];
}

export function buildPairProfile(symbol: string): NewsPairProfile {
  const normalized = normalizePairSymbol(symbol);
  const entry = getPairEntry(normalized);
  if (!entry) {
    return { symbol: normalized, label: normalized, category: "unknown", assets: [], keywords: [normalized], institutions: [], macroDrivers: [], known: false };
  }

  const assetProfiles = entry.currencies.map((asset) => ASSET_PROFILES[asset]).filter((profile): profile is AssetNewsProfile => Boolean(profile));
  const indexProfile = INDEX_PROFILES[entry.symbol];
  return {
    symbol: entry.symbol,
    label: entry.label,
    category: entry.category,
    assets: entry.currencies,
    keywords: unique([entry.symbol, entry.label, ...assetProfiles.flatMap((profile) => profile.keywords), ...(indexProfile?.keywords ?? [])]),
    institutions: unique([...assetProfiles.flatMap((profile) => profile.institutions), ...(indexProfile?.institutions ?? [])]),
    macroDrivers: unique([...assetProfiles.flatMap((profile) => profile.macroDrivers), ...(indexProfile?.macroDrivers ?? [])]),
    known: true,
  };
}

export function buildSelectedPairProfiles(pairs = ""): NewsPairProfile[] {
  const symbols = pairs.split(",").map(normalizePairSymbol).filter(Boolean);
  const selected = symbols.length ? symbols : PAIR_CATALOG.slice(0, 0).map((entry) => entry.symbol);
  const seen = new Set<string>();
  return selected.map(buildPairProfile).filter((profile) => {
    if (seen.has(profile.symbol)) return false;
    seen.add(profile.symbol);
    return true;
  });
}
```

- [ ] **Step 5: Implement query planning**

Create `artifacts/api-server/src/services/newsHub/queryPlan.ts`:

```ts
import type { NewsPairProfile } from "./pairProfiles.js";

export interface NewsQueryPlan {
  cacheKey: string;
  queries: string[];
  pairSymbols: string[];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function pairQueries(profile: NewsPairProfile): string[] {
  const direct = [`${profile.symbol} forex when:2d`];
  if (profile.label !== profile.symbol) direct.push(`"${profile.label}" forex when:2d`);
  const institutions = profile.institutions.map((institution) => `${institution} ${profile.keywords[1] ?? profile.assets[0] ?? profile.symbol} when:2d`);
  const drivers = profile.macroDrivers.slice(0, 4).map((driver) => `${driver} ${profile.keywords[1] ?? profile.symbol} when:2d`);
  const category =
    profile.category === "metal" ? [`${profile.keywords.includes("silver") ? "silver" : "gold"} dollar yields when:2d`] :
    profile.category === "crypto" ? [`${profile.symbol} crypto regulation ETF flows when:2d`] :
    profile.category === "index" ? [`${profile.keywords[0] ?? profile.symbol} Fed yields earnings when:2d`] :
    [];
  return [...direct, ...institutions, ...drivers, ...category];
}

export function newsQueryCacheKey(profiles: NewsPairProfile[], lang: string): string {
  const symbols = profiles.map((profile) => profile.symbol).sort();
  return `${symbols.length ? symbols.join(",") : "all"}:${lang}`;
}

export function buildNewsQueryPlan(profiles: NewsPairProfile[], options: { maxQueries?: number; lang?: string } = {}): NewsQueryPlan {
  const maxQueries = options.maxQueries ?? 18;
  const fallback = ["forex market Federal Reserve dollar currencies when:2d", "global markets currencies commodities crypto when:2d"];
  const queries = unique(profiles.length ? profiles.flatMap(pairQueries) : fallback).slice(0, maxQueries);
  return {
    cacheKey: newsQueryCacheKey(profiles, options.lang ?? "it"),
    queries,
    pairSymbols: profiles.map((profile) => profile.symbol),
  };
}
```

- [ ] **Step 6: Run focused tests and verify they pass**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/pairProfiles.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/queryPlan.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/services/newsHub/pairProfiles.ts artifacts/api-server/src/services/newsHub/pairProfiles.test.ts artifacts/api-server/src/services/newsHub/queryPlan.ts artifacts/api-server/src/services/newsHub/queryPlan.test.ts
git commit -m "feat: add news pair profiles and query planning"
```

---

### Task 3: Generalize News Intelligence and Ranking

**Files:**
- Modify: `artifacts/api-server/src/services/newsHub/intelligence.ts`
- Modify: `artifacts/api-server/src/services/newsHub/intelligence.test.ts`
- Modify: `artifacts/api-server/src/services/newsHub/ranking.ts`
- Modify: `artifacts/api-server/src/services/newsHub/ranking.test.ts`

- [ ] **Step 1: Add failing intelligence coverage tests**

Append these cases to `artifacts/api-server/src/services/newsHub/intelligence.test.ts` before the final `console.log`:

```ts
const ecb = classifyNewsArticle(
  article("ECB signals another rate cut as eurozone inflation cools", "The euro slips as traders price easier policy."),
  { pairs: "EURUSD", lang: "it" },
);
assert.equal(ecb.relevant, true);
assert.deepEqual(ecb.article.affectedPairs, ["EUR/USD"]);
assert.ok(ecb.article.primaryAssets?.includes("EUR"));
assert.ok((ecb.article.matchConfidence ?? 0) >= 0.6);

const boj = classifyNewsArticle(
  article("BoJ warns yen intervention remains possible", "Japanese officials are watching disorderly currency moves."),
  { pairs: "USDJPY", lang: "en" },
);
assert.equal(boj.relevant, true);
assert.deepEqual(boj.article.affectedPairs, ["USD/JPY"]);
assert.ok(boj.article.primaryAssets?.includes("JPY"));

const rba = classifyNewsArticle(
  article("RBA keeps rates high as Australia inflation proves sticky", "The aussie gains after the central bank statement."),
  { pairs: "AUDUSD", lang: "en" },
);
assert.equal(rba.relevant, true);
assert.deepEqual(rba.article.affectedPairs, ["AUD/USD"]);

const silver = classifyNewsArticle(
  article("Silver futures rise as industrial demand improves", "Precious metals traders watch dollar liquidity."),
  { pairs: "XAGUSD", lang: "en" },
);
assert.equal(silver.relevant, true);
assert.deepEqual(silver.article.affectedPairs, ["XAG/USD"]);

const nasdaq = classifyNewsArticle(
  article("Nasdaq falls as Treasury yields hit tech shares", "Mega cap technology stocks drag Wall Street lower."),
  { pairs: "NAS100", lang: "en" },
);
assert.equal(nasdaq.relevant, true);
assert.deepEqual(nasdaq.article.affectedPairs, ["NAS100"]);

const bitcoinForEur = classifyNewsArticle(
  article("Bitcoin ETF inflows accelerate", "Crypto funds add risk exposure."),
  { pairs: "EURUSD", lang: "en" },
);
assert.equal(bitcoinForEur.relevant, false);
```

- [ ] **Step 2: Add failing ranking tests for non-XAU**

Append to `artifacts/api-server/src/services/newsHub/ranking.test.ts` before the final `console.log`:

```ts
const euroRanked = rankNewsForDisplay([
  article({
    title: "ECB rate cut expectations weigh on the euro",
    source: "Reuters",
    publishedAt: "2026-06-07T12:00:00.000Z",
    url: "https://reuters.example/ecb",
    affectedPairs: ["EUR/USD"],
    primaryAssets: ["EUR"],
    impactScore: 8,
    matchConfidence: 0.88,
  }),
  article({
    title: "Random company announces quarterly revenue",
    source: "Google News",
    publishedAt: "2026-06-07T12:01:00.000Z",
    url: "https://news.google.com/company",
    affectedPairs: ["EUR/USD"],
    primaryAssets: ["EUR"],
    impactScore: 2,
    matchConfidence: 0.4,
  }),
], { limit: 2, maxPerSource: 2 });

assert.equal(euroRanked[0]?.title, "ECB rate cut expectations weigh on the euro");
assert.ok((euroRanked[0]?.qualityScore ?? 0) > (euroRanked[1]?.qualityScore ?? 0));
```

- [ ] **Step 3: Run focused tests and verify they fail**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/intelligence.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/ranking.test.ts
```

Expected: FAIL because non-XAU rules are incomplete and ranking is gold/USD-biased.

- [ ] **Step 4: Replace hard-coded asset keyword coverage**

In `artifacts/api-server/src/services/newsHub/intelligence.ts`, import `buildSelectedPairProfiles` and `getAssetProfile`, then replace local `selectedAssets` parsing so classification uses pair profiles:

```ts
import { buildSelectedPairProfiles, getAssetProfile } from "./pairProfiles.js";

function selectedPairs(pairs = ""): string[] {
  return buildSelectedPairProfiles(pairs).map((profile) => profile.label);
}

function selectedAssets(pairs = ""): string[] {
  return [...new Set(buildSelectedPairProfiles(pairs).flatMap((profile) => profile.assets.length ? profile.assets : [profile.symbol]))];
}

function hasAssetKeyword(text: string, asset: string): boolean {
  const profile = getAssetProfile(asset);
  const keywords = profile?.keywords ?? [];
  return keywords.some((keyword) => new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
}
```

Keep the XAU corporate false-positive guard.

- [ ] **Step 5: Add generalized indirect rules**

Replace `XAU_INDIRECT_RULES` with a generalized rules array:

```ts
const INDIRECT_RULES: Array<{ assets: string[]; re: RegExp; score: number; confidence: number; direction: Direction; reasonKey: string }> = [
  { assets: ["USD"], re: /\bfed\b|\bfomc\b|powell|rate\s+(hike|decision|cut)|interest\s+rates?|treasury\s+yields?|pce|non.?farm|nfp/i, score: 8, confidence: 0.76, direction: "mixed", reasonKey: "usd_policy" },
  { assets: ["EUR"], re: /\becb\b|lagarde|eurozone|euro\s+(inflation|cpi|pmi)|euro\s+rate/i, score: 8, confidence: 0.74, direction: "mixed", reasonKey: "eur_policy" },
  { assets: ["GBP"], re: /\bboe\b|bank\s+of\s+england|bailey|uk\s+(inflation|cpi|jobs|gdp)|sterling|pound/i, score: 8, confidence: 0.74, direction: "mixed", reasonKey: "gbp_policy" },
  { assets: ["JPY"], re: /\bboj\b|bank\s+of\s+japan|ueda|yen\s+intervention|japan\s+(inflation|cpi|wages)/i, score: 8, confidence: 0.74, direction: "mixed", reasonKey: "jpy_policy" },
  { assets: ["CHF"], re: /\bsnb\b|swiss\s+franc|switzerland\s+(inflation|cpi)|safe.?haven/i, score: 7, confidence: 0.68, direction: "mixed", reasonKey: "chf_policy" },
  { assets: ["CAD"], re: /\bboc\b|bank\s+of\s+canada|canadian\s+dollar|canada\s+(inflation|jobs|cpi)|oil\s+prices?/i, score: 7, confidence: 0.68, direction: "mixed", reasonKey: "cad_policy" },
  { assets: ["AUD"], re: /\brba\b|reserve\s+bank\s+of\s+australia|aussie|australia\s+(inflation|jobs|cpi)|china\s+demand/i, score: 7, confidence: 0.68, direction: "mixed", reasonKey: "aud_policy" },
  { assets: ["NZD"], re: /\brbnz\b|new\s+zealand\s+dollar|kiwi|new\s+zealand\s+(inflation|jobs|cpi)/i, score: 7, confidence: 0.68, direction: "mixed", reasonKey: "nzd_policy" },
  { assets: ["XAU", "USD"], re: /\bgold\b|\bxau\b|bullion|real\s+yields?|safe.?haven|geopolitical|war|conflict/i, score: 8, confidence: 0.82, direction: "mixed", reasonKey: "gold_drivers" },
  { assets: ["XAG", "USD"], re: /\bsilver\b|\bxag\b|precious\s+metals?|industrial\s+demand/i, score: 7, confidence: 0.72, direction: "mixed", reasonKey: "silver_drivers" },
  { assets: ["BTC"], re: /\bbitcoin\b|\bbtc\b|spot\s+bitcoin\s+etf|crypto\s+regulation|crypto\s+funds/i, score: 7, confidence: 0.72, direction: "mixed", reasonKey: "crypto_drivers" },
  { assets: ["ETH"], re: /\bethereum\b|\beth\b|spot\s+ether\s+etf|crypto\s+regulation/i, score: 7, confidence: 0.72, direction: "mixed", reasonKey: "crypto_drivers" },
  { assets: ["NAS100", "US30", "SPX500"], re: /nasdaq|dow\s+jones|s&p\s+500|wall\s+street|tech\s+stocks?|treasury\s+yields?|earnings|risk.?off|risk.?on/i, score: 7, confidence: 0.7, direction: "mixed", reasonKey: "index_drivers" },
];

function indirectMatches(text: string, focusAssets: string[]): RuleMatch[] {
  return INDIRECT_RULES
    .filter((rule) => rule.assets.some((asset) => focusAssets.includes(asset)) && rule.re.test(text))
    .map((rule) => ({
      assets: rule.assets.filter((asset) => focusAssets.includes(asset) || asset === "USD"),
      score: rule.score,
      confidence: rule.confidence,
      direction: /rises?|rally|gains?|strong|hawkish/i.test(text) ? "bullish" : /falls?|drops?|weak|dovish|cut/i.test(text) ? "bearish" : rule.direction,
      reasonKey: rule.reasonKey,
    }));
}
```

Then change the match list from `directMatches + xauIndirectMatches` to `directMatches + indirectMatches`.

- [ ] **Step 6: Add localized reasons for new rule keys**

Extend `REASONS.it` and `REASONS.en` with keys:

```ts
usd_policy: "Fed, dati USA e rendimenti muovono il dollaro e i pair collegati all'USD.",
eur_policy: "ECB e dati eurozona influenzano aspettative sui tassi e direzione dell'euro.",
gbp_policy: "BoE e dati UK spostano le aspettative sui tassi e la sterlina.",
jpy_policy: "BoJ, inflazione giapponese e interventi valutari possono muovere lo yen.",
chf_policy: "SNB, inflazione svizzera e flussi rifugio influenzano il franco.",
cad_policy: "BoC, dati canadesi e petrolio possono muovere il dollaro canadese.",
aud_policy: "RBA, dati australiani e domanda cinese influenzano l'aussie.",
nzd_policy: "RBNZ e dati neozelandesi guidano il dollaro neozelandese.",
gold_drivers: "Oro, rendimenti reali, Fed e rischio geopolitico guidano XAU/USD.",
silver_drivers: "Argento, dollaro, rendimenti e domanda industriale guidano XAG/USD.",
crypto_drivers: "ETF, regolazione, liquidita' e propensione al rischio guidano le crypto.",
index_drivers: "Rendimenti, Fed, utili e risk sentiment influenzano gli indici USA.",
```

Add equivalent concise English strings to `REASONS.en`.

- [ ] **Step 7: Make ranking context-aware**

In `artifacts/api-server/src/services/newsHub/ranking.ts`, replace the gold/USD-only quality regex with broader financial relevance:

```ts
const FINANCE_RE = /\b(gold|silver|xau|xag|bullion|dollar|usd|dxy|euro|eur|pound|sterling|gbp|yen|jpy|franc|chf|cad|aud|nzd|bitcoin|btc|ethereum|eth|nasdaq|dow|s&p|treasury|yield|fed|fomc|ecb|boe|boj|snb|boc|rba|rbnz|inflation|cpi|pce|jobs|payroll|gdp|pmi|rates?|central\s+bank|oil|risk.?off|risk.?on)\b/i;
```

Keep source cap and dedupe behavior unchanged.

- [ ] **Step 8: Run focused tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/intelligence.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/ranking.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add artifacts/api-server/src/services/newsHub/intelligence.ts artifacts/api-server/src/services/newsHub/intelligence.test.ts artifacts/api-server/src/services/newsHub/ranking.ts artifacts/api-server/src/services/newsHub/ranking.test.ts
git commit -m "feat: classify news across selected instruments"
```

---

### Task 4: Wire Query Plans into API Collection and Macro Adapter

**Files:**
- Modify: `artifacts/api-server/src/services/newsHub/types.ts`
- Modify: `artifacts/api-server/src/routes/news.ts`
- Modify: `artifacts/api-server/src/services/newsHub/macroNewsAdapter.ts`
- Modify: `artifacts/api-server/src/services/newsHub/macroNewsAdapter.test.ts`
- Modify: `artifacts/api-server/src/services/newsHub/socketServer.test.ts`
- Modify: `lib/api-spec/openapi.yaml`

- [ ] **Step 1: Add failing macro adapter tests**

Update `artifacts/api-server/src/services/newsHub/macroNewsAdapter.test.ts`:

```ts
assert.equal(pairsFromMacroCurrencies("USD,XAU"), "XAUUSD");
assert.equal(pairsFromMacroCurrencies("EUR,USD"), "EURUSD");
assert.equal(pairsFromMacroCurrencies("AUD,USD,JPY"), "AUDUSD,USDJPY");
assert.equal(pairsFromMacroCurrencies("BTC,USD,NAS100"), "BTCUSD,NAS100");
assert.equal(pairsFromMacroCurrencies(""), "");
```

Keep the existing `macroNewsFromNewsHub` assertions.

- [ ] **Step 2: Add failing non-XAU socket assertion**

In `artifacts/api-server/src/services/newsHub/socketServer.test.ts`, add a second client after the XAU assertions or create a second scenario:

```ts
const eurReceived: NewsEvent[] = [];
const eurSocket = new WebSocket(`ws://127.0.0.1:${address.port}/api/news/ws`);
eurSocket.on("message", (raw) => eurReceived.push(JSON.parse(String(raw)) as NewsEvent));
await new Promise<void>((resolve, reject) => {
  eurSocket.once("open", resolve);
  eurSocket.once("error", reject);
});
eurSocket.send(JSON.stringify({ type: "subscribe", pairs: "EURUSD", lang: "it" }));
await new Promise<void>((resolve, reject) => {
  const started = Date.now();
  const interval = setInterval(() => {
    if (eurReceived.some((event) => event.type === "news_snapshot")) {
      clearInterval(interval);
      resolve();
    } else if (Date.now() - started > 3000) {
      clearInterval(interval);
      reject(new Error("Timed out waiting for EUR news snapshot"));
    }
  }, 25);
});
const eurSnapshots = eurReceived.filter((event): event is Extract<NewsEvent, { type: "news_snapshot" }> => event.type === "news_snapshot");
assert.equal(eurSnapshots[0]?.snapshot.watchedPairs?.[0], "EUR/USD");
assert.equal(eurSnapshots[0]?.snapshot.articles[0]?.affectedPairs?.[0], "EUR/USD");
eurSocket.close();
```

- [ ] **Step 3: Run focused tests and verify at least macro adapter fails**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/macroNewsAdapter.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/socketServer.test.ts
```

Expected: macro adapter FAILS because it returns only one pair for multi-currency input.

- [ ] **Step 4: Add coverage metadata types**

Update `artifacts/api-server/src/services/newsHub/types.ts`:

```ts
export interface NewsCoverageStatus {
  pair: string;
  directCount: number;
  fallbackCount: number;
  state: "direct" | "low_coverage" | "global_fallback" | "error";
  queries?: string[];
}

export interface NewsResponse {
  articles: NewsArticle[];
  fetchedAt: string;
  hasApiKey: boolean;
  source: "ai" | "rss";
  agentSummary?: string;
  watchedPairs?: string[];
  coverage?: NewsCoverageStatus[];
  nextRefreshAt?: string;
  providerStatuses?: NewsProviderStatus[];
  freshArticlesCount?: number;
  fallbackArticlesCount?: number;
  oldestFreshArticleAt?: string;
  freshnessWindowHours?: number;
}
```

- [ ] **Step 5: Wire query plan into `/api/news`**

In `artifacts/api-server/src/routes/news.ts`:

1. Import helpers:

```ts
import { buildSelectedPairProfiles } from "../services/newsHub/pairProfiles.js";
import { buildNewsQueryPlan, newsQueryCacheKey } from "../services/newsHub/queryPlan.js";
```

2. Change `buildGoogleNewsQueries(pairCurrencies, pairsStr)` to `buildGoogleNewsQueries(pairCurrencies, pairsStr, lang)` and replace its internals so it uses `buildSelectedPairProfiles(pairsStr)` and `buildNewsQueryPlan(profiles, { maxQueries: 18, lang })`. Keep `googleNewsUrl(query)` unchanged.

3. In `getNewsData`, derive:

```ts
const pairProfiles = buildSelectedPairProfiles(pairsStr);
const pairCurrencies = pairsToCurrencies(pairsStr);
const baseCacheKey = newsQueryCacheKey(pairProfiles, lang);
const cacheKey = baseCacheKey;
```

4. Replace the RSS call:

```ts
const rssArticles = await fetchRSSNews(pairCurrencies.length > 0 ? pairCurrencies : ["USD", "XAU"], pairsStr, lang);
```

5. Change `fetchRSSNews` signature:

```ts
async function fetchRSSNews(pairCurrencies: string[], pairsStr: string, lang: string): Promise<NewsArticle[]> {
  const profiles = buildSelectedPairProfiles(pairsStr);
  const plan = buildNewsQueryPlan(profiles, { maxQueries: 18, lang });
  const googleFeeds = plan.queries.map((query) => ({ url: googleNewsUrl(query), source: "Google News" }));
  // Keep existing static RSS feeds after googleFeeds.
}
```

- [ ] **Step 6: Add coverage output**

In `getNewsData`, after `articles` is finalized, compute:

```ts
const watchedPairs = pairProfiles.length
  ? pairProfiles.map((profile) => profile.label)
  : pairsStr
    ? pairsStr.split(",").map((p) => {
        const s = p.trim();
        return s.length === 6 ? `${s.slice(0, 3)}/${s.slice(3)}` : s;
      }).filter(Boolean)
    : [];

const coverage = watchedPairs.map((pair) => {
  const directCount = articles.filter((article) => article.affectedPairs?.includes(pair) && !article.isFallback).length;
  const fallbackCount = articles.filter((article) => article.affectedPairs?.includes(pair) && article.isFallback).length;
  return {
    pair,
    directCount,
    fallbackCount,
    state: directCount >= 3 ? "direct" as const : directCount > 0 ? "low_coverage" as const : fallbackCount > 0 ? "global_fallback" as const : "error" as const,
  };
});
```

Add `coverage` to `result`.

- [ ] **Step 7: Fix macro currency to pair conversion**

Update `artifacts/api-server/src/services/newsHub/macroNewsAdapter.ts`:

```ts
import { PAIR_CATALOG } from "@workspace/pair-catalog";

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function pairsFromMacroCurrencies(currenciesRaw: string): string {
  const currencies = new Set(currenciesRaw.split(",").map((currency) => currency.trim().toUpperCase()).filter(Boolean));
  if (currencies.size === 0) return "";

  const indexSymbols = PAIR_CATALOG
    .filter((pair) => pair.category === "index" && currencies.has(pair.symbol))
    .map((pair) => pair.symbol);

  const usdPairs = PAIR_CATALOG
    .filter((pair) => pair.category !== "index" && pair.currencies.includes("USD") && pair.currencies.every((currency) => currencies.has(currency)))
    .map((pair) => pair.symbol);

  const crossPairs = PAIR_CATALOG
    .filter((pair) => pair.category !== "index" && !pair.currencies.includes("USD") && pair.currencies.every((currency) => currencies.has(currency)))
    .map((pair) => pair.symbol);

  const matches = unique([...usdPairs, ...indexSymbols, ...crossPairs]);

  if (currencies.has("XAU") && currencies.has("USD") && matches.includes("XAUUSD")) {
    return ["XAUUSD", ...matches.filter((symbol) => symbol !== "XAUUSD")].slice(0, 8).join(",");
  }
  return matches.slice(0, 8).join(",");
}
```

- [ ] **Step 8: Update OpenAPI source description**

In `lib/api-spec/openapi.yaml`, find `/api/news` and update summary/params to selected-instrument wording. The resulting block must include query parameters:

```yaml
      summary: Get macro news for selected trading instruments
      parameters:
        - in: query
          name: pairs
          schema:
            type: string
          description: Comma-separated pair symbols such as EURUSD,XAUUSD,NAS100.
        - in: query
          name: lang
          schema:
            type: string
            enum: [it, en, es, fr, de]
        - in: query
          name: nocache
          schema:
            type: string
            enum: ["1"]
```

- [ ] **Step 9: Run focused tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/macroNewsAdapter.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/socketServer.test.ts
pnpm --filter @workspace/api-server run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add artifacts/api-server/src/services/newsHub/types.ts artifacts/api-server/src/routes/news.ts artifacts/api-server/src/services/newsHub/macroNewsAdapter.ts artifacts/api-server/src/services/newsHub/macroNewsAdapter.test.ts artifacts/api-server/src/services/newsHub/socketServer.test.ts lib/api-spec/openapi.yaml
git commit -m "feat: collect news for selected pairs"
```

---

### Task 5: Dedicated News Page and Ticker Entry Point

**Files:**
- Modify: `artifacts/trader-dashboard/src/components/MacroNewsTicker.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/News.tsx`
- Modify: `artifacts/trader-dashboard/src/components/BottomNav.tsx`
- Modify: `artifacts/trader-dashboard/src/lib/i18n.ts`

- [ ] **Step 1: Update frontend news types**

In `artifacts/trader-dashboard/src/pages/News.tsx`, extend local `NewsData`:

```ts
interface NewsCoverageStatus {
  pair: string;
  directCount: number;
  fallbackCount: number;
  state: "direct" | "low_coverage" | "global_fallback" | "error";
  queries?: string[];
}

interface NewsData {
  articles: Article[];
  fetchedAt: string;
  hasApiKey: boolean;
  source?: string;
  agentSummary?: string;
  watchedPairs?: string[];
  coverage?: NewsCoverageStatus[];
  nextRefreshAt?: string;
  providerStatuses?: NewsProviderStatus[];
  freshArticlesCount?: number;
  fallbackArticlesCount?: number;
  oldestFreshArticleAt?: string;
  freshnessWindowHours?: number;
}
```

- [ ] **Step 2: Add coverage badges to `/news`**

In `News.tsx`, add helper component near the existing badge helpers:

```tsx
function CoverageBadge({ status }: { status: NewsCoverageStatus }) {
  const cls =
    status.state === "direct"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : status.state === "low_coverage"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : status.state === "global_fallback"
          ? "border-sky-500/30 bg-sky-500/10 text-sky-300"
          : "border-red-500/30 bg-red-500/10 text-red-300";
  const label =
    status.state === "direct"
      ? "Copertura ok"
      : status.state === "low_coverage"
        ? "Copertura bassa"
        : status.state === "global_fallback"
          ? "Fallback macro"
          : "Da verificare";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${cls}`}>
      <span className="font-mono">{status.pair}</span>
      <span>{label}</span>
      <span className="opacity-70">{status.directCount}+{status.fallbackCount}</span>
    </span>
  );
}
```

Render it below the meta bar:

```tsx
{newsData?.coverage && newsData.coverage.length > 0 && (
  <div className="flex flex-wrap gap-2">
    {newsData.coverage.map((status) => <CoverageBadge key={status.pair} status={status} />)}
  </div>
)}
```

- [ ] **Step 3: Convert desktop article detail from modal-first to inline panel**

Keep `NewsDetailDialog` for mobile and keyboard fallback, but add a desktop detail panel beside the list.

In `News.tsx`, wrap the news sections in:

```tsx
<div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
  <div className="space-y-6">
    {/* existing recent/fallback sections */}
  </div>
  <aside className="hidden xl:block sticky top-20 rounded-lg border border-border/40 bg-card/70 p-4">
    {selectedArticle ? (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <FreshnessBadge article={selectedArticle} />
          {selectedArticle.impactScore && <ImpactScore score={selectedArticle.impactScore} />}
          <SentimentBadge sentiment={selectedArticle.sentiment} />
        </div>
        <h2 className="text-lg font-bold leading-snug">{selectedArticle.title}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{selectedArticle.summary}</p>
        {(selectedArticle.relevanceReason ?? selectedArticle.impactReason) && (
          <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 text-sm text-muted-foreground">
            {selectedArticle.relevanceReason ?? selectedArticle.impactReason}
          </div>
        )}
      </div>
    ) : (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Seleziona una notizia per leggere impatto e fonti.
      </div>
    )}
  </aside>
</div>
```

Change `ArticleCard` click behavior so it still calls `setSelectedArticle`; keep the existing `NewsDetailDialog` only for non-xl screens by rendering:

```tsx
<div className="xl:hidden">
  <NewsDetailDialog article={selectedArticle} open={Boolean(selectedArticle)} onOpenChange={(open) => !open && setSelectedArticle(null)} />
</div>
```

- [ ] **Step 4: Make ticker navigate to `/news`**

In `artifacts/trader-dashboard/src/components/MacroNewsTicker.tsx`:

1. Import `useLocation`:

```ts
import { useLocation } from "wouter";
```

2. In `MacroNewsTicker`, add:

```ts
const [, setLocation] = useLocation();
```

3. Replace the top-level ticker click:

```tsx
onClick={() => setLocation("/news")}
```

4. Do not render `Sheet` on desktop. The simplest acceptable implementation is to remove the `Sheet` tree entirely and keep `MacroNewsDetailDialog` unreachable from the ticker preview. If mobile sheet is retained, guard it with a mobile media check and still use `/news` for desktop.

- [ ] **Step 5: Add News to desktop secondary navigation**

In `artifacts/trader-dashboard/src/components/BottomNav.tsx`, import `Newspaper` from `lucide-react` and add News to `SECONDARY_ITEMS`:

```ts
import { LayoutDashboard, BookOpen, MessageCircle, Wrench, Brain, BrainCircuit, Settings, FlaskConical, Sunrise, Newspaper } from "lucide-react";

const SECONDARY_ITEMS = [
  { href: "/news", icon: Newspaper, labelKey: "nav.news" },
  { href: "/brain", icon: BrainCircuit, labelKey: "nav.brain" },
  { href: "/routine", icon: Sunrise, labelKey: "nav.routine" },
  { href: "/backtest", icon: FlaskConical, labelKey: "nav.backtest" },
  { href: "/settings", icon: Settings, labelKey: "nav.settings" },
] as const;
```

Keep mobile primary nav at five items.

- [ ] **Step 6: Update XAU-only i18n copy**

In `artifacts/trader-dashboard/src/lib/i18n.ts`, replace each `news.subtitle` value:

```ts
"news.subtitle": "News live per i tuoi strumenti selezionati.",
"news.subtitle": "Live news for your selected instruments.",
"news.subtitle": "Noticias en vivo para tus instrumentos seleccionados.",
"news.subtitle": "Actualités en direct pour vos instruments sélectionnés.",
"news.subtitle": "Live-Nachrichten für deine ausgewählten Instrumente.",
```

- [ ] **Step 7: Run frontend typecheck and build**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run typecheck
pnpm --filter @workspace/trader-dashboard run build
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add artifacts/trader-dashboard/src/components/MacroNewsTicker.tsx artifacts/trader-dashboard/src/pages/News.tsx artifacts/trader-dashboard/src/components/BottomNav.tsx artifacts/trader-dashboard/src/lib/i18n.ts
git commit -m "feat: make news page the primary feed workspace"
```

---

### Task 6: Full Verification and Runtime Smoke

**Files:**
- No planned source edits. Fix only failures directly caused by Tasks 1-5.

- [ ] **Step 1: Run full test suite**

Run:

```bash
pnpm run test
```

Expected: PASS. If failures occur, inspect failures and fix only regressions caused by this feature.

- [ ] **Step 2: Run workspace typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run dashboard build**

Run:

```bash
pnpm --filter @workspace/trader-dashboard run build
```

Expected: PASS.

- [ ] **Step 4: Run API server typecheck**

Run:

```bash
pnpm --filter @workspace/api-server run typecheck
```

Expected: PASS.

- [ ] **Step 5: Manual selected-pair smoke**

Start the local app:

```bash
pnpm run start:local
```

Open the dashboard and set selected pairs to include:

```text
EURUSD, USDJPY, AUDUSD, XAGUSD, BTCUSD, NAS100, XAUUSD
```

Manual expectations:

- `/news` requests `/api/news?pairs=EURUSD,USDJPY,AUDUSD,XAGUSD,BTCUSD,NAS100,XAUUSD&lang=<current>`;
- coverage badges appear for non-XAU pairs;
- XAU still returns relevant gold/dollar/yield articles;
- non-XAU articles appear when feeds provide them;
- low coverage pairs show fallback/low coverage state instead of a silent empty page;
- clicking the top ticker navigates to `/news`;
- no desktop bottom sheet opens from the ticker.

- [ ] **Step 6: Commit verification fixes if needed**

If Task 6 required fixes, inspect `git status --short`, add only the files changed by those fixes, then commit:

```bash
git status --short
git add path/to/fixed-file.ts path/to/fixed-test.ts
git commit -m "fix: stabilize all-pairs news feed"
```

If no fixes were needed, do not create an empty commit.
