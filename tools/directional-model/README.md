# Directional research: eight pairs, four hours

This tool produces research candidates and reproducible scientific reports. It does not enable live probabilities. The API separately checks trusted artifact/report hashes, historical evidence, and at least 500 prospective nonoverlapping outcomes per pair over at least 183 days, with at least 75 observations in each class. Software fixtures are always synthetic and fail authorization, regardless of their scores.

Pairs: EURUSD, GBPUSD, USDJPY, USDCHF, AUDUSD, USDCAD, NZDUSD, XAUUSD. Canonical prices are Dukascopy **bid** M1. Yahoo futures, TwelveData, broker prices, and spot quotes from other sources must not be combined in a training series. No provider API key or paid service is needed by this CLI.

## Install and test

From the repository root:

```sh
python3 -m venv tools/directional-model/.venv
tools/directional-model/.venv/bin/python -m pip install -r tools/directional-model/requirements.txt
tools/directional-model/.venv/bin/python tools/directional-model/test_directional.py
```

Python 3.9+ is supported. Dependencies are pinned; numpy 1.26.4 avoids numerical warning issues observed with the macOS ARM numpy 2.0 wheel. Model fitting uses one BLAS thread. Standard-library protocol tests also run without the optional ML environment; the sklearn integration test then reports a skip.

## Actual evidence and calendar

Current normal-hours source: [Dukascopy trading hours](https://www.dukascopy.com/swiss/english/forex/forex-trading-accounts/link/). New York local time carries US DST: the weekly FX session is Sunday 17:00 through Friday 17:00; gold has a daily 17:00–18:00 maintenance break. Exceptional holidays/closures require reviewed source evidence. [OPM holiday schedules](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/) help identify US federal holidays, but an OPM holiday list alone does not prove Dukascopy's instrument-specific session. Unknown closure coverage means abstention. These references were supplied by the runtime implementation; this offline tool does not fetch or certify an unreviewed calendar.

Provide a reviewed JSON exception document with `verifiedFrom`, `verifiedUntil`, `reviewedAt`, `sourceUrls` (including Dukascopy), and `closedIntervals:[{pair,start,end}]`. `pair` is one of the eight symbols or `*`; timestamps carry UTC offsets. The reviewed period must include all relevant exceptional closures. An empty list is acceptable only when the reviewer has verified there are no exceptions in that period; the CLI cannot infer completeness from an empty array.

```sh
shasum -a 256 reviewed-official-exceptions.json
tools/directional-model/.venv/bin/python tools/directional-model/directional.py calendar-review \
  --exceptions reviewed-official-exceptions.json --exceptions-sha256 REVIEWED_SHA256 \
  --start 2026-10-01T00:00:00Z --end 2026-11-01T00:00:00Z \
  --output tools/directional-model/output/calendar.json
```

The command reports the exact calendar hash to pin. It checks date coverage, source URL, review time, hash, and interval validity. It does not fabricate holidays or establish market access/licensing. A historical price backfill requires a separately reviewed calendar spanning the historical period; a current calendar cannot silently authorize five years of history.

## Build research data from M1

Input JSONL is strictly chronological per pair, with no duplicate minutes:

```json
{"pair":"EURUSD","time":1767571200,"open":1.1,"high":1.101,"low":1.099,"close":1.1,"source":"dukascopy_bid","provenance":"historical_research"}
```

`time` is the UTC bar-open Unix second, divisible by 60. Export the warehouse using its source ID filter; do not use the public candle endpoint with fallback providers. This CLI is a streaming derivation step, not a provider downloader or DB mutator.

```sh
tools/directional-model/.venv/bin/python tools/directional-model/directional.py build-dataset \
  --input verified-dukascopy-m1.jsonl --output tools/directional-model/output/prices.jsonl \
  --calendar reviewed-historical-calendar.json --calendar-sha256 REVIEWED_CALENDAR_SHA256 \
  --pairs EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD,NZDUSD,XAUUSD
```

H1 requires all 60 canonical M1 bars; no synthetic gap filling is performed. Reference and target prices require exact endpoint minutes, and the target requires all 240 M1 minutes. Missing outcomes remain unresolved and are counted. Research backfills never fabricate `availableAt` or `issuedAt` in the past. Historical M1 imports cannot establish historical news availability.

## Database snapshot JSONL

The API exporter supplies the same resolved feature-row format. A single leading header declares provenance and feature order:

```json
{"type":"metadata","schema":"directional-dataset-v1","provenance":"prospective","source":"dukascopy_bid","featureOrder":["return1h","return4h","return24h","volatility120h","range20h","hourSin","hourCos"]}
```

Rows require `pair`, `cutoffAt`, `targetEnd`, `features` (seven numbers), `outcome`, `source`, matching `provenance`, and immutable `inputHash`. Prospective rows also require real `issuedAt` and `resolvedAt`. Optional price fields (`referencePrice`, `referenceObservedAt`, `finalPrice`, `delta`) are checked against the outcome when supplied. `availableAt`/`featureObservedAt`, when supplied, must not be after the cutoff. Unresolved rows are counted and excluded. Future actual outcomes, duplicate cutoffs, conflicting provenance, and incompatible feature/source schemas fail the run.

The cohort is fixed **before outcomes**: UTC hours 00/04/08/12/16/20, minute zero, four hours of calendar time. Return is `log(finalBid/referenceBid)`; the neutral band is `0.5 * sampleStd(last120 valid H1 log returns)`. The standard deviation never concatenates a weekend or maintenance gap into a one-hour return. This is a statistical direction target, not net trade profitability.

## Train and inspect

```sh
tools/directional-model/.venv/bin/python tools/directional-model/directional.py train \
  --input tools/directional-model/output/prices.jsonl \
  --output tools/directional-model/output/candidates \
  --pairs EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD,NZDUSD,XAUUSD
```

Each pair has independent multinomial logistic L2 fitting. Scaler fitting uses train only. Regularization `C` is selected from 0.01/0.1/1/10/100 on a purged temporal split inside train. Temperature calibration uses the separate calibration block. No class balancing or outcome-dependent sample selection is applied. Baseline frequencies use add-one smoothing on train only.

Outer windows: 24 calendar months train, three months calibration, three months test, advancing three months. At least two complete walk-forward windows must precede the final untouched holdout. Holdout spans at least six calendar months and 185 days so that endpoint purging can still meet the independent 183-day observed-span gate. Every label must end before its next split boundary. `trainedThrough` includes the last calibration outcome, not just model coefficient fitting. Models and scalers are not refit using holdout outcomes. Five years of coherent data is the default research objective, but missing coverage stops candidate creation.

Reports include multiclass and per-class Brier, log-loss, train-frequency baseline, class counts, ten adaptive equal-count calibration bins (minimum 50 samples per bin), and paired whole-UTC-week bootstrap uncertainty (2,000 draws, fixed seed). The scalar gate uses `p <= .05/8`, a conservative Bonferroni bound when a full eight-pair Holm family is unavailable. Log-loss noninferiority margin is zero. Historical pass requires actual research/prospective provenance, 500 observations, 75/class, 183 days, ECE ≤ .05/class, positive lower 95% Brier-improvement bound, significance, and no log-loss deterioration. All metrics and failed gates remain in the report. Predictive accuracy does not establish profitability after spread, slippage, and risk limits.

Outputs:

| File | Purpose |
| --- | --- |
| `PAIR.json` | TS inference artifact, including training-frequency baseline |
| `PAIR.validation.json` | Scientific evidence; SHA256 is embedded in the artifact |
| `PAIR.parity.json` | Golden probability vectors from reordered sklearn logits |
| `training-run.json` | Run hashes, failures, provenance, and `liveApproved:false` |

Model class order is explicitly **up/flat/down**, independent of sklearn's alphabetic class order. `datasetHash` hashes exact price JSONL bytes; a macro run hashes price bytes + a null separator + macro bytes, with both file hashes reported separately. Supply `--created-at UTC_TIMESTAMP` for byte-for-byte deterministic reports on the same pinned runtime. The API must verify the report bytes and reevaluate evidence; `historicalValidation.passed` alone authorizes nothing. Trusted file hashes are configured by the reviewed deployment process, not automatically added by this CLI.

## Macro increment, only with genuine coverage

Optional `--macro-input macro-pit.jsonl` creates profile `price_macro_v1` and appends `macroEvents4h`, `macroSurprise4h`, `macroConflict4h`. Both price and macro observations must be prospective. A macro row requires `pair`, `cutoffAt`, real `availableAt <= cutoffAt`, `coverageFrom <= cutoffAt-4h`, actual `coverageUntil <= cutoffAt` no older than 15 minutes, `maxGapMinutes <= 15`, `inputHash`, `provenance:"prospective"`, and three finite feature values. This explicitly describes sampled pipeline coverage, not a tick-complete news archive. Unknown consensus/surprise is not zero. Missing records and uncovered windows are excluded, with counts; no zero-filled macro corpus is invented.

Macro fitting and price-only fitting use the **same matched rows and identical temporal windows**. The report's holdout and every walk-forward window include `priceOnly`: technical reference Brier/log-loss plus the paired macro improvement CI/p-value. Top-level `report.priceOnly` has the same metric schema as holdout, placing the technical reference in `baselineBrier`/`baselineLogLoss`; the artifact embeds `priceOnlyModel` for runtime comparisons. The macro gate must beat both train frequencies and this technical reference, with no log-loss deterioration against either. Runtime sources are `dukascopy_bid` and `macro_pit_v1`. Short prospective history truthfully produces no macro candidate; it cannot be repaired with historical titles or future revisions.

## Synthetic integration fixture

```sh
tools/directional-model/.venv/bin/python tools/directional-model/generate_fixture.py \
  --output tools/directional-model/output/synthetic.jsonl
tools/directional-model/.venv/bin/python tools/directional-model/directional.py train \
  --input tools/directional-model/output/synthetic.jsonl \
  --output tools/directional-model/output/synthetic-artifacts --pairs EURUSD \
  --created-at 2026-10-10T00:00:00Z
```

The fixture intentionally makes software checks easy. It proves splitting, fitting, calibration, serialization, parity, and synthetic rejection. Its results say nothing about financial market performance. Generated versions start `synthetic-`, report provenance is `synthetic`, historical pass is false, and live approval stays false.

Regenerate the checked-in seven- and ten-feature parity vectors with:

```sh
tools/directional-model/.venv/bin/python tools/directional-model/generate_parity_fixtures.py \
  --input tools/directional-model/output/synthetic.jsonl \
  --output tools/directional-model/fixtures/synthetic
```

That test-only generator refuses real datasets. Its artificial macro values are deliberately label-correlated; they prove feature order and parity, not extraction or predictive utility. The production macro training command retains the strict prospective coverage checks.
