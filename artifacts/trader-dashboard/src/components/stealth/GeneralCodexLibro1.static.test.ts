import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./GeneralCodexLibro1.tsx", import.meta.url), "utf8");

// 1. Verify Title & Subtitle
assert.match(source, /LIBRO I: LA RICOGNIZIONE E LA MAPPATURA/, "Title missing");
assert.match(source, /3 Leggi di Wyckoff/, "Wyckoff laws description missing");
assert.match(source, /cartografia della liquidità/, "Cartography description missing");

// 2. Verify Archetypes and Quote
assert.match(source, /Sun Tzu & Scipione l(&apos;|')Africano/, "Archetype attribution missing");
assert.match(source, /Il terreno detta la strategia/, "Condottiero quote missing");
assert.match(source, /Dottrina di Zama e dell(&apos;|')Arte della Guerra/, "Historical doctrine citation missing");

// 3. Verify the 3 Wyckoff Pillars
assert.match(source, /Domanda e dell(&apos;|')Offerta/, "Pillar 1 missing");
assert.match(source, /Causa e dell(&apos;|')Effetto/, "Pillar 2 missing");
assert.match(source, /Sforzo vs Risultato/, "Pillar 3 missing");
assert.match(source, /Lex Postulandi et Praebendi/, "Latin name 1 missing");
assert.match(source, /Lex Causae et Effectus/, "Latin name 2 missing");
assert.match(source, /Lex Conatus et Eventus/, "Latin name 3 missing");

// 4. Verify Practical Operational Orders
assert.match(source, /Ispezione Confini Daily \/ H4/, "Step 1 missing");
assert.match(source, /Individuazione Liquidità Pulita/, "Step 2 missing");
assert.match(source, /Mappatura delle Inefficienze/, "Step 3 missing");
assert.match(source, /Dichiarazione del Bias & Livello Morto/, "Step 4 missing");

// 5. Verify Strategic Wyckoff SVG Map
assert.match(source, /function StrategicMapWyckoffIllustration/, "Wyckoff SVG map component missing");
assert.match(source, /ACCUMULAZIONE WYCKOFF/, "Accumulation phase annotation missing");
assert.match(source, /DISTRIBUZIONE WYCKOFF/, "Distribution phase annotation missing");
assert.match(source, /SPRING \(TRAP\)/, "Spring pin missing");
assert.match(source, /UTAD \/\/ SWEEP BSL/, "UTAD pin missing");

// 6. Verify Direct Academy CTA
assert.match(source, /Accedi ai Video di Ricognizione HTF/, "Academy CTA button missing");

// 7. Verify Tier & Gatekeeping Integration
assert.match(source, /GatekeepingModal/, "GatekeepingModal integration missing");
assert.match(source, /userTier === "member"/, "Member tier check missing");

console.log("GeneralCodexLibro1 static checks passed successfully");
