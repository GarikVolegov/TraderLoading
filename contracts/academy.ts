/** Teaching plans are outlines for the instructor, never recorded or delivered lessons. */
export const ACADEMY_MODULES = [
  { id: "preparazione", title: "Preparazione e attesa", description: "Sessioni, calendario e protezione personale prima del grafico.", orderIndex: 0 },
  { id: "contesto", title: "Dove: ciclo e liquidità", description: "Leggere il contesto prima di cercare un ingresso.", orderIndex: 1 },
  { id: "sinistra", title: "Sinistra: zone e scenari", description: "Distinguere zona valida, sola liquidità e box intermedi.", orderIndex: 2 },
  { id: "esecuzione", title: "Come: schematiche e trigger", description: "Il docente definisce e mostra le conferme del proprio metodo.", orderIndex: 3 },
  { id: "target", title: "Target e invalidazione", description: "Documentare obiettivo, attesa e risposta al cambiamento.", orderIndex: 4 },
  { id: "scalp", title: "Laboratorio scalp", description: "Applicazione commentata H1 → M15 → M1.", orderIndex: 5 },
  { id: "swing", title: "Laboratorio swing", description: "Applicazione commentata Daily/H4 → H1/M15 → M5/M1.", orderIndex: 6 },
  { id: "revisione", title: "Diario e revisione", description: "Rivedere il processo e scegliere una correzione verificabile.", orderIndex: 7 },
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

const outline = (moduleId: AcademyModuleId, number: number, title: string, description: string, exercisePrompt: string): AcademySyllabusItem => ({
  id: `${moduleId}-${number}`, moduleId, title, outline: description, exercisePrompt, status: "outline",
});

export const ACADEMY_SYLLABUS: readonly AcademySyllabusItem[] = [
  outline("preparazione", 1, "Preparare la sessione", "Mostrare come preparare grafico, mercato e finestra oraria del cockpit.", "Descrivi la preparazione della tua sessione in simulazione."),
  outline("preparazione", 2, "Calendario e condizioni di attesa", "Mostrare un controllo delle fonti e un caso in cui attendere; rivalidare dopo le news.", "Annota cosa hai verificato e perché opereresti o attenderesti."),
  outline("preparazione", 3, "Protezione personale e checklist", "Spiegare come dichiarare i propri limiti, senza soglie di rischio universali.", "Compila una checklist e indica quali limiti devi ancora definire."),
  outline("contesto", 1, "Il ciclo grande", "Il docente definisce le fasi del ciclo e le annota sul grafico HTF.", "Annota il ciclo osservato e i punti ancora incerti."),
  outline("contesto", 2, "Liquidità e sweep", "Mostrare un caso di sweep e un controesempio secondo le definizioni del docente.", "Confronta i due casi indicando le differenze osservabili."),
  outline("contesto", 3, "Compressione: documentare l'attesa", "Mostrare un contesto con liquidità sopra e sotto e nessun nuovo ingresso.", "Scrivi una scheda di attesa e cosa richiederebbe una rivalutazione."),
  outline("sinistra", 1, "Zona valida e mitigata", "Definire la zona HTF e mostrare la conferma richiesta prima di cercare un'inversione.", "Segna la zona e distingui ciò che osservi da ciò che aspetti."),
  outline("sinistra", 2, "Sola liquidità", "Mostrare uno scenario senza zona valida: il cockpit consente solo JTC o BTI.", "Motiva la classificazione dello scenario su un replay."),
  outline("sinistra", 3, "Box intermedi", "Mostrare il caso in cui l'estremo non è raggiunto e sono ammessi solo JTC nei re-accumuli.", "Annota il box e il contesto che rende coerente lo scenario."),
  outline("esecuzione", 1, "Conferme ITF e LTF", "Il docente definisce chiusura del ciclo e schematica: nessuna conferma va anticipata.", "Segna prima e dopo della conferma su un replay."),
  outline("esecuzione", 2, "TEST e POC", "Da completare con definizioni originali del docente, esempi validi e controesempi; il codice non ne definisce le regole.", "Confronta gli esempi usando esclusivamente le regole spiegate dal docente."),
  outline("esecuzione", 3, "JTC e BTI", "Da completare con definizioni originali del docente e compatibilità con zona valida, sola liquidità e re-accumuli.", "Spiega quale trigger è ammesso e quale conferma manca."),
  outline("target", 1, "Pool di liquidità opposto", "Mostrare come identificare e confermare il target prima del piano.", "Annota target e motivazione sul grafico fornito."),
  outline("target", 2, "Storico e area vergine", "Il docente mostra il filtro manuale di sbilanciamento in area vergine; nessuna formula viene presupposta.", "Distingui area con storico e area vergine e annota il controllo richiesto."),
  outline("target", 3, "Aspettativa e invalidazione", "Dichiarare cosa ci si aspetta e come rispondere se il contesto cambia.", "Scrivi aspettativa, invalidazione e risposta prevista per il caso studiato."),
  outline("scalp", 1, "Scalp: contesto H1", "Registrare un caso originale con zone H1, liquidità e scelta dello scenario.", "Ricostruisci il contesto senza osservare l'esito successivo."),
  outline("scalp", 2, "Scalp: da M15 a M1", "Mostrare le conferme del caso scelto, usando le definizioni del docente.", "Documenta le conferme e un punto in cui sarebbe stato necessario attendere."),
  outline("scalp", 3, "Scalp: sessione completa", "Replay commentato dalla preparazione al consuntivo, includendo costi ed eventuali errori.", "Consegna la scheda di simulazione e una revisione del piano."),
  outline("swing", 1, "Swing: Daily e H4", "Registrare un caso originale con ciclo Daily e zona H4.", "Annota contesto, zona e condizioni di attesa."),
  outline("swing", 2, "Swing: H1/M15 e M5/M1", "Mostrare la discesa sui timeframe del metodo e le conferme richieste.", "Ricostruisci la sequenza e le invalidazioni osservabili."),
  outline("swing", 3, "Swing: caso completo", "Seguire preparazione, evoluzione, gestione e consuntivo di un caso documentato.", "Consegna una simulazione motivata distinguendo piano ed esito."),
  outline("revisione", 1, "Registrare evidenze", "Distinguere simulazione, reale, aderenza e risultato economico dopo i costi.", "Compila un'evidenza indicando fonte, ambiente e dati mancanti."),
  outline("revisione", 2, "Rivedere anche perdite e attese", "Commentare casi favorevoli, sfavorevoli e senza operazioni, senza selezionare solo i successi.", "Confronta processo ed esito di due casi diversi."),
  outline("revisione", 3, "Una correzione verificabile", "Collegare la revisione a una sola azione e a un criterio osservabile.", "Proponi una correzione e il modo in cui ne verificherai l'applicazione."),
];

export interface AcademyLessonInput {
  moduleId: AcademyModuleId;
  syllabusId?: string | null;
  title: string;
  description?: string;
  videoUrl?: string | null;
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
}
export interface AcademyLesson extends AcademyLessonMetadata {
  videoUrl: string | null;
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
