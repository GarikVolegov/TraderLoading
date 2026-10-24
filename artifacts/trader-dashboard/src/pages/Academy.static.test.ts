import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const academySource = readFileSync(new URL("./Academy.tsx", import.meta.url), "utf8");
const booksReaderSource = readFileSync(
  new URL("../components/academy/GeneralsBooksReader.tsx", import.meta.url),
  "utf8",
);

// 1. Viewport-contained ergonomics: PageLayout quiet + limen-scroll-pane
assert.match(
  academySource,
  /<PageLayout quiet>/,
  "Academy must use PageLayout quiet to stay contained within viewport",
);
assert.match(
  academySource,
  /limen-scroll-pane/,
  "Academy must use limen-scroll-pane for internal scrolling",
);

// 2. Elimination of top header banner and bulky stat tiles (user requested clean viewport fit)
assert.doesNotMatch(
  academySource,
  /<PageHeader\b/,
  "Academy must not have bulky PageHeader pushing content below the fold",
);
assert.doesNotMatch(
  academySource,
  /<StatTile\b/,
  "Academy must not have bulky StatTile grid taking up half the viewport",
);

// 3. The 3 Sovereign SectionTabs (clean, direct entry)
assert.match(
  academySource,
  /01 · I CANONI OPERATIVI/,
  "Tab 1 must be '01 · I CANONI OPERATIVI'",
);
assert.match(
  academySource,
  /02 · IL TRATTATO DEI GENERALI/,
  "Tab 2 must be '02 · IL TRATTATO DEI GENERALI'",
);
assert.match(
  academySource,
  /03 · IL MANDATO D'ESPANSIONE/,
  "Tab 3 must be '03 · IL MANDATO D'ESPANSIONE'",
);

// 4. GeneralsBooksReader integration
assert.match(
  academySource,
  /<GeneralsBooksReader\s*\/>/,
  "Academy must render GeneralsBooksReader inside Tab 02",
);

// 5. I Tre Libri dei Generali in GeneralsBooksReader
assert.match(booksReaderSource, /roman:\s*"LIBRO I"/, "Must define LIBRO I");
assert.match(booksReaderSource, /roman:\s*"LIBRO II"/, "Must define LIBRO II");
assert.match(booksReaderSource, /roman:\s*"LIBRO III"/, "Must define LIBRO III");

// 6. Technical Content Checks from User Prompt:
// Gerarchia dei Timeframe (Scalp vs Swing)
assert.match(booksReaderSource, /SCALPING \(Il Duello Rapido\)/, "Must include Scalping timeframe hierarchy");
assert.match(booksReaderSource, /H1 definisce la zona e i pool/, "H1 zone & main pools");
assert.match(booksReaderSource, /M15 certifica la schematica/, "M15 schematica & cycle close");
assert.match(booksReaderSource, /SWING \/ INTRADAY/, "Must include Swing timeframe hierarchy");

// Finestre Operative Italiane
assert.match(booksReaderSource, /Asia · 00:00–08:00 CET/, "Asia window");
assert.match(booksReaderSource, /01:00 e le 03:30 CET/, "Asia entries window 01:00-03:30");
assert.match(booksReaderSource, /London · 08:00–11:30 CET/, "London window");
assert.match(booksReaderSource, /Lunch · 11:30–13:30 CET/, "Lunch window");
assert.match(booksReaderSource, /New York · 14:00–18:30 CET/, "New York window");
assert.match(booksReaderSource, /Chiusura Scalp · Dalle ore 18:00 CET/, "18:00 scalp closing");
assert.match(booksReaderSource, /Swing \/ Sera · 18:30–22:00 CET/, "Swing evening window");
assert.match(booksReaderSource, /Chiusura Swing · Dalle ore 22:00 CET/, "22:00 swing closing");

// Red Folder News
assert.match(booksReaderSource, /RED FOLDER NEWS/, "Red Folder News section");
assert.match(booksReaderSource, /Forex Factory \/ Fair Economy/, "Forex Factory source");
assert.match(booksReaderSource, /10 Minuti/, "10 minutes pre-news lock");
assert.match(booksReaderSource, /45 Minuti/, "45 minutes post-news stabilization");

// Le Quattro Domande
assert.match(booksReaderSource, /1\. Dove ci troviamo\?/, "Question 1");
assert.match(booksReaderSource, /2\. Cosa ha preso a sinistra\?/, "Question 2");
assert.match(booksReaderSource, /3\. Come ci è arrivato\?/, "Question 3");
assert.match(booksReaderSource, /4\. Cosa deve prendere\?/, "Question 4");

// Direzionalità e Liquidità
assert.match(booksReaderSource, /Liquidità Sopra e Sotto = NO TRADE/, "Compression = NO TRADE");
assert.match(booksReaderSource, /Sweep Confermato Obbligatorio/, "Sweep required");

// Router di Zona
assert.match(booksReaderSource, /Solo Liquidità, Senza Zona HTF/, "Liquidity only router");
assert.match(booksReaderSource, /Zona HTF Valida Toccata e Mitigata/, "HTF zone touched router");

// Re-accumuli Fase 2
assert.match(booksReaderSource, /RE-ACCUMULI IN FASE 2 & PROTOCOLLO JTC/, "Reaccumulations Phase 2 title");
assert.match(booksReaderSource, /Esclusività JTC/, "JTC exclusivity");

// Ciclo, Area Vergine & 10%
assert.match(booksReaderSource, /Area Vergine: Spinta Minima 10%/, "Virgin area 10% delta push");

// 4 Trigger d'Azione
assert.match(booksReaderSource, /Trigger TEST/, "Trigger Test");
assert.match(booksReaderSource, /Trigger POC/, "Trigger POC");
assert.match(booksReaderSource, /Trigger JTC/, "Trigger JTC");
assert.match(booksReaderSource, /Trigger BTI/, "Trigger BTI");

// Reattività & Congestione
assert.match(booksReaderSource, /Reazione Immediata Post-M1/, "Immediate M1 reaction");
assert.match(booksReaderSource, /Congestione a Ridosso della Zona/, "Congestion cancellazione pendenti");
assert.match(booksReaderSource, /Distinzione Pendente ed Eseguito/, "Pending vs Executed distinction");

// Glossario
assert.match(booksReaderSource, /Glossario Canonico/, "Glossario title");
assert.match(booksReaderSource, /HTF\/ITF\/LTF: Mappa\/Validazione\/Trigger/, "Glossary HTF/ITF/LTF");
assert.match(booksReaderSource, /Sweep: Presa liquidità/, "Glossary sweep");
assert.match(booksReaderSource, /Compressione: Liquidità sopra e sotto/, "Glossary compression");

// 7. Il Filtro del Custode in Tab 01 (Checklist pre-sessione)
assert.match(
  academySource,
  /IL FILTRO DEL CUSTODE \/\/ 4 SIGILLI PRE-MERCATO/,
  "Pre-trade checklist must be 'IL FILTRO DEL CUSTODE // 4 SIGILLI PRE-MERCATO'",
);

// 8. Canonical Master Data validation (Canoni 0 to V)
assert.match(academySource, /roman:\s*"CANONE 0"/, "Must define CANONE 0");
assert.match(academySource, /roman:\s*"CANONE I"/, "Must define CANONE I");
assert.match(academySource, /roman:\s*"CANONE II"/, "Must define CANONE II");
assert.match(academySource, /roman:\s*"CANONE III"/, "Must define CANONE III");
assert.match(academySource, /roman:\s*"CANONE IV"/, "Must define CANONE IV");
assert.match(academySource, /roman:\s*"CANONE V"/, "Must define CANONE V");

// 9. Mandato d'Espansione: Single-Tier 20% and 5-member sovereign exemption
assert.match(
  academySource,
  /MANDATO D'ESPANSIONE \/\/ PATTO D'ONORE SINGLE-TIER/,
  "Affiliation must be 'MANDATO D'ESPANSIONE // PATTO D'ONORE SINGLE-TIER'",
);

// 10. Backwards compatibility exports preserved
assert.match(
  academySource,
  /export function AcademyWelcome\(\)/,
  "AcademyWelcome must be exported for App.tsx public gateway",
);

// 11. Screen stability, fixed dimensions and zero-jump container bounds
assert.match(
  booksReaderSource,
  /\/images\/books\/book1-p1-pyramid\.jpg/,
  "Book 1 Page 1 must use the official pyramid artwork uploaded by the user",
);
assert.match(
  booksReaderSource,
  /\/images\/books\/book1-p2-clock\.jpg/,
  "Book 1 Page 2 must use the official clock artwork uploaded by the user",
);
assert.match(
  booksReaderSource,
  /h-\[calc\(100dvh-130px\)\]/,
  "Book reader must have calibrated viewport height to stay fixed on screen",
);
assert.match(
  booksReaderSource,
  /max-h-\[740px\]/,
  "Book reader must have maximum height bound to preserve golden ratio",
);
assert.match(
  booksReaderSource,
  /shrink-0 h-12/,
  "Top and bottom bars must be rigidly anchored (shrink-0 h-12) to prevent vertical jumps",
);
assert.match(
  academySource,
  /activeTab === "trattato" && \(\s*<div className="flex-1 min-h-0 flex flex-col justify-center pt-1 pb-1 lg:overflow-hidden">/,
  "Trattato container must be lg:overflow-hidden to avoid screen scrolling",
);

console.log("Academy.static.test.ts: all 3 books, tablet reader, fixed dimensions, and exact protocol technical rules verified successfully.");
