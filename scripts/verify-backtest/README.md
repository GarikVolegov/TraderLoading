# verify-backtest

Runtime verifier for the **backtest replay page** — which sits behind three
obstacles: Clerk auth, the `ProUpgradeGate` Pro check, and canvas charts that
only a real browser renders. This tooling gets past all three and screenshots
the result, so a reviewer can replay what was seen.

## How it works

1. `setup-user.mjs` (idempotent):
   - ensures a **Clerk test user** exists (Clerk Backend API + `CLERK_SECRET_KEY`);
     the `+clerk_test` email is accepted by the dev instance without real OTP,
   - grants the user **Pro** by upserting `admin_user_subscriptions` (the backend
     gates session creation on a real Pro plan — a browser-side billing mock is
     not enough).
2. `drive.mjs` drives Chromium with Playwright:
   - injects a Clerk testing token (`@clerk/testing`) and signs in with a one-time
     **sign-in token (ticket)** minted via the Backend API,
   - intercepts `GET /api/billing/me` → `{ pro: true }` so `ProUpgradeGate` also
     opens client-side,
   - completes onboarding via `PUT /api/settings` and dismisses the first-run
     intro modals,
   - opens **Backtest → Replay Grafico** (creating a session if none exists),
   - runs the change-specific action (default: clicks the **Layers** MTF toggle,
     then advances the replay), screenshotting each stage to `artifacts.local/verify/`.

## Prerequisites

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"
pnpm --filter @workspace/scripts add -D playwright @clerk/testing pg
pnpm --filter @workspace/scripts exec playwright install chromium
```

`.env.local` must have `VITE_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. The Pro
grant targets the local managed Postgres (`postgres://trader:trader@127.0.0.1:55432/traderloadings`,
override with `VERIFY_DATABASE_URL`).

## Run

```bash
export PATH="$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"

# 1. Launch the stack (Postgres :55432, API :3001, frontend :5173) in the background.
#    CANDLE_WAREHOUSE=1 only if the local DB is seeded; otherwise omit for live fallback.
pnpm start:local      # wait until http://localhost:5173 responds

# 2. Ensure the Clerk test user exists and is Pro.
node scripts/verify-backtest/setup-user.mjs

# 3. Drive + screenshot.
node scripts/verify-backtest/drive.mjs --action=mtf
```

Output screenshots: `artifacts.local/verify/*.png` — these are the evidence.

## Notes

- Clerk component markup can shift between versions; `drive.mjs` signs in
  programmatically via `@clerk/testing` (no fragile form selectors).
- Env overrides: `VERIFY_BASE_URL`, `VERIFY_EMAIL`, `VERIFY_PASSWORD`,
  `VERIFY_BACKTEST_PATH`.
- To promote this to an auto-discovered Claude verifier, move the folder to
  `.claude/skills/verifier-backtest/` and add SKILL.md frontmatter.
