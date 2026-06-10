# Freemium Pro Stripe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Free plan plus a 7 EUR/month Pro subscription through embedded Stripe Checkout, gating Backtest, Classifica content, and Broker Hub behind Pro upgrade screens.

**Architecture:** Store local subscription entitlement in Postgres, update it from Stripe webhooks, and expose a small billing API to the React app. Backend routes enforce Pro access with a shared entitlement helper, while frontend pages and the Classifica tab stay visible and render a reusable upgrade gate with Stripe Embedded Checkout for Free users.

**Tech Stack:** Express 5, Drizzle/Postgres, Stripe Node SDK, React/Vite, TanStack Query, Stripe React SDK, pnpm workspace tests.

---

## File Map

- `artifacts/api-server/package.json`: add `stripe`.
- `artifacts/trader-dashboard/package.json`: add `@stripe/react-stripe-js` and `@stripe/stripe-js`.
- `lib/db/src/schema/billing.ts`: new subscription table and types.
- `lib/db/src/schema/index.ts`: export billing schema.
- `lib/db/drizzle/0003_user_subscriptions.sql`: migration for subscription storage.
- `lib/db/drizzle/meta/_journal.json` and generated snapshot: update via Drizzle generation or manual equivalent.
- `artifacts/api-server/src/lib/billing.ts`: Stripe config, subscription status helpers, entitlement lookup, checkout-session creation helpers.
- `artifacts/api-server/src/lib/billing.test.ts`: unit coverage for entitlement/status behavior and config failures.
- `artifacts/api-server/src/routes/billing.ts`: billing API and Stripe webhook route factory.
- `artifacts/api-server/src/routes/billing.test.ts`: route coverage for `/billing/me`, checkout config, and webhook updates.
- `artifacts/api-server/src/routes/index.ts`: mount billing router.
- `artifacts/api-server/src/app.ts`: mount Stripe webhook with raw body before global JSON parser.
- `artifacts/api-server/src/routes/backtest.ts`: require Pro for backtest APIs.
- `artifacts/api-server/src/routes/profile.ts`: require Pro for `/leaderboard`.
- `artifacts/api-server/src/routes/brokers.ts`: require Pro for Broker Hub private routes while leaving catalog visible.
- `artifacts/api-server/src/routes/backtest.pro.test.ts`: route-level Pro gate coverage.
- `artifacts/api-server/src/routes/profile.pro.test.ts`: leaderboard Pro gate coverage.
- `artifacts/api-server/src/routes/brokers.pro.test.ts`: Broker Hub Pro gate coverage.
- `artifacts/trader-dashboard/src/lib/billingApi.ts`: frontend billing API wrapper.
- `artifacts/trader-dashboard/src/lib/billingApi.test.ts`: frontend API wrapper tests.
- `artifacts/trader-dashboard/src/components/ProUpgradeGate.tsx`: reusable upgrade/paywall component.
- `artifacts/trader-dashboard/src/components/ProUpgradeGate.static.test.ts`: static checks for copy, Stripe imports, and API usage.
- `artifacts/trader-dashboard/src/pages/Backtest.tsx`: wrap Backtest feature content in Pro gate.
- `artifacts/trader-dashboard/src/pages/Broker.tsx`: wrap Broker Hub workspace in Pro gate.
- `artifacts/trader-dashboard/src/pages/Chat.tsx`: keep the Classifica tab visible and wrap its content in the Pro gate.
- `.env.production.example`: document Stripe env vars.
- `lib/api-spec/openapi.yaml`: document billing endpoints and 402 response shape if maintaining OpenAPI parity during the implementation.

---

### Task 1: Add Billing Schema

**Files:**
- Create: `lib/db/src/schema/billing.ts`
- Modify: `lib/db/src/schema/index.ts`
- Create: `lib/db/drizzle/0003_user_subscriptions.sql`
- Modify: `lib/db/drizzle/meta/_journal.json`

- [ ] **Step 1: Write the schema file**

Create `lib/db/src/schema/billing.ts`:

```ts
import { boolean, index, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const userSubscriptionsTable = pgTable(
  "user_subscriptions",
  {
    userId: varchar("user_id")
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    plan: text("plan").notNull().default("free"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePriceId: text("stripe_price_id"),
    status: text("status").notNull().default("free"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("user_subscriptions_customer_idx").on(table.stripeCustomerId),
    index("user_subscriptions_subscription_idx").on(table.stripeSubscriptionId),
    index("user_subscriptions_status_idx").on(table.status),
  ],
);

export type UserSubscription = typeof userSubscriptionsTable.$inferSelect;
export type UpsertUserSubscription = typeof userSubscriptionsTable.$inferInsert;
```

- [ ] **Step 2: Export the schema**

Add this line to `lib/db/src/schema/index.ts`:

```ts
export * from "./billing";
```

- [ ] **Step 3: Add the migration**

Create `lib/db/drizzle/0003_user_subscriptions.sql`:

```sql
CREATE TABLE "user_subscriptions" (
  "user_id" varchar PRIMARY KEY NOT NULL,
  "plan" text DEFAULT 'free' NOT NULL,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "stripe_price_id" text,
  "status" text DEFAULT 'free' NOT NULL,
  "current_period_end" timestamp with time zone,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "user_subscriptions_customer_idx" ON "user_subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "user_subscriptions_subscription_idx" ON "user_subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "user_subscriptions_status_idx" ON "user_subscriptions" USING btree ("status");
```

- [ ] **Step 4: Update Drizzle journal**

Append an entry to `lib/db/drizzle/meta/_journal.json`:

```json
{
  "idx": 3,
  "version": "7",
  "when": 1781100000000,
  "tag": "0003_user_subscriptions",
  "breakpoints": true
}
```

Use the current timestamp in milliseconds for `when`. If the project requires a snapshot file, run `pnpm db:generate` and commit the generated `lib/db/drizzle/meta/0003_snapshot.json`.

- [ ] **Step 5: Verify schema typecheck**

Run:

```bash
pnpm --filter @workspace/db typecheck
```

Expected: command exits with code 0.

- [ ] **Step 6: Commit**

```bash
git add lib/db/src/schema/billing.ts lib/db/src/schema/index.ts lib/db/drizzle
git commit -m "feat: add billing subscription schema"
```

---

### Task 2: Add Stripe Dependencies And Env Documentation

**Files:**
- Modify: `artifacts/api-server/package.json`
- Modify: `artifacts/trader-dashboard/package.json`
- Modify: `.env.production.example`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add dependencies**

Run:

```bash
pnpm --filter @workspace/api-server add stripe
pnpm --filter @workspace/trader-dashboard add @stripe/react-stripe-js @stripe/stripe-js
```

Expected: package manifests and `pnpm-lock.yaml` update.

- [ ] **Step 2: Document environment variables**

Add these lines to `.env.production.example` near the other service secrets:

```env
# Stripe Billing
STRIPE_SECRET_KEY=sk_live_replace_me
STRIPE_WEBHOOK_SECRET=whsec_replace_me
STRIPE_PRO_MONTHLY_PRICE_ID=price_replace_me
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_replace_me
```

- [ ] **Step 3: Verify install consistency**

Run:

```bash
pnpm install --frozen-lockfile
```

Expected: exits with code 0 and reports the lockfile is up to date.

- [ ] **Step 4: Commit**

```bash
git add artifacts/api-server/package.json artifacts/trader-dashboard/package.json pnpm-lock.yaml .env.production.example
git commit -m "chore: add stripe dependencies"
```

---

### Task 3: Implement Billing Library With Tests

**Files:**
- Create: `artifacts/api-server/src/lib/billing.ts`
- Create: `artifacts/api-server/src/lib/billing.test.ts`

- [ ] **Step 1: Write failing billing unit tests**

Create `artifacts/api-server/src/lib/billing.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  isProSubscriptionStatus,
  getPlanFromStatus,
  getStripeBillingConfig,
  paymentRequiredBody,
} from "./billing.js";

{
  assert.equal(isProSubscriptionStatus("active"), true);
  assert.equal(isProSubscriptionStatus("trialing"), true);
  assert.equal(isProSubscriptionStatus("past_due"), false);
  assert.equal(isProSubscriptionStatus("canceled"), false);
  assert.equal(isProSubscriptionStatus(null), false);
}

{
  assert.equal(getPlanFromStatus("active"), "pro");
  assert.equal(getPlanFromStatus("trialing"), "pro");
  assert.equal(getPlanFromStatus("incomplete"), "free");
  assert.equal(getPlanFromStatus(undefined), "free");
}

{
  const config = getStripeBillingConfig({
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "whsec_123",
    STRIPE_PRO_MONTHLY_PRICE_ID: "price_123",
    APP_BASE_URL: "https://traderloadings.test",
  });
  assert.equal(config.configured, true);
  assert.equal(config.secretKey, "sk_test_123");
  assert.equal(config.priceId, "price_123");
  assert.equal(config.appBaseUrl, "https://traderloadings.test");
}

{
  const config = getStripeBillingConfig({});
  assert.equal(config.configured, false);
  assert.equal(config.missing.includes("STRIPE_SECRET_KEY"), true);
  assert.equal(config.missing.includes("STRIPE_PRO_MONTHLY_PRICE_ID"), true);
}

{
  assert.deepEqual(paymentRequiredBody("backtest"), {
    error: "pro_required",
    feature: "backtest",
    message: "Passa a Pro per accedere a questa funzione.",
  });
}

console.log("billing helper checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/lib/billing.test.ts
```

Expected: FAIL because `./billing.js` does not exist.

- [ ] **Step 3: Implement billing helpers**

Create `artifacts/api-server/src/lib/billing.ts`:

```ts
import Stripe from "stripe";
import { db, userSubscriptionsTable, type UserSubscription } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

export type BillingFeature = "backtest" | "leaderboard" | "broker";
export type BillingPlan = "free" | "pro";

export interface StripeBillingConfig {
  configured: boolean;
  missing: string[];
  secretKey?: string;
  webhookSecret?: string;
  priceId?: string;
  appBaseUrl: string;
}

export function isProSubscriptionStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export function getPlanFromStatus(status: string | null | undefined): BillingPlan {
  return isProSubscriptionStatus(status) ? "pro" : "free";
}

export function paymentRequiredBody(feature: BillingFeature) {
  return {
    error: "pro_required",
    feature,
    message: "Passa a Pro per accedere a questa funzione.",
  };
}

export function getStripeBillingConfig(env: NodeJS.ProcessEnv = process.env): StripeBillingConfig {
  const missing = ["STRIPE_SECRET_KEY", "STRIPE_PRO_MONTHLY_PRICE_ID"].filter((key) => !env[key]);
  return {
    configured: missing.length === 0,
    missing,
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    priceId: env.STRIPE_PRO_MONTHLY_PRICE_ID,
    appBaseUrl: (env.APP_BASE_URL || env.PUBLIC_APP_URL || "http://127.0.0.1:5173").replace(/\/$/, ""),
  };
}

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const [subscription] = await db
    .select()
    .from(userSubscriptionsTable)
    .where(eq(userSubscriptionsTable.userId, userId))
    .limit(1);
  return subscription ?? null;
}

export async function isUserPro(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  return isProSubscriptionStatus(subscription?.status);
}

export async function requireProFeature(req: Request, res: Response, feature: BillingFeature): Promise<boolean> {
  const userId = req.user?.id ?? null;
  if (!userId) {
    res.status(401).json({ error: "Autenticazione richiesta." });
    return false;
  }
  if (await isUserPro(userId)) return true;
  res.status(402).json(paymentRequiredBody(feature));
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/lib/billing.test.ts
```

Expected: prints `billing helper checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/billing.ts artifacts/api-server/src/lib/billing.test.ts
git commit -m "feat: add billing entitlement helpers"
```

---

### Task 4: Add Billing Routes And Webhook

**Files:**
- Create: `artifacts/api-server/src/routes/billing.ts`
- Create: `artifacts/api-server/src/routes/billing.test.ts`
- Modify: `artifacts/api-server/src/routes/index.ts`
- Modify: `artifacts/api-server/src/app.ts`

- [ ] **Step 1: Write route tests**

Create `artifacts/api-server/src/routes/billing.test.ts`:

```ts
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createBillingRouter } from "./billing.js";

async function startBillingServer(options = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "user-billing", email: "u@test.dev", firstName: null, lastName: null, profileImageUrl: null };
    next();
  });
  app.use("/api", createBillingRouter(options as never));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    base: `http://127.0.0.1:${address.port}/api`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

{
  const server = await startBillingServer({
    getSubscription: async () => null,
  });
  try {
    const response = await fetch(`${server.base}/billing/me`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { plan: string; pro: boolean };
    assert.equal(body.plan, "free");
    assert.equal(body.pro, false);
  } finally {
    await server.close();
  }
}

{
  const server = await startBillingServer({
    getSubscription: async () => ({ status: "active", stripeCustomerId: "cus_123", currentPeriodEnd: null, cancelAtPeriodEnd: false }),
  });
  try {
    const response = await fetch(`${server.base}/billing/me`);
    const body = (await response.json()) as { plan: string; pro: boolean; status: string };
    assert.equal(body.plan, "pro");
    assert.equal(body.pro, true);
    assert.equal(body.status, "active");
  } finally {
    await server.close();
  }
}

{
  const server = await startBillingServer({
    config: { configured: false, missing: ["STRIPE_SECRET_KEY"], appBaseUrl: "http://localhost" },
  });
  try {
    const response = await fetch(`${server.base}/billing/checkout-session`, { method: "POST" });
    assert.equal(response.status, 503);
    const body = (await response.json()) as { error: string; missing: string[] };
    assert.equal(body.error, "stripe_not_configured");
    assert.deepEqual(body.missing, ["STRIPE_SECRET_KEY"]);
  } finally {
    await server.close();
  }
}

console.log("billing route checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/routes/billing.test.ts
```

Expected: FAIL because `routes/billing.ts` does not exist.

- [ ] **Step 3: Implement billing router**

Create `artifacts/api-server/src/routes/billing.ts`:

```ts
import { Router, type IRouter, type Request } from "express";
import { db, userSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import {
  createStripeClient,
  getPlanFromStatus,
  getStripeBillingConfig,
  getUserSubscription,
  type StripeBillingConfig,
} from "../lib/billing.js";

type SubscriptionLike = {
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
};

export interface BillingRouterOptions {
  config?: StripeBillingConfig;
  getSubscription?: (userId: string) => Promise<SubscriptionLike | null>;
  createCheckoutSession?: (user: NonNullable<Request["user"]>) => Promise<{ clientSecret: string | null }>;
}

function requireBillingUser(req: Request): NonNullable<Request["user"]> | null {
  return req.user ?? null;
}

async function defaultCreateCheckoutSession(user: NonNullable<Request["user"]>): Promise<{ clientSecret: string | null }> {
  const config = getStripeBillingConfig();
  if (!config.configured || !config.secretKey || !config.priceId) {
    throw Object.assign(new Error("Stripe is not configured"), { code: "stripe_not_configured", missing: config.missing });
  }

  const stripe = createStripeClient(config.secretKey);
  const existing = await getUserSubscription(user.id);
  const customerId = existing?.stripeCustomerId || (await stripe.customers.create({ email: user.email ?? undefined, metadata: { userId: user.id } })).id;

  await db
    .insert(userSubscriptionsTable)
    .values({ userId: user.id, stripeCustomerId: customerId, status: existing?.status ?? "free", plan: getPlanFromStatus(existing?.status) })
    .onConflictDoUpdate({
      target: userSubscriptionsTable.userId,
      set: { stripeCustomerId: customerId, updatedAt: new Date() },
    });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    ui_mode: "embedded",
    customer: customerId,
    line_items: [{ price: config.priceId, quantity: 1 }],
    return_url: `${config.appBaseUrl}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    client_reference_id: user.id,
    metadata: { userId: user.id },
    subscription_data: { metadata: { userId: user.id } },
  });

  return { clientSecret: session.client_secret };
}

export function createBillingRouter(options: BillingRouterOptions = {}): IRouter {
  const router: IRouter = Router();
  const getSubscription = options.getSubscription ?? getUserSubscription;

  router.get("/billing/me", async (req, res) => {
    const user = requireBillingUser(req);
    if (!user) {
      res.status(401).json({ error: "Autenticazione richiesta." });
      return;
    }

    const subscription = await getSubscription(user.id);
    const plan = getPlanFromStatus(subscription?.status);
    res.json({
      plan,
      pro: plan === "pro",
      status: subscription?.status ?? "free",
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString?.() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd === true,
    });
  });

  router.post("/billing/checkout-session", async (req, res) => {
    const user = requireBillingUser(req);
    if (!user) {
      res.status(401).json({ error: "Autenticazione richiesta." });
      return;
    }

    const config = options.config ?? getStripeBillingConfig();
    if (!config.configured) {
      res.status(503).json({ error: "stripe_not_configured", missing: config.missing });
      return;
    }

    try {
      const createSession = options.createCheckoutSession ?? defaultCreateCheckoutSession;
      const session = await createSession(user);
      res.json({ clientSecret: session.clientSecret });
    } catch (error) {
      const missing = (error as { missing?: string[] }).missing;
      if ((error as { code?: string }).code === "stripe_not_configured") {
        res.status(503).json({ error: "stripe_not_configured", missing: missing ?? [] });
        return;
      }
      res.status(500).json({ error: "checkout_session_failed" });
    }
  });

  return router;
}

export async function upsertSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata.userId;
  if (!userId) return;
  const item = subscription.items.data[0];
  await db
    .insert(userSubscriptionsTable)
    .values({
      userId,
      plan: getPlanFromStatus(subscription.status),
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      stripeSubscriptionId: subscription.id,
      stripePriceId: item?.price.id ?? null,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    })
    .onConflictDoUpdate({
      target: userSubscriptionsTable.userId,
      set: {
        plan: getPlanFromStatus(subscription.status),
        stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: item?.price.id ?? null,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        updatedAt: new Date(),
      },
    });
}

export async function markSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  await db
    .update(userSubscriptionsTable)
    .set({ plan: "free", status: "canceled", updatedAt: new Date() })
    .where(eq(userSubscriptionsTable.stripeSubscriptionId, subscription.id));
}

export default createBillingRouter();
```

- [ ] **Step 4: Mount router**

Modify `artifacts/api-server/src/routes/index.ts`:

```ts
import billingRouter from "./billing.js";
```

Then mount it before feature routers:

```ts
router.use(billingRouter);
```

- [ ] **Step 5: Add raw webhook mount in app**

In `artifacts/api-server/src/app.ts`, import the webhook handler after imports:

```ts
import { handleStripeWebhook } from "./routes/billing";
```

Before `app.use(express.json({ limit: "5mb" }));`, add:

```ts
app.post("/api/billing/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);
```

Then add this exported handler to `routes/billing.ts`:

```ts
export async function handleStripeWebhook(req: Request, res: import("express").Response): Promise<void> {
  const config = getStripeBillingConfig();
  if (!config.secretKey || !config.webhookSecret) {
    res.status(503).json({ error: "stripe_webhook_not_configured" });
    return;
  }

  const stripe = createStripeClient(config.secretKey);
  const signature = req.headers["stripe-signature"];
  if (typeof signature !== "string") {
    res.status(400).json({ error: "missing_stripe_signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, config.webhookSecret);
  } catch {
    res.status(400).json({ error: "invalid_stripe_signature" });
    return;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription);
  } else if (event.type === "customer.subscription.deleted") {
    await markSubscriptionDeleted(event.data.object as Stripe.Subscription);
  }

  res.json({ received: true });
}
```

- [ ] **Step 6: Run route test**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/routes/billing.test.ts
```

Expected: prints `billing route checks passed`.

- [ ] **Step 7: Commit**

```bash
git add artifacts/api-server/src/routes/billing.ts artifacts/api-server/src/routes/billing.test.ts artifacts/api-server/src/routes/index.ts artifacts/api-server/src/app.ts
git commit -m "feat: add billing api and stripe webhook"
```

---

### Task 5: Gate Backend Pro Features

**Files:**
- Modify: `artifacts/api-server/src/routes/backtest.ts`
- Modify: `artifacts/api-server/src/routes/profile.ts`
- Modify: `artifacts/api-server/src/routes/brokers.ts`
- Create: `artifacts/api-server/src/routes/backtest.pro.test.ts`
- Create: `artifacts/api-server/src/routes/profile.pro.test.ts`
- Create: `artifacts/api-server/src/routes/brokers.pro.test.ts`

- [ ] **Step 1: Add backtest gate test**

Create `artifacts/api-server/src/routes/backtest.pro.test.ts`:

```ts
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import backtestRouter from "./backtest.js";

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: "free-user", email: null, firstName: null, lastName: null, profileImageUrl: null };
  next();
});
app.use("/api", backtestRouter);
const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");

try {
  const response = await fetch(`http://127.0.0.1:${address.port}/api/backtest/sessions`);
  assert.equal(response.status, 402);
  const body = (await response.json()) as { error: string; feature: string };
  assert.equal(body.error, "pro_required");
  assert.equal(body.feature, "backtest");
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log("backtest pro gate checks passed");
```

- [ ] **Step 2: Add leaderboard gate test**

Create `artifacts/api-server/src/routes/profile.pro.test.ts`:

```ts
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import profileRouter from "./profile.js";

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: "free-user", email: null, firstName: null, lastName: null, profileImageUrl: null };
  next();
});
app.use("/api", profileRouter);
const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");

try {
  const response = await fetch(`http://127.0.0.1:${address.port}/api/leaderboard`);
  assert.equal(response.status, 402);
  const body = (await response.json()) as { error: string; feature: string };
  assert.equal(body.error, "pro_required");
  assert.equal(body.feature, "leaderboard");
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log("leaderboard pro gate checks passed");
```

- [ ] **Step 3: Add Broker Hub gate test**

Create `artifacts/api-server/src/routes/brokers.pro.test.ts`:

```ts
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createBrokersRouter } from "./brokers.js";

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.user = { id: "free-user", email: null, firstName: null, lastName: null, profileImageUrl: null };
  next();
});
app.use("/api", createBrokersRouter());
const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}/api/brokers`;

try {
  const catalog = await fetch(`${base}/catalog`);
  assert.equal(catalog.status, 200);

  const response = await fetch(`${base}/profiles`);
  assert.equal(response.status, 402);
  const body = (await response.json()) as { error: string; feature: string };
  assert.equal(body.error, "pro_required");
  assert.equal(body.feature, "broker");
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log("broker pro gate checks passed");
```

- [ ] **Step 4: Run tests to verify they fail**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/routes/backtest.pro.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/profile.pro.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/brokers.pro.test.ts
```

Expected: FAIL because routes currently allow Free users or hit DB before entitlement checks.

- [ ] **Step 5: Gate backtest routes**

In `artifacts/api-server/src/routes/backtest.ts`, add:

```ts
import { requireProFeature } from "../lib/billing.js";
```

At the start of every `/backtest` route handler, add:

```ts
if (!(await requireProFeature(req, res, "backtest"))) return;
```

- [ ] **Step 6: Gate leaderboard route**

In `artifacts/api-server/src/routes/profile.ts`, add:

```ts
import { requireProFeature } from "../lib/billing.js";
```

At the start of `router.get("/leaderboard", async (req, res) => {`, add:

```ts
if (!(await requireProFeature(req, res, "leaderboard"))) return;
```

- [ ] **Step 7: Gate Broker Hub private routes**

In `artifacts/api-server/src/routes/brokers.ts`, add:

```ts
import { requireProFeature } from "../lib/billing.js";
```

Inside `createBrokersRouter`, add middleware after the catalog route and before private routes:

```ts
router.use("/brokers", async (req, res, next) => {
  if (req.path === "/catalog") {
    next();
    return;
  }
  if (await requireProFeature(req, res, "broker")) next();
});
```

- [ ] **Step 8: Run gate tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/routes/backtest.pro.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/profile.pro.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/brokers.pro.test.ts
```

Expected: all three print their `... pro gate checks passed` messages.

- [ ] **Step 9: Commit**

```bash
git add artifacts/api-server/src/routes/backtest.ts artifacts/api-server/src/routes/profile.ts artifacts/api-server/src/routes/brokers.ts artifacts/api-server/src/routes/backtest.pro.test.ts artifacts/api-server/src/routes/profile.pro.test.ts artifacts/api-server/src/routes/brokers.pro.test.ts
git commit -m "feat: gate pro backend features"
```

---

### Task 6: Add Frontend Billing API

**Files:**
- Create: `artifacts/trader-dashboard/src/lib/billingApi.ts`
- Create: `artifacts/trader-dashboard/src/lib/billingApi.test.ts`

- [ ] **Step 1: Write frontend API tests**

Create `artifacts/trader-dashboard/src/lib/billingApi.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  billingQueryKey,
  createCheckoutSession,
  fetchBillingStatus,
} from "./billingApi.js";

const originalFetch = globalThis.fetch;
const calls: Array<{ url: RequestInfo | URL; init?: RequestInit }> = [];

globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
  calls.push({ url, init });
  if (String(url).endsWith("/billing/me")) {
    return Response.json({ plan: "free", pro: false, status: "free" });
  }
  return Response.json({ clientSecret: "cs_test_123" });
}) as typeof fetch;

try {
  assert.deepEqual(billingQueryKey, ["/api/billing/me"]);

  const status = await fetchBillingStatus({ basePath: "/" });
  assert.equal(calls[0]?.url, "/api/billing/me");
  assert.equal(status.plan, "free");
  assert.equal(status.pro, false);

  const checkout = await createCheckoutSession({ basePath: "/" });
  assert.equal(calls[1]?.url, "/api/billing/checkout-session");
  assert.equal(calls[1]?.init?.method, "POST");
  assert.equal(checkout.clientSecret, "cs_test_123");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("billing api checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/billingApi.test.ts
```

Expected: FAIL because `billingApi.ts` does not exist.

- [ ] **Step 3: Implement billing API wrapper**

Create `artifacts/trader-dashboard/src/lib/billingApi.ts`:

```ts
import { apiJSON, type RelativeApiOptions } from "./apiFetch";

export interface BillingStatus {
  plan: "free" | "pro";
  pro: boolean;
  status: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
}

export interface CheckoutSessionResponse {
  clientSecret: string;
}

export const billingQueryKey = ["/api/billing/me"] as const;

export function fetchBillingStatus(options?: RelativeApiOptions): Promise<BillingStatus> {
  return apiJSON<BillingStatus>("billing/me", undefined, options);
}

export function createCheckoutSession(options?: RelativeApiOptions): Promise<CheckoutSessionResponse> {
  return apiJSON<CheckoutSessionResponse>("billing/checkout-session", { method: "POST" }, options);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/billingApi.test.ts
```

Expected: prints `billing api checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/lib/billingApi.ts artifacts/trader-dashboard/src/lib/billingApi.test.ts
git commit -m "feat: add frontend billing api"
```

---

### Task 7: Build Reusable Pro Upgrade Gate

**Files:**
- Create: `artifacts/trader-dashboard/src/components/ProUpgradeGate.tsx`
- Create: `artifacts/trader-dashboard/src/components/ProUpgradeGate.static.test.ts`

- [ ] **Step 1: Write static test**

Create `artifacts/trader-dashboard/src/components/ProUpgradeGate.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ProUpgradeGate.tsx", import.meta.url), "utf8");

assert.match(source, /7 EUR\/mese/);
assert.match(source, /Backtesting/);
assert.match(source, /Classifiche/);
assert.match(source, /Collegamento conto/);
assert.match(source, /EmbeddedCheckoutProvider/);
assert.match(source, /EmbeddedCheckout/);
assert.match(source, /fetchBillingStatus/);
assert.match(source, /createCheckoutSession/);

console.log("pro upgrade gate static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/ProUpgradeGate.static.test.ts
```

Expected: FAIL because `ProUpgradeGate.tsx` does not exist.

- [ ] **Step 3: Implement ProUpgradeGate**

Create `artifacts/trader-dashboard/src/components/ProUpgradeGate.tsx`:

```tsx
import { useMemo, useState } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { billingQueryKey, createCheckoutSession, fetchBillingStatus } from "@/lib/billingApi";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null;

export type ProFeature = "backtest" | "leaderboard" | "broker";

const FEATURE_COPY: Record<ProFeature, { title: string; subtitle: string }> = {
  backtest: {
    title: "Sblocca il Backtesting",
    subtitle: "Testa strategie su replay e sessioni storiche con il piano Pro.",
  },
  leaderboard: {
    title: "Sblocca le Classifiche",
    subtitle: "Accedi al ranking trader e confronta progressi, XP e livelli.",
  },
  broker: {
    title: "Sblocca il Collegamento conto",
    subtitle: "Collega il Broker Hub e sincronizza il conto con il piano Pro.",
  },
};

export function ProUpgradeGate({ feature, children }: { feature: ProFeature; children: React.ReactNode }) {
  const qc = useQueryClient();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: billingQueryKey,
    queryFn: () => fetchBillingStatus(),
  });

  const checkoutOptions = useMemo(
    () => clientSecret ? { clientSecret, onComplete: () => qc.invalidateQueries({ queryKey: billingQueryKey }) } : null,
    [clientSecret, qc],
  );

  if (isLoading) {
    return <div className="min-h-[320px] rounded-lg bg-card/40 animate-pulse" />;
  }

  if (data?.pro) {
    return <>{children}</>;
  }

  const copy = FEATURE_COPY[feature];

  async function startCheckout() {
    setError(null);
    try {
      const session = await createCheckoutSession();
      setClientSecret(session.clientSecret);
    } catch {
      setError("Checkout non disponibile. Controlla la configurazione Stripe e riprova.");
    }
  }

  return (
    <Card className="border-primary/20 bg-card/70">
      <CardContent className="p-5 sm:p-8">
        <div className="mx-auto max-w-2xl text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{copy.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            {["Backtesting", "Classifiche", "Collegamento conto"].map((item) => (
              <div key={item} className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
                <Sparkles className="mx-auto mb-1 h-4 w-4 text-primary" />
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
          <div>
            <p className="text-3xl font-bold">7 EUR/mese</p>
            <p className="text-xs text-muted-foreground">Abbonamento mensile Pro, gestito in sicurezza da Stripe.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!clientSecret && (
            <div className="flex flex-wrap justify-center gap-3">
              <Button onClick={startCheckout}>Passa a Pro</Button>
              <Button variant="outline" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Aggiorna stato
              </Button>
            </div>
          )}
        </div>
        {clientSecret && checkoutOptions && stripePromise && (
          <div className="mx-auto mt-6 max-w-2xl rounded-lg border border-border/60 bg-background p-3">
            <EmbeddedCheckoutProvider stripe={stripePromise} options={checkoutOptions}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Run static test**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/components/ProUpgradeGate.static.test.ts
```

Expected: prints `pro upgrade gate static checks passed`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/trader-dashboard/src/components/ProUpgradeGate.tsx artifacts/trader-dashboard/src/components/ProUpgradeGate.static.test.ts
git commit -m "feat: add pro upgrade gate"
```

---

### Task 8: Wrap Backtest, Broker, And Classifica

**Files:**
- Modify: `artifacts/trader-dashboard/src/pages/Backtest.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Broker.tsx`
- Modify: `artifacts/trader-dashboard/src/pages/Chat.tsx`
- Create: `artifacts/trader-dashboard/src/pages/pro-gates.static.test.ts`

- [ ] **Step 1: Write static test**

Create `artifacts/trader-dashboard/src/pages/pro-gates.static.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backtest = readFileSync(new URL("./Backtest.tsx", import.meta.url), "utf8");
const broker = readFileSync(new URL("./Broker.tsx", import.meta.url), "utf8");
const chat = readFileSync(new URL("./Chat.tsx", import.meta.url), "utf8");

assert.match(backtest, /ProUpgradeGate/);
assert.match(backtest, /feature="backtest"/);
assert.match(broker, /ProUpgradeGate/);
assert.match(broker, /feature="broker"/);
assert.match(chat, /ProUpgradeGate/);
assert.match(chat, /feature="leaderboard"/);

console.log("page pro gate static checks passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/pages/pro-gates.static.test.ts
```

Expected: FAIL because pages are not wrapped yet.

- [ ] **Step 3: Wrap Backtest content**

In `Backtest.tsx`, import:

```ts
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
```

Wrap the `Backtest` component body output so the `PageLayout` remains visible but feature content is gated:

```tsx
return (
  <PageLayout>
    <ProUpgradeGate feature="backtest">
      <PageHeader
        title="Backtest"
        subtitle="Replay su grafici reali. Testa le tue strategie come su FX Replay."
        action={
          <Button onClick={() => setShowNew(!showNew)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuova Sessione
          </Button>
        }
      />
      {/* existing Backtest content stays here unchanged */}
    </ProUpgradeGate>
  </PageLayout>
);
```

Also wrap the active session path:

```tsx
if (activeSession) {
  return (
    <PageLayout>
      <ProUpgradeGate feature="backtest">
        <SessionDetail session={activeSession} onBack={() => setActiveSession(null)} />
      </ProUpgradeGate>
    </PageLayout>
  );
}
```

- [ ] **Step 4: Wrap Broker workspace**

In `Broker.tsx`, import:

```ts
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
```

Replace:

```tsx
<BrokerHubWorkspace initialTab={getInitialBrokerTab()} />
```

With:

```tsx
<ProUpgradeGate feature="broker">
  <BrokerHubWorkspace initialTab={getInitialBrokerTab()} />
</ProUpgradeGate>
```

- [ ] **Step 5: Wrap Classifica tab**

In `Chat.tsx`, import:

```ts
import { ProUpgradeGate } from "@/components/ProUpgradeGate";
```

Replace:

```tsx
{activeTab === "classifica" && <ClassificaTab currentUserId={user?.id ?? ""} />}
```

With:

```tsx
{activeTab === "classifica" && (
  <ProUpgradeGate feature="leaderboard">
    <ClassificaTab currentUserId={user?.id ?? ""} />
  </ProUpgradeGate>
)}
```

- [ ] **Step 6: Run static test**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/pages/pro-gates.static.test.ts
```

Expected: prints `page pro gate static checks passed`.

- [ ] **Step 7: Commit**

```bash
git add artifacts/trader-dashboard/src/pages/Backtest.tsx artifacts/trader-dashboard/src/pages/Broker.tsx artifacts/trader-dashboard/src/pages/Chat.tsx artifacts/trader-dashboard/src/pages/pro-gates.static.test.ts
git commit -m "feat: show pro upgrade gates on premium pages"
```

---

### Task 9: Update API Spec And Generated Clients

**Files:**
- Modify: `lib/api-spec/openapi.yaml`
- Modify: generated files under `lib/api-client-react/src/generated` and `lib/api-zod/src/generated`

- [ ] **Step 1: Add OpenAPI paths**

Add these path entries to `lib/api-spec/openapi.yaml`:

```yaml
  /billing/me:
    get:
      tags: [billing]
      summary: Get current billing status
      responses:
        '200':
          description: Billing status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BillingStatus'
  /billing/checkout-session:
    post:
      tags: [billing]
      summary: Create embedded Stripe checkout session
      responses:
        '200':
          description: Checkout session client secret
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CreateCheckoutSessionResponse'
        '503':
          description: Stripe is not configured
```

Add schemas:

```yaml
    BillingStatus:
      type: object
      required: [plan, pro, status]
      properties:
        plan:
          type: string
          enum: [free, pro]
        pro:
          type: boolean
        status:
          type: string
        currentPeriodEnd:
          type: string
          nullable: true
        cancelAtPeriodEnd:
          type: boolean
    CreateCheckoutSessionResponse:
      type: object
      required: [clientSecret]
      properties:
        clientSecret:
          type: string
```

- [ ] **Step 2: Regenerate clients**

Run:

```bash
pnpm run codegen
```

Expected: generated API/Zod files update without errors.

- [ ] **Step 3: Commit**

```bash
git add lib/api-spec/openapi.yaml lib/api-client-react/src/generated lib/api-zod/src/generated
git commit -m "docs: add billing endpoints to api spec"
```

---

### Task 10: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused backend tests**

Run:

```bash
pnpm --filter @workspace/api-server exec tsx src/lib/billing.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/billing.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/backtest.pro.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/profile.pro.test.ts
pnpm --filter @workspace/api-server exec tsx src/routes/brokers.pro.test.ts
```

Expected: all focused tests print their pass messages.

- [ ] **Step 2: Run focused frontend tests**

Run:

```bash
pnpm --filter @workspace/trader-dashboard exec tsx src/lib/billingApi.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/components/ProUpgradeGate.static.test.ts
pnpm --filter @workspace/trader-dashboard exec tsx src/pages/pro-gates.static.test.ts
```

Expected: all focused tests print their pass messages.

- [ ] **Step 3: Run package typechecks**

Run:

```bash
pnpm --filter @workspace/api-server typecheck
pnpm --filter @workspace/trader-dashboard typecheck
pnpm --filter @workspace/db typecheck
```

Expected: all three exit with code 0.

- [ ] **Step 4: Run workspace verification**

Run:

```bash
pnpm test
```

Expected: test runner exits with code 0. If unrelated pre-existing tests fail, capture the exact failing test names and confirm the focused billing/pro tests still pass.

- [ ] **Step 5: Manual Stripe smoke**

Run local app with Stripe test keys:

```bash
pnpm start:local
```

Manual checks:

- Sign in as a Free user.
- Visit `/backtest`; upgrade card appears with `7 EUR/mese`.
- Visit Chat -> Classifica; upgrade card appears.
- Visit `/broker`; upgrade card appears while the page remains navigable.
- Click `Passa a Pro`; embedded Stripe checkout loads.
- Complete test subscription with a Stripe test card.
- Confirm `/api/billing/me` returns `plan: "pro"` and the gated feature content renders.

## Self-Review

- Spec coverage: the plan covers Stripe Embedded Checkout, 7 EUR/month Pro, Free default behavior, backend gates for Backtest/Classifica/Broker Hub, frontend upgrade screens, env vars, webhook handling, and verification.
- Scope check: Starter, Team, Enterprise, annual pricing, coupons, trials, admin dashboards, and custom Elements checkout are excluded.
- Placeholder scan: no unfinished markers or open-ended implementation steps remain.
- Type consistency: `BillingStatus`, `CheckoutSessionResponse`, `ProFeature`, and `BillingFeature` names are used consistently across API, component, and tests.
