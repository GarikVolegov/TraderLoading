# Trading Grade Macro News Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter the macro news feed to only show high-impact articles or medium-impact calendar/decision-driver articles.

**Architecture:** Add a pure News Hub helper that classifies articles as trading-grade using existing `NewsArticle` metadata. Apply it after News Hub ranking and again in the macro-news adapter as a compatibility guard.

**Tech Stack:** TypeScript, Node `assert`, `tsx`, existing News Hub services.

---

### Task 1: Trading Relevance Helper

**Files:**
- Create: `artifacts/api-server/src/services/newsHub/tradingRelevance.ts`
- Test: `artifacts/api-server/src/services/newsHub/tradingRelevance.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import type { NewsArticle } from "./types.js";
import { filterTradingDecisionRelevantNews, isTradingDecisionRelevantNews } from "./tradingRelevance.js";

function article(title: string, input: Partial<NewsArticle> = {}): NewsArticle {
  return {
    title,
    summary: input.summary ?? title,
    source: "TestWire",
    publishedAt: "2026-06-09T10:00:00.000Z",
    url: "https://example.com/news",
    sentiment: null,
    imageUrl: null,
    ...input,
  };
}

assert.equal(isTradingDecisionRelevantNews(article("Fed rate decision sends dollar higher", { impactScore: 9 })), true);
assert.equal(isTradingDecisionRelevantNews(article("US CPI preview lifts Treasury yields", { impactScore: 6 })), true);
assert.equal(isTradingDecisionRelevantNews(article("Gold price update as traders wait", { impactScore: 6 })), false);
assert.equal(isTradingDecisionRelevantNews(article("Minor market recap", { impactScore: 4 })), false);

const filtered = filterTradingDecisionRelevantNews([
  article("Gold price update as traders wait", { impactScore: 6 }),
  article("US CPI preview lifts Treasury yields", { impactScore: 6 }),
  article("Central bank emergency decision shocks markets", { impactScore: 8 }),
]);
assert.deepEqual(filtered.map((item) => item.title), [
  "US CPI preview lifts Treasury yields",
  "Central bank emergency decision shocks markets",
]);

console.log("news trading relevance checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @workspace/api-server exec tsx src/services/newsHub/tradingRelevance.test.ts`

Expected: FAIL because `tradingRelevance.js` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `tradingRelevance.ts` with:

```ts
import type { NewsArticle } from "./types.js";

const HIGH_IMPACT_SCORE = 8;
const MEDIUM_IMPACT_SCORE = 5;

const CALENDAR_DECISION_DRIVER_RE =
  /\b(fed|fomc|powell|ecb|lagarde|boe|boj|snb|boc|rba|rbnz|central\s+bank|rate\s+(decision|hike|cut|change)|interest\s+rates?|minutes|speaker|cpi|pce|ppi|inflation|non.?farm|nfp|payrolls?|jobs?\s+report|unemployment|gdp|pmi|retail\s+sales|treasury\s+yields?|bond\s+yields?|forecast|expectations?|priced|prices?\s+in)\b/i;

function articleDecisionText(article: NewsArticle): string {
  return [
    article.title,
    article.summary,
    article.originalTitle,
    article.originalSummary,
    article.impactReason,
    article.relevanceReason,
  ].filter(Boolean).join(" ");
}

export function isCalendarDecisionDriverNews(article: NewsArticle): boolean {
  return CALENDAR_DECISION_DRIVER_RE.test(articleDecisionText(article));
}

export function isTradingDecisionRelevantNews(article: NewsArticle): boolean {
  const score = article.impactScore ?? 0;
  if (score >= HIGH_IMPACT_SCORE) return true;
  return score >= MEDIUM_IMPACT_SCORE && isCalendarDecisionDriverNews(article);
}

export function filterTradingDecisionRelevantNews(articles: NewsArticle[]): NewsArticle[] {
  return articles.filter(isTradingDecisionRelevantNews);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @workspace/api-server exec tsx src/services/newsHub/tradingRelevance.test.ts`

Expected: PASS and prints `news trading relevance checks passed`.

### Task 2: Apply Filter To News Hub And Macro Adapter

**Files:**
- Modify: `artifacts/api-server/src/routes/news.ts`
- Modify: `artifacts/api-server/src/services/newsHub/macroNewsAdapter.ts`
- Test: `artifacts/api-server/src/services/newsHub/macroNewsAdapter.test.ts`

- [ ] **Step 1: Add adapter regression test**

Extend `macroNewsAdapter.test.ts` with a snapshot containing a medium generic article and a medium CPI article. Assert the generic article is removed and CPI article remains.

- [ ] **Step 2: Run adapter test to verify it fails**

Run: `pnpm --filter @workspace/api-server exec tsx src/services/newsHub/macroNewsAdapter.test.ts`

Expected: FAIL because the medium generic article is still present.

- [ ] **Step 3: Apply the helper**

Import `filterTradingDecisionRelevantNews` in `routes/news.ts` and `macroNewsAdapter.ts`.

In `routes/news.ts`, after the recency filter picks `articles`, run:

```ts
articles = filterTradingDecisionRelevantNews(articles);
```

In `macroNewsAdapter.ts`, change `kept` to filter both requested-pair relevance and trading relevance.

- [ ] **Step 4: Run focused tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/tradingRelevance.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/macroNewsAdapter.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/intelligence.test.ts
```

Expected: all pass.

### Task 3: Typecheck

**Files:**
- No additional files.

- [ ] **Step 1: Run API typecheck**

Run: `pnpm --filter @workspace/api-server run typecheck`

Expected: exit code 0.

## Self-Review

- The plan covers helper creation, endpoint integration, adapter compatibility, tests, and typecheck.
- No API response schema changes are required.
- The filter is deterministic and does not depend on AI services.
