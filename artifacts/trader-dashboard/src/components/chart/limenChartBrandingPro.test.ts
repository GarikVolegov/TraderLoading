import assert from "node:assert/strict";
import { getSessionRangesForTime } from "../chartSessionTime";
import { DEFAULT_TERMINAL_SETTINGS } from "../../lib/replay/terminalPersistence";

console.log("1. Verifica calcolo e copertura delle sessioni operative (Asia, Londra, NY)...");
const sampleDayTs = 1774000000; // Sample unix timestamp
const ranges = getSessionRangesForTime(sampleDayTs);

assert.ok(ranges.asia, "La sessione Asia deve essere definita");
assert.ok(ranges.london, "La sessione Londra deve essere definita");
assert.ok(ranges.newYork, "La sessione New York deve essere definita");

// Verifichiamo che la sessione di NY inizi alle 14:30 ora di Roma e termini alle 23:00
assert.ok(ranges.newYork.start < ranges.newYork.end, "La sessione NY deve avere durata positiva");
assert.equal(ranges.newYork.end - ranges.newYork.start, (23 - 14.5) * 3600, "La sessione NY deve durare 8.5 ore");

// Verifichiamo che la sessione Asia duri 8 ore
assert.equal(ranges.asia.end - ranges.asia.start, 8 * 3600, "La sessione Asia deve durare 8 ore (00:00 - 08:00)");

// Verifichiamo che la sessione Londra duri 9 ore
assert.equal(ranges.london.end - ranges.london.start, 9 * 3600, "La sessione Londra deve durare 9 ore (08:00 - 17:00)");

console.log("2. Verifica impostazioni predefinite LIMEN Luxury...");
assert.equal(DEFAULT_TERMINAL_SETTINGS.toolColor, "#c5a059", "Il colore predefinito degli strumenti deve essere Oro Imperiale (#c5a059)");
assert.equal(DEFAULT_TERMINAL_SETTINGS.chartBgColor1, "#08080a", "Lo sfondo del grafico deve essere Nero Ossidiana (#08080a)");
assert.equal(DEFAULT_TERMINAL_SETTINGS.candleUpColor, "#c5a059", "La candela rialzista predefinita deve essere Oro (#c5a059)");
assert.equal(DEFAULT_TERMINAL_SETTINGS.textColor, "#f4f4f6", "Il testo predefinito deve essere Avorio (#f4f4f6)");

console.log("Tutti i test di brandizzazione LIMEN e sessioni sono passati con successo!");
