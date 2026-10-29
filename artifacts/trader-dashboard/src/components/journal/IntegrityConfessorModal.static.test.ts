import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceFile = path.join(__dirname, "IntegrityConfessorModal.tsx");

test("IntegrityConfessorModal: source file exists", () => {
  assert.ok(fs.existsSync(sourceFile), "IntegrityConfessorModal.tsx must exist");
});

test("IntegrityConfessorModal: contains essential stoic questions and lore", () => {
  const content = fs.readFileSync(sourceFile, "utf8");

  // Title and branding
  assert.ok(content.includes("Il Confessore dell'Integrità"), "Must feature solemn modal title");
  assert.ok(content.includes("Esame di coscienza operativo"), "Must feature monastic subtitle");

  // 3 Stoic inquiries
  assert.ok(content.includes("Rispetto Rigoroso dello Stop Loss"), "Must feature Stop Loss question");
  assert.ok(content.includes("Silenzio Operativo"), "Must feature Anti-Overtrading question");
  assert.ok(content.includes("Verità nel Registro"), "Must feature Truthful Ledger question");

  // Seals and palettes
  assert.ok(content.includes("#C5A059"), "Must use imperial gold");
  assert.ok(content.includes("#07080b"), "Must use obsidian background");
  assert.ok(content.includes("synestheticTrophy"), "Must trigger synesthetic sounds on seal");

  // No gambling / gaming arcade terms
  assert.ok(!content.includes("gambling"), "No gambling terms");
  assert.ok(!content.includes("scommessa"), "No betting terms");
  assert.ok(!content.includes("punti XP"), "No XP arcade terms");
});
