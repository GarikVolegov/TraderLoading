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
