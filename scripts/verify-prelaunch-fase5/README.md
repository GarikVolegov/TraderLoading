# verify-prelaunch-fase5

Runtime smoke verifier for Fase 5 of the pre-launch page audit
(`docs/superpowers/plans/2026-07-11-pre-launch-page-audit-fix-plan.md`):
checks that a handful of Fase 1/4 fixes actually work end-to-end in a real
browser, not just in static tests. Mirrors `scripts/verify-nav-hubs/drive.mjs`.

## What it checks

1. **Cookie banner** shows on first load and dismisses on accept.
2. **Mobile nav root overflow** (Fase 4) — the "Più" button on the root
   (non-hub) bottom pill opens a sheet listing Biblioteca/Orologio/Notizie
   (previously reachable only via the desktop-only Cmd+K palette); tapping
   Orologio navigates to `/clock`.
3. **Desktop sidebar parity** — the same three pages are in the secondary
   sidebar group at `1440×900`.
4. **Broker badge** (Fase 1) — confirms the old inverted "Trading non
   disponibile" label is gone. The actual "Trading attivo"/"Trading bloccato"
   badges only render per connected broker profile — the `verify_clerk_test`
   user has none, so that half of the check needs a profile-connected session
   to see live (documented gap, not a blocker).
5. **Error state ≠ empty state** (Fase 1) — aborts `/api/journal` and confirms
   `QueryErrorState` ("Impossibile caricare i dati." + Riprova) renders
   instead of the "no trades yet" empty state.
6. **BillingReturn** (Fase 1) — the `verify_clerk_test` user already has Pro,
   so the "payment not completed" state can't be reached with this session;
   the script detects that and skips with an explanation instead of hanging
   on a false negative. Verified instead via code + typecheck/tests in Fase 1.

Screenshots land in `artifacts.local/verify-prelaunch-fase5/` (gitignored).

## Run it

```bash
pnpm --filter ./scripts exec tsx local/start.ts   # or otherwise have
                                                    # localhost:5173 + :3001 up
cd scripts && node verify-prelaunch-fase5/drive.mjs
```

Requires `.env.local` with `VITE_CLERK_PUBLISHABLE_KEY` + `CLERK_SECRET_KEY`,
and the `verify+clerk_test@example.com` Clerk test user to already exist.
Takes ~35s (no long waits — flaky fixed-timeout sleeps were replaced with
`waitFor`-based polling on the actual DOM state).
