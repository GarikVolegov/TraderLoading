import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";

process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";

const arsenalRouterModule = await import("./arsenal.js");
const arsenalRouter = arsenalRouterModule.default;
const { handleArsenalOrderSession } = arsenalRouterModule;

assert.ok(arsenalRouter, "arsenal router must be exported");
assert.ok(typeof handleArsenalOrderSession === "function", "handleArsenalOrderSession must be exported");

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  const userHeader = req.header("x-user");
  if (userHeader) {
    req.user = {
      id: userHeader,
      email: `${userHeader}@test.com`,
      firstName: "Test",
      lastName: "User",
      profileImageUrl: null,
    };
  }
  next();
});
app.use("/api", arsenalRouter);

const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert.ok(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}`;

async function request(path: string, user?: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(user ? { "x-user": user } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

try {
  // 1. GET /api/arsenal/products should be accessible without auth and return products
  const productsRes = await request("/api/arsenal/products");
  assert.equal(productsRes.status, 200);
  const productsData = (await productsRes.json()) as { products: unknown[] };
  assert.ok(Array.isArray(productsData.products));
  assert.ok(productsData.products.length >= 4);

  // 2. POST /api/arsenal/checkout requires auth
  const anonCheckout = await request("/api/arsenal/checkout", undefined, {
    productId: "codice-trimestrale",
  });
  assert.equal(anonCheckout.status, 401);

  // 3. POST /api/arsenal/checkout with invalid product id returns 404
  const invalidProduct = await request("/api/arsenal/checkout", "user1", {
    productId: "non-existent-product",
  });
  assert.equal(invalidProduct.status, 404);

  // 4. POST /api/arsenal/checkout with non-purchasable product returns 400
  const protocolCheckout = await request("/api/arsenal/checkout", "user1", {
    productId: "tempio-fisico",
  });
  assert.equal(protocolCheckout.status, 400);

  // 5. GET /api/arsenal/orders requires auth
  const anonOrders = await request("/api/arsenal/orders");
  assert.equal(anonOrders.status, 401);

  // 6. POST /api/arsenal/webhooks/printful should accept webhook ping
  const printfulHook = await request("/api/arsenal/webhooks/printful", undefined, {
    type: "package_shipped",
    data: {
      order: { external_id: "ord_test_nonexistent", id: 12345 },
      shipment: { tracking_number: "TRACK123", carrier: "DHL" },
    },
  });
  assert.equal(printfulHook.status, 200);
  const printfulJson = (await printfulHook.json()) as { received: boolean };
  assert.equal(printfulJson.received, true);

  // 7. POST /api/arsenal/webhooks/lulu should accept webhook ping
  const luluHook = await request("/api/arsenal/webhooks/lulu", undefined, {
    topic: "PRINT_JOB_STATUS_CHANGED",
    data: {
      external_id: "ord_test_nonexistent",
      id: 54321,
      status: { name: "SHIPPED" },
    },
  });
  assert.equal(luluHook.status, 200);
  const luluJson = (await luluHook.json()) as { received: boolean };
  assert.equal(luluJson.received, true);
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

console.log("Arsenal route authorization and validation checks passed successfully");
