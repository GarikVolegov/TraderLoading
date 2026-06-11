# Freemium Pro Stripe Design

## Context

TraderLoadings already has authenticated app areas for backtesting, leaderboard/classifica, and broker/account connection. The requested monetization model is a single Free/Freemium plan plus one Pro subscription.

The older pricing strategy document describes multiple tiers. This design intentionally replaces that scope for the current implementation: no Starter, Team, annual pricing, usage caps, or trials are included.

Stripe will be integrated with an embedded checkout experience so users can upgrade without leaving the app.

## Approved Product Model

- Free/Freemium remains the default plan for every authenticated user.
- Pro costs 7 EUR per month.
- Pro unlocks only:
  - Backtesting.
  - Classifiche / leaderboard access.
  - Collegamento conto / Broker Hub account connection.
- Free users can still navigate to those pages.
- Free users see a contextual upgrade screen inside those pages instead of the feature UI.
- Pro users see the feature UI directly.

## Stripe Approach

Use Stripe Embedded Checkout for the upgrade flow.

The backend creates a Checkout Session in subscription mode for the Pro monthly price and returns the session client secret to the frontend. The frontend embeds Stripe's checkout component in the upgrade screen or modal.

Reasons:

- The user stays inside TraderLoadings.
- Stripe handles payment form security, authentication challenges, and supported payment method behavior.
- The app avoids owning sensitive card-entry UI.
- The same flow can be reused by all three gated feature pages.

The implementation will require these environment variables:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_MONTHLY_PRICE_ID`
- `VITE_STRIPE_PUBLISHABLE_KEY`

## Subscription Data Model

Add a user subscription record keyed by application user id.

Fields:

- `userId`
- `plan`: `free` or `pro`
- `stripeCustomerId`
- `stripeSubscriptionId`
- `stripePriceId`
- `status`: Stripe subscription status, normalized enough for access checks.
- `currentPeriodEnd`
- `cancelAtPeriodEnd`
- `createdAt`
- `updatedAt`

Access is Pro when the user's subscription status is active enough to grant service, initially:

- `active`
- `trialing`

All other missing or inactive states resolve to Free.

## Backend API

Add a billing module with these endpoints:

- `GET /api/billing/me`
  - Requires authentication.
  - Returns the user's current plan, subscription status, and whether Pro is active.

- `POST /api/billing/checkout-session`
  - Requires authentication.
  - Creates or reuses the user's Stripe customer.
  - Creates an embedded Stripe Checkout Session for the Pro monthly subscription.
  - Returns the Checkout Session `clientSecret`.

- `POST /api/billing/webhook`
  - Verifies the Stripe signature using the raw request body.
  - Updates the local subscription record from Stripe events.
  - Handles at least checkout completion, subscription updates, subscription deletion, and invoice payment failures.

The webhook route must be mounted before JSON body parsing or use a route-specific raw body parser, because Stripe signature verification needs the exact raw payload.

## Feature Gates

Create a shared server-side helper, for example `requireProFeature(req, res, feature)`, that:

- requires an authenticated user;
- checks current Pro access from the subscription table;
- returns `402 Payment Required` with a stable JSON shape when the user is Free.

Backend gates:

- `/api/backtest/*`
- `/api/leaderboard`
- broker account connection and data routes under `/api/brokers/*`

The broker catalog may remain visible if useful for the upgrade page, but creating/verifying/completing connections and reading private account data must require Pro.

The gate exists on the backend even though the frontend also hides feature UI, so direct API calls cannot bypass the subscription.

## Frontend UX

Add a reusable `ProUpgradeGate` component.

Responsibilities:

- Fetch `/api/billing/me`.
- If Pro is active, render children.
- If Free, render a contextual upgrade view.
- Start an embedded checkout session on demand.
- Refresh subscription state after Stripe returns from checkout or the component detects completion.

Use the same component around:

- Backtest page content.
- Classifica tab/content.
- Broker page account-connection workspace.

Upgrade screen copy should be short and product-specific:

- Price: `7 EUR/mese`.
- Unlocks: Backtesting, classifiche, collegamento conto.
- Primary action: `Passa a Pro`.

The pages remain discoverable in navigation for Free users.

## Error Handling

- If Stripe is not configured, the checkout endpoint returns a clear 503 configuration error.
- If Checkout Session creation fails, the frontend shows a retryable error state.
- If webhook processing receives an unknown event, it acknowledges the event without failing.
- If local subscription state is stale, `/api/billing/me` can reconcile by Stripe customer/subscription id in a later enhancement. Initial implementation relies on webhooks plus checkout completion.
- If a user cancels, Pro access remains until Stripe no longer reports an active/trialing status.

## Testing

Backend tests:

- Free user receives `402` for gated feature APIs.
- Pro user can access gated feature APIs.
- `/api/billing/me` returns Free when no subscription exists.
- Checkout session endpoint validates authentication and missing Stripe config.
- Webhook signature/event handling updates subscription records.

Frontend/static tests:

- Backtest, classifica, and Broker pages wrap their feature content with the Pro gate.
- Free upgrade copy includes `7 EUR/mese` and the three unlocked features.
- Billing API client builds the expected `/api/billing/me` and checkout routes.

Manual verification:

- Start app locally with Stripe test keys.
- Sign in as a Free user.
- Visit Backtest, Classifica, and Broker pages; each shows upgrade UI.
- Complete test-card subscription in embedded Stripe Checkout.
- Confirm the gated page unlocks after the subscription becomes active.
- Cancel or expire the test subscription and confirm the paywall returns.

## Out of Scope

- Starter, Team, Enterprise, annual pricing, trials, coupons, and usage limits.
- Custom Stripe Elements payment form.
- In-app subscription management portal.
- Mobile app store in-app purchases.
- Admin billing dashboard.

## References

- Stripe Embedded Checkout quickstart: https://docs.stripe.com/checkout/embedded/quickstart
- Stripe subscription integration guide: https://docs.stripe.com/billing/subscriptions/build-subscriptions
