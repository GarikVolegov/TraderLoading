import assert from "node:assert/strict";
import { getLimenPageQuote } from "./limenPageQuotes";

// 1. Patrimonio
const patrimonioQuote = getLimenPageQuote("/patrimonio");
assert.equal(patrimonioQuote, "Il trading non inizia dal grafico, ma dalla solidità delle fondamenta di rischio.");

// 2. Home variants
assert.equal(
  getLimenPageQuote("/"),
  "Chi abita la Deriva reagisce agli impulsi; chi attraversa Il Varco governa il proprio destino.",
);
assert.equal(
  getLimenPageQuote("/", "vista=mercati"),
  "Non forzare il mercato: attendi che l'illusione si dissolva e la struttura emerga.",
);
assert.equal(
  getLimenPageQuote("/", "vista=strumenti"),
  "La chiarezza analitica precede ogni esecuzione: osserva prima di agire.",
);

// 3. Core hubs
assert.equal(
  getLimenPageQuote("/journal"),
  "Cronaca spietata delle tue scelte: i dati non mentono, riflettono la tua disciplina.",
);
assert.equal(
  getLimenPageQuote("/journal?t=trades"),
  "Cronaca spietata delle tue scelte: i dati non mentono, riflettono la tua disciplina.",
);
assert.equal(
  getLimenPageQuote("/backtest"),
  "Addestramento nell'ombra: affila la visione nel passato prima di entrare nel fuoco del presente.",
);
assert.equal(
  getLimenPageQuote("/backtest/123/replay"),
  "Addestramento nell'ombra: affila la visione nel passato prima di entrare nel fuoco del presente.",
);
assert.equal(
  getLimenPageQuote("/resources"),
  "Gli strumenti forgiano l'opera: l'arsenale appartiene a chi ha scelto l'ordine.",
);
assert.equal(
  getLimenPageQuote("/chat"),
  "Confronto tra pari: zero rumore, solo rigore, lucidità e progresso condiviso.",
);
assert.equal(
  getLimenPageQuote("/tornei"),
  "Non la frenesia, ma la costanza e la padronanza del rischio decretano la vittoria.",
);
assert.equal(
  getLimenPageQuote("/milestones"),
  "Il rango non si compra né si ostenta: si conquista rispettando la parola data.",
);
assert.equal(
  getLimenPageQuote("/academy"),
  "Chi comprende il tempo governa il prezzo: l'arte dell'assedio e l'arte del duello.",
);
assert.equal(
  getLimenPageQuote("/settings"),
  "Governa te stesso e il tuo ambiente prima di pretendere di governare i mercati.",
);
assert.equal(
  getLimenPageQuote("/support"),
  "La prontezza e la chiarezza dissolvono ogni attrito lungo il cammino.",
);
assert.equal(
  getLimenPageQuote("/pro"),
  "L'ascesa non ammette compromessi: l'eccellenza operativa è il nostro unico canone.",
);

// 4. Default fallback
assert.equal(
  getLimenPageQuote("/unknown-path"),
  "La presenza vigile separa l'azione consapevole dalla deriva impulsiva.",
);

// 5. Ensure non-empty and well-formed
const routesToTest = [
  "/",
  "/today",
  "/patrimonio",
  "/journal",
  "/backtest",
  "/resources",
  "/chat",
  "/tornei",
  "/milestones",
  "/academy",
  "/routine",
  "/checklist",
  "/method",
  "/news",
  "/settings",
  "/support",
  "/pro",
  "/protocollo",
];

for (const route of routesToTest) {
  const quote = getLimenPageQuote(route);
  assert.ok(quote.length > 20, `Quote for ${route} is too short: "${quote}"`);
  assert.ok(!quote.includes("undefined"), `Quote for ${route} contains undefined`);
}

console.log("limen page quotes unit tests passed");
