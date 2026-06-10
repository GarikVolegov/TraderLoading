import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const { createBillingRouter } = await import("./billing.js");

async function startBillingServer(options = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = {
      id: "user-billing",
      email: "user@example.test",
      firstName: null,
      lastName: null,
      profileImageUrl: null,
    };
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
  const server = await startBillingServer({ getSubscription: async () => null });
  try {
    const response = await fetch(`${server.base}/billing/me`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      plan: "free",
      pro: false,
      status: "free",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    });
  } finally {
    await server.close();
  }
}

{
  const server = await startBillingServer({
    getSubscription: async () => ({
      plan: "pro",
      status: "active",
      currentPeriodEnd: new Date("2026-07-10T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
    }),
  });
  try {
    const response = await fetch(`${server.base}/billing/me`);
    assert.equal(response.status, 200);
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
    assert.deepEqual(await response.json(), { error: "stripe_not_configured", missing: ["STRIPE_SECRET_KEY"] });
  } finally {
    await server.close();
  }
}

{
  const server = await startBillingServer({
    config: {
      configured: true,
      missing: [],
      secretKey: "sk_test_123",
      priceId: "price_123",
      appBaseUrl: "http://localhost",
    },
    createCheckoutSession: async () => ({ clientSecret: "cs_test_123" }),
  });
  try {
    const response = await fetch(`${server.base}/billing/checkout-session`, { method: "POST" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { clientSecret: "cs_test_123" });
  } finally {
    await server.close();
  }
}

console.log("billing route checks passed");
