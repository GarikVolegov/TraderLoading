import assert from "node:assert/strict";
import { createHealthRouter } from "./health.js";

const router = createHealthRouter({
  checkDatabase: async () => ({ status: "ok", latencyMs: 2 }),
  checkRedis: async () => ({ status: "ok", latencyMs: 1 }),
  version: "test-v1",
});

let statusCode = 0;
let jsonBody: unknown = null;

const mockRes = {
  status(code: number) {
    statusCode = code;
    return this;
  },
  json(body: unknown) {
    jsonBody = body;
  },
};

// Find the readiness handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const routes = (router as any).stack;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const readyRoute = routes.find((r: any) => r.route?.path === "/readyz");
assert.ok(readyRoute, "readiness route should exist");

await readyRoute.route.stack[0].handle({}, mockRes);

assert.equal(statusCode, 200);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const body = jsonBody as any;
assert.equal(body.status, "ok");
assert.equal(body.service, "api");
assert.equal(body.version, "test-v1");
assert.ok(Number.isFinite(body.memoryMb.rss), "memoryMb.rss should be finite number");
assert.ok(Number.isFinite(body.memoryMb.heapUsed), "memoryMb.heapUsed should be finite number");
assert.ok(Number.isFinite(body.memoryMb.heapTotal), "memoryMb.heapTotal should be finite number");
assert.ok(typeof body.circuitBreakers === "object" && body.circuitBreakers !== null, "circuitBreakers should be an object");

// Test scaled environment requirement
const scaledRouter = createHealthRouter({
  checkDatabase: async () => ({ status: "ok", latencyMs: 2 }),
  checkRedis: async () => ({ status: "error", latencyMs: 0, error: "redis_required_in_scaled_env" }),
  version: "test-v1",
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const scaledReadyRoute = (scaledRouter as any).stack.find((r: any) => r.route?.path === "/readyz");
await scaledReadyRoute.route.stack[0].handle({}, mockRes);
assert.equal(statusCode, 503, "readiness must return 503 when Redis check fails in scaled env");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
assert.equal((jsonBody as any).status, "degraded");

console.log("health readiness memory telemetry checks passed");
