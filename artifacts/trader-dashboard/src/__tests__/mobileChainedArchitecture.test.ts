import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRoot = path.resolve(__dirname, "..");

function readSrcFile(relPath: string): string {
  return fs.readFileSync(path.join(srcRoot, relPath), "utf8");
}

describe("AUREUS Mobile Multi-Level Chained Architecture & System Compilation Tutorial", () => {
  it("exports 3 institutional system presets in SystemCompilationTutorialModal with complete rule snapshots", () => {
    const content = readSrcFile("components/process/SystemCompilationTutorialModal.tsx");
    assert.ok(content.includes("export const SYSTEM_TUTORIAL_PRESETS"));
    assert.ok(content.includes("Protocollo Sweep & Inversione Strutturale"));
    assert.ok(content.includes("Protocollo Espansione & Pullback Istituzionale"));
    assert.ok(content.includes("Protocollo Struttura Sovrana H4 / Daily"));
    assert.ok(content.includes("export function SystemCompilationTutorialModal"));
  });

  it("provides MobileChainWizard and QuickSelectChipBar in components/ui/MobileChainWizard.tsx", () => {
    const content = readSrcFile("components/ui/MobileChainWizard.tsx");
    assert.ok(content.includes("export function MobileChainWizard"));
    assert.ok(content.includes("export function QuickSelectChipBar"));
    assert.ok(content.includes("Tutorial Sistema"));
    assert.ok(content.includes("whitespace-nowrap"));
  });

  it("chains Method.tsx system compilation across 5 progressive steps with QuickSelectChipBar and Tutorial", () => {
    const content = readSrcFile("pages/Method.tsx");
    assert.ok(content.includes("const chainSteps: ChainStepMeta[]"));
    assert.ok(content.includes("Identità & Mercati"));
    assert.ok(content.includes("Finestre & Setup"));
    assert.ok(content.includes("Trigger & Stop"));
    assert.ok(content.includes("Rischio & Attesa"));
    assert.ok(content.includes("Custode & Sigillo"));
    assert.ok(content.includes("MobileChainWizard"));
    assert.ok(content.includes("QuickSelectChipBar"));
    assert.ok(content.includes("SystemCompilationTutorialModal"));
  });

  it("chains DailyOrderStageCard (4 stages) and DailyOrderMethodConsole (3 levels) with tutorial access", () => {
    const stageCard = readSrcFile("components/daily-order/DailyOrderStageCard.tsx");
    assert.ok(stageCard.includes("MOBILE_DAILY_STAGES"));
    assert.ok(stageCard.includes("daily-order-mobile-chain"));
    assert.ok(stageCard.includes("SystemCompilationTutorialModal"));

    const methodConsole = readSrcFile("components/daily-order/DailyOrderMethodConsole.tsx");
    assert.ok(methodConsole.includes("method-console-mobile-chain"));
    assert.ok(methodConsole.includes("SystemCompilationTutorialModal"));
  });

  it("chains Backtest.tsx mobile workbench across 3 levels (Sessioni -> KPI & Curva -> Trade) and 3-step NewSessionForm", () => {
    const content = readSrcFile("pages/Backtest.tsx");
    assert.ok(content.includes("const newSessionSteps: ChainStepMeta[]"));
    assert.ok(content.includes("01 · Sessioni"));
    assert.ok(content.includes("02 · KPI"));
    assert.ok(content.includes("03 · Trade"));
    assert.ok(content.includes("MobileChainWizard"));
    assert.ok(content.includes("QuickSelectChipBar"));
  });

  it("chains JournalEntryModal.tsx across 3 steps while preserving tag persistence contracts", () => {
    const content = readSrcFile("components/JournalEntryModal.tsx");
    assert.ok(content.includes("const journalChainSteps: ChainStepMeta[]"));
    assert.ok(content.includes("Coordinate & Esecuzione"));
    assert.ok(content.includes("Disciplina & Custode"));
    assert.ok(content.includes("Note & Prove Visive"));
    assert.ok(content.includes("MobileChainWizard"));
    assert.ok(content.includes("saveJournalTag"));
    assert.ok(content.includes("journalTagsQueryKey"));
  });

  it("provides mobile chained progression bars in FinancialArchitecture.tsx and Settings.tsx", () => {
    const finArch = readSrcFile("pages/FinancialArchitecture.tsx");
    assert.ok(finArch.includes("CATENA PATRIMONIALE · PASSO"));
    assert.ok(finArch.includes("Avanti:"));

    const settings = readSrcFile("pages/Settings.tsx");
    assert.ok(settings.includes("CATENA DOSSIER · PASSO"));
    assert.ok(settings.includes("handleSelectChainItem"));
  });
});
