# Super Curated News Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic curation layer so provider news is treated as raw input and the user-facing feed shows only a small, high-quality selection.

**Architecture:** Add a focused News Hub helper that scores already-relevant articles with a composite curation score, removes weak/generic/duplicate items, and enforces strict limits. Apply it after the existing trading relevance gate in `/api/news` and after pair/trading filtering in the macro news adapter.

**Tech Stack:** TypeScript, Node `assert`, `tsx`, existing News Hub services.

---

## File Structure

- Create `artifacts/api-server/src/services/newsHub/curation.ts`: pure scoring and selection helper. It has no I/O and can be tested directly.
- Create `artifacts/api-server/src/services/newsHub/curation.test.ts`: focused unit tests for score thresholding, penalties, dedupe, limit, and ordering.
- Modify `artifacts/api-server/src/routes/news.ts`: call curation after `filterTradingDecisionRelevantNews` with `limit: 5`.
- Modify `artifacts/api-server/src/services/newsHub/macroNewsAdapter.ts`: call curation with `limit: 3` after existing requested-pair and trading relevance filtering.
- Modify `artifacts/api-server/src/services/newsHub/macroNewsAdapter.test.ts`: assert generic articles do not leak and ticker output is capped at 3 curated articles.

### Task 1: Curation Helper

**Files:**
- Create: `artifacts/api-server/src/services/newsHub/curation.ts`
- Test: `artifacts/api-server/src/services/newsHub/curation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `artifacts/api-server/src/services/newsHub/curation.test.ts`:

```ts
import assert from "node:assert/strict";
import type { NewsArticle } from "./types.js";
import { scoreCuratedNewsArticle, selectCuratedNews } from "./curation.js";

function article(title: string, input: Partial<NewsArticle> = {}): NewsArticle {
  return {
    title,
    summary: input.summary ?? title,
    source: input.source ?? "Reuters",
    publishedAt: input.publishedAt ?? "2026-06-09T10:00:00.000Z",
    url: input.url ?? "https://example.com/news",
    sentiment: input.sentiment ?? null,
    imageUrl: input.imageUrl ?? null,
    affectedPairs: input.affectedPairs ?? ["XAU/USD"],
    primaryAssets: input.primaryAssets ?? ["XAU", "USD"],
    impactScore: input.impactScore ?? 8,
    matchConfidence: input.matchConfidence ?? 0.82,
    freshnessTier: input.freshnessTier ?? "fresh",
    verified: input.verified ?? true,
    impactReason: input.impactReason,
    relevanceReason: input.relevanceReason,
    originalTitle: input.originalTitle,
    originalSummary: input.originalSummary,
    impactDirection: input.impactDirection,
    isFallback: input.isFallback,
    qualityScore: input.qualityScore,
    deepDive: input.deepDive,
    sources: input.sources,
    citationUrls: input.citationUrls,
    resolvedUrl: input.resolvedUrl,
    sourceUrl: input.sourceUrl,
  };
}

const selectedPair = article("US CPI surprise sends Treasury yields higher", {
  summary: "Inflation data reprices Fed expectations and pressures XAU/USD.",
  impactReason: "CPI is a direct driver for USD yields and gold volatility.",
});
assert.equal(selectCuratedNews([selectedPair], { pairs: "XAUUSD" }).length, 1);
assert.ok(scoreCuratedNewsArticle(selectedPair, { pairs: "XAUUSD" }).score >= 8);

const genericMedium = article("Gold price update as traders wait for direction", {
  summary: "Spot gold moves sideways in quiet trade.",
  impactScore: 6,
  matchConfidence: 0.7,
  impactReason: "Generic market commentary.",
});
assert.equal(selectCuratedNews([genericMedium], { pairs: "XAUUSD" }).length, 0);

const fallbackArticle = article("Fed rate decision shocks dollar markets", {
  summary: "The decision moves yields and FX volatility.",
  freshnessTier: "fallback",
  isFallback: true,
});
assert.equal(selectCuratedNews([fallbackArticle], { pairs: "XAUUSD" }).length, 0);

const macroDriver = article("ECB rate decision lifts euro volatility", {
  summary: "The central bank decision changes rate expectations for EUR/USD.",
  affectedPairs: ["EUR/USD"],
  primaryAssets: ["EUR", "USD"],
  impactScore: 8,
  matchConfidence: 0.78,
});
assert.equal(selectCuratedNews([macroDriver], { pairs: "EURUSD" }).length, 1);

const duplicateWeak = article("US CPI surprise pushes Treasury yields higher", {
  summary: "Markets react to inflation data.",
  impactScore: 8,
  matchConfidence: 0.62,
  publishedAt: "2026-06-09T10:01:00.000Z",
});
const duplicateStrong = article("US CPI surprise pushes Treasury yields higher", {
  summary: "Inflation reprices Fed expectations and directly affects XAU/USD.",
  impactScore: 9,
  matchConfidence: 0.9,
  publishedAt: "2026-06-09T10:02:00.000Z",
});
const deduped = selectCuratedNews([duplicateWeak, duplicateStrong], { pairs: "XAUUSD" });
assert.equal(deduped.length, 1);
assert.equal(deduped[0]?.impactScore, 9);

const ranked = selectCuratedNews([
  article("Fed minutes show inflation concern", {
    summary: "Officials remain focused on sticky inflation.",
    impactScore: 8,
    matchConfidence: 0.8,
    publishedAt: "2026-06-09T10:00:00.000Z",
  }),
  article("US jobs report triggers dollar breakout", {
    summary: "Payrolls surprise changes Fed expectations for XAU/USD.",
    impactScore: 9,
    matchConfidence: 0.92,
    publishedAt: "2026-06-09T09:59:00.000Z",
  }),
], { pairs: "XAUUSD" });
assert.equal(ranked[0]?.title, "US jobs report triggers dollar breakout");

const limited = selectCuratedNews([
  article("US CPI surprise sends Treasury yields higher"),
  article("Fed minutes show inflation concern", { summary: "FOMC minutes move dollar expectations." }),
  article("Payrolls surprise drives dollar volatility", { summary: "NFP changes rate expectations." }),
  article("Powell warns inflation remains sticky", { summary: "Fed comments move Treasury yields." }),
], { pairs: "XAUUSD", limit: 3 });
assert.equal(limited.length, 3);

console.log("news curation checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/curation.test.ts
```

Expected: FAIL because `./curation.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `artifacts/api-server/src/services/newsHub/curation.ts`:

```ts
import type { NewsArticle } from "./types.js";

const DEFAULT_MIN_SCORE = 8;
const DEFAULT_LIMIT = 5;

const MACRO_DRIVER_RE =
  /\b(fed|fomc|powell|ecb|lagarde|boe|boj|snb|boc|rba|rbnz|central\s+bank|rate\s+(decision|hike|cut|change)|interest\s+rates?|minutes|speaker|cpi|pce|ppi|inflation|non.?farm|nfp|payrolls?|jobs?\s+report|unemployment|gdp|pmi|retail\s+sales|treasury\s+yields?|bond\s+yields?|forecast|expectations?|priced|prices?\s+in)\b/i;

const CONCRETE_EVENT_RE =
  /\b(decision|surprise|unexpected|shock|breakout|data|release|report|minutes|speech|warns?|announces?|conflict|war|sanction|tariff|policy|geopolit|volatility)\b/i;

const GENERIC_NOISE_RE =
  /\b(market\s+update|price\s+update|price\s+forecast|what\s+to\s+watch|traders?\s+wait|mixed\s+markets?|live\s+updates?|recap|moves?\s+sideways|quiet\s+trade|holds?\s+steady)\b/i;

const TRUSTED_SOURCE_RE =
  /\b(reuters|bloomberg|associated\s+press|ap|cnbc|marketwatch|wall\s+street\s+journal|wsj|financial\s+times|ft|investing\.com|forexlive|fxstreet|dailyfx|federal\s+reserve|ecb|bank\s+of\s+england|bank\s+of\s+japan|bureau\s+of\s+labor\s+statistics|bls|bea)\b/i;

export interface NewsCurationOptions {
  pairs?: string;
  limit?: number;
  minScore?: number;
}

export interface NewsCurationScore {
  score: number;
  reasons: string[];
  penalties: string[];
  topicKey: string;
}

function articleText(article: NewsArticle): string {
  return [
    article.title,
    article.summary,
    article.originalTitle,
    article.originalSummary,
    article.impactReason,
    article.relevanceReason,
  ].filter(Boolean).join(" ");
}

function normalizePair(pair: string): string {
  const clean = pair.trim().toUpperCase().replace("/", "");
  return clean.length === 6 ? `${clean.slice(0, 3)}/${clean.slice(3)}` : pair.trim().toUpperCase();
}

function requestedPairs(options: NewsCurationOptions): string[] {
  return (options.pairs ?? "")
    .split(",")
    .map(normalizePair)
    .filter(Boolean);
}

function hasSelectedPair(article: NewsArticle, options: NewsCurationOptions): boolean {
  const selected = requestedPairs(options);
  if (selected.length === 0) return false;
  const affected = new Set((article.affectedPairs ?? []).map(normalizePair));
  return selected.some((pair) => affected.has(pair));
}

function hasUsableAttribution(article: NewsArticle): boolean {
  return Boolean(
    article.verified ||
    article.url ||
    article.resolvedUrl ||
    article.sourceUrl ||
    (article.citationUrls?.length ?? 0) > 0 ||
    (article.sources?.length ?? 0) > 0,
  );
}

function isTrustedSource(article: NewsArticle): boolean {
  return TRUSTED_SOURCE_RE.test([article.source, ...(article.sources ?? [])].join(" "));
}

function topicKey(article: NewsArticle): string {
  return article.title
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 8)
    .join(" ");
}

function publishedTime(article: NewsArticle): number {
  return article.publishedAt ? new Date(article.publishedAt).getTime() || 0 : 0;
}

export function scoreCuratedNewsArticle(article: NewsArticle, options: NewsCurationOptions = {}): NewsCurationScore {
  let score = 0;
  const reasons: string[] = [];
  const penalties: string[] = [];
  const impactScore = article.impactScore ?? 0;
  const matchConfidence = article.matchConfidence;
  const text = articleText(article);
  const selectedPair = hasSelectedPair(article, options);
  const hasMacroDriver = MACRO_DRIVER_RE.test(text);
  const hasConcreteEvent = CONCRETE_EVENT_RE.test(text);

  if (impactScore >= 9) {
    score += 5;
    reasons.push("impact-score-9");
  } else if (impactScore >= 8) {
    score += 4;
    reasons.push("impact-score-8");
  } else if (impactScore >= 6) {
    score += 2;
    reasons.push("impact-score-6");
  }

  if (typeof matchConfidence === "number" && matchConfidence >= 0.8) {
    score += 3;
    reasons.push("match-confidence-0.8");
  } else if (typeof matchConfidence === "number" && matchConfidence >= 0.6) {
    score += 2;
    reasons.push("match-confidence-0.6");
  }

  if (selectedPair) {
    score += 4;
    reasons.push("selected-pair");
  }

  if (hasMacroDriver) {
    score += 3;
    reasons.push("macro-driver");
  }

  if (article.freshnessTier === "live") {
    score += 2;
    reasons.push("live");
  } else if (article.freshnessTier === "fresh") {
    score += 1;
    reasons.push("fresh");
  }

  if (hasUsableAttribution(article)) {
    score += 1;
    reasons.push("attributed");
  }

  if (isTrustedSource(article)) {
    score += 1;
    reasons.push("trusted-source");
  }

  if (hasConcreteEvent) {
    score += 2;
    reasons.push("concrete-event");
  }

  if (impactScore < 5) {
    score -= 4;
    penalties.push("low-impact");
  }

  if (typeof matchConfidence !== "number") {
    score -= 2;
    penalties.push("missing-confidence");
  }

  if (article.freshnessTier === "fallback" || article.isFallback) {
    score -= 3;
    penalties.push("fallback");
  }

  if (article.freshnessTier === "stale") {
    score -= 5;
    penalties.push("stale");
  }

  if (GENERIC_NOISE_RE.test(text)) {
    score -= 4;
    penalties.push("generic-noise");
  }

  if (!selectedPair && !hasMacroDriver) {
    score -= 5;
    penalties.push("no-selected-pair-or-macro-driver");
  }

  if (!hasUsableAttribution(article)) {
    score -= 2;
    penalties.push("weak-attribution");
  }

  return { score, reasons, penalties, topicKey: topicKey(article) };
}

export function selectCuratedNews(articles: NewsArticle[], options: NewsCurationOptions = {}): NewsArticle[] {
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const strongestByTopic = new Map<string, { article: NewsArticle; curation: NewsCurationScore }>();

  for (const article of articles) {
    const curation = scoreCuratedNewsArticle(article, options);
    if (curation.score < minScore) continue;
    const existing = strongestByTopic.get(curation.topicKey);
    if (!existing || curation.score > existing.curation.score || (
      curation.score === existing.curation.score && publishedTime(article) > publishedTime(existing.article)
    )) {
      strongestByTopic.set(curation.topicKey, { article, curation });
    }
  }

  return Array.from(strongestByTopic.values())
    .sort((a, b) => {
      if (b.curation.score !== a.curation.score) return b.curation.score - a.curation.score;
      return publishedTime(b.article) - publishedTime(a.article);
    })
    .slice(0, limit)
    .map((entry) => entry.article);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/curation.test.ts
```

Expected: PASS and prints `news curation checks passed`.

- [ ] **Step 5: Commit**

Run:

```bash
git add artifacts/api-server/src/services/newsHub/curation.ts artifacts/api-server/src/services/newsHub/curation.test.ts
git commit -m "feat(news): add deterministic curation scoring"
```

Expected: commit succeeds with only the curation helper and test.

### Task 2: Apply Curation To `/api/news`

**Files:**
- Modify: `artifacts/api-server/src/routes/news.ts`
- Test: `artifacts/api-server/src/services/newsHub/curation.test.ts`

- [ ] **Step 1: Add the import**

In `artifacts/api-server/src/routes/news.ts`, add this import near the other News Hub service imports:

```ts
import { selectCuratedNews } from "../services/newsHub/curation.js";
```

- [ ] **Step 2: Apply selection after trading relevance**

In `buildNewsData`, replace:

```ts
articles = filterTradingDecisionRelevantNews(articles);
```

with:

```ts
articles = selectCuratedNews(filterTradingDecisionRelevantNews(articles), {
  pairs: pairsStr,
  limit: 5,
});
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/curation.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/tradingRelevance.test.ts
```

Expected: both pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add artifacts/api-server/src/routes/news.ts
git commit -m "feat(news): curate api news feed"
```

Expected: commit succeeds with only `routes/news.ts`.

### Task 3: Apply Curation To Macro News Adapter

**Files:**
- Modify: `artifacts/api-server/src/services/newsHub/macroNewsAdapter.ts`
- Modify: `artifacts/api-server/src/services/newsHub/macroNewsAdapter.test.ts`
- Test: `artifacts/api-server/src/services/newsHub/macroNewsAdapter.test.ts`

- [ ] **Step 1: Write the failing adapter regression test**

Append this block before the final `console.log("macro news adapter checks passed");` in `artifacts/api-server/src/services/newsHub/macroNewsAdapter.test.ts`:

```ts
const curatedSelectionSnapshot: NewsResponse = {
  ...news,
  articles: [
    {
      ...news.articles[0]!,
      title: "Gold price update as traders wait for direction",
      summary: "Spot gold moves sideways in quiet trade.",
      originalTitle: "Gold price update as traders wait for direction",
      originalSummary: "Spot gold moves sideways in quiet trade.",
      impactScore: 6,
      matchConfidence: 0.7,
      freshnessTier: "fresh",
      impactReason: "Generic market commentary.",
    },
    {
      ...news.articles[0]!,
      title: "US CPI surprise sends Treasury yields higher",
      summary: "Inflation data reprices Fed expectations and pressures XAU/USD.",
      originalTitle: "US CPI surprise sends Treasury yields higher",
      originalSummary: "Inflation data reprices Fed expectations and pressures XAU/USD.",
      impactScore: 9,
      matchConfidence: 0.9,
      freshnessTier: "fresh",
      impactReason: "CPI is a direct driver for USD yields and gold volatility.",
    },
    {
      ...news.articles[0]!,
      title: "Fed minutes show inflation concern",
      summary: "FOMC minutes move dollar and Treasury yield expectations.",
      originalTitle: "Fed minutes show inflation concern",
      originalSummary: "FOMC minutes move dollar and Treasury yield expectations.",
      impactScore: 8,
      matchConfidence: 0.84,
      freshnessTier: "fresh",
    },
    {
      ...news.articles[0]!,
      title: "Payrolls surprise drives dollar volatility",
      summary: "NFP changes rate expectations and moves XAU/USD risk.",
      originalTitle: "Payrolls surprise drives dollar volatility",
      originalSummary: "NFP changes rate expectations and moves XAU/USD risk.",
      impactScore: 8,
      matchConfidence: 0.82,
      freshnessTier: "fresh",
    },
    {
      ...news.articles[0]!,
      title: "Powell warns inflation remains sticky",
      summary: "Fed comments lift Treasury yields before the next rate decision.",
      originalTitle: "Powell warns inflation remains sticky",
      originalSummary: "Fed comments lift Treasury yields before the next rate decision.",
      impactScore: 8,
      matchConfidence: 0.8,
      freshnessTier: "fresh",
    },
  ],
};
const curatedMacro = macroNewsFromNewsHub(curatedSelectionSnapshot, { pairs: "XAUUSD" });
assert.equal(curatedMacro.articles.length, 3);
assert.equal(curatedMacro.articles.some((article) => /Gold price update/i.test(article.title)), false);
assert.equal(curatedMacro.articles[0]?.title, "US CPI surprise sends Treasury yields higher");
```

- [ ] **Step 2: Run adapter test to verify it fails**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/macroNewsAdapter.test.ts
```

Expected: FAIL because the adapter still returns more than 3 articles or still lets the generic article through.

- [ ] **Step 3: Import the curation helper**

In `artifacts/api-server/src/services/newsHub/macroNewsAdapter.ts`, add:

```ts
import { selectCuratedNews } from "./curation.js";
```

- [ ] **Step 4: Apply curation inside `macroNewsFromNewsHub`**

Replace the `kept` declaration:

```ts
const kept = news.articles.filter(
  (article) => !isExplicitlyOutsideRequestedPairs(article, options.pairs) && isTradingDecisionRelevantNews(article),
);
```

with:

```ts
const kept = selectCuratedNews(
  news.articles.filter(
    (article) => !isExplicitlyOutsideRequestedPairs(article, options.pairs) && isTradingDecisionRelevantNews(article),
  ),
  { pairs: options.pairs, limit: 3 },
);
```

- [ ] **Step 5: Run adapter test to verify it passes**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/macroNewsAdapter.test.ts
```

Expected: PASS and prints `macro news adapter checks passed`.

- [ ] **Step 6: Commit**

Run:

```bash
git add artifacts/api-server/src/services/newsHub/macroNewsAdapter.ts artifacts/api-server/src/services/newsHub/macroNewsAdapter.test.ts
git commit -m "feat(news): curate macro news ticker"
```

Expected: commit succeeds with only adapter files.

### Task 4: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused News Hub tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/curation.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/tradingRelevance.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/macroNewsAdapter.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/newsHubRuntime.test.ts
```

Expected: all commands exit code 0 and print their success messages.

- [ ] **Step 2: Run API typecheck**

Run:

```bash
pnpm --filter @workspace/api-server run typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Inspect working tree**

Run:

```bash
git status --short
```

Expected: only unrelated pre-existing workspace changes remain, or the tree is clean if this branch had no unrelated changes.

## Self-Review

- Spec coverage: Task 1 implements deterministic composite scoring, thresholding, dedupe, ordering, and limit. Task 2 applies max 5 to `/api/news`. Task 3 applies max 3 to the macro ticker and prevents generic provider articles from leaking. Task 4 verifies the focused News Hub tests and typecheck.
- Red-flag scan: no unresolved scaffolding language is present.
- Type consistency: the plan defines and uses `scoreCuratedNewsArticle`, `selectCuratedNews`, `NewsCurationOptions`, and `NewsCurationScore` consistently.
