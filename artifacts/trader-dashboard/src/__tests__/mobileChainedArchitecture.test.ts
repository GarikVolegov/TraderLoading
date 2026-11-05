import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SYSTEM_TUTORIAL_PRESETS } from "../components/process/SystemCompilationTutorialModal";

const srcRoot = path.resolve(__dirname, "..");

function readSrcFile(relPath: string): string {
  return fs.readFileSync(path.join(srcRoot, relPath), "utf8");
}

describe("AUREUS Mobile Multi-Level Chained Architecture & System Compilation Tutorial", () => {
  it("exports 3 institutional system presets in SystemCompilationTutorialModal with complete rule snapshots", () => {
    expect(SYSTEM_TUTORIAL_PRESETS).toHaveLength(3);
    for (const preset of SYSTEM_TUTORIAL_PRESETS) {
      expect(preset.id).toBeTruthy();
      expect(preset.title).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.rules.markets.length).toBeGreaterThan(10);
      expect(preset.rules.setup.length).toBeGreaterThan(10);
      expect(preset.rules.entry.length).toBeGreaterThan(10);
      expect(preset.rules.stop.length).toBeGreaterThan(10);
      expect(preset.rules.checklist.length).toBeGreaterThanOrEqual(4);
    }
  });

  it("provides MobileChainWizard and QuickSelectChipBar in components/ui/MobileChainWizard.tsx", () => {
    const content = readSrcFile("components/ui/MobileChainWizard.tsx");
    expect(content).toContain("export function MobileChainWizard");
    expect(content).toContain("export function QuickSelectChipBar");
    expect(content).toContain("Tutorial Sistema");
    expect(content).toContain("whitespace-nowrap");
  });

  it("chains Method.tsx system compilation across 5 progressive steps with QuickSelectChipBar and Tutorial", () => {
    const content = readSrcFile("pages/Method.tsx");
    expect(content).toContain("METHOD_COMPILER_STEPS");
    expect(content).toContain("Identità & Mercati");
    expect(content).toContain("Finestre & Setup");
    expect(content).toContain("Trigger & Stop");
    expect(content).toContain("Rischio & Attesa");
    expect(content).toContain("Custode & Sigillo");
    expect(content).toContain("MobileChainWizard");
    expect(content).toContain("QuickSelectChipBar");
    expect(content).toContain("SystemCompilationTutorialModal");
  });

  it("chains DailyOrderStageCard (4 stages) and DailyOrderMethodConsole (3 levels) with tutorial access", () => {
    const stageCard = readSrcFile("components/daily-order/DailyOrderStageCard.tsx");
    expect(stageCard).toContain("CATENA OPERATIVA · TAPPA");
    expect(stageCard).toContain("SystemCompilationTutorialModal");

    const methodConsole = readSrcFile("components/daily-order/DailyOrderMethodConsole.tsx");
    expect(methodConsole).toContain("CATENA DEL METODO · LIVELLO");
    expect(methodConsole).toContain("SystemCompilationTutorialModal");
  });

  it("chains Backtest.tsx mobile workbench across 3 levels (Sessioni -> KPI & Curva -> Trade) and 3-step NewSessionForm", () => {
    const content = readSrcFile("pages/Backtest.tsx");
    expect(content).toContain("NEW_SESSION_STEPS");
    expect(content).toContain("01 · Sessioni");
    expect(content).toContain("02 · KPI & Curva");
    expect(content).toContain("03 · Trade");
    expect(content).toContain("MobileChainWizard");
    expect(content).toContain("QuickSelectChipBar");
  });

  it("chains JournalEntryModal.tsx across 3 steps while preserving tag persistence contracts", () => {
    const content = readSrcFile("components/JournalEntryModal.tsx");
    expect(content).toContain("JOURNAL_ENTRY_STEPS");
    expect(content).toContain("Coordinate & Esecuzione");
    expect(content).toContain("Disciplina & Custode");
    expect(content).toContain("Note & Prove Visive");
    expect(content).toContain("MobileChainWizard");
    expect(content).toContain("saveJournalTag");
    expect(content).toContain("journalTagsQueryKey");
  });

  it("provides mobile chained progression bars in FinancialArchitecture.tsx and Settings.tsx", () => {
    const finArch = readSrcFile("pages/FinancialArchitecture.tsx");
    expect(finArch).toContain("CATENA PATRIMONIALE · PASSO");
    expect(finArch).toContain("Avanti:");

    const settings = readSrcFile("pages/Settings.tsx");
    expect(settings).toContain("CATENA DOSSIER · PASSO");
    expect(settings).toContain("handleSelectChainItem");
  });
});
