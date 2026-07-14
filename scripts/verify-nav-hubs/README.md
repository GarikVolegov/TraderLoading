# verify-nav-hubs

Runtime verifier for the generalized contextual hub nav on `BottomNav.tsx`
(Community/Journal/Zen) — mobile pill hub-swap + overflow "Più" sheet +
desktop sidebar. Not part of the automated test suite (that's covered by the
`.static.test.ts`/`.test.ts` files next to `navHubs.ts`/`journalTabs.ts`/
`zenTabs.ts`/`BottomNav.tsx`); this is a manual runtime check against a real
dev server, mirroring `scripts/verify-archive/drive.mjs`.

## How it works

`drive.mjs` signs in as the Clerk test user (`verify+clerk_test@example.com`)
via a one-time sign-in token, then with Playwright:

1. **Mobile** (`390×844`) `/journal` — confirms the pill shows the exit arrow
   + the 4 primary sub-items (Panoramica/Trade/Idee/Obiettivi), that the 2
   overflow items (Recap Sett./Recap 4 settimane) are *not* directly in the
   pill, and that "Più" opens a bottom sheet listing them. Taps one, checks
   the URL becomes `/journal?t=recap-settimanale`.
2. Exits via the back arrow, confirms the root nav is restored.
3. **Mobile** `/zen` — same primary/overflow split check.
4. **Desktop** (`1440×900`) `/journal?t=idee` — confirms the sidebar shows a
   "Home" exit row followed by the *full* 6-item hub list with no overflow
   cap (unlike mobile).

Screenshots land in `artifacts.local/verify-nav-hubs/` (gitignored).

## Run it

```bash
pnpm --filter ./scripts exec tsx local/start.ts   # or otherwise have
                                                    # localhost:5173 + :3001 up
cd scripts && node verify-nav-hubs/drive.mjs
```

Requires `.env.local` with `VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`,
and the `verify+clerk_test@example.com` Clerk test user to already exist.
