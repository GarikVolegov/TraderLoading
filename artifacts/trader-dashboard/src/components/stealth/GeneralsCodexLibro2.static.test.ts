import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./GeneralsCodexLibro2.tsx", import.meta.url), "utf8");

// 1. Verify Title & Subtitle
assert.match(source, /LIBRO II: LA FALANGE E LE SCHEMATICHE DI ACCUMULAZIONE/, "Title missing");
assert.match(source, /La costruzione della fortezza difensiva prima del contrattacco/, "Subtitle description missing");
assert.match(source, /PS, SC, AR, ST, Spring, SOS, JTC/, "Key Wyckoff stages list missing");

// 2. Verify Archetypes and Quote
assert.match(source, /LEONIDA ALLE TERMOPILI & GIULIO CESARE AD ALESIA/, "Archetype attribution missing");
assert.match(source, /Il nemico si consuma attaccando le linee difensive/, "Condottiero quote part 1 missing");
assert.match(source, /Non si contrattacca finch(é|e) non si vede il cedimento\s+strutturale e la trappola tesa nella valle/, "Condottiero quote part 2 missing");
assert.match(source, /Dottrina delle Termopili e delle Fortificazioni di Alesia/, "Historical doctrine citation missing");

// 3. Verify the 3 Fortress Phases (Wyckoff Accumulation Zones)
assert.match(source, /L(&apos;|')Arresto e il Climax/, "Phase 1 title missing");
assert.match(source, /La Trappola della Valle/, "Phase 2 title missing");
assert.match(source, /Il Segnale di Forza e il Salto/, "Phase 3 title missing");
assert.match(source, /PS \(Preliminary Support\) & SC \(Selling Climax\)/, "Phase 1 acronyms missing");
assert.match(source, /Spring \/ ST\(b\)/, "Phase 2 acronyms missing");
assert.match(source, /SOS \(Sign of Strength\) & JTC \(Jump across The Creek\)/, "Phase 3 acronyms missing");
assert.match(source, /Obsessio Primaria et Climax Venditionis/, "Latin name 1 missing");
assert.match(source, /Insidiae Vallis et Purgatio Liquoris/, "Latin name 2 missing");
assert.match(source, /Signum Fortitudinis et Transitus Amnis/, "Latin name 3 missing");

// 4. Verify Practical Operational Actions (ITF)
assert.match(source, /ACT-01 \/\/ DELIMITAZIONE BOX/, "Action 1 code missing");
assert.match(source, /Tracciamento Perimetro della Fortezza/, "Action 1 title missing");
assert.match(source, /ACT-02 \/\/ VIGILANZA PASSIVA/, "Action 2 code missing");
assert.match(source, /Divieto di Anticipazione nella Terra di Mezzo/, "Action 2 title missing");
assert.match(source, /ACT-03 \/\/ FILTRO DELLO SPRING/, "Action 3 code missing");
assert.match(source, /Attesa della Presa di Liquidità sui Minimi/, "Action 3 title missing");
assert.match(source, /ACT-04 \/\/ CONVALIDA SOS & JTC/, "Action 4 code missing");
assert.match(source, /Esecuzione Esclusiva al Salto del Creek/, "Action 4 title missing");

// 5. Verify Strategic Wyckoff Accumulation SVG Box
assert.match(source, /function AccumulationBoxTacticalIllustration/, "Accumulation Box SVG component missing");
assert.match(source, /THE CREEK LINE \/\/ RESISTENZA AR/, "Creek Line annotation missing");
assert.match(source, /THE ICE LINE \/\/ SUPPORTO SC/, "Ice Line annotation missing");
assert.match(source, /SPRING \/ ST\(b\)/, "Spring / ST(b) pin missing");
assert.match(source, /JTC ▲ MARK UP/, "JTC Mark Up annotation missing");

// 6. Verify Direct Academy CTA
assert.match(source, /Accedi ai Video delle Schematiche ITF/, "Academy CTA button missing");

// 7. Verify Tier & Gatekeeping Integration
assert.match(source, /GatekeepingModal/, "GatekeepingModal integration missing");
assert.match(source, /userTier === "member"/, "Member tier check missing");

console.log("GeneralsCodexLibro2 static checks passed successfully");
