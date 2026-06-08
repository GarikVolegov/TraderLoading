# Persistent Session And Cookie Consent Design

## Goal

Keep the user's authenticated session and app data stable across frontend refreshes, route changes, deployments, and API/server restarts. Add an in-app cookie consent popup so users explicitly accept the cookies required for authentication and persistence.

## Approved Direction

Use a focused persistence hardening pass:

- make generated API calls include browser credentials by default;
- keep existing DB-backed sessions and user data as the source of truth;
- add a small global cookie consent popup that remains visible until accepted;
- persist the user's consent locally so the popup does not reappear after every refresh.

This addresses both requested cases: app updates on the frontend and deploy/server updates on the backend.

## Scope

In scope:

- Update the generated API client fetch wrapper so same-origin API calls send cookies/session credentials by default.
- Preserve explicit request overrides for code that intentionally sets a different `credentials` value.
- Add a reusable cookie consent component to the Trader Dashboard frontend.
- Mount the cookie consent component globally so it appears for signed-in and signed-out users.
- Store consent under a versioned `localStorage` key, for example `tl_cookie_consent_v1`.
- Add focused tests for credential forwarding and cookie consent behavior.

Out of scope:

- Replacing Clerk or the existing DB-backed `sid` session system.
- Changing database schemas.
- Migrating all local UI preferences to server-side storage.
- Adding analytics, marketing cookies, or granular cookie categories.
- Implementing a legal privacy policy page.

## User Experience

When the app loads, users who have not accepted cookies see a compact popup anchored near the bottom of the viewport. It explains that TraderLoading uses cookies to keep the session active and save user data during app updates.

The popup has a clear primary action:

- `Accetta`

After acceptance, the popup disappears immediately and the choice is saved in `localStorage`. It does not block using the app, but it remains visible until accepted.

## Architecture

### API Client Persistence

`lib/api-client-react/src/custom-fetch.ts` is the shared wrapper used by the generated React API client. It should set `credentials: "include"` by default when calling `fetch`.

This ensures cookies are sent consistently for API reads and writes such as settings, journal, checklist, chat, profile, missions, backtest, and social requests.

If a caller passes `credentials` explicitly, that value is respected. This keeps the wrapper flexible for unusual requests.

### Backend Session Persistence

The backend already stores opaque `sid` sessions in the Postgres `sessions` table and reads Clerk auth through `@clerk/express`. This design does not change that storage model.

The important invariant is that deploys and server restarts do not wipe session state. Sessions continue to survive as long as:

- the database is persistent;
- the browser keeps the auth/session cookies;
- API calls include credentials when they need authenticated state.

### Cookie Consent

Add a frontend component such as `CookieConsentPopup` under `artifacts/trader-dashboard/src/components/`.

Responsibilities:

- read `tl_cookie_consent_v1` on mount;
- show nothing when consent is already accepted;
- render a bottom popup when consent is missing;
- save acceptance to `localStorage`;
- handle unavailable or failing storage gracefully.

The component should be mounted near the root in `App.tsx`, outside route-specific content, so it survives navigation and appears consistently.

## Data Flow

1. User opens the app.
2. `CookieConsentPopup` checks local consent state.
3. If missing, the popup renders.
4. User clicks `Accetta`.
5. The component writes `tl_cookie_consent_v1=accepted` to `localStorage` and hides.
6. Generated API calls send `credentials: "include"` by default.
7. Browser cookies reach the API consistently, allowing Clerk/session middleware to associate requests with the correct user.
8. Existing routes continue storing user-owned records in Postgres.

## Error Handling

If `localStorage` is unavailable or throws, the popup should still work in memory for the current page session after acceptance. It may reappear on a later reload in that browser mode.

If an API request explicitly fails authentication, existing API and UI error behavior remains unchanged. This change improves credential forwarding; it does not mask real auth failures.

## Testing

Add focused tests:

- `customFetch` sets `credentials: "include"` when no credentials option is provided.
- `customFetch` respects an explicit credentials override.
- `CookieConsentPopup` renders when consent is missing.
- Clicking `Accetta` stores accepted consent and hides the popup.
- The popup does not render when accepted consent is already stored.

Verification should include:

- targeted tests for the changed files;
- `pnpm --filter @workspace/trader-dashboard typecheck`;
- if feasible in the dirty worktree, the repo test runner or relevant package tests.

## Risks

Cookie consent copy should not imply optional authentication cookies can be disabled, because this app needs session cookies to keep users signed in.

Persisting consent in `localStorage` is appropriate for this lightweight requirement, but it is browser-local. The user may see the popup again on a different device, profile, or after clearing site data.

This design does not migrate every locally stored preference to the database. It focuses on the session and API data persistence problem first, which is the highest-impact fix for refreshes and deploys.
