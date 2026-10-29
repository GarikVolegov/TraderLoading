/** Teaching plans are outlines for the instructor, never recorded or delivered lessons. */
export const ACADEMY_MODULES = [
  {
    id: "preparazione",
    title: "L'Ordine Giornaliero e il Custode della Soglia",
    description: "Sessioni, calendario e allineamento sovrano prima del grafico.",
    orderIndex: 0,
  },
  {
    id: "contesto",
    title: "Contemplazione dello Scenario (Ciclo e Liquidità)",
    description: "Visione dall'Alto: individuare dove la massa cade in trappola.",
    orderIndex: 1,
  },
  {
    id: "sinistra",
    title: "Il Punto di Svolta (Zone e Scenari)",
    description:
      "Distinguere area in cui l'illusione si esaurisce, sola liquidità e box intermedi.",
    orderIndex: 2,
  },
  {
    id: "esecuzione",
    title: "Il Sigillo d'Azione (Convergenza e Trigger)",
    description: "Convergenza assoluta ed esecuzione priva di esitazione.",
    orderIndex: 3,
  },
  {
    id: "target",
    title: "Target Sovrano e Invalidazione",
    description: "Documentare obiettivo, attesa e risposta disciplinata al cambiamento.",
    orderIndex: 4,
  },
  {
    id: "scalp",
    title: "L'Arte del Duello (Operatività Scalp)",
    description: "Esecuzione millimetrica H1 → M15 → M1, Punto di Svolta e Sigillo d'Azione.",
    orderIndex: 5,
  },
  {
    id: "swing",
    title: "L'Arte dell'Assedio (Operatività Swing)",
    description: "Visione macro, pazienza strategica e grandi cicli Daily/H4 → H1/M15 → M5/M1.",
    orderIndex: 6,
  },
  {
    id: "revisione",
    title: "Il Libro della Verità (Revisione e Rettifica)",
    description: "Cronaca spietata del processo e scelta di una correzione verificabile.",
    orderIndex: 7,
  },
] as const;

export type AcademyModuleId = (typeof ACADEMY_MODULES)[number]["id"];
export interface AcademySyllabusItem {
  id: string;
  moduleId: AcademyModuleId;
  title: string;
  outline: string;
  exercisePrompt: string;
  status: "outline";
}

const outline = (
  moduleId: AcademyModuleId,
  number: number,
  title: string,
  description: string,
  exercisePrompt: string,
): AcademySyllabusItem => ({
  id: `${moduleId}-${number}`,
  moduleId,
  title,
  outline: description,
  exercisePrompt,
  status: "outline",
});

export const ACADEMY_SYLLABUS: readonly AcademySyllabusItem[] = [
  outline(
    "preparazione",
    1,
    "Preparare la sessione",
    "Mostrare come preparare grafico, mercato e finestra oraria del cockpit.",
    "Descrivi la preparazione della tua sessione in simulazione.",
  ),
  outline(
    "preparazione",
    2,
    "Calendario e condizioni di attesa",
    "Mostrare un controllo delle fonti e un caso in cui attendere; rivalidare dopo le news.",
    "Annota cosa hai verificato e perché opereresti o attenderesti.",
  ),
  outline(
    "preparazione",
    3,
    "Protezione personale e checklist",
    "Spiegare come dichiarare i propri limiti, senza soglie di rischio universali.",
    "Compila una checklist e indica quali limiti devi ancora definire.",
  ),
  outline(
    "contesto",
    1,
    "Il ciclo grande",
    "Il docente definisce le fasi del ciclo e le annota sul grafico HTF.",
    "Annota il ciclo osservato e i punti ancora incerti.",
  ),
  outline(
    "contesto",
    2,
    "Liquidità e sweep",
    "Mostrare un caso di sweep e un controesempio secondo le definizioni del docente.",
    "Confronta i due casi indicando le differenze osservabili.",
  ),
  outline(
    "contesto",
    3,
    "Compressione: documentare l'attesa",
    "Mostrare un contesto con liquidità sopra e sotto e nessun nuovo ingresso.",
    "Scrivi una scheda di attesa e cosa richiederebbe una rivalutazione.",
  ),
  outline(
    "sinistra",
    1,
    "Zona valida e mitigata",
    "Definire la zona HTF e mostrare la conferma richiesta prima di cercare un'inversione.",
    "Segna la zona e distingui ciò che osservi da ciò che aspetti.",
  ),
  outline(
    "sinistra",
    2,
    "Sola liquidità",
    "Mostrare uno scenario senza zona valida: il cockpit consente solo JTC o BTI.",
    "Motiva la classificazione dello scenario su un replay.",
  ),
  outline(
    "sinistra",
    3,
    "Box intermedi",
    "Mostrare il caso in cui l'estremo non è raggiunto e sono ammessi solo JTC nei re-accumuli.",
    "Annota il box e il contesto che rende coerente lo scenario.",
  ),
  outline(
    "esecuzione",
    1,
    "Conferme ITF e LTF",
    "Il docente definisce chiusura del ciclo e schematica: nessuna conferma va anticipata.",
    "Segna prima e dopo della conferma su un replay.",
  ),
  outline(
    "esecuzione",
    2,
    "TEST e POC",
    "Da completare con definizioni originali del docente, esempi validi e controesempi; il codice non ne definisce le regole.",
    "Confronta gli esempi usando esclusivamente le regole spiegate dal docente.",
  ),
  outline(
    "esecuzione",
    3,
    "JTC e BTI",
    "Da completare con definizioni originali del docente e compatibilità con zona valida, sola liquidità e re-accumuli.",
    "Spiega quale trigger è ammesso e quale conferma manca.",
  ),
  outline(
    "target",
    1,
    "Pool di liquidità opposto",
    "Mostrare come identificare e confermare il target prima del piano.",
    "Annota target e motivazione sul grafico fornito.",
  ),
  outline(
    "target",
    2,
    "Storico e area vergine",
    "Il docente mostra il filtro manuale di sbilanciamento in area vergine; nessuna formula viene presupposta.",
    "Distingui area con storico e area vergine e annota il controllo richiesto.",
  ),
  outline(
    "target",
    3,
    "Aspettativa e invalidazione",
    "Dichiarare cosa ci si aspetta e come rispondere se il contesto cambia.",
    "Scrivi aspettativa, invalidazione e risposta prevista per il caso studiato.",
  ),
  outline(
    "scalp",
    1,
    "Scalp: contesto H1",
    "Registrare un caso originale con zone H1, liquidità e scelta dello scenario.",
    "Ricostruisci il contesto senza osservare l'esito successivo.",
  ),
  outline(
    "scalp",
    2,
    "Scalp: da M15 a M1",
    "Mostrare le conferme del caso scelto, usando le definizioni del docente.",
    "Documenta le conferme e un punto in cui sarebbe stato necessario attendere.",
  ),
  outline(
    "scalp",
    3,
    "Scalp: sessione completa",
    "Replay commentato dalla preparazione al consuntivo, includendo costi ed eventuali errori.",
    "Consegna la scheda di simulazione e una revisione del piano.",
  ),
  outline(
    "swing",
    1,
    "Swing: Daily e H4",
    "Registrare un caso originale con ciclo Daily e zona H4.",
    "Annota contesto, zona e condizioni di attesa.",
  ),
  outline(
    "swing",
    2,
    "Swing: H1/M15 e M5/M1",
    "Mostrare la discesa sui timeframe del metodo e le conferme richieste.",
    "Ricostruisci la sequenza e le invalidazioni osservabili.",
  ),
  outline(
    "swing",
    3,
    "Swing: caso completo",
    "Seguire preparazione, evoluzione, gestione e consuntivo di un caso documentato.",
    "Consegna una simulazione motivata distinguendo piano ed esito.",
  ),
  outline(
    "revisione",
    1,
    "Registrare evidenze",
    "Distinguere simulazione, reale, aderenza e risultato economico dopo i costi.",
    "Compila un'evidenza indicando fonte, ambiente e dati mancanti.",
  ),
  outline(
    "revisione",
    2,
    "Rivedere anche perdite e attese",
    "Commentare casi favorevoli, sfavorevoli e senza operazioni, senza selezionare solo i successi.",
    "Confronta processo ed esito di due casi diversi.",
  ),
  outline(
    "revisione",
    3,
    "Una correzione verificabile",
    "Collegare la revisione a una sola azione e a un criterio osservabile.",
    "Proponi una correzione e il modo in cui ne verificherai l'applicazione.",
  ),
];

export interface AcademyLessonInput {
  moduleId: AcademyModuleId;
  syllabusId?: string | null;
  title: string;
  description?: string;
  videoUrl?: string | null;
  streamVideoId?: string | null;
  accessLevel?: "free" | "protocol";
  contentKind?: "book" | "lesson";
  introductionSlot?: "book" | "chapter0" | "lesson1" | "lesson2" | null;
  bodyMarkdown?: string;
  exercisePrompt?: string;
  orderIndex?: number;
  published?: boolean;
}
export type AcademyLessonPatch = Partial<AcademyLessonInput>;
export interface AcademyLessonMetadata {
  id: string;
  moduleId: AcademyModuleId;
  syllabusId: string | null;
  title: string;
  description: string;
  orderIndex: number;
  publishedAt: string | null;
  accessLevel?: "free" | "protocol";
  contentKind?: "book" | "lesson";
  introductionSlot?: string | null;
}
export interface AcademyLesson extends AcademyLessonMetadata {
  videoUrl: string | null;
  streamVideoId?: string | null;
  videoEmbedUrl: string | null;
  bodyMarkdown: string;
  exercisePrompt: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface AcademyProgress {
  id: string;
  lessonId: string;
  completedAt: string | null;
  exerciseResponse: string;
  submittedAt: string | null;
  feedback: string;
  reviewedAt: string | null;
  updatedAt: string;
}
export interface AcademyTeacherSubmission extends AcademyProgress {
  userId: string;
  lessonTitle: string;
}
export interface AcademyCatalog {
  modules: typeof ACADEMY_MODULES;
  syllabus: readonly AcademySyllabusItem[];
  lessons: AcademyLessonMetadata[];
  access: { hasAccess: boolean; isTeacher: boolean };
  progress: AcademyProgress[];
}
export interface AcademyLessonDetail {
  lesson: AcademyLesson;
  progress: AcademyProgress | null;
}

// ─── MASTER DATA: IL CORPUS DEL MENTORE (I 5 TOMI DELLA DOTTRINA) ─────────────

export interface MentorDoctrineQuestion {
  id: string;
  question: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
  explanation: string;
}

export interface MentorDoctrineTome {
  id: string;
  roman: "TOMO I" | "TOMO II" | "TOMO III" | "TOMO IV" | "TOMO V";
  tomeNumber: 1 | 2 | 3 | 4 | 5;
  title: string;
  subtitle: string;
  targetGrade: 1 | 2 | 3 | 4 | 5;
  targetGradeName: string;
  slidesCount: number;
  badge: string;
  conceptSummary: string;
  rulesOfEngagement: {
    ruleCode: string;
    title: string;
    instruction: string;
    axiom: string;
  }[];
  marketMechanics: {
    label: string;
    detail: string;
  }[];
  chartDiagram: {
    diagramType:
      | "soglie_50"
      | "volume_profile_shapes"
      | "asian_range_sweep"
      | "wyckoff_phases"
      | "brics_gold_macro";
    caption: string;
    keyPoints: string[];
  };
  examQuestions: MentorDoctrineQuestion[];
}

export const MENTOR_DOCTRINE_TOMES: readonly MentorDoctrineTome[] = [
  // ─── TOMO I: LE SOGLIE PSICOLOGICHE ──────────────────────────────────────────
  {
    id: "tomo-soglie-psicologiche",
    roman: "TOMO I",
    tomeNumber: 1,
    title: "Le Soglie Psicologiche & L'Equilibrio della Struttura",
    subtitle: "Calcolo al 50% delle Inefficienze, Numeri Tondi e Reazione Istituzionale",
    targetGrade: 1,
    targetGradeName: "Novizio Consapevole",
    slidesCount: 12,
    badge: "Fondamenti Strutturali",
    conceptSummary:
      "La soglia psicologica non è un'ipotesi astratta, ma una struttura oggettiva che il mercato genera matematicamente. Si calcola individuando una zona di domanda/offerta o inefficienza e tagliando esattamente il 50%: se il livello coincide con un prezzo tondo (.00, .50, .05, 10, 15), la soglia è confermata per un ingaggio ad alta precisione.",
    rulesOfEngagement: [
      {
        ruleCode: "SOG-01",
        title: "Regola del 50% Mediano",
        instruction: "Tracciare la zona di inefficienza o domanda/offerta e apporre una linea mediana esatta al 50%.",
        axiom: "La massa guarda gli estremi; le istituzioni riequilibrano al 50% esatto.",
      },
      {
        ruleCode: "SOG-02",
        title: "Conferma del Numero Tondo",
        instruction: "Verificare che il 50% cada su un prezzo tondo (frazioni .00, .50 o multipli di 5/10 pips).",
        axiom: "Se il 50% non è corroborato da un livello psicologico tondo, la soglia non possiede validità operativa.",
      },
      {
        ruleCode: "SOG-03",
        title: "Confluenza di Swing Trading",
        instruction: "Attendere la reazione con candela di rigetto prima di posizionare lo stop loss pochi pips oltre la zona.",
        axiom: "Non anticipare la soglia: attendi che il mercato mostri l'assorbimento dell'ordine.",
      },
    ],
    marketMechanics: [
      {
        label: "Zona Iniziale",
        detail: "Qualsiasi zona di domanda & offerta, Fair Value Gap o inefficienza di mercato su timeframe guida.",
      },
      {
        label: "Taglio Mediano",
        detail: "Linea al 50% del range dell'area individuata.",
      },
      {
        label: "Filtro Numerico",
        detail: "Corrispondenza con prezzi a cifra tonda (00, 50, 10, 20...).",
      },
    ],
    chartDiagram: {
      diagramType: "soglie_50",
      caption: "Anatomia della Soglia Psicologica: Taglio al 50% su Inefficienza con Prezzo Tondo",
      keyPoints: [
        "Individuazione Area di Squilibrio / Inefficienza",
        "Calcolo Mediano 50% = Prezzo Tondo Istituzionale",
        "Reazione Volumetrica con Candela di Rifiuto e Ingresso",
      ],
    },
    examQuestions: [
      {
        id: "q-sog-1",
        question: "Come viene definita una soglia psicologica operativa secondo la metodologia del Mentore?",
        options: [
          "Un massimo o minimo casuale su un timeframe orario.",
          "Una linea mediana al 50% di una zona di inefficienza/domanda che coincide con un numero tondo.",
          "La semplice media mobile esponenziale a 200 periodi.",
        ],
        correctIndex: 1,
        explanation:
          "La soglia psicologica corretta si individua tracciando la linea al 50% di una zona di domanda/offerta o inefficienza, accertando che coincida con un prezzo tondo (.00, .50, .05, 10).",
      },
      {
        id: "q-sog-2",
        question: "Quale condizione invalida la strategia della soglia psicologica sul 50% della zona?",
        options: [
          "Il volume della sessione è troppo basso.",
          "La linea del 50% non coincide con alcun prezzo o numero tondo significativo.",
          "Il trade dura più di 15 minuti.",
        ],
        correctIndex: 1,
        explanation:
          "Se il 50% non corrisponde a un prezzo tondo istituzionale, la convergenza psicologica non è soddisfatta.",
      },
      {
        id: "q-sog-3",
        question: "Qual è il vantaggio primario dell'ingresso sulla soglia al 50% rispetto agli estremi della zona?",
        options: [
          "Garantisce un win rate del 100% in qualunque sessione.",
          "Permette un rapporto rischio/rendimento marcatamente superiore con stop loss chirurgico.",
          "Elimina completamente la necessità di impostare uno stop loss.",
        ],
        correctIndex: 1,
        explanation:
          "Entrare sulla soglia mediana al 50% consente di ridurre l'ampiezza dello stop loss e moltiplicare l'R:R potenziale.",
      },
    ],
  },

  // ─── TOMO II: VOLUME PROFILE & ORDER FLOW ────────────────────────────────────
  {
    id: "tomo-volume-profile",
    roman: "TOMO II",
    tomeNumber: 2,
    title: "L'Anatomia Volumetrica & Order Flow Istituzionale",
    subtitle: "Profili P/b/D, Point of Control (POC), Barre Volumetriche e Assorbimenti",
    targetGrade: 2,
    targetGradeName: "Il Custode della Regola",
    slidesCount: 47,
    badge: "Dinamica dei Flussi",
    conceptSummary:
      "Il Volume Profile non è un indicatore ritardato, ma la mappa dello sbilanciamento reale tra acquirenti e venditori. Le forme a lettera (P-shape per short-covering/accumulazione, b-shape per long-liquidation/distribuzione, D-shape per rotazione di consenso) permettono di identificare dove il capitale dominante difende il proprio posizionamento.",
    rulesOfEngagement: [
      {
        ruleCode: "VOL-01",
        title: "Decodifica Morfologica P-Shape",
        instruction: "Identificare la concentrazione volumetrica nella parte superiore del range dopo una spinta impulsiva.",
        axiom: "Il P-Shape segnala assorbimento rialzista o ricopertura di posizioni corte: pullback sul POC per ingresso long.",
      },
      {
        ruleCode: "VOL-02",
        title: "Decodifica Morfologica b-Shape",
        instruction: "Identificare il rigonfiamento volumetrico alla base della sessione dopo un forte impulso ribassista.",
        axiom: "Il b-Shape segnala liquidazione forzata di buyer: retest del POC inferiore per continuazione ribassista.",
      },
      {
        ruleCode: "VOL-03",
        title: "Il Valore Sovrano del POC & Value Area",
        instruction: "Tracciare il POC (Point of Control) e i confini VAH/VAL (Value Area 70%) come aree di reiezione.",
        axiom: "I prezzi esterni alla Value Area sono considerati iniqui dal mercato e tendono a essere respinti violentemente verso il POC.",
      },
    ],
    marketMechanics: [
      {
        label: "P-Shape",
        detail: "Profilo a forma di P: volumi alti in alto, bassi in basso. Tipico di espansioni rialziste sostenute da short-covering.",
      },
      {
        label: "b-Shape",
        detail: "Profilo a forma di b: volumi alti in basso, bassi in alto. Tipico di liquidazione acquirenti e continuazione short.",
      },
      {
        label: "D-Shape",
        detail: "Profilo a campana simmetrica (gaussiana): mercato in perfetto equilibrio, ideale per operare fade agli estremi VAH/VAL.",
      },
    ],
    chartDiagram: {
      diagramType: "volume_profile_shapes",
      caption: "Trittico Morfologico del Volume Profile: P-Shape, D-Shape e b-Shape con POC",
      keyPoints: [
        "P-Shape: POC in alto, thin profile alla base (bias rialzista)",
        "D-Shape: POC centrale, campana simmetrica (rotazione di range)",
        "b-Shape: POC in basso, thin profile in alto (bias ribassista)",
      ],
    },
    examQuestions: [
      {
        id: "q-vol-1",
        question: "Cosa indica un profilo di volume con morfologia «P-Shape»?",
        options: [
          "Un mercato privo di partecipanti e in chiusura di sessione.",
          "Concentrazione volumetrica elevata nella parte alta, sintomo di short-covering o forte interesse acquirente.",
          "Un forte crollo imminente con rottura di tutti i minimi.",
        ],
        correctIndex: 1,
        explanation:
          "La conformazione P-Shape denota accumulo di scambi nella parte superiore dopo un rally, con volumi sottili alla base.",
      },
      {
        id: "q-vol-2",
        question: "Qual è il comportamento statistico atteso quando il prezzo esce temporaneamente dalla Value Area (70%) in un profilo D-Shape?",
        options: [
          "Il prezzo accelera all'infinito senza mai ritornare.",
          "Il prezzo viene percepito come iniquo e tende a essere respinto verso il Point of Control (POC).",
          "Il broker cancella gli ordini a mercato.",
        ],
        correctIndex: 1,
        explanation:
          "In una giornata a D-Shape (rotazionale), i test fuori da VAH/VAL senza volume di accompagnamento subiscono un rigetto verso il POC.",
      },
      {
        id: "q-vol-3",
        question: "Cosa indicano le barre volumetriche con forte squilibrio (imbalance) tra acquirenti e venditori?",
        options: [
          "L'impronta reale del controllo direzionale degli attori istituzionali aggressivi.",
          "Una fluttuazione casuale generata dallo spread.",
          "Che è obbligatorio operare controtrend.",
        ],
        correctIndex: 0,
        explanation:
          "Le barre volumetriche espongono lo sbilanciamento reale e permettono di determinare chi ha il controllo aggressivo del flusso.",
      },
    ],
  },

  // ─── TOMO III: ASIAN RANGE STRATEGY ──────────────────────────────────────────
  {
    id: "tomo-asian-range",
    roman: "TOMO III",
    tomeNumber: 3,
    title: "L'Arte dell'Assedio Asiatico (Asian Range Strategy)",
    subtitle: "Cartografia Tokyo/Sydney, Trappola di Londra, Sweep degli Estremi e Kill-Zone",
    targetGrade: 3,
    targetGradeName: "L'Osservatore Sovrano",
    slidesCount: 43,
    badge: "Session Timing",
    conceptSummary:
      "La sessione asiatica costruisce il corridoio di liquidità che la City di Londra utilizzerà per finanziare le proprie posizioni. Il setup cardine prevede l'attesa dello sweep di Asian High o Asian Low durante la Kill-Zone di apertura europea, seguito dal rientro violento nel range e trigger confermato su timeframe veloci M5/M1.",
    rulesOfEngagement: [
      {
        ruleCode: "ASIA-01",
        title: "Cartografia del Box Asiatico",
        instruction: "Tracciare il massimo e il minimo assoluti della sessione asiatica (00:00–07:00/08:00 UTC).",
        axiom: "L'Asian Range è la riserva di liquidità che il mercato europeo saccheggia sistematicamente nei primi 90 minuti.",
      },
      {
        ruleCode: "ASIA-02",
        title: "Regola della Falsa Rottura (London Sweep)",
        instruction: "Mai comprare la rottura rialzista o vendere la rottura ribassista dell'Asian Range all'apertura di Londra.",
        axiom: "La prima rottura delle 08:00–09:00 UTC è al 70% un tranello istituzionale per raccogliere gli stop retail.",
      },
      {
        ruleCode: "ASIA-03",
        title: "Trigger di Rientro & Target Opposto",
        instruction: "Attendere il rigetto e la chiusura della candela M5/M15 all'interno dell'Asian Range: target l'estremo opposto.",
        axiom: "Lo sweep dell'Asia High attiva il targeting dell'Asia Low e viceversa.",
      },
    ],
    marketMechanics: [
      {
        label: "Fase 1: Costruzione",
        detail: "Sessione asiatica con volatilità contenuta e range compatto ben definito.",
      },
      {
        label: "Fase 2: Manipolazione",
        detail: "Apertura di Londra (London Open): violazione decisa di Asian High o Asian Low per indurre breakout retail.",
      },
      {
        label: "Fase 3: Distribuzione",
        detail: "Rifiuto volumetrico istituzionale, cambio di carattere (CHoCH) e corsa verso la liquidità opposta.",
      },
    ],
    chartDiagram: {
      diagramType: "asian_range_sweep",
      caption: "Meccanica dell'Asian Range Sweep: Falsa Rottura di Londra e Inversione verso l'Estremo Opposto",
      keyPoints: [
        "Definizione Asian High & Asian Low (00:00–08:00 UTC)",
        "Sweep di Asian High all'apertura europea con cattura stop retail",
        "Rientro rapido nel box e accelerazione short verso Asian Low",
      ],
    },
    examQuestions: [
      {
        id: "q-asia-1",
        question: "Cosa rappresenta statisticamente l'Asian Range per gli operatori della sessione europea?",
        options: [
          "Un trend forte e consolidato da inseguire a leva massima.",
          "Un bacino di liquidità i cui estremi vengono manipolati per raccogliere ordini prima del vero movimento.",
          "Una sessione ininfluente che non viene considerata dai market maker.",
        ],
        correctIndex: 1,
        explanation:
          "Gli estremi dell'Asian Range ospitano la maggior parte degli stop loss retail, fungendo da carburante per l'apertura di Londra.",
      },
      {
        id: "q-asia-2",
        question: "Cosa deve attendere l'operatore dopo che il prezzo ha violato al rialzo l'Asian High a Francoforte/Londra?",
        options: [
          "Comprare immediatamente a mercato sperando in un'ulteriore salita.",
          "Attendere la reiezione e il rientro con chiusura confermata all'interno del box asiatico per cercare l'ingaggio short.",
          "Spegnere il computer e non operare per una settimana.",
        ],
        correctIndex: 1,
        explanation:
          "La conferma operativa si manifesta con il rigetto e la richiusura all'interno del range asiatico, invalidando la trappola rialzista.",
      },
      {
        id: "q-asia-3",
        question: "Qual è il target primario naturale dopo uno sweep confermato dell'Asian High?",
        options: [
          "Il massimo del mese precedente.",
          "L'Asian Low (estremo opposto del range) e relative inefficienze sottostanti.",
          "Il prezzo di apertura di Wall Street alle 15:30.",
        ],
        correctIndex: 1,
        explanation:
          "Il protocollo stabilisce che la liquidità prelevata da un estremo spinge il mercato a consumare la liquidità dell'estremo opposto.",
      },
    ],
  },

  // ─── TOMO IV: IL CICLO DI MERCATO & METODOLOGIE BANCARIE ─────────────────────
  {
    id: "tomo-ciclo-mercato",
    roman: "TOMO IV",
    tomeNumber: 4,
    title: "Il Ciclo di Mercato & Le Metodologie Bancarie",
    subtitle: "Distribuzione, Mark-Up, Mark-Down, Re-Accumulazione e la Ruota Emotiva Retail",
    targetGrade: 4,
    targetGradeName: "L'Architetto del Reale",
    slidesCount: 40,
    badge: "Ingegneria Istituzionale",
    conceptSummary:
      "Le banche centrali e i grandi operatori istituzionali non scommettono: muovono la liquidità attraverso 4 fasi cicliche ferree (Accumulazione, Mark-Up, Distribuzione, Mark-Down). Per completare tali manovre manipolano sistematicamente la psicologia di massa (Euforia, Ansia, Negazione, Panico) inducendo i partecipanti retail a comprare sui massimi e vendere sul fondo del barile.",
    rulesOfEngagement: [
      {
        ruleCode: "BAN-01",
        title: "Riconoscimento della Fase di Accumulazione",
        instruction: "Individuare compressioni prolungate con volumi decrescenti seguite da spring / sweep finale sui minimi.",
        axiom: "Le mani forti comprano nell'indifferenza e nel pessimismo generale, quando la massa crede in un crollo continuo.",
      },
      {
        ruleCode: "BAN-02",
        title: "Decodifica della Trappola dell'Euforia (Distribuzione)",
        instruction: "Non comprare mai candele estese e breakout verticali accompagnati da notizie ultra-ottimistiche sui media.",
        axiom: "La fase di Euforia è la finestra in cui il capitale istituzionale vende le proprie quote ai retail in FOMO.",
      },
      {
        ruleCode: "BAN-03",
        title: "Allineamento alla Re-Accumulazione",
        instruction: "Attendere che il Mark-Up crei una struttura di continuazione con assorbimento dell'offerta prima dell'ingresso.",
        axiom: "L'Architetto non cerca di indovinare i minimi assoluti: sale a bordo quando la mano istituzionale ha confermato il mark-up.",
      },
    ],
    marketMechanics: [
      {
        label: "1. Accumulazione",
        detail: "Fase silenziosa a prezzi bassi: assorbimento metodico dell'offerta senza destare clamore.",
      },
      {
        label: "2. Mark-Up",
        detail: "Fase di espansione rialzista controllata: attrazione progressiva dell'attenzione retail.",
      },
      {
        label: "3. Distribuzione",
        detail: "Fase di liquidazione ai massimi: euforia mediatica, notizie positive e passaggio del cerino ai retail.",
      },
      {
        label: "4. Mark-Down",
        detail: "Fase di crollo e panico: discesa rapida verso i nuovi minimi di acquisto per il ciclo successivo.",
      },
    ],
    chartDiagram: {
      diagramType: "wyckoff_phases",
      caption: "Ciclo Completo di Mercato Istituzionale: Le 4 Fasi Sovrane e la Risposta Emotiva Retail",
      keyPoints: [
        "Accumulo (Pessimismo) -> Mark-Up (Speranza/Ottimismo)",
        "Distribuzione (Euforia e Trappola ai massimi) -> Mark-Down (Panico e Liquidazioni)",
        "Re-Accumulazione intermedia lungo il trend primario",
      ],
    },
    examQuestions: [
      {
        id: "q-ban-1",
        question: "Cosa accade tipicamente durante la fase di «Distribuzione» istituzionale?",
        options: [
          "Le grandi istituzioni accumulano posizioni di lungo termine a sconto.",
          "Gli operatori istituzionali vendono le proprie posizioni a prezzi massimi ai trader retail attirati dall'euforia.",
          "I market maker spengono i server per manutenzione.",
        ],
        correctIndex: 1,
        explanation:
          "La distribuzione è la fase in cui il capitale dominante cede le sue quote alla folla in preda a FOMO ed euforia.",
      },
      {
        id: "q-ban-2",
        question: "In quale stato emotivo della massa si concentrano le migliori opportunità di acquisto istituzionale?",
        options: [
          "Euforia ed esaltazione cieca.",
          "Depressione, pessimismo e panico conclamato (svendita forzata).",
          "Noia assoluta durante la chiusura del fine settimana.",
        ],
        correctIndex: 1,
        explanation:
          "Le istituzioni necessitano del panico retail per assorbire grandi volumi di vendita a prezzi scontati senza far salire il prezzo.",
      },
      {
        id: "q-ban-3",
        question: "Cosa contraddistingue una «Re-Accumulazione» da una vera e propria Distribuzione di picco?",
        options: [
          "L'assenza di candele rosse sul grafico.",
          "Il mantenimento della struttura rialzista di fondo con volumi che calano nei ritracciamenti e rigetto dei minimi chiave.",
          "Il fatto che avvenga solo nei giorni festivi.",
        ],
        correctIndex: 1,
        explanation:
          "La re-accumulazione consolida i guadagni del mark-up precedente senza rompere la struttura primaria, preparando la gamba successiva.",
      },
    ],
  },

  // ─── TOMO V: GEOPOLITICA DEI BRICS & L'IMPERO DELL'ORO ───────────────────────
  {
    id: "tomo-brics-oro",
    roman: "TOMO V",
    tomeNumber: 5,
    title: "L'Impero dell'Oro & La Geopolitica dei BRICS (XAU/USD)",
    subtitle: "De-dollarizzazione, Riserve Auree Sovrane, Treasury USA e Ciclo Monetario Globale",
    targetGrade: 5,
    targetGradeName: "Il Fondatore d'Eredità",
    slidesCount: 27,
    badge: "Macro Sovrana",
    conceptSummary:
      "Le dinamiche dell'Oro (XAU/USD) non rispondono unicamente ai tassi reali della Federal Reserve, ma all'epocale transizione geopolitica guidata dai paesi BRICS (Brasile, Russia, India, Cina, Sudafrica). La de-dollarizzazione e l'acquisto record di riserve auree fisiche da parte delle banche centrali orientali per sganciarsi dai Treasury statunitensi pongono le basi di un trend rialzista secolare.",
    rulesOfEngagement: [
      {
        ruleCode: "ORO-01",
        title: "Monitoraggio delle Riserve di Valuta BRICS",
        instruction: "Monitorare gli acquisti netti di oro delle banche centrali (PBoC, Banca di Russia) trimestralmente.",
        axiom: "Quando le banche centrali convertono le eccedenze commerciali da dollari USA in oro fisico, si crea un pavimento di prezzo invalicabile.",
      },
      {
        ruleCode: "ORO-02",
        title: "Divergenza Rendimenti Treasury vs Gold",
        instruction: "Verificare quando l'Oro continua a salire nonostante tassi USA alti: sintomo di accumulo sovrano strategico.",
        axiom: "Una divergenza rialzista tra XAU/USD e rendimenti reali indica sfiducia sistemica verso il debito denominato in USD.",
      },
      {
        ruleCode: "ORO-03",
        title: "Gestione Posizioni a Moltiplicatore Patrimoniale",
        instruction: "Utilizzare le correzioni strutturali sui timeframe Daily/H4 dell'Oro per posizionamenti swing di lungo raggio.",
        axiom: "L'Oro è la valuta suprema che non ha rischio di controparte: chi accumula con il tempo sovrano vince la battaglia monetaria.",
      },
    ],
    marketMechanics: [
      {
        label: "Diversificazione Riserve",
        detail: "I paesi BRICS riducono la quota di titoli di stato americani (Treasuries) convertendo il surplus in lingotti fisici allocati.",
      },
      {
        label: "Regolamento Bilaterale",
        detail: "Crescente utilizzo di valute locali e oro come garanzia negli scambi commerciali energetici (petrolio e gas).",
      },
      {
        label: "Driver Inflattivo & Debito",
        detail: "La traiettoria esponenziale del debito pubblico occidentale rende l'oro il bene rifugio primario contro la svalutazione monetaria.",
      },
    ],
    chartDiagram: {
      diagramType: "brics_gold_macro",
      caption: "L'Asse Geopolitico dell'Oro: Flusso delle Riserve dai Treasury USA all'Accumulazione BRICS",
      keyPoints: [
        "Transizione da USD Treasury a Riserve Auree Fisiche (PBoC & Central Banks)",
        "Supporto Strutturale di Lungo Termine su XAU/USD",
        "Convergenza Macro: Debito Globale vs Scarsità Assoluta dell'Oro",
      ],
    },
    examQuestions: [
      {
        id: "q-oro-1",
        question: "Per quale motivo cruciale i paesi BRICS stanno incrementando sistematicamente le loro riserve auree?",
        options: [
          "Per rivendere l'oro sul mercato retail la settimana successiva.",
          "Per diversificare gli asset strategici riducendo la dipendenza dal dollaro USA e dai titoli del debito americano.",
          "Perché l'oro è un metallo utilizzato esclusivamente nell'industria automobilistica.",
        ],
        correctIndex: 1,
        explanation:
          "La motivazione geopolitica primaria è la de-dollarizzazione e la protezione delle riserve nazionali dal rischio di sanzioni o svalutazione.",
      },
      {
        id: "q-oro-2",
        question: "Cosa segnala un mercato in cui l'Oro (XAU/USD) sale con forza nonostante il dollaro (DXY) o i tassi USA siano elevati?",
        options: [
          "Un errore nei feed dei grafici di TradingView.",
          "Una domanda geopolitica e istituzionale sovrana così potente da sopraffare la correlazione monetaria tradizionale.",
          "Che è opportuno aprire posizioni short a leva massima.",
        ],
        correctIndex: 1,
        explanation:
          "Le divergenze con il dollaro segnalano acquisti sovrani pesanti (central banks) che comprano oro a prescindere dal costo opportunità dei tassi.",
      },
      {
        id: "q-oro-3",
        question: "Quale approccio operativo è consigliato per il Grado V su XAU/USD alla luce delle dinamiche macroeconomiche?",
        options: [
          "Scalping frenetico da 10 secondi senza seguire la tendenza macro.",
          "Accumulazione swing su pullback e zone di valore sui timeframe Daily/H4 in allineamento al trend secolare.",
          "Evitare completamente di negoziare materie prime.",
        ],
        correctIndex: 1,
        explanation:
          "Il Fondatore d'Eredità sfrutta le inefficienze e i ritracciamenti di breve per posizionamenti swing ad alto moltiplicatore sul macro trend.",
      },
    ],
  },
] as const;

// ─── GRANDI TRATTATI & MANUALI TECNICI DEL MENTORE ───────────────────────────

export interface MentorManualChapter {
  id: string;
  chapterNumber: number;
  title: string;
  summary: string;
  keyTakeaways: string[];
  operationalRules: {
    code: string;
    title: string;
    instruction: string;
  }[];
}

export interface MentorMasterManual {
  id: string;
  manualCode: string;
  title: string;
  subtitle: string;
  sourceDocument: string;
  readingTime: string;
  chaptersCount: number;
  coreThesis: string;
  badge: string;
  probabilityWeight?: string;
  chapters: MentorManualChapter[];
}

// ─── LABORATORIO ACCADEMICO DI RICERCA: LE 7 TESI DA TESTARE NELLA FORGIA ─────

export const ACADEMIC_DISCLAIMER_TEXT =
  "I contenuti presentati hanno finalità esclusivamente accademica, didattica e di ricerca quantitativa retrospettiva. Nessuna tesi, modello o criterio costituisce sollecitazione al pubblico risparmio né consulenza finanziaria personalizzata. I concetti illustrati rappresentano ipotesi statistiche da sottoporre a rigorosa simulazione e campionamento storico nella Forgia del Passato (Backtesting)." as const;

export interface CurriculumThesisQuestion {
  id: string;
  question: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
  points: number; // typically 20 points
  explanation: string;
  methodologicalTip: string;
}

export interface CurriculumThesis {
  id: string;
  stageNumber: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  roman: "TESI I" | "TESI II" | "TESI III" | "TESI IV" | "TESI V" | "TESI VI" | "TESI VII";
  title: string;
  subtitle: string;
  logicalThread: string;
  associatedGradeLevel: 1 | 2 | 3 | 4 | 5;
  associatedGradeTitle: string;
  badge: string;
  timeframeFocus: string;
  suggestedSampleSize: string;
  theoreticalCore: string;
  forgeTestingProtocol: {
    stepNumber: number;
    title: string;
    directive: string;
  }[];
  metricsToRecord: {
    metricName: string;
    purpose: string;
  }[];
  diagramType:
    | "mindset_bias"
    | "soglie_50"
    | "volume_profile_shapes"
    | "asian_range_sweep"
    | "wyckoff_phases"
    | "brics_gold_macro"
    | "confluence_audit";
  diagramCaption: string;
  diagramKeyPoints: string[];
  quizQuestions: CurriculumThesisQuestion[];
}

export interface BacktestAuditCriterion {
  id: string;
  code: string;
  variableName: string;
  hypothesisDescription: string;
  probabilityWeight: number; // e.g. 60 for 60%
  forgeTestProtocol: string;
  verificationMetric: string;
}

export const MENTOR_BACKTEST_AUDIT_CRITERIA: readonly BacktestAuditCriterion[] = [
  {
    id: "audit-macro",
    code: "VAR-MACRO-60",
    variableName: "Variabile 1: Bias Macroeconomico di Fondo",
    hypothesisDescription: "Verificare se i movimenti di espansione allineati alla politica monetaria della banca centrale presentano una deviazione media favorevole superiore del 60% rispetto a quelli contro-trend.",
    probabilityWeight: 60,
    forgeTestProtocol: "Isolare 50 campioni storici distinguendo tra sessioni coerenti con la direzione dei tassi reali e sessioni divergenti.",
    verificationMetric: "Rapporto di percorrenza (Gain/Loss ratio medio) nei campioni concordi vs discordi.",
  },
  {
    id: "audit-scompensi",
    code: "VAR-SCOMP-55",
    variableName: "Variabile 2: Scompensi di Brevissimo Termine (BBT)",
    hypothesisDescription: "Verificare l'ipotesi che il mercato riassorba almeno il 50% delle inefficienze generate dagli ultimi due movimenti strutturali prima di creare nuovi massimi o minimi.",
    probabilityWeight: 55,
    forgeTestProtocol: "Tracciare gli scompensi microscopici su timeframe M5/M15 e registrare quante volte il prezzo effettua la mitigazione entro 24-48 ore.",
    verificationMetric: "Tasso percentuale di mitigazione entro le prime 2 sessioni successive.",
  },
  {
    id: "audit-wyckoff-ciclo",
    code: "VAR-WYCK-CICLO-65",
    variableName: "Variabile 3: Rottura Strutturale con Scompenso",
    hypothesisDescription: "Testare la differenza tra rotture strutturali accompagnate da forte scompenso volumetrico rispetto a rotture prive di sbilanciamento.",
    probabilityWeight: 65,
    forgeTestProtocol: "Confrontare 30 breakout con FVG d'impulso rispetto a 30 breakout a volume ridotto, misurando la percentuale di falsi segnali.",
    verificationMetric: "Percentuale di prosecuzione direzionale confermata (Success Rate).",
  },
  {
    id: "audit-wyckoff-schema",
    code: "VAR-WYCK-SCHEMA-60",
    variableName: "Variabile 4: Validazione Fasi Wyckoff (Spring / UTAD)",
    hypothesisDescription: "Misurare l'affidabilità statistica del test di Fase C (Spring o UTAD) quando atteso dopo una compressione orizzontale in Fase B.",
    probabilityWeight: 60,
    forgeTestProtocol: "Catalogare 30 pattern di Spring/UTAD in simulazione e verificare se il Last Point of Support (LPS) offre un R:R simulato superiore a 1:3.",
    verificationMetric: "Rapporto R:R medio simulato e frequenza di stop hunting prima dell'inversione.",
  },
  {
    id: "audit-volume-profile",
    code: "VAR-VOL-40",
    variableName: "Variabile 5: POC e Value Area (70%)",
    hypothesisDescription: "Verificare se i ritorni verso il Point of Control (POC) di una giornata a campana (D-Shape) presentano una probabilità di rotazione superiore al 65%.",
    probabilityWeight: 40,
    forgeTestProtocol: "Selezionare 40 giornate rotazionali e misurare quante volte il prezzo, uscendo dalla Value Area, rigetta gli estremi tornando sul POC.",
    verificationMetric: "Frequenza di reiezione VAH/VAL e tempo mediano di rientro verso il POC.",
  },
  {
    id: "audit-sessione-asiatica",
    code: "VAR-ASIA-40",
    variableName: "Variabile 6: Asian Box & Estensione 1.27",
    hypothesisDescription: "Testare l'ipotesi che l'estensione 1.27 dell'Asian Range rappresenti il punto di esaurimento della manipolazione europea di apertura.",
    probabilityWeight: 40,
    forgeTestProtocol: "Tracciare il box 00:00-08:00 UTC su EURUSD e GBPUSD per 60 sessioni consecutive; contare quante volte l'inversione avviene tra 1.00 e 1.27 di estensione.",
    verificationMetric: "Percentuale di reazioni confermate entro l'estensione 1.27 e durata del magnete a 5 giorni sui 50% scoperti.",
  },
  {
    id: "audit-inefficienza",
    code: "VAR-INEFF-50",
    variableName: "Variabile 7: Magnete delle Inefficienze Non Mitigate",
    hypothesisDescription: "Misurare l'attrazione gravitazionale esercitata dai Fair Value Gap non mitigati al 50% entro un arco di 5 giornate di contrattazione.",
    probabilityWeight: 50,
    forgeTestProtocol: "Mappare tutti i gap non colmati su grafico H1 e cronometrare il numero di candele necessarie per il tocco della linea mediana.",
    verificationMetric: "Probabilità cumulata di test del 50% entro 120 ore di mercato.",
  },
] as const;

export const AUREUS_RESEARCH_THESES: readonly CurriculumThesis[] = [
  // ─── TESI I: IL MINDSET SCIENTIFICO & METODOLOGIA DEL BACKTEST ──────────────
  {
    id: "tesi-1-mindset-statistico",
    stageNumber: 1,
    roman: "TESI I",
    title: "Il Mindset Scientifico & La Disciplina della Simulazione",
    subtitle: "Dall'Illusione del Controllo all'Audit Empirico Privo di Bias",
    logicalThread:
      "Prima di tracciare una sola linea sui grafici, lo studente deve comprendere che i mercati non si prevedono: si testano. Senza un protocollo scientifico di registrazione, la mente umana cade vittima dell'illusione di pattern inesistenti e del bias di conferma.",
    associatedGradeLevel: 1,
    associatedGradeTitle: "Novizio Consapevole",
    badge: "Metodologia Empirica",
    timeframeFocus: "Qualsiasi Timeframe Storico",
    suggestedSampleSize: "30 Sessioni di Campionamento Guidato",
    theoreticalCore:
      "Ogni modello analitico è una mera ipotesi probabilistica. Il ricercatore non cerca di 'avere ragione', ma misura in modo impassibile quanti eventi soddisfano la condizione rispetto al totale dei casi campionati. La tenuta del diario di simulazione è il fondamento della sopravvivenza metodologica.",
    forgeTestingProtocol: [
      {
        stepNumber: 1,
        title: "Definizione dell'Ambiente di Test",
        directive: "Selezionare una coppia storica (es. EURUSD o GBPUSD) e bloccare un periodo passato di almeno 6 mesi a barre nascoste (Replay Mode).",
      },
      {
        stepNumber: 2,
        title: "Regola di Registrazione Senza Bias",
        directive: "Annotare ogni evento prima di avanzare la barra: impedire a se stessi di modificare l'ipotesi col senno di poi.",
      },
      {
        stepNumber: 3,
        title: "Audit della Consistenza Emotiva",
        directive: "Valutare se la simulazione suscita fretta o desiderio di 'vincere': l'obiettivo del laboratorio è unicamente la raccolta dei dati.",
      },
    ],
    metricsToRecord: [
      { metricName: "Campione Rilevato", purpose: "Numero totale di eventi analizzati senza eccezioni." },
      { metricName: "Frequenza di Invalidazione", purpose: "Percentuale di casi in cui il modello non si è manifestato." },
      { metricName: "Indice di Conformità al Protocollo", purpose: "Misura dell'aderenza rigorosa alle regole prefissate." },
    ],
    diagramType: "mindset_bias",
    diagramCaption: "Il Ciclo del Metodo Scientifico: Ipotesi -> Simulazione Storica -> Registrazione -> Valutazione Statistica",
    diagramKeyPoints: [
      "Formulazione oggettiva dell'ipotesi a barre coperte",
      "Divieto di modificare le regole durante il campionamento",
      "Misurazione del campione minimo (almeno 30 eventi)",
    ],
    quizQuestions: [
      {
        id: "q-t1-1",
        question: "Qual è lo scopo primario dell'attività di simulazione storica (backtesting) secondo il metodo AUREUS?",
        options: [
          "Cercare di indovinare dove andrà il prezzo domani per operare subito a mercato.",
          "Verificare empiricamente su un campione statistico la robustezza e l'affidabilità di un'ipotesi senza rischiare capitale.",
          "Trovare una formula magica che non perda mai.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Il backtesting è un laboratorio scientifico volto a misurare le probabilità oggettive di un'ipotesi teorica, isolando i dati dal bias emotivo.",
        methodologicalTip: "Tratta ogni test come un esperimento di laboratorio con variabili controllate.",
      },
      {
        id: "q-t1-2",
        question: "Cosa si intende per 'bias del senno di poi' (hindsight bias) durante l'analisi dei grafici passati?",
        options: [
          "L'incapacità di leggere i dati storici a causa di uno schermo a bassa risoluzione.",
          "L'illusione cognitiva per cui un movimento passato sembrava ovvio o inevitabile, alterando la percezione della vera incertezza del momento.",
          "La perdita di connessione internet durante la simulazione.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Col grafico già disegnato tutto appare scontato; per questo la simulazione scientifica esige la modalità Replay a barre coperte.",
        methodologicalTip: "Avanza sempre una candela alla volta senza sbirciare il futuro.",
      },
      {
        id: "q-t1-3",
        question: "Qual è il campione minimo consigliato per iniziare a considerare rilevante un'osservazione statistica?",
        options: [
          "2 o 3 trade andati bene di fila.",
          "Almeno 30–50 rilevazioni uniformi raccolte nello stesso contesto di mercato.",
          "Un solo grafico osservato su Instagram.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Campioni inferiori a 30 unità sono soggetti a varianza casuale e non hanno alcun valore statistico.",
        methodologicalTip: "Non trarre conclusioni prima di aver catalogato almeno 30 occorrenze identiche.",
      },
      {
        id: "q-t1-4",
        question: "Per quale motivo AUREUS vieta categoricamente le checklist pre-trade con consigli di acquisto/vendita?",
        options: [
          "Perché il software non è in grado di calcolare percentuali.",
          "Perché AUREUS è una piattaforma didattica e di ricerca scientifica: non fornisce consulenza finanziaria né sollecitazione agli investimenti.",
          "Perché i mercati chiudono il venerdì sera.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "La conformità etica e normativa impone la netta distinzione tra formazione accademica e consulenza finanziaria personalizzata.",
        methodologicalTip: "Studia per comprendere la meccanica, non per seguire passivamente dei segnali.",
      },
      {
        id: "q-t1-5",
        question: "Cosa deve fare il ricercatore quando una serie di test simulati produce risultati negativi?",
        options: [
          "Cancellare il diario e far finta che non sia successo nulla.",
          "Analizzare con distacco i dati, verificare se le regole sono state applicate correttamente e considerare l'ipotesi non validata.",
          "Aumentare la leva nel simulatore per recuperare in fretta.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Nel metodo scientifico, un'ipotesi che fallisce il test è un dato prezioso che evita di perdere tempo e risorse su modelli inefficaci.",
        methodologicalTip: "I test negativi sono importanti quanto quelli positivi: eliminano i vicoli ciechi.",
      },
    ],
  },

  // ─── TESI II: IL MODELLO DELLE SOGLIE MEDIANE 50% & INEFFICIENZE ─────────────
  {
    id: "tesi-2-soglie-50",
    stageNumber: 2,
    roman: "TESI II",
    title: "Il Modello delle Soglie Mediane 50% & Inefficienze",
    subtitle: "Ipotesi di Riequilibrio del Prezzo su Livelli Tondi e Fair Value Gap",
    logicalThread:
      "Una volta acquisito il metodo di test, si analizza la prima coordinata geometrica del grafico: la tendenza del prezzo a riequilibrare le zone di vuoto volumetrico (Fair Value Gap) esattamente al 50%, in presenza di numeri tondi istituzionali.",
    associatedGradeLevel: 1,
    associatedGradeTitle: "Novizio Consapevole",
    badge: "Geometria del Prezzo",
    timeframeFocus: "M15 / H1",
    suggestedSampleSize: "50 Inefficienze Campionate",
    theoreticalCore:
      "L'ipotesi teorica postula che un'area di squilibrio tra compratori e venditori (imbalance) non venga mitigata agli estremi casuali, ma trovi la massima densità di riequilibrio istituzionale sulla sua linea mediana (50%), purché quest'ultima converga con una cifra tonda (.00, .50).",
    forgeTestingProtocol: [
      {
        stepNumber: 1,
        title: "Mappatura dell'Inefficienza",
        directive: "Identificare una candela ad ampia espansione con gap visibile tra l'ombra della candela 1 e l'ombra della candela 3 su timeframe M15.",
      },
      {
        stepNumber: 2,
        title: "Calcolo Mediano del 50%",
        directive: "Tracciare la linea del 50% esatto del gap e verificare se si trova a meno di 2-3 pip da un livello a cifra tonda.",
      },
      {
        stepNumber: 3,
        title: "Rilevazione della Reazione Retrospettiva",
        directive: "Misurare se il prezzo, al successivo test retrospettivo, mostra una candela di rifiuto (wick) prima di invertire la rotta.",
      },
    ],
    metricsToRecord: [
      { metricName: "Tasso di Tocco del 50%", purpose: "Percentuale di FVG che raggiungono la mezzeria." },
      { metricName: "Efficacia del Livello Tondo", purpose: "Differenza di rigetto tra 50% con numero tondo vs senza numero tondo." },
      { metricName: "Massima Escursione Favorevole (MFE)", purpose: "Ampiezza del rimbalzo dopo il contatto con la soglia." },
    ],
    diagramType: "soglie_50",
    diagramCaption: "Anatomia dell'Ipotesi 50%: L'Area FVG, la Linea Mediana e la Convergenza con il Prezzo Tondo",
    diagramKeyPoints: [
      "Riconoscimento oggettivo del gap volumetrico tra le ombre",
      "Taglio matematico al 50% del range dell'inefficienza",
      "Filtro di convergenza con la cifra tonda (.00 o .50)",
    ],
    quizQuestions: [
      {
        id: "q-t2-1",
        question: "Come viene formulata l'ipotesi teorica della soglia psicologica al 50%?",
        options: [
          "Che il prezzo inverta sempre su qualsiasi candela verde dopo 5 minuti.",
          "Che il prezzo tenda a riequilibrare un'inefficienza di mercato testando la sua linea mediana (50%), con maggiore reattività se coincide con un numero tondo.",
          "Che la media mobile a 50 periodi sia l'unico indicatore affidabile.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "La tesi sostiene che la mezzeria di una zona di squilibrio rappresenti il punto di equilibrio contabile tra domanda e offerta istituzionale.",
        methodologicalTip: "Verifica sul grafico che la linea tagli esattamente a metà il corpo dell'inefficienza.",
      },
      {
        id: "q-t2-2",
        question: "Durante il protocollo di test nella Forgia, cosa invalida a priori l'ipotesi della soglia psicologica?",
        options: [
          "La presenza di un volume alto sul broker.",
          "Il fatto che la linea mediana del 50% non coincida né sia vicina ad alcun numero o frazione tonda (.00, .50).",
          "Il fatto che la sessione sia quella pomeridiana.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Senza il supporto della soglia psicologica tonda, il livello mediano perde il fattore di convergenza istituzionale previsto dal modello.",
        methodologicalTip: "Scarta i casi in cui il 50% cade su frazioni decimali arbitrarie privi di round numbers.",
      },
      {
        id: "q-t2-3",
        question: "Cosa misura la metrica MFE (Maximum Favorable Excursion) in un test di reazione sulla soglia 50%?",
        options: [
          "Il numero di volte in cui il computer si è spento.",
          "La massima distanza favorevole percorsa dal prezzo dopo aver toccato la soglia prima di invertire nuovamente.",
          "Il costo delle commissioni pagate al simulatore.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "La MFE consente di quantificare l'ampiezza media del movimento generato dal rimbalzo per valutare se il R:R teorico è vantaggioso.",
        methodologicalTip: "Annota sempre i pip massimi raggiunti dal rimbalzo.",
      },
      {
        id: "q-t2-4",
        question: "Perché è metodologicamente errato anticipare l'arrivo sulla soglia prima che il prezzo l'abbia effettivamente toccata?",
        options: [
          "Perché il test risulterebbe falsato da un'assunzione non verificata, aumentando i casi di fallimento per prematurità.",
          "Perché il grafico si cancella automaticamente.",
          "Perché i prezzi tondi cambiano colore.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "Nel protocollo di verifica, l'evento si considera attivato unicamente a contatto avvenuto, mai prima.",
        methodologicalTip: "Attendi che la barra tocchi la soglia prima di valutare la reazione.",
      },
      {
        id: "q-t2-5",
        question: "Quale timeframe è suggerito nel protocollo per isolare in modo pulito le inefficienze M15?",
        options: [
          "Grafico a 1 secondo.",
          "M15 per la struttura dell'inefficienza e M5/M1 per il dettaglio della reazione.",
          "Grafico annuale.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "La combinazione M15 (struttura guida) con timeframe veloci permette di osservare la microstruttura del rigetto.",
        methodologicalTip: "Mantieni costanti i timeframe per tutto il blocco di 50 test.",
      },
    ],
  },

  // ─── TESI III: LA DISTRIBUZIONE VOLUMETRICA 24H & POC ────────────────────────
  {
    id: "tesi-3-volume-profile",
    stageNumber: 3,
    roman: "TESI III",
    title: "La Distribuzione Volumetrica 24h & Migrazione del POC",
    subtitle: "Ipotesi del Point of Control come Baricentro Dinamico della Liquidità",
    logicalThread:
      "Comprese le soglie geometriche statiche, si introduce la dimensione del volume: dove si sono concentrati realmente gli scambi? Il Volume Profile permette di testare se la concentrazione dei contratti attrae o respinge i prezzi futuri.",
    associatedGradeLevel: 2,
    associatedGradeTitle: "Il Custode della Regola",
    badge: "Densità della Liquidità",
    timeframeFocus: "Sessione 24h (00:00–24:00 UTC)",
    suggestedSampleSize: "40 Giornate di Profilo Distribuito",
    theoreticalCore:
      "Il modello postula che il Point of Control (POC) sia il prezzo di massimo consenso tra acquirenti e venditori. Nelle sessioni rotazionali (D-Shape), ogni allontanamento dalla Value Area (70%) tende a essere riassorbito verso il POC; nelle giornate direzionali (P o b-Shape), la migrazione del POC segnala la continuazione del flusso.",
    forgeTestingProtocol: [
      {
        stepNumber: 1,
        title: "Impostazione del Profilo 24h",
        directive: "Applicare il Volume Profile giornaliero solare dalle 00:00 alle 24:00 UTC sul grafico storico a 5 minuti.",
      },
      {
        stepNumber: 2,
        title: "Classificazione Morfologica della Sessione",
        directive: "Catalogare la giornata precedente come P-Shape (sbilanciamento alto), b-Shape (sbilanciamento basso) o D-Shape (simmetrica).",
      },
      {
        stepNumber: 3,
        title: "Test di Reazione sul POC del Giorno Prima",
        directive: "Osservare il comportamento dei prezzi quando, nella sessione successiva, viene ritestato il POC non mitigato (Naked POC).",
      },
    ],
    metricsToRecord: [
      { metricName: "Tasso di Tocco del Naked POC", purpose: "Frequenza con cui il POC del giorno precedente viene rivisitato." },
      { metricName: "Comportamento su D-Shape", purpose: "Percentuale di rimbalzi interni tra VAH e VAL verso il centro." },
      { metricName: "Frequenza di Rottura Direzionale su P/b", purpose: "Percentuale di continuazione del trend dopo il test del POC." },
    ],
    diagramType: "volume_profile_shapes",
    diagramCaption: "Morfologie del Volume Profile: P-Shape (espansione alta), D-Shape (rotazione) e b-Shape (espansione bassa)",
    diagramKeyPoints: [
      "P-Shape: POC superiore, volumi sottili alla base",
      "D-Shape: campana simmetrica, baricentro centrale",
      "b-Shape: POC inferiore, volumi sottili in alto",
    ],
    quizQuestions: [
      {
        id: "q-t3-1",
        question: "Cosa rappresenta concettualmente il Point of Control (POC) nel Volume Profile?",
        options: [
          "Il prezzo medio ponderato per il tempo trascorso.",
          "Il singolo livello di prezzo in cui è stato scambiato il maggior volume di contratti durante l'intervallo temporale considerato.",
          "Il massimo assoluto della giornata.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Il POC fotografa il punto di massima interazione volumetrica, identificando il vero baricentro dei prezzi.",
        methodologicalTip: "Distingui sempre il POC dal prezzo medio: il POC misura i contratti scambiati, non il tempo.",
      },
      {
        id: "q-t3-2",
        question: "Quale ipotesi teorica si applica a una giornata con profilo 'D-Shape' (simmetrico e bilanciato)?",
        options: [
          "Che il mercato sia in trend verticale inarrestabile.",
          "Che il mercato sia in equilibrio e che i test degli estremi VAH e VAL tendano a rientrare verso il POC in assenza di nuovi volumi.",
          "Che gli scambi siano stati interrotti dalla borsa.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "In una giornata a D-Shape, i prezzi esterni alla Value Area sono considerati iniqui dal mercato e tendono a ruotare verso il centro.",
        methodologicalTip: "Nei profili D-Shape, testa l'ipotesi di ritorno al centro quando il prezzo sfora di pochi tick la Value Area.",
      },
      {
        id: "q-t3-3",
        question: "Cosa indica l'ipotesi di 'migrazione del POC' quando il POC del giorno corrente si forma sopra a quello del giorno prima?",
        options: [
          "Uno sbilanciamento volumetrico a supporto di una tendenza rialzista del mercato.",
          "Un errore nei feed dei dati del grafico.",
          "Un segnale di immediata discesa dei prezzi.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "La migrazione verso l'alto del baricentro volumetrico riflette l'accettazione di prezzi più alti da parte dei partecipanti istituzionali.",
        methodologicalTip: "Confronta la posizione del POC tra 3 sessioni consecutive per rilevare il trend di migrazione.",
      },
      {
        id: "q-t3-4",
        question: "Cosa si intende per 'Naked POC' (POC scoperto)?",
        options: [
          "Un POC che non è mai stato ritestato dal prezzo nelle sessioni successive alla sua formazione.",
          "Un indicatore senza colori.",
          "Un grafico privo di indicatori tecnici.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "Un Naked POC rappresenta un livello di alta densità volumetrica che non ha ancora subito un retest, fungendo da potenziale calamita.",
        methodologicalTip: "Segna i Naked POC delle ultime 5 giornate e misura quante volte vengono raggiunti.",
      },
      {
        id: "q-t3-5",
        question: "Qual è l'errore metodologico tipico nell'interpretazione del Volume Profile?",
        options: [
          "Trattare il profilo come una sfera di cristallo invece di considerarlo una mappa oggettiva della liquidità già scambiata.",
          "Guardare il grafico su monitor a 60Hz.",
          "Utilizzare candele giapponesi al posto delle barre.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "Il Volume Profile descrive dove il mercato ha trovato valore nel passato; il test scientifico verifica se tale memoria viene difesa o rotta.",
        methodologicalTip: "Non dare per scontata la tenuta del POC: osserva la reazione volumetrica prima di validare il test.",
      },
    ],
  },

  // ─── TESI IV: IL MODELLO DEL TIMING SESSIONALE (ASIAN BOX & 1.27) ────────────
  {
    id: "tesi-4-asian-range",
    stageNumber: 4,
    roman: "TESI IV",
    title: "Il Modello del Timing Sessionale (Asian Box & Livello 1.27)",
    subtitle: "Ipotesi della Manipolazione degli Estremi Asiatici all'Apertura di Londra",
    logicalThread:
      "Dopo aver compreso dove si trova il volume, è fondamentale stabilire *quando* il mercato si muove. La sessione asiatica costruisce il corridoio iniziale della giornata, la cui manipolazione a Londra costituisce uno dei fenomeni statistici più ricorrenti.",
    associatedGradeLevel: 3,
    associatedGradeTitle: "L'Osservatore Sovrano",
    badge: "Orologio delle Sessioni",
    timeframeFocus: "Asian Box (00:00–08:00 UTC) -> London Open (08:00–10:30 UTC)",
    suggestedSampleSize: "50 Sessioni di Londra Consecutive",
    theoreticalCore:
      "L'ipotesi di ricerca teorica postula che gli estremi dell'Asian Range (Asia High e Asia Low) concentrino la liquidità retail della notte. All'apertura europea, il mercato tende a violare tali estremi estendendosi verso il livello 1.27 di Fibonacci (cattura degli stop), per poi rientrare nel box e correre verso l'estremo opposto.",
    forgeTestingProtocol: [
      {
        stepNumber: 1,
        title: "Cartografia del Box Asiatico",
        directive: "Evidenziare il massimo e minimo assoluti formati tra le 00:00 e le 08:00 UTC (Tokyo/Sydney).",
      },
      {
        stepNumber: 2,
        title: "Misurazione della Violazione di Londra",
        directive: "All'apertura di Londra (08:00–09:30 UTC), verificare se il prezzo viola l'Asian High o l'Asian Low.",
      },
      {
        stepNumber: 3,
        title: "Test dell'Estensione 1.27 & Rientro",
        directive: "Applicare Fibonacci sul box asiatico: registrare quante volte il movimento si esaurisce nell'area 1.27 con immediato rientro nel range.",
      },
    ],
    metricsToRecord: [
      { metricName: "Frequenza di Falso Breakout (Sweep Rate)", purpose: "Percentuale di violazioni dell'Asian Box che si rivelano trappole." },
      { metricName: "Raggiungimento dell'Estremo Opposto", purpose: "Quante volte il rientro nel box porta al test dell'altro estremo." },
      { metricName: "Magnete del 50% Scoperto (5 Giorni)", purpose: "Frequenza di recupero della mezzeria asiatica non mitigata." },
    ],
    diagramType: "asian_range_sweep",
    diagramCaption: "Dinamica dell'Asian Range: Consolidamento Notturno, Sweep a 1.27 a Londra e Rotazione Opposta",
    diagramKeyPoints: [
      "Range compatto durante Tokyo (00:00–08:00 UTC)",
      "Sweep a Londra verso l'estensione 1.27 di Fibonacci",
      "Rientro nel range con chiusura candela M15 e rotazione",
    ],
    quizQuestions: [
      {
        id: "q-t4-1",
        question: "Qual è la caratteristica strutturale tipica dell'Asian Range prima dell'apertura europea?",
        options: [
          "Volatilità estrema con candele da 200 pip al minuto.",
          "Un intervallo compatto di consolidamento con range contenuto (00:00–08:00 UTC) e volumi ridotti.",
          "Il mercato rimane completamente fermo senza scambi.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "La sessione asiatica costruisce un range delimitato i cui confini fungono da accumulatori di ordini pendenti.",
        methodologicalTip: "Misura l'ampiezza in pip dell'Asian Range prima di iniziare l'osservazione di Londra.",
      },
      {
        id: "q-t4-2",
        question: "Cosa postula l'ipotesi teorica sul livello di estensione di Fibonacci 1.27 dell'Asian Box?",
        options: [
          "Che sia il punto in cui il broker chiude d'ufficio le posizioni.",
          "Che rappresenti una zona statistica frequente di esaurimento della finta rottura di Londra, dove si concentrano gli stop retail prima del rientro.",
          "Che il prezzo si fermi solo se coincide con il venerdì.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "L'estensione 1.27 calcola l'area di espansione manipolatoria oltre gli estremi prima dell'inversione di polarità.",
        methodologicalTip: "Traccia l'estensione 1.27 sia sopra Asia High che sotto Asia Low.",
      },
      {
        id: "q-t4-3",
        question: "Quale condizione metodologica sancisce il fallimento dell'ipotesi di rientro nell'Asian Box?",
        options: [
          "Una candela M15 che chiude chiaramente all'interno del box.",
          "Una continuazione impulsiva con chiusure di candele H1 ben oltre l'estensione 1.27 con volumi crescenti (vero trend istituzionale).",
          "Il cambio dell'orario legale.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Se la sessione europea accelera oltre 1.27 con volumi sbilanciati, non si tratta di uno sweep ma di una reale espansione in trend.",
        methodologicalTip: "Registra come 'invalidazione' ogni caso in cui il prezzo non rientra nel box entro 90 minuti.",
      },
      {
        id: "q-t4-4",
        question: "Cosa postula la regola del '50% scoperto per 5 giorni' secondo i documenti del Mentore?",
        options: [
          "Che la linea del 50% di un Asian Box non testata rimanga un magnete statistico di liquidità fino a 5 giorni di calendario.",
          "Che ogni trade debba durare esattamente 5 giorni.",
          "Che il 50% dei trader perda il proprio conto in 5 giorni.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "I livelli mediani dei box asiatici non toccati dal prezzo costituiscono scompensi aperti a cui il mercato spesso ritorna nei giorni seguenti.",
        methodologicalTip: "Mantieni sul grafico le linee del 50% asiatico delle 5 sessioni precedenti.",
      },
      {
        id: "q-t4-5",
        question: "Come deve essere documentato il test di reazione di Londra nel registro della Forgia?",
        options: [
          "Annotando orario della violazione, livello massimo raggiunto (es. 1.15 vs 1.27), chiusura della candela M15 e successivo target toccato.",
          "Scrivendo solo se il trade avrebbe fatto guadagnare o perdere denaro.",
          "Facendo uno screenshot senza annotare dati numerici.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "Il metodo scientifico esige la catalogazione dei parametri oggettivi: orario, estensione esatta e risposta strutturale.",
        methodologicalTip: "Compila sempre la scheda di test con coordinate di prezzo e tempo.",
      },
    ],
  },

  // ─── TESI V: LA CICLICA DEI 3 GIORNI & SCHEMATICHE WYCKOFF ───────────────────
  {
    id: "tesi-5-ciclica-wyckoff",
    stageNumber: 5,
    roman: "TESI V",
    title: "La Ciclica dei 3 Giorni, Scompensi BBT & Fasi Wyckoff",
    subtitle: "Ipotesi dell'Articolazione Sequenziale delle Manovre Istituzionali",
    logicalThread:
      "Dopo aver analizzato le sessioni intraday, si sale di scala temporale: come si legano i giorni tra loro? La ciclica dei 3 giorni e le 5 fasi A-E di Wyckoff consentono di testare se le manovre di accumulo e distribuzione seguono uno schema strutturale riconoscibile.",
    associatedGradeLevel: 3,
    associatedGradeTitle: "L'Osservatore Sovrano",
    badge: "Ciclica Strutturale",
    timeframeFocus: "H1 / H4 su 3 Sessioni Consecutive (G1, G2, G3)",
    suggestedSampleSize: "25 Cicli Completi Campionati",
    theoreticalCore:
      "L'ipotesi ciclica sostiene che il grande capitale muova il mercato attraverso una cadenza a 3 tempi: Giorno 1 (Provenienza: identificazione della fase di accumulo/distribuzione), Giorno 2 (Validazione: assorbimento e test strutturale con scompensi BBT), Giorno 3 (Espansione e rilascio direzionale). Wyckoff formalizza le 5 fasi (A-E) che governano questo passaggio.",
    forgeTestingProtocol: [
      {
        stepNumber: 1,
        title: "Identificazione del Giorno 1 (Fase A-B)",
        directive: "Individuare una fase di arresto (Selling Climax o Buying Climax) seguita da consolidamento orizzontale in H1.",
      },
      {
        stepNumber: 2,
        title: "Verifica del Giorno 2 (Fase C: Spring / UTAD)",
        directive: "Monitorare se nel secondo giorno si verifica la violazione degli estremi con finto breakout e riassorbimento rapido.",
      },
      {
        stepNumber: 3,
        title: "Test dell'Espansione di Giorno 3 (Fase D-E: LPS / SOS)",
        directive: "Verificare se il terzo giorno produce la rottura definitiva del trading range con scompensi volumetrici confermati.",
      },
    ],
    metricsToRecord: [
      { metricName: "Durata Media della Fase B", purpose: "Quante ore/giorni richiede la costruzione del consenso prima dello Spring." },
      { metricName: "Efficacia del Retest LPS in Fase D", purpose: "Frequenza con cui il test dell'ultimo supporto regge l'espansione." },
      { metricName: "Affidabilità del Modello dei 3 Giorni", purpose: "Percentuale di cicli che completano l'espansione nel terzo giorno." },
    ],
    diagramType: "wyckoff_phases",
    diagramCaption: "Schematica Wyckoffiana Integrata: Le 5 Fasi A-E e la Correlazione con la Sequenza di 3 Giorni",
    diagramKeyPoints: [
      "Fase A: Arresto del trend primario (Climax)",
      "Fase B: Costruzione del consenso e assorbimento dell'offerta",
      "Fase C: Il test di Spring / UTAD che cattura la liquidità retail",
      "Fase D: Last Point of Support (LPS) e Sign of Strength (SOS)",
      "Fase E: Espansione direzionale pura fuori dal range",
    ],
    quizQuestions: [
      {
        id: "q-t5-1",
        question: "Cosa postula l'ipotesi teorica del modello dei 3 giorni sviluppato dal Mentore?",
        options: [
          "Che ogni settimana il mercato si azzeri ogni tre giorni.",
          "Che le manovre istituzionali si articolino frequentemente su una sequenza di tre sessioni: G1 (Provenienza), G2 (Validazione), G3 (Espansione).",
          "Che si debba fare trading solo tre volte al mese.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "La scansione su tre giorni permette di non avere fretta e di comprendere in quale stadio di maturazione si trova il ciclo.",
        methodologicalTip: "Identifica sempre la provenienza prima di cercare l'espansione.",
      },
      {
        id: "q-t5-2",
        question: "Qual è il ruolo strutturale della 'Fase C' (Spring o UTAD) nella metodologia di Wyckoff?",
        options: [
          "È il momento in cui i grafici smettono di aggiornarsi.",
          "È il test definitivo in cui le mani forti violano gli estremi del range per catturare gli stop retail e verificare se esiste ancora offerta/domanda contraria.",
          "È la chiusura della candela delle 17:00.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Lo Spring (al ribasso) o l'UTAD (al rialzo) rappresenta la trappola decisiva che precede la vera espansione direzionale di Fase D.",
        methodologicalTip: "Verifica che lo Spring sia seguito da un rientro rapido con chiusura all'interno del trading range.",
      },
      {
        id: "q-t5-3",
        question: "Cosa caratterizza un vero 'Sign of Strength' (SOS) all'uscita dal trading range?",
        options: [
          "Candele di grande estensione accompagnate da scompensi volumetrici che rompono con decisione la resistenza del range.",
          "Una serie di candele doji senza volume.",
          "Una notizia positiva al telegiornale.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "Il SOS deve mostrare lo sbilanciamento dell'offerta con rottura convinta e formazione di inefficienze a supporto.",
        methodologicalTip: "Nelle simulazioni, scarta le rotture deboli che non lasciano scompensi volumetrici.",
      },
      {
        id: "q-t5-4",
        question: "Cosa sono gli 'Scompensi di Brevissimo Termine' (BBT) descritti nelle schede del Mentore?",
        options: [
          "Errori di connessione del broker.",
          "Inefficienze microscopiche create negli ultimi 2 impulsi che indicano dove il prezzo tende a ritornare prima di proseguire.",
          "Le differenze di fuso orario tra Londra e New York.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Gli scompensi BBT degli ultimi 2 movimenti fungono da bussole per determinare i punti di riequilibrio di breve periodo.",
        methodologicalTip: "Mappa gli scompensi degli ultimi 2 movimenti e verifica se il 50% viene testato prima dell'impulso successivo.",
      },
      {
        id: "q-t5-5",
        question: "In quale fase di Wyckoff il modello consiglia di condurre i test di verifica retrospettiva a minor rischio teorico?",
        options: [
          "Nel pieno della Fase B durante la congestione casuale.",
          "Sul test di Fase D (Last Point of Support / LPS) dopo che lo Spring di Fase C ha confermato l'assorbimento.",
          "Sulla prima candela delSelling Climax di Fase A.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Attendere la Fase D permette di verificare il modello quando la trappola di Fase C è già avvenuta e confermata.",
        methodologicalTip: "Focalizza i test di backtest sulla tenuta dei livelli LPS/LPSY.",
      },
    ],
  },

  // ─── TESI VI: IL MODELLO MACROECONOMICO DELL'ORO (XAU/USD) ──────────────────
  {
    id: "tesi-6-macro-oro",
    stageNumber: 6,
    roman: "TESI VI",
    title: "Il Modello Macroeconomico dell'Oro (XAU/USD) & Banche Centrali",
    subtitle: "Ipotesi delle Correlazioni Intermarket, Tassi Reali e De-dollarizzazione BRICS",
    logicalThread:
      "I modelli tecnici e ciclici devono ora essere contestualizzati nel quadro macroeconomico globale. L'oro (XAU/USD) è il bene rifugio sovrano per eccellenza: testare come risponde ai dati macro (NFP, tassi d'interesse) e agli acquisti delle banche centrali completa la visione d'insieme.",
    associatedGradeLevel: 4,
    associatedGradeTitle: "L'Architetto del Reale",
    badge: "Macroeconomia Sovrana",
    timeframeFocus: "Daily / H4 su XAU/USD in Correlazione con DXY e Tassi TIPS",
    suggestedSampleSize: "24 Mesi di Rilevazioni Macroeconomiche (Eventi NFP & FOMC)",
    theoreticalCore:
      "La tesi macroeconomica postula che l'oro risponda a una duplice forza: nel breve termine alla correlazione inversa con i tassi d'interesse reali statunitensi e il dollaro (DXY); nel medio-lungo termine alla domanda strutturale e anelastica delle banche centrali (in particolare dei paesi BRICS) che accumulano riserve auree fisiche per de-dollarizzare il proprio attivo.",
    forgeTestingProtocol: [
      {
        stepNumber: 1,
        title: "Mappatura del Calendario NFP",
        directive: "Isolare le ultime 24 edizioni del Non-Farm Payroll (primo venerdì del mese, ore 14:30 CET).",
      },
      {
        stepNumber: 2,
        title: "Test del Doppio Battito dell'NFP",
        directive: "Misurare quante volte la reazione dei primi 5 minuti è contraria alla tendenza assunta dall'oro dopo 30-45 minuti dal dato.",
      },
      {
        stepNumber: 3,
        title: "Verifica delle Divergenze con il Dollaro (DXY)",
        directive: "Catalogare i periodi storici in cui l'Oro è salito contemporaneamente a un DXY forte, verificando la coincidenza con picchi di acquisti delle banche centrali.",
      },
    ],
    metricsToRecord: [
      { metricName: "Frequenza di Falsa Reazione su NFP (5m vs 30m)", purpose: "Percentuale di trappole bilaterali all'uscita della notizia." },
      { metricName: "Correlazione Inversa Gold/TIPS", purpose: "Coefficiente di correlazione tra oro e rendimenti reali decennali." },
      { metricName: "Tenuta dei Minimi Strutturali su Daily", purpose: "Comportamento sui supporti HTF durante fasi di accumulo sovrano." },
    ],
    diagramType: "brics_gold_macro",
    diagramCaption: "L'Asse Macroeconomico dell'Oro: Tassi Reali, Flussi dei Treasury USA e Riserve delle Banche Centrali BRICS",
    diagramKeyPoints: [
      "Tassi Reali Negativi = Catalizzatore Storico Rialzista per l'Oro",
      "Accumulazione delle Banche Centrali BRICS = Pavimento Strutturale Anelastico",
      "Eventi ad Alto Impatto (NFP/FOMC) = Reazione a Doppio Battito",
    ],
    quizQuestions: [
      {
        id: "q-t6-1",
        question: "Qual è la relazione teorica fondamentale tra i tassi d'interesse reali e il prezzo dell'oro (XAU/USD)?",
        options: [
          "Quando i tassi reali salgono a livelli altissimi, l'oro sale sempre del 500%.",
          "Storicamente esiste una correlazione inversa: tassi reali in calo o negativi riducono il costo opportunità di detenere oro fisico, sostenendone il valore.",
          "I tassi d'interesse non hanno alcun legame con l'oro.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "L'oro non stacca cedole; pertanto, quando i rendimenti reali del debito obbligazionario scendono, l'attrattiva dell'oro cresce proporzionalmente.",
        methodologicalTip: "Nel backtesting dell'oro, verifica sempre la direzione dei rendimenti reali decennali USA.",
      },
      {
        id: "q-t6-2",
        question: "Cosa postula l'ipotesi teorica del 'doppio battito' durante il rilascio del dato Non-Farm Payrolls (NFP)?",
        options: [
          "Che la prima reazione istantanea sui timeframe veloci sia frequentemente una caccia alla liquidità bilaterale, prima che emerga la direzione reale dopo 30 minuti.",
          "Che l'oro batta due volte sul supporto senza mai rimbalzare.",
          "Che vengano pubblicati due dati contemporaneamente per errore.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "La volatilità iniziale su notizie ad alto impatto crea spread allargati e manipolazioni prima del reale assestamento dei flussi.",
        methodologicalTip: "Nelle simulazioni macro, attendi sempre che la prima candela a 15 minuti dell'evento si sia chiusa.",
      },
      {
        id: "q-t6-3",
        question: "Per quale motivo l'accumulazione di riserve auree fisiche da parte delle banche centrali BRICS crea un 'pavimento strutturale' sul prezzo?",
        options: [
          "Perché le banche centrali comprano per ragioni strategiche e geopolitiche di lungo termine senza vendere su oscillazioni di breve periodo.",
          "Perché le banche centrali fanno day trading su broker a leva.",
          "Perché l'oro viene stampato dalle banche centrali.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "La domanda sovrana delle banche centrali è strutturale e anelastica: accumula riserve fisiche riducendo l'offerta disponibile sul mercato globale.",
        methodologicalTip: "Osserva nei grafici Daily come i grandi ritracciamenti dell'oro trovino supporto sulle zone di accumulo istituzionale.",
      },
      {
        id: "q-t6-4",
        question: "Cosa indica empiricamente una fase in cui l'Oro continua a salire nonostante il dollaro (DXY) si mantenga forte?",
        options: [
          "Che la domanda di bene rifugio e riserva sovrana è talmente potente da rompere temporaneamente la consueta correlazione inversa con la valuta USA.",
          "Un blocco nei computer della borsa di Londra.",
          "Un segnale di crollo imminente dell'intero sistema finanziario entro 24 ore.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "Le divergenze con il dollaro segnalano che la forza dell'oro non è mero riflesso monetario, ma spinta geopolitica e di protezione sistemica.",
        methodologicalTip: "Annota come 'anomalia rialzista potente' ogni sessione in cui Gold e DXY salgono insieme.",
      },
      {
        id: "q-t6-5",
        question: "Qual è il corretto approccio didattico allo studio macroeconomico secondo AUREUS?",
        options: [
          "Cercare di prevedere le notizie prima che escano basandosi sulle indiscrezioni dei social media.",
          "Comprendere i grandi driver di fondo per stabilire il bias primario e attendere poi la conferma tecnica e ciclica prima di qualunque valutazione.",
          "Ignorare totalmente i dati macro e guardare solo gli indicatori di momentum.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "La macroeconomia fornisce il contesto (il vento a favore); la tecnica e il timing forniscono la precisione del punto di verifica.",
        methodologicalTip: "Allinea sempre la tesi tecnica con il contesto macroeconomico per aumentare la robustezza del test.",
      },
    ],
  },

  // ─── TESI VII: IL PROTOCOLLO DI VALIDAZIONE STATISTICA & AUDIT ───────────────
  {
    id: "tesi-7-protocollo-validazione",
    stageNumber: 7,
    roman: "TESI VII",
    title: "Il Protocollo Integrato di Backtest & Scheda di Audit",
    subtitle: "La Sintesi Metodologica: Convergenza delle Variabili e Test di Robustezza",
    logicalThread:
      "Al termine del percorso, lo studente possiede tutti i tasselli teorici. La Tesi VII formalizza il metodo con cui tutte le variabili vengono sottoposte a un test di convergenza simultanea (Audit di Backtest) per misurare empiricamente l'efficacia del modello su campioni storici complessi.",
    associatedGradeLevel: 5,
    associatedGradeTitle: "Il Fondatore d'Eredità",
    badge: "Laboratorio Integrato",
    timeframeFocus: "Simulazione Multi-Timeframe (Daily -> H1 -> M15 -> M5)",
    suggestedSampleSize: "50 Sessioni di Backtest Completo nella Forgia del Passato",
    theoreticalCore:
      "Nessun singolo fattore offre un vantaggio statistico sufficiente. La tesi della convergenza postula che quando almeno il 70% dei fattori di audit (Macro 60%, Scompensi BBT 55%, Wyckoff 65%, Volume Profile 40%, Asian Range 40%, Inefficienze 50%) concorda simultaneamente, il modello storico presenti una probabilità di esito favorevole significativamente superiore alla casualità.",
    forgeTestingProtocol: [
      {
        stepNumber: 1,
        title: "Compilazione della Scheda di Audit",
        directive: "Prima di avanzare il replay, verificare quali delle 7 variabili sono soddisfatte e calcolare l'indice di convergenza percentuale.",
      },
      {
        stepNumber: 2,
        title: "Filtro della Soglia Minima al 70%",
        directive: "Isolare per il test unicamente i casi in cui l'indice di convergenza calcolato è pari o superiore al 70%.",
      },
      {
        stepNumber: 3,
        title: "Audit Retrospettivo su 50 Eventi",
        directive: "Eseguire 50 simulazioni registrando Profit Factor, Win Rate, Max Drawdown simulato e aderenza alle regole d'invalidazione.",
      },
    ],
    metricsToRecord: [
      { metricName: "Win Rate Teorico Simulato", purpose: "Rapporto tra casi con R:R >= 1:2 completati rispetto ai test invalidati." },
      { metricName: "Profit Factor dell'Esperimento", purpose: "Somma dei profitti simulati divisa per la somma delle perdite simulate." },
      { metricName: "Max Drawdown del Campione", purpose: "Massima flessione consecutiva subita durante il ciclo di 50 simulazioni." },
    ],
    diagramType: "confluence_audit",
    diagramCaption: "La Piramide di Convergenza Metodologica: Macro (Base) -> Ciclica -> Volume -> Timing Sessionale -> Trigger",
    diagramKeyPoints: [
      "Isolamento delle 7 variabili indipendenti di laboratorio",
      "Calcolo matematico dell'Indice di Convergenza (Soglia minima 70%)",
      "Validazione finale tramite 50 backtest consecutivi registrati",
    ],
    quizQuestions: [
      {
        id: "q-t7-1",
        question: "Cosa rappresenta l'Indice di Convergenza nella Scheda di Audit del Backtest?",
        options: [
          "Un algoritmo matematico ponderato che misura quanti fattori teorici indipendenti (Macro, Wyckoff, Volume, Sessioni) concordano simultaneamente sullo stesso scenario storico.",
          "Il saldo del conto corrente dell'utente.",
          "La percentuale di batteria rimasta sul computer.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "L'indice di convergenza sintetizza la solidità probabilistica dell'ipotesi prima di annotare l'esito della simulazione.",
        methodologicalTip: "Utilizza la scheda per verificare se il setup soddisfa i requisiti minimi di ricerca.",
      },
      {
        id: "q-t7-2",
        question: "Qual è la soglia minima di convergenza richiesta dal protocollo affinché un caso di test sia ammesso alla rilevazione statistica?",
        options: [
          "Almeno il 70% di convergenza ponderata.",
          "Qualsiasi valore, anche il 10%.",
          "Il 100% obbligatorio su tutti i mercati del mondo.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "La soglia del 70% filtra i casi ambigui o contraddittori, concentrando l'audit storico sulle sole condizioni di alta convergenza.",
        methodologicalTip: "Scarta tutti gli scenari storici con convergenza inferiore al 70%.",
      },
      {
        id: "q-t7-3",
        question: "Perché è fondamentale registrare il 'Max Drawdown simulato' durante una sessione di 50 backtest?",
        options: [
          "Perché consente di comprendere la massima serie di fallimenti consecutivi che il modello teorico può subire, preparando lo studente alla realtà statistica.",
          "Perché serve a vantarsi con altri studenti.",
          "Perché il simulatore cancella i conti che superano il 5%.",
        ],
        correctIndex: 0,
        points: 20,
        explanation: "Anche i modelli con win rate del 60% possono subire 5 o 6 insuccessi consecutivi; conoscere il Max Drawdown storico previene la frustrazione.",
        methodologicalTip: "Misura sempre il drawdown massimo durante il ciclo dei 50 test.",
      },
      {
        id: "q-t7-4",
        question: "Quale atteggiamento contraddistingue il vero Architetto del Capitale al termine dell'intero percorso delle 7 Tesi?",
        options: [
          "Cercare scorciatoie o pensare di non aver più bisogno di testare nulla.",
          "Mantenere un'umiltà scientifica costante, sottoponendo periodicamente ogni modello a nuovi audit retrospettivi e rispettando l'inviolabilità del metodo.",
          "Credere che il mercato obbedisca alle proprie convinzioni personali.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Il vero maestro dei mercati sa che le condizioni di volatilità mutano nel tempo e che l'unico baluardo è la fedeltà al processo di verifica empirica.",
        methodologicalTip: "Non smettere mai di testare: il mercato è un organismo dinamico.",
      },
      {
        id: "q-t7-5",
        question: "Cosa certifica il conseguimento del 'Sigillo di Padronanza Dottrinale' al termine delle 7 Tesi?",
        options: [
          "La certezza di vincere sempre nei mercati reali con denaro.",
          "Il completamento con successo di tutti i quiz accademici (≥ 80% su ciascuna tesi), a riprova della piena comprensione teorica e metodologica dei protocolli di ricerca.",
          "L'accesso gratuito a una sala segnali di terze parti.",
        ],
        correctIndex: 1,
        points: 20,
        explanation: "Il Sigillo attesta la disciplina e la padronanza intellettuale del Codice AUREUS, prerequisito d'onore per i Gradi di Ascesa.",
        methodologicalTip: "Custodisci i punteggi ottenuti come testimonianza del tuo rigore accademico.",
      },
    ],
  },
] as const;


export const MENTOR_MASTER_MANUALS: readonly MentorMasterManual[] = [
  // ─── MANUALE 1: GUIDA INTEGRATA COMPLETA ────────────────────────────────────
  {
    id: "manuale-guida-integrata",
    manualCode: "M-01",
    title: "Volume Profile, Wyckoff, Ciclicità dei 3 Giorni & Sessione Asiatica",
    subtitle: "La Guida Operativa Integrata Completa — Versione Finale Verificata",
    sourceDocument: "Completo.pdf & VolumeProfile_Cicli.pdf",
    readingTime: "25 min di studio",
    chaptersCount: 4,
    badge: "Framework Integrato",
    probabilityWeight: "Precisione 80%",
    coreThesis:
      "La convergenza totale tra la distribuzione volumetrica su 24 ore (00:00–24:00), le fasi A–E di Wyckoff, la ciclicità di posizionamento su 3 giorni (Provenienza, Validazione, Entry) e l'origine asiatica rivela la traiettoria infallibile del grande capitale.",
    chapters: [
      {
        id: "m1-c1",
        chapterNumber: 1,
        title: "Volume Profile 24h & Migrazione del POC",
        summary:
          "Analisi della distribuzione del volume su giornata solare completa. Il Point of Control (POC) rappresenta il prezzo a maggior volume scambiato: la sua migrazione progressiva verso l'alto o verso il basso segnala l'intenzione istituzionale prima che avvenga l'espansione dei prezzi.",
        keyTakeaways: [
          "Il POC non mente: se il prezzo sale ma il POC migra verso il basso, il rialzo è privo di volume ed è destinato al collasso.",
          "Profili P-Shape: volumi concentrati in alto (bias rialzista/short-covering).",
          "Profili b-Shape: volumi concentrati in basso (bias ribassista/long-liquidation).",
          "Profili D-Shape: equilibrio simmetrico e rotazione di range.",
        ],
        operationalRules: [
          {
            code: "M1-R1",
            title: "Regola della Migrazione Direzionale",
            instruction: "Seguire la direzione di migrazione del POC giornaliero consecutivo per stabilire il bias d'ingresso.",
          },
          {
            code: "M1-R2",
            title: "Rifiuto degli Estremi VAH/VAL",
            instruction: "Operare ritorni verso il POC quando il prezzo esce dalla Value Area 70% senza un incremento di volumi a supporto.",
          },
        ],
      },
      {
        id: "m1-c2",
        chapterNumber: 2,
        title: "Schematiche di Wyckoff & Le Fasi A-E",
        summary:
          "Le 5 fasi canoniche del ciclo istituzionale: Fase A (Arresto del trend precedente), Fase B (Costruzione del consenso e assorbimento dell'offerta), Fase C (Test definitivo: Spring nei minimi o UTAD nei massimi), Fase D (Sign of Strength o Sign of Weakness con LPS/LPSY), Fase E (Espansione libera fuori dal range).",
        keyTakeaways: [
          "Fase A: SC (Selling Climax) / AR (Automatic Rally) / ST (Secondary Test).",
          "Fase B: Test continui dei confini e assorbimento silenzioso dei contratti retail.",
          "Fase C: La trappola decisiva. Spring (cattura stop sotto i minimi) o Upthrust After Distribution (UTAD sopra i massimi).",
          "Fase D & E: L'ingresso a minor rischio avviene sul Last Point of Support (LPS) in Fase D.",
        ],
        operationalRules: [
          {
            code: "M1-R3",
            title: "Divieto di Ingresso in Fase B",
            instruction: "Non anticipare la direzione durante la Fase B: attendere sempre la violazione di Fase C (Spring o UTAD).",
          },
          {
            code: "M1-R4",
            title: "Ingresso sul Test di Fase D",
            instruction: "Posizionarsi sul retest del livello di rottura (LPS/LPSY) con stop posizionato oltre lo Spring/UTAD.",
          },
        ],
      },
      {
        id: "m1-c3",
        chapterNumber: 3,
        title: "La Ciclicità dei 3 Giorni",
        summary:
          "Ogni grande movimento istituzionale si articola su un ciclo sequenziale di tre sessioni: Giorno 1 (Provenienza: identificazione della fase di accumulo/distribuzione), Giorno 2 (Validazione: migrazione del POC e consolidamento strutturale), Giorno 3 (Entry: esecuzione chirurgica al termine del test ed espansione direzionale).",
        keyTakeaways: [
          "Giorno 1: Identificazione della fase e del contesto primario.",
          "Giorno 2: Validazione della tenuta dei livelli chiave e conferma volumetrica.",
          "Giorno 3: La giornata del raccolto operativo: ingresso privo di esitazione sulla rottura confermata.",
        ],
        operationalRules: [
          {
            code: "M1-R5",
            title: "Regola del Terzo Giorno",
            instruction: "Massimizzare il rischio operativo solo nel Giorno 3 del ciclo, mantenendo la conservatività nei primi due.",
          },
        ],
      },
      {
        id: "m1-c4",
        chapterNumber: 4,
        title: "Sessione Asiatica & Livello Fibonacci 1.27",
        summary:
          "Analisi della prima sessione del giorno solare (Tokyo/Sydney 00:00–08:00 UTC). Lo sbilanciamento dell'Asian Range verso l'estensione 1.27 di Fibonacci conferma la natura manipolatoria di Spring/UTAD; il test del 50% del box asiatico rappresenta la verifica finale prima dell'inversione.",
        keyTakeaways: [
          "Estensione 1.27: livello target naturale dove le banche prelevano gli stop prima di invertire la rotta.",
          "Test del 50%: linea di equilibrio del box asiatico, spesso riassorbita nella sessione di Londra.",
          "I livelli al 50% scoperti (non mitigati) conservano una forza attrattiva che perdura fino a 5 giorni di calendario.",
        ],
        operationalRules: [
          {
            code: "M1-R6",
            title: "Regola dell'Estensione 1.27",
            instruction: "Cercare segnali di CHoCH e rigetto volumetrico esattamente sull'estensione 1.27 dell'Asian Range.",
          },
          {
            code: "M1-R7",
            title: "Magnete dei 5 Giorni",
            instruction: "Mappare i livelli del 50% asiatici non mitigati delle ultime 5 giornate come calamite di prezzo.",
          },
        ],
      },
    ],
  },

  // ─── MANUALE 2: CICLO SETTIMANALE & SCOMPENSI BBT ───────────────────────────
  {
    id: "manuale-ciclo-settimanale-bbt",
    manualCode: "M-02",
    title: "Il Ciclo Settimanale Lunedì-Venerdì & Gli Scompensi BBT",
    subtitle: "Scheda Approfondita di Studio Avanzato & Diluizione della Liquidità",
    sourceDocument: "scheda-approfondita-studio-avanzato.pdf & CiclicitaLiquidita.pdf",
    readingTime: "20 min di studio",
    chaptersCount: 3,
    badge: "Ciclica Avanzata",
    probabilityWeight: "Filtro 60%",
    coreThesis:
      "La settimana non è un insieme casuale di candele: segue una partitura istituzionale precisa dal Lunedì al Venerdì. Gli scompensi di brevissimo termine (BBT) indicano dove il prezzo deve ritornare per riequilibrare i contratti prima di proseguire il trend.",
    chapters: [
      {
        id: "m2-c1",
        chapterNumber: 1,
        title: "Struttura Settimanale Lunedì-Venerdì",
        summary:
          "Mappatura delle caratteristiche intrinseche di ciascun giorno operativo: Lunedì (Impostazione del range iniziale e trappola di direzione), Martedì/Mercoledì (Costruzione del massimo o minimo settimanale reale, espansione primaria), Giovedì (Continuazione del trend o ritracciamento), Venerdì (Presa di profitto istituzionale, chiusura contratti e riassorbimento verso l'equilibrio).",
        keyTakeaways: [
          "Lunedì: giornata di osservazione, range limitato, probabile falso breakout.",
          "Martedì/Mercoledì: finestra di massima asimmetria operativa con la formazione del High/Low settimanale.",
          "Venerdì: evitare ingressi tardivi dopo le 16:00 UTC per scongiurare il rischio di weekend gap e diluizione.",
        ],
        operationalRules: [
          {
            code: "M2-R1",
            title: "Non Fidarsi del Lunedì",
            instruction: "Considerare i breakout del lunedì mattina come mere esche di liquidità per i partecipanti retail.",
          },
        ],
      },
      {
        id: "m2-c2",
        chapterNumber: 2,
        title: "Scompensi di Brevissimo Termine (BBT)",
        summary:
          "Identificazione matematica delle inefficienze microscopiche create negli ultimi 2 movimenti. Il mercato lascia scompensi per muovere il prezzo velocemente; tuttavia, gli algoritmi bancari sono programmati per riequilibrare almeno il 50% di tali scompensi entro 5 giorni di borsa aperta.",
        keyTakeaways: [
          "Uno scompenso BBT non mitigato crea un'area di attrazione irresistibile.",
          "Correlazione tra scompensi BBT e la ciclicità dei 3 giorni per determinare il giorno esatto di riassorbimento.",
        ],
        operationalRules: [
          {
            code: "M2-R2",
            title: "Allineamento allo Scompenso",
            instruction: "Posizionare il Take Profit sempre all'inizio o al 50% dello scompenso BBT più vicino.",
          },
        ],
      },
      {
        id: "m2-c3",
        chapterNumber: 3,
        title: "Diluizione della Liquidità & Congestione Istituzionale",
        summary:
          "Fasi in cui gli ordini vengono frazionati per non alterare il book. Le congestioni non sono assenza di volatilità, ma accumulo calcolato di ordini che precedono esplosioni direzionali di grande portata.",
        keyTakeaways: [
          "Durante la congestione, la massa perde pazienza e regala liquidità con stop troppo stretti.",
          "L'operatore sovrano aspetta il termine della congestione e ingaggia esclusivamente sulla reiezione confermata.",
        ],
        operationalRules: [
          {
            code: "M2-R3",
            title: "Pazienza nella Congestione",
            instruction: "Divieto assoluto di moltiplicare i trade durante fasi di congestione non convalidate da Wyckoff.",
          },
        ],
      },
    ],
  },

  // ─── MANUALE 3: CODICE MACROECONOMICO DELL'ORO ──────────────────────────────
  {
    id: "manuale-macro-oro",
    manualCode: "M-03",
    title: "Macroeconomia, Mercati Finanziari & Il Prezzo dell'Oro (XAU/USD)",
    subtitle: "I 4 Fattori Fondamentali, Geopolitica dei BRICS, NFP e Banche Centrali",
    sourceDocument: "MacroEconomia.pdf & GoldMacro.pdf",
    readingTime: "30 min di studio",
    chaptersCount: 4,
    badge: "Macro Sovrana",
    probabilityWeight: "Fattore 60%",
    coreThesis:
      "Il prezzo di XAU/USD è il barometro supremo della stabilità monetaria mondiale. Dominando l'interazione tra tassi d'interesse reali della Federal Reserve, inflazione, forza del dollaro (DXY), acquisti fisici delle banche centrali BRICS e catalizzatori NFP, l'operatore anticipa i macro trend plurimensili.",
    chapters: [
      {
        id: "m3-c1",
        chapterNumber: 1,
        title: "I Quattro Fattori Fondamentali del Prezzo dell'Oro",
        summary:
          "Scomposizione dei 4 driver primari: 1) Tassi d'interesse reali (Tassi nominali meno inflazione attesa: tassi reali negativi spingono l'oro verso massimi storici); 2) Dollaro USA / DXY (correlazione inversa classica, mitigata in periodi di crisi sistemica); 3) Inflazione e debito sovrano; 4) Rischio geopolitico e de-dollarizzazione.",
        keyTakeaways: [
          "Quando i tassi reali scendono, l'attrattiva del debito cartaceo cala e l'oro fisico vola.",
          "Se l'oro sale contestualmente a un dollaro forte, siamo in presenza di accumulazione sovrana delle banche centrali.",
        ],
        operationalRules: [
          {
            code: "M3-R1",
            title: "Filtro dei Tassi Reali",
            instruction: "Verificare sempre la direzione dei rendimenti TIPS decennali prima di assumere posizioni swing su XAU/USD.",
          },
        ],
      },
      {
        id: "m3-c2",
        chapterNumber: 2,
        title: "Il Ruolo Cruciale delle Banche Centrali & I BRICS",
        summary:
          "Analisi della de-dollarizzazione promossa dai paesi BRICS (Cina, Russia, India, Brasile, Sudafrica). Le banche centrali stanno accumulando riserve auree a ritmi senza precedenti dalla fine di Bretton Woods, trasformando l'oro da semplice asset speculativo in riserva monetaria sovrana priva di rischio controparte.",
        keyTakeaways: [
          "La People's Bank of China (PBoC) acquista oro in modo ininterrotto per ridurre la quota di Treasury USA in bilancio.",
          "Questa domanda anelastica fissa un pavimento strutturale sotto il quale il prezzo dell'oro non può scendere a lungo.",
        ],
        operationalRules: [
          {
            code: "M3-R2",
            title: "Acquisto sui Minimi Strutturali",
            instruction: "Trattare ogni ritracciamento significativo sui timeframe Daily/H4 come opportunità d'accumulo in linea con le banche centrali.",
          },
        ],
      },
      {
        id: "m3-c3",
        chapterNumber: 3,
        title: "Non-Farm Payroll (NFP) & Politica Monetaria Fed",
        summary:
          "Come affrontare i dati Non-Farm Payrolls del primo venerdì del mese: reazione a doppio battito sui mercati, manipolazione della liquidità iniziale e allineamento alla tendenza fondamentale solo dopo 30 minuti dal rilascio della notizia.",
        keyTakeaways: [
          "La prima reazione a 1 minuto è quasi sempre una trappola volumetrica bilaterale.",
          "Attendere il riassorbimento degli estremi prima di valutare ingressi direzionali su XAU/USD.",
        ],
        operationalRules: [
          {
            code: "M3-R3",
            title: "Regola di Silenzio durante l'NFP",
            instruction: "Astenersi da nuovi ordini nei 15 minuti precedenti e successivi al rilascio dell'NFP (14:30 CET).",
          },
        ],
      },
      {
        id: "m3-c4",
        chapterNumber: 4,
        title: "Cicli Storici & Correlazioni Intermarket",
        summary:
          "Rassegna dei grandi cicli dell'oro dal 1971 a oggi: stagflazione degli anni '70, espansione creditizia del 2001-2011, e l'attuale super-ciclo monetario e geopolitico. Tabelle sinottiche di correlazione con indici azionari e materie prime energetiche.",
        keyTakeaways: [
          "L'oro performa al meglio durante fasi di debito pubblico incontrollato e perdita di fiducia nelle valute fiat.",
        ],
        operationalRules: [
          {
            code: "M3-R4",
            title: "Allineamento Intermarket",
            instruction: "Monitorare il rapporto Gold/Silver e Gold/Oil per validare la solidità del macro-trend.",
          },
        ],
      },
    ],
  },

  // ─── MANUALE 4: IL MINDSET DEL TRADER & PSICOLOGIA ISTITUZIONALE ───────────
  {
    id: "manuale-mindset-trader",
    manualCode: "M-04",
    title: "Il Mindset da Trader & La Psicologia Istituzionale",
    subtitle: "Dall'Illusione Retail alla Mentalità Vincente Monastica",
    sourceDocument: "MindsetTrader.pdf & Psicologia istituzionale .pdf",
    readingTime: "25 min di studio",
    chaptersCount: 3,
    badge: "Governo Interiore",
    probabilityWeight: "Fattore Assoluto",
    coreThesis:
      "La tecnica senza il dominio di sé genera rovina; la disciplina monastica unita alla comprensione delle manipolazioni psicologiche istituzionali trasforma l'Iniziato in un Architetto del Capitale inattaccabile.",
    chapters: [
      {
        id: "m4-c1",
        chapterNumber: 1,
        title: "Le Credenze Fondamentali & La Disciplina del Processo",
        summary:
          "Il principio delle credenze: i tuoi pensieri diventano le tue azioni, le tue azioni diventano le tue abitudini operative. Il trader perdente è ossessionato dal denaro e dalla singola operazione; il maestro opera con distacco assoluto, focalizzandosi unicamente sulla perfetta esecuzione del Codice.",
        keyTakeaways: [
          "Accettare il rischio a priori: prima di cliccare, il capitale a rischio è già considerato perso.",
          "Nessuna speranza o preghiera sui grafici: solo matematica, probabilità e invalidazione rigida.",
        ],
        operationalRules: [
          {
            code: "M4-R1",
            title: "Accettazione Totale del Rischio",
            instruction: "Non entrare mai in posizione se la perdita massima calcolata suscita ansia o battito accelerato.",
          },
        ],
      },
      {
        id: "m4-c2",
        chapterNumber: 2,
        title: "La Ruota Emotiva & Le Trappole delle Mani Forti",
        summary:
          "Come gli algoritmi bancari sfruttano le debolezze cognitive della massa retail: FOMO sui massimi, panico sui minimi, overtrading dopo una perdita e revenge trading. Come riconoscere la trappola prima di caderne vittima.",
        keyTakeaways: [
          "L'euforia è un campanello d'allarme: quando tutto sembra facilissimo, il mercato sta per invertire.",
          "La frustrazione dopo uno stop loss è il varco attraverso cui la Deriva distrugge i conti di trading.",
        ],
        operationalRules: [
          {
            code: "M4-R2",
            title: "Regola del Respiro Tattico",
            instruction: "Dopo ogni stop loss, imporre 15 minuti di allontanamento fisico dal terminale prima di valutare nuovi grafici.",
          },
        ],
      },
      {
        id: "m4-c3",
        chapterNumber: 3,
        title: "Il Libro della Verità & La Revisione Spietata",
        summary:
          "Il ruolo sacro del Journaling: documentare ogni trade con screenshot di pre-analisi, motivazione dell'ingaggio, stato emotivo ed esito finale. Chi non tiene traccia spietata dei propri errori è condannato a ripeterli.",
        keyTakeaways: [
          "Un diario accurato è l'unico specchio sincero dell'operatore.",
          "L'Indice di Integrità si misura sulla fedeltà alle regole, non sui profitti a breve termine.",
        ],
        operationalRules: [
          {
            code: "M4-R3",
            title: "Compilazione Immediata",
            instruction: "Registrare il trade ne Il Libro della Verità entro 30 minuti dalla chiusura, annotando le metriche reali.",
          },
        ],
      },
    ],
  },

  // ─── MANUALE 5: GUIDA ENCICLOPEDICA AL TRADING PROFESSIONALE ────────────────
  {
    id: "manuale-trading-professionale",
    manualCode: "M-05",
    title: "Trading: Guida Completa dal Principiante al Professionista",
    subtitle: "Architettura dei Mercati, Gestione del Capitale, CFD & Prop Firm",
    sourceDocument: "TradingGuida.pdf",
    readingTime: "35 min di studio",
    chaptersCount: 4,
    badge: "Enciclopedia Operativa",
    probabilityWeight: "Fondamento Generale",
    coreThesis:
      "Dalle fondamenta della microstruttura dei prezzi e del calcolo dei lotti, fino alle strategie avanzate di superamento e gestione delle challenge Prop Firm con rigore asimmetrico.",
    chapters: [
      {
        id: "m5-c1",
        chapterNumber: 1,
        title: "Anatomia dei Mercati & Strumenti Finanziari",
        summary:
          "Differenze strutturali tra Forex spot, Futures, CFD su indici e materie prime. Spread, commissioni, leva finanziaria e calcolo del margine: come operare senza farsi dissanguare dai costi di transazione.",
        keyTakeaways: [
          "La leva è un amplificatore neutrale: amplifica l'eccellenza o accelera la rovina.",
          "Calcolare sempre la dimensione del lotto in base allo stop in pip e alla percentuale fissa di rischio (0.5%–1%).",
        ],
        operationalRules: [
          {
            code: "M5-R1",
            title: "Rischio Fisso su Ogni Trade",
            instruction: "Mai rischiare più dell'1% del capitale totale su una singola idea operativa.",
          },
        ],
      },
      {
        id: "m5-c2",
        chapterNumber: 2,
        title: "La Sopravvivenza Statistica nelle Prop Firm",
        summary:
          "Regole auree per superare le valutazioni delle prop firm e ricevere payout regolari: gestione del Max Daily Drawdown (limite giornaliero) e del Max Trailing Drawdown, divieto di gambling sui dati ad alto impatto, e costanza di rendimento.",
        keyTakeaways: [
          "Il 90% dei trader fallisce le prop firm a causa del Daily Drawdown e del mancato calcolo del lotto corretto.",
          "Frazionare il rischio giornaliero: massimo 2 trade al giorno con rischio 0.5% ciascuno.",
        ],
        operationalRules: [
          {
            code: "M5-R2",
            title: "Guardrail del Daily Drawdown",
            instruction: "Interrompere l'operatività della giornata se le perdite cumulative toccano il 2% del balance iniziale.",
          },
        ],
      },
      {
        id: "m5-c3",
        chapterNumber: 3,
        title: "Il Sistema delle Tre Confluenze Minime",
        summary:
          "Regola di validazione degli ingressi: per aprire una posizione a mercato devono allinearsi almeno 3 fattori indipendenti (es. 1. Livello HTF di liquidità / FVG; 2. Orario di Kill-Zone europea/americana; 3. Trigger di rigetto o rottura M5 con volume).",
        keyTakeaways: [
          "Un solo segnale è rumore; due segnali sono un'ipotesi; tre segnali costituiscono un'evidenza operativa.",
        ],
        operationalRules: [
          {
            code: "M5-R3",
            title: "Regola del Trittico di Confluenza",
            instruction: "Nessun trade può essere aperto senza l'allineamento verificabile di almeno 3 conferme indipendenti.",
          },
        ],
      },
      {
        id: "m5-c4",
        chapterNumber: 4,
        title: "La Routine dell'Operatore Professionista",
        summary:
          "La preparazione prima dei grafici: analisi del calendario economico, marcatura dei livelli chiave H4/H1 prima dell'apertura di Londra, definizione degli alert di prezzo, esecuzione priva di esitazione e riposo dopo la sessione.",
        keyTakeaways: [
          "Il miglior trader non è colui che fa più trade, ma colui che sa aspettare il setup A+ per ore senza muovere un dito.",
        ],
        operationalRules: [
          {
            code: "M5-R4",
            title: "Custodia del Tempo di Mercato",
            instruction: "Limitare l'operatività attiva a non più di 2 sessioni di 90 minuti al giorno.",
          },
        ],
      },
    ],
  },
] as const;

export interface MentorVideoMasterLesson {
  id: string;
  title: string;
  subtitle: string;
  videoUrl: string;
  duration: string;
  keyConcepts: string[];
  operationalSummary: string;
}

export const MENTOR_VIDEO_MASTER_LESSON: MentorVideoMasterLesson = {
  id: "video-decodifica-ciclo-mercato",
  title: "Decodifica del Ciclo di Mercato & Microstruttura Istituzionale",
  subtitle: "Lezione Magistrale del Mentore con Analisi Live e Applicazione Pratica",
  videoUrl: "/videos/decodifica-ciclo-mercato.mp4",
  duration: "Lezione Completa",
  keyConcepts: [
    "Scomposizione visiva delle 4 fasi di mercato (Wyckoff)",
    "Identificazione dello Spring e della cattura della liquidità asiatica",
    "Point of Control (POC) e Value Area come confini operativi",
    "Gestione chirurgica dell'invalidazione prima dello Stop Loss",
  ],
  operationalSummary:
    "Una trasmissione audio-visiva fondamentale in cui il Mentore espone dal vivo le dinamiche di decodifica dei flussi istituzionali e l'applicazione simultanea dei 4 framework.",
};


