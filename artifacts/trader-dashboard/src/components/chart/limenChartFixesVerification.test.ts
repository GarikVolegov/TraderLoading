import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dashboardRoot = path.resolve(__dirname, "../../..");

console.log("=== VERIFICA RIGOROSA RIPARAZIONI GRAFICO & TOOLRAIL LIMEN ===");

// 1. Verifica chart-workspace.css per ToolRail e Tooltip
const cssPath = path.join(dashboardRoot, "src/components/backtest-terminal/chart-workspace.css");
const cssContent = fs.readFileSync(cssPath, "utf-8");

assert.ok(cssContent.includes(".btm-rail {"), "btm-rail deve essere definito in chart-workspace.css");
assert.ok(cssContent.includes("width: 44px"), "btm-rail deve avere width fissa di 44px");
assert.ok(cssContent.includes("min-width: 44px"), "btm-rail deve avere min-width di 44px");
assert.ok(cssContent.includes("max-width: 44px"), "btm-rail deve avere max-width di 44px");
assert.ok(cssContent.includes(".btm-tooltooltip {"), "btm-tooltooltip deve essere definito in chart-workspace.css");
assert.ok(cssContent.includes("display: none !important"), "btm-tooltooltip deve avere display: none !important di default");
assert.ok(cssContent.includes(".btm-toolbtn:is(:hover, :focus-visible) .btm-tooltooltip"), "btm-tooltooltip deve aprirsi solo su hover/focus");
console.log("✓ 1. chart-workspace.css: .btm-rail (44px) e .btm-tooltooltip (display: none !important) convalidati con successo.");

// 2. Verifica ToolRail.tsx: nessun bottone annidato dentro un altro bottone
const railPath = path.join(dashboardRoot, "src/components/backtest-terminal/ToolRail.tsx");
const railContent = fs.readFileSync(railPath, "utf-8");

// Verifichiamo con tokenizer che depth dei tag <button> non superi mai 1
const buttonTags = railContent.match(/<\/?button\b[^>]*>/g) || [];
let buttonDepth = 0;
let maxButtonDepth = 0;
for (const tag of buttonTags) {
  if (tag.startsWith("</button")) {
    buttonDepth = Math.max(0, buttonDepth - 1);
  } else if (!tag.endsWith("/>")) {
    buttonDepth++;
    if (buttonDepth > maxButtonDepth) {
      maxButtonDepth = buttonDepth;
    }
  }
}
assert.equal(maxButtonDepth, 1, `ToolRail non deve avere bottoni annidati dentro altri bottoni (maxDepth trovata: ${maxButtonDepth})`);
assert.ok(railContent.includes("btm-rail-cat-arrow"), "ToolRail deve includere la freccia di espansione per categorie");
console.log("✓ 2. ToolRail.tsx: Struttura DOM pulita (nessun <button> illegale annidato).");

// 3. Verifica LimenProprietaryChart.tsx: Sincronizzazione dati e pulizia simbolo
const chartPath = path.join(dashboardRoot, "src/components/chart/LimenProprietaryChart.tsx");
const chartContent = fs.readFileSync(chartPath, "utf-8");

assert.ok(chartContent.includes("setChartInstance"), "LimenProprietaryChart deve tracciare chartInstance per forzare sync al rimontaggio del canvas");
assert.ok(chartContent.includes("useEffect(() => {"), "LimenProprietaryChart deve avere effect di sincronizzazione dati");
assert.ok(chartContent.includes("priceSeriesRef.current.setData("), "priceSeriesRef deve ricevere setData reattivamente");
assert.ok(chartContent.includes("[candles, chartType, chartInstance]"), "La serie deve aggiornarsi ogni volta che candles, chartType o chartInstance cambiano");
assert.ok(chartContent.includes("symbol.includes(\":\") ? symbol.split(\":\").pop()! : symbol"), "Il simbolo deve essere pulito da prefissi broker (es. OANDA:)");
console.log("✓ 3. LimenProprietaryChart.tsx: Sincronizzazione automatica candele & pulizia ticker broker convalidate.");

// 4. Verifica LimenChartHeader.tsx: Rimozione duplicato XAU/USD, filtro preferiti & Consigliati Lungo Termine dopo Preferiti
const headerPath = path.join(dashboardRoot, "src/components/chart/LimenChartHeader.tsx");
const headerContent = fs.readFileSync(headerPath, "utf-8");

assert.ok(headerContent.includes("favSymbols.filter"), "I preferiti devono filtrare il simbolo attivo");
assert.ok(headerContent.includes("symId !== cleanSym"), "Il simbolo attivo non deve essere duplicato accanto al dropdown primario");
assert.ok(headerContent.includes("symbol.includes(\":\") ? symbol.split(\":\").pop()! : symbol"), "LimenChartHeader deve ripulire i ticker broker");

const favSectionIdx = headerContent.indexOf("I Tuoi Preferiti");
const recSectionIdx = headerContent.indexOf("Consigliati · Lungo Termine");
const catSectionIdx = headerContent.indexOf("filteredSymbolGroups.map");
assert.ok(favSectionIdx > 0, "LimenChartHeader deve mostrare la sezione 'I Tuoi Preferiti' nella ricerca pair");
assert.ok(recSectionIdx > favSectionIdx, "La sezione 'Consigliati · Lungo Termine' deve apparire immediatamente dopo 'I Tuoi Preferiti'");
assert.ok(catSectionIdx > recSectionIdx, "Il catalogo categorie deve apparire dopo la sezione 'Consigliati · Lungo Termine'");
console.log("✓ 4. LimenChartHeader.tsx: Sezione Preferiti -> Consigliati a Lungo Termine -> Categorie e layout validati.");

// 5. Verifica FavoriteToolsBar.tsx: Posizione di default discreta in basso a sinistra
const favBarPath = path.join(dashboardRoot, "src/components/backtest-terminal/FavoriteToolsBar.tsx");
const favBarContent = fs.readFileSync(favBarPath, "utf-8");

assert.ok(favBarContent.includes("targetX = 55"), "La barra preferiti non deve galleggiare al centro del canvas ma posizionarsi in basso a sinistra (x: 55)");
assert.ok(favBarContent.includes("targetY = Math.max(60, parentH - 75)"), "La barra preferiti deve agganciarsi sopra l'asse temporale senza coprire le candele");
console.log("✓ 5. FavoriteToolsBar.tsx: Posizionamento discreto (x: 55, y: parentH - 75) convalidato.");

console.log("\n==================================================================");
console.log("TUTTI I 5 CONTROLLI DI QUALITÀ E RIGORE LIMEN SONO STATI SUPERATI!");
console.log("==================================================================");
