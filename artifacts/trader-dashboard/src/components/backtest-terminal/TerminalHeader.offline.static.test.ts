import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("TerminalHeader Source Inspection: Offline Replay Buffer Telemetry", () => {
  const headerSource = fs.readFileSync(path.join(__dirname, "TerminalHeader.tsx"), "utf8");

  assert.ok(
    headerSource.includes("engine.source === \"offline_buffer\""),
    "TerminalHeader must check if engine.source is offline_buffer",
  );
  assert.ok(
    headerSource.includes("BUFFER OFFLINE"),
    "TerminalHeader must display BUFFER OFFLINE chip label",
  );
  assert.ok(
    headerSource.includes("ATTIVO"),
    "TerminalHeader must display ATTIVO status chip value",
  );
  assert.ok(
    headerSource.includes("HardDrive"),
    "TerminalHeader must render HardDrive icon",
  );
  assert.ok(
    headerSource.includes("whitespace-nowrap"),
    "TerminalHeader must maintain whitespace-nowrap on status chips",
  );
});

test("useReplayEngine Source Inspection: Exposes window source", () => {
  const engineSource = fs.readFileSync(path.join(__dirname, "useReplayEngine.ts"), "utf8");

  assert.ok(
    engineSource.includes("source: window_.source"),
    "useReplayEngine must expose source property from candle window",
  );
});
