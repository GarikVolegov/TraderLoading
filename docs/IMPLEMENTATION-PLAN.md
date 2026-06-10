# TraderLoadings Pricing Implementation Plan

## Overview

Questo documento delinea i passi tecnici per implementare la monetizzazione completa: Stripe Billing integration, feature gating backend, paywall frontend, webhooks e gestione abbonamenti.

**Timeline stimato**: 2–3 settimane (2 dev full-time).

---

## Phase 0: Setup & Infrastructure (Days 1–2)

### 0.1 Stripe Account Setup

1. **Create Stripe account** (if not exists):
   - Sign up at https://dashboard.stripe.com
   - Enable test mode (API keys: pk_test_*, sk_test_*)
   - Enable Billing (Subscriptions & Billing Portal)

2. **Create products & prices** in Stripe Dashboard:
   ```
   Product: Starter
     └─ Price: €9/month (recurring)
        └─ Price ID: price_starter_monthly

   Product: Starter Annual
     └─ Price: €90/year (recurring, annual)
        └─ Price ID: price_starter_annual

   Product: Pro
     └─ Price: €29/month (recurring)
        └─ Price ID: price_pro_monthly

   Product: Pro Annual
     └─ Price: €290/year (recurring)
        └─ Price ID: price_pro_annual

   Product: Team
     └─ Price: €79/month (recurring)
        └─ Price ID: price_team_monthly

   Product: Team Annual
     └─ Price: €790/year (recurring)
        └─ Price ID: price_team_annual

   Product: Freemium
     └─ Price: €0/month (metered, for tracking)
        └─ Price ID: price_freemium
   ```

3. **Enable Stripe Webhooks**:
   - Endpoint URL: `https://api.yourdomain.com/webhooks/stripe`
   - Events to subscribe:
     - `customer.created`
     - `customer.updated`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`

4. **Retrieve API keys**:
   - Publishable key: `pk_test_...` (frontend, safe to expose)
   - Secret key: `sk_test_...` (backend only, .env)

### 0.2 Environment Variables

Add to `.env.local` (development) and deployment secrets:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App URLs
API_BASE_URL=http://localhost:3001
FRONTEND_URL=http://localhost:5173
STRIPE_PORTAL_URL=https://billing.stripe.com/...  # (generated after setup)
```

### 0.3 Database Migrations

Update `lib/db/src/schema.ts` to track subscriptions:

```typescript
// lib/db/src/schema.ts

import { pgTable, text, timestamp, varchar, integer, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: varchar("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ... existing fields
});

// NEW: subscription tracking
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  stripeCustomerId: varchar("stripe_customer_id").unique(),
  stripeSubscriptionId: varchar("stripe_subscription_id").unique(),
  plan: varchar("plan").notNull(), // "freemium" | "starter" | "pro" | "team" | "enterprise"
  status: varchar("status").notNull(), // "active" | "trialing" | "past_due" | "canceled"
  billingCycle: varchar("billing_cycle"), // "monthly" | "annual"
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  canceledAt: timestamp("canceled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Track trial usage for Freemium → Paid conversion
export const trialEvents = pgTable("trial_events", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  eventType: varchar("event_type").notNull(), // "trial_started" | "trial_activated" | "trial_converted" | "trial_expired"
  eventData: text("event_data"), // JSON stringified
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Feature access audit
export const featureAccessLog = pgTable("feature_access_log", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  featureName: varchar("feature_name").notNull(),
  allowed: boolean("allowed").notNull(),
  reason: text("reason"), // "plan_restriction" | "quota_exceeded" | "allowed"
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

Run migration:
```bash
pnpm --filter @workspace/db push
```

---

## Phase 1: Backend Implementation (Days 3–5)

### 1.1 Stripe Service Module

Create `artifacts/api-server/src/services/stripe.service.ts`:

```typescript
// artifacts/api-server/src/services/stripe.service.ts

import Stripe from "stripe";
import { db } from "@workspace/db";
import { subscriptions } from "@workspace/db/src/schema";
import { eq } from "drizzle-orm";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

export interface CreateCheckoutSessionRequest {
  userId: string;
  email: string;
  priceId: string;
  trialDays?: number;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(req: CreateCheckoutSessionRequest) {
  const session = await stripe.checkout.sessions.create({
    customer_email: req.email,
    mode: "subscription",
    line_items: [
      {
        price: req.priceId,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_days: req.trialDays || 0,
      metadata: {
        userId: req.userId,
      },
    },
    success_url: `${req.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: req.cancelUrl,
    metadata: {
      userId: req.userId,
    },
  });

  return session;
}

export async function getSubscription(userId: string) {
  return db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
}

export async function upsertSubscription(
  userId: string,
  stripeData: Stripe.Subscription
) {
  const plan = extractPlanFromMetadata(stripeData.metadata);
  const billingCycle = extractBillingCycle(stripeData.items.data[0]?.price?.recurring?.interval);

  return db
    .insert(subscriptions)
    .values({
      id: `sub_${Date.now()}`,
      userId,
      stripeCustomerId: stripeData.customer as string,
      stripeSubscriptionId: stripeData.id,
      plan,
      status: stripeData.status as any,
      billingCycle,
      currentPeriodStart: new Date(stripeData.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeData.current_period_end * 1000),
      trialStart: stripeData.trial_start ? new Date(stripeData.trial_start * 1000) : null,
      trialEnd: stripeData.trial_end ? new Date(stripeData.trial_end * 1000) : null,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        stripeSubscriptionId: stripeData.id,
        status: stripeData.status as any,
        currentPeriodEnd: new Date(stripeData.current_period_end * 1000),
        updatedAt: new Date(),
      },
    });
}

function extractPlanFromMetadata(metadata?: Record<string, any>): string {
  // Infer from Stripe price ID
  return metadata?.plan || "freemium";
}

function extractBillingCycle(interval?: string): string {
  return interval === "year" ? "annual" : "monthly";
}

export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.userId;
      if (userId) {
        await upsertSubscription(userId, subscription);
      }
      break;
    }
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      // Mark as canceled
      await db
        .update(subscriptions)
        .set({ status: "canceled", canceledAt: new Date() })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
      break;
    }
    case "invoice.payment_succeeded": {
      // Optional: trigger onboarding email, etc.
      break;
    }
  }
}
```

### 1.2 Feature Gating Service

Create `artifacts/api-server/src/services/feature-gate.service.ts`:

```typescript
// artifacts/api-server/src/services/feature-gate.service.ts

import { db } from "@workspace/db";
import { subscriptions, featureAccessLog } from "@workspace/db/src/schema";
import { eq } from "drizzle-orm";

const PLAN_FEATURES: Record<string, string[]> = {
  freemium: ["basic_dashboard", "single_portfolio", "ai_chat_limited"],
  starter: ["dashboard", "multi_portfolio_3", "ai_chat_50_msgs", "basic_alerts"],
  pro: ["dashboard_full", "multi_portfolio_10", "ai_chat_unlimited", "alerts_advanced", "mt5_websocket", "api_readonly"],
  team: ["dashboard_full", "multi_portfolio_unlimited", "ai_chat_unlimited", "alerts_advanced", "mt5_webhooks", "api_readwrite", "collaboration"],
  enterprise: ["*"], // All features
};

export async function checkFeatureAccess(
  userId: string,
  featureName: string
): Promise<boolean> {
  try {
    // Get user subscription
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const plan = subscription?.plan || "freemium";
    const allowedFeatures = PLAN_FEATURES[plan] || [];
    const isAllowed =
      allowedFeatures.includes("*") || allowedFeatures.includes(featureName);

    // Audit log
    await db.insert(featureAccessLog).values({
      id: `log_${Date.now()}`,
      userId,
      featureName,
      allowed: isAllowed,
      reason: isAllowed ? "allowed" : "plan_restriction",
    });

    return isAllowed;
  } catch (err) {
    console.error(`Feature gate error for ${userId}:`, err);
    // Fail open for free users
    return true;
  }
}

export async function getUserPlan(userId: string): Promise<string> {
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);

  return subscription?.plan || "freemium";
}
```

### 1.3 API Endpoints

Add to `artifacts/api-server/src/index.ts`:

```typescript
// POST /api/checkout — create checkout session
app.post("/api/checkout", async (req, res) => {
  const { priceId, userId } = req.body;
  const user = req.user; // from Clerk middleware

  if (!user || user.id !== userId) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const session = await createCheckoutSession({
      userId: user.id,
      email: user.primaryEmailAddress?.emailAddress!,
      priceId,
      successUrl: `${process.env.FRONTEND_URL}/billing/success`,
      cancelUrl: `${process.env.FRONTEND_URL}/pricing`,
    });

    res.json({ sessionId: session.id });
  } catch (err) {
    res.status(500).json({ error: (err as any).message });
  }
});

// GET /api/subscription — get current plan
app.get("/api/subscription", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const [subscription] = await getSubscription(user.id);
  res.json(subscription || { plan: "freemium" });
});

// GET /api/feature-access/:feature — check feature access
app.get("/api/feature-access/:feature", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const allowed = await checkFeatureAccess(user.id, req.params.feature);
  res.json({ allowed });
});

// POST /api/billing/portal — redirect to Stripe Portal
app.post("/api/billing/portal", async (req, res) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const [subscription] = await getSubscription(user.id);
  if (!subscription?.stripeCustomerId) {
    return res.status(400).json({ error: "No active subscription" });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${process.env.FRONTEND_URL}/account/billing`,
  });

  res.json({ url: session.url });
});

// POST /webhooks/stripe — Stripe webhook handler
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    await handleStripeWebhook(event);
    res.json({ received: true });
  } catch (err) {
    res.status(400).json({ error: `Webhook error: ${(err as any).message}` });
  }
});
```

---

## Phase 2: Frontend Implementation (Days 6–8)

### 2.1 Pricing Page Component

Create `artifacts/trader-dashboard/src/components/Pricing.tsx`:

```typescript
// artifacts/trader-dashboard/src/components/Pricing.tsx

import React from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";

const plans = [
  {
    id: "freemium",
    name: "Freemium",
    price: 0,
    period: "sempre",
    description: "Per iniziare",
    priceId: null,
    features: [
      "Dashboard base (7 giorni)",
      "1 portafoglio",
      "Report PDF settimanale",
      "AI chat limitato (5/settimana)",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 9,
    period: "/mese",
    description: "Per trader individuali",
    priceId: "price_starter_monthly",
    features: [
      "Dashboard completa (90 giorni)",
      "3 portafogli",
      "Report PDF bisettimanale",
      "AI chat (50/mese)",
      "Avvisi personalizzati",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 29,
    period: "/mese",
    description: "Per professionisti",
    priceId: "price_pro_monthly",
    features: [
      "Dashboard illimitata",
      "10 portafogli",
      "Report PDF custom",
      "AI chat illimitato",
      "MT5 WebSocket live",
      "API read-only",
      "Support prioritario",
    ],
    highlight: true,
  },
  {
    id: "team",
    name: "Team",
    price: 79,
    period: "/mese",
    description: "Per piccoli team",
    priceId: "price_team_monthly",
    features: [
      "Tutto di Pro +",
      "Fino a 5 utenti",
      "Workspace condivisa",
      "Permessi granulari",
      "Webhook custom",
      "API read-write",
      "SLA 99%",
    ],
  },
];

export function Pricing() {
  const navigate = useNavigate();
  const { user } = useUser();

  const handleUpgrade = async (priceId: string) => {
    if (!user) {
      navigate("/auth/signup");
      return;
    }

    if (!priceId) {
      // Freemium, no action needed
      return;
    }

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          priceId,
        }),
      });

      const { sessionId } = await response.json();

      // Redirect to Stripe Checkout
      const stripe = (window as any).Stripe;
      if (stripe) {
        stripe.redirectToCheckout({ sessionId });
      }
    } catch (err) {
      console.error("Checkout error:", err);
    }
  };

  return (
    <div className="py-20 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-5xl font-bold text-center mb-4">
          Piani Semplici, Trasparenti
        </h1>
        <p className="text-center text-gray-600 mb-12 text-lg">
          Scegli il piano giusto per il tuo stile di trading
        </p>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-lg border-2 p-6 ${
                plan.highlight
                  ? "border-blue-500 bg-blue-50 shadow-lg"
                  : "border-gray-200 bg-white"
              }`}
            >
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold">€{plan.price}</span>
                <span className="text-gray-600">{plan.period}</span>
                {plan.price > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    o €{Math.round(plan.price * 10)}/anno (-17%)
                  </p>
                )}
              </div>

              <button
                onClick={() => handleUpgrade(plan.priceId)}
                className={`w-full py-2 rounded-lg font-semibold mb-6 ${
                  plan.highlight
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                }`}
              >
                {plan.priceId ? "Sottoscrivi" : "Inizia Gratis"}
              </button>

              <ul className="space-y-3">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start text-sm">
                    <span className="mr-2">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### 2.2 Subscription Status Component

Create `artifacts/trader-dashboard/src/components/AccountBilling.tsx`:

```typescript
// artifacts/trader-dashboard/src/components/AccountBilling.tsx

import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";

export function AccountBilling() {
  const { user } = useUser();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const res = await fetch("/api/subscription");
      const data = await res.json();
      setSubscription(data);
    } catch (err) {
      console.error("Error fetching subscription:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      console.error("Error accessing billing portal:", err);
    }
  };

  if (loading) return <div>Caricamento...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Abbonamento</h2>

      {subscription && (
        <div className="border rounded-lg p-4 mb-6">
          <p className="text-gray-600 mb-2">Piano attuale</p>
          <p className="text-3xl font-bold capitalize mb-2">
            {subscription.plan}
          </p>
          <p className="text-gray-600 mb-4">
            Stato: <span className="font-semibold">{subscription.status}</span>
          </p>

          {subscription.currentPeriodEnd && (
            <p className="text-sm text-gray-500">
              Rinnovo il {new Date(subscription.currentPeriodEnd).toLocaleDateString("it-IT")}
            </p>
          )}
        </div>
      )}

      <button
        onClick={handleManageBilling}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
      >
        Gestisci Abbonamento
      </button>
    </div>
  );
}
```

### 2.3 Paywall / Feature Gating UI

Create a hook to check feature access:

```typescript
// artifacts/trader-dashboard/src/hooks/useFeatureAccess.ts

import { useQuery } from "@tanstack/react-query";

export function useFeatureAccess(featureName: string) {
  return useQuery({
    queryKey: ["feature-access", featureName],
    queryFn: async () => {
      const res = await fetch(`/api/feature-access/${featureName}`);
      if (!res.ok) throw new Error("Feature check failed");
      return res.json();
    },
  });
}
```

Use in component:

```typescript
import { useFeatureAccess } from "./hooks/useFeatureAccess";

export function AdvancedAlerts() {
  const { data: access, isLoading } = useFeatureAccess("alerts_advanced");

  if (isLoading) return <div>Caricamento...</div>;

  if (!access?.allowed) {
    return (
      <div className="p-4 border-2 border-yellow-300 bg-yellow-50 rounded-lg">
        <p className="font-semibold">Avvisi Avanzati</p>
        <p className="text-sm text-gray-600 mb-3">
          Aggiorna a Pro per accedere agli avvisi avanzati con filtri ML.
        </p>
        <a href="/pricing" className="text-blue-600 underline">
          Vedi i piani
        </a>
      </div>
    );
  }

  return (
    <div>
      {/* Feature content */}
    </div>
  );
}
```

---

## Phase 3: Testing & Deployment (Days 9–10)

### 3.1 Local Testing Checklist

- [ ] Create test Stripe account (restricted key for testing)
- [ ] Test checkout flow (create session → redirect → success)
- [ ] Test webhook handling (use `stripe listen` CLI)
- [ ] Verify subscription creation in DB
- [ ] Test feature gating (plan → allowed features)
- [ ] Test upgrade flow (Freemium → Pro)
- [ ] Test billing portal access
- [ ] Test error handling (failed payments, network issues)

### 3.2 Staging Deployment

```bash
# Deploy API server to staging
pnpm run build:railway

# Set Stripe keys in staging environment
# STRIPE_SECRET_KEY=sk_live_... (staging key)
# STRIPE_WEBHOOK_SECRET=whsec_...

# Verify webhook delivery in Stripe Dashboard → Webhooks
```

### 3.3 Production Rollout (Soft Launch)

1. **Enable Freemium** (50% of signups):
   ```typescript
   // Feature flag
   const showPaywall = Math.random() < 0.5;
   ```

2. **Run for 1 week** — collect baseline metrics (signup rate, activation, engagement).

3. **Enable trial** (remaining 50%):
   ```typescript
   const trialDays = 7;
   ```

4. **Monitor**:
   - Conversion rate (trial → paid)
   - Plan selection mix
   - Churn rate D7, D30
   - Support tickets (billing issues)

---

## Stripe API Key Management

### Development
```bash
# Use Stripe test keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### Production
```bash
# Use Stripe live keys (restricted to production env only)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**NEVER commit secrets to git** — use environment variables / secrets management (GitHub Secrets, Vercel Environment, Railway Secrets).

---

## Monitoring & Observability

### Key Logs
```
[INFO] Checkout session created: session_cs_123, user_456
[INFO] Subscription webhook received: sub_789, status=active
[ERROR] Webhook signature mismatch: event rejected
[WARN] Feature access denied: user_456, feature=alerts_advanced
```

### Metrics to Track
- Stripe API response time (ms)
- Webhook delivery latency
- Checkout abandonment rate
- Subscription creation latency
- Feature gate cache hit rate

---

## Error Handling & Edge Cases

| Error | Mitigation |
|---|---|
| Webhook signature mismatch | Validate `STRIPE_WEBHOOK_SECRET`. Retry after 24h. |
| Duplicate subscription creation | Use idempotency key on Stripe API calls. |
| Feature gate timeout | Fail open (allow feature) + log error. |
| Payment failure | Trigger email notification, allow downgrade to Freemium. |
| User deletes Stripe customer | Handle `customer.deleted` webhook; mark subscription as canceled. |

---

## Deployment Checklist (GO LIVE)

- [ ] All environment variables set (production keys, URLs)
- [ ] Database migrations applied
- [ ] Stripe webhooks configured + tested
- [ ] Email notifications configured (Sendgrid, etc.)
- [ ] Monitoring alerts set (payment failures, webhook errors)
- [ ] Backup & recovery plan documented
- [ ] Legal: Terms of Service + Privacy Policy updated (mention billing)
- [ ] Support team briefed on common issues
- [ ] Soft launch with 10% traffic
- [ ] Monitor for 24h before 100% rollout

---

**Document Version**: 1.0 | **Last Updated**: 2026-06-10
**Owner**: Engineering Team | **Status**: Ready for Phase 0 execution
