# Super Curated News Selection Design

## Context

The current News Hub already collects provider articles, enriches them with trading metadata, removes stale items, and applies a deterministic trading relevance gate.

The requested behavior is stricter: provider output must be treated as raw material, not as the final feed. The product should show only a small set of highly selected articles that are useful for trading decisions.

## Approved Direction

Use a deterministic composite curation score after the existing collection, enrichment, dedupe, ranking, recency, and trading relevance steps.

This keeps the system predictable, testable, and independent from LLM availability while making the final feed much more selective.

## Goals

- Show only the best news, not every provider article.
- Prefer articles with clear trading usefulness over generic financial commentary.
- Use the user's selected pairs and strong macro drivers as primary relevance signals.
- Limit visible news to a curated set:
  - maximum 40 articles in `/api/news`, returned in chronological (newest-first) order so the feed reads as a timeline of the most important news, with a floor of 10 (the curation threshold relaxes to backfill the floor on quiet days, never with stale/fallback items);
  - maximum 3 articles in the macro ticker adapter, ordered by curation score.

> Amendment (2026-06-09, after the first implementation): the original "maximum 5
> articles in `/api/news`" conflicted with the chronological infinite-scroll feed
> and with the requirement that the feed always contains at least the most
> important news. The route now uses `limit: 40`, `minKeep: 10`,
> `sort: "chronological"`. The ticker keeps `limit: 3` score-ordered.

> Amendment (2026-06-10, quality hardening): curation gained (a) hard title
> exclusions for price-forecast listicles, evergreen explainers, question
> op-eds, time-to-buy advice, key-level/technical clickbait and local-market
> rate-today content (₹/Nifty/FCNR); (b) a corporate/single-stock noise penalty
> (dividends, earnings, mining deals) plus a low-match-confidence penalty;
> (c) per-language near-duplicate dedupe (Jaccard ≥ 0.6 on translated titles OR
> original titles, publisher suffix stripped); (d) a fallback-tier last resort
> so quiet days never produce an empty feed (stale stays excluded). Upstream,
> enrichment/classification now run on the original English text instead of the
> translation, the LLM impact score is no longer overwritten by rule scores, and
> per-user personalization only hides downvoted articles (re-ranking would break
> the chronological guarantee).
- Keep excluded articles out of the user-facing feed.
- Make the selection rule easy to test and tune.

## Non-Goals

- Do not add a new paid provider.
- Do not make final selection depend on an AI model.
- Do not change the public news response shape unless implementation needs optional debugging metadata.
- Do not remove the existing trading-grade gate; the curation score should sit after it.

## Architecture

Add a focused helper:

`artifacts/api-server/src/services/newsHub/curation.ts`

The helper should expose:

```ts
scoreCuratedNewsArticle(article, options): NewsCurationScore
selectCuratedNews(articles, options): NewsArticle[]
```

`selectCuratedNews` should:

1. Score each already-relevant article.
2. Drop articles below a minimum curation score.
3. Penalize generic or weakly actionable articles.
4. Preserve only the strongest article per near-duplicate topic.
5. Sort by curation score, with published time as a tie-breaker.
6. Return at most `limit` articles.

Use it in:

- `artifacts/api-server/src/routes/news.ts`, after `filterTradingDecisionRelevantNews`;
- `artifacts/api-server/src/services/newsHub/macroNewsAdapter.ts`, after requested-pair filtering and trading relevance filtering.

## Composite Score

Start each article at 0 and add or subtract signals. The initial threshold is `8`.

Positive signals:

- `impactScore >= 9`: `+5`;
- `impactScore >= 8`: `+4`;
- `impactScore >= 6`: `+2`;
- `matchConfidence >= 0.8`: `+3`;
- `matchConfidence >= 0.6`: `+2`;
- selected pair appears in `affectedPairs`: `+4`;
- strong macro driver appears in title, summary, `impactReason`, or `relevanceReason`: `+3`;
- `freshnessTier` is `live`: `+2`;
- `freshnessTier` is `fresh`: `+1`;
- article is verified or has usable source/citation URLs: `+1`;
- source is a known financial or institutional source: `+1`;
- article has a concrete event, data release, central bank decision, geopolitical shock, or market-moving policy catalyst: `+2`.

Negative signals:

- `impactScore < 5`: `-4`;
- missing `matchConfidence`: `-2`;
- `freshnessTier` is `fallback`: `-3`;
- `freshnessTier` is `stale`: `-5`;
- generic wording such as market update, price forecast, what to watch, traders wait, mixed markets, live updates, or recap: `-4`;
- no selected pair relevance and no strong macro driver: `-5`;
- weak source attribution: `-2`;
- duplicate or near-duplicate topic already represented by a stronger article: exclude the weaker duplicate.

The first implementation should keep thresholds conservative:

- keep only articles with `curationScore >= 8`;
- apply max 5 for `/api/news`;
- apply max 3 for macro ticker.

## Data Flow

Provider articles remain raw inputs.

The backend flow becomes:

1. Fetch provider/RSS/AI-assisted articles.
2. Normalize and enrich article metadata.
3. Dedupe and rank by existing News Hub logic.
4. Apply freshness filtering.
5. Apply trading relevance filtering.
6. Apply composite curation selection.
7. Build deep dive metadata for the final visible set.
8. Return only curated articles to the UI.

## Error Handling

If curation removes everything, return an empty curated feed with the existing response metadata. Do not backfill weak provider articles just to fill space.

The macro ticker summary should use the existing empty-state language when no article passes curation.

If an article has missing optional metadata, score it conservatively rather than throwing.

## Testing

Add:

`artifacts/api-server/src/services/newsHub/curation.test.ts`

Cover:

- high-impact selected-pair article is kept;
- medium generic provider article is dropped;
- stale/fallback article is penalized below threshold;
- fresh macro-driver article is kept;
- duplicate topics keep only the stronger article;
- max limit is enforced;
- output order follows curation score.

Extend:

- `artifacts/api-server/src/services/newsHub/macroNewsAdapter.test.ts`

Cover:

- macro ticker returns only the top curated subset;
- generic medium-impact articles do not leak through the adapter.

Verification commands:

```bash
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/curation.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/tradingRelevance.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/macroNewsAdapter.test.ts
pnpm --filter @workspace/api-server exec tsx src/services/newsHub/newsHubRuntime.test.ts
pnpm --filter @workspace/api-server run typecheck
```

## Self-Review

- The design is focused on deterministic selection, not provider replacement.
- The curation layer is after existing relevance work, so it narrows rather than duplicates the pipeline.
- Limits are explicit: 5 for `/api/news`, 3 for ticker.
- Empty results are allowed when nothing is good enough.
- Tests cover scoring, exclusion, dedupe, ordering, and adapter integration.
