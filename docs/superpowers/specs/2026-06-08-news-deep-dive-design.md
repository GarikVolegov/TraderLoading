# News Deep Dive Design

## Context

The news feed already enriches articles with trading metadata:

- `impactScore`;
- `impactReason`;
- `relevanceReason`;
- `affectedPairs`;
- `primaryAssets`;
- `impactDirection`;
- `matchConfidence`.

The current detail dialog shows one compact "Impatto per il trading" block. The user wants a richer explanation for each feed item, split into:

- cosa e' successo;
- perche' influenza il determinato asset;
- come puo' impattare.

The approved direction is to build this without AI or LLM dependency. The feature should be deterministic, fast, and available even when external AI services are disabled.

## Goals

- Add a richer per-article analysis section in the news detail view.
- Structure the explanation into three predictable sections:
  - `whatHappened`;
  - `whyItMatters`;
  - `possibleImpact`.
- Generate those sections with local rules and existing article metadata.
- Preserve the existing summary, badges, affected pairs, source links, and original-text section.
- Keep the API backward-compatible for existing clients.
- Avoid adding new external services or runtime dependencies.

## Non-Goals

- Do not generate the deep dive with AI.
- Do not create a new on-demand endpoint.
- Do not change the source collection strategy.
- Do not remove the current `impactReason` or `relevanceReason` fields.
- Do not claim certainty when direction or affected assets are unclear.

## Data Model

Add an optional object to the shared news article shape:

```ts
interface NewsDeepDive {
  whatHappened: string;
  whyItMatters: string;
  possibleImpact: string;
}

interface NewsArticle {
  deepDive?: NewsDeepDive;
}
```

The field should be added consistently in:

- `artifacts/api-server/src/services/newsHub/types.ts`;
- the local `NewsArticle` route interface in `artifacts/api-server/src/routes/news.ts`;
- `artifacts/trader-dashboard/src/lib/newsApi.ts`.

Generated API clients only need updates if the current OpenAPI surface is used for this route. If the hand-written client remains the source of truth, update the source spec opportunistically but do not block the implementation on regeneration.

## Deep Dive Generation

Create a small deterministic helper in the News Hub layer, for example:

`artifacts/api-server/src/services/newsHub/deepDive.ts`

The helper should expose:

```ts
buildNewsDeepDive(article, context): NewsDeepDive
```

The helper should use:

- title and summary for `whatHappened`;
- `relevanceReason`, `impactReason`, `primaryAssets`, and `affectedPairs` for `whyItMatters`;
- `impactScore`, `impactDirection`, `sentiment`, and affected pairs for `possibleImpact`.

Rules should be conservative:

- If the article has a clear direction, describe it as a possible bullish or bearish pressure, not a guaranteed move.
- If direction is `mixed` or `neutral`, describe likely volatility or uncertainty.
- If affected pairs are present, name them explicitly.
- If only assets are present, name assets instead of pairs.
- If no useful relevance reason exists, fall back to a generic but honest macro explanation.

The helper should support at least Italian and English. Italian is the default user-facing language for this app.

## Suggested Copy Logic

`whatHappened`

- Prefer a concise sentence derived from `summary` when it is different from the title.
- If the summary is missing or duplicates the title, use the title as the event description.
- Keep the text short and readable.

`whyItMatters`

- Prefer `relevanceReason`.
- Fall back to `impactReason`.
- Add affected pair or asset context when available.
- Avoid duplicate pair names when the reason already contains them.

`possibleImpact`

- High score and bearish direction:
  - "Potrebbe aumentare la pressione ribassista su X, soprattutto se il mercato conferma il driver macro."
- High score and bullish direction:
  - "Potrebbe sostenere X e aumentare la probabilita' di movimenti direzionali."
- Mixed or neutral:
  - "Potrebbe aumentare la volatilita' senza una direzione immediata chiara."
- Low score:
  - "Impatto probabilmente limitato, ma utile da monitorare se si somma ad altri driver."

Exact copy can vary, but the tone must stay practical and non-predictive.

## API Flow

In `getNewsData`, after existing enrichment, classification, freshness, ranking, and final sorting, map the final article corpus through the deep dive helper.

The deep dive should be present for:

- regular HTTP responses;
- paginated article pages;
- WebSocket snapshots;
- WebSocket live article events that originate from the same enriched snapshot flow.

If an external provider injects a live article through `ingestArticle` without enrichment, the runtime may emit it without `deepDive`. The frontend must handle the field as optional.

## Frontend Experience

In `NewsDetailDialog`, replace or expand the current single "Impatto per il trading" panel with three compact sections:

- `Cosa e' successo`;
- `Perche' influenza l'asset`;
- `Come puo' impattare`.

Each section should show a short paragraph. If `deepDive` is missing, keep the current fallback behavior using `relevanceReason` or `impactReason`.

The article card can keep its current compact "Perche' rilevante" expander. The richer three-part explanation belongs in the dialog, not in every card, so the feed remains scannable.

## Error Handling

- Missing `deepDive`: show the existing single impact explanation if available.
- Missing impact explanation: show only summary, affected pairs, and source links.
- Missing affected pairs: phrase impact in terms of assets or general market volatility.
- Unknown direction: use cautious neutral copy.

No request should fail because deep dive generation fails. The helper should not throw for malformed or incomplete articles.

## Testing

Backend tests should cover:

- `buildNewsDeepDive` creates all three sections for a clear Fed/USD/XAU article;
- bullish, bearish, mixed, and neutral directions produce cautious but distinct `possibleImpact` copy;
- affected pairs are included when available;
- missing summary, impact reason, and affected pairs still produce safe copy;
- Italian and English output paths work.

Frontend tests should cover:

- `NewsDetailDialog` renders the three deep dive headings when `deepDive` exists;
- the dialog falls back to the old single explanation when `deepDive` is absent;
- article cards remain compact and do not render the full deep dive inline.

## Verification

- `pnpm --filter @workspace/api-server run test`
- `pnpm --filter @workspace/api-server run typecheck`
- `pnpm --filter @workspace/trader-dashboard run typecheck`
- `pnpm --filter @workspace/trader-dashboard run build`

## Self-Review

- No AI dependency is introduced.
- The data model is optional and backward-compatible.
- The UI keeps dense feed cards and moves richer analysis into the detail dialog.
- The copy avoids pretending to forecast the market with certainty.
- Missing data paths are handled without throwing.
