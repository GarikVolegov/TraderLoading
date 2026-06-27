# Auth screen redesign — Claude Design kit + nickname onboarding

**Date:** 2026-06-28
**Status:** Approved (design), pending implementation plan
**Branch:** `feat/landing-page-rebuild`
**Reference design:** [design-ref/auth/](../../../design-ref/auth/) (pulled from Claude Design project *TraderLoading Design System*, `templates/auth/`)

## 1. Goal

Bring the live authentication surface (sign-in / sign-up) onto the **Claude Design auth
kit** look, while keeping **Clerk** for the real form (email/password, Google SSO, reset,
2FA, email verification). Two product additions on top of the visual port:

1. **Pick a nickname during registration** — a gated post-sign-up step.
2. **Make "signing in" vs "registering" unmistakable** — a segmented mode toggle + per-mode
   brand copy, so users never get confused about which flow they're in.

All brand-panel claims must be **truthful** (verified in code) and the social-proof rating
must be **computed in real-time** from real data — never fabricated.

## 2. Background / current state

- Auth routes live in [App.tsx](../../../artifacts/trader-dashboard/src/App.tsx):
  `SignInPage` / `SignUpPage` wrap Clerk `<SignIn>` / `<SignUp>` in
  [AuthPageShell](../../../artifacts/trader-dashboard/src/components/AuthPageShell.tsx).
- The form internals are rendered by Clerk and themed via `clerkAppearance`
  ([App.tsx:100](../../../artifacts/trader-dashboard/src/App.tsx#L100)) — hardcoded hex
  colors, header/footer hidden, custom field/button classes.
- `AuthPageShell` already implements a split brand-panel + form-card layout, but with the
  old copy ("2FA ready / Live flow / Cloud sync" status cards) and a custom ambient.
- **Nickname** = `profileTable.name` ([profile.ts schema](../../../lib/db/src/schema/profile.ts)):
  unique per authenticated user (unique index on `lower(name)`), default auto-generated
  `Trader{1000-9999}` by `getOrCreateProfile` in
  [routes/profile.ts](../../../artifacts/api-server/src/routes/profile.ts).
- Existing reusable endpoints: `GET /profile/check-name?name=` (live availability),
  `PUT /profile {name}` (save with uniqueness check). The Settings name editor already uses
  them.
- Public marketing data: [routes/public.ts](../../../artifacts/api-server/src/routes/public.ts)
  exposes `GET /public/stats` (`{traders,trades,pairs}`) and `GET /public/testimonials`
  (`{id,name,role,text,rating}` for `published=true`). Both are **off-contract** (direct
  `fetchJSON`, not in `openapi.yaml`) — the landing already consumes `/public/stats`.
- i18n is enforced: [production-copy.static.test.ts](../../../artifacts/trader-dashboard/src/production-copy.static.test.ts)
  + parity test require every `it` key to exist in all `SUPPORTED_LANGUAGES`
  = `["it","en","es","fr","de"]`. New visible copy must go through `t()` with keys added to
  all 5 langs in `lib/i18n.ts`.

## 3. Approach (decisions locked during brainstorming)

- **Layout:** adopt the design's **split** layout 1:1 (brand panel left, form card right;
  panel hidden < 880px, form stacks). The design's "centered" variant is **out of scope**.
- **Form:** keep Clerk `<SignIn>`/`<SignUp>`; restyle via `appearance` to match the design
  tokens. Accept minor divergence (no in-input icons, Clerk's own field layout). Do **not**
  reimplement the form with `useSignIn`/`useSignUp`.
- **Claims:** all truthful, reworded as verified below.
- **Rating:** real-time, server-aggregated; row hidden when no data (never faked).
- **Nickname:** post-sign-up step, **skippable** (recommended default); user can change it
  later in Settings.

## 4. Detailed design

### 4.1 `AuthPageShell` rewrite (chrome only)

Rebuild the brand panel + card chrome to mirror [Auth.dc.html](../../../design-ref/auth/Auth.dc.html):

- **Brand panel (left):** logo lockup ("TraderLoading / Command Center"), per-mode eyebrow,
  gradient headline, per-mode body, **three trust rows** (icon + title + subtitle), and the
  **real-time social-proof row**. Ambient **aurora** background built from the app's design
  tokens (no new asset).
- **Form card (right):** glass card (`--card/0.92` + blur, `--tl-shadow-panel`) containing,
  top-to-bottom: the **mode toggle** (§4.2), the Clerk `<SignIn>/<SignUp>` (`children`), and
  a security footer. Footer copy kept truthful: "Connessione protetta · le tue chat sono
  cifrate end-to-end" (TLS in transit + chat-only E2EE) — **not** a blanket "all data
  encrypted" claim.
- **Per-mode copy** (`copy[mode]`), all via `t()` (aligned to the design's screens):
  - sign-in — eyebrow "Accedi", headline "Bentornato", body "Riprendi il tuo Command Center."
  - sign-up — eyebrow "Crea account", headline "Fai trading rispettando il metodo.", body
    "Inizia gratis. Nessuna carta richiesta."

**Truthful trust-row copy** (verified):

| Row | Copy (it) | Verification |
|---|---|---|
| 1 | "Chat cifrate end-to-end — leggi solo tu e il destinatario." | E2EE real but **chat-only** (`userE2eeKeyBackupsTable`, [chat.ts](../../../artifacts/api-server/src/routes/chat.ts)) |
| 2 | "Sync in sola lettura — colleghiamo MT4/MT5 con password investor." | investor password = read-only ([brokers.ts:356](../../../artifacts/api-server/src/routes/brokers.ts#L356)) |
| 3 | "Conforme al GDPR — dati nell'UE, cancellabili in un clic." | `accountDeletion` deletes data + Clerk account ([services/accountDeletion.ts](../../../artifacts/api-server/src/services/accountDeletion.ts)) |

> The blanket design claim "tutti i dati cifrati, la chiave è solo tua" is **not** adopted —
> only chat is E2EE.

### 4.2 Mode toggle (sign-in vs sign-up clarity)

- A **segmented control** at the top of the form card with two segments, "Accedi" and
  "Registrati", each a wouter `<Link>` to `/sign-in` / `/sign-up`. The active segment
  (driven by the `mode` prop) is visually filled (jade), the other muted.
- Reinforced by the per-mode eyebrow/headline/body in both panel and card.
- The previous bottom "switch" link becomes redundant and is **removed** (the toggle replaces
  it). The terms/privacy note stays.

### 4.3 Real-time social proof

- **Backend:** extend `GET /public/stats` response (off-contract, no codegen) with
  `rating: { average: number; count: number } | null` — `AVG(rating)` and `COUNT(*)` over
  `testimonialsTable` where `published = true`. `count = 0` → `rating: null`. Round average
  to 1 decimal.
- **Frontend:** `AuthPageShell` fetches `/api/public/stats` via React Query (mirroring the
  landing's `fetchJSON<PublicStats>`). If `rating && rating.count > 0`, render the stars +
  "`{average}`/5 · `{count}` recensioni". Otherwise **hide the row**. 503/network error →
  hidden. No fallback numbers.

### 4.4 Clerk appearance update

Update `clerkAppearance` in [App.tsx](../../../artifacts/trader-dashboard/src/App.tsx) so the
themed form matches the design: jade primary CTA, glass/secondary input fields, divider, OAuth
("Continua con Google") block button, error/alert styling. Keep `header`/`footer` hidden (the
shell provides the heading and the mode toggle). Prefer driving colors from the app's CSS
custom properties where Clerk `variables` allow, instead of more hardcoded hex.

### 4.5 Nickname onboarding step

- **New gated page** `NicknameOnboarding` (route `/welcome`), rendered only inside
  `<SignedIn>` like the rest of the app shell.
- **Reached only after sign-up:** set `<SignUp fallbackRedirectUrl={`${basePath}/welcome`}>`.
  `<SignIn>` keeps `fallbackRedirectUrl={`${basePath}/`}`. Normal app navigation never routes
  here.
- **UI:** a branded card consistent with the auth design — heading "Scegli il tuo nickname",
  one text input prefilled with the current auto name (or empty), **live availability** via
  debounced `GET /profile/check-name` (shows available / taken / checking), primary CTA
  "Continua" and a secondary "Salta" link.
- **Submit:** `PUT /profile { name }` → on success redirect to `${basePath}/`. **Skip** →
  redirect to `${basePath}/` keeping the auto name.
- **Validation:** reuse server-side uniqueness + the existing name constraints; surface
  "taken" inline. Empty/whitespace disables "Continua" (but "Salta" always works).
- **Backend:** **no new endpoint** — reuse `check-name` + `PUT /profile`. Confirm both are
  reachable from the signed-in client (they are; Settings uses them).
- Idempotent: revisiting `/welcome` simply lets the user set/confirm a name again; harmless.

### 4.6 i18n

All new visible strings via `t()`; add keys under `auth.shell.*`, `auth.toggle.*`,
`auth.social.*`, `auth.nickname.*` to `DICT` for **all 5** `SUPPORTED_LANGUAGES`. No literals
passed to `title`/`aria-label` props that the static test forbids.

## 5. Data flow

```
/sign-up  ──Clerk SignUp (themed)──►  email verify  ──fallbackRedirectUrl──►  /welcome
                                                                                  │
                                              GET /profile/check-name (live)  ◄────┤
                                              PUT /profile {name}  or  Skip   ─────►  /
/sign-in  ──Clerk SignIn (themed)──────────────────────────────────────────────►  /

AuthPageShell mount ─► GET /api/public/stats ─► rating?  show "avg/5 · N"  : hide row
```

## 6. Error handling

- `/public/stats` 503 / offline → social-proof row hidden; rest of the page unaffected.
- `check-name` error → treat as "couldn't verify", allow submit; server `PUT /profile`
  re-checks uniqueness and returns the authoritative error (surfaced inline).
- `PUT /profile` conflict (name taken between check and submit) → inline error, stay on step.
- Clerk auth errors → handled by Clerk as today (themed alert).

## 7. Testing (TDD)

- **Backend unit** (`public.ts` rating aggregate): average + count correct; empty published
  set → `rating: null`; rounding to 1 decimal.
- **Frontend** (`AuthPageShell`): renders the three trust rows and the mode toggle with the
  active segment matching `mode`; shows the rating row when stats provide `rating`, hides it
  when `rating` is null/absent.
- **Frontend** (`NicknameOnboarding`): reflects availability states; "Continua" disabled on
  empty; submit calls `PUT /profile`; "Salta" navigates without a save.
- **Static:** i18n parity green for the new keys; refresh
  [App.auth.static.test.ts](../../../artifacts/trader-dashboard/src/App.auth.static.test.ts)
  if the expected markup/redirect assertions change (e.g. `fallbackRedirectUrl=/welcome`).
- **Gate:** `pnpm verify` (codegen → typecheck → test → build) green before done.

## 8. Out of scope

- The design's "centered" layout variant.
- Reimplementing the Clerk form via hooks / custom fields inside `<SignUp>`.
- Changes to the auth/redirect flow beyond the sign-up `fallbackRedirectUrl`.
- New testimonials content or a testimonials-authoring UI (reuse existing rows).
- Adding `/public/stats` / `/profile` to the OpenAPI contract (they stay off-contract).

## 9. Files touched (anticipated)

- `artifacts/trader-dashboard/src/components/AuthPageShell.tsx` — rewrite chrome + mode toggle + rating fetch.
- `artifacts/trader-dashboard/src/App.tsx` — `clerkAppearance` update; `SignUp` `fallbackRedirectUrl`; `/welcome` route.
- `artifacts/trader-dashboard/src/pages/NicknameOnboarding.tsx` — new.
- `artifacts/api-server/src/routes/public.ts` — `rating` aggregate on `/public/stats`.
- `artifacts/trader-dashboard/src/lib/i18n.ts` — new keys × 5 langs.
- Tests: backend `public` rating, frontend `AuthPageShell` + `NicknameOnboarding`, refresh `App.auth.static.test.ts`.
