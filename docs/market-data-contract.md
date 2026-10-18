# Market data: availability and provenance

These existing endpoints are off-contract (not generated from OpenAPI). Consumers:
`SentimentWidget`, `VolatilityWidget`; the metadata UI is `MarketDataStatus`.
The generated settings and `/journal/edge` contracts are unchanged. No DB migration.

## GET /api/tools/sentiment

HTTP 200 also represents a provider that is unavailable. Existing fields `symbols`,
`live`, `cached`, `fallback`, `hasCredentials` remain; `symbols` contains only actual
provider results. `fallback` is always false. No synthetic outlook is returned.

Additional fields:

| Field | Meaning |
| --- | --- |
| `status` | `available`, `stale`, or `unavailable` |
| `source` | `myfxbook` |
| `fetchedAt` | ISO timestamp of the last successful provider response; null without usable data |
| `observedAt` | null: the current adapter receives no timestamp for the underlying observation |
| `reason` | null, `not_configured`, or `provider_unavailable` |

`live` is a legacy successful-retrieval flag, not proof of the age of the observation.
The UI labels successful responses “Dati disponibili”, not “LIVE”. `cached` is true
only when serving last-good data following failure. Provider failures, empty responses
and invalid percentages do not overwrite last-good data or change its timestamp.
No credentials: no outbound request and empty unavailable response. A previous valid
response can be used for at most 24 hours, always marked stale. After that, or after a
process restart with an outage, `symbols=[]`. Concurrent requests share one fetch.
Provider error details are not reflected to clients.

## GET /api/tools/volatility?pair=EURUSD

Successful responses retain all existing metric fields and add:

| Field | Meaning |
| --- | --- |
| `status` | `available` or `stale` |
| `source` | Actual source returned by the candle service; may be `warehouse` or a fallback provider |
| `fetchedAt` | ISO timestamp of the candle provider retrieval, preserved across cache reads |
| `observedAt` | Opening time of the last valid D1 candle, **not** a last-tick timestamp |
| `observationStart` | Opening time of the first candle used for the averages |
| `timeframe` | `D1` |
| `cached` | Whether the snapshot is stale (failed refresh, age or old observation) |

A last daily candle belonging to a previous UTC bar date is always marked stale,
even if retrieval succeeded just now. Cache expiry also marks data stale. Neither
case is presented as an actionable green ADR state. Cache reads never rewrite timestamps.
This daily-bar check is independent of the Europe/Rome day used by personal discipline.

Cold cache: HTTP 503, `status=unavailable`, `source/fetchedAt/observedAt/observationStart=null`,
`timeframe=D1`, plus the existing error message. The UI retries in 10 seconds and provides
manual retry. Unsupported pair: existing HTTP 400 behavior. Normal polling: 15 minutes.
Volatility cache: 30 minutes fresh, 7 days Redis fallback; process last-good is also kept
until restart. Versioned cache keys prevent legacy entries without provenance being reused.

The series is sorted, invalid/future candles are excluded, and the lookback is limited
to 366 days. Fewer than five usable bars fails instead of silently measuring old history.
An ADR denominator <=0, a negative range or non-finite value is unavailable, not zero.
A valid zero range remains 0%. Existing visualization thresholds and 100% cap are unchanged.

## Selection and operational checks

No favorites: the existing default instruments/currencies can be shown. Explicit
selection: only the supported intersection is shown, with the missing symbols listed.
An entirely unsupported selection never substitutes unrelated markets. Disabled news
and watchlist queries do not send an empty filter that the server would interpret as “all”.
Pair-filtered requests wait for saved settings to load; unknown saved symbols are retained
as unsupported filter tokens instead of being converted into an absent selection.

Pair preferences commit to query cache and workspace only after a successful PUT.
Failure keeps the previous committed selection and the editable draft. Pending saves
are locked against duplicate submission. This behavior also applies to onboarding.

`RiskGuardPanel` consumes the existing `/journal/edge` generated query on both home and
journal, sharing its cache and 30-second refresh. It never recomputes thresholds. Failed
refreshes explicitly show that checking is unavailable; any previous alerts remain with
the original evaluation timestamp. No alert is not a trade authorization: the scope is
available closed trades, and no trades today is explicitly disclosed. Checklist completion
is independent of risk-guard results.

September 24 follow-up: volatility now requests candle retrievals within 30 minutes,
rejects a failed-refresh candle fallback and preserves the provider timestamp.
Nested caches cannot silently renew the age. The unified context requests a
5-minute cache maximum; see `docs/audit/pair-context-v1.md`.
