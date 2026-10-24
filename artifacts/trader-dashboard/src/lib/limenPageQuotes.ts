/**
 * LIMEN PROTOCOL — Thematic Philosophical Quotes per Screen
 *
 * Replaces repetitive breadcrumb navigation with stoic, contemplative
 * and surgical principles that align the Operator's mindset on each page.
 */

export interface LimenPageQuote {
  readonly quote: string;
}

export function getLimenPageQuote(location: string, search: string = ""): string {
  const searchParams = new URLSearchParams(search);
  const vista = searchParams.get("vista");

  // Architettura Patrimoniale
  if (location === "/patrimonio") {
    return "Il trading non inizia dal grafico, ma dalla solidità delle fondamenta di rischio.";
  }

  // Il Varco / Home / Scenari Operativi
  if (location === "/" || location === "/today") {
    if (vista === "mercati") {
      return "Non forzare il mercato: attendi che l'illusione si dissolva e la struttura emerga.";
    }
    if (vista === "strumenti") {
      return "La chiarezza analitica precede ogni esecuzione: osserva prima di agire.";
    }
    return "Chi abita la Deriva reagisce agli impulsi; chi attraversa Il Varco governa il proprio destino.";
  }

  // Il Libro della Verità (Journal / Trades / Piano)
  if (location.startsWith("/journal")) {
    return "Cronaca spietata delle tue scelte: i dati non mentono, riflettono la tua disciplina.";
  }

  // La Forgia del Passato (Backtest / Replay)
  if (location.startsWith("/backtest")) {
    return "Addestramento nell'ombra: affila la visione nel passato prima di entrare nel fuoco del presente.";
  }

  // L'Arsenale Operativo & Conoscenza
  if (
    location.startsWith("/resources") ||
    location === "/library" ||
    location === "/tools" ||
    location === "/wiki"
  ) {
    return "Gli strumenti forgiano l'opera: l'arsenale appartiene a chi ha scelto l'ordine.";
  }

  // La Fratellanza (Agorà / Chat)
  if (location.startsWith("/chat")) {
    return "Confronto tra pari: zero rumore, solo rigore, lucidità e progresso condiviso.";
  }

  // Le Prove del Fuoco (Tornei)
  if (location.startsWith("/tornei")) {
    return "Non la frenesia, ma la costanza e la padronanza del rischio decretano la vittoria.";
  }

  // La Gerarchia dell'Integrità (Milestones / Gradi)
  if (location === "/milestones") {
    return "Il rango non si compra né si ostenta: si conquista rispettando la parola data.";
  }

  // La Dottrina del Tempo (Accademia)
  if (location === "/academy") {
    return "Chi comprende il tempo governa il prezzo: l'arte dell'assedio e l'arte del duello.";
  }

  // Il Custode della Soglia / Metodo / Checklist / Routine
  if (
    location === "/routine" ||
    location === "/checklist" ||
    location === "/method"
  ) {
    return "Nessun ingresso impulsivo: il filtro della regola protegge il capitale dalla debolezza interiore.";
  }

  // Notizie Macroeconomiche
  if (location === "/news") {
    return "Comprendi le maree macroeconomiche per non farti travolgere dalle correnti effimere.";
  }

  // Sanctum dell'Operatore (Impostazioni)
  if (location === "/settings") {
    return "Governa te stesso e il tuo ambiente prima di pretendere di governare i mercati.";
  }

  // I Custodi dell'Ordine (Supporto)
  if (location.startsWith("/support")) {
    return "La prontezza e la chiarezza dissolvono ogni attrito lungo il cammino.";
  }

  // Elevazione LIMEN Pro
  if (location === "/pro") {
    return "L'ascesa non ammette compromessi: l'eccellenza operativa è il nostro unico canone.";
  }

  // Protocollo Operativo / Sandbox
  if (location === "/protocollo" || location === "/sandbox") {
    return "Il protocollo è un patto con la propria lucidità: l'esecuzione non ammette deviazioni.";
  }

  // Fallback universale
  return "La presenza vigile separa l'azione consapevole dalla deriva impulsiva.";
}
