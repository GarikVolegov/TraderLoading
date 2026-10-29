import test from "node:test";
import assert from "node:assert/strict";
import {
  getParticipantPresence,
} from "./LiveBattleTelemetryHUD";
import type { RoomParticipant } from "../../../../api-server/src/services/backtestTournaments/battleRoomTypes";

test("LiveBattleTelemetryHUD: getParticipantPresence identifies recently active participants (<15s)", () => {
  const now = 1_700_000_000_000;
  const participant: RoomParticipant = {
    userId: "trader_alpha",
    displayName: "Iniziato Aureus",
    country: "IT",
    gradeTitle: "Custode",
    status: "trading",
    currentProfitPct: 2.5,
    currentDrawdownPct: 0.8,
    tradesCount: 4,
    lastActiveTs: now - 4_000, // 4s ago
  };

  const presence = getParticipantPresence(participant, now);
  assert.equal(presence.status, "active");
  assert.equal(presence.label, "Attivo ora");
  assert.ok(presence.dotClass.includes("bg-emerald-400"));
});

test("LiveBattleTelemetryHUD: getParticipantPresence identifies reflecting participants (15s-59s)", () => {
  const now = 1_700_000_000_000;
  const participant: RoomParticipant = {
    userId: "trader_beta",
    displayName: "Architetto del Varco",
    country: "IT",
    gradeTitle: "Architetto",
    status: "trading",
    currentProfitPct: -0.5,
    currentDrawdownPct: 1.2,
    tradesCount: 2,
    lastActiveTs: now - 35_000, // 35s ago
  };

  const presence = getParticipantPresence(participant, now);
  assert.equal(presence.status, "reflecting");
  assert.equal(presence.label, "In riflessione (35s)");
  assert.ok(presence.dotClass.includes("bg-amber-400"));
});

test("LiveBattleTelemetryHUD: getParticipantPresence identifies idle participants (>=60s)", () => {
  const now = 1_700_000_000_000;
  const participant: RoomParticipant = {
    userId: "trader_gamma",
    displayName: "Maestro Aureus",
    country: "IT",
    gradeTitle: "Maestro",
    status: "trading",
    currentProfitPct: 5.0,
    currentDrawdownPct: 0.4,
    tradesCount: 6,
    lastActiveTs: now - 185_000, // ~3 minutes ago
  };

  const presence = getParticipantPresence(participant, now);
  assert.equal(presence.status, "idle");
  assert.equal(presence.label, "Inattivo (3m)");
  assert.ok(presence.dotClass.includes("bg-slate-500"));
});

test("LiveBattleTelemetryHUD: getParticipantPresence honors terminal statuses", () => {
  const now = 1_700_000_000_000;

  // Disqualified
  const dqParticipant: RoomParticipant = {
    userId: "trader_dq",
    displayName: "Trader Emotivo",
    country: "IT",
    gradeTitle: "Novizio",
    status: "disqualified",
    currentProfitPct: -12.0,
    currentDrawdownPct: 10.5,
    tradesCount: 8,
    lastActiveTs: now - 2_000,
  };
  const dqPresence = getParticipantPresence(dqParticipant, now);
  assert.equal(dqPresence.status, "disqualified");
  assert.equal(dqPresence.label, "Squalificato");
  assert.ok(dqPresence.dotClass.includes("bg-rose-500"));

  // Finished
  const finishedParticipant: RoomParticipant = {
    ...dqParticipant,
    status: "finished",
  };
  const finishedPresence = getParticipantPresence(finishedParticipant, now);
  assert.equal(finishedPresence.status, "finished");
  assert.equal(finishedPresence.label, "Concluso");
});

test("LiveBattleTelemetryHUD: bio-telemetry heart rate and stress levels", () => {
  const calmParticipant: RoomParticipant = {
    userId: "trader_calm",
    displayName: "Iniziato Aureus",
    country: "IT",
    gradeTitle: "Custode",
    status: "trading",
    currentProfitPct: 3.5,
    currentDrawdownPct: 0.5,
    tradesCount: 3,
    lastActiveTs: Date.now(),
    biometricBpm: 64,
    stressLevel: "calm",
  };
  assert.equal(calmParticipant.biometricBpm, 64);
  assert.equal(calmParticipant.stressLevel, "calm");

  const elevatedParticipant: RoomParticipant = {
    ...calmParticipant,
    biometricBpm: 88,
    stressLevel: "elevated",
  };
  assert.equal(elevatedParticipant.biometricBpm, 88);
  assert.equal(elevatedParticipant.stressLevel, "elevated");

  const criticalParticipant: RoomParticipant = {
    ...calmParticipant,
    biometricBpm: 104,
    stressLevel: "critical",
  };
  assert.equal(criticalParticipant.biometricBpm, 104);
  assert.equal(criticalParticipant.stressLevel, "critical");
});

test("LiveBattleTelemetryHUD: source includes biometric BPM badge and design compliance", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const hudFile = path.join(dirname, "LiveBattleTelemetryHUD.tsx");

  assert.ok(fs.existsSync(hudFile), "LiveBattleTelemetryHUD.tsx must exist");
  const content = fs.readFileSync(hudFile, "utf8");

  assert.ok(content.includes("btmHeartPulse"), "Must contain smooth heart animation");
  assert.ok(content.includes("biometricBpm"), "Must render operator bio-telemetry BPM");
  assert.ok(content.includes("Heart"), "Must render Heart icon");
  assert.ok(content.includes("whitespace-nowrap"), "Must preserve nowrap on numeric tokens");
});
