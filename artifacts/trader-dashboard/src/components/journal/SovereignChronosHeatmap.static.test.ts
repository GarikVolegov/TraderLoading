import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("SovereignChronosHeatmap Source Inspection: Dual-Mode Architecture & Design System", () => {
  const source = fs.readFileSync(path.join(__dirname, "SovereignChronosHeatmap.tsx"), "utf8");

  // 1. Dual-mode support (Mese vs Dispersione Oraria)
  assert.ok(source.includes("viewMode"), "Must support viewMode state");
  assert.ok(source.includes("Resa Mensile"), "Must keep Resa Mensile header for calendar mode");
  assert.ok(source.includes("Dispersione Oraria"), "Must include Dispersione Oraria mode");
  assert.ok(source.includes("computeChronosMatrix"), "Must compute 2D chronos dispersion matrix");

  // 2. Telemetry and Sessions
  assert.ok(source.includes("CHRONOS_SESSIONS"), "Must bind CHRONOS_SESSIONS");
  assert.ok(source.includes("CHRONOS_WEEKDAYS"), "Must bind CHRONOS_WEEKDAYS");
  assert.ok(source.includes("bestExecutionWindow"), "Must render Finestra d'Oro telemetry");
  assert.ok(source.includes("dangerWindow"), "Must render Finestra a Rischio telemetry");

  // 3. Strict Design System Compliance
  assert.ok(source.includes("whitespace-nowrap"), "Must include whitespace-nowrap on all financial figures and units");
  assert.ok(source.includes("font-mono"), "Must format metrics in monospace font");
  assert.ok(!source.includes('"DB"'), "Forbidden technical debug tags must not exist");
  assert.ok(!source.includes('"MOCK"'), "Forbidden mock tags must not exist");
  assert.ok(!source.includes('"TEST"'), "Forbidden test tags must not exist");
});
