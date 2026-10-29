import assert from "node:assert/strict";
import {
  TOP_5_PROP_FIRMS,
  TOP_5_BROKERS,
  calculatePropFunnelSimulation,
  calculateHybridLimenAllocation,
  calculatePropFirmCompatibility,
  calculateBrokerMonthlyFrictionEuro,
} from "./propFirmAndBrokers.js";

// 1. Verifica Integrità Top 5 Prop Firm, Regole e Recensioni
assert.equal(TOP_5_PROP_FIRMS.length, 5, "Devono esserci esattamente 5 Prop Firm d'elite");
const propIds = TOP_5_PROP_FIRMS.map((p) => p.id);
assert.ok(propIds.includes("ftmo"), "FTMO deve essere presente");
assert.ok(propIds.includes("the5ers"), "The5ers deve essere presente");
assert.ok(propIds.includes("fundednext"), "FundedNext deve essere presente");
assert.ok(propIds.includes("alphacapital"), "Alpha Capital Group deve essere presente");
assert.ok(propIds.includes("fundingpips"), "Funding Pips deve essere presente");

for (const p of TOP_5_PROP_FIRMS) {
  assert.ok(p.trustpilotScore >= 4.5, `${p.name} deve avere Trustpilot >= 4.5`);
  assert.ok(p.tiers.length >= 3, `${p.name} deve avere almeno 3 scaglioni di conto`);
  assert.ok(p.platforms.length > 0, `${p.name} deve specificare le piattaforme`);
  
  // Regole Operative Dettagliate
  assert.ok(typeof p.rules.minTradingDays === "number", `${p.name} deve avere minTradingDays`);
  assert.ok(typeof p.rules.weekendHolding.allowed === "boolean", `${p.name} weekendHolding`);
  assert.ok(typeof p.rules.newsTrading.allowed === "boolean", `${p.name} newsTrading`);
  assert.ok(typeof p.rules.eaAndAlgos.allowed === "boolean", `${p.name} eaAndAlgos`);
  assert.ok(p.rules.drawdownRule.explanation.length > 0, `${p.name} drawdown explanation`);
  
  // Analisi Recensioni della Community
  assert.ok(p.reviews.positiveReviewsPct > 80, `${p.name} recensioni positive > 80%`);
  assert.ok(p.reviews.topPraises.length >= 2, `${p.name} deve elencare i punti lodati dagli utenti`);
  assert.ok(p.reviews.topComplaints.length >= 2, `${p.name} deve elencare le lamentele reali degli utenti`);
  assert.ok(p.reviews.averagePayoutTimeHours > 0, `${p.name} tempo medio payout valido`);
}

// 2. Verifica I Migliori Broker: FP Markets, XM, Tickmill
assert.equal(TOP_5_BROKERS.length, 5, "Devono esserci esattamente 5 Broker Sovrani");
const brokerIds = TOP_5_BROKERS.map((b) => b.id);
assert.ok(brokerIds.includes("fpmarkets"), "FP Markets (FP Trading) deve essere presente");
assert.ok(brokerIds.includes("xm"), "XM Group (XM.com) deve essere presente");
assert.ok(brokerIds.includes("tickmill"), "Tickmill deve essere presente");
assert.ok(brokerIds.includes("icmarkets"), "IC Markets deve essere presente");
assert.ok(brokerIds.includes("ibkr"), "Interactive Brokers deve essere presente");

const fp = TOP_5_BROKERS.find((b) => b.id === "fpmarkets");
assert.ok(fp, "FP Markets deve essere configurato");
assert.equal(fp?.friction.eurUsdSpreadPips, 0.0);
assert.equal(fp?.friction.commissionRoundTurnEuroPerLot, 5.5);

const xm = TOP_5_BROKERS.find((b) => b.id === "xm");
assert.ok(xm, "XM deve essere configurato");
assert.equal(xm?.friction.commissionRoundTurnEuroPerLot, 0.0, "XM Ultra Low ha zero commissioni");

const tickmill = TOP_5_BROKERS.find((b) => b.id === "tickmill");
assert.ok(tickmill, "Tickmill deve essere configurato");
assert.equal(tickmill?.friction.commissionRoundTurnEuroPerLot, 3.6, "Tickmill ha le commissioni record di $4 RT");

// 3. Verifica Calcolatore Attrito Broker
const frictionFp = calculateBrokerMonthlyFrictionEuro(fp!, 20);
assert.equal(frictionFp.spreadCostEuro, 0); // 0.0 pip
assert.equal(frictionFp.commissionCostEuro, 110); // 5.5 € * 20
assert.ok(frictionFp.savingsVsBenchmarkEuro > 0, "FP Markets deve generare risparmio rispetto al retail 1.2 pip");

const frictionXm = calculateBrokerMonthlyFrictionEuro(xm!, 20);
assert.equal(frictionXm.commissionCostEuro, 0); // zero commissioni
assert.equal(frictionXm.spreadCostEuro, 110); // 0.6 pip * 9.20 * 20 = ~110 €

const frictionTickmill = calculateBrokerMonthlyFrictionEuro(tickmill!, 20);
assert.equal(frictionTickmill.commissionCostEuro, 72); // 3.6 € * 20 = 72 €
assert.equal(frictionTickmill.totalCostEuro, 72); // Il costo più basso

// 4. Verifica Motore di Valutazione Diretta Compatibilità (User Preferences vs Prop)
const ftmo = TOP_5_PROP_FIRMS.find((p) => p.id === "ftmo")!;
const userNewsTrader = calculatePropFirmCompatibility(ftmo, {
  tradesNews: true,
  holdsOverWeekend: true,
  usesEaOrBot: false,
  prefersZeroMinDays: false,
  preferredPlatform: "cTrader",
  maxFeeBudgetEuro: 600,
});
assert.ok(userNewsTrader.cautions.length >= 2, "FTMO deve avvisare sulle restrizioni 2 min news e weekend per chi non usa il conto Swing");

const the5ers = TOP_5_PROP_FIRMS.find((p) => p.id === "the5ers")!;
const userSwing = calculatePropFirmCompatibility(the5ers, {
  tradesNews: true,
  holdsOverWeekend: true,
  usesEaOrBot: false,
  prefersZeroMinDays: true,
  preferredPlatform: "MT5",
  maxFeeBudgetEuro: 600,
});
assert.equal(userSwing.verdict, "COMPATIBILITÀ PERFETTA", "The5ers è perfetto per chi fa news, weekend e vuole zero min days");

// 5. Verifica Funnel e Asimmetria
const sim = calculatePropFunnelSimulation({
  accountSizeEuro: 100000,
  challengeFeeEuro: 540,
  winRatePct: 54,
  riskRewardRatio: 1.85,
  riskPerTradePct: 0.5,
  expectedMonthlyReturnPct: 3.0,
  payoutSplitPct: 80,
  feeRefundPct: 100,
});
assert.equal(sim.monthlyNetPayoutEuro, 2400);
assert.equal(sim.firstPayoutWithRefundEuro, 2940);
assert.ok(sim.initialCapitalRoiMultiplier > 140);

console.log("✓ Test contracts/propFirmAndBrokers completati con successo (FP Markets, XM, Tickmill & Motore Compatibilità).");
