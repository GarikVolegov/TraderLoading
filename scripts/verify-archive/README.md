# verify-archive

Runtime verifier for the **Archive page** (`/wiki`, the Claude Design "Archivio"
layout) — which sits behind Clerk auth + the `ProUpgradeGate` Pro check. This
driver seeds deterministic data, gets past both gates, and screenshots every
state so a reviewer can replay what was seen.

## How it works

`drive.mjs`:

1. Seeds the Clerk test user's archive directly in Postgres — 2 folders
   (collections) + 7 sources spanning every type (image/video/pdf/audio/link/note),
   with tags and folder assignments. (Idempotently applies the `wiki_folders`
   DDL first, so it also works on a partial/push-managed local DB.)
2. Drives Chromium with Playwright + `@clerk/testing`:
   - signs in via a one-time **sign-in token (ticket)** (Backend API),
   - intercepts `GET /api/billing/me` → `{ pro: true }` so `ProUpgradeGate` opens,
   - forces Italian (`localStorage.tl_language = "it"`), completes onboarding,
   - exercises the surface and screenshots each stage to
     `artifacts.local/verify-archive/`:
     grid → list → board → compact density → type filter → **detail modal +
     inline tag edit** → add dialog → **search** → **drag a card onto a
     collection**.
3. Confirms the two backend-touching writes persisted by reading the DB back:
   the tag edit (`PATCH /wiki/sources/:id { tags }`) and the move
   (`PATCH /wiki/sources/:id { folderId }`).
4. Deletes the seeded rows on exit (success or failure).

The test user needs **Pro** — run `setup-user.mjs` from `verify-backtest` first
(it grants Pro in `admin_user_subscriptions`).

## Prerequisites

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
pnpm --filter @workspace/scripts add -D playwright @clerk/testing pg
pnpm --filter @workspace/scripts exec playwright install chromium
```

`.env.local` must have `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. The DB
defaults to `postgres://trader:trader@127.0.0.1:55432/traderloadings`
(override with `VERIFY_DATABASE_URL`).

## Run

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
pnpm start:local                          # Postgres :55432, API :3001, frontend :5173
node scripts/verify-backtest/setup-user.mjs   # ensure the Clerk test user is Pro
node scripts/verify-archive/drive.mjs
```

Output screenshots: `artifacts.local/verify-archive/*.png` — these are the evidence.

## Notes

- Env overrides: `VERIFY_BASE_URL`, `VERIFY_EMAIL`, `VERIFY_DATABASE_URL`.
- HTML5 drag-and-drop is dispatched via synthetic `DragEvent`s sharing one
  `DataTransfer` (Playwright's mouse-based `dragTo` does not fire native HTML5
  drag events).
- The **API must run the current code** — the local dev API is no-watch, so
  restart it after backend changes before driving.
