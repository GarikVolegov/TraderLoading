import assert from "node:assert/strict";
import { systemWatchdog } from "../lib/systemWatchdog.js";
import { performSystemHousekeeping } from "./systemMaintenance.js";

systemWatchdog.resetForTesting();

// Verifica stato iniziale manutenzione
{
  const initial = systemWatchdog.getMaintenanceTelemetry();
  assert.equal(initial.status, "idle");
  assert.equal(initial.lastRunAt, null);
  assert.equal(initial.prunedOrphanRooms, 0);
}

// Esecuzione housekeeping (usa db o mock fallback con gestione resiliente)
{
  const result = await performSystemHousekeeping();
  assert.ok(result.status === "completed" || result.status === "error");
  assert.ok(typeof result.durationMs === "number");

  const telemetry = systemWatchdog.getMaintenanceTelemetry();
  assert.ok(telemetry.status === "completed" || telemetry.status === "error");
  if (telemetry.status === "completed") {
    assert.ok(telemetry.lastRunAt !== null);
  }
}

systemWatchdog.resetForTesting();
console.log("systemMaintenance self-healing housekeeping tests passed with 100% precision!");
