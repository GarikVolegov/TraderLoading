import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spectatorPageFile = path.resolve(__dirname, "../../pages/PublicArenaSpectatorPage.tsx");
const equityChartFile = path.resolve(__dirname, "LiveComparativeEquityChart.tsx");
const shareModalFile = path.resolve(__dirname, "ArenaSpectatorShareModal.tsx");

test("PublicArenaSpectatorPage: files exist", () => {
  assert.ok(fs.existsSync(spectatorPageFile), "PublicArenaSpectatorPage.tsx must exist");
  assert.ok(fs.existsSync(equityChartFile), "LiveComparativeEquityChart.tsx must exist");
  assert.ok(fs.existsSync(shareModalFile), "ArenaSpectatorShareModal.tsx must exist");
});

test("PublicArenaSpectatorPage: design system & lore compliance", () => {
  const content = fs.readFileSync(spectatorPageFile, "utf8");

  // Lore stoico ed austero AUREUS
  assert.ok(content.includes("Le Prove del Fuoco"), "Must feature solemn arena title");
  assert.ok(content.includes("Tribuna Spettatori"), "Must state spectator tribune role");
  assert.ok(content.includes("AUREUS PROTOCOL"), "Must feature sovereign brand");
  assert.ok(content.includes("Sentenze della Disciplina"), "Must feature discipline sentences");

  // Telemetria Biometrica
  assert.ok(content.includes("biometricBpm"), "Must bind participant bio-telemetry BPM");
  assert.ok(content.includes("Heart"), "Must render heart icon");
  assert.ok(content.includes("BPM"), "Must display BPM metric");

  // Zero vuoti & bilanciamento colonne
  assert.ok(content.includes("LiveComparativeEquityChart"), "Must embed comparative equity chart");
  assert.ok(content.includes("ArenaSpectatorShareModal"), "Must embed spectator share modal");

  // Divieto di andare a capo antiestetici
  assert.ok(content.includes("whitespace-nowrap"), "Must enforce whitespace-nowrap on metrics");

  // Divieto tag di debug brutti
  const forbiddenTags = ['"DB"', '"ORVAL"', '"SCHEMA"', '"MOCK"', '"LOCAL"'];
  for (const tag of forbiddenTags) {
    assert.ok(!content.includes(tag), `Must not contain ugly debug tag: ${tag}`);
  }
});

test("LiveComparativeEquityChart: SVG rendering and threshold rules", () => {
  const content = fs.readFileSync(equityChartFile, "utf8");

  assert.ok(content.includes("<svg"), "Must render native SVG element");
  assert.ok(content.includes("SQUALIFICA"), "Must mark disqualification threshold");
  assert.ok(content.includes("#EF4444"), "Must use ruby color for disqualification");
  assert.ok(content.includes("#C5A059"), "Must use imperial gold for combatant 1");
  assert.ok(content.includes("whitespace-nowrap"), "Must preserve nowrap on percentage tokens");
});

test("ArenaSpectatorShareModal: QR code and Web Share API integration", () => {
  const content = fs.readFileSync(shareModalFile, "utf8");

  assert.ok(content.includes("QRCode"), "Must generate dynamic QR code");
  assert.ok(content.includes("synestheticCheck"), "Must play check chime on copy");
  assert.ok(content.includes("navigator.share"), "Must support Web Share API");
  assert.ok(content.includes("Tribuna degli Spettatori"), "Must display noble title");
});
