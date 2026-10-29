import assert from "node:assert/strict";
import { DEFAULT_FIB_LEVELS } from "../../lib/replay/drawingWorkspace";
import { SMC_PRESETS, DRAWING_TOOLS, DRAWING_TOOL_CATEGORIES } from "../backtest-terminal/toolRailModel";
import { isDrawingVisibleOnInterval } from "../../lib/replay/drawingWorkspace";
import type { ReplayDrawing } from "../../lib/replay/types";

console.log("1. Verifica Livelli Istituzionali Fibonacci (AUREUS Golden Ratio & OTE)...");
const oteLevel = DEFAULT_FIB_LEVELS.find((f) => f.level === 0.705);
assert.ok(oteLevel, "Il livello 0.705 (OTE) deve essere presente");
assert.equal(oteLevel.enabled, true, "Il livello 0.705 (OTE) deve essere attivo di default");
assert.equal(oteLevel.color, "#C5A059", "Il colore dell'OTE deve essere Oro Aureo (#C5A059)");

const goldenRatio = DEFAULT_FIB_LEVELS.find((f) => f.level === 0.618);
assert.ok(goldenRatio, "Il Golden Ratio 0.618 deve essere presente");
assert.equal(goldenRatio.enabled, true, "Il Golden Ratio 0.618 deve essere attivo");
assert.equal(goldenRatio.color, "#E8C56A", "Il colore del Golden Ratio deve essere Oro Chiaro (#E8C56A)");

const equilibrium = DEFAULT_FIB_LEVELS.find((f) => f.level === 0.5);
assert.ok(equilibrium, "Il livello 0.5 (EQ) deve essere presente");
assert.equal(equilibrium.enabled, true, "Il livello 0.5 (EQ) deve essere attivo");
assert.equal(equilibrium.color, "#10b981", "Il colore di Equilibrium deve essere Smeraldo (#10b981)");

const extMinus27 = DEFAULT_FIB_LEVELS.find((f) => f.level === -0.27);
assert.ok(extMinus27, "L'estensione target -0.27 deve essere presente nel catalogo");

console.log("2. Verifica Preset Smart Money (SMC Institutional Presets)...");
assert.equal(SMC_PRESETS.length, 4, "Devono essere definiti esattamente 4 preset SMC istituzionali");
const fvgBull = SMC_PRESETS.find((p) => p.id === "fvg_bull");
assert.ok(fvgBull, "Preset FVG Bullish deve esistere");
assert.equal(fvgBull.color, "#10b981");

const fvgBear = SMC_PRESETS.find((p) => p.id === "fvg_bear");
assert.ok(fvgBear, "Preset FVG Bearish deve esistere");
assert.equal(fvgBear.color, "#ef4444");

const orderBlock = SMC_PRESETS.find((p) => p.id === "order_block");
assert.ok(orderBlock, "Preset Order Block deve esistere");
assert.equal(orderBlock.color, "#C5A059");

const liquidity = SMC_PRESETS.find((p) => p.id === "liquidity_pool");
assert.ok(liquidity, "Preset Liquidity Pool deve esistere");
assert.equal(liquidity.color, "#38bdf8");

console.log("3. Verifica Copertura Categorie Armeria Geometrica...");
assert.equal(DRAWING_TOOL_CATEGORIES.length, 6, "Devono esserci 6 categorie ufficiali stile TradingView Pro");
const allToolIds = DRAWING_TOOLS.map((t) => t.id);
assert.ok(allToolIds.includes("trend"));
assert.ok(allToolIds.includes("rect"));
assert.ok(allToolIds.includes("fib"));
assert.ok(allToolIds.includes("longPosition"));
assert.ok(allToolIds.includes("shortPosition"));
assert.ok(allToolIds.includes("ruler"));
assert.ok(allToolIds.includes("frvp"));
assert.ok(allToolIds.includes("avwap"));

console.log("4. Verifica Multi-Timeframe Visibility Filters...");
const sampleDrawing: ReplayDrawing = {
  id: "drw-test-mtf",
  kind: "rect",
  a: { time: 1700000000, price: 2000 },
  b: { time: 1700003600, price: 2010 },
  visibility: {
    ticks: true,
    seconds: { enabled: true, min: 1, max: 59 },
    minutes: { enabled: true, min: 1, max: 60 },
    hours: { enabled: true, min: 1, max: 4 },
    days: { enabled: false, min: 1, max: 366 },
    weeks: { enabled: false, min: 1, max: 52 },
    months: { enabled: false, min: 1, max: 12 },
    ranges: true,
  },
};

// 15 minuti = 900s -> visibile
assert.equal(isDrawingVisibleOnInterval(sampleDrawing, 900), true);
// 1 ora = 3600s -> visibile
assert.equal(isDrawingVisibleOnInterval(sampleDrawing, 3600), true);
// 1 giorno = 86400s -> nascosto
assert.equal(isDrawingVisibleOnInterval(sampleDrawing, 86400), false);

console.log("5. Verifica Template Dottrinali AUREUS...");
const { DEFAULT_AUREUS_TEMPLATES } = await import("../../../../../contracts/backtestChart");
assert.equal(DEFAULT_AUREUS_TEMPLATES.length, 3, "Devono esistere esattamente 3 template AUREUS predefiniti");
assert.ok(DEFAULT_AUREUS_TEMPLATES.some((t) => t.id === "template-silver-bullet"));
assert.ok(DEFAULT_AUREUS_TEMPLATES.some((t) => t.id === "template-pure-price-action"));
assert.ok(DEFAULT_AUREUS_TEMPLATES.some((t) => t.id === "template-macro-trend"));

console.log("Tutti i test di reverse engineering TradingView AUREUS sono passati con successo!");
