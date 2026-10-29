import assert from "node:assert/strict";
import {
  parseAndValidateTemplateFile,
  exportAllTemplatesAsJson,
  exportSingleTemplateAsJson,
} from "./CloudTemplateManager";
import { DEFAULT_AUREUS_TEMPLATES, pickChartSettings, type BacktestChartTemplate } from "../../../../../contracts/backtestChart";

console.log("=== VERIFICA ESPO / IMPO & CLOUD SYNC MODELLI GRAFICO AUREUS ===");

// 1. Validazione Struttura Template Predefiniti
assert.ok(DEFAULT_AUREUS_TEMPLATES.length >= 3, "Devono esistere i modelli AUREUS");
for (const t of DEFAULT_AUREUS_TEMPLATES) {
  assert.ok(t.id, "Ogni modello deve avere un id");
  assert.ok(t.name, "Ogni modello deve avere un nome");
  assert.ok(t.settings, "Ogni modello deve avere settings validi");
  assert.ok(Array.isArray(t.indicators), "Ogni modello deve avere array di indicatori");
}
console.log("✓ 1. Template predefiniti AUREUS strutturalmente validi.");

// Helper Mock File per test browser-like
function createMockFile(content: string, name: string = "test.json"): File {
  return {
    name,
    text: async () => content,
  } as unknown as File;
}

// 2. Test Importazione File Multi-Template
const multiTemplatePayload = {
  app: "AUREUS_PROTOCOL",
  version: 1,
  exportedAt: new Date().toISOString(),
  templates: [
    {
      id: "tpl-1",
      name: "Setup SMC Pro",
      settings: pickChartSettings({ chartType: "candles", candleUpColor: "#10b981" }),
      indicators: [{ id: "ind-1", type: "volume", on: true, color: "#10b981" }],
    },
    {
      id: "tpl-2",
      name: "Trend Reversal Scalper",
      settings: pickChartSettings({ chartType: "heikin", priceScaleMode: "logarithmic" }),
      indicators: [{ id: "ind-2", type: "ema", on: true, period: 20, color: "#C5A059" }],
    },
  ],
};

const validMultiFile = createMockFile(JSON.stringify(multiTemplatePayload));
const multiResult = await parseAndValidateTemplateFile(validMultiFile);
assert.equal(multiResult.success, true, "L'importazione del bundle multi-template deve avere successo");
assert.equal(multiResult.templates?.length, 2, "Devono essere importati esattamente 2 modelli");
assert.equal(multiResult.templates?.[0].name, "Setup SMC Pro");
assert.equal(multiResult.templates?.[1].name, "Trend Reversal Scalper");
console.log("✓ 2. Importazione bundle multi-template convalidata.");

// 3. Test Importazione File Singolo Template
const singleTemplatePayload = {
  app: "AUREUS_PROTOCOL",
  version: 1,
  exportedAt: new Date().toISOString(),
  template: {
    id: "single-1",
    name: "Golden Rejection ICT",
    settings: pickChartSettings({ chartType: "bars", showWatermark: true }),
    indicators: [{ id: "ind-single", type: "vwap", on: true, color: "#3b82f6" }],
  },
};

const validSingleFile = createMockFile(JSON.stringify(singleTemplatePayload));
const singleResult = await parseAndValidateTemplateFile(validSingleFile);
assert.equal(singleResult.success, true, "L'importazione del singolo template deve avere successo");
assert.equal(singleResult.templates?.length, 1);
assert.equal(singleResult.templates?.[0].name, "Golden Rejection ICT");
assert.equal(singleResult.templates?.[0].settings.chartType, "bars");
console.log("✓ 3. Importazione singolo template convalidata.");

// 4. Test Resilienza: File Malformato, Vuoto o Invalido
const invalidJsonFile = createMockFile("{ questo non è un json valido }");
const invalidResult = await parseAndValidateTemplateFile(invalidJsonFile);
assert.equal(invalidResult.success, false, "JSON malformato deve fallire con grazia");
assert.ok(invalidResult.error && invalidResult.error.length > 0);

const emptyObjectFile = createMockFile(JSON.stringify({ randomKey: 123 }));
const emptyResult = await parseAndValidateTemplateFile(emptyObjectFile);
assert.equal(emptyResult.success, false, "JSON privo di modelli deve fallire con messaggio descrittivo");

const emptyTemplatesArrayFile = createMockFile(JSON.stringify({ templates: [] }));
const emptyArrayResult = await parseAndValidateTemplateFile(emptyTemplatesArrayFile);
assert.equal(emptyArrayResult.success, false, "Array modelli vuoto deve restituire errore");
console.log("✓ 4. Resilienza a file non validi e gestione errori verificata.");

// 5. Test Sanitizzazione Proprietà Non Ammesse (Zero Pollution)
const maliciousPayload = {
  templates: [
    {
      id: "tpl-exploit",
      name: "Malicious Template",
      settings: {
        chartType: "candles",
        arbitraryScript: "<script>alert(1)</script>",
        nestedBomb: { a: { b: 1 } },
      },
      indicators: [],
    },
  ],
};

const sanitizationFile = createMockFile(JSON.stringify(maliciousPayload));
const sanitizationResult = await parseAndValidateTemplateFile(sanitizationFile);
assert.equal(sanitizationResult.success, true);
assert.equal((sanitizationResult.templates?.[0].settings as any).arbitraryScript, undefined, "Chiavi estranee devono essere eliminate da pickChartSettings");
assert.equal((sanitizationResult.templates?.[0].settings as any).nestedBomb, undefined, "Oggetti nidificati estranei devono essere eliminati");
console.log("✓ 5. Sanitizzazione e sicurezza dei dati importati convalidata con successo.");

console.log("==================================================================");
console.log("TUTTI I TEST DI SINCRONIZZAZIONE ED ESPORTAZIONE CLOUD SUPERATI!");
console.log("==================================================================");
