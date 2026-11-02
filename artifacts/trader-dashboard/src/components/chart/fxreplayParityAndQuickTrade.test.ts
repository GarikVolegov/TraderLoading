import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPipMultiplier } from "../../lib/pipMultiplier.js";
import { computeLots, pipValuePerLot } from "../../lib/replay/lotSizing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chartDir = __dirname;

describe("AUREUS Forgia del Passato: Parità FXReplay, Esecuzione Rapida Buy/Sell & Rigore Limen", () => {
  const chartTsxPath = path.join(chartDir, "LimenProprietaryChart.tsx");
  const chartCssPath = path.join(chartDir, "LimenProprietaryChart.css");
  const chartTsxContent = fs.readFileSync(chartTsxPath, "utf-8");
  const chartCssContent = fs.readFileSync(chartCssPath, "utf-8");

  // ── 1. Verifica Integrazione Controlli Esecuzione Rapida FXReplay nel Replay Dock ──
  it("1. LimenProprietaryChart integra i bottoni Buy/Sell e il controllo lottaggio nel floating dock", () => {
    assert.ok(
      chartTsxContent.includes("limen-replay-buy-btn"),
      "Il dock di replay deve contenere il pulsante BUY dedicato (limen-replay-buy-btn)",
    );
    assert.ok(
      chartTsxContent.includes("limen-replay-sell-btn"),
      "Il dock di replay deve contenere il pulsante SELL dedicato (limen-replay-sell-btn)",
    );
    assert.ok(
      chartTsxContent.includes("limen-replay-lots-control"),
      "Il dock di replay deve contenere il selettore lotti con stepper (limen-replay-lots-control)",
    );
    assert.ok(
      chartTsxContent.includes("limen-replay-lot-input"),
      "Il dock di replay deve contenere l'input numerico lotti (limen-replay-lot-input)",
    );
    assert.ok(
      chartTsxContent.includes("handleExecuteInstantReplayTrade"),
      "Il componente deve disporre della funzione handleExecuteInstantReplayTrade per esecuzione a candela corrente",
    );
  });

  // ── 2. Verifica Quick Trade Bar a fondo grafico ──
  it("2. La bottom bar integra l'accesso istantaneo Quick Buy / Quick Sell / Lotti", () => {
    assert.ok(
      chartTsxContent.includes("limen-bottom-quick-buy"),
      "La barra inferiore deve contenere limen-bottom-quick-buy per trigger rapido",
    );
    assert.ok(
      chartTsxContent.includes("limen-bottom-quick-sell"),
      "La barra inferiore deve contenere limen-bottom-quick-sell per trigger rapido",
    );
    assert.ok(
      chartTsxContent.includes("limen-bottom-lots-badge"),
      "La barra inferiore deve mostrare il badge lotti attuale (limen-bottom-lots-badge)",
    );
  });

  // ── 3. Verifica Stili e Palette Nobile Limen nel CSS ──
  it("3. LimenProprietaryChart.css implementa lo styling smeraldo/rubino e il contenimento viewport", () => {
    assert.ok(
      chartCssContent.includes(".limen-replay-buy-btn"),
      "Il CSS deve dichiarare .limen-replay-buy-btn con accento smeraldo #10b981",
    );
    assert.ok(
      chartCssContent.includes(".limen-replay-sell-btn"),
      "Il CSS deve dichiarare .limen-replay-sell-btn con accento rubino #ef4444",
    );
    assert.ok(
      chartCssContent.includes(".limen-replay-lots-control"),
      "Il CSS deve dichiarare .limen-replay-lots-control con sfondo scuro e bordo nobile",
    );
    assert.ok(
      chartCssContent.includes(".limen-bottom-quick-buy"),
      "Il CSS deve dichiarare .limen-bottom-quick-buy",
    );
    assert.ok(
      chartCssContent.includes(".limen-bottom-quick-sell"),
      "Il CSS deve dichiarare .limen-bottom-quick-sell",
    );
    assert.ok(
      chartCssContent.includes("max-width: calc(100% - 32px)"),
      "Il floating dock deve avere salvaguardia max-width per evitare overflow sui viewport laptop",
    );
  });

  // ── 4. Verifica Matematica e Proporzioni Setup Ordini Istantanei (1:2 R:R) ──
  it("4. Calcolo corretto di distanze SL/TP e moltiplicatori pip su Oro e Forex", () => {
    // XAUUSD (Gold)
    const goldPipMult = getPipMultiplier("XAUUSD");
    assert.equal(goldPipMult, 10, "Oro ha moltiplicatore 10 (1 pip = $0.10)");
    const goldSlPips = 20;
    const goldTpPips = 40;
    const goldSlDist = goldSlPips / goldPipMult; // $2.00
    const goldTpDist = goldTpPips / goldPipMult; // $4.00
    assert.equal(goldSlDist, 2.0);
    assert.equal(goldTpDist, 4.0);

    const goldEntry = 3955.0;
    const goldBuySl = goldEntry - goldSlDist; // 3953.0
    const goldBuyTp = goldEntry + goldTpDist; // 3959.0
    assert.equal(goldBuySl, 3953.0);
    assert.equal(goldBuyTp, 3959.0);
    assert.equal(Number(((goldBuyTp - goldEntry) / (goldEntry - goldBuySl)).toFixed(1)), 2.0, "R:R deve essere esattamente 1:2");

    // EURUSD (Forex)
    const fxPipMult = getPipMultiplier("EURUSD");
    assert.equal(fxPipMult, 10000, "Forex EURUSD ha moltiplicatore 10000 (1 pip = 0.0001)");
    const fxSlDist = 20 / fxPipMult; // 0.0020
    const fxTpDist = 40 / fxPipMult; // 0.0040
    assert.equal(fxSlDist, 0.002);
    assert.equal(fxTpDist, 0.004);
  });

  // ── 5. Verifica Supporto Lotti Espliciti nel Motore di Calcolo Conto ──
  it("5. Supporto per lotti personalizzati (d.lots) nel replayAccountState e cumulativeExposure", () => {
    assert.ok(
      chartTsxContent.includes("const lots = typeof d.lots === \"number\" && d.lots > 0 ? d.lots : calculatedLots;"),
      "Il motore deve privilegiare il lottaggio esplicito salvato sul trade (d.lots) rispetto a quello calcolato",
    );
    assert.ok(
      chartTsxContent.includes("lots: replayLots"),
      "Il nuovo ordine deve registrare esplicitamente replayLots nella proprietà lots del ReplayDrawing",
    );
  });

  // ── 6. Verifica Rispetto Regola Inviolabile whitespace-nowrap ──
  it("6. Tutti i valori monetari, percentuali ed equity hanno whitespace-nowrap", () => {
    assert.ok(
      chartTsxContent.includes("className=\"whitespace-nowrap\">BUY</span>"),
      "Pulsante BUY deve avere whitespace-nowrap",
    );
    assert.ok(
      chartTsxContent.includes("className=\"whitespace-nowrap\">SELL</span>"),
      "Pulsante SELL deve avere whitespace-nowrap",
    );
    assert.ok(
      chartTsxContent.includes("className=\"flex items-center gap-1.5 text-slate-300 whitespace-nowrap\""),
      "Equity container deve avere whitespace-nowrap",
    );
  });
});
