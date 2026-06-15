# CLAUDE.md — Project context for TraderLoadings

> This file is auto-loaded into context at the start of every session. Keep it **concise and current**.
> See [§10 Maintaining this file](#10-maintaining-this-file) for the self-update convention.

## 1. What this is

**TraderLoadings** ("+ Brain AI") is a full-stack **algorithmic-trading platform**: a trading dashboard
with real-time market data, multi-broker account sync, strategy backtesting/chart-replay, a trading
journal, social/E2EE chat, news & macro intelligence, and AI ("Brain") analysis. pnpm monorepo,
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

- **Contract flow:** Zod schemas (`lib/api-zod`) → OpenAPI (`lib/api-spec`) → Orval-generated React Query
  client (`lib/api-client-react`). Keep codegen in sync; never hand-edit generated client files.
- **Backend layout:** entry [artifacts/api-server/src/index.ts](artifacts/api-server/src/index.ts);
  `routes/` (~50 files) over `services/` (~40). Three WebSocket servers (account bridge, broker hub, news hub)
  plus cron jobs (COT fetch, session push, brain scanner). All routes scoped by `userId` (multi-user isolation).
- **DB:** Drizzle schema in [lib/db/src/schema/](lib/db/src/schema/), SQL migrations in `lib/db/drizzle/`.
- **Domain subsystems:**
  - **BrokerHub** (`services/brokerHub/`) — multi-broker sync: FxBlue, cTrader, MetaAPI, SnapTrade, MT5.
  - **NewsHub** (`services/newsHub/`) — aggregation, curation, LLM summarization/ranking, macro adapter.
  - **Brain** (`services/brainScanner.ts`, `brainAnalyst.ts`) — autonomous + on-demand AI analysis.
  - **Wiki** (`services/wiki*.ts`) — pgvector semantic search / knowledge graph over user docs.
  - **COT data** (`routes/tools.ts`) — CFTC Commitment-of-Traders, weekly cron.
  - **Candle warehouse** — see §7.

## 7. Active work / current focus

**Candle warehouse (Phase 1).** Replacing live-only candle fetches with a persistent **M1-based** OHLCV
store in Postgres: native **monthly RANGE partitioning**, SQL-side aggregation to any timeframe, ingestion
from Dukascopy/Binance, behind the `CANDLE_WAREHOUSE` feature flag with live fallback. Files:

- Spec: [docs/superpowers/specs/2026-06-14-candle-warehouse-design.md](docs/superpowers/specs/2026-06-14-candle-warehouse-design.md)
- Schema: [lib/db/src/schema/candles.ts](lib/db/src/schema/candles.ts) · migration `lib/db/drizzle/0006_candle_warehouse.sql`
- Services: `artifacts/api-server/src/services/aggregate.ts`, `candleRegistry.ts`, `ingest/` (dukascopy, candleStore, seed, types)

> This section changes the most session-to-session — update it as the work moves.

## 8. Conventions & gotchas

- **`@typescript-eslint/no-explicit-any` = error** in non-test source (tests may use `any`). TS strict mode on.
- **Semantic commits with scope:** `feat(api):`, `refactor:`, `fix(chat):`, `chore:`, `test:`, `build:`.
- **pnpm only** (preinstall guard rejects npm/yarn). After a contract change run `pnpm codegen`; after a schema
  change run `pnpm db:generate`.
- **Don't `prettier --write` api-server files** — HEAD isn't prettier-clean, so it reformats the whole file.
- **Toolchain not on PATH by default** — node/pnpm may need explicit PATH export in this environment.
- **Clerk:** custom-domain instance, no `VITE_CLERK_PROXY_URL` (proxy caused prod black-screen).

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
