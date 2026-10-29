import assert from "node:assert/strict";
import { systemWatchdog } from "./systemWatchdog.js";

systemWatchdog.resetForTesting();

// 1. Initial status
{
  const telemetry = systemWatchdog.getTelemetry();
  assert.equal(telemetry.status, "healthy");
  assert.equal(telemetry.totalAnomalies, 0);
  assert.equal(telemetry.recoveredRejections, 0);
}

// 2. Transient unhandled rejection is contained without shutdown
{
  const result = systemWatchdog.handleUnhandledRejection(new Error("Transient dukascopy socket hangup"));
  assert.equal(result.shouldShutdown, false);
  assert.equal(result.reasonSummary, "Transient dukascopy socket hangup");

  const telemetry = systemWatchdog.getTelemetry();
  assert.equal(telemetry.recoveredRejections, 1);
  assert.equal(telemetry.totalAnomalies, 1);
  assert.equal(telemetry.recentAnomalies.length, 1);
  assert.equal(telemetry.recentAnomalies[0].kind, "unhandledRejection");
}

// 3. Manual anomaly recording
{
  systemWatchdog.recordAnomaly("circuitBreaker", "TwelveData circuit breaker tripped to OPEN", "warn", {
    circuit: "twelvedata",
  });
  const telemetry = systemWatchdog.getTelemetry();
  assert.equal(telemetry.totalAnomalies, 2);
  assert.equal(telemetry.recentAnomalies[0].kind, "circuitBreaker");
}

// 4. Catastrophic cascade triggers shutdown recommendation
{
  // Trigger remaining rejections to hit >= CASCADE_THRESHOLD_COUNT (10)
  for (let i = 0; i < 8; i++) {
    const res = systemWatchdog.handleUnhandledRejection(new Error(`Cascade rejection ${i}`));
    assert.equal(res.shouldShutdown, false);
  }

  // 10th rejection in window triggers cascade
  const cascadeResult = systemWatchdog.handleUnhandledRejection(new Error("Avalanche fatal error"));
  assert.equal(cascadeResult.shouldShutdown, true);

  const telemetry = systemWatchdog.getTelemetry();
  assert.equal(telemetry.status, "critical");
}

systemWatchdog.resetForTesting();
console.log("systemWatchdog unit and resilience tests passed with 100% precision!");
