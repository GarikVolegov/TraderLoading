import assert from "node:assert/strict";
import fs from "node:fs";

// ─── Responsive Modals Ecosystem Static Verification ────────────────────────
// Verifies that core modals across Journal, Financial Architecture and Tornei
// utilize LimenResponsiveDrawer to provide divergent Desktop Dialog vs Mobile
// Bottom Sheet ergonomics.

const filesToCheck = [
  "src/components/JournalEntryModal.tsx",
  "src/components/financial/InstrumentDossierModal.tsx",
  "src/components/financial/PropFirmCalculatorModal.tsx",
  "src/components/financial/TaxDoctrineModal.tsx",
  "src/components/tornei/CertModal.tsx",
];

for (const filePath of filesToCheck) {
  const content = fs.readFileSync(filePath, "utf8");

  assert.match(
    content,
    /LimenResponsiveDrawer/,
    `${filePath} must integrate LimenResponsiveDrawer for adaptive desktop/mobile behavior`,
  );

  assert.doesNotMatch(
    content,
    /<Dialog\s+open=/,
    `${filePath} must not use legacy centered Radix <Dialog open= directly`,
  );
}

console.log("Responsive Modals Ecosystem static checks passed with 100% precision!");
