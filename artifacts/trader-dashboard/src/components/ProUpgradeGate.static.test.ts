import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ProUpgradeGate.tsx", import.meta.url), "utf8");

assert.match(source, /export type ProFeature = "backtest" \| "leaderboard" \| "broker" \| "wiki"/);
assert.match(source, /billing\.price_month/);
assert.match(source, /billing\.feature\.backtesting/);
assert.match(source, /billing\.feature\.leaderboards/);
assert.match(source, /billing\.feature\.account_sync/);
assert.match(source, /billing\.gate\.wiki\.title/);
assert.match(source, /useBillingStatus/);
assert.doesNotMatch(source, /queryFn:\s*\(\)\s*=>\s*fetchBillingStatus\(\)/);
// Modalità overlay: contenuto visibile ma sfocato e non interattivo, paywall sopra.
assert.match(source, /inert/);
assert.match(source, /pointer-events-none/);
assert.match(source, /blur-\[3px\]/);
// Il flusso Stripe Embedded Checkout vive in ProCheckoutDialog (vedi il suo static test).
assert.match(source, /ProCheckoutDialog/);
assert.match(source, /href="\/pro"/);
// Ogni vantaggio Pro ha la sua icona (non un'icona generica ripetuta).
assert.match(source, /FlaskConical/);
assert.match(source, /Trophy/);
assert.match(source, /Link2/);
assert.doesNotMatch(source, /\bSparkles\b/);
// L'overlay del paywall scrolla: la CTA non viene mai tagliata in contenitori ad altezza fissa.
assert.match(source, /overflow-y-auto/);
assert.doesNotMatch(source, /sticky top-24/);
// fillViewport: nelle pagine a tutta altezza (PageLayout) il parent ha altezza
// auto, quindi h-full collassa e il gate resterebbe a ~420px lasciando un buco
// fino alla barra. Con fillViewport il gate riempie l'area di contenuto del
// PageLayout via il token di clearance condiviso (niente buco, niente overlap).
assert.match(source, /fillViewport/);
assert.match(source, /calc\(100dvh - 3\.85rem - var\(--bottom-nav-clearance\)\)/);

console.log("pro upgrade gate static checks passed");
