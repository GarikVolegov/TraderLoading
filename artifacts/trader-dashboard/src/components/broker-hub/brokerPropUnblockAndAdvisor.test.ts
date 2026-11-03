import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BROKER_SERVERS, suggestServers } from "./brokerServers.js";
import { RECOMMENDED_BROKERS, RECOMMENDED_PROPS } from "./RecommendedBrokersAndProps.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const brokerHubDir = __dirname;
const dashboardRoot = path.resolve(__dirname, "../../..");

describe("AUREUS Sblocco Conto, Broker & Prop Advisor (Il Varco & Il Libro della Verità)", () => {
  // ── 1. Verifica Sblocco Collegamento in Broker.tsx e BrokerHubWidget.tsx ──
  it("1. Broker.tsx e BrokerHubWidget.tsx non bloccano l'accesso con ProUpgradeGate", () => {
    const brokerPageSrc = fs.readFileSync(path.join(dashboardRoot, "src/pages/Broker.tsx"), "utf8");
    assert.doesNotMatch(
      brokerPageSrc,
      /<ProUpgradeGate feature="broker"/,
      "BrokerWorkspace deve essere sbloccato per tutti gli operatori (nessun ProUpgradeGate bloccante)",
    );

    const brokerWidgetSrc = fs.readFileSync(path.join(brokerHubDir, "BrokerHubWidget.tsx"), "utf8");
    assert.doesNotMatch(
      brokerWidgetSrc,
      /Passa a Pro/,
      "BrokerHubWidget deve mostrare il connettore e lo stato senza blocco 'Passa a Pro'",
    );
  });

  // ── 2. Verifica Broker e Prop Firm Consigliati da AUREUS ──
  it("2. RecommendedBrokersAndProps include i migliori Broker ECN e le migliori Prop Firm", () => {
    const brokerNames = RECOMMENDED_BROKERS.map((b) => b.name);
    assert.ok(brokerNames.includes("IC Markets"), "Deve raccomandare IC Markets (Raw Spread)");
    assert.ok(brokerNames.includes("Pepperstone"), "Deve raccomandare Pepperstone (Razor ECN)");
    assert.ok(brokerNames.includes("FP Markets"), "Deve raccomandare FP Markets (ECN NY4)");

    const propNames = RECOMMENDED_PROPS.map((p) => p.name);
    assert.ok(propNames.includes("FTMO"), "Deve raccomandare FTMO (Drawdown statico 10%)");
    assert.ok(propNames.includes("The 5%ers"), "Deve raccomandare The 5%ers (Scaling fino a $4M)");
    assert.ok(propNames.includes("FundedNext"), "Deve raccomandare FundedNext (No time limits)");
    assert.ok(propNames.includes("Alpha Capital Group"), "Deve raccomandare Alpha Capital Group");

    // Verifica badge qualitativi e assenza di lore volgare o gambling
    for (const b of [...RECOMMENDED_BROKERS, ...RECOMMENDED_PROPS]) {
      assert.ok(b.badge.length > 0, `Il partner ${b.name} deve avere un badge qualitativo`);
      assert.ok(b.whyAureus.length > 0, `Il partner ${b.name} deve avere la spiegazione 'whyAureus'`);
      assert.doesNotMatch(b.whyAureus, /scommess|gioco d'azzardo|casinò|bonus gratis/i);
    }
  });

  // ── 3. Verifica Server Autocomplete per Prop Firm e Broker in brokerServers.ts ──
  it("3. brokerServers.ts include i server di FTMO, The 5%ers, FundedNext, Alpha Capital", () => {
    const ftmoServers = suggestServers("FTMO");
    assert.ok(ftmoServers.some((s) => s.includes("FTMO")), "Deve suggerire server FTMO");

    const fiveServers = suggestServers("5ers");
    assert.ok(fiveServers.some((s) => s.includes("The5ers")), "Deve suggerire server The 5%ers");

    const fundedNextServers = suggestServers("FundedNext");
    assert.ok(fundedNextServers.some((s) => s.includes("FundedNext")), "Deve suggerire server FundedNext");

    const acgServers = suggestServers("Alpha Capital");
    assert.ok(acgServers.some((s) => s.includes("AlphaCapital")), "Deve suggerire server Alpha Capital");
  });

  // ── 4. Verifica Integrazione nel Libro della Verità (Journal.tsx) ──
  it("4. Il Libro della Verità (Journal.tsx) integra i pulsanti per collegamento conto e broker consigliati", () => {
    const journalSrc = fs.readFileSync(path.join(dashboardRoot, "src/pages/Journal.tsx"), "utf8");
    assert.ok(
      journalSrc.includes("Collega Conto Broker &amp; Prop"),
      "Journal deve contenere il pulsante nobile 'Collega Conto Broker & Prop'",
    );
    assert.ok(
      journalSrc.includes("Broker &amp; Prop Consigliati"),
      "Journal deve contenere l'accesso rapido a 'Broker & Prop Consigliati'",
    );
    assert.ok(
      journalSrc.includes("<BrokerWorkspace"),
      "Journal deve renderizzare BrokerWorkspace quando aperto il pannello conti",
    );
  });

  // ── 5. Verifica Integrazione nel Varco (TradingCockpit.tsx) ──
  it("5. Il Varco (TradingCockpit.tsx) integra la CockpitPropGuardianBar e la dialog broker_hub", () => {
    const cockpitSrc = fs.readFileSync(path.join(dashboardRoot, "src/pages/TradingCockpit.tsx"), "utf8");
    assert.ok(
      cockpitSrc.includes("<CockpitPropGuardianBar"),
      "TradingCockpit deve renderizzare CockpitPropGuardianBar sopra il grafico",
    );
    assert.ok(
      cockpitSrc.includes('dialog === "broker_hub"'),
      "TradingCockpit deve gestire l'apertura del dialog broker_hub",
    );
    assert.ok(
      cockpitSrc.includes("<BrokerHubWorkspace"),
      "TradingCockpit deve montare BrokerHubWorkspace nel dialog",
    );
    assert.ok(
      cockpitSrc.includes("useBrokerHub"),
      "TradingCockpit deve integrare l'hook useBrokerHub per telemetria conto",
    );
    assert.ok(
      cockpitSrc.includes("Esporta Setup per MT5 / cTrader"),
      "TradingCockpit deve includere il pulsante per esportare il setup su MT5/cTrader",
    );
  });

  // ── 6. Verifica Hotkeys ed Ergonomia Scrubber Replay ──
  it("6. LimenProprietaryChart integra gli shortcut Shift+B, Shift+S e la Scrubber Bar", () => {
    const chartSrc = fs.readFileSync(path.join(dashboardRoot, "src/components/chart/LimenProprietaryChart.tsx"), "utf8");
    assert.ok(
      chartSrc.includes('handleExecuteInstantReplayTrade("buy")'),
      "Deve eseguire Quick Buy su Shift+B",
    );
    assert.ok(
      chartSrc.includes('handleExecuteInstantReplayTrade("sell")'),
      "Deve eseguire Quick Sell su Shift+S",
    );
    assert.ok(
      chartSrc.includes("Timeline Scrubber Bar"),
      "Deve includere la timeline scrubber bar per navigare le candele storiche",
    );
  });

  // ── 7. Verifica Modal Registrazione Trade & Esportazione Ordine MT5 / cTrader ──
  it("7. CockpitTradeRegisterModal integra la copia rapida setup MT5 / cTrader", () => {
    const modalSrc = fs.readFileSync(path.join(dashboardRoot, "src/components/cockpit/CockpitTradeRegisterModal.tsx"), "utf8");
    assert.ok(
      modalSrc.includes("Copia Parametri MT5 / cTrader"),
      "CockpitTradeRegisterModal deve avere il pulsante Copia Parametri MT5 / cTrader",
    );
    assert.ok(
      modalSrc.includes("copySetupToClipboard"),
      "CockpitTradeRegisterModal deve richiamare la funzione copySetupToClipboard",
    );
  });

  // ── 8. Verifica SimpleBrokerConnectWizard (Collegamento Semplice e Intuitivo) ──
  it("8. ConnectAccountWizard integra SimpleBrokerConnectWizard con preselezione e Prova 100k", () => {
    const wizardSrc = fs.readFileSync(path.join(dashboardRoot, "src/components/broker-hub/ConnectAccountWizard.tsx"), "utf8");
    assert.ok(
      wizardSrc.includes("<SimpleBrokerConnectWizard"),
      "ConnectAccountWizard deve montare SimpleBrokerConnectWizard",
    );

    const simpleSrc = fs.readFileSync(path.join(dashboardRoot, "src/components/broker-hub/SimpleBrokerConnectWizard.tsx"), "utf8");
    assert.ok(
      simpleSrc.includes("Prova Istantanea 100k Demo"),
      "SimpleBrokerConnectWizard deve offrire la prova rapida 1-click 100k",
    );
    assert.ok(
      simpleSrc.includes("Password Investor / Sola Lettura"),
      "SimpleBrokerConnectWizard deve includere il campo protetto per password investor",
    );
  });

  // ── 9. Verifica Profit Target Meter & Switcher Fase Challenge in CockpitPropGuardianBar ──
  it("9. CockpitPropGuardianBar integra il monitoraggio del Profit Target e switcher Fase 1/2", () => {
    const barSrc = fs.readFileSync(path.join(dashboardRoot, "src/components/cockpit/CockpitPropGuardianBar.tsx"), "utf8");
    assert.ok(
      barSrc.includes("Target F"),
      "CockpitPropGuardianBar deve visualizzare il target della challenge",
    );
    assert.ok(
      barSrc.includes("profitProgressPct"),
      "CockpitPropGuardianBar deve visualizzare la percentuale di avanzamento del target",
    );
    assert.ok(
      barSrc.includes("Fase"),
      "CockpitPropGuardianBar deve permettere lo switch tra Fase 1 e Fase 2",
    );
  });

  // ── 10. Verifica 1-Tap Prop Risk Preset Sizing nel Grafico ──
  it("10. LimenProprietaryChart integra i preset di rischio rapido 0.25%, 0.5% e 1% nel Replay Dock", () => {
    const chartSrc = fs.readFileSync(path.join(dashboardRoot, "src/components/chart/LimenProprietaryChart.tsx"), "utf8");
    assert.ok(
      chartSrc.includes("1-Tap Prop Risk Preset Sizing"),
      "LimenProprietaryChart deve includere i bottoni di rischio 1-tap",
    );
    assert.ok(
      chartSrc.includes("computeLots"),
      "LimenProprietaryChart deve calcolare i lotti in base al rischio selezionato",
    );
  });
});
