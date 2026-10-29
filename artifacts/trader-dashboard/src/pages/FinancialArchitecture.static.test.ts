import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rootDestination } from "../lib/navHubs";

const page = readFileSync(new URL("./FinancialArchitecture.tsx", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const bottomNav = readFileSync(new URL("../components/BottomNav.tsx", import.meta.url), "utf8");
const topNav = readFileSync(new URL("../components/TopNav.tsx", import.meta.url), "utf8");

// Route + Navigation Wiring
assert.match(app, /const FinancialArchitecture = lazy\(\(\) => import\("\.\/pages\/FinancialArchitecture"\)\)/);
assert.match(app, /<Route path="\/patrimonio" component=\{FinancialArchitecture\} \/>/);
assert.equal(rootDestination("/patrimonio"), "resources");
assert.match(bottomNav, /id:\s*"patrimonio"/);
assert.match(bottomNav, /href:\s*"\/patrimonio"/);
assert.match(topNav, /href="\/patrimonio"/);
assert.match(topNav, /financialProfile\?\.isCompleted \? "Patrimonio: Attivo" : "Patrimonio: Setup"/);

// 3-Step Layout & Philosophical Rules
assert.match(page, /STEP 1: FOTOGRAFIA FINANZIARIA/i);
assert.match(page, /STEP 2: CONFIGURAZIONE STRATEGICA/i);
assert.match(page, /STEP 3: STRESS TEST & VALIDAZIONE FINALE/i);

// 5 Pillars, Donut Chart & Monte Carlo Simulation
assert.match(page, /PillarsDonutChart/);
assert.match(page, /MonteCarloSimulationCard/);
assert.match(page, /PillarsAllocationBar/);
assert.match(page, /Calcola Allocazione Ottimale (AUREUS|LIMEN)/);

// Hard Rule: 1:1 Reserve vs Trading Constraint & Indicator
assert.match(page, /reserveConstraint\.isValid/);
assert.match(page, /VINCOLO 1:1 RISPETTATO/);
assert.match(page, /VIOLAZIONE REGOLA DI RISERVA/);

// 4 Strategic Questions & Risk Thermometer
assert.match(page, /CRESCITA \(COMPOUNDING\)/);
assert.match(page, /RENDITA \(CASHFLOW\)/);
assert.match(page, /Termometro del Rischio/);

// Stress Test & Psychological Pressure
assert.match(page, /Simulazione Drawdown/);
assert.match(page, /Profilo Mario vs Profilo Luigi/);
assert.match(page, /Salva e Attiva Protocollo Patrimoniale/);

console.log("financial architecture static checks passed");
