import { useEffect, useReducer, useRef, useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { Seo } from "@/components/Seo";
import {
  absoluteUrl,
  aureusKnowledgeGraphJsonLd,
  faqJsonLd,
  landingAlternates,
  landingPath,
  seoPagePath,
  SEO_PAGE_KEYS,
} from "@/lib/seo";
import { initialTourState, isTourComplete, tourReducer } from "@/lib/landingTour";
import { trackEvent } from "@/lib/analytics";
import { startLandingMotion } from "@/lib/landingMotion";
import { LandingNavigation } from "@/components/landing/LandingNavigation";
import { GatekeepingModal } from "@/components/stealth/GatekeepingModal";
import { HeroAtmosphere } from "@/components/landing/HeroAtmosphere";
import { PricingAtmosphere } from "@/components/landing/PricingAtmosphere";
import { SigilIcon, type SigilVariant } from "@/components/ui/SigilIcon";
import { captureStealthReferral } from "@/lib/stealthTracking";
import { LIMEN_GRADES, type LimenGradeNumber } from "../../../../contracts/limenGrades";
import { isDotazionePromoActive } from "../../../../contracts/limenServices";
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Check,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
  Users,
  Volume2,
  VolumeX,
  Maximize2,
  Key,
  Scale,
  Coins,
  FlaskConical,
  GraduationCap,
  Crosshair,
  Flame,
  Layers,
  Trophy,
} from "lucide-react";
import "./LandingPage.css";

export interface FaqItemDef {
  readonly id: string;
  readonly roman: string;
  readonly badgeKey: string;
  readonly questionKey: string;
  readonly answerKey: string;
  readonly tagKey: string;
}

export const FAQ_ITEMS: readonly FaqItemDef[] = [
  {
    id: "admission",
    roman: "I",
    badgeKey: "landing.faq.admission.badge",
    questionKey: "landing.faq.admission.question",
    answerKey: "landing.faq.admission.answer",
    tagKey: "landing.faq.admission.tag",
  },
  {
    id: "cancellation",
    roman: "II",
    badgeKey: "landing.faq.cancellation.badge",
    questionKey: "landing.faq.cancellation.question",
    answerKey: "landing.faq.cancellation.answer",
    tagKey: "landing.faq.cancellation.tag",
  },
  {
    id: "signals",
    roman: "III",
    badgeKey: "landing.faq.signals.badge",
    questionKey: "landing.faq.signals.question",
    answerKey: "landing.faq.signals.answer",
    tagKey: "landing.faq.signals.tag",
  },
  {
    id: "grades",
    roman: "IV",
    badgeKey: "landing.faq.grades.badge",
    questionKey: "landing.faq.grades.question",
    answerKey: "landing.faq.grades.answer",
    tagKey: "landing.faq.grades.tag",
  },
  {
    id: "beginners",
    roman: "V",
    badgeKey: "landing.faq.beginners.badge",
    questionKey: "landing.faq.beginners.question",
    answerKey: "landing.faq.beginners.answer",
    tagKey: "landing.faq.beginners.tag",
  },
  {
    id: "security",
    roman: "VI",
    badgeKey: "landing.faq.security.badge",
    questionKey: "landing.faq.security.question",
    answerKey: "landing.faq.security.answer",
    tagKey: "landing.faq.security.tag",
  },
  {
    id: "selection",
    roman: "VII",
    badgeKey: "landing.faq.selection.badge",
    questionKey: "landing.faq.selection.question",
    answerKey: "landing.faq.selection.answer",
    tagKey: "landing.faq.selection.tag",
  },
] as const;

export interface BlindSpotItem {
  readonly id: "revenge" | "fomo" | "overtrading";
  readonly number: string;
  readonly badge: string;
  readonly title: string;
  readonly trigger: string;
  readonly unseenDoor: string;
  readonly shieldModule: {
    readonly number: string;
    readonly title: string;
    readonly actionBadge: string;
    readonly howItWorks: string;
  };
  readonly openQuestion: string;
  readonly cta: string;
  readonly gatekeepingReason: string;
}

export const BLIND_SPOTS: readonly BlindSpotItem[] = [
  {
    id: "revenge",
    number: "01",
    badge: "LA RABBIA DOPO IL DISSANGUE",
    title: "La Fretta di Recuperare",
    trigger: "Chiudi un'operazione in perdita e ne apri subito un'altra per non andare a dormire sconfitto.",
    unseenDoor: "Perché quando spegni il computer la tua lucidità torna all'istante, ma davanti ai grafici diventi furia cieca? Non è sfortuna: è il tuo ego che rifiuta di ammettere un limite.",
    shieldModule: {
      number: "MODULO III",
      title: "Il Custode della Soglia",
      actionBadge: "BLOCCO AUTOMATICO 60 MINUTI",
      howItWorks: "Rileva la frequenza anomala degli ordini dopo uno stop loss e ti toglie fisicamente le chiavi di mano. Nessun ordine può partire finché il tuo battito non torna calmo.",
    },
    openQuestion: "Se ieri qualcuno ti avesse fisicamente impedito quel singolo secondo clic, quanto capitale e quante notti di serenità avresti risparmiato?",
    cta: "METTI QUESTO SCUDO TRA TE E L'ERRORE",
    gatekeepingReason: "Diagnosi Punto Cieco: La Fretta di Recuperare (Custode della Soglia)",
  },
  {
    id: "fomo",
    number: "02",
    badge: "L'INVIDIA DEI SOCIAL",
    title: "La Paura di Restare a Guardare",
    trigger: "Vedi un prezzo esplodere o gli altri esultare online e compri in ritardo, esattamente sui massimi.",
    unseenDoor: "Comprare quando tutti festeggiano non è fiuto: è cadere nella trappola di chi sta vendendo proprio a te. Se compri spinto dall'ansia di restare a guardare, chi sta davvero decidendo per la tua vita?",
    shieldModule: {
      number: "MODULO II",
      title: "La Forgia del Passato",
      actionBadge: "SIMULATORE A RISCHIO ZERO",
      howItWorks: "Prima di rischiare anche un solo centesimo reale, rivivi 50 volte la stessa identica scena sui mercati storici. Scopri cosa accade a chi entra in ritardo prima di pagare il conto.",
    },
    openQuestion: "Cosa cambierebbe nella tua sicurezza se potessi vedere il finale del film prima di comprare il biglietto?",
    cta: "IMPARA A VEDERE IL FINALE A RISCHIO ZERO",
    gatekeepingReason: "Diagnosi Punto Cieco: La Paura di Restare Fuori (Forgia del Passato)",
  },
  {
    id: "overtrading",
    number: "03",
    badge: "L'ILLUSIONE DELL'AZIONE",
    title: "La Noia dei Giorni Calmi",
    trigger: "I mercati non si muovono e non ci sono occasioni chiare, ma senti il bisogno irrefrenabile di fare qualcosa.",
    unseenDoor: "Chi ha stabilito che per essere un professionista bisogna cliccare ogni giorno? Un cecchino spara a casaccio o attende per ore il bersaglio perfetto? Rimanere fermi è l'atto di forza più puro.",
    shieldModule: {
      number: "MODULO IV & I",
      title: "L'Ordine Giornaliero & La Dottrina del Tempo",
      actionBadge: "TETTO MASSIMO DI SESSIONE",
      howItWorks: "Imposta un tetto insuperabile di operazioni consentite. Raggiunta la quota o concluse le ore d'oro, la piattaforma si serra e il tuo conto resta intatto.",
    },
    openQuestion: "Cosa faresti del tuo tempo libero se il trading smettesse di essere una gabbia mentale e diventasse un protocollo di venti minuti?",
    cta: "SCOPRI IL CODICE DI DISCIPLINA",
    gatekeepingReason: "Diagnosi Punto Cieco: La Noia dei Giorni Calmi (L'Ordine Giornaliero)",
  },
] as const;

export interface SoftwareModule {
  id: string;
  number: string;
  category: string;
  title: string;
  description: React.ReactNode;
  criterion: string;
  sigilVariant: SigilVariant;
  model3d?: {
    src: string;
    webp?: string;
    alt: string;
    badge: string;
    title: string;
    details: string;
    highlights: string[];
  };
}

export const SOFTWARE_MODULES: SoftwareModule[] = [
  {
    id: "modulo-1",
    number: "MODULO I",
    category: "STRATEGIA & TEMPO",
    title: "La Dottrina del Tempo",
    description: (
      <>
        E se il tuo vero errore non fosse cosa fai, ma il fatto che operi nelle ore in cui dovresti solo restare a guardare?
      </>
    ),
    criterion: "DOMANDA APERTA: Quanta ansia risparmieresti se sapessi esattamente quando non toccare nulla?",
    sigilVariant: "doctrine",
    model3d: {
      src: "/images/modules/modulo-1-dottrina.jpg",
      webp: "/images/modules/modulo-1-dottrina.webp",
      alt: "La Dottrina del Tempo - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "La Dottrina del Tempo",
      details: "Diorama tridimensionale del Cronografo Sacro: cassa circolare in bronzo brunito, cristallo zaffiro con lancette a sestante, movimento a vista e clessidra in ottone per scandire la perfetta separazione tra attesa strategica ed esecuzione istantanea.",
      highlights: [
        "Lancette a Sestante: le uniche finestre della giornata in cui i mercati offrono vero valore",
        "Clessidra di Precisione: l'arte dell'attesa rilassata prima dell'azione chirurgica al minuto",
        "Ghiera Incisa: regole nitide per non farsi mai cogliere dal dubbio",
      ],
    },
  },
  {
    id: "modulo-2",
    number: "MODULO II",
    category: "PALESTRA A RISCHIO ZERO",
    title: "La Forgia del Passato",
    description: (
      <>
        Un pilota volerebbe mai senza simulatore? Perché tu continui a rischiare i tuoi sacrifici per imparare?
      </>
    ),
    criterion: "DOMANDA APERTA: Come cambierebbe la tua sicurezza se potessi ripetere una scena 100 volte a costo zero?",
    sigilVariant: "forge",
    model3d: {
      src: "/images/modules/modulo-2-forgia.jpg",
      webp: "/images/modules/modulo-2-forgia.webp",
      alt: "La Forgia del Passato - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "La Forgia del Passato",
      details: "Diorama tridimensionale dell'Officina Meccanica di Simulazione: incudine d'acciaio temprato, grafici forgiati a fuoco vivo e clessidra di sabbia dorata per riavvolgere il tempo e allenarsi a mercato chiuso.",
      highlights: [
        "Grafici Storici a Fuoco: simulazione reale per allenare l'occhio senza fretta né ansia",
        "Clessidra del Replay: riavvolgi, rallenta o accelera il flusso del tempo a tuo piacimento",
        "Incudine Protetta: perfeziona il tuo metodo senza esporre un solo centesimo reale",
      ],
    },
  },
  {
    id: "modulo-3",
    number: "MODULO III",
    category: "SCUDO AUTOMATICO",
    title: "Il Custode della Soglia",
    description: (
      <>
        Chi ti toglie le chiavi di mano quando la rabbia dopo uno sbaglio ti spinge a fare scelte assurde?
      </>
    ),
    criterion: "DOMANDA APERTA: Quanto capitale avresti salvato se un guardiano avesse bloccato i tuoi 3 errori peggiori?",
    sigilVariant: "keeper",
    model3d: {
      src: "/images/modules/modulo-3-custode.jpg",
      webp: "/images/modules/modulo-3-custode.webp",
      alt: "Il Custode della Soglia - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "Il Custode della Soglia",
      details: "Diorama tridimensionale del Portale Blindato del Protocollo: grata in ferro battuto con barre d'acciaio, snodi di blocco automatico e indicatori luminosi di lucidità mentale prima di ogni decisione.",
      highlights: [
        "Serratura di Blocco: sbarra il passaggio se rileva foga emotiva o stanchezza",
        "Grata d'Acciaio: barriera invalicabile contro la tentazione di fare troppe operazioni",
        "Indicatori di Lucidità: accesso consentito solo a mente fredda, calma e riposata",
      ],
    },
  },
  {
    id: "modulo-4",
    number: "MODULO IV",
    category: "SPECCHIO DELLE ABITUDINI",
    title: "Il Libro della Verità",
    description: (
      <>
        Sei pronto a guardare in faccia l'unica cosa che continui a giustificare e a nascondere a te stesso?
      </>
    ),
    criterion: "DOMANDA APERTA: Gestiresti un'azienda senza registrare le perdite? Perché lo fai con la tua vita?",
    sigilVariant: "book-of-truth",
    model3d: {
      src: "/images/modules/modulo-4-verita.jpg",
      webp: "/images/modules/modulo-4-verita.webp",
      alt: "Il Libro della Verità - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "Il Libro della Verità",
      details: "Diorama tridimensionale del Grande Tomo della Chiarezza: pagine metalliche incise con i dati reali delle tue scelte, catene contro le auto-illusioni e calibri di precisione sotto il motto 'I fatti non mentono mai'.",
      highlights: [
        "Pagine Incise: tracciamento trasparente che azzera gli alibi e mostra la realtà",
        "Mappa delle Abitudini: individua all'istante l'errore ricorrente che ti costa più caro",
        "Indice di Integrità: misura quanto sei capace di mantenere la parola data a te stesso",
      ],
    },
  },
  {
    id: "modulo-5",
    number: "MODULO V",
    category: "SFIDE DI DISCIPLINA TRA PARI",
    title: "La Gerarchia e Le Prove del Fuoco",
    description: (
      <>
        È facile credersi forti nella propria stanza. Ma cosa succede quando ti misuri con chi non sgarra mai?
      </>
    ),
    criterion: "DOMANDA APERTA: Vuoi l'illusione di un colpo fortunato o l'autorevolezza che non crolla mai?",
    sigilVariant: "hierarchy",
    model3d: {
      src: "/images/modules/modulo-5-gerarchia.jpg",
      webp: "/images/modules/modulo-5-gerarchia.webp",
      alt: "La Gerarchia e Le Prove del Fuoco - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "La Gerarchia e Le Prove del Fuoco",
      details: "Diorama tridimensionale della Ziggurat delle Prove: scalinate monumentali ad ascesa progressiva, bracieri accesi e altare sommitale del sigillo di merito per chi dimostra reale costanza nel tempo.",
      highlights: [
        "Altare del Merito: riconoscimento del traguardo raggiunto grazie alla pura disciplina",
        "Scalinate delle Prove: avanzamento di livello passo dopo passo, senza scorciatoie",
        "Fuoco Purificatore: liberazione dalle cattive abitudini e dalla fretta compulsiva",
      ],
    },
  },
  {
    id: "modulo-6",
    number: "MODULO VI",
    category: "ALLEANZA STRATEGICA LIVE",
    title: "Il Concilio della Domenica",
    description: (
      <>
        Come cambia il tuo lunedì mattina se la domenica sera hai già previsto ogni possibile scenario insieme agli altri?
      </>
    ),
    criterion: "DOMANDA APERTA: Preferisci farti sorprendere dai mercati o aspettarli al varco con totale calma?",
    sigilVariant: "brotherhood",
    model3d: {
      src: "/images/modules/modulo-6-concilio.jpg",
      webp: "/images/modules/modulo-6-concilio.webp",
      alt: "Il Concilio della Domenica - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "Il Concilio della Domenica",
      details: "Diorama tridimensionale della Sala delle Mappe: cupola a volta, tavola rotonda con mappe strategiche, bracieri e sfera centrale dorata per pianificare la settimana con calma e visione lucida.",
      highlights: [
        "Sfera di Visione: orientamento chiaro sulle dinamiche economiche prima dell'apertura",
        "Tavola Rotonda: confronto live e allineamento con la cerchia prima che i mercati aprano",
        "Ambiente di Serenità: azzera i dubbi per iniziare la settimana a mente sgombra",
      ],
    },
  },
];

export interface Grade3DModelData {
  src: string;
  webp?: string;
  alt: string;
  badge: string;
  title: string;
  subtitle: string;
  caption: string;
  details: string;
  highlights: string[];
}

export const GRADE_3D_MODELS: Record<LimenGradeNumber, Grade3DModelData | null> = {
  1: {
    src: "/images/grades/grado-1-novizio.jpg",
    alt: "Grado I — Novizio Consapevole: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "GRADO I — NOVIZIO CONSAPEVOLE",
    subtitle: "IL PRIMO PASSO // AUREUS",
    caption: "Diorama Iniziativo: La Promessa con Se Stessi & La Soglia di Partenza",
    details:
      "Scena visiva rappresentativa dell'Ingresso nell'Ordine: l'operatore muove i suoi primi passi verso il cambiamento, sottoscrivendo una promessa di disciplina sul leggio illuminato da candele. Sullo sfondo, il portale blindato protegge l'accesso alla Forgia del Passato, dove ci si allena senza rischiare denaro reale.",
    highlights: [
      "La Promessa di Rispetto: impegno sincero verso se stessi per smettere di agire impulsivamente",
      "Il Leggio di Studio: riscoprire il valore dell'attesa, della calma e dell'apprendimento paziente",
      "La Soglia Protetta: la separazione netta tra il disordine dell'azzardo e la serenità del metodo",
      "Il Sigillo del Novizio: l'inizio del cammino verso la vera padronanza personale",
    ],
  },
  2: {
    src: "/images/grades/grado-2-custode.jpg",
    alt: "Grado II — Il Custode della Regola: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "GRADO II — IL CUSTODE DELLA REGOLA",
    subtitle: "LA COSTANZA DIMOSTRATA // AUREUS",
    caption: "Diorama Iniziativo: Il Ponte sulla Paura & Il Guardiano del Metodo",
    details:
      "Scena visiva rappresentativa della Prova di Costanza: l'operatore attraversa con passo fermo il ponte di pietra sospeso sul baratro delle emozioni verso la porta sorvegliata dal Custode della Regola. Sullo sfondo si aprono gli archivi della conoscenza condivisa, accessibili solo a chi dimostra fedeltà duratura alle proprie regole.",
    highlights: [
      "Il Ponte sulla Paura: superare l'ansia e il dubbio attraverso 30 sessioni consecutive di piena coerenza",
      "Il Guardiano del Metodo: una guida inflessibile che ricorda che le regole servono a proteggerti",
      "Il Portale della Costanza: accesso concesso solo a chi ha dimostrato di non cedere alle tentazioni emotive",
      "L'Apertura alla Comunità: diritto di trasmettere il metodo ad altri e azzerare i costi del proprio percorso",
    ],
  },
  3: {
    src: "/images/grades/grado-3-osservatore.jpg",
    alt: "Grado III — L'Osservatore Sovrano: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "GRADO III — L'OSSERVATORE SOVRANO",
    subtitle: "LA CALMA INTERIORE // AUREUS",
    caption: "La Visione Distaccata e la Mente Serena",
    details:
      "Scena visiva rappresentativa dell'Osservatorio: l'operatore domina la terrazza panoramica contemplando i grandi movimenti con un monumentale telescopio. Circondato da mappe e strumenti di precisione, osserva il fluire delle cose senza farsi travolgere dalla fretta o dalle illusioni momentanee.",
    highlights: [
      "Il Grande Telescopio: capacità di guardare lontano e cogliere i momenti propizi senza alcuna ansia",
      "Armonia del Ritmo: padronanza del proprio tempo, del riposo e della lucidità mentale",
      "La Tavola di Pianificazione: preparazione serena e partecipazione attiva agli incontri della domenica",
      "La Terrazza sulla Fortezza: elevarsi al di sopra del caos per decidere con distacco e chiarezza",
    ],
  },
  4: {
    src: "/images/grades/grado-4-architetto.jpg",
    alt: "Grado IV — L'Architetto del Reale: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "GRADO IV — L'ARCHITETTO DEL REALE",
    subtitle: "LA MAESTRIA DELLA VITA // AUREUS",
    caption: "Dalla Precisione dei Grafici alla Solidità Reale",
    details:
      "Scena visiva rappresentativa dell'Officina dell'Architetto: il costruttore esperto disegna con compasso e righe millimetriche su pergamene tecniche. Sullo sfondo, il cantiere della vita in espansione testimonia la trasformazione dell'autocontrollo in stabilità economica tangibile per sé e per i propri cari.",
    highlights: [
      "Il Compasso di Precisione: trasformare l'autodisciplina quotidiana in solide fondamenta finanziarie",
      "Il Cantiere del Futuro: costruzione paziente e duratura di sicurezza economica nel mondo reale",
      "La Voce dell'Esperienza: punto di riferimento e guida saggia all'interno della fratellanza",
      "Verifica Costante: rigore continuo per mantenere standard elevati senza mai abbassare la guardia",
    ],
  },
  5: {
    src: "/images/grades/grado-5-fondatore.jpg",
    alt: "Grado V — Il Fondatore d'Eredità: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "GRADO V — IL FONDATORE D'EREDITÀ",
    subtitle: "IL VALORE CONDIVISO // AUREUS",
    caption: "La Trasmissione del Valore e la Consacrazione del Percorso",
    details:
      "Scena visiva rappresentativa della Sala del Sigillo: il Fondatore d'Eredità appone il sigillo di ceralacca sul grande libro della saggezza operativa. La grande sala con le sue volte e la biblioteca simboleggia il compimento del viaggio: l'esperienza individuale diventa patrimonio comune e guida per chi muove i primi passi.",
    highlights: [
      "Il Sigillo della Saggezza: consacrazione di un percorso vissuto con integrità e rispetto assoluto delle regole",
      "Il Grande Libro dei Principi: la sintesi di tutte le lezioni apprese, a disposizione delle future generazioni",
      "La Sala dei Valori: serenità interiore, sicurezza materiale e gratitudine per il cammino percorso",
      "L'Eredità Eterna: la certezza che la vera ricchezza consiste nella persona che sei diventato",
    ],
  },
};

export interface LandingGradeInfo {
  requirement: string;
  privileges: string[];
}

export const LANDING_GRADE_INFO: Record<LimenGradeNumber, LandingGradeInfo> = {
  1: {
    requirement:
      "Hai il coraggio di ammettere che l'istinto ti sabota e accetti di allenarti a rischio zero prima di toccare un solo euro?",
    privileges: [
      "Palestra a Rischio Zero: sbaglia e sperimenta mille volte senza spendere un centesimo",
      "La Mappa del Tempo: scopri quando agire e quando è vitale non fare assolutamente nulla",
      "Scudo Anti-Fretta: un blocco automatico prima di pentirti delle tue azioni impulsive",
      "Registro delle Scelte: scopri chi sei veramente quando sei sotto pressione",
    ],
  },
  2: {
    requirement:
      "Riesci a rispettare la tua parola per 30 sessioni consecutive senza cedere nemmeno una volta all'impulso?",
    privileges: [
      "Il Tempio Fisico: gestione dell'energia corporea, del sonno e della lucidità mentale",
      "Mandato di Espansione: condividi il metodo e azzera il tuo canone a vita con 5 persone",
      "Sfide tra Membri: confrontati nelle prove di pura costanza e autocontrollo tra pari",
    ],
  },
  3: {
    requirement:
      "90 giorni di calma assoluta: il mercato si muove forte, ma la tua mente resta impassibile.",
    privileges: [
      "Accesso prioritario e confronto diretto durante Il Concilio della Domenica sera",
      "Protocolli avanzati di distacco emotivo per decisioni critiche ad alto valore",
      "Riconoscimento ufficiale tra i membri anziani della fratellanza",
    ],
  },
  4: {
    requirement:
      "La disciplina interiore diventa sicurezza economica tangibile nel mondo reale per te e la tua famiglia.",
    privileges: [
      "Diventi mentore e guida per chi sta affrontando le tempeste che tu hai già superato",
      "Pianificazione avanzata per proteggere e far fruttare il capitale nel lungo termine",
      "Invito ai tavoli ristretti di progettazione strategica dell'Ordine",
    ],
  },
  5: {
    requirement:
      "Piena maestria: hai dominato te stesso e la tua esperienza è diventata una guida per le generazioni future.",
    privileges: [
      "Iscrizione permanente nell'Albo d'Onore di AUREUS PROTOCOL",
      "Partecipazione alle scelte evolutive della piattaforma e del metodo",
      "La certezza che la vera ricchezza è la libertà personale che hai conquistato",
    ],
  },
};

export interface ManifestoSceneData {
  id: number;
  src: string;
  webp?: string;
  alt: string;
  badge: string;
  title: string;
  subtitle: string;
  caption: string;
  details: string;
  highlights: string[];
}

export const MANIFESTO_SCENES: Record<number, ManifestoSceneData | null> = {
  1: {
    id: 1,
    src: "/images/manifesto/la-deriva.jpg",
    alt: "Stato Inconscio // Il Caos - I // La Deriva: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "I — LA DERIVA (IL CAOS EMOTIVO)",
    subtitle: "IL MANIFESTO DELL'ORDINE // SCENA I",
    caption: "Diorama Visivo: La tempesta delle illusioni e la deriva di chi agisce d'impulso",
    details:
      "Scena visiva rappresentativa dello Stato di Caos: una chiatta industriale naviga in balia di una tempesta violenta e onde scure. Una folla disorientata di persone con sguardi ansiosi insegue segnali illusori e prezzi impazziti, illuminata solo da bagliori d'allarme, priva di un timone e di una rotta.",
    highlights: [
      "La Chiatta nella Tempesta: muoversi alla cieca senza un metodo né una rotta sicura, in balia della paura",
      "L'Inseguimento delle Illusioni: farsi attrarre da false promesse di guadagni facili e cadere nella rabbia dopo ogni perdita",
      "Gli Schermi dell'Ansia: notti insonni e ore rubate alla vita davanti ai grafici senza mai trovare serenità",
      "Il Risultato del Disordine: il motivo per cui il 95% delle persone si arrende e brucia i propri sacrifici",
    ],
  },
  2: {
    id: 2,
    src: "/images/manifesto/il-varco.jpg",
    alt: "La Scelta // Il Varco: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "II — IL VARCO (LA SCELTA CONSAPEVOLE)",
    subtitle: "IL MANIFESTO DELL'ORDINE // SCENA II",
    caption: "Diorama Visivo: L'abbandono del caos e il passaggio verso la sicurezza del metodo",
    details:
      "Scena visiva rappresentativa della Decisione: l'operatore volta definitivamente le spalle alla tempesta disordinata per incamminarsi verso il monumentale portale di pietra e ferro. Ai lati, i guardiani vegliano sui bracieri, mentre al leggio viene registrata la scelta di vivere secondo regole chiare e trasparenti.",
    highlights: [
      "Il Passo Decisivo: l'abbandono del gioco d'azzardo, della fretta compulsiva e delle promesse vuote",
      "Il Portale Protetto: una barriera invalicabile creata per difendere i tuoi risparmi dalle scelte emotive",
      "I Fuochi della Determinazione: la riscoperta della pazienza, dell'onestà e della calma mentale",
      "La Scrittura delle Scelte: registrare ogni decisione per imparare davvero e non mentire mai a se stessi",
    ],
  },
  3: {
    id: 3,
    src: "/images/manifesto/gli-architetti.jpg",
    alt: "Padronanza Assoluta // Gli Architetti: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "III — GLI ARCHITETTI (LA VERA PADRONANZA)",
    subtitle: "IL MANIFESTO DELL'ORDINE // SCENA III",
    caption: "Diorama Visivo: La Sala della Serenità e la Padronanza del Proprio Futuro",
    details:
      "Scena visiva rappresentativa della Serenità Operativa: nella grandiosa sala con vista sull'orizzonte, gli Architetti siedono attorno alla tavola di progettazione. Mappe chiare, compassi di precisione e mente distaccata: fuori la tempesta continua a infuriare, ma all'interno regna una calma assoluta e incrollabile.",
    highlights: [
      "La Tavola di Progettazione: pianificare ogni azione con calma prima di compiere qualsiasi passo",
      "Strumenti di Precisione: calcolare sempre il rischio per proteggere il capitale e farlo crescere nel tempo",
      "Il Momento Perfetto: agire solo quando le condizioni sono favorevoli, senza esitare e senza rimpianti",
      "La Calma Olimpica: vivere i mercati con serenità interiore, liberi dall'ansia che logora la massa",
    ],
  },
};

export interface ExpansionSceneData {
  src: string;
  webp?: string;
  alt: string;
  badge: string;
  title: string;
  subtitle: string;
  caption: string;
  details: string;
  criterion: string;
  highlights: string[];
}

export const EXPANSION_SCENE: ExpansionSceneData = {
  src: "/images/expansion/mandato-espansione.jpg",
  webp: "/images/expansion/mandato-espansione.webp",
  alt: "Ufficio del Tesoro e dei Mandati dell'Ordine: Il Sigillo dell'Autofinanziamento e la Regola dei 5 Membri",
  badge: "MODELLO 3D // BLENDER",
  title: "LA REGOLA DEI 5 // VALORE CONDIVISO",
  subtitle: "PERCHÉ PAGARE SE IL SOFTWARE PUÒ PAGARE TE?",
  caption: "Diorama Visivo: Il Sigillo dell'Autofinanziamento e l'Accesso Gratuito a Vita",
  details:
    "Scena visiva dell'Ufficio dei Mandati: il cancelliere appone il sigillo sul registro, ratificando l'azzeramento definitivo del canone mensile per l'operatore che ha condiviso il metodo. Sulla bilancia di precisione, il costo dell'abbonamento viene perfettamente bilanciato dalle royalty maturate.",
  criterion: "LA REGOLA DEI 5: 5 Compagni di Viaggio × 30€/m = costo azzerato al 100% per sempre. Dalla 6ª persona in poi: rendita mensile netta per te.",
  highlights: [
    "Le 5 Chiavi sul Vassoio: simbolo tangibile delle 5 persone necessarie per rendere l'abbonamento gratuito a vita",
    "La Bilancia in Perfetto Equilibrio: equilibrio esatto tra quota mensile dovuta (150€) e royalty maturate (5 × 30€ = 150€), costo netto zero",
    "Il Sigillo Ufficiale: registrazione trasparente nel proprio profilo, premiando la crescita organica e l'aiuto reciproco",
    "Fratellanza tra Pari: una cerchia selezionata di persone motivate che condividono lo stesso ideale di libertà",
    "Trasparenza Meccanica: monitoraggio chiaro e immediato delle royalty accreditate ogni mese direttamente sul tuo account",
  ],
};

function Grade3DCard({
  gradeDef,
  model3d,
  onInspect,
}: {
  gradeDef: (typeof LIMEN_GRADES)[number];
  model3d: Grade3DModelData | null;
  onInspect: (model: Grade3DModelData) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - y) * 10;
    const ry = (x - 0.5) * 12;
    setTilt({
      rx,
      ry,
      glareX: Math.round(x * 100),
      glareY: Math.round(y * 100),
      active: true,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false });
  };

  if (!model3d) {
    return (
      <div className="relative aspect-[1024/764] w-full rounded-2xl overflow-hidden bg-gradient-to-b from-[#14141A] to-[#0A0A0C] border border-[#24242C] p-6 flex flex-col items-center justify-center text-center shadow-[inset_0_0_50px_rgba(0,0,0,0.9)]">
        {/* Subtle radial pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(197,160,89,0.08)_0%,transparent_70%)] pointer-events-none" />

        {/* Sacred Architecture Corner Brackets */}
        <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#C5A059]/40 pointer-events-none z-20" />
        <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#C5A059]/40 pointer-events-none z-20" />
        <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#C5A059]/40 pointer-events-none z-20" />
        <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#C5A059]/40 pointer-events-none z-20" />

        {/* Center seal */}
        <div className="relative z-10 flex flex-col items-center justify-center space-y-3 py-6">
          <div className="relative flex items-center justify-center h-20 w-20 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/5 shadow-[0_0_30px_rgba(197,160,89,0.15)]">
            <SigilIcon variant={gradeDef.sigilId} size={36} className="text-[#C5A059]/70" />
            <div className="absolute -inset-1 rounded-full border border-[#C5A059]/20 animate-pulse" />
          </div>
          <div>
            <h4 className="font-serif text-base font-bold text-white tracking-wide">
              Architettura Visiva in Forgiatura
            </h4>
            <p className="font-sans text-xs text-[#8E8E99] max-w-xs mx-auto mt-1 leading-relaxed">
              Il diorama tridimensionale per {gradeDef.code} è in fase di elaborazione e verrà sbloccato progressivamente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onInspect(model3d)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInspect(model3d);
        }
      }}
      aria-label={`Visualizza scena per ${gradeDef.code}`}
      style={{
        perspective: 1000,
      }}
      className="group relative cursor-pointer outline-none select-none w-full"
    >
      <div
        style={{
          transform: tilt.active
            ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(1.015, 1.015, 1.015)`
            : "rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
          transition: tilt.active ? "transform 0.1s ease-out" : "transform 0.5s ease-out",
          transformStyle: "preserve-3d",
        }}
        className="relative aspect-[1024/764] w-full rounded-2xl overflow-hidden bg-[#050508] border border-[#C5A059]/40 group-hover:border-[#C5A059]/90 transition-colors duration-300 shadow-[inset_0_0_50px_rgba(0,0,0,0.9),0_12px_36px_rgba(0,0,0,0.85)] group-hover:shadow-[0_0_40px_rgba(197,160,89,0.3)]"
      >
        {/* Dynamic Sheen overlay driven by mouse */}
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300"
          style={{
            opacity: tilt.active ? 1 : 0,
            background: `radial-gradient(circle 350px at ${tilt.glareX}% ${tilt.glareY}%, rgba(197,160,89,0.18) 0%, transparent 60%)`,
          }}
        />

        {/* Ambient Warm Golden Aura */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,rgba(197,160,89,0.24)_0%,rgba(217,119,6,0.1)_38%,transparent_72%)] pointer-events-none" />

        {/* Sacred Architecture Corner Brackets */}
        <div className="absolute top-3 left-3 w-3.5 h-3.5 border-t-2 border-l-2 border-[#C5A059]/60 pointer-events-none z-20 group-hover:border-[#C5A059] group-hover:w-4 group-hover:h-4 transition-all duration-300" />
        <div className="absolute top-3 right-3 w-3.5 h-3.5 border-t-2 border-r-2 border-[#C5A059]/60 pointer-events-none z-20 group-hover:border-[#C5A059] group-hover:w-4 group-hover:h-4 transition-all duration-300" />
        <div className="absolute bottom-3 left-3 w-3.5 h-3.5 border-b-2 border-l-2 border-[#C5A059]/60 pointer-events-none z-20 group-hover:border-[#C5A059] group-hover:w-4 group-hover:h-4 transition-all duration-300" />
        <div className="absolute bottom-3 right-3 w-3.5 h-3.5 border-b-2 border-r-2 border-[#C5A059]/60 pointer-events-none z-20 group-hover:border-[#C5A059] group-hover:w-4 group-hover:h-4 transition-all duration-300" />

        {/* Hover-only subtle zoom icon */}
        <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center h-8 w-8 rounded-lg bg-[#0E0F14]/80 backdrop-blur-sm border border-[#C5A059]/50 text-[#C5A059] shadow-lg">
          <Maximize2 className="h-4 w-4" />
        </div>

        {/* 3D Render Image - Inquadratura completa 1024x764 */}
        <div className="absolute inset-0 flex items-center justify-center z-10 overflow-hidden">
          <picture className="w-full h-full flex items-center justify-center">
            {model3d.webp && <source srcSet={model3d.webp} type="image/webp" />}
            <img
              src={model3d.src}
              alt={model3d.alt}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out select-none"
            />
          </picture>
        </div>
      </div>
    </div>
  );
}

function ManifestoSceneCard({
  scene,
  accent = "gold",
  onInspect,
}: {
  scene: ManifestoSceneData;
  accent?: "red" | "gold";
  onInspect: (scene: ManifestoSceneData) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - y) * 10;
    const ry = (x - 0.5) * 12;
    setTilt({
      rx,
      ry,
      glareX: Math.round(x * 100),
      glareY: Math.round(y * 100),
      active: true,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false });
  };

  const isRed = accent === "red";

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onInspect(scene)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInspect(scene);
        }
      }}
      aria-label={`Visualizza scena per ${scene.title}`}
      style={{ perspective: 1000 }}
      className="group/scene relative cursor-pointer outline-none select-none w-full my-3"
    >
      <div
        style={{
          transform: tilt.active
            ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(1.02, 1.02, 1.02)`
            : "rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
          transition: tilt.active ? "transform 0.1s ease-out" : "transform 0.5s ease-out",
          transformStyle: "preserve-3d",
        }}
        className={`relative aspect-[1024/571] w-full rounded-xl overflow-hidden bg-[#07070A] border transition-colors duration-300 shadow-[inset_0_0_40px_rgba(0,0,0,0.9),0_8px_24px_rgba(0,0,0,0.7)] ${
          isRed
            ? "border-red-900/40 group-hover/scene:border-red-500/70 group-hover/scene:shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : "border-[#C5A059]/40 group-hover/scene:border-[#C5A059]/90 group-hover/scene:shadow-[0_0_30px_rgba(197,160,89,0.25)]"
        }`}
      >
        {/* Dynamic Sheen overlay driven by mouse */}
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300"
          style={{
            opacity: tilt.active ? 1 : 0,
            background: isRed
              ? `radial-gradient(circle 280px at ${tilt.glareX}% ${tilt.glareY}%, rgba(239,68,68,0.18) 0%, transparent 60%)`
              : `radial-gradient(circle 280px at ${tilt.glareX}% ${tilt.glareY}%, rgba(197,160,89,0.18) 0%, transparent 60%)`,
          }}
        />

        {/* Ambient Dark Red or Golden Aura */}
        <div
          className={`absolute inset-0 pointer-events-none ${
            isRed
              ? "bg-[radial-gradient(ellipse_at_50%_55%,rgba(220,38,38,0.18)_0%,rgba(153,27,27,0.08)_38%,transparent_72%)]"
              : "bg-[radial-gradient(ellipse_at_50%_55%,rgba(197,160,89,0.22)_0%,rgba(217,119,6,0.1)_38%,transparent_72%)]"
          }`}
        />

        {/* Sacred Architecture Corner Brackets */}
        <div
          className={`absolute top-2.5 left-2.5 w-3 h-3 border-t-2 border-l-2 pointer-events-none z-20 group-hover/scene:w-3.5 group-hover/scene:h-3.5 transition-all duration-300 ${
            isRed
              ? "border-red-500/60 group-hover/scene:border-red-400"
              : "border-[#C5A059]/60 group-hover/scene:border-[#C5A059]"
          }`}
        />
        <div
          className={`absolute top-2.5 right-2.5 w-3 h-3 border-t-2 border-r-2 pointer-events-none z-20 group-hover/scene:w-3.5 group-hover/scene:h-3.5 transition-all duration-300 ${
            isRed
              ? "border-red-500/60 group-hover/scene:border-red-400"
              : "border-[#C5A059]/60 group-hover/scene:border-[#C5A059]"
          }`}
        />
        <div
          className={`absolute bottom-2.5 left-2.5 w-3 h-3 border-b-2 border-l-2 pointer-events-none z-20 group-hover/scene:w-3.5 group-hover/scene:h-3.5 transition-all duration-300 ${
            isRed
              ? "border-red-500/60 group-hover/scene:border-red-400"
              : "border-[#C5A059]/60 group-hover/scene:border-[#C5A059]"
          }`}
        />
        <div
          className={`absolute bottom-2.5 right-2.5 w-3 h-3 border-b-2 border-r-2 pointer-events-none z-20 group-hover/scene:w-3.5 group-hover/scene:h-3.5 transition-all duration-300 ${
            isRed
              ? "border-red-500/60 group-hover/scene:border-red-400"
              : "border-[#C5A059]/60 group-hover/scene:border-[#C5A059]"
          }`}
        />

        {/* Hover-only subtle zoom icon */}
        <div
          className={`absolute top-2.5 right-2.5 z-20 opacity-0 group-hover/scene:opacity-100 transition-opacity duration-300 flex items-center justify-center h-7 w-7 rounded-lg bg-[#0E0F14]/85 backdrop-blur-sm border shadow-lg ${
            isRed
              ? "border-red-500/50 text-red-400"
              : "border-[#C5A059]/50 text-[#C5A059]"
          }`}
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </div>

        {/* Artwork Image - NO TEXT OVERLAYS / NO TAGS - full clean framing */}
        <div className="absolute inset-0 flex items-center justify-center z-10 overflow-hidden">
          <picture className="w-full h-full flex items-center justify-center">
            {scene.webp && <source srcSet={scene.webp} type="image/webp" />}
            <img
              src={scene.src}
              alt={scene.alt}
              loading="lazy"
              className="w-full h-full object-cover group-hover/scene:scale-[1.03] transition-transform duration-700 ease-out select-none"
            />
          </picture>
        </div>
      </div>
    </div>
  );
}

function ManifestoPlaceholderCard({
  roman,
  sigilVariant,
  accent = "gold",
}: {
  roman: string;
  sigilVariant: SigilVariant;
  accent?: "gold" | "red";
}) {
  return (
    <div className="relative aspect-[1024/571] w-full rounded-xl overflow-hidden bg-gradient-to-b from-[#141418] to-[#0A0A0C] border border-[#24242C] p-4 flex flex-col items-center justify-center text-center shadow-[inset_0_0_30px_rgba(0,0,0,0.85)] my-3">
      {/* Subtle radial glow */}
      <div
        className={`absolute inset-0 pointer-events-none ${
          accent === "gold"
            ? "bg-[radial-gradient(circle_at_50%_45%,rgba(197,160,89,0.08)_0%,transparent_70%)]"
            : "bg-[radial-gradient(circle_at_50%_45%,rgba(239,68,68,0.08)_0%,transparent_70%)]"
        }`}
      />

      {/* Sacred Architecture Corner Brackets */}
      <div className="absolute top-2.5 left-2.5 w-2.5 h-2.5 border-t-2 border-l-2 border-[#C5A059]/30 pointer-events-none z-20" />
      <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 border-t-2 border-r-2 border-[#C5A059]/30 pointer-events-none z-20" />
      <div className="absolute bottom-2.5 left-2.5 w-2.5 h-2.5 border-b-2 border-l-2 border-[#C5A059]/30 pointer-events-none z-20" />
      <div className="absolute bottom-2.5 right-2.5 w-2.5 h-2.5 border-b-2 border-r-2 border-[#C5A059]/30 pointer-events-none z-20" />

      {/* Center seal */}
      <div className="relative z-10 flex flex-col items-center justify-center space-y-2 py-2">
        <div className="relative flex items-center justify-center h-12 w-12 rounded-full border border-[#C5A059]/30 bg-[#C5A059]/5 shadow-[0_0_20px_rgba(197,160,89,0.12)]">
          <SigilIcon variant={sigilVariant} size={22} className="text-[#C5A059]/70" />
          <div className="absolute -inset-1 rounded-full border border-[#C5A059]/20 animate-pulse" />
        </div>
        <div>
          <span className="font-mono text-[9px] tracking-[0.2em] font-bold text-[#C5A059] uppercase block">
            SCENA VISIVA {roman} // IN FORGIATURA
          </span>
          <p className="font-sans text-[11px] text-[#8E8E99] mt-0.5">
            Diorama tridimensionale in fase di calibrazione
          </p>
        </div>
      </div>
    </div>
  );
}

function ExpansionSceneCard({
  scene,
  onInspect,
}: {
  scene: ExpansionSceneData;
  onInspect: (scene: ExpansionSceneData) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - y) * 8;
    const ry = (x - 0.5) * 10;
    setTilt({
      rx,
      ry,
      glareX: Math.round(x * 100),
      glareY: Math.round(y * 100),
      active: true,
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rx: 0, ry: 0, glareX: 50, glareY: 50, active: false });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onInspect(scene)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInspect(scene);
        }
      }}
      aria-label={`Visualizza scena per ${scene.title}`}
      style={{ perspective: 1200 }}
      className="group/scene relative cursor-pointer outline-none select-none w-full"
    >
      <div
        style={{
          transform: tilt.active
            ? `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale3d(1.015, 1.015, 1.015)`
            : "rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)",
          transition: tilt.active ? "transform 0.1s ease-out" : "transform 0.5s ease-out",
          transformStyle: "preserve-3d",
        }}
        className="relative aspect-[1024/571] w-full rounded-2xl overflow-hidden bg-[#07070A] border border-[#C5A059]/40 group-hover/scene:border-[#C5A059] transition-all duration-300 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_30px_rgba(197,160,89,0.15)] group-hover/scene:shadow-[0_25px_70px_rgba(0,0,0,0.9),0_0_40px_rgba(197,160,89,0.35)]"
      >
        {/* Dynamic Sheen overlay driven by mouse */}
        <div
          className="absolute inset-0 pointer-events-none z-30 transition-opacity duration-300"
          style={{
            opacity: tilt.active ? 1 : 0,
            background: `radial-gradient(circle 380px at ${tilt.glareX}% ${tilt.glareY}%, rgba(197,160,89,0.22) 0%, transparent 60%)`,
          }}
        />

        {/* Ambient Warm Golden Aura */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(197,160,89,0.22)_0%,rgba(217,119,6,0.08)_40%,transparent_75%)] pointer-events-none" />

        {/* Sacred Architecture Corner Brackets */}
        <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#C5A059]/70 pointer-events-none z-20 group-hover/scene:border-[#C5A059] transition-all duration-300" />
        <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#C5A059]/70 pointer-events-none z-20 group-hover/scene:border-[#C5A059] transition-all duration-300" />
        <div className="absolute bottom-3 left-3 w-3 h-3 border-b-2 border-l-2 border-[#C5A059]/70 pointer-events-none z-20 group-hover/scene:border-[#C5A059] transition-all duration-300" />
        <div className="absolute bottom-3 right-3 w-3 h-3 border-b-2 border-r-2 border-[#C5A059]/70 pointer-events-none z-20 group-hover/scene:border-[#C5A059] transition-all duration-300" />

        {/* Hover inspection pill */}
        <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#C5A059]/60 bg-[#0E0F14]/90 backdrop-blur-md text-[#C5A059] group-hover/scene:bg-[#C5A059] group-hover/scene:text-[#0A0A0C] font-mono text-[10px] font-bold tracking-wider uppercase transition-all duration-300 shadow-lg">
          <Maximize2 className="h-3 w-3" />
          <span>Ispeziona 3D</span>
        </div>

        {/* 3D Scene Image 1024x571 */}
        <div className="absolute inset-0 flex items-center justify-center z-10 overflow-hidden">
          <picture className="w-full h-full flex items-center justify-center">
            {scene.webp && <source srcSet={scene.webp} type="image/webp" />}
            <img
              src={scene.src}
              alt={scene.alt}
              loading="lazy"
              className="w-full h-full object-cover group-hover/scene:scale-[1.025] transition-transform duration-700 ease-out select-none"
            />
          </picture>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { t, language } = useLanguage();
  const [process, dispatch] = useReducer(tourReducer, initialTourState);
  const root = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLElement>(null);
  const tracked = useRef({ start: false, complete: false });

  // State for Gatekeeping Modal & Interactive Sections
  const [isGatekeepingOpen, setIsGatekeepingOpen] = useState(false);
  const [gatekeepingReason, setGatekeepingReason] = useState<string | undefined>(undefined);
  const [selectedBlindSpot, setSelectedBlindSpot] = useState<"revenge" | "fomo" | "overtrading">("revenge");
  const [pricingCycle, setPricingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedTierId, setSelectedTierId] = useState<"base_free" | "founders_10" | "complete_150">("founders_10");
  const [showComparisonMatrix, setShowComparisonMatrix] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeGrade, setActiveGrade] = useState<LimenGradeNumber>(1);
  const [invitedMembers, setInvitedMembers] = useState<number>(5);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const isPromoActive = isDotazionePromoActive();
  const [active3dModel, setActive3dModel] = useState<{
    title: string;
    subtitle: string;
    src: string;
    webp?: string;
    badge: string;
    description: string;
    criterion: string;
    highlights?: string[];
  } | null>(null);

  // Close 3D inspection modal on Escape key
  useEffect(() => {
    if (!active3dModel) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActive3dModel(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active3dModel]);

  // Capture stealth referral from URL on landing mount
  useEffect(() => {
    captureStealthReferral(window.location.search);
  }, []);

  useEffect(() => {
    if (root.current) return startLandingMotion(root.current);
    return undefined;
  }, []);

  useEffect(() => {
    const element = header.current;
    if (!element) return;
    const update = () =>
      root.current?.style.setProperty(
        "--landing-header-height",
        `${element.getBoundingClientRect().bottom}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (process.started && !tracked.current.start) {
      trackEvent("landing_demo_start", { language });
      tracked.current.start = true;
    }
    if (isTourComplete(process) && !tracked.current.complete) {
      trackEvent("landing_demo_complete", { language, steps: process.visited.length });
      tracked.current.complete = true;
    }
  }, [process, language]);

  const openGatekeeping = (
    reason?: string,
    tierId: "base_free" | "founders_10" | "complete_150" = "founders_10",
  ) => {
    setGatekeepingReason(reason);
    setSelectedTierId(tierId);
    setIsGatekeepingOpen(true);
    setMobileMenuOpen(false);
  };

  const faqSchema = faqJsonLd(
    language,
    FAQ_ITEMS.map(({ questionKey, answerKey }) => ({
      question: t(questionKey),
      answer: t(answerKey),
    })),
  );

  // Royalty 20% math: 30€/month per active member out of 150€
  const royaltyPerMember = 30;
  const monthlyRoyalty = invitedMembers * royaltyPerMember;
  const standardTribute = 150;
  const netTributeCost = Math.max(0, standardTribute - monthlyRoyalty);
  const netRecurringProfit = Math.max(0, monthlyRoyalty - standardTribute);
  const coveragePercent = Math.min(100, Math.round((monthlyRoyalty / standardTribute) * 100));

  const navLinks = [
    { label: "Il Manifesto", href: "#manifesto" },
    { label: "L'Ordine Giornaliero", href: "#features" },
    { label: "I 5 Gradi", href: "#how" },
    { label: "Espansione 20%", href: "#espansione" },
    { label: "Il Tributo", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
  ];

  const activeSpot = BLIND_SPOTS.find((s) => s.id === selectedBlindSpot) ?? BLIND_SPOTS[0];
  const currentGradeDef = LIMEN_GRADES.find((g) => g.grade === activeGrade) ?? LIMEN_GRADES[0];
  const currentGradeModel3d = GRADE_3D_MODELS[activeGrade] ?? null;

  return (
    <div className="landing-page bg-[#0A0A0C] text-[#F4F4F6] min-h-screen selection:bg-[#C5A059]/30 selection:text-white" ref={root}>
      <Seo
        title={t("landing.meta.title")}
        description={t("landing.meta.description")}
        keywords={t("landing.meta.keywords")}
        lang={language}
        canonical={absoluteUrl(landingPath(language))}
        alternates={landingAlternates()}
        jsonLd={[aureusKnowledgeGraphJsonLd(language), faqSchema]}
      />

      <a className="landing-skip sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#C5A059] focus:text-[#0A0A0C] focus:font-bold" href="#landing-main">
        {t("landing.skip")}
      </a>

      {/* Test anchor component preserved in DOM */}
      <div className="sr-only" aria-hidden="true">
        <LandingNavigation headerRef={header} onStart={() => dispatch({ type: "start" })} />
      </div>

      {/* =====================================================================
          1. NAVBAR FISSA MINIMALE ("MONOLITHIC STEALTH WEALTH")
          ===================================================================== */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#080808]/90 border-b border-[#24242C] transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 lg:h-20 flex items-center justify-between gap-3 sm:gap-4">
          {/* Logo & Sigil */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3.5 group shrink-0 whitespace-nowrap">
            <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-[#121216] border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shadow-[0_0_15px_rgba(197,160,89,0.18)] group-hover:border-[#C5A059] group-hover:shadow-[0_0_20px_rgba(197,160,89,0.35)] transition-all shrink-0 overflow-hidden">
              <img src="/app-icon-192.png?v=20261021g" alt="AUREUS" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col whitespace-nowrap">
              <span className="font-serif tracking-[0.2em] sm:tracking-[0.25em] font-black text-lg sm:text-xl text-[#F4F4F6] group-hover:text-[#C5A059] transition-colors uppercase leading-none">
                AUREUS
              </span>
              <span className="font-mono text-[8.5px] sm:text-[9px] tracking-[0.18em] sm:tracking-[0.22em] text-[#C5A059] uppercase leading-none mt-1 whitespace-nowrap">
                CICLO OPERATIVO
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-6 2xl:gap-8 text-[11px] font-mono tracking-widest uppercase whitespace-nowrap">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[#8E8E99] hover:text-[#C5A059] transition-colors py-1 whitespace-nowrap relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[1px] after:bg-[#C5A059] hover:after:w-full after:transition-all"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Actions (Separating "ACCEDI ALL'ORDINE" next to CTA) */}
          <div className="hidden xl:flex items-center gap-4 shrink-0 whitespace-nowrap">
            <Link
              href="/sign-in"
              className="text-[11px] font-mono tracking-widest text-[#8E8E99] hover:text-[#F4F4F6] transition-colors uppercase px-3 py-2 whitespace-nowrap border-r border-[#24242C] pr-4 mr-1"
            >
              ACCEDI ALL'ORDINE
            </Link>
            <button
              type="button"
              onClick={() => openGatekeeping("Richiesta di Ammissione alla Soglia")}
              className="relative group overflow-hidden inline-flex items-center gap-2 whitespace-nowrap px-5 py-2.5 rounded-lg border border-[#C5A059] bg-[#C5A059]/10 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0A0A0C] font-mono text-[11px] font-bold tracking-[0.2em] uppercase transition-all duration-300 shadow-[0_0_20px_rgba(197,160,89,0.2)]"
            >
              <span className="relative z-10 inline-flex items-center gap-2 whitespace-nowrap">
                <span>VARCA LA SOGLIA</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform shrink-0" />
              </span>
            </button>
          </div>

          {/* Tablet & Mobile Right Controls */}
          <div className="flex xl:hidden items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => openGatekeeping("Richiesta di Ammissione alla Soglia (Header)")}
              className="hidden sm:inline-flex items-center gap-2 whitespace-nowrap px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-[#C5A059] bg-[#C5A059]/10 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0A0A0C] font-mono text-[10px] sm:text-[11px] font-bold tracking-[0.16em] sm:tracking-[0.18em] uppercase transition-all"
            >
              <span>VARCA LA SOGLIA</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </button>

            {/* Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 sm:p-2.5 rounded-lg border border-[#24242C] text-[#8E8E99] hover:text-[#F4F4F6] bg-[#121216]/60 hover:bg-[#121216] transition-colors focus:outline-none focus:border-[#C5A059]/50"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-b border-[#24242C] bg-[#080808]/98 backdrop-blur-2xl px-5 sm:px-6 py-5 sm:py-6 space-y-4">
            <nav className="flex flex-col gap-3 font-mono text-xs tracking-widest uppercase">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-2 text-[#8E8E99] hover:text-[#C5A059] transition-colors border-b border-white/5"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2 text-[#8E8E99] hover:text-white transition-colors"
              >
                ACCEDI ALL'ORDINE
              </Link>
            </nav>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => openGatekeeping("Ammissione alla Soglia (Mobile)")}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-lg border border-[#C5A059] bg-[#C5A059] text-[#0A0A0C] font-mono text-xs font-bold tracking-[0.2em] uppercase shadow-[0_0_20px_rgba(197,160,89,0.3)] hover:brightness-110 transition-all whitespace-nowrap"
              >
                <span>VARCA LA SOGLIA</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              </button>
            </div>
          </div>
        )}
      </header>

      <main id="landing-main" tabIndex={-1} className="focus:outline-none">
        {/* =====================================================================
            2. HERO SECTION MONUMENTALE ED EMOZIONALE
            ===================================================================== */}
        <section className="relative pt-6 sm:pt-10 lg:pt-14 pb-12 sm:pb-16 lg:pb-20 overflow-hidden border-b border-[#24242C]/70 bg-[#060709]" aria-labelledby="hero-title">
          {/* Immersive Cathedral Atmosphere: Lateral Blender + Nano Banana Columns & Zenith Light */}
          <HeroAtmosphere />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center z-10">
            {/* Monumental Headline with Clean Unobstructed Center Stage */}
            <div className="relative w-full max-w-5xl mx-auto mt-1 sm:mt-3">
              <h1
                id="hero-title"
                className="landing-hero-title font-cinzel font-bold text-[#F4F4F6] text-center"
              >
                <span className="block text-[#F4F4F6] lg:whitespace-nowrap drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]">
                  DOVE IL CAOS BRUCIA I TUOI SOGNI.
                </span>
                <span className="hero-gold-gradient block mt-1.5 sm:mt-2.5 font-black tracking-[0.02em] sm:tracking-[0.04em] lg:whitespace-nowrap">
                  LA DISCIPLINA COSTRUISCE LA TUA LIBERTÀ.
                </span>
              </h1>
            </div>

            {/* Surgical Tactical Hook - Max 1-2 Lines */}
            <div className="max-w-3xl mx-auto mt-3.5 sm:mt-4 lg:mt-5 text-center px-4">
              <p className="text-sm sm:text-base lg:text-lg text-[#B0B0BC] font-sans font-normal leading-relaxed">
                E se il tuo vero errore non fosse ciò che fai sui mercati, ma le porte che non sai ancora chiudere?
              </p>
            </div>

            {/* CTA Action Area: Perfectly Symmetrical & Centered Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-5 sm:mt-7 w-full max-w-2xl mx-auto px-4">
              <button
                type="button"
                onClick={() => openGatekeeping("Ammissione Diretta - Eroe Principale")}
                className="hero-gold-btn group w-full sm:w-[260px] md:w-[280px] h-12 sm:h-13 px-4 rounded-[6px] text-[#0A0A0C] font-mono text-xs sm:text-sm font-black tracking-[0.12em] sm:tracking-[0.14em] uppercase inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-[0_0_25px_rgba(197,160,89,0.35)] transition-all"
              >
                <span>VARCA LA SOGLIA</span>
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
              </button>

              <a
                href="#punto-cieco"
                className="hero-obsidian-btn w-full sm:w-[260px] md:w-[280px] h-12 sm:h-13 px-4 rounded-[6px] text-[#C4C4CD] font-mono text-xs sm:text-sm font-semibold tracking-[0.1em] sm:tracking-[0.12em] uppercase inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer border border-[#C5A059]/30 hover:border-[#C5A059]/60 hover:text-white transition-all"
              >
                <span>SCOPRI IL PUNTO CIECO</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#C5A059]" />
              </a>
            </div>

            {/* Spazio Dedicato al Film Master — Cornice a Filo Sottile Dorato con Respiro Maestoso */}
            <div className="mt-8 sm:mt-10 lg:mt-12 max-w-4xl w-full mx-auto">
              <div className="relative rounded-2xl overflow-hidden border border-[#C5A059]/40 shadow-[0_0_50px_rgba(197,160,89,0.15)] bg-[#0A0A0C] aspect-video group">
                <video
                  src="/videos/limen-scene1.mp4"
                  autoPlay
                  loop
                  muted={isAudioMuted}
                  playsInline
                  className="w-full h-full object-cover pointer-events-none select-none"
                />

                {/* Minimalist Audio Toggle Pill */}
                <button
                  type="button"
                  onClick={() => setIsAudioMuted(!isAudioMuted)}
                  className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-20 flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-full bg-[#0A0A0C]/85 hover:bg-[#0A0A0C] border border-[#C5A059]/60 text-[#C5A059] font-mono text-[9px] sm:text-[10px] tracking-widest uppercase backdrop-blur-md transition-all shadow-[0_4px_15px_rgba(0,0,0,0.8)] cursor-pointer touch-manipulation"
                  aria-label={isAudioMuted ? "Attiva audio narrazione" : "Disattiva audio"}
                >
                  {isAudioMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5 animate-pulse" />}
                  <span>{isAudioMuted ? "ATTIVA NARRATORE" : "AUDIO ON"}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Thin vertical line connecting to Auto-Diagnosi */}
        <div className="w-[1px] h-8 sm:h-12 lg:h-16 bg-gradient-to-b from-[#C5A059]/40 via-[#C5A059] to-transparent mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_10px_#C5A059]" />
        </div>

        {/* =====================================================================
            2.5 AUTO-DIAGNOSI INTERATTIVA ("LO SPECCHIO DEL PUNTO CIECO")
            ===================================================================== */}
        <section
          id="punto-cieco"
          className="py-12 sm:py-18 lg:py-24 relative border-t border-[#24242C]/40 bg-[#08080C]"
          aria-labelledby="punto-cieco-title"
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8 lg:space-y-10">
            {/* Editorial Heading */}
            <div className="text-center space-y-2.5 sm:space-y-3 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full border border-[#C5A059]/40 bg-[#121216] font-mono text-[9px] sm:text-[10px] font-bold text-[#C5A059] uppercase tracking-[0.16em] sm:tracking-[0.2em] shadow-[0_0_20px_rgba(197,160,89,0.15)]">
                <SigilIcon variant="threshold" size={13} />
                <span>AUTO-DIAGNOSI // LO SPECCHIO DELLA VERITÀ</span>
              </div>
              <h2
                id="punto-cieco-title"
                className="text-2xl sm:text-4xl lg:text-5xl font-serif font-black text-white tracking-tight leading-tight"
              >
                Qual è il punto cieco che ti è costato di più finora?
              </h2>
              <p className="text-xs sm:text-sm text-[#8E8E99] font-sans max-w-xl mx-auto leading-relaxed">
                Tocca l'impulso in cui ti riconosci. Scopri la porta che non hai mai aperto e lo scudo matematico che ti impedisce di ricaderci.
              </p>
            </div>

            {/* 3 Streamlined Selector Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
              {BLIND_SPOTS.map((spot) => {
                const isSelected = selectedBlindSpot === spot.id;
                return (
                  <button
                    key={spot.id}
                    type="button"
                    onClick={() => setSelectedBlindSpot(spot.id)}
                    className={`p-3.5 sm:p-5 lg:p-6 rounded-xl border text-left transition-all duration-300 cursor-pointer select-none ${
                      isSelected
                        ? "border-[#E8C56A] bg-[#141624] shadow-[0_0_25px_rgba(197,160,89,0.18)]"
                        : "border-[#24242C] bg-[#0E0F14] hover:border-[#C5A059]/40 hover:bg-[#12141c]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs font-bold ${isSelected ? "text-[#E8C56A]" : "text-[#71717A]"}`}>
                        {spot.number}.
                      </span>
                      <h3 className={`font-serif font-bold text-sm sm:text-base leading-tight ${isSelected ? "text-white" : "text-[#D0D0D8]"}`}>
                        {spot.title}
                      </h3>
                    </div>
                    <p className="text-[11px] sm:text-xs text-[#8E8E99] mt-1.5 sm:mt-2 leading-relaxed">
                      «{spot.trigger}»
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Unified Architectural Reveal Card */}
            {activeSpot && (
              <div className="relative rounded-2xl border border-[#C5A059]/40 bg-[#0E0F14] p-4 sm:p-6 lg:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.85)]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-center">
                  {/* Left Column: The Truth & The Piercing Question */}
                  <div className="lg:col-span-7 space-y-2.5 sm:space-y-3.5">
                    <span className="font-mono text-[9px] sm:text-[10px] font-bold text-[#C5A059] uppercase tracking-[0.16em] sm:tracking-[0.2em] block">
                      L'INGANNO INCONSCIO &amp; LA PORTA NASCOSTA
                    </span>
                    <p className="text-base sm:text-lg text-white font-serif leading-snug">
                      {activeSpot.unseenDoor}
                    </p>
                    <div className="border-l-2 border-[#C5A059] pl-3.5 sm:pl-4 py-1 text-sm sm:text-base italic text-[#E8C56A] font-serif leading-relaxed">
                      «{activeSpot.openQuestion}»
                    </div>
                  </div>

                  {/* Right Column: The AUREUS Shield & Action */}
                  <div className="lg:col-span-5 space-y-3 sm:space-y-4 lg:border-l lg:border-[#24242C] lg:pl-6 xl:pl-8">
                    <div className="space-y-1 sm:space-y-1.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-[#C5A059] shrink-0" />
                        <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                          {activeSpot.shieldModule.number} // {activeSpot.shieldModule.title}
                        </span>
                      </div>
                      <p className="text-xs text-[#94a3b8] leading-relaxed">
                        {activeSpot.shieldModule.howItWorks}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openGatekeeping(activeSpot.gatekeepingReason)}
                      className="w-full py-3 sm:py-3.5 px-4 rounded-xl bg-[#C5A059] hover:bg-[#E8C56A] text-[#07080b] font-mono text-xs font-bold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(197,160,89,0.3)] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>{activeSpot.cta}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Thin vertical line connecting to the Manifesto */}
        <div className="w-[1px] h-8 sm:h-12 lg:h-16 bg-gradient-to-b from-[#C5A059]/40 via-[#C5A059] to-transparent mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_10px_#C5A059]" />
        </div>

        {/* =====================================================================
            3. SEZIONE STORYTELLING ("LO SPECCHIO DELLA VERITÀ")
            ===================================================================== */}
        <section id="manifesto" className="py-12 sm:py-18 lg:py-24 relative" aria-labelledby="manifesto-title">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-10 lg:space-y-14">
            {/* Editorial Heading */}
            <div className="text-center space-y-2.5 sm:space-y-3.5 max-w-3xl mx-auto">
              <span className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase">
                IL MANIFESTO // L'ERRORE INVISIBILE
              </span>
              <h2
                id="manifesto-title"
                className="text-2xl sm:text-4xl lg:text-5xl font-serif font-black text-white tracking-tight leading-tight"
              >
                Hai mai notato che l'errore più disastroso lo fai sempre quando credi di aver ragione?
              </h2>
              <p className="text-xs sm:text-base text-[#8E8E99] leading-relaxed font-sans">
                Il mercato non combatte contro di te. Riflette solo ciò che non riesci a dominare. Tre stadi separano chi finisce svuotato da chi conquista la sovranità della propria vita. Tu dove ti trovi in questo momento?
              </p>
            </div>

            {/* The 3 Cards of the States of Man */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 items-stretch">
              {/* Card 1: La Deriva */}
              <div className="rounded-2xl border border-[#24242C] bg-[#121216] p-4 sm:p-6 lg:p-7 flex flex-col justify-between space-y-4 sm:space-y-5 hover:border-red-900/50 transition-all duration-300 relative group">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-2xl font-black text-[#8E8E99] tracking-widest">
                      I
                    </span>
                    <div className="h-9 w-9 rounded-lg border border-red-900/40 bg-red-950/20 flex items-center justify-center text-red-400">
                      <SigilIcon variant="drift-warning" size={18} />
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] tracking-[0.2em] font-bold text-red-400 uppercase">
                      STATO I // IL VICOLO CIECO
                    </span>
                    <h3 className="text-lg sm:text-xl font-serif font-bold text-white mt-1">
                      La Deriva
                    </h3>
                  </div>

                  {/* 3D Scene View */}
                  {MANIFESTO_SCENES[1] && (
                    <ManifestoSceneCard
                      scene={MANIFESTO_SCENES[1]}
                      accent="red"
                      onInspect={(scene) =>
                        setActive3dModel({
                          title: scene.title,
                          subtitle: scene.subtitle,
                          src: scene.src,
                          webp: scene.webp,
                          badge: scene.badge,
                          description: scene.details,
                          criterion: "DESTINO: Il 95% delle persone si ferma qui: deluso, confuso e svuotato dal disordine emotivo.",
                          highlights: scene.highlights,
                        })
                      }
                    />
                  )}

                  <p className="text-xs sm:text-sm text-[#8E8E99] leading-relaxed">
                    Quante volte hai giurato «questa è l'ultima volta che agisco d'istinto»? Perché ogni volta che provi a recuperare una perdita finisci per raddoppiarla? Non stai sfidando il mercato: stai solo scommettendo contro le tue stesse debolezze.
                  </p>
                </div>
              </div>

              {/* Card 2: Il Varco */}
              <div className="rounded-2xl border border-[#C5A059]/50 bg-[#121216] p-4 sm:p-6 lg:p-7 flex flex-col justify-between space-y-4 sm:space-y-5 shadow-[0_0_30px_rgba(197,160,89,0.1)] relative group">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-2xl font-black text-[#C5A059] tracking-widest">
                      II
                    </span>
                    <div className="h-9 w-9 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 flex items-center justify-center text-[#C5A059]">
                      <SigilIcon variant="threshold" size={18} />
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] tracking-[0.2em] font-bold text-[#C5A059] uppercase">
                      STATO II // IL BIVIO CRUCIALE
                    </span>
                    <h3 className="text-lg sm:text-xl font-serif font-bold text-white mt-1">
                      Il Varco
                    </h3>
                  </div>

                  {MANIFESTO_SCENES[2] ? (
                    <ManifestoSceneCard
                      scene={MANIFESTO_SCENES[2]}
                      accent="gold"
                      onInspect={(scene) =>
                        setActive3dModel({
                          title: scene.title,
                          subtitle: scene.subtitle,
                          src: scene.src,
                          webp: scene.webp,
                          badge: scene.badge,
                          description: scene.details,
                          criterion: "DESTINO: Uscita dal caos. La trasformazione da scommettitore ansioso a persona lucida, calma e metodica.",
                          highlights: scene.highlights,
                        })
                      }
                    />
                  ) : (
                    <ManifestoPlaceholderCard
                      roman="II"
                      sigilVariant="threshold"
                      accent="gold"
                    />
                  )}

                  <p className="text-xs sm:text-sm text-[#8E8E99] leading-relaxed">
                    Cosa accadrebbe se decidessi che difendere i tuoi risparmi vale più del tuo orgoglio? Cosa proveresti se un sistema bloccasse i tuoi accessi non appena rileva agitazione? La regola non limita la tua libertà: è l'unico scudo che ti impedisce di distruggerla.
                  </p>
                </div>
              </div>

              {/* Card 3: Gli Architetti */}
              <div className="rounded-2xl border border-[#24242C] bg-[#121216] p-4 sm:p-6 lg:p-7 flex flex-col justify-between space-y-4 sm:space-y-5 hover:border-[#C5A059]/40 transition-all duration-300 relative group">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-2xl font-black text-[#8E8E99] tracking-widest">
                      III
                    </span>
                    <div className="h-9 w-9 rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 flex items-center justify-center text-[#C5A059]">
                      <SigilIcon variant="sigil-grade-4" size={18} />
                    </div>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] tracking-[0.2em] font-bold text-[#C5A059] uppercase">
                      STATO III // LA MAESTRIA
                    </span>
                    <h3 className="text-lg sm:text-xl font-serif font-bold text-white mt-1">
                      Gli Architetti
                    </h3>
                  </div>

                  {MANIFESTO_SCENES[3] ? (
                    <ManifestoSceneCard
                      scene={MANIFESTO_SCENES[3]}
                      accent="gold"
                      onInspect={(scene) =>
                        setActive3dModel({
                          title: scene.title,
                          subtitle: scene.subtitle,
                          src: scene.src,
                          webp: scene.webp,
                          badge: scene.badge,
                          description: scene.details,
                          criterion: "DESTINO: Libertà, rispetto di sé e controllo duraturo del proprio destino finanziario.",
                          highlights: scene.highlights,
                        })
                      }
                    />
                  ) : (
                    <ManifestoPlaceholderCard
                      roman="III"
                      sigilVariant="sigil-grade-4"
                      accent="gold"
                    />
                  )}

                  <p className="text-xs sm:text-sm text-[#8E8E99] leading-relaxed">
                    Come cambierebbe la tua giornata se ti bastassero venti minuti di lucidità invece di passare ore col batticuore davanti allo schermo? Pochi gesti misurati. La calma olimpica di chi ha già ripetuto ogni scenario cento volte nel simulatore prima di rischiare un solo euro.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Thin vertical line connecting to L'Ordine */}
        <div className="w-[1px] h-8 sm:h-12 lg:h-16 bg-gradient-to-b from-[#C5A059]/40 via-[#C5A059] to-transparent mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_10px_#C5A059]" />
        </div>

        {/* =====================================================================
            4. SEZIONE ARCHITETTURA SOFTWARE ("L'ORDINE GIORNALIERO")
            ===================================================================== */}
        <section id="features" className="py-12 sm:py-18 lg:py-24 relative border-t border-[#24242C]/40" aria-labelledby="software-title">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-10 lg:space-y-14">
            <div className="text-center space-y-2.5 sm:space-y-3.5 max-w-3xl mx-auto">
              <span className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase">
                LE 6 PORTE DI PROTEZIONE
              </span>
              <h2
                id="software-title"
                className="text-2xl sm:text-4xl lg:text-5xl font-serif font-black text-white tracking-tight leading-tight"
              >
                Cosa Faresti Se Qualcuno Ti Impedisse di Sbagliare?
              </h2>
              <p className="text-xs sm:text-base text-[#8E8E99] leading-relaxed font-sans">
                Gli strumenti tradizionali ti mostrano solo il danno dopo che hai perso soldi. AUREUS interviene prima: sei blocchi tattici per proteggere la tua mente e rendere la disciplina un riflesso incondizionato.
              </p>
            </div>

            {/* Bento Grid a 6 Blocchi */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 items-stretch">
              {SOFTWARE_MODULES.map((module) => {
                const has3d = !!module.model3d;

                return (
                  <div
                    key={module.id}
                    className={`rounded-2xl border transition-all duration-300 group flex flex-col justify-between ${
                      has3d
                        ? "border-[#C5A059]/40 bg-gradient-to-b from-[#14141A] to-[#0E0F14] p-4 sm:p-5 lg:p-6 shadow-[0_4px_30px_rgba(0,0,0,0.5)] hover:border-[#C5A059]/80 hover:shadow-[0_0_35px_rgba(197,160,89,0.22)]"
                        : "border-[#24242C] bg-[#121216] p-4 sm:p-6 hover:border-[#C5A059]/50"
                    }`}
                  >
                    <div className="space-y-3 sm:space-y-3.5">
                      {has3d && module.model3d ? (
                        /* =========================================================
                           3D MODEL SHOWCASE (replaces emoji and empty space)
                           ========================================================= */
                        <div
                          className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-[#050508] border border-[#C5A059]/30 group-hover:border-[#C5A059]/60 transition-all duration-500 cursor-pointer shadow-[inset_0_0_40px_rgba(0,0,0,0.9),0_10px_25px_rgba(0,0,0,0.7)]"
                          onClick={() =>
                            setActive3dModel({
                              title: module.title,
                              subtitle: `${module.number} // ${module.category}`,
                              src: module.model3d!.src,
                              webp: module.model3d!.webp,
                              badge: module.model3d!.badge,
                              description: module.model3d!.details,
                              criterion: module.criterion,
                              highlights: module.model3d!.highlights,
                            })
                          }
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setActive3dModel({
                                title: module.title,
                                subtitle: `${module.number} // ${module.category}`,
                                src: module.model3d!.src,
                                webp: module.model3d!.webp,
                                badge: module.model3d!.badge,
                                description: module.model3d!.details,
                                criterion: module.criterion,
                                highlights: module.model3d!.highlights,
                              });
                            }
                          }}
                          aria-label={`Visualizza modello 3D per ${module.title}`}
                        >
                          {/* Atmospheric Backlight / Radial Aura */}
                          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,rgba(197,160,89,0.22)_0%,rgba(217,119,6,0.08)_35%,transparent_70%)] pointer-events-none" />

                          {/* Sacred Architecture Corner Brackets */}
                          <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-[#C5A059]/40 pointer-events-none z-20 group-hover:border-[#C5A059] transition-colors" />
                          <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-[#C5A059]/40 pointer-events-none z-20 group-hover:border-[#C5A059] transition-colors" />
                          <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-[#C5A059]/40 pointer-events-none z-20 group-hover:border-[#C5A059] transition-colors" />
                          <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-[#C5A059]/40 pointer-events-none z-20 group-hover:border-[#C5A059] transition-colors" />

                          {/* The 3D Render Image with Picture fallback */}
                          <picture>
                            {module.model3d.webp && (
                              <source srcSet={module.model3d.webp} type="image/webp" />
                            )}
                            <img
                              src={module.model3d.src}
                              alt={module.model3d.alt}
                              loading="lazy"
                              className="relative z-10 w-full h-full object-contain filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.95)] group-hover:scale-[1.04] transition-transform duration-700 ease-out select-none"
                            />
                          </picture>

                          {/* Top-right Hover Expand Button */}
                          <div className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1 px-2 py-0.5 rounded-[4px] bg-[#0E0F14]/90 border border-[#C5A059]/50 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0A0A0C] transition-colors shadow-lg text-[9px] font-mono font-bold">
                            <Maximize2 className="h-2.5 w-2.5" />
                            <span className="hidden sm:inline">ISPEZIONA</span>
                          </div>

                          {/* Subtle bottom fade vignette */}
                          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#14141A] via-[#14141A]/40 to-transparent pointer-events-none z-10" />
                        </div>
                      ) : (
                        /* =========================================================
                           STANDARD MODULE ICON (until 3D model is provided)
                           ========================================================= */
                        <div className="h-10 w-10 rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/10 flex items-center justify-center text-[#C5A059]">
                          <SigilIcon variant={module.sigilVariant} size={20} />
                        </div>
                      )}

                      <div>
                        <span className="font-mono text-[9.5px] sm:text-[10px] tracking-[0.18em] sm:tracking-[0.2em] font-bold text-[#C5A059] uppercase">
                          {module.number} // {module.category}
                        </span>
                        <h3 className="text-base sm:text-lg font-serif font-bold text-white mt-0.5 sm:mt-1 group-hover:text-[#F5E5C9] transition-colors">
                          {module.title}
                        </h3>
                      </div>

                      <p className="text-xs text-[#8E8E99] leading-relaxed">
                        {module.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Thin vertical line connecting to I 5 Gradi */}
        <div className="w-[1px] h-8 sm:h-12 lg:h-16 bg-gradient-to-b from-[#C5A059]/40 via-[#C5A059] to-transparent mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_10px_#C5A059]" />
        </div>

        {/* =====================================================================
            5. TIMELINE INTERATTIVA DEI "5 GRADI DI ASCESA"
            ===================================================================== */}
        <section id="how" className="py-12 sm:py-18 lg:py-24 relative border-t border-[#24242C]/40" aria-labelledby="ladder-title">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-10 lg:space-y-14">
            <div className="text-center space-y-2.5 sm:space-y-3.5 max-w-3xl mx-auto">
              <span className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase">
                LA SCALA DELLA PADRONANZA // IL VALORE GUADAGNATO
              </span>
              <h2
                id="ladder-title"
                className="text-2xl sm:text-4xl lg:text-5xl font-serif font-black text-white tracking-tight leading-tight"
              >
                I 5 Gradi: Il Rispetto non si Compra con il Denaro
              </h2>
              <p className="text-xs sm:text-base text-[#8E8E99] leading-relaxed font-sans">
                Chiunque può vantarsi sui social o comprare titoli vuoti. Ma puoi comprare la capacità di non farti prendere dal panico? In AUREUS, ogni livello è una conquista visibile di autocontrollo.
              </p>
            </div>

            {/* Active Grade Detailed View with Integrated Progression & 3D Model */}
            <div className="rounded-2xl border border-[#C5A059]/40 bg-[#121216] p-4 sm:p-6 lg:p-8 shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative">
              {/* Grade Header with Integrated Grade Progression Selector in Top-Right */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5 border-b border-[#24242C] pb-4 sm:pb-5 mb-5 sm:mb-7">
                {/* Left: Active Grade Title & Subtitle */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 pr-0 lg:pr-4">
                  <span className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-[#C5A059] border-r border-[#24242C] pr-3.5 sm:pr-5 shrink-0">
                    {currentGradeDef.roman}
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] sm:text-xs font-bold tracking-widest text-[#C5A059] uppercase truncate">
                      {currentGradeDef.code}
                    </div>
                    <h3 className="text-base sm:text-2xl lg:text-3xl font-serif font-black text-white mt-0.5">
                      {currentGradeDef.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#8E8E99] mt-0.5 sm:mt-1 line-clamp-2">
                      {currentGradeDef.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right: Integrated Grade Progression Selector (I, II, III, IV, V) */}
                <div className="shrink-0 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none pb-1 lg:pb-0 w-full lg:w-auto -mx-1 px-1">
                  {LIMEN_GRADES.map((gradeDef) => {
                    const isSelected = activeGrade === gradeDef.grade;
                    return (
                      <button
                        key={gradeDef.grade}
                        type="button"
                        onClick={() => setActiveGrade(gradeDef.grade)}
                        className={`flex-1 sm:flex-initial min-w-[58px] sm:min-w-[72px] lg:min-w-[76px] px-1.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-center transition-all shrink-0 cursor-pointer ${
                          isSelected
                            ? "border-[#C5A059] bg-[#C5A059]/15 text-[#C5A059] shadow-[0_0_20px_rgba(197,160,89,0.25)]"
                            : "border-[#24242C] bg-[#0A0A0C] text-[#8E8E99] hover:border-[#C5A059]/40 hover:text-white hover:bg-[#141418]"
                        }`}
                        aria-label={`Seleziona ${gradeDef.code} - ${gradeDef.title}`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-serif text-xs sm:text-sm font-bold">
                            {gradeDef.roman}
                          </span>
                          <SigilIcon
                            variant={gradeDef.sigilId}
                            size={12}
                            className={isSelected ? "text-[#C5A059]" : "text-[#8E8E99]/60"}
                          />
                        </div>
                        <div className="text-[8px] sm:text-[10px] font-mono tracking-tight sm:tracking-wider font-semibold uppercase mt-0.5 whitespace-nowrap">
                          {gradeDef.grade === 1
                            ? "Novizio"
                            : gradeDef.grade === 2
                            ? "Custode"
                            : gradeDef.grade === 3
                            ? "Sovrano"
                            : gradeDef.grade === 4
                            ? "Architetto"
                            : "Fondatore"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main Content: 3D Scene + Requirements/Privileges */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-start">
                {/* Left Column: Interactive 3D Model Showcase */}
                <div className="lg:col-span-7">
                  <Grade3DCard
                    gradeDef={currentGradeDef}
                    model3d={currentGradeModel3d}
                    onInspect={(model) =>
                      setActive3dModel({
                        title: model.title,
                        subtitle: model.subtitle,
                        src: model.src,
                        webp: model.webp,
                        badge: model.badge,
                        description: model.details,
                        criterion: `TRAGUARDO: ${LANDING_GRADE_INFO[activeGrade].requirement}`,
                        highlights: model.highlights,
                      })
                    }
                  />
                </div>

                {/* Right Column: Unified Requirements & Privileges Panel */}
                <div className="lg:col-span-5 rounded-2xl border border-[#24242C] bg-[#0A0A0C] p-4 sm:p-5 lg:p-6 flex flex-col justify-between space-y-4 sm:space-y-5">
                  <div className="space-y-3.5 sm:space-y-4">
                    {/* Requisito di Merito */}
                    <div className="space-y-1.5 sm:space-y-2 border-b border-[#24242C] pb-3.5 sm:pb-4">
                      <span className="font-mono text-[9px] sm:text-[10px] text-[#C5A059] font-bold uppercase tracking-widest block">
                        TRAGUARDO DI DISCIPLINA · GRADO {currentGradeDef.roman}
                      </span>
                      <p className="text-white font-sans text-xs sm:text-sm leading-relaxed">
                        {LANDING_GRADE_INFO[activeGrade].requirement}
                      </p>
                    </div>

                    {/* Privilegi Sbloccati */}
                    <div className="space-y-2 sm:space-y-2.5">
                      <span className="font-mono text-[9px] sm:text-[10px] text-[#8E8E99] font-bold uppercase tracking-widest block">
                        COSA CONQUISTI A QUESTO LIVELLO:
                      </span>
                      <ul className="space-y-1.5 sm:space-y-2 text-xs text-[#8E8E99]">
                        {LANDING_GRADE_INFO[activeGrade].privileges.map((privilege, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[#C5A059] shrink-0 mt-0.5" />
                            <span className="text-[#F4F4F6] font-sans">{privilege}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => openGatekeeping(`Ammissione per scalata al ${currentGradeDef.code}`)}
                      className="w-full py-3 sm:py-3.5 rounded-xl bg-[#C5A059] hover:bg-[#E8C56A] text-[#0A0A0C] font-mono text-xs font-bold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(197,160,89,0.25)] cursor-pointer"
                    >
                      CANDIDATI PER ACCEDERE ALLA SCALA
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Thin vertical line connecting to Espansione 20% */}
        <div className="w-[1px] h-8 sm:h-12 lg:h-16 bg-gradient-to-b from-[#C5A059]/40 via-[#C5A059] to-transparent mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_10px_#C5A059]" />
        </div>

        {/* =====================================================================
            6. SEZIONE "IL MANDATO DI ESPANSIONE (ROYALTY 20%)"
            ===================================================================== */}
        <section id="espansione" className="py-12 sm:py-18 lg:py-24 relative border-t border-[#24242C]/40" aria-labelledby="expansion-title">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8 lg:space-y-10">
            {/* Section Header */}
            <div className="text-center space-y-2 sm:space-y-3 max-w-3xl mx-auto flex flex-col items-center">
              <span className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase flex items-center justify-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[#C5A059]" />
                LA REGOLA DEI 5 // VALORE CONDIVISO
              </span>
              <h2
                id="expansion-title"
                className="text-2xl sm:text-3xl lg:text-4xl font-serif font-black text-white tracking-tight text-center leading-tight"
              >
                Perché Pagare per un Software che Può Pagare Te?
              </h2>
              <p className="text-xs sm:text-sm text-[#8E8E99] leading-relaxed font-sans max-w-2xl mx-auto text-center">
                Se trovi una porta che ti salva dal caos, la tieni per te o la mostri a chi stimi? Per ogni persona che coinvolgi ricevi il 20% (€30/mese a persona per sempre). Con sole 5 persone il tuo percorso è a costo zero a vita. Dalla sesta in poi, genera una rendita per te.
              </p>
            </div>

            {/* Split Screen Master Cockpit: Artwork + Calculator */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 lg:gap-8 items-center">
              {/* Left Column: Artwork Stage (Compact & Sharp) */}
              <div className="lg:col-span-6">
                <ExpansionSceneCard
                  scene={EXPANSION_SCENE}
                  onInspect={(sc) =>
                    setActive3dModel({
                      title: sc.title,
                      subtitle: sc.subtitle,
                      src: sc.src,
                      webp: sc.webp,
                      badge: sc.badge,
                      description: sc.details,
                      criterion: sc.criterion,
                      highlights: sc.highlights,
                    })
                  }
                />
              </div>

              {/* Right Column: Pure Interactive Calculator Console */}
              <div className="lg:col-span-6 rounded-2xl border border-[#C5A059]/40 bg-[#121216] p-4 sm:p-5 lg:p-6 shadow-[0_15px_40px_rgba(0,0,0,0.8)] space-y-4 sm:space-y-5">
                {/* 5 Ceremonial Keys Progress Rack */}
                <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-[#24242C]">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-[#C5A059] shrink-0" />
                    <span className="font-mono text-[10px] sm:text-xs font-bold text-white tracking-wider uppercase">
                      {invitedMembers >= 5
                        ? "✦ TRAGUARDO RAGGIUNTO: COSTO ZERO A VITA"
                        : `MANCANO ${5 - invitedMembers} PERSONE PER AZZERARE`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((keyIdx) => {
                      const isActive = invitedMembers >= keyIdx;
                      return (
                        <div
                          key={keyIdx}
                          className={`flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-md border transition-all duration-200 ${
                            isActive
                              ? "border-[#C5A059] bg-[#C5A059]/20 text-[#C5A059] shadow-[0_0_10px_rgba(197,160,89,0.3)] scale-105"
                              : "border-[#24242C] bg-[#0A0A0C] text-[#454552]"
                          }`}
                          title={`Chiave ${keyIdx}${keyIdx === 5 ? " — Abbonamento Gratuito" : ""}`}
                        >
                          <Key className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${isActive ? "text-[#C5A059]" : "text-[#454552]"}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Slider Input Group */}
                <div className="space-y-2 sm:space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="member-slider" className="font-mono text-[11px] sm:text-xs font-bold text-[#8E8E99] tracking-wider uppercase flex items-center gap-1.5 sm:gap-2">
                      <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#C5A059]" />
                      <span>AMICI COINVOLTI:</span>
                    </label>
                    <span className="font-mono text-lg sm:text-2xl font-black text-[#C5A059] bg-[#C5A059]/15 border border-[#C5A059]/30 px-3 py-0.5 rounded-lg shadow-[0_0_15px_rgba(197,160,89,0.25)]">
                      {invitedMembers}
                    </span>
                  </div>

                  <input
                    id="member-slider"
                    type="range"
                    min="0"
                    max="20"
                    step="1"
                    value={invitedMembers}
                    onChange={(e) => setInvitedMembers(parseInt(e.target.value, 10))}
                    className="w-full h-3 rounded-lg appearance-none cursor-pointer bg-[#24242C] accent-[#C5A059] touch-manipulation py-2"
                  />
                </div>

                {/* Math Breakdown Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 font-mono">
                  <div className="p-3 sm:p-3.5 rounded-xl border border-[#24242C] bg-[#0A0A0C]">
                    <div className="text-[10px] text-[#8E8E99] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Coins className="h-3 w-3 text-[#C5A059]" />
                      <span>ROYALTY MENSILE</span>
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-white whitespace-nowrap">
                      €{monthlyRoyalty} <span className="text-xs text-[#8E8E99] font-normal whitespace-nowrap">/ mese</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[#8E8E99]">
                      {invitedMembers} compagni × €30 (20%)
                    </div>
                  </div>

                  <div className="p-3 sm:p-3.5 rounded-xl border border-[#24242C] bg-[#0A0A0C]">
                    <div className="text-[10px] text-[#8E8E99] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Scale className="h-3 w-3 text-[#C5A059]" />
                      <span>IL TUO COSTO NETTO</span>
                    </div>
                    {invitedMembers < 5 ? (
                      <div>
                        <div className="text-lg sm:text-xl font-bold text-amber-400 whitespace-nowrap">
                          €{netTributeCost} <span className="text-xs text-[#8E8E99] font-normal whitespace-nowrap">/ mese</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-amber-400/80">
                          {5 - invitedMembers} per azzerare ({coveragePercent}%)
                        </div>
                      </div>
                    ) : invitedMembers === 5 ? (
                      <div>
                        <div className="text-lg sm:text-xl font-black text-[#C5A059] whitespace-nowrap">
                          €0 / MESE
                        </div>
                        <div className="mt-0.5 text-[10px] font-bold text-[#C5A059]">
                          ✦ AZZERATO AL 100%
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-lg sm:text-xl font-black text-[#D4AF37] whitespace-nowrap">
                          +€{netRecurringProfit} / MESE
                        </div>
                        <div className="mt-0.5 text-[10px] font-bold text-[#D4AF37]">
                          ✦ RENDITA NETTA
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary CTA */}
                <button
                  type="button"
                  onClick={() => openGatekeeping("Candidatura per Mandato di Espansione 20%")}
                  className="w-full py-3 sm:py-3.5 rounded-xl border border-[#C5A059] bg-[#C5A059] text-[#0A0A0C] font-mono text-xs font-bold tracking-[0.16em] sm:tracking-[0.2em] uppercase hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(197,160,89,0.25)] cursor-pointer"
                >
                  <span>APRI IL TUO MANDATO DI CONDIVISIONE</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Thin vertical line connecting to Il Tributo */}
        <div className="w-[1px] h-8 sm:h-12 lg:h-16 bg-gradient-to-b from-[#C5A059]/40 via-[#C5A059] to-transparent mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_10px_#C5A059]" />
        </div>

        {/* =====================================================================
            7. SEZIONE FINALE PRICING ("DOTAZIONE PRIME PERSONE 10€ & PROGETTO COMPLETO 150€")
            ===================================================================== */}
        <section id="pricing" className="py-12 sm:py-18 lg:py-24 relative border-t border-[#24242C]/40 overflow-hidden bg-[#060709]" aria-labelledby="pricing-title">
          {/* Colonnato Monumentale 3D Laterale & Luce Zenitale */}
          <PricingAtmosphere />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8 lg:space-y-10 relative z-10">
            {/* Header d'Ordine */}
            <div className="text-center space-y-2.5 sm:space-y-3.5 max-w-3xl mx-auto flex flex-col items-center">
              <span className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase">
                LA TUA SCELTA DI LIBERTÀ
              </span>
              <h2
                id="pricing-title"
                className="text-2xl sm:text-4xl lg:text-5xl font-serif font-black text-white tracking-tight text-center drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)] leading-tight"
              >
                Qual è il Vero Prezzo di Continuare a Sbagliare da Solo?
              </h2>
              <p className="text-xs sm:text-base text-[#8E8E99] leading-relaxed font-sans max-w-2xl mx-auto text-center [text-wrap:balance]">
                Un solo errore impulsivo sui mercati costa spesso centinaia o migliaia di euro. Qui ti proteggiamo a partire da un caffè a settimana. Scegli da quale porta entrare.
              </p>

              {/* Toggle Interattivo Mensile / Annuale */}
              <div className="pt-2 flex justify-center px-2">
                <div className="inline-flex max-w-full items-center rounded-xl border border-[#C5A059]/40 bg-[#0E0F14] p-1 shadow-[0_0_25px_rgba(197,160,89,0.12)]">
                  <button
                    type="button"
                    onClick={() => setPricingCycle("monthly")}
                    className={`rounded-lg px-2.5 sm:px-4 py-1.5 sm:py-2 font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest transition-all whitespace-nowrap cursor-pointer ${
                      pricingCycle === "monthly"
                        ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_15px_rgba(197,160,89,0.4)]"
                        : "text-[#94a3b8] hover:text-white"
                    }`}
                  >
                    Cadenza Mensile
                  </button>
                  <button
                    type="button"
                    onClick={() => setPricingCycle("yearly")}
                    className={`rounded-lg px-2.5 sm:px-4 py-1.5 sm:py-2 font-mono text-[11px] sm:text-xs font-bold uppercase tracking-wider sm:tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
                      pricingCycle === "yearly"
                        ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_15px_rgba(197,160,89,0.4)]"
                        : "text-[#94a3b8] hover:text-white"
                    }`}
                  >
                    <span>Cadenza Annuale</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[8.5px] sm:text-[9px] font-black uppercase tracking-wider whitespace-nowrap ${
                        pricingCycle === "yearly"
                          ? "bg-[#07080b] text-[#E8C56A]"
                          : "bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981]"
                      }`}
                    >
                      2 Mesi Omaggio
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Dual Cockpit Cards (Interactive Selection & Balanced Heights) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 items-stretch">
              {/* CARD 1: ESCLUSIVA PRIME PERSONE (10€/MESE O 100€/ANNO) */}
              <div
                onClick={() => setSelectedTierId("founders_10")}
                className={`relative rounded-3xl border p-4 sm:p-6 lg:p-8 flex flex-col justify-between transition-all duration-300 cursor-pointer ${
                  selectedTierId === "founders_10"
                    ? "border-[#E8C56A] bg-gradient-to-b from-[#141624] via-[#0d0f17] to-[#07080b] shadow-[0_0_45px_rgba(197,160,89,0.22)] ring-1 ring-[#E8C56A]/60"
                    : "border-[#C5A059]/25 bg-[#0d0f14]/90 hover:border-[#C5A059]/50 hover:bg-[#10121a]"
                }`}
              >
                {selectedTierId === "founders_10" && (
                  <>
                    <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#E8C56A] pointer-events-none" />
                    <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#E8C56A] pointer-events-none" />
                  </>
                )}

                <div className="space-y-5">
                  {/* Status chip & Selector status */}
                  <div className="flex items-center justify-between gap-2 border-b border-[#24242C]/60 pb-3">
                    <span className="font-mono text-[9px] sm:text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded border border-[#10b981]/40 bg-[#10b981]/15 text-[#10b981] whitespace-nowrap">
                      {isPromoActive ? "✦ PROMO 14 GIORNI · BLOCCATO" : "✦ ESCLUSIVA PRIME PERSONE · BLOCCATO"}
                    </span>
                    {selectedTierId === "founders_10" ? (
                      <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#C5A059]/50 bg-[#C5A059]/20 text-[#E8C56A] whitespace-nowrap">
                        ✓ PIANO ATTIVO
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] text-[#8E8E99] tracking-wider uppercase">
                        Clicca per selezionare
                      </span>
                    )}
                  </div>

                  {/* Title & Tagline */}
                  <div>
                    <h3 className="font-serif text-2xl sm:text-3xl font-black text-white tracking-wide">
                      Dotazione Operativa
                    </h3>
                    <p className="font-mono text-xs text-[#94a3b8] mt-1">
                      Simulatore a Rischio Zero &amp; Protezione del Capitale
                    </p>
                  </div>

                  {/* Price Banner */}
                  <div className="rounded-xl border border-[#C5A059]/20 bg-[#07080b]/90 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 sm:gap-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-4xl sm:text-5xl font-black text-[#E8C56A] tracking-tight whitespace-nowrap">
                        {pricingCycle === "yearly" ? "€100" : isPromoActive ? "€2,60" : "€10"}
                      </span>
                      <span className="font-mono text-xs text-[#94a3b8] whitespace-nowrap">
                        {pricingCycle === "yearly" ? "/ anno" : isPromoActive ? "/ 14 giorni" : "/ mese"}
                      </span>
                    </div>

                    <div className="text-left sm:text-right">
                      {pricingCycle === "yearly" ? (
                        <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#10b981] px-2 py-0.5 rounded bg-[#10b981]/10 border border-[#10b981]/30 block whitespace-nowrap">
                          ~8,33 €/m · 2 Mesi Omaggio
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] block whitespace-nowrap">
                          Oppure 100 € / anno (-17%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clean Inclusions List (No nested boxed buttons / No scattered tags) */}
                  <div className="space-y-3.5 pt-2">
                    {[
                      {
                        icon: <FlaskConical className="h-4 w-4 text-[#C5A059]" />,
                        title: "La Forgia del Passato",
                        detail: "Simulatore a rischio zero sui dati storici di mercato.",
                      },
                      {
                        icon: <Coins className="h-4 w-4 text-[#C5A059]" />,
                        title: "Protezione del Capitale",
                        detail: "Freno matematico per calcolare il rischio prima di ogni azione.",
                      },
                      {
                        icon: <ShieldCheck className="h-4 w-4 text-[#10b981]" />,
                        title: "Il Varco & Libro della Verità",
                        detail: "Checklist di lucidità mentale e registro immutabile delle scelte.",
                      },
                      {
                        icon: <Users className="h-4 w-4 text-[#10b981]" />,
                        title: "La Cerchia & I 5 Gradi",
                        detail: "Avanzamento reale basato sulla disciplina e rispetto delle regole.",
                      },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#C5A059]/30 bg-[#07080b] mt-0.5">
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-[#F4F4F6] leading-snug">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-[#8E8E99] leading-snug mt-0.5">
                            {item.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Controls: Clean CTA */}
                <div className="mt-6 pt-4 border-t border-[#24242C]">
                  {/* Clean CTA Button (No text truncation / No overflow) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGatekeeping(
                        `Candidatura Dotazione Operativa (${pricingCycle === "yearly" ? "100€/a" : isPromoActive ? "2,60€ / 14 giorni" : "10€/m"})`,
                        "founders_10",
                      );
                    }}
                    className="w-full py-3.5 sm:py-4 px-4 rounded-xl border border-[#C5A059] bg-[#C5A059]/20 hover:bg-[#C5A059] text-[#E8C56A] hover:text-[#07080b] font-mono text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(197,160,89,0.2)] group cursor-pointer"
                  >
                    <span>ATTIVA LA TUA PROTEZIONE</span>
                    <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              {/* CARD 2: PROGETTO COMPLETO FORMAZIONE & FINESTRA (150€/MESE O 1500€/ANNO) */}
              <div
                onClick={() => setSelectedTierId("complete_150")}
                className={`relative rounded-3xl border p-4 sm:p-6 lg:p-8 flex flex-col justify-between transition-all duration-300 cursor-pointer ${
                  selectedTierId === "complete_150"
                    ? "border-[#E8C56A] bg-gradient-to-b from-[#181a28] via-[#10121d] to-[#07080b] shadow-[0_0_55px_rgba(197,160,89,0.28)] ring-1 ring-[#E8C56A]/70"
                    : "border-[#C5A059]/25 bg-[#0d0f14]/90 hover:border-[#C5A059]/50 hover:bg-[#10121a]"
                }`}
              >
                {selectedTierId === "complete_150" && (
                  <>
                    <div className="absolute top-3 left-3 w-3 h-3 border-t-2 border-l-2 border-[#E8C56A] pointer-events-none" />
                    <div className="absolute top-3 right-3 w-3 h-3 border-t-2 border-r-2 border-[#E8C56A] pointer-events-none" />
                  </>
                )}

                <div className="space-y-4 sm:space-y-5">
                  {/* Status chip & Selector status */}
                  <div className="flex items-center justify-between gap-2 border-b border-[#24242C]/60 pb-3">
                    <span className="font-mono text-[9px] sm:text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded border border-[#C5A059]/50 bg-[#C5A059]/20 text-[#E8C56A] whitespace-nowrap">
                      ✦ PROGETTO COMPLETO · ACCESSO TOTALE
                    </span>
                    {selectedTierId === "complete_150" ? (
                      <span className="font-mono text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#C5A059]/50 bg-[#C5A059]/20 text-[#E8C56A] whitespace-nowrap">
                        ✓ PIANO ATTIVO
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] text-[#8E8E99] tracking-wider uppercase">
                        Clicca per selezionare
                      </span>
                    )}
                  </div>

                  {/* Title & Tagline */}
                  <div>
                    <h3 className="font-serif text-2xl sm:text-3xl font-black text-white tracking-wide">
                      Progetto Completo
                    </h3>
                    <p className="font-mono text-xs text-[#94a3b8] mt-1">
                      Tutti gli Strumenti, Video Accademia, Orari Chiave &amp; Live
                    </p>
                  </div>

                  {/* Price Banner */}
                  <div className="rounded-xl border border-[#C5A059]/30 bg-[#07080b]/90 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 sm:gap-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-4xl sm:text-5xl font-black text-white tracking-tight whitespace-nowrap">
                        {pricingCycle === "yearly" ? "€1.500" : "€150"}
                      </span>
                      <span className="font-mono text-xs text-[#94a3b8] whitespace-nowrap">
                        {pricingCycle === "yearly" ? "/ anno" : "/ mese"}
                      </span>
                    </div>

                    <div className="text-left sm:text-right">
                      {pricingCycle === "yearly" ? (
                        <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-[#10b981] px-2 py-0.5 rounded bg-[#10b981]/10 border border-[#10b981]/30 block whitespace-nowrap">
                          Risparmi 300 € · 2 Mesi Omaggio
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] block whitespace-nowrap">
                          Oppure 1.500 € / anno (2 mesi omaggio)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clean Inclusions List (No nested boxed buttons / No scattered tags) */}
                  <div className="space-y-3 sm:space-y-3.5 pt-1 sm:pt-2">
                    {[
                      {
                        icon: <Sparkles className="h-4 w-4 text-[#E8C56A]" />,
                        title: "Tutta la Dotazione Operativa",
                        detail: "Simulatore illimitato e scudi di protezione sempre inclusi.",
                      },
                      {
                        icon: <GraduationCap className="h-4 w-4 text-[#C5A059]" />,
                        title: "La Dottrina del Tempo",
                        detail: "Video accademia completa per dominare l'attesa strategica.",
                      },
                      {
                        icon: <Crosshair className="h-4 w-4 text-[#C5A059]" />,
                        title: "Gli Orari Chiave dei Mercati",
                        detail: "Mappa esatta delle finestre in cui operare senza foga.",
                      },
                      {
                        icon: <Flame className="h-4 w-4 text-[#C5A059]" />,
                        title: "Il Concilio della Domenica",
                        detail: "Incontro strategico live settimanale per preparare la settimana.",
                      },
                      {
                        icon: <Trophy className="h-4 w-4 text-[#E8C56A]" />,
                        title: "Sfide tra Membri & Royalty 20%",
                        detail: "Sfide di costanza tra pari e azzeramento quota con 5 persone.",
                      },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 sm:gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#C5A059]/30 bg-[#07080b] mt-0.5">
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-[#F4F4F6] leading-snug">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-[#8E8E99] leading-snug mt-0.5">
                            {item.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Controls: Clean CTA */}
                <div className="mt-5 sm:mt-6 pt-3.5 sm:pt-4 border-t border-[#24242C]">
                  {/* Clean CTA Button (No text truncation / No overflow) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGatekeeping(
                        `Candidatura Progetto Completo (${pricingCycle === "yearly" ? "1.500€/a" : "150€/m"})`,
                        "complete_150",
                      );
                    }}
                    className="w-full py-3.5 sm:py-4 px-4 rounded-xl border-2 border-[#C5A059] bg-[#C5A059] hover:bg-[#E8C56A] text-[#07080b] font-mono text-xs sm:text-sm font-black tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_35px_rgba(197,160,89,0.45)] group cursor-pointer"
                  >
                    <span>ENTRA NEL PROGETTO COMPLETO</span>
                    <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Module Comparison Table */}
            <div className="space-y-3 sm:space-y-4 pt-1">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowComparisonMatrix(!showComparisonMatrix)}
                  className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full border border-[#C5A059]/40 bg-[#07080b] hover:bg-[#12141c] hover:border-[#C5A059] text-[#E8C56A] font-mono text-xs font-bold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(0,0,0,0.6)] cursor-pointer"
                >
                  <Layers className="h-4 w-4 text-[#C5A059]" />
                  <span>{showComparisonMatrix ? "Nascondi Matrice Moduli" : "Confronta Dotazioni a Colpo d'Occhio"}</span>
                  {showComparisonMatrix ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {showComparisonMatrix && (
                <div className="rounded-2xl border border-[#C5A059]/30 bg-[#0d0f14]/95 p-4 sm:p-6 lg:p-7 shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-x-auto animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="text-center mb-3 sm:mb-4 space-y-1">
                    <h4 className="font-serif text-base sm:text-lg font-bold text-white">Matrice di Accesso ai Moduli d'Ordine</h4>
                    <p className="font-mono text-xs text-[#94a3b8]">Confronto analitico tra i 3 gradi di dotazione</p>
                    <p className="font-mono text-[10px] text-[#C5A059] block sm:hidden">← Scorri orizzontalmente per confrontare i dettagli →</p>
                  </div>

                  <table className="w-full min-w-[560px] text-xs font-mono text-left">
                    <thead>
                      <tr className="border-b border-[#24242C] text-[#94a3b8]">
                        <th className="py-2.5 px-3">Strumenti e Moduli Inclusi</th>
                        <th className="py-2.5 px-3 text-center">Soglia Base (0€)</th>
                        <th className="py-2.5 px-3 text-center text-[#E8C56A] whitespace-nowrap">Dotazione Operativa (2,60€)</th>
                        <th className="py-2.5 px-3 text-center text-white">Progetto Completo (150€/m)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#24242C]/60 text-[#D0D0D8]">
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">Il Varco (Checklist Pre-Decisione)</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">Il Libro della Verità &amp; 5 Gradi (Diario)</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">La Forgia del Passato (Simulatore a Rischio Zero)</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#E8C56A] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">Protezione del Capitale (Scudo Matematico)</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#E8C56A] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">La Dottrina del Tempo (Video Accademia)</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">Gli Orari Chiave dei Mercati (Mappa Oraria)</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">Il Concilio della Domenica (Live Settimanale)</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">Sfide tra Membri &amp; Royalty 20% (Merito)</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Strip Informativa Soglia Iniziale Base */}
            <div className="rounded-2xl border border-[#C5A059]/30 bg-[#0d0f14]/90 px-4 sm:px-6 py-3.5 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-2.5 sm:gap-3 text-left">
                <ShieldCheck className="h-5 w-5 text-[#C5A059] shrink-0" />
                <p className="text-xs text-[#D0D0D8]">
                  <strong>Soglia Iniziale Gratuita (0 €):</strong> Puoi iniziare anche esplorando la piattaforma con la dotazione base inclusa (<em>Il Varco, Il Libro della Verità, La Comunità e i 5 Gradi di Ascesa</em>) e sbloccare gli strumenti successivi quando ti sentirai pronto.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  openGatekeeping("Candidatura Soglia Base (0€)", "base_free")
                }
                className="shrink-0 rounded-lg border border-[#C5A059]/40 bg-[#07080b] px-3.5 sm:px-4 py-2 font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#E8C56A] hover:border-[#C5A059] hover:bg-[#C5A059]/10 transition-all whitespace-nowrap cursor-pointer"
              >
                Inizia la Prova Gratuita →
              </button>
            </div>

            {/* Embedded FAQ Accordion Section */}
            <div id="faq" className="pt-10 sm:pt-14 lg:pt-18 space-y-6 sm:space-y-8 max-w-3xl mx-auto">
              {/* Header with Sigil Emblem & Altar glow */}
              <div className="text-center space-y-2 sm:space-y-3 relative">
                <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-[#C5A059]/40 bg-[#141418] text-[#C5A059] shadow-[0_0_25px_rgba(197,160,89,0.25)] mx-auto mb-1">
                  <SigilIcon variant="threshold" size={22} className="text-[#C5A059]" />
                </div>
                <div className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase">
                  {t("landing.faq.eyebrow")}
                </div>
                <h3 className="text-2xl sm:text-4xl font-serif font-black text-white tracking-tight">
                  Le Verità che Nessuno Ti Dice
                </h3>
                <p className="text-xs sm:text-sm text-[#8E8E99] font-sans max-w-xl mx-auto leading-relaxed">
                  {t("landing.faq.subheading")}
                </p>
                <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/60 to-transparent mx-auto pt-1" />
              </div>

              {/* Centered Monolithic Accordion Cards */}
              <div className="space-y-3 sm:space-y-4">
                {FAQ_ITEMS.map((item, index) => {
                  const isOpen = openFaqIndex === index;
                  return (
                    <div
                      key={item.questionKey}
                      className={`relative rounded-2xl border transition-all duration-300 overflow-hidden ${
                        isOpen
                          ? "border-[#C5A059]/60 bg-gradient-to-b from-[#16161D] via-[#121216] to-[#0E0F13] shadow-[0_0_35px_rgba(197,160,89,0.16)]"
                          : "border-[#24242C] bg-[#101014]/90 hover:border-[#C5A059]/40 hover:bg-[#131318] hover:shadow-[0_0_20px_rgba(197,160,89,0.08)]"
                      }`}
                    >
                      {/* Top gold highlight line when open */}
                      {isOpen && (
                        <div className="absolute top-0 left-12 right-12 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059] to-transparent pointer-events-none" />
                      )}

                      <button
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                        className="w-full p-4 sm:p-5 lg:p-6 text-center flex flex-col items-center justify-center gap-2 sm:gap-2.5 transition-colors group cursor-pointer"
                        aria-expanded={isOpen}
                      >
                        {/* Roman numeral badge */}
                        <span className="font-mono text-[10px] sm:text-[11px] font-bold text-[#C5A059] tracking-[0.25em] uppercase group-hover:text-amber-300 transition-colors">
                          {t(item.badgeKey)}
                        </span>

                        {/* Centered Question */}
                        <h4 className="font-serif font-bold text-sm sm:text-base lg:text-lg text-white group-hover:text-[#F4F4F6] transition-colors leading-snug max-w-2xl px-2">
                          {t(item.questionKey)}
                        </h4>

                        {/* Circular expand indicator */}
                        <div
                          className={`mt-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full border flex items-center justify-center transition-all duration-300 ${
                            isOpen
                              ? "border-[#C5A059] bg-[#C5A059]/20 text-[#C5A059] rotate-180"
                              : "border-[#24242C] bg-[#16161C] text-[#8E8E99] group-hover:border-[#C5A059]/50 group-hover:text-[#C5A059]"
                          }`}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-4 sm:px-7 lg:px-8 pb-5 sm:pb-6 pt-1 text-center animate-in fade-in duration-300 space-y-3">
                          {/* Delicate Gilded Divider */}
                          <div className="w-20 sm:w-24 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent mx-auto" />

                          {/* Centered Answer Text */}
                          <p className="text-xs sm:text-sm text-[#A0A0AA] font-sans leading-relaxed max-w-2xl mx-auto text-center">
                            {t(item.answerKey)}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Solemn Quote Footer */}
        <footer className="py-10 sm:py-14 lg:py-16 border-t border-[#24242C] bg-[#0A0A0C] text-center space-y-5 sm:space-y-6">
          <div className="max-w-3xl mx-auto px-4 space-y-2.5 sm:space-y-3">
            <SigilIcon variant="threshold" size={28} className="text-[#C5A059] mx-auto opacity-70" />
            <p className="font-serif italic text-xs sm:text-sm md:text-base text-[#8E8E99]">
              "Aureus non est finis, sed initium virtutis. Chi cerca la scorciatoia trova la rovina; chi rispetta la regola conquista la sovranità."
            </p>
            <div className="font-mono text-[10px] sm:text-[11px] text-[#C5A059] tracking-[0.16em] sm:tracking-[0.2em] uppercase">
              AUREUS PROTOCOL // IL CODICE DELLA PRESENZA E DELL'EREDITÀ
            </div>
          </div>

          <div className="pt-4 sm:pt-6 border-t border-[#24242C]/50 flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-[11px] sm:text-xs font-mono text-[#8E8E99]">
            <Link href="/" className="hover:text-white transition-colors">PORTALE PRINCIPALE</Link>
            <Link href="/protocollo" className="hover:text-white transition-colors">PROTOCOLLO OPERATIVO</Link>
            <Link href="/academy" className="hover:text-white transition-colors">LA DOTTRINA DEL TEMPO</Link>
            <Link href="/verifica" className="hover:text-white transition-colors">VERIFICA CERTIFICATI ON-CHAIN</Link>
            <Link href="/sign-in" className="hover:text-white transition-colors">ACCEDI ALL&apos;ORDINE</Link>
          </div>

          {/* Sovereign SEO & Ecosystem Discovery Matrix (Crawled by Googlebot & AI Search Engines) */}
          <nav
            aria-label="Architettura e Pilastri del Protocollo AUREUS"
            className="max-w-5xl mx-auto px-4 pt-4 sm:pt-6 border-t border-[#24242C]/40 space-y-3 sm:space-y-4"
          >
            <div className="flex flex-wrap items-center justify-center gap-x-3.5 sm:gap-x-5 gap-y-1.5 sm:gap-y-2 text-[10px] sm:text-[11px] font-mono text-[#8E8E99]">
              {SEO_PAGE_KEYS.map((key) => (
                <Link
                  key={key}
                  href={seoPagePath(key, language)}
                  className="hover:text-[#E8C56A] transition-colors whitespace-nowrap"
                >
                  {t(`seo.${key}.eyebrow`)}
                </Link>
              ))}
              <Link href="/privacy" className="hover:text-[#E8C56A] transition-colors whitespace-nowrap">
                {t("landing.footer.privacy")}
              </Link>
              <Link href="/terms" className="hover:text-[#E8C56A] transition-colors whitespace-nowrap">
                {t("landing.footer.terms")}
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-[9.5px] sm:text-[10px] font-mono text-[#8E8E99]/75">
              <span className="text-[#C5A059] uppercase tracking-widest">Edizioni Internazionali:</span>
              <Link href="/it" className="hover:text-white transition-colors whitespace-nowrap">Italiano (IT)</Link>
              <span>·</span>
              <Link href="/" className="hover:text-white transition-colors whitespace-nowrap">English (EN)</Link>
              <span>·</span>
              <Link href="/es" className="hover:text-white transition-colors whitespace-nowrap">Español (ES)</Link>
              <span>·</span>
              <Link href="/fr" className="hover:text-white transition-colors whitespace-nowrap">Français (FR)</Link>
              <span>·</span>
              <Link href="/de" className="hover:text-white transition-colors whitespace-nowrap">Deutsch (DE)</Link>
            </div>
          </nav>

          <div className="font-mono text-[9.5px] sm:text-[10px] text-slate-600">
            © 2026 AUREUS PROTOCOL (https://aureus-os.app). TUTTI I DIRITTI RISERVATI. ARCHITETTURA E CICLO OPERATIVO.
          </div>
        </footer>
      </main>

      {/* Gatekeeping Multi-Step Application Modal */}
      <GatekeepingModal
        isOpen={isGatekeepingOpen}
        onClose={() => setIsGatekeepingOpen(false)}
        initialReason={gatekeepingReason}
        defaultBillingCycle={pricingCycle}
        defaultTierId={selectedTierId}
      />

      {/* 3D Model Inspection Lightbox Modal */}
      {active3dModel && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setActive3dModel(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-[#C5A059]/50 bg-[#0E0F14] text-white shadow-[0_0_60px_rgba(197,160,89,0.25)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-30 flex items-center justify-between p-4 sm:p-6 border-b border-[#24242C] bg-[#0E0F14]/95 backdrop-blur-md">
              <div className="space-y-1 pr-6">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] tracking-[0.22em] font-bold text-[#C5A059] uppercase">
                    {active3dModel.subtitle}
                  </span>
                  <span className="px-2 py-0.5 rounded-[3px] border border-[#C5A059]/40 bg-[#C5A059]/10 text-[9px] font-mono text-[#C5A059] font-bold">
                    {active3dModel.badge}
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-serif font-bold text-white">
                  {active3dModel.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActive3dModel(null)}
                className="h-9 w-9 rounded-lg border border-[#24242C] bg-[#14141A] text-[#8E8E99] hover:text-white hover:border-[#C5A059] flex items-center justify-center transition-colors shrink-0"
                aria-label="Chiudi ispezione 3D"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 sm:p-6 space-y-6">
              {/* High-res Image Stage */}
              <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-[#050508] border border-[#24242C] flex items-center justify-center shadow-[inset_0_0_50px_rgba(0,0,0,0.9)]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(197,160,89,0.25)_0%,rgba(217,119,6,0.1)_40%,transparent_75%)] pointer-events-none" />
                
                {/* Sacred Architecture Corner Brackets */}
                <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#C5A059]/60 pointer-events-none z-20" />
                <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#C5A059]/60 pointer-events-none z-20" />
                <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#C5A059]/60 pointer-events-none z-20" />
                <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#C5A059]/60 pointer-events-none z-20" />

                <picture>
                  {active3dModel.webp && (
                    <source srcSet={active3dModel.webp} type="image/webp" />
                  )}
                  <img
                    src={active3dModel.src}
                    alt={active3dModel.title}
                    className="relative z-10 w-full h-full object-contain filter drop-shadow-[0_16px_36px_rgba(0,0,0,0.95)] select-none"
                  />
                </picture>
              </div>

              {/* Description & Narrative Details */}
              <div className="space-y-4 bg-[#121216] border border-[#24242C] rounded-xl p-5">
                <h4 className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.2em] uppercase">
                  ARCHITETTURA VISIVA // RENDERING 3D BLENDER &amp; GEMINI
                </h4>
                <p className="text-sm text-[#CCCCCC] leading-relaxed font-sans">
                  {active3dModel.description}
                </p>

                {active3dModel.highlights && active3dModel.highlights.length > 0 && (
                  <div className="pt-3 border-t border-[#24242C] space-y-2">
                    <span className="font-mono text-[10px] text-[#8E8E99] tracking-wider uppercase block font-semibold">
                      SIMBOLOGIA E FUNZIONALITÀ OPERATIVA:
                    </span>
                    <ul className="space-y-2 text-xs text-[#A0A0AA]">
                      {active3dModel.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="text-[#C5A059] shrink-0 mt-0.5">✦</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="font-mono text-xs text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/30 rounded-lg p-3 text-center">
                {active3dModel.criterion}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-6 border-t border-[#24242C] bg-[#0E0F14] flex justify-end">
              <button
                type="button"
                onClick={() => setActive3dModel(null)}
                className="px-5 py-2.5 rounded-lg border border-[#C5A059]/50 bg-[#C5A059]/15 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0A0A0C] font-mono text-xs font-bold tracking-wider uppercase transition-all"
              >
                Chiudi Ispezione
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
