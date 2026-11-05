import assert from "node:assert/strict";
import { CircuitBreaker } from "./circuitBreaker.js";
import { systemWatchdog, type AnomalyRecord } from "./systemWatchdog.js";
import {
  dispatchWatchdogCanaryAlert,
  dispatchWatchdogDailyDigest,
  getWatchdogAlertTelemetry,
  resetWatchdogAlertDedupeForTesting,
} from "./watchdogAlerting.js";

function makeAnomaly(overrides?: Partial<AnomalyRecord>): AnomalyRecord {
  return {
    id: "anom_test_001",
    timestamp: "2026-11-05T01:45:00.000Z",
    kind: "databaseLag",
    severity: "warn",
    message: "PostgreSQL ping exceeded 350ms",
    metadata: { dbPingMs: 412 },
    ...overrides,
  };
}

// 1. Dark-by-default when WATCHDOG_ALERT_WEBHOOK_URL is unset
delete process.env.WATCHDOG_ALERT_WEBHOOK_URL;
resetWatchdogAlertDedupeForTesting();

const unconfiguredResult = await dispatchWatchdogCanaryAlert(makeAnomaly());
assert.equal(unconfiguredResult.dispatched, false);
if (!unconfiguredResult.dispatched) {
  assert.equal(unconfiguredResult.reason, "webhook_unconfigured");
}
assert.equal(getWatchdogAlertTelemetry().configured, false);
assert.equal(getWatchdogAlertTelemetry().dispatchedCount, 0);

// 2. Discord webhook payload formatting
resetWatchdogAlertDedupeForTesting();
let capturedUrl = "";
let capturedBody: Record<string, unknown> = {};

const mockDiscordFetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  capturedUrl = String(input);
  capturedBody = JSON.parse(String(init?.body ?? "{}"));
  return new Response(null, { status: 204 });
}) as typeof fetch;

const discordRes = await dispatchWatchdogCanaryAlert(makeAnomaly(), {
  webhookUrl: "https://discord.com/api/webhooks/123456/token_abc",
  fetchImpl: mockDiscordFetch,
  now: 10_000,
});
assert.equal(discordRes.dispatched, true);
if (discordRes.dispatched) {
  assert.equal(discordRes.provider, "discord");
  assert.equal(discordRes.statusCode, 204);
}
assert.equal(capturedUrl, "https://discord.com/api/webhooks/123456/token_abc");
assert.equal(capturedBody.username, "AUREUS Watchdog Canary");
assert.ok(Array.isArray(capturedBody.embeds));
assert.equal((capturedBody.embeds as Array<Record<string, unknown>>)[0]?.color, 0xc5a059);

// 3. Slack webhook payload formatting
resetWatchdogAlertDedupeForTesting();
const slackRes = await dispatchWatchdogCanaryAlert(
  makeAnomaly({ severity: "critical", kind: "unhandledRejection", message: "Cascade storm" }),
  {
    webhookUrl: "https://hooks.slack.com/services/T00/B00/X00",
    fetchImpl: mockDiscordFetch,
    now: 20_000,
  },
);
assert.equal(slackRes.dispatched, true);
if (slackRes.dispatched) {
  assert.equal(slackRes.provider, "slack");
}
assert.ok(typeof capturedBody.text === "string" && capturedBody.text.includes("AUREUS WATCHDOG CRITICAL"));

// 4. Generic JSON webhook payload formatting
resetWatchdogAlertDedupeForTesting();
const genericRes = await dispatchWatchdogCanaryAlert(makeAnomaly(), {
  webhookUrl: "https://ops.aureus.internal/webhooks/canary",
  fetchImpl: mockDiscordFetch,
  now: 30_000,
});
assert.equal(genericRes.dispatched, true);
if (genericRes.dispatched) {
  assert.equal(genericRes.provider, "generic");
}
assert.equal(capturedBody.service, "aureus-api");
assert.equal(capturedBody.event, "watchdog.anomaly");

// 5. Cooldown deduplication & severity escalation
resetWatchdogAlertDedupeForTesting();
let callCount = 0;
const countingFetch = (async () => {
  callCount += 1;
  return new Response("ok", { status: 200 });
}) as typeof fetch;

const firstDispatch = await dispatchWatchdogCanaryAlert(makeAnomaly(), {
  webhookUrl: "https://ops.aureus.internal/webhooks/canary",
  fetchImpl: countingFetch,
  cooldownMs: 60_000,
  now: 100_000,
});
assert.equal(firstDispatch.dispatched, true);
assert.equal(callCount, 1);

// Duplicate kind:severity within 60s window is suppressed
const duplicateDispatch = await dispatchWatchdogCanaryAlert(makeAnomaly(), {
  webhookUrl: "https://ops.aureus.internal/webhooks/canary",
  fetchImpl: countingFetch,
  cooldownMs: 60_000,
  now: 120_000,
});
assert.equal(duplicateDispatch.dispatched, false);
if (!duplicateDispatch.dispatched) {
  assert.equal(duplicateDispatch.reason, "cooldown_suppressed");
}
assert.equal(callCount, 1);
assert.equal(getWatchdogAlertTelemetry().suppressedCount, 1);

// Escalation to critical severity bypasses warn dedupe key
const criticalEscalation = await dispatchWatchdogCanaryAlert(
  makeAnomaly({ severity: "critical" }),
  {
    webhookUrl: "https://ops.aureus.internal/webhooks/canary",
    fetchImpl: countingFetch,
    cooldownMs: 60_000,
    now: 125_000,
  },
);
assert.equal(criticalEscalation.dispatched, true);
assert.equal(callCount, 2);

// After cooldown expires, warn dispatches again
const afterCooldown = await dispatchWatchdogCanaryAlert(makeAnomaly(), {
  webhookUrl: "https://ops.aureus.internal/webhooks/canary",
  fetchImpl: countingFetch,
  cooldownMs: 60_000,
  now: 165_000,
});
assert.equal(afterCooldown.dispatched, true);
assert.equal(callCount, 3);

// 6. SSRF / Non-HTTPS rejection in production mode & graceful network error handling
resetWatchdogAlertDedupeForTesting();
const insecureRes = await dispatchWatchdogCanaryAlert(makeAnomaly(), {
  webhookUrl: "http://ops.aureus.internal/webhooks/canary",
  fetchImpl: countingFetch,
  isProduction: true,
});
assert.equal(insecureRes.dispatched, false);
if (!insecureRes.dispatched) {
  assert.equal(insecureRes.reason, "insecure_protocol");
}
assert.equal(getWatchdogAlertTelemetry().failedCount, 1);

const rejectingFetch = (async () => {
  throw new Error("socket hang up");
}) as typeof fetch;

const netErrRes = await dispatchWatchdogCanaryAlert(makeAnomaly({ kind: "memoryPressure" }), {
  webhookUrl: "https://ops.aureus.internal/webhooks/canary",
  fetchImpl: rejectingFetch,
});
assert.equal(netErrRes.dispatched, false);
if (!netErrRes.dispatched) {
  assert.equal(netErrRes.reason, "network_error");
}
assert.equal(getWatchdogAlertTelemetry().failedCount, 2);

// 7. CircuitBreaker -> systemWatchdog integration test
systemWatchdog.resetForTesting();
const testBreaker = new CircuitBreaker({
  name: "twelve-data-canary-test",
  failureThreshold: 2,
  cooldownMs: 10_000,
});

await assert.rejects(() => testBreaker.execute(async () => { throw new Error("upstream timeout 1"); }));
await assert.rejects(() => testBreaker.execute(async () => { throw new Error("upstream timeout 2"); }));
assert.equal(testBreaker.getState(), "OPEN");

const telemetry = systemWatchdog.getTelemetry();
assert.equal(telemetry.totalAnomalies, 1);
assert.equal(telemetry.recentAnomalies[0]?.kind, "circuitBreaker");
assert.match(telemetry.recentAnomalies[0]?.message ?? "", /twelve-data-canary-test/);
assert.ok(telemetry.alerting);

// 8. Daily Health Digest ("L'Araldo della Soglia") multi-provider test
resetWatchdogAlertDedupeForTesting();
const digestRes = await dispatchWatchdogDailyDigest(
  {
    status: "healthy",
    uptimeSeconds: 86_400,
    totalRequests: 14_250,
    errorRatePct: 0.04,
    avgLatencyMs: 28,
    p95LatencyMs: 74,
    heapUsedMb: 142,
    rssMb: 238,
    totalAnomalies: 0,
  },
  {
    webhookUrl: "https://discord.com/api/webhooks/123456/token_abc",
    fetchImpl: mockDiscordFetch,
  },
);
assert.equal(digestRes.dispatched, true);
assert.equal(capturedBody.username, "AUREUS Araldo della Soglia");
assert.equal((capturedBody.embeds as Array<Record<string, unknown>>)[0]?.color, 0x10b981);

console.log("watchdog alerting & circuit breaker integration tests passed");
