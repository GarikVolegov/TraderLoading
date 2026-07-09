# CLAUDE.md — Project context for TraderLoadings

> This file is auto-loaded into context at the start of every session. Keep it **concise and current**.
> See [§10 Maintaining this file](#10-maintaining-this-file) for the self-update convention.

## 1. What this is

**TraderLoadings** is a full-stack **algorithmic-trading platform**: a trading dashboard
with real-time market data, multi-broker account sync, strategy backtesting/chart-replay, a trading
journal, social/E2EE chat, news & macro intelligence, and a personal trading-notes **archive**. pnpm monorepo,
TypeScript end-to-end. For running it locally, see [README-BRAIN.md](README-BRAIN.md) (Italian).

## 2. Monorepo map (pnpm workspaces)

```
artifacts/
  api-server/         Express 5 + TS backend (REST + WebSockets + cron jobs)
  trader-dashboard/   React 19 + Vite + Wouter frontend (SPA)
lib/
  db/                 Drizzle ORM schema + Postgres migrations
  api-spec/           OpenAPI spec + Orval codegen
  api-zod/            Shared Zod schemas (contract source of truth)
  api-client-react/   Orval-generated React Query client (DO NOT hand-edit generated files)
  pair-catalog/       Trading-pair catalog
  integrations/*      e.g. OpenAI AI server integration
docs/                 Strategy + design specs (see docs/superpowers/specs/)
deploy/  infra/       AWS / Oracle / Vercel / Railway deploy + IaC
scripts/              Local orchestration: verify, test, typecheck, start (tsx)
tools/metatrader-companion/   MT5 expert advisor
```

## 3. Tech stack (at a glance)

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 7, Wouter (router), Radix UI, Tailwind 4, TanStack React Query, lightweight-charts |
| Backend | Express 5, Drizzle ORM, Postgres, Redis, `ws` (WebSockets), node-cron, Pino, Sentry |
| Auth / Payments | Clerk (custom-domain instance, **no proxy URL**) / Stripe |
| AI / Search | OpenAI SDK, pgvector embeddings |
| Market data | Dukascopy (FX/metals/indices tick-volume), Binance (crypto), Stooq/Yahoo (D1), CFTC COT |
| Contract | Zod → OpenAPI → Orval-generated React client |
| Toolchain | Node 24, pnpm 9.12.0, TypeScript 5.9 (strict) |

## 4. Commands that matter (from root [package.json](package.json))

- `pnpm verify` — **the gate**: install → codegen → typecheck → test → build. Run before declaring done.
- `pnpm start:local` — start DB + API + frontend together.
- `pnpm codegen` — regenerate the API client (run after any Zod/OpenAPI contract change; CI checks it's in sync).
- `pnpm typecheck` · `pnpm lint` · `pnpm test`
- `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:push` — Drizzle migrations.
- Local ports: Postgres **5432** (fallback 55432) · API **3001** · Vite **5173**.

## 5. Infrastructure / deployment

- **Database → Neon** (managed Postgres). `DATABASE_URL` points at Neon in prod; local dev uses a Docker Postgres.
- **API server → Railway** (primary) — single Railpack service builds + serves the frontend, API, WebSockets
  and cron. Config in [railway.json](railway.json) (`preDeployCommand` runs `db:migrate`); env template
  [.env.railway.example](.env.railway.example). ⚠️ Railway disk is **ephemeral** → uploads need a mounted Volume
  (`UPLOADS_DIR=/data/uploads`) or S3/R2. Redis is optional on a single instance (rate-limit falls back to in-memory).
  Candle-warehouse nightly tail runs as a scheduled GitHub Action ([.github/workflows/candle-tail.yml](.github/workflows/candle-tail.yml)).
- **API server → AWS / Oracle** (alternative, dormant) — ECS Fargate (`Dockerfile.aws`, [infra/](infra/)) or a
  self-hosted VM (`Dockerfile.oracle`, [deploy/oracle/](deploy/oracle/)). Kept as fallback; not the active target.
- **Frontend → Vercel** — `artifacts/trader-dashboard` (React/Vite). ⚠️ Vercel deploys are **BLOCKED** if the
  commit author email isn't recognized. (On Railway the single service serves the frontend too.)
- **Not on Replit.** (Project has moved off Replit.)

## 6. Architecture & subsystems

- **Contract flow:** the hand-authored **`lib/api-spec/openapi.yaml` is the source of truth**; Orval generates
  *both* the Zod schemas (`lib/api-zod`) *and* the React Query client (`lib/api-client-react`) from it. To add an
  endpoint: edit `openapi.yaml` (path + `components/schemas`), run `pnpm codegen`, then wire route + UI. Never
  hand-edit generated files. (Nullable `$ref`s use `oneOf: [$ref, {type: "null"}]`; new query hooks require an
  explicit `queryKey: getGet<Op>QueryKey()`.)
- **Backend layout:** entry [artifacts/api-server/src/index.ts](artifacts/api-server/src/index.ts);
  `routes/` (~50 files) over `services/` (~40). Three WebSocket servers (account bridge, broker hub, news hub)
  plus cron jobs (COT fetch, session push, brain scanner). All routes scoped by `userId` (multi-user isolation).
- **DB:** Drizzle schema in [lib/db/src/schema/](lib/db/src/schema/), SQL migrations in `lib/db/drizzle/`.
- **Domain subsystems:**
  - **BrokerHub** (`services/brokerHub/`) — multi-broker sync: FxBlue, cTrader, MetaAPI, SnapTrade, MT5.
  - **NewsHub** (`services/newsHub/`) — aggregation, curation, LLM summarization/ranking, macro adapter.
  - **Archive** (`routes/wiki.ts`, `services/wiki*.ts`) — personal notes archive (text notes,
    file/URL uploads + folders) with async text extraction and client-side text search. Pro-gated
    (`feature="wiki"`); route `/wiki` + keys keep the internal `wiki` name. No AI/graph (removed; see git history).
    UI is the **Claude Design "Archivio"** layout (`pages/Wiki.tsx` + `components/archive/*`, pure logic in
    `lib/archive.ts`): collections rail (= folders, restyled) + tag-cloud filter, grid/list/board views, density
    toggle, type-filter chips, search, detail modal with inline tag editing, and an Add dialog (file/note/URL) +
    page-wide drop target. Tag edits use `PATCH /wiki/sources/:id { tags }` (`services/wikiSourceUpdate.ts`).
  - **Reviews** (`routes/reviews.ts`, `services/reviews/`) — real user app-reviews prompted at a positive
    milestone (level-up / streak / coach hint) via a pure `evaluateReviewPrompt` (min-activity + snooze/opt-out).
    Off-contract (direct `apiJSON`, like tornei). Extends the editorial `testimonials` table with `userId` +
    moderation `status` (pending→approved by admin flips `published`, so approved reviews flow into the existing
    landing testimonials section + `/public/stats` rating). Admin moderation at `/admin/reviews`
    (`moderation.resolve`). UI: global `ReviewPromptModal` (mounted by `App.tsx`) + `ReviewForm` (public-name
    consent), Settings edit/withdraw card, landing rating badge. Migration `0018_reviews.sql` (+ `review_prompt_state`).
  - **COT data** (`routes/tools.ts`) — CFTC Commitment-of-Traders, weekly cron.
  - **Trading coach** (Journal "Panoramica"/overview tab + recap) — turns closed `accountTradesTable` trades into a verdict:
    - *Edge* (`services/tradeAnalytics.ts`) — expectancy-in-R, win rate, net P&L by symbol/direction/session/day
      + best/worst-slice + post-loss "revenge" signal. R = `(|exit−entry|/|entry−stop|)·sign(profit)` (same
      convention as client `parseTradeContent.tradeRMultiple`).
    - *Discipline* (`services/tradeDiscipline.ts`) — behavioural leaks: stop discipline (losses beyond −1R),
      disposition effect (winner vs loser hold time), overtrading (busy- vs calm-day expectancy), drawdown/streak.
    - *Risk guard / circuit-breaker* (`services/riskGuard.ts`) — breaches active right now: daily-R loss limit,
      **cash daily-loss limit** (reuses the user's `maxDailyLoss` setting; fires without stops, with an 80%
      warning), consecutive-loss streak, overtrading, post-loss revenge (Europe/Rome day). Surfaced in the overview.
    - *AI recap* (`services/journalRecapDraft.ts`, `POST /journal/recaps/generate`) — feeds the edge+discipline
      brief to `llmClient.getTextClient()` and drafts the 8 journal-recap fields (degrades to 503 if no LLM key).
    - Served by `GET /journal/edge` (`services/edgeReport.ts` merges edge + discipline + guard in one read) + UI
      `components/journal/JournalOverview.tsx` (the Panoramica tab; the standalone Edge tab/`JournalEdge.tsx` was
      removed once the overview subsumed it). The recap endpoints (`/journal/recaps*`) are **off-contract** (direct
      `apiJSON`, not in openapi.yaml). All pure/unit-tested; copy is i18n'd (see [[i18n-enforced-new-ui]]).
  - **Candle warehouse** — see §7.

## 7. Active work / current focus

**Candle warehouse (Phase 1).** Replacing live-only candle fetches with a persistent **M1-based** OHLCV
store in Postgres: native **monthly RANGE partitioning**, SQL-side aggregation to any timeframe, ingestion
from Dukascopy/Binance, behind the `CANDLE_WAREHOUSE` feature flag with live fallback. Files:

- Spec: [docs/superpowers/specs/2026-06-14-candle-warehouse-design.md](docs/superpowers/specs/2026-06-14-candle-warehouse-design.md)
- Schema: [lib/db/src/schema/candles.ts](lib/db/src/schema/candles.ts) · migration `lib/db/drizzle/0006_candle_warehouse.sql`
- Services: `artifacts/api-server/src/services/aggregate.ts`, `candleRegistry.ts`, `ingest/` (dukascopy, candleStore, seed, types)

**Design-system foundation (liquid glass / neutral jade) — Phase 0 done, surface rollout pending.**
A uniform design backbone in [artifacts/trader-dashboard/src/index.css](artifacts/trader-dashboard/src/index.css): neutral
graphite token ramp + desaturated **jade** chrome accent (`--accent-jade`), vivid P&L semantics kept functional,
four liquid-glass material tiers (`glass-bar/panel/raised/inset`), a tokenized motion vocabulary, and refactored
core `components/ui/*` primitives (Card, Button incl. `glass` variant, Input/Textarea, Badge, overlays, Tabs,
Skeleton). Legacy class names (`.tl-panel`, `.glass-card`, …) are **aliases** over the new material so existing
components inherit it untouched. Live reference at route **`/styleguide`** ([components/ui/styleguide/](artifacts/trader-dashboard/src/components/ui/styleguide/),
i18n-exempt). Spec: [docs/superpowers/specs/2026-06-19-design-system-foundation-design.md](docs/superpowers/specs/2026-06-19-design-system-foundation-design.md) ·
Plan: [docs/superpowers/plans/2026-06-19-design-system-foundation.md](docs/superpowers/plans/2026-06-19-design-system-foundation.md).
Next phases: migrate bespoke landing → app → admin surfaces onto the system.

**Tornei (trading tournaments) — new section, backend functional + tested, frontend ported.**
Global quarterly "disciplined contest" (ciclo del 7) at route **`/tornei`**. Opt-in, requires a synced
real account; **materialized** leaderboard (`tournament_standings`, refreshed by cron + on-sync) over
cumulative R / Discipline from `accountTradesTable`; divisions, guardrail DQ, Arena + Percorso views,
Albo d'oro. End-of-season prizes are auto-granted **idempotently**: XP + internal Pro entitlement
(`adminUserSubscriptionsTable`, `source="tornei"`, **no Stripe charge**) + an **on-chain ERC-721
certificate** behind a config-gated `MintProvider` (real mint on **Base** when `TORNEI_MINT_*` env set,
else stays `claimable`). Endpoints are **off-contract** (`routes/tornei.ts`, direct `apiJSON`, like
journal recaps — not in openapi.yaml). Migration `0017_tornei.sql`. Services in
`artifacts/api-server/src/services/tornei/` (pure: `constants`, `seasonWindows`, `standings`, `prizes`,
`eligibility`, `tradeMapping`, `proEntitlement`, `rolloverPlan` — all unit-tested; IO: `store`, `settle`,
`mint/`) + `cron/torneiScheduler.ts`. UI in `components/tornei/` (scoped `tornei.css`). Spec/plan:
`docs/superpowers/{specs,plans}/2026-06-30-tornei-trading*`. Pending: manual e2e; real on-chain mint
needs the user's RPC/contract/funded wallet.

**Auth screen on the design system (done, branch `feat/auth-screen-redesign`).** Sign-in/sign-up
rebuilt onto the Claude Design auth kit ([design-ref/auth/](design-ref/auth/)): `AuthPageShell`
split brand panel with truthful trust rows + real-time testimonial rating (`/public/stats` gains
`rating:{average,count}`), a segmented Accedi/Registrati toggle, themed Clerk form, and a skippable
post-sign-up nickname step at `/welcome` (reuses `/profile` + `/profile/check-name`). Spec/plan:
`docs/superpowers/{specs,plans}/2026-06-28-auth-screen-redesign*`.

**Performance lightening — DONE (2026-07-02/03, all 9 tasks).** Eager JS cut from 1,991 kB / 573 kB gzip
to **923 kB / 283 kB gzip (−53.7% / −50.5%)**: default Rollup chunking, font preconnect, lazy CotWidget,
poll retune (quote 8s→1h, idle ~25→~4 req/min), per-language i18n split, image compression (public/ 10→3.3 MB),
Tailwind optimizer + dead-dep pruning, plus `feat/scalability-hardening` merged (DB index, journal N+1 fix,
social WS hub, bounded caches, Stripe idempotency; migrations 0019/0020). Gate: 292/292 tests.
Plan + final numbers: [docs/superpowers/plans/2026-07-02-performance-lightening.md](docs/superpowers/plans/2026-07-02-performance-lightening.md).
Manual browser verification checklist (smoke test, language switch, COT widget, WS chat) → pending with user.

**Watchlist widget → native Claude Design rows (2026-07-03, done).** The dashboard "Watchlist Realtime"
card no longer embeds TradingView iframes: each row is the kit sparkline-row (pair label · daily **D1**
`Sparkline` · price · daily change %), fed by the new **off-contract** `GET /api/tools/watchlist?pairs=…`
(SWR cache volatility-style over the shared D1 candle chain; pure logic in
`services/watchlistQuotes.ts`, route in `routes/tools.ts`; client polls 120 s, 15 s while warming). Rows
still deep-link to TradingView; chrome (glass card, Live badge, gear) unchanged. Freshness = last D1 bar
(TwelveData/Binance serve the developing candle; Dukascopy lags ~1 day — set `TWELVEDATA_API_KEY` in prod).
Spec/plan: `docs/superpowers/{specs,plans}/2026-07-03-watchlist-claude-design-daily*`.

**Nightshift (agente autonomo notturno) — ATTIVO da 2026-07-06.** Harness locale in [auto/](auto/):
ogni notte alle 01:00 (launchd + caffeinate, `NIGHTSHIFT_SCHEDULED=1`) `run.sh` lavora la coda
`auto/queue.json` (seed: critici del piano audit; poi PRD e chore ricorrenti) in worktree isolati
`.worktrees/auto-*`, gate meccanico (typecheck+test+anti-secret+migrazioni intoccate), push su
branch `auto/*` e PR verso `feat/community-management`; prima passa in review le PR aperte
(commento `<!-- nightshift-review -->`). Report in `auto/reports/`, stop con `touch auto/STOP`.
Runbook: [auto/README.md](auto/README.md) · Spec:
[docs/superpowers/specs/2026-07-05-nightshift-autonomous-agent-design.md](docs/superpowers/specs/2026-07-05-nightshift-autonomous-agent-design.md).
Prima run notturna = collaudo canarino (`TEST-canary`, `MAX_TASKS=1` temporaneo → poi 2).
Lo step audit 0.2 (E2EE) è fuori coda: decisione di prodotto pendente.

**Audit-implementation plan — essentially COMPLETE (2026-07-07/08, branch `feat/community-management`).** The 6-phase
plan ([docs/superpowers/plans/2026-07-05-audit-completo-piano-implementazione.md](docs/superpowers/plans/2026-07-05-audit-completo-piano-implementazione.md))
is done for every item actionable without prod/CI. New subsystems shipped (all off-contract unless noted, TDD on pure
cores, migrations up to **0025**): **referral** (`routes/referral.ts`, tables `referral_codes`/`referrals`, idempotent
+XP with a daily anti-farm cap), **lifecycle emails** (`services/email/lifecycle*` — welcome/digest/win-back, daily cron,
**DARK by default** behind `RESEND_API_KEY`+`EMAIL_LIFECYCLE_ENABLED=1`), **quant 5B/5D** (`services/edgeStats.ts` Wilson/
Kelly/drawdown/histogram + `/journal/risk-of-ruin`, `/journal/correlation`; surfaced in Panoramica; **EdgeStats is
on-contract** in openapi), **manual-trade form → coach** (3.5, trade fields on JournalEntry create/update + non-destructive
`hasTradeIntent` sync guard), **CSV statement import** (`/journal/import-csv`, capped + batched), **community message
moderation** (3.6, report/queue/resolve), **server-side reminder push** (3.3 — daily/goal/macro now fire from the
leader-elected minute scheduler in `routes/push.ts`, not just an in-tab setTimeout). Also: **i18n debt cleared** (347
`auto.ui.*` keys translated to en/es/fr/de), **Tornei + Clerk auth recoloured onto jade/graphite** (3.2), **modal a11y
focus-trap** (3.4), **PR #5 merged** (PWA notch `--safe-top` + contextual bottom nav, Tornei now mobile-reachable). Work
was adversarially self-reviewed (multi-agent workflows) — 6 real bugs found+fixed. **Pending = user/env only:** GA4
measurement id, flip the email flag, Sentry PR #6 merge + token rotation, manual visual/device QA of the design+PWA
changes, and 4.4 tests (need CI Postgres/jsdom). 5A/5C big features need a brainstorming pass before code.

**Community monetization (A+B+C) — shipped (2026-07-08/09, branch `feat/community-management`).** Telegram-style
paid/private communities, decomposed A→D; **in-app credits have NO cash value** (non-refundable/withdrawable,
forfeited on account deletion — stays out of e-money regulation). All **off-contract**. Migrations **0027–0029**.
- **A private + owner-approved join** (was audit 0.5b): `community_join_requests`, pure `services/community/joinPolicy.ts`,
  request queue gated `members.kick`. Private communities are discoverable-but-locked (cover-only for non-members).
- **B credit wallet + Stripe purchase**: `credit_wallets` + append-only `credit_transactions` (unique `stripe_event_id`
  = idempotent grant). Pure `services/credits/{ledger,packs}.ts` (packs read `STRIPE_CREDIT_PRICE_{STARTER,PLUS,PRO}`),
  `services/credits/wallet.ts` (getBalance/spend/grant/**transferCredits** atomic). Webhook branch in `routes/billing.ts`.
  FE `components/settings/CreditsSettingsSection.tsx` (Settings → abbonamento; hidden until price IDs set → ships dark).
- **C per-channel paid access** (creator picks **one-time OR subscription** per channel): channel price cols +
  `community_channel_entitlements` (NULL expiry = permanent). Pure `services/community/channelAccess.ts`;
  `channelUnlock.ts` = one tx (pg_advisory_xact_lock → FOR UPDATE → member/ban/manage gate → transferCredits buyer→owner
  → upsert entitlement). Choke point `assertChannelAccess` in `routes/community.ts` on messages/files/voice + file-download
  + WS `socketServer.ts`. Endpoints `routes/communityChannels.ts` (pricing PATCH `channels.manage` / unlock / access).
  FE `components/social/{ChannelUnlockPanel,ChannelPricingModal}.tsx` + rail locks. Adversarially reviewed (backend
  13 findings — fixed a **critical TOCTOU double-charge** + ungated content paths; frontend 8 findings — stale-price
  consent guard/deep-link/a11y).
- **D real-money creator payout** (Stripe Connect Express; migrations 0030+0031): `services/payout/` (`payoutMath.ts`
  pure config-driven+fail-safe; `payoutService.ts` money-out **saga**: reserve advisory-lock tx → `stripe.transfers.create`
  idempotency-keyed → settle/compensate; `payoutReconcile.ts` + `cron/payoutScheduler.ts`), `routes/payout.ts`
  (config/account/onboard/request), `account.updated` in `routes/billing.ts`, FE `components/settings/CreatorPayoutSettings.tsx`.
  **Dark by default** (`PAYOUT_CREDIT_CENTS` unset ⇒ off). Adversarially reviewed (10 findings) — fixed **never-double-pay**
  (only transfers.create refund-guarded; refund only on deterministic StripeInvalidRequestError, ambiguous→pending for
  reconcile) + **AML** (only EARNED credits cashable, purchased excluded) + currency/overflow/account-race. Specs:
  `docs/superpowers/specs/2026-07-0{8,9}-*` (join / credit-wallet / paid-channels / creator-payout).
- **Cross-cutting seam review** (arc A→D, migrations up to **0032**) fixed a **HIGH fiat-loss hole**: credit
  chargebacks (`charge.refunded`/`dispute.created`) now reverse the granted credits (purchase grants persist
  `stripe_payment_intent_id`; `reverseCreditPurchase` force-debits, may go negative → earned-cap blocks cashout);
  plus earned = NET channel activity, concurrent double-cashout closed, GDPR coverage regex + library `created_by`.
  **Activation = user/env:** set `STRIPE_CREDIT_PRICE_*` (B) + `PAYOUT_CREDIT_CENTS`/`PAYOUT_*` (D, test-mode Connect
  first); live purchase/transfer + route-authz e2e need CI Postgres/Stripe. Full suite **340/340** green.

**Bottom nav — generalized contextual hub swap (2026-07-10, done).** The two-level contextual bar built for the
Community hub (PR #5) is now a generic multi-hub mechanism: `lib/navHubs.ts` (`HUBS` registry + `matchHub(location)`
+ `splitHubItems` mobile-pill-fit rule — ≤5 sub-items shown flat, >5 → 4 primary + a "Più" overflow `Sheet`) replaces
the old hardcoded `COMMUNITY_ROUTES` boolean in `BottomNav.tsx`. Journal and Zen (each with 6 in-page tabs, previously
local-state-only) are now hubs too, deep-linkable via `?t=` (`lib/journalTabs.ts`/`zenTabs.ts`, mirroring the
pre-existing `chatTabs.ts`); Backtest/Wiki/Library/Routine stay flat (no internal tab structure to promote). The
desktop sidebar (previously always flat, an explicit non-goal in the original spec) is now hub-contextual too,
showing the full hub item list with no overflow cap. TDD throughout (`navHubs.test.ts` + per-hub `.static.test.ts`),
adversarially reviewed (1 real bug found+fixed: the `?t=` active-tab fallback was hardcoded to Community's `"social"`,
leaving Journal/Zen's own default tab unhighlighted on a bare `/journal`/`/zen` load — fixed via a `defaultTab` prop).
Manually verified live via `scripts/verify-nav-hubs/drive.mjs` (Clerk test-user Playwright driver, mirrors
`verify-archive`). `BottomNav.community-nav.static.test.ts` retired in favor of `BottomNav.hub-nav.static.test.ts`.

> This section changes the most session-to-session — update it as the work moves.

## 8. Conventions & gotchas

- **`@typescript-eslint/no-explicit-any` = error** in non-test source (tests may use `any`). TS strict mode on.
- **Semantic commits with scope:** `feat(api):`, `refactor:`, `fix(chat):`, `chore:`, `test:`, `build:`.
- **pnpm only** (preinstall guard rejects npm/yarn). After a contract change run `pnpm codegen`; after a schema
  change run `pnpm db:generate`.
- **Don't `prettier --write` api-server files** — HEAD isn't prettier-clean, so it reformats the whole file.
- **Toolchain not on PATH by default** — node/pnpm may need explicit PATH export in this environment.
- **Clerk:** custom-domain instance, no `VITE_CLERK_PROXY_URL` (proxy caused prod black-screen).
- **Market data on Railway:** Yahoo Finance is **IP-blocked** from Railway's datacenter. For the latest
  **D1/W1** window the candle chain (`services/candles.ts` `getFallbackChain`) leads with Railway-friendly
  sources — Binance (crypto), TwelveData (needs `TWELVEDATA_API_KEY`), then Dukascopy (no key but slow,
  per-day files) — and only falls back to Yahoo. `/tools/volatility` sources via `getCandles("D1")` and is
  **stale-while-revalidate** (reads cache, warms in background) so the slow source never blocks the request.
  For instant FX/metals in prod set a (free) `TWELVEDATA_API_KEY`, or seed + enable `CANDLE_WAREHOUSE`.

## 9. Where to look first

- [README-BRAIN.md](README-BRAIN.md) — run locally (commands, ports, env).
- [docs/](docs/) and [docs/superpowers/specs/](docs/superpowers/specs/) — strategy & design specs.
- [.agent.md](.agent.md) — "Production Readiness Auditor" agent persona (use for pre-launch/audit work).
- [eslint.config.mjs](eslint.config.mjs) — lint discipline.

## 10. Maintaining this file

At the end of a session, if anything material changed — architecture, commands, conventions, a new/removed
subsystem, infrastructure, or a shift in current focus — **update the relevant section of this file** (especially
[§7 Active work](#7-active-work--current-focus) and [§5 Infrastructure](#5-infrastructure--deployment)) before
wrapping up. Keep it concise; link out to deeper docs instead of inlining detail. No `replit.md` references.
