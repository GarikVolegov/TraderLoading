# TraderLoading — Phase 1: Native Chart Foundation

Date: 2026-11-20
Status: PLAN ONLY — no application code changes in this phase.
Branch: codex/phase-1-native-chart-plan
Base: main @ 5e955481e76c0f2bb3af7fea0355463ab558fba1

## Objective

Make the existing proprietary chart engine the primary charting experience for discretionary analysis, without rebuilding components that already exist and without coupling chart delivery to live order execution.

The first implementation must deliver one reliable, persistent native chart workspace for XAUUSD, designed mobile-first and ready to expand to other instruments.

## Repository findings

The repository already contains:
- lightweight-charts v5.1 in artifacts/trader-dashboard/package.json.
- ChartReplay.tsx: candlesticks, historical replay, indicators, trade simulation and mobile controls.
- ChartAnalysisOverlay.tsx, ChartAnalysisToolbar.tsx, ChartAnalysisPanel.tsx: drawing/analysis overlay and controls.
- chartAnalysisTypes.ts and chartAnalysisPersistence.ts: drawing types and versioned local persistence.
- MtfContextChart.tsx and chartMtf.ts: higher-timeframe context chart.
- /api/backtest/candles and replayCandlesApi.ts: historical candle API.
- lib/db/src/schema/candles.ts and migration 0006_candle_warehouse.sql: Postgres candle warehouse schema.
- docs/superpowers/specs/2026-06-14-candle-warehouse-design.md: intended warehouse/ingestion design.

The published URL inspected on 2026-11-20 still exposes a TradingView external chart entry in its main workflow and warns that TradingView drawings are temporary. The native chart/replay code is currently clearly present in the repository's Backtest area. We must verify the deployed URL maps to this repository/build before assuming a code change will update that exact site.

## Phase 0 — Pre-implementation audit (required)

1. Trace the current production route and determine which build/deployment serves the supplied chatgpt.site URL.
2. Trace ChartReplay usage and identify what can be reused in a non-replay analysis mode.
3. Inspect persistence: determine which chart state is local-only, which state is account-synced, and whether drawings are keyed by user + instrument + timeframe.
4. Verify Candle Warehouse runtime status: migration applied, ingestion jobs active, supported symbols, actual date coverage, source attribution, and cache/fallback behavior.
5. Verify candle correctness: UTC/open-time convention, timeframe aggregation, gaps, duplicate timestamps, session boundaries, and whether volume is real tick-volume, exchange volume, estimated, or unavailable.
6. Run existing chart-related tests and the repository verification gate; record baseline failures before editing.
7. Record mobile behavior at iPhone viewport sizes and desktop behavior.

Deliverable: an audit note with a dependency map, verified deployment target, existing reusable components, data limitations, baseline test status, and a go/no-go decision.

## Phase 1 — Native Chart MVP (first implementation after Phase 0)

### User outcome

From the main trading workflow, the user can open a native chart, select XAUUSD, switch timeframes, inspect historical candles, draw and save zones/levels, and return later or on another device without losing the analysis.

### Scope

A. Native chart workspace
- Add a first-class Chart workspace to the primary app navigation/session flow.
- Reuse lightweight-charts and existing chart analysis components.
- Keep the existing TradingView link available as a temporary fallback during validation.
- Start with XAUUSD; keep symbol selection architecture-ready for EURUSD, GBPUSD, NAS100, BTCUSD.

B. Timeframes
- MVP: M5, M15, M30, H1, H4, D1, W1, matching current supported candle API.
- Do not expose M1 until the data source can guarantee adequate M1 coverage and quality.
- Preserve UTC timestamps internally; render session labels in Europe/Rome timezone.
- Timeframe changes must not silently change the selected market moment.

C. Analysis tools
- Reuse line, rectangle/zone and Fibonacci drawings.
- Add explicit semantic metadata to drawings where practical: drawing type, symbol, timeframe, price bounds, author, created/updated timestamps.
- Design the drawing model so future tags can represent HTF zone, liquidity, imbalance, POC, Test, JTC and BTI. Do not auto-detect these structures in Phase 1.
- Keep indicators optional; do not present estimated volume as real volume.

D. Persistence
- Move chart drawings/preferences from device-only storage to authenticated account persistence.
- Key state by user + normalized symbol + timeframe/workspace.
- Add versioned serialization and migration from current local state where safe.
- Show clear saved/saving/error status; never claim a save succeeded before server confirmation.
- Do not overwrite newer server state with stale local state.

E. Data integrity and transparency
- Display data source and last update time.
- Display explicit volume quality: real tick-volume, exchange volume, estimated, or unavailable.
- Show gaps and insufficient-history errors; never fabricate missing candles.
- Retain current provider fallback only where its limitations are visible and tested.
- Do not connect this MVP to live order placement.

### Out of scope

- MT5 live tick streaming and broker-specific price feed.
- Automated market-structure recognition.
- AI trade signals or probability scores.
- Automatic order placement.
- Full replay redesign (reuse existing replay where it is already sound).
- Replacing the entire trading cockpit visual design.

## Phase 1 implementation sequence

1. Confirm deployment target and runtime route.
2. Complete Phase 0 audit and baseline verification.
3. Define shared chart data contract and persistence schema/API.
4. Build native chart workspace shell and route entry.
5. Connect historical candle API with source/quality metadata.
6. Integrate chart drawings and semantic annotation model.
7. Add account persistence and local-to-cloud migration.
8. Add mobile UX and loading/error/empty states.
9. Run unit, integration, typecheck, build, runtime smoke and mobile checks.
10. Release behind a feature flag; keep TradingView fallback until acceptance criteria pass.

## Acceptance criteria

- Native chart opens from the primary trading workflow on desktop and iPhone.
- XAUUSD candles render from a verified source with symbol, timeframe, source and last-update metadata.
- All supported MVP timeframes load without timestamp duplication or ordering errors.
- Switching timeframe preserves the intended time anchor within the limits of available data.
- Drawings survive reload, sign-out/sign-in and a second device for the same account.
- Drawings from one symbol/timeframe do not leak into another.
- Failed or pending saves are visibly distinguished from confirmed saves.
- Estimated volume is never labelled or used as real exchange volume.
- TradingView fallback remains available until the native workspace passes validation.
- No live order execution path is introduced or modified by this phase.
- Existing repository verification passes, or pre-existing failures are documented and shown not to be regressions.

## Risks / decisions to resolve during audit

- The user-provided published URL may not be deployed from this repository. This must be verified before implementation can be considered deployed.
- Existing ChartReplay is designed around historical replay and local persistence; it may need extraction of a shared chart surface rather than direct reuse as-is.
- Candle warehouse schema presence does not prove that seed/tail ingestion is running or that the required coverage exists in production.
- Yahoo futures symbols (for example GC=F) are not identical to the broker's XAUUSD CFD feed. The chart must label this clearly until an FPTrading feed is integrated.
- Forex/metals tick-volume is not centralized traded volume; indicators such as VWAP/Volume Profile must expose this limitation.
- Account persistence must be isolated by authenticated user and protected against stale writes.

## Next phase after acceptance

Phase 2: link the chart to the trading decision workflow (HTF context → HTF zone → ITF schematic → LTF trigger), with manual user confirmation and rule-consistency checks. No automated direction prediction.
