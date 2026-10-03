import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { createHealthRouter } from "./health.js";

type Check = { status: "ok" | "error"; latencyMs: number; error?: string };

async function startHealthServer(
  checkDatabase: () => Promise<Check>,
  checkRedis?: () => Promise<Check | null>,
) {
  const app = express();
  app.use("/api", createHealthRouter({ checkDatabase, checkRedis, version: "test-version" }));
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/api`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

{
  const server = await startHealthServer(async () => ({ status: "ok", latencyMs: 4 }));
  try {
    const response = await fetch(`${server.baseUrl}/healthz`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { status: string; uptimeSeconds?: number; version?: string };
    assert.equal(body.status, "ok");
    assert.equal(typeof body.uptimeSeconds, "number");
    assert.equal(body.version, "test-version");
  } finally {
    await server.close();
  }
}

{
  const server = await startHealthServer(async () => ({ status: "ok", latencyMs: 6 }));
  try {
    for (const path of ["/readyz", "/status"]) {
      const response = await fetch(`${server.baseUrl}${path}`);
      assert.equal(response.status, 200, path);
      const body = (await response.json()) as {
        status: string;
        checks: { database: { status: string; latencyMs: number } };
      };
      assert.equal(body.status, "ok");
      assert.equal(body.checks.database.status, "ok");
      assert.equal(body.checks.database.latencyMs, 6);
    }
  } finally {
    await server.close();
  }
}

{
  const server = await startHealthServer(async () => ({ status: "error", latencyMs: 12, error: "connection refused" }));
  try {
    const response = await fetch(`${server.baseUrl}/readyz`);
    assert.equal(response.status, 503);
    const body = (await response.json()) as {
      status: string;
      checks: { database: { status: string; error?: string } };
    };
    assert.equal(body.status, "degraded");
    assert.equal(body.checks.database.status, "error");
    assert.equal(body.checks.database.error, "database_unavailable");
  } finally {
    await server.close();
  }
}

// Finding 2.6: /readyz must actually check Redis when it's configured — a down
// Redis with the endpoint still "ok" hides a real outage from the load balancer.
{
  const server = await startHealthServer(
    async () => ({ status: "ok", latencyMs: 3 }),
    async () => ({ status: "error", latencyMs: 9, error: "redis ping timeout" }),
  );
  try {
    const response = await fetch(`${server.baseUrl}/readyz`);
    assert.equal(response.status, 503);
    const body = (await response.json()) as {
      status: string;
      checks: { database: { status: string }; redis?: { status: string; error?: string } };
    };
    assert.equal(body.status, "degraded");
    assert.equal(body.checks.redis?.status, "error");
    assert.equal(body.checks.redis?.error, "redis_unavailable");
  } finally {
    await server.close();
  }
}

// Redis NOT configured (single instance, in-memory fallback by design — see 2.5):
// the check returns null and readiness stays ok, with no redis key in the payload.
{
  const server = await startHealthServer(
    async () => ({ status: "ok", latencyMs: 3 }),
    async () => null,
  );
  try {
    const response = await fetch(`${server.baseUrl}/readyz`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      status: string;
      checks: { database: { status: string }; redis?: { status: string } };
    };
    assert.equal(body.status, "ok");
    assert.equal(body.checks.redis, undefined);
  } finally {
    await server.close();
  }
}

// Redis configured and healthy: reported ok, readiness ok.
{
  const server = await startHealthServer(
    async () => ({ status: "ok", latencyMs: 3 }),
    async () => ({ status: "ok", latencyMs: 2 }),
  );
  try {
    const response = await fetch(`${server.baseUrl}/readyz`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      status: string;
      checks: { redis?: { status: string; latencyMs: number } };
    };
    assert.equal(body.status, "ok");
    assert.equal(body.checks.redis?.status, "ok");
    assert.equal(body.checks.redis?.latencyMs, 2);
  } finally {
    await server.close();
  }
}

console.log("health route observability checks passed");
