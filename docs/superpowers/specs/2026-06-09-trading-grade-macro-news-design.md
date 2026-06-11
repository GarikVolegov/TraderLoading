# Trading Grade Macro News Design

## Context

The News Hub already assigns every article trading metadata such as `impactScore`, `affectedPairs`, `primaryAssets`, `matchConfidence`, `impactReason`, and `deepDive`.

The current feed can still admit medium-impact generic market items. The user wants the macroeconomic news feed to protect attention: show only strong news, or medium-strength news that can influence decisions around economic calendar events.

## Approved Direction

Use a deterministic backend relevance gate before articles reach the macro ticker or the `/news` response.

## Goals

- Keep high-impact articles.
- Keep medium-impact articles only when they mention economic calendar decision drivers.
- Drop low-impact or generic market commentary even when it is finance-related.
- Apply the same rule to the News Hub response and the macro-news adapter.
- Keep the rule local, testable, and independent from LLM availability.

## Trading Relevance Rule

An article is trading-grade when either condition is true:

- `impactScore >= 8`;
- `impactScore >= 5` and the article mentions a calendar/decision driver.

Calendar/decision drivers include:

- central banks and rate decisions: Fed, FOMC, ECB, BoE, BoJ, SNB, BoC, RBA, RBNZ, rate decision, hike, cut, minutes, speakers;
- scheduled macro data: CPI, PCE, PPI, NFP, payrolls, jobs report, unemployment, GDP, PMI, retail sales;
- market expectations around calendar events: forecast, expectations, priced, yields, Treasury yields, inflation expectations.

The helper should inspect title, summary, original title/summary, `impactReason`, and `relevanceReason`.

## Implementation

Create `artifacts/api-server/src/services/newsHub/tradingRelevance.ts`.

Use it in:

- `artifacts/api-server/src/routes/news.ts`, after ranking and recency filtering;
- `artifacts/api-server/src/services/newsHub/macroNewsAdapter.ts`, so cached or adapter-only snapshots are still filtered.

## Testing

Add `artifacts/api-server/src/services/newsHub/tradingRelevance.test.ts`.

Cover:

- high-impact articles are kept;
- medium CPI/Fed/calendar articles are kept;
- medium generic price commentary is dropped;
- low-impact articles are dropped;
- filtering preserves original order of kept articles.

## Verification

- `pnpm --filter @workspace/api-server exec tsx src/services/newsHub/tradingRelevance.test.ts`
- `pnpm --filter @workspace/api-server exec tsx src/services/newsHub/macroNewsAdapter.test.ts`
- `pnpm --filter @workspace/api-server exec tsx src/services/newsHub/intelligence.test.ts`
- `pnpm --filter @workspace/api-server run typecheck`

## Self-Review

- No LLM dependency is introduced.
- The rule is strict enough to reduce feed noise.
- Medium-impact news is still allowed when it can affect economic-calendar trading decisions.
- Existing metadata fields are reused; no API shape change is required.
