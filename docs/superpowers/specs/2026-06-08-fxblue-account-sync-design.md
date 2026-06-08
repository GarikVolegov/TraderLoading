# FX Blue Account Sync Broker Hub Design

## Context

Broker Hub currently supports several connection routes, including MetaTrader cloud credentials, SmartLink, local companion, cTrader, SnapTrade, MT5 VPS, file import, and demo profiles. The requested change is to make FX Blue Account Sync the managed path for extracting broker account data.

FX Blue Account Sync lets FX Blue collect MT4/MT5 trades directly from broker accounts without the trading terminal running. FX Blue requires the user to be logged in or registered on FX Blue to set up sync, and asks for read-only access such as the investor password. FX Blue also documents that update frequency varies by platform and broker, and that publisher/EA routes can be faster than Account Sync.

The user does not have FX Blue partner/API access for creating Account Sync records programmatically. Therefore TraderLoading must manage the Broker Hub experience end to end while treating FX Blue as the authority for the actual Account Sync setup and sync cadence.

References:

- FX Blue Account Sync: https://diagnostics.fxblue.com/accountsync.aspx
- FX Blue Account Sync FAQ: https://api.fxblue.com/faq/new-mt5-account-sync
- FX Blue Account Sync update speed: https://api.fxblue.com/faq/account-sync-speed

## Goals

- Add a first-class Broker Hub provider named `fxblue-account-sync`.
- Let the user complete FX Blue setup from a guided Broker Hub wizard.
- Keep the provider read-only: account metrics, open positions/orders if available, and history.
- Do not place orders through FX Blue Account Sync.
- Do not automate private FX Blue login/session flows without an official API.
- Avoid storing broker trading passwords. Investor/read-only credentials are shown as setup inputs for the FX Blue step, not retained by TraderLoading after the guided setup.
- Normalize FX Blue data into existing Broker Hub snapshot/history shapes so the rest of the Broker Hub UI keeps working.

## Non-Goals

- No FX Blue partner API integration unless credentials/API docs are provided later.
- No scraping of authenticated FX Blue pages, captcha bypass, browser-control login automation, or hidden form submission.
- No realtime guarantee. The UI must explain that FX Blue controls sync timing.
- No live trading through this route.
- No replacement of existing SmartLink/local companion routes in this milestone.

## Recommended Approach

Build a Broker Hub guided setup flow around FX Blue Account Sync:

1. The user selects `FX Blue Account Sync` in Broker Hub.
2. Broker Hub collects platform, broker/server, account number, and read-only/investor password as setup guidance.
3. Broker Hub opens the official FX Blue Account Sync page in a controlled external step and shows a checklist with the exact values the user must enter.
4. The user completes setup while logged into FX Blue.
5. Back in Broker Hub, the user links the FX Blue result by entering the FX Blue username/profile URL.
6. Broker Hub verifies that public/feed data is readable and creates a read-only Broker Hub profile.
7. Broker Hub periodically refreshes FX Blue data and displays sync state.

This keeps the product experience inside Broker Hub while avoiding brittle or unauthorized automation.

## User Experience

The Broker Hub connect area gains a new route:

- Label: `FX Blue Account Sync`
- Mode: `Sola lettura`
- Capabilities: account, history, positions if available, no orders
- Primary copy: `Configura FX Blue Account Sync e collega i risultati al Broker Hub.`

Wizard steps:

1. `Dettagli conto`
   - Platform: MT4 or MT5.
   - Broker/server name.
   - Account number.
   - Investor/read-only password.
   - Trading mode: live/demo for display and warning copy.

2. `Configura FX Blue`
   - Shows a concise checklist:
     - Log in or register on FX Blue.
     - Open Account Sync.
     - Select MT4/MT5.
     - Paste account number, investor password, and server.
     - Use read-only/investor access only.
     - Start collection.
   - Button: `Apri FX Blue Account Sync`.
   - The button opens the official FX Blue Account Sync URL.

3. `Collega profilo FX Blue`
   - Input: FX Blue username or profile URL.
   - Optional PIN/token field only if the linked profile requires a supported public access mechanism.
   - Button: `Verifica dati FX Blue`.

4. `Profilo creato`
   - Shows account label, last FX Blue update, latest metrics, imported history count, and read-only badge.
   - If data is not available yet, the profile can be created in `waiting_for_fxblue_sync` state and retried.

## Backend Design

### Types

Extend Broker Hub provider types:

- `BrokerProviderKind`: add `fxblue-account-sync`.
- `ConnectorRoute`: add `fxblue_account_sync`.
- `ConnectionHealth`: add `waiting_for_fxblue_sync` if needed, or reuse `stale` plus explicit `setupProgress`.

FX Blue profiles store:

- `providerKind`: `fxblue-account-sync`
- `route`: `fxblue_account_sync`
- `providerUserId`: FX Blue username/profile slug
- `providerAccountId`: FX Blue account/profile id if available
- `accountId`: broker account number if provided
- `tradingEnabled`: always `false`
- `capabilities`:
  - `readAccount`: true when feed data exposes metrics
  - `readPositions`: true when feed data exposes open orders/positions
  - `readHistory`: true
  - `placeOrders`: false
  - `closePositions`: false
  - `realtimeUpdates`: false
  - `requiresTerminal`: false

### Connector

Add `fxBlueConnector.ts` implementing `BrokerConnector`.

Responsibilities:

- Resolve a username/profile URL into an FX Blue profile identifier.
- Fetch available FX Blue feed/API data using only public or user-provided supported URLs.
- Map FX Blue account metrics into `BrokerMetrics`.
- Map open positions/orders into `BrokerPosition` or `BrokerOrder` when available.
- Map closed trades into `BrokerDeal`.
- Return read-only errors for `placeOrder`, `modifyOrder`, and `closePosition`.

The connector should isolate all FX Blue parsing and endpoint assumptions. If FX Blue feed formats change, fixes stay in this connector and its tests.

### Provider Registry

Add a provider verification path for FX Blue:

- `startAuthorization` is not used because there is no official OAuth/partner flow.
- `verifyAccount` or a new FX Blue-specific route validates the FX Blue profile URL/username and returns a verification snapshot.
- The route never sends broker investor passwords to TraderLoading's connector after setup.

### Routes

Add Broker Hub routes:

- `POST /api/brokers/fxblue/setup-intents`
  - Creates a guided setup intent.
  - Stores non-sensitive setup metadata and status.

- `POST /api/brokers/fxblue/setup-intents/:id/verify-profile`
  - Accepts FX Blue username/profile URL.
  - Fetches/validates readable FX Blue data.
  - Returns snapshot or waiting state.

- `POST /api/brokers/fxblue/setup-intents/:id/complete`
  - Creates a Broker Hub profile with `fxblue-account-sync`.

Existing generic `connect-intents` can also be extended, but a focused FX Blue route is cleaner because this flow has distinct steps and legal/security constraints.

## Data Flow

1. Browser creates an FX Blue setup intent.
2. Browser displays setup checklist and opens FX Blue.
3. User completes Account Sync on FX Blue.
4. Browser sends FX Blue username/profile URL to API.
5. API validates readable FX Blue data through `fxBlueConnector`.
6. API creates `BrokerAccountProfile`.
7. Runtime connects the profile and caches the latest `BrokerSnapshot`.
8. Broker Hub refresh uses existing profile refresh/snapshot endpoints.

## Security And Privacy

- Display investor/read-only password fields only to help the user paste into FX Blue.
- Do not persist investor/read-only password in profile store.
- Do not accept or store master/trading password.
- Do not store FX Blue login credentials.
- Add warning copy: `Usa solo password investor/read-only. Non inserire la password master del conto.`
- Mark every FX Blue profile read-only in UI and backend capabilities.
- Log only non-sensitive identifiers such as setup intent id and FX Blue profile slug.

## Error Handling

User-visible states:

- `waiting_for_fxblue_login`: user needs to log in/register on FX Blue.
- `waiting_for_fxblue_setup`: user has not started Account Sync yet.
- `waiting_for_fxblue_sync`: FX Blue profile exists but first sync is not readable yet.
- `fxblue_profile_private`: profile/feed is private or not accessible by TraderLoading.
- `fxblue_server_not_supported`: broker/server not listed or FX Blue requires a server request.
- `fxblue_rate_limited`: retry later.
- `fxblue_parse_error`: FX Blue data was reachable but not in the expected shape.

The UI should always offer a next action: open FX Blue, retry verification, edit profile URL, or use SmartLink/companion as fallback.

## Testing

Backend tests:

- Parses FX Blue profile identifiers from username and URL.
- Maps FX Blue account metrics into `BrokerSnapshot`.
- Maps closed trades into `BrokerDeal`.
- Rejects order placement and position closing for FX Blue profiles.
- Handles private/unavailable/waiting profiles with stable error codes.
- Completes setup intent without persisting investor password.

Frontend tests:

- Wizard requires account number, server, and investor password before the FX Blue checklist step.
- Wizard labels the route read-only and disables order controls.
- Verification creates a waiting state when FX Blue has not synced yet.
- Existing Broker Hub profile refresh still displays metrics/history for FX Blue.

Integration/manual verification:

- Create FX Blue setup intent.
- Open FX Blue Account Sync.
- Link a test FX Blue profile URL.
- Confirm snapshot and history appear in Broker Hub.
- Confirm order ticket is disabled for FX Blue profiles.

## Rollout

Phase 1:

- Add provider/type support and wizard.
- Implement connector with documented/public feed access only.
- Create read-only profile and display sync states.

Phase 2:

- Improve historical import depth and mapping.
- Add richer diagnostics for unsupported servers/private profiles.
- If FX Blue provides partner API access later, replace the guided external setup step with official API-backed setup while preserving the same Broker Hub UX.
