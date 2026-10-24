/**
 * AUREUS PROTOCOL (AUREUS OS) — Global Lexicon & Lore Constants
 *
 * Official terminology remapping from legacy TraderLoading and LIMEN to AUREUS.
 * Tone: Solemn, philosophical-operational, stoic, surgical, elite architectural order.
 */

export interface LimenModuleDefinition {
  readonly id: string;
  readonly legacyLabel: string;
  readonly officialTitle: string;
  readonly shortTitle: string;
  readonly subtitle: string;
}

export const AUREUS_BRAND = {
  name: "AUREUS",
  protocolName: "AUREUS PROTOCOL",
  internalCode: "AP: Aureus Protocol",
  motto: "Il Codice della Presenza e dell'Eredità",
  operatorTitle: "Operatore",
  initiateTitle: "Iniziato",
  architectTitle: "Architetto",
  driftTerm: "La Deriva",
  thresholdTerm: "Il Varco",
} as const;

export const LIMEN_BRAND = AUREUS_BRAND;

export const LIMEN_LEXICON: Record<string, LimenModuleDefinition> = {
  brand: {
    id: "brand",
    legacyLabel: "TraderLoading",
    officialTitle: "AUREUS",
    shortTitle: "AUREUS",
    subtitle: "Il Codice della Presenza e dell'Eredità",
  },
  dashboard: {
    id: "dashboard",
    legacyLabel: "Dashboard / Home",
    officialTitle: "Il Varco (Centro di Comando)",
    shortTitle: "Il Varco",
    subtitle: "Stato di allineamento, Grado attuale e Ordine del giorno.",
  },
  financialArchitecture: {
    id: "financialArchitecture",
    legacyLabel: "Architettura Patrimoniale",
    officialTitle: "Architettura Patrimoniale & Fondamenta di Rischio",
    shortTitle: "Architettura Patrimoniale",
    subtitle: "Le Fondamenta di Rischio. Il trading non inizia dal grafico, ma dalla struttura finanziaria sottostante.",
  },
  dailyOrder: {
    id: "dailyOrder",
    legacyLabel: "Ciclo TL / Sistema",
    officialTitle: "L'Ordine Giornaliero",
    shortTitle: "L'Ordine Giornaliero",
    subtitle: "La sequenza inviolabile. Nessuna azione fuori dal protocollo.",
  },
  htfScenario: {
    id: "htfScenario",
    legacyLabel: "Preparazione / Analisi HTF",
    officialTitle: "Contemplazione dello Scenario",
    shortTitle: "Contemplazione dello Scenario",
    subtitle: "Visione dall'Alto. Individua dove la massa cade in trappola.",
  },
  itfPivot: {
    id: "itfPivot",
    legacyLabel: "Zona ITF / Filtro",
    officialTitle: "Il Punto di Svolta",
    shortTitle: "Il Punto di Svolta",
    subtitle: "L'area in cui l'illusione si esaurisce e la direzione si manifesta.",
  },
  m1Seal: {
    id: "m1Seal",
    legacyLabel: "Entrata M1 (JTC / BTI / POC)",
    officialTitle: "Il Sigillo d'Azione",
    shortTitle: "Il Sigillo d'Azione",
    subtitle: "Convergenza assoluta. Esecuzione priva di esitazione.",
  },
  thresholdKeeper: {
    id: "thresholdKeeper",
    legacyLabel: "Checklist Pre-Trade / Co-Pilota",
    officialTitle: "Il Custode della Soglia",
    shortTitle: "Il Custode della Soglia",
    subtitle: "Filtro decisionale: stai agendo per lucidità o per debolezza?",
  },
  forgeOfThePast: {
    id: "forgeOfThePast",
    legacyLabel: "Backtest / Simulatore",
    officialTitle: "La Forgia del Passato",
    shortTitle: "La Forgia del Passato",
    subtitle: "Addestramento nell'ombra. Affila la visione prima della battaglia.",
  },
  bookOfTruth: {
    id: "bookOfTruth",
    legacyLabel: "Trading Journal",
    officialTitle: "Il Libro della Verità",
    shortTitle: "Il Libro della Verità",
    subtitle: "Cronaca spietata delle tue scelte. I dati non mentono.",
  },
  brotherhood: {
    id: "brotherhood",
    legacyLabel: "Social / Community",
    officialTitle: "La Fratellanza (Agorà dell'Ordine)",
    shortTitle: "La Fratellanza",
    subtitle: "Confronto tra pari. Zero rumore, solo analisi e progresso.",
  },
  hierarchyOfIntegrity: {
    id: "hierarchyOfIntegrity",
    legacyLabel: "Classifiche (Leaderboard)",
    officialTitle: "La Gerarchia dell'Integrità",
    shortTitle: "La Gerarchia dell'Integrità",
    subtitle: "Il rango non si compra: si conquista rispettando il Codice.",
  },
  trialsByFire: {
    id: "trialsByFire",
    legacyLabel: "Tornei / Sfide",
    officialTitle: "Le Prove del Fuoco (Arene)",
    shortTitle: "Le Prove del Fuoco",
    subtitle: "Competizioni di disciplina, gestione del rischio e costanza.",
  },
  operatorDossier: {
    id: "operatorDossier",
    legacyLabel: "Profilo Utente",
    officialTitle: "Dossier dell'Operatore",
    shortTitle: "Dossier dell'Operatore",
    subtitle: "Registro storico di Integrità, Grado ed Espansione.",
  },
  doctrineOfTime: {
    id: "doctrineOfTime",
    legacyLabel: "Accademia Video",
    officialTitle: "La Dottrina del Tempo",
    shortTitle: "La Dottrina del Tempo",
    subtitle: "L'Arte dell'Assedio (Swing) e L'Arte del Duello (Scalp).",
  },
  arsenalAndExpansion: {
    id: "arsenalAndExpansion",
    legacyLabel: "Risorse / Ecosistema",
    officialTitle: "L'Arsenale e L'Espansione",
    shortTitle: "L'Arsenale",
    subtitle: "Dotazioni d'Ordine in Fonderia: Il Codice Trimestrale e L'Uniforme Completa (Sblocco futuro per merito).",
  },
} as const;

export const AUREUS_MANIFESTO = {
  gateTitle: "LA SOGLIA DI SELEZIONE",
  manifestoHeader: "Il Manifesto: Il Codice della Presenza e dell'Eredità",
  manifestoSubheader: "AUREUS PROTOCOL — SISTEMA OPERATIVO DI DISCIPLINA, PADRONANZA MENTALE ED EREDITÀ",
  paragraphs: [
    "Nel mercato, come nell'esistenza, l'umanità si divide in due sole categorie: coloro che vivono nella Deriva e coloro che scelgono di attraversare Il Varco.",
    "Chi abita la Deriva reagisce agli impulsi, cerca il colpo di fortuna, cede all'emotività e diventa inevitabilmente carburante e liquidità per il sistema. Non possiede un metodo: è posseduto dalle proprie debolezze.",
    "AUREUS non è un'applicazione per scommettitori retail. È un Ordine operativo progettato per trasformare l'Iniziato in Architetto attraverso una regola chirurgica: L'Ordine Giornaliero, il filtro spietato de Il Custode della Soglia e la rendicontazione assoluta ne Il Libro della Verità.",
    "Qui il rango non si acquista. I 5 Gradi di Ascesa si conquistano esclusivamente tramite il tuo Indice di Integrità: la fedeltà quotidiana alla parola data a te stesso.",
  ],
  pillars: [
    {
      label: "USCITA DALLA DERIVA",
      description: "Nessun ingresso impulsivo. Ogni esecuzione richiede Contemplazione dello Scenario, Punto di Svolta e Sigillo d'Azione.",
    },
    {
      label: "IL LIBRO DELLA VERITÀ",
      description: "Ogni sessione e ogni scelta vengono registrate senza autoinganno. L'omissione equivale a cedimento.",
    },
    {
      label: "MERITOCRAZIA D'ORDINE",
      description: "L'accesso al Mandato di Espansione, al Tempio Fisico e alla Divisione B2B è vincolato all'Integrità verificata.",
    },
  ],
  pactDeclaration:
    "Consapevole che il mercato è uno specchio morale che punisce l'assenza di governo interiore, dichiaro di sottopormi volontariamente al protocollo AUREUS.",
  pactButtonLabel: "Accetto la Regola. Esco dalla Deriva.",
} as const;

export const LIMEN_MANIFESTO = AUREUS_MANIFESTO;
