# TraderLoading

## Overview

Professional forex/stock trading web dashboard. pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui

## Features

- **Strumenti Avanzati** (`/tools`): 5 analytical tools — (1) Monte Carlo projection: configurable form (winrate/R/risk/balance/simCount), backend runs N simulations, Recharts equity curve chart + percentile stats + ruin probability; (2) Market Sentiment: Myfxbook community outlook long/short % per symbol + emotional wave SVG component (panico→euforia gradient); (3) Volatility: real forex ATR-style volatility from Yahoo Finance, pair selector (11 pairs incl. gold), area chart + textual comment; (4) COT Report: CFTC financial futures net positions per currency (EUR/GBP/JPY/CHF/CAD/AUD/NZD/XAU/USD), bar chart + simplified interpretation; (5) Macro News AI: Perplexity-powered macro briefing (primary) with RSS fallback (CNBC/Seeking Alpha) when AI unavailable. Articles have impact/direction/currency tags + representative images (loremflickr). All tools have graceful fallback when external APIs are blocked.
- **Macro News Ticker (TopNav)**: AI-powered macro news scrolling ticker in the top navigation bar. Fetches macro forex briefing via `GET /api/tools/macro-news?currencies=EUR,USD,...,XAU` (Perplexity primary → RSS fallback). Shows impact dots (🔴🟡🟢) + currency flags + headline + source citation in marquee. Click ticker or Brain icon to open bottom sheet with full article list (title, summary, impact badge, direction, source badge, representative image). Supports 9 currencies (EUR/USD/GBP/JPY/CHF/CAD/AUD/NZD/XAU). 30-min server-side cache + 30-min client refetch interval. `force=1` query param bypasses cache for manual refresh. RSS fallback uses keyword-based currency/impact/direction detection.
- **Dashboard**: Real-time clock with active trading session indicator and rotating trading quotes, lot-size calculator (customizable divisor via Settings), daily missions with XP/levels, checklist pill-badge summary. **Market Intelligence row** (bottom section) with three live widgets: SentimentWidget (mini EmotionalWave + pair long/short bars), VolatilityWidget (pair selector + ADR table + 10-day sparkline), CotWidget (currency net-position grid + expandable 12-week history chart). All three link to full `/tools` page for detail.
- **Backtest (FX Replay style)**: Chart replay on real historical data (TradingView lightweight-charts). Candlestick replay with Play/Pause/Step controls (1x/2x/5x/10x speed). BUY/SELL trade placement with click-to-set SL/TP on chart. Auto-closes trades on SL/TP hit during replay. Session management, trade history, real-time P&L and stats (win rate, pips, W/L). Manual trade entry mode also available. Data from Yahoo Finance (EUR/USD, GBP/USD, XAU/USD, US30, NAS100, BTC/USD, etc.), cached 1 hour on backend.
- **Journal (Diario)**: Trade journal entries with images, plus Idee and Obiettivi tabs. Awards 75 XP per entry + auto-completes "Journaling del Trade" mission
- **Checklist**: Customizable pre-trade checklist with progress tracking
- **Pair Selection Onboarding**: First-time modal "Scegli i tuoi Strumenti" with searchable pair catalog (Forex majors/minors/exotics, metals XAU/XAG, indices US30/NAS100/SPX500, crypto BTC/ETH). Selected pairs as removable chips, mandatory selection (modal not dismissible until ≥1 pair). Stored in `user_settings.selectedPairs` (JSON). All tools auto-adapt: Volatility filters to user pairs, Sentiment sorts user pairs first, COT filters relevant currencies, Backtest puts user pairs as default dropdown options, News RSS filters by user pair currencies. Editable anytime via Settings → Pair Preferiti section.
- **News**: Real-time macro news via RSS feeds (Seeking Alpha, CNBC) with optional Perplexity AI enhancement. Each article includes a representative image — extracted from RSS media tags (`<media:content>`, `<enclosure>`, `<media:thumbnail>`, `<img>` in description) or generated via loremflickr with sentiment/currency-based keywords. Server cache 10min per currency set, manual refresh bypasses cache. Keyword filtering dynamically built from user's selected pair currencies.
- **Settings**: Profile with XP/level + avatar (upload from device or AI-generated via gpt-image-1) + unique username validation, account auth (Replit Auth), binaural audio player (5 presets: Alpha 10Hz, Theta 6Hz, Beta 18Hz, Gamma 40Hz, Deep Focus 14Hz with auto-start), font selector (Inter/JetBrains Mono/Roboto/Space Grotesk/IBM Plex Sans), background darkness slider (0-90%), customizable background image upload, **Pair Preferiti** (manage selected trading pairs), **Trading settings** (customize session names/times/visibility, lot calculator divisor), **Mission Templates** (custom daily missions CRUD), **Trading Quotes** (custom quotes CRUD, defaults to 10 built-in Italian quotes)
- **Chat E2EE + Social**: End-to-end encrypted DM chat (text, images, voice messages) with WebRTC voice calls (polling-based signaling via `/api/social/calls/signal`). Story replies support text, emoji, images, and voice. Social feed with posts+images, stories with 24h expiry, leaderboard with clickable profiles + follow/unfollow modal. All media uploaded to `uploads/post-images/` or `uploads/voice/`. Message payloads encrypted as JSON `{type,content|url,duration?}`.
- **Routine** (`/routine`): Interactive guided trader programs — fullscreen session modal with step-by-step flow. Morning (7 steps): EmotionQuiz → BoxBreathing 4-4-4-4 → Gratitudine (3 prompts) → Visualizzazione guidata 90s → Checklist pre-trade (6 criteri) → Obiettivi (target pip/max loss/focus) → Complete. Evening (7 steps): EmotionQuiz → BilancioTrade (W/L/BE/P&L) → Breathing 4-7-8 → Gratitudine serale → Riflessione (good/improve/lesson) → Piano domani → Complete. Features: animated breathing circle (scale + color phases), emotion advice text, confetti on completion, back/forward navigation in modal, skip on optional steps. Completion stored in localStorage (tl_session_{program}_v2 with date key). RoutineWidget on Dashboard shows session done/pending status. Accessible from BottomNav sidebar secondary nav (Sunrise icon, i18n all 5 languages).
- **Auth**: Clerk (OIDC) — multi-user data isolation via userId column on all data tables
- **Audio**: Binaural beats with stereo panning (left/right ear separation). Auto-starts Alpha mode on first user interaction

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── trader-dashboard/   # React+Vite frontend
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   ├── pair-catalog/       # Shared trading pair catalog (symbols, labels, categories, currencies)
│   ├── integrations-openai-ai-server/  # OpenAI AI integration (gpt-image-1 for avatars)
│   └── replit-auth-web/    # Auth hook for browser (useAuth)
├── scripts/
└── ...
```

## DB Tables

- `profile` — trader name (unique per authenticated user), avatarUrl, XP, level, userId. Has partial unique index on `lower(name)` where `user_id IS NOT NULL`
- `missions` — daily missions with XP rewards, userId
- `journal_entries` + `journal_images` — trading journal, userId
- `ideas` — ideas (type=idea) and goals (type=goal) for journal tabs, userId
- `checklist_items` — customizable pre-trade checklist, userId
- `user_settings` — background URL/type, fontChoice, backgroundDarkness, tradingSessions (JSON), lotDivisor, calendarCurrencies, calendarImpacts, userId
- `backtest_sessions` — name, pair, timeframe, strategy, userId, createdAt
- `backtest_trades` — sessionId (FK), direction, entryPrice, exitPrice, stopLoss, takeProfit, lotSize, result, pips, notes, tradeDate
- `friendships` — userId, friendId, status (pending/accepted), createdAt. Unique index on (userId, friendId)
- `chat_messages` — senderId, receiverId, ciphertext (base64), iv (base64), read flag, createdAt
- `user_public_keys` — userId (unique), publicKeyJwk (JSON string), createdAt
- `mission_templates` — custom daily mission templates (title, description, xpReward), userId. Used by ensureTodayMissions when user has templates
- `quotes` — custom trading quotes (text, author), userId. Random quote shown in ClockWidget, falls back to 10 built-in defaults
- `sessions` + `users` — Replit Auth sessions

## API Routes

All mounted at `/api`. All data routes filter by `req.user?.id` for multi-user isolation:
- `GET/PUT /profile`, `GET /profile/check-name?name=X`, `POST /profile/avatar` (upload), `POST /profile/avatar/generate` (AI)
- `GET /missions`, `POST /missions/:id/complete`
- `GET/POST /journal`, `GET/PUT/DELETE /journal/:id`, `POST /journal/:id/images`, `DELETE /journal/:id/images/:imageId`
- `GET/POST /ideas`, `PUT/DELETE /ideas/:id`
- `GET/POST /checklist`, `PUT/DELETE /checklist/:id`
- `GET /news` — Macro news via RSS feeds (Seeking Alpha, CNBC) + optional Perplexity AI. Cached 10min, `?nocache=1` bypasses cache
- `GET /calendar` — Weekly economic calendar from Forex Factory. Cached 30min, `?nocache=1` bypasses cache. Client-side filtering by currency and impact
- `GET /leaderboard` — Trader leaderboard ranked by XP
- `GET/PUT /settings`, `POST /settings/background`
- `GET /friends/search?q=`, `POST /friends/request`, `GET /friends/requests`, `PATCH /friends/requests/:id`, `GET /friends`, `DELETE /friends/:id`
- `POST /chat/keys`, `GET /chat/keys/:userId`, `POST /chat/messages`, `GET /chat/messages/:friendId`, `GET /chat/unread`
- `GET /backtest/sessions`, `POST /backtest/sessions`, `DELETE /backtest/sessions/:id`
- `GET /backtest/sessions/:id/trades`, `POST /backtest/sessions/:id/trades`, `DELETE /backtest/trades/:id`
- `GET /backtest/candles?symbol=EURUSD&interval=H1` — historical OHLC data from Yahoo Finance, cached 1h
- `GET/POST /mission-templates`, `PUT/DELETE /mission-templates/:id`
- `GET/POST /quotes`, `PUT/DELETE /quotes/:id`, `GET /quotes/random`
- `GET /auth/user`, `GET /login`, `GET /callback`, `GET /logout`

## Secrets Required

- `PERPLEXITY_API_KEY` — (optional) Perplexity AI for enhanced macro news. RSS feeds work without it.
- `AI_INTEGRATIONS_OPENAI_BASE_URL` / `AI_INTEGRATIONS_OPENAI_API_KEY` — auto-provisioned by Replit AI Integrations for avatar generation
- `DATABASE_URL` — PostgreSQL connection string. For production, use the Neon Postgres connection string, preferably the pooled URL for serverless deployments.
- `REPL_ID` — auto-provided by Replit

## Commands

- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client after OpenAPI changes
- `pnpm --filter @workspace/db run push` — push schema to DB
- `pnpm run typecheck` — full project typecheck

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` with `composite: true`. Run `pnpm run typecheck` from root for full typecheck. When adding a new lib, add it to both root `tsconfig.json` and the consuming app's `tsconfig.json` references array.
