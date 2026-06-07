# News Feed All Pairs Design

## Context

TraderLoadings already has a news stack, but its effective coverage is too narrow.

Current behavior:

- `/api/news` fetches RSS/Google News data, enriches it, filters it, ranks it, and returns a `NewsResponse`;
- `/api/news/ws` streams snapshots and live article events from the same News Hub runtime;
- `/api/tools/macro-news` adapts News Hub data for the top navigation macro ticker;
- `/news` is already a dedicated page, but it is not promoted strongly in navigation;
- the top navigation ticker opens a bottom sheet, which wastes desktop space and feels like the wrong container for a dense news workflow;
- the user's selected instruments are stored as `selectedPairs` and can be converted to currencies through `@workspace/pair-catalog`.

The problem is not only presentation. Search and capture are weak for most countries and instruments. XAU/USD works best because the backend has gold-specific query generation, classification rules, and ranking bias. Many other currencies and instruments have few or no relevant articles because the collection and intelligence layers are not pair-first.

## Approved Direction

The approved direction is **A. Strengthen the current pipeline**.

The feed should remain focused on the user's selected instruments, not the whole catalog. It should use the current RSS/Google News/Groq-optional architecture, but make query generation, classification, ranking, and fallback coverage work across all selected pairs.

External paid providers or AI search providers are out of scope for this design. The architecture should leave extension points for them, but this implementation must improve coverage with the existing stack first.

## Goals

- Make the news feed work for every selected instrument in the current pair catalog, not only XAU/USD.
- Increase captured article volume for countries, currencies, metals, indices, and crypto without flooding the UI with unrelated market articles.
- Keep the system efficient through bounded query generation, cache keys, dedupe, source caps, and request timeouts.
- Turn `/news` into the primary news workspace.
- Make the top navigation ticker a preview and entry point to `/news`, not a desktop bottom sheet.
- Preserve XAU/USD behavior while broadening coverage.

## Non-Goals

- Do not add paid provider dependencies.
- Do not scrape pages outside RSS/Google News style feeds.
- Do not build a full editorial CMS.
- Do not show the entire catalog by default when the user selected a smaller watchlist.
- Do not remove `/api/tools/macro-news` unless a compatibility replacement is provided.

## Data Model and Pair Profiles

The pipeline should derive a normalized profile from each selected symbol.

`pair-catalog` should normalize incoming symbols before lookup:

- `eurusd`, `EURUSD`, `EUR/USD`, and `eur/usd` all resolve to `EURUSD`;
- surrounding spaces are ignored;
- unknown symbols are preserved as normalized uppercase strings but marked as unknown.

Each known pair profile includes:

- canonical symbol, such as `EURUSD`;
- display label, such as `EUR/USD`;
- category, such as forex major, metal, index, or crypto;
- assets/currencies, such as `EUR` and `USD`;
- country or region hints where applicable;
- institution hints where applicable, such as ECB, Fed, BoE, BoJ, SNB, BoC, RBA, and RBNZ;
- query keywords;
- indirect macro drivers.

This data can live in `pair-catalog` if it is broadly reusable, or in a focused News Hub helper if it is news-specific. The important boundary is that query generation and classification share the same normalized pair profile instead of maintaining separate partial keyword lists.

## News Collection

The collection layer should become pair-first.

For each selected pair, generate a bounded set of queries:

- direct pair query, for example `EURUSD forex when:2d`;
- display pair query, for example `"EUR/USD" forex when:2d`;
- base asset query, for example `ECB euro rate decision when:2d`;
- quote asset query, for example `Federal Reserve dollar yields when:2d`;
- macro data query for relevant countries or regions, for example `Eurozone CPI ECB euro when:2d`;
- category-specific query for metals, indices, or crypto.

Examples:

- `EURUSD`: euro, ECB, eurozone inflation, Fed, dollar, yields;
- `GBPUSD`: pound, BoE, UK CPI, Fed, dollar;
- `USDJPY`: yen, BoJ, Japan inflation, Fed, dollar, intervention;
- `AUDUSD`: aussie, RBA, Australia inflation, China demand, Fed;
- `USDCAD`: Canadian dollar, BoC, oil, Fed;
- `XAGUSD`: silver, precious metals, industrial demand, Fed, dollar;
- `BTCUSD`: bitcoin, crypto regulation, ETF flows, dollar liquidity;
- `NAS100`: Nasdaq, tech stocks, Fed, yields, risk appetite.

Efficiency rules:

- cap generated Google News queries per request;
- dedupe identical query strings before fetching;
- run feed requests concurrently with timeout protection;
- keep RSS source caps;
- dedupe articles by URL, resolved URL, and normalized title;
- cache by normalized pair profile set and language;
- keep `nocache=1` and WebSocket `force` behavior.

If no pair is selected, the feed may fall back to the current broad macro default, but selected-pair mode is the primary path.

## Classification and Ranking

`newsHub/intelligence.ts` should classify relevance for all supported instruments.

The current XAU indirect rules should become a general rule system:

- central bank rules for Fed, ECB, BoE, BoJ, SNB, BoC, RBA, RBNZ;
- macro data rules for CPI, PCE, NFP/jobs, GDP, PMI, unemployment, retail sales;
- risk rules for geopolitical conflict, sanctions, elections, trade tensions, and safe-haven flow;
- yield and rate differential rules;
- commodity rules for gold, silver, oil-sensitive CAD, and broad metals;
- crypto rules for BTC/ETH, regulation, ETF flows, liquidity, and risk appetite;
- index rules for US30/NAS100/SPX500 based on rates, earnings risk, tech sentiment, and broad risk-on/risk-off.

Every classified article should include:

- `primaryAssets`;
- `affectedPairs`;
- `impactScore`;
- `impactDirection`;
- `matchConfidence`;
- `relevanceReason`;
- `impactReason`.

Ranking should be context-aware. A Fed headline is not only a gold headline: it can be relevant for `EURUSD`, `USDJPY`, `NAS100`, `BTCUSD`, and `XAUUSD`, but the affected pair and reason should be different for each watchlist.

The current gold/USD-heavy finance quality filter should be replaced or parameterized so it does not suppress relevant non-XAU articles.

## Fallback Coverage

Some countries and instruments naturally have low feed coverage. The UI and backend should make that visible instead of silently returning an empty feed.

For each selected pair, the response should be able to expose a coverage state:

- enough direct news;
- low direct coverage with macro fallback;
- no direct coverage with global market fallback;
- feed/provider error.

Fallback articles should be marked with `isFallback` and lower confidence. They may still be useful when a country has few recent headlines.

The response may include attempted query metadata for debugging and UI transparency, but the UI should keep it compact.

## API Behavior

`GET /api/news` continues to support:

- `pairs`;
- `lang`;
- `nocache=1`.

`/api/news/ws` continues to support:

- `subscribe`;
- `refresh`;
- `pairs`;
- `lang`;
- `force`.

`/api/tools/macro-news` should keep working for the top navigation ticker. Internally, it should use the improved News Hub logic instead of reducing currencies to a single XAU-first pair. If it receives currency filters derived from selected pairs, it should preserve broad relevance for those selected pairs.

OpenAPI and generated clients should be updated only if implementation starts using generated hooks for the news page or if the current API spec blocks type safety. At minimum, the source spec should no longer describe `/api/news` as gold/dollar-only.

## User Experience

`/news` becomes the primary news workspace.

The page should show:

- selected instrument filters derived from user preferences;
- coverage status by instrument;
- live/fallback/provider status;
- refresh control with loading state;
- recent articles;
- fallback articles separated from fresh direct hits;
- clear article details with source links, affected pairs, confidence, and impact reason.

The top navigation ticker remains a compact preview. Clicking it navigates to `/news`. It should not open a bottom sheet on desktop. A mobile sheet can remain only if it does not replace the dedicated page as the main experience.

The preferred desktop layout is an inbox-style workspace:

- filters/instruments on the left;
- article list in the main column;
- selected article detail on the right.

On mobile, the same content collapses into stacked sections or tabs.

## Error Handling

Feed failures should be isolated:

- one failed RSS feed should not fail the full request;
- one failed query should not prevent other query results;
- failed translation should fall back to original English text;
- failed Groq enrichment should fall back to heuristic enrichment;
- WebSocket errors should leave HTTP refresh usable.

The UI should distinguish:

- loading;
- refreshing existing data;
- low coverage;
- provider error;
- no selected pairs.

## Testing

Backend tests should cover:

- pair normalization for slash, lowercase, and spaced input;
- query generation for `EURUSD`, `GBPUSD`, `USDJPY`, `AUDUSD`, `USDCAD`, `XAGUSD`, `BTCUSD`, `NAS100`, and `XAUUSD`;
- classification for non-XAU macro headlines;
- XAU regression cases;
- context-aware ranking that does not suppress non-XAU assets;
- low-coverage fallback tagging;
- macro adapter behavior for selected currencies without XAU;
- WebSocket filtering for non-XAU pairs.

Frontend tests should cover:

- `/news` fetches with selected pairs and language;
- ticker click navigates to `/news`;
- desktop page renders without the macro bottom sheet as the primary container;
- low coverage and fallback states are visible;
- article detail remains accessible by keyboard.

## Verification

- `pnpm --filter @workspace/pair-catalog run typecheck`
- `pnpm --filter @workspace/api-server run test`
- `pnpm --filter @workspace/api-server run typecheck`
- `pnpm --filter @workspace/trader-dashboard run typecheck`
- `pnpm --filter @workspace/trader-dashboard run build`
- targeted manual check with selected pairs including `EURUSD`, `USDJPY`, `AUDUSD`, `XAGUSD`, `BTCUSD`, and `XAUUSD`

## Self-Review

- No incomplete markers remain.
- Scope is focused on existing pipeline improvement and a dedicated news workspace.
- The design keeps selected pairs as the primary filter.
- The design preserves XAU behavior while expanding coverage.
- External provider integration is explicitly out of scope.
- Testing covers backend capture/classification and frontend presentation.
