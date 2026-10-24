import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./GeneralsCodex.tsx", import.meta.url), "utf8");

// 1. Verify 3 Chapters with correct Archetypes and Timeframes
assert.match(source, /La Ricognizione/, "Chapter 1 title missing");
assert.match(source, /Sun Tzu/, "Archetype Sun Tzu missing");
assert.match(source, /Mappatura & Cartografia HTF/, "HTF subtitle missing");

assert.match(source, /La Falange e il Contropiede/, "Chapter 2 title missing");
assert.match(source, /Leonida & Giulio Cesare/, "Archetype Leonida & Cesare missing");
assert.match(source, /Filtri di Inversione & Cambio di Carattere ITF/, "ITF subtitle missing");

assert.match(source, /L'Assalto Chirurgico/, "Chapter 3 title missing");
assert.match(source, /Napoleone & Musashi/, "Archetype Napoleone & Musashi missing");
assert.match(source, /Esecuzione LTF & Regola di Invalidazione/, "LTF subtitle missing");

// 2. Verify Dark / Tactical Aesthetic Colors and Accents
assert.match(source, /#07080C/, "Deep black background missing");
assert.match(source, /#C5A059/, "Antique bronze accent missing");
assert.match(source, /#D4AF37/, "Imperial gold accent missing");

// 3. Verify Direct Academy CTA Button
assert.match(
  source,
  /Studia i Video di questo Capitolo/,
  "Direct Academy CTA button text missing",
);

// 4. Verify Animated Tactical SVG Components
assert.match(source, /function TacticalMapHTF/, "TacticalMapHTF SVG component missing");
assert.match(source, /function PhalanxCounterITF/, "PhalanxCounterITF SVG component missing");
assert.match(source, /function SniperAssaultLTF/, "SniperAssaultLTF SVG component missing");
assert.match(source, /function ImperialSeal/, "ImperialSeal SVG component missing");

// 5. Verify Gatekeeping & Tier Protection
assert.match(source, /GatekeepingModal/, "GatekeepingModal integration missing");
assert.match(source, /userTier === "member"/, "Member tier check missing");
assert.match(source, /userTier === "sandbox"/, "Sandbox tier check missing");

console.log("GeneralsCodex static checks passed successfully");
