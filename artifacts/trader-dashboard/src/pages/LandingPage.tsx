import { useEffect, useReducer, useRef, useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { Seo } from "@/components/Seo";
import { absoluteUrl, faqJsonLd, landingAlternates, landingPath } from "@/lib/seo";
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
import {
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Check,
  ShieldCheck,
  Lock,
  Unlock,
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
  Info,
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
    category: "FORMAZIONE VIDEO",
    title: "La Dottrina del Tempo",
    description: (
      <>
        L'arte di dividere l'operatività in due regimi inviolabili: l'<strong>Assedio</strong> per i movimenti macroscopici multi-day su HTF e il <strong>Duello</strong> per l'esecuzione chirurgica al minuto durante le Kill-Zone.
      </>
    ),
    criterion: "CRITERIO: Regole di invalidazione oggettive prima dell'ingresso.",
    sigilVariant: "doctrine",
    model3d: {
      src: "/images/modules/modulo-1-dottrina.jpg",
      webp: "/images/modules/modulo-1-dottrina.webp",
      alt: "La Dottrina del Tempo - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "La Dottrina del Tempo",
      details: "Diorama tridimensionale del Cronografo-Astrolabio Sacro: cassa circolare in bronzo brunito, cristallo zaffiro con lancette a sestante alchemico, movimento a tourbillon a vista con clessidra interna in ottone per la suddivisione esatta dei due regimi inviolabili dell'Assedio e del Duello.",
      highlights: [
        "Lancette a Sestante & Astrolabio: tracciamento millimetrico delle Kill-Zone e coordinate temporali",
        "Clessidra & Tourbillon Meccanico: separazione sacra tra Assedio (macro HTF) e Duello (micro LTF)",
        "Ghiera Incisa & Targhette in Bronzo: formalizzazione delle regole oggettive di invalidazione temporale",
      ],
    },
  },
  {
    id: "modulo-2",
    number: "MODULO II",
    category: "SIMULATORE",
    title: "La Forgia del Passato",
    description: (
      <>
        Addestramento nell'ombra. Affila la visione e testa le regole su centinaia di sessioni storiche senza rischiare capitale fino a raggiungere la perfezione biomeccanica dell'occhio.
      </>
    ),
    criterion: "CRITERIO: Replay candela per candela e audit matematico.",
    sigilVariant: "forge",
    model3d: {
      src: "/images/modules/modulo-2-forgia.jpg",
      webp: "/images/modules/modulo-2-forgia.webp",
      alt: "La Forgia del Passato - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "La Forgia del Passato",
      details: "Diorama tridimensionale dell'Officina Meccanica di Simulazione: incudine d'acciaio brunito, candele incandescenti forgiate a fuoco vivo, clessidra alchemica di sabbia dorata per il riavvolgimento temporale e turbine a vapore per il replay storico continuo.",
      highlights: [
        "Candele Incandescenti a Fuoco: simulazione cinetica e forgia della visione biomeccanica a grafico spento",
        "Clessidra Alchemica del Replay: controllo assoluto del flusso temporale candela per candela",
        "Incudine & Maglio Operativo: battitura ripetuta delle regole senza rischiare capitale reale",
      ],
    },
  },
  {
    id: "modulo-3",
    number: "MODULO III",
    category: "CO-PILOTA PRE-TRADE",
    title: "Il Custode della Soglia",
    description: (
      <>
        Il guardiano invisibile che blocca l'ingresso se non sono soddisfatte tutte le condizioni oggettive. Domanda chirurgica pre-sessione: stai agendo per lucidità o per debolezza emotiva?
      </>
    ),
    criterion: "CRITERIO: Blocco automatico dell'overtrading e fomo.",
    sigilVariant: "keeper",
    model3d: {
      src: "/images/modules/modulo-3-custode.jpg",
      webp: "/images/modules/modulo-3-custode.webp",
      alt: "Il Custode della Soglia - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "Il Custode della Soglia",
      details: "Diorama tridimensionale del Portale Blindato del Protocollo: mastodontica grata in ferro battuto con barre d'acciaio temperate, catene tese con snodi d'arresto, stella a quattro punte centrale con ingranaggi rotanti e indicatori ambrati di convalida pre-sessione.",
      highlights: [
        "Serratura a Stella & Ingranaggi di Blocco: impedisce l'accesso al mercato se anche una sola regola è violata",
        "Grata d'Acciaio & Catene: barriera impenetrabile contro overtrading, fomo e revenge trading",
        "Indicatori Ambrati di Convalida: autorizzazione all'esecuzione solo con lucidità chirurgica confermata",
      ],
    },
  },
  {
    id: "modulo-4",
    number: "MODULO IV",
    category: "JOURNAL D'INTEGRITÀ",
    title: "Il Libro della Verità",
    description: (
      <>
        Cronaca spietata di ogni click, emotività e scostamento dal piano. Non un semplice diario contabile, ma una misurazione scientifica del tuo Indice di Integrità e della disciplina.
      </>
    ),
    criterion: "CRITERIO: I numeri e i fatti non mentono mai.",
    sigilVariant: "book-of-truth",
    model3d: {
      src: "/images/modules/modulo-4-verita.jpg",
      webp: "/images/modules/modulo-4-verita.webp",
      alt: "Il Libro della Verità - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "Il Libro della Verità",
      details: "Diorama tridimensionale del Grande Tomo Meccanico dell'Integrità: pagine d'acciaio con metriche e curve di performance, catene con lucchetto di blocco emotivo, ingranaggi di calcolo e calibro di precisione sotto il motto 'I numeri e i fatti non mentono mai'.",
      highlights: [
        "Pagine di Metallo & Curve di Equity: tracciamento oggettivo ed eliminazione delle illusioni cognitive",
        "Catene & Meccanismi di Blocco: sigillatura del diario contro la manipolazione o la negazione degli errori",
        "Calibro & Strumenti di Precisione: misurazione millimetrica dell'Indice di Integrità operativa",
      ],
    },
  },
  {
    id: "modulo-5",
    number: "MODULO V",
    category: "CLASSIFICHE & ARENE",
    title: "La Gerarchia e Le Prove del Fuoco",
    description: (
      <>
        Il rango non si compra: si conquista. Competizioni meritocratiche basate sulla disciplina, drawdown controllato e rispetto delle regole, non sui favori effimeri della sorte.
      </>
    ),
    criterion: "CRITERIO: Avanzamento di grado per integrità dimostrata.",
    sigilVariant: "hierarchy",
    model3d: {
      src: "/images/modules/modulo-5-gerarchia.jpg",
      webp: "/images/modules/modulo-5-gerarchia.webp",
      alt: "La Gerarchia e Le Prove del Fuoco - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "La Gerarchia e Le Prove del Fuoco",
      details: "Diorama tridimensionale della Ziggurat delle Prove: scalinate rituali ad ascesa progressiva, fiumi di lava vulcanica, bracieri sacri e altare sommitale del sigillo gerarchico per la selezione meritocratica dei ranghi.",
      highlights: [
        "Altare Sommitale del Fuoco: sigillo del rango supremo conquistato per rigore matematico",
        "Scalinate delle Prove: avanzamento di grado candela dopo candela senza scorciatoie",
        "Fiumi di Lava & Bracieri: purificazione dagli impulsi distruttivi e dal drawdown emotivo",
      ],
    },
  },
  {
    id: "modulo-6",
    number: "MODULO VI",
    category: "RITO SETTIMANALE LIVE",
    title: "Il Concilio della Domenica",
    description: (
      <>
        Ogni domenica sera a mercati chiusi: mappatura corale della settimana entrante con la Cerchia dei membri per definire i livelli chiave di liquidità e azzerare le incertezze operative.
      </>
    ),
    criterion: "CRITERIO: Analisi preventiva e visione istituzionale.",
    sigilVariant: "brotherhood",
    model3d: {
      src: "/images/modules/modulo-6-concilio.jpg",
      webp: "/images/modules/modulo-6-concilio.webp",
      alt: "Il Concilio della Domenica - Modello 3D Blender & Gemini Image",
      badge: "MODELLO 3D // BLENDER",
      title: "Il Concilio della Domenica",
      details: "Diorama tridimensionale templare: maestosa cupola a cassettoni, sfera armillare olografica dorata per la proiezione delle traiettorie di liquidità, bracieri sacri rituali, tavola rotonda con mappe tattiche e basamento in bronzo cesellato.",
      highlights: [
        "Sfera Armillare Olografica: mappatura rotazione della liquidità e livelli chiave macroeconomici",
        "Tavola Rotonda Operativa: confronto corale e allineamento della Cerchia a mercati chiusi",
        "Architettura dell'Ordine: cupola templare e bracieri cerimoniali per azzerare l'ansia da esecuzione",
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
    subtitle: "SCALA INIZIATICA // AUREUS",
    caption: "Diorama Iniziativo: Sottoscrizione de Il Patto & La Soglia del Fuoco",
    details:
      "Scena visiva rappresentativa e rendering 3D dell'Ingresso nell'Ordine: l'operatore novizio, vestito dell'abito cerimoniale dell'iniziato, sottoscrive Il Patto di Ingresso sul leggio meccanico ornato da ingranaggi in bronzo, pergamena sacra e candele rituali. Sullo sfondo, la monumentale grata blindata in ferro battuto protegge l'accesso ai fuochi incandescenti de La Forgia del Passato, sormontata dal cartiglio bronzeo sospeso a catene della Scala Iniziatica.",
    highlights: [
      "Sottoscrizione de Il Patto di Ingresso: consacrazione formale alla disciplina, all'eliminazione dell'emotività e al Codice operativo",
      "Leggio Meccanico ad Orologeria & Candele: simbologia del rigore analitico e della misurazione oggettiva del tempo di esecuzione",
      "Soglia Blindata & Forgia del Fuoco: la barriera invalicabile tra l'anarchia emotiva del retail e la maestria dell'Ordine",
      "Cartiglio Bronzeo Forgiato: identificazione imperitura del Grado I — Novizio Consapevole con i sacri sigilli templari",
    ],
  },
  2: {
    src: "/images/grades/grado-2-custode.jpg",
    alt: "Grado II — Il Custode della Regola: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "GRADO II — IL CUSTODE DELLA REGOLA",
    subtitle: "SCALA INIZIATICA // AUREUS",
    caption: "Diorama Iniziativo: Il Ponte sul Baratro & Il Guardiano del Codice",
    details:
      "Scena visiva rappresentativa e rendering 3D della Prova del Fuoco: l'iniziato avanza lungo il ponte di pietra sospeso su un abisso di lava ardente verso la soglia sorvegliata da Il Custode della Regola, imponente guerriero in armatura a piastre con spadone a due mani dinanzi alla grata serrata. Sullo sfondo a volta gotica si apre la monumentale biblioteca degli archivi del Codice, sotto il possente cartiglio bronzeo sospeso a catene.",
    highlights: [
      "Il Ponte sul Baratro di Fuoco: superamento dell'abisso emotivo attraverso 30 sessioni consecutive al 100% di Integrità",
      "Il Custode in Armatura & Spada: barriera inflessibile che non ammette eccezioni, mezze verità o deviazioni dal piano",
      "Grata Blindata & Ingranaggi di Blocco: accesso concesso unicamente a chi ha dimostrato fedeltà assoluta al Codice",
      "Biblioteca degli Archivi & Tempio: diritto di trasmissione delle regole e attivazione de Il Mandato di Espansione (Royalty 20%)",
    ],
  },
  3: {
    src: "/images/grades/grado-3-osservatore.jpg",
    alt: "Grado III — L'Osservatore Sovrano: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "GRADO III — L'OSSERVATORE SOVRANO",
    subtitle: "SCALA INIZIATICA // AUREUS",
    caption: "La Visione Distaccata e il Controllo dall'Alto",
    details:
      "Scena visiva rappresentativa e rendering 3D dell'Osservatorio Sovrano: l'operatore veterano domina la terrazza astronomica gotica scrutando le traiettorie celesti attraverso un monumentale telescopio in ottone e acciaio su basamento dentato. Attorno, astrolabi alchemici, sfere armillari dorate, tavola tattica con mappe cartografiche e veduta notturna sulla rocca, sotto il sacro cartiglio bronzeo de L'Osservatore Sovrano.",
    highlights: [
      "Il Telescopio Monumentale ad Ingranaggi: visione macroscopica distaccata e anticipazione strategica delle Kill-Zone senza fomo",
      "Sfere Armillari & Astrolabi: governo trimestrale del tempo, del ritmo biologico e della disciplina operativa",
      "Tavola Rotonda con Mappe Tattiche: preparazione analitica e diritto di parola a «Il Concilio della Domenica»",
      "La Terrazza sulla Fortezza: elevazione al di sopra del rumore retail verso il controllo freddo e sovrano",
    ],
  },
  4: {
    src: "/images/grades/grado-4-architetto.jpg",
    alt: "Grado IV — L'Architetto del Reale: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "GRADO IV — L'ARCHITETTO DEL REALE",
    subtitle: "SCALA INIZIATICA // AUREUS",
    caption: "La Progettazione e la Maestria della Realtà",
    details:
      "Scena visiva rappresentativa e rendering 3D dell'Officina dell'Architetto: il maestro costruttore in armatura cerimoniale dorata progetta con compasso di precisione, calibri e pergamene tecniche sul grande tavolo di quercia. Sullo sfondo, il cantiere monumentale dell'Ordine con gru a catena, ponteggi e schemi architettonici sospesi, sotto il maestoso cartiglio bronzeo de L'Architetto del Reale.",
    highlights: [
      "Il Compasso di Precisione & Progetti: trasmutazione della maestria grafica in solide strutture economiche e imprenditoriali",
      "Il Cantiere dell'Ordine & Gru Meccaniche: espansione concreta del capitale attraverso la rete B2B e progetti ad alto impatto",
      "Trattati & Modelli di Fortezza: standardizzazione del metodo e rango di Garante Seniore ne La Fratellanza",
      "Lente d'Ingrandimento & Calibri: verifica spietata della profittabilità e superamento delle prove avanzate Straight Line",
    ],
  },
  5: {
    src: "/images/grades/grado-5-fondatore.jpg",
    alt: "Grado V — Il Fondatore d'Eredità: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "GRADO V — IL FONDATORE D'EREDITÀ",
    subtitle: "SCALA INIZIATICA // AUREUS",
    caption: "La Trasmissione del Codice e la Consacrazione dell'Impero",
    details:
      "Scena visiva rappresentativa e rendering 3D della Sala del Trono della Cerchia Interna: il Fondatore d'Eredità, veterano in armatura imperiale e manto regale, consacra il Grande Tomo del Protocollo apponendo il sacro sigillo in ceralacca rossa. Attorno, la cattedrale gotica con guardie cerimoniali in armatura, stendardi araldici, bracieri monumentali, piramide d'oro e immensa biblioteca dell'Impero, sotto il solenne cartiglio bronzeo sospeso a catene.",
    highlights: [
      "Apposizione del Sigillo di Ceralacca: consacrazione suprema del Codice, investitura della Cerchia Interna e perpetuazione della discendenza",
      "Il Grande Tomo della Sovranità: sintesi imperitura di tutti i protocolli, regole di rischio e verità matematiche dell'Ordine",
      "La Sala del Trono & Bracieri Monumentali: sovranità assoluta su tutte le divisioni dell'Ecosistema AUREUS",
      "Piramide d'Oro & Stendardi Araldici: simbolo del compimento della Scala Iniziatica e della trasmutazione del capitale in eredità eterna",
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
    alt: "Stato Inconscio // La Massa - I // La Deriva: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "I — LA DERIVA (STATO INCONSCIO // LA MASSA)",
    subtitle: "IL MANIFESTO DELL'ORDINE // SCENA I",
    caption: "Diorama Visivo: La tempesta della liquidità retail e la deriva degli inconsapevoli",
    details:
      "Scena visiva rappresentativa e rendering 3D dello Stato Inconscio (La Deriva): una chiatta industriale scura in ferro battuto naviga in balia di una tempesta implacabile e onde d'inchiostro nero. Una folla indistinta di operatori retail con sguardi fissi su schermi e candlestick caotici insegue segnali illusori e prezzi in fuga, illuminata solo da bagliori rossi e verdi d'emergenza. Sopra di loro, il cartiglio metallico industriale sospeso a catene reca l'avviso perenne: STATO INCONSCIO // LA MASSA - I // LA DERIVA.",
    highlights: [
      "La Chiatta Industriale nella Tempesta: navigazione alla cieca senza timone né protocollo, metafora dell'anarchia emotiva e dell'assenza di un modello di rischio",
      "La Folla Retail Ipnotizzata: operatori retail attratti dal rumore, da breakout tardivi e dall'ansia compulsiva di recupero perdite (revenge trading)",
      "Monitor e Candlestick di Disperazione: schermi intermittenti e grafici frammentati che divorano il capitale dei non disciplinati",
      "Il Cartiglio d'Allarme Industriale: avvertimento eterno sulla sorte del 95% del mercato, carburante e liquidità per gli algoritmi istituzionali",
    ],
  },
  2: {
    id: 2,
    src: "/images/manifesto/il-varco.jpg",
    alt: "La Decisione // L'Iniziato - II // Il Varco: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "II — IL VARCO (LA DECISIONE // L'INIZIATO)",
    subtitle: "IL MANIFESTO DELL'ORDINE // SCENA II",
    caption: "Diorama Visivo: L'abbandono del caos e il varco della monumentale soglia fortificata",
    details:
      "Scena visiva rappresentativa e rendering 3D de La Decisione (Il Varco): l'operatore iniziato volta definitivamente le spalle al naufragio della folla retail per incamminarsi sul molo d'acciaio verso la monumentale saracinesca d'accesso in pietra ciclopica e ferro battuto. Ai lati, le sentinelle armate vegliano sui bracieri ardenti, mentre al leggio cerimoniale gli scribi e custodi dell'Ordine registrano l'avvenuto ingresso nel Libro della Verità sotto il solenne cartiglio d'acciaio: LA DECISIONE // L'INIZIATO - II // IL VARCO [IL MOMENTO CHIAVE].",
    highlights: [
      "La Camminata dell'Iniziato: l'abbandono consapevole del rumore di mercato, dell'impulsività e delle illusioni del trading casuale",
      "La Saracinesca Monumentale & I Guardiani: accesso custodito e invalicabile, sbloccabile unicamente mediante rispetto ferreo della Regola e del rischio",
      "I Bracieri Cerimoniali & Il Fuoco della Forgia: purificazione psicologica ed eliminazione totale dell'avidità emotiva",
      "La Registrazione sul Libro della Verità: tracciamento immutabile di ogni eseguito sul leggio sacro, inizio della trasformazione in operatore meccanico",
    ],
  },
  3: {
    id: 3,
    src: "/images/manifesto/gli-architetti.jpg",
    alt: "Sovranità Operativa // L'Ordine - III // Gli Architetti: Scena Visiva 3D Blender & Gemini Image",
    badge: "MODELLO 3D // BLENDER",
    title: "III — GLI ARCHITETTI (SOVRANITÀ OPERATIVA // L'ORDINE)",
    subtitle: "IL MANIFESTO DELL'ORDINE // SCENA III",
    caption: "Diorama Visivo: Il Consiglio Strategico degli Architetti e la Sala della Sovranità Operativa",
    details:
      "Scena visiva rappresentativa e rendering 3D della Sovranità Operativa (Gli Architetti): all'interno della grandiosa sala gotico-industriale della Cittadella, il Consiglio degli Architetti in armature da parata e mantelli cerimoniali siede attorno alla monumentale tavola rotonda strategica. Al centro, il plastico architettonico dell'Impero e le carte topografiche con sestanti e lenti di precisione; sullo sfondo, le lavagne nere con grafici quantitativi e matrici numeriche, monumentali ingranaggi ad orologeria e le imponenti vetrate ad arco affacciate sull'oceano in tempesta, sotto il cartiglio bronzeo forgiato: SOVRANITÀ OPERATIVA // L'ORDINE - III // GLI ARCHITETTI.",
    highlights: [
      "La Tavola Rotonda Strategica: pianificazione meticolosa degli scenari HTF prima dell'apertura di qualsiasi posizione di mercato",
      "Plastico Architettonico & Compassi di Precisione: dimensionamento millimetrico del rischio, calcolo oggettivo del valore atteso e compounding del capitale",
      "Matrici Numeriche & Ingranaggi ad Orologeria: sincronizzazione perfetta con le Kill-Zone e automazione disciplinata dell'esecuzione",
      "La Sala Protetta & Le Vetrate sulla Tempesta: padronanza sovrana, calma interiore e distacco impassibile dal caos che infuria nel mercato retail",
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
  title: "L'UFFICIO DEL TESORO & DEI MANDATI",
  subtitle: "IL MANDATO DI ESPANSIONE // ROYALTY 20%",
  caption: "Diorama Visivo: Il Sigillo dell'Autofinanziamento e l'Azzeramento del Tributo",
  details:
    "Scena visiva rappresentativa e rendering 3D dell'Ufficio del Tesoro e dei Mandati dell'Ordine: in una maestosa sala a volte colma di archivi, l'Alto Cancelliere dell'Ordine in armatura e velluto cerimoniale siede al massiccio banco di calcolo e trascrizione. Sta apponendo il sigillo di ceralacca dorato sul Grande Registro dei Mandati, ratificando formalmente l'azzeramento del debito mensile dell'operatore meritevole. Sulla sinistra, un veterano introduce la fila dei cinque nuovi iniziati pronti a essere integrati nell'Ordine sotto la sorveglianza delle sentinelle. In primo piano, le pesanti bilance di precisione attestano il saldo netto a zero tra canone dovuto e royalty maturate, dinanzi al vassoio di velluto con le cinque chiavi cerimoniali d'oro e al contatore meccanico a scatti.",
  criterion: "REGOLA DEI 5 MEMBRI: 5 Iniziati Attivi × 30€/m = 150€/m azzerati al 100% a vita. Dal 6° iniziato: Rendita Perpetua di Merito.",
  highlights: [
    "Le 5 Grandi Chiavi d'Oro sul Vassoio: simbolo fisico dei 5 iniziati necessari per sbloccare l'immunità finanziaria e il canone a zero",
    "Le Bilance di Precisione: perfetto equilibrio matematico tra tributo dovuto (150€) e royalty maturate (5 × 30€ = 150€), costo netto zero",
    "L'Alto Cancelliere & Il Sigillo d'Oro: ratifica solenne nel Libro dei Mandati, elevando la crescita organica a decreto di merito cavalleresco",
    "L'Ingresso dei 5 Fratelli: selezione rigorosa e fratellanza operativa tra pari, lontana da schemi di affiliazione retail e fuffaguru",
    "Il Contatore Meccanico a Scatti: monitoraggio oggettivo e trasparente delle royalty ricorrenti accreditate ogni mese direttamente dal protocollo",
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
  const [pricingCycle, setPricingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedTierId, setSelectedTierId] = useState<"base_free" | "founders_10" | "complete_150">("founders_10");
  const [activeFeatureHover, setActiveFeatureHover] = useState<{ title: string; detail: string } | null>(null);
  const [showComparisonMatrix, setShowComparisonMatrix] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeGrade, setActiveGrade] = useState<LimenGradeNumber>(1);
  const [invitedMembers, setInvitedMembers] = useState<number>(5);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(true);
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
        jsonLd={[faqSchema]}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo & Sigil */}
          <Link href="/" className="flex items-center gap-3.5 group shrink-0 whitespace-nowrap">
            <div className="h-10 w-10 rounded-lg bg-[#121216] border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] shadow-[0_0_15px_rgba(197,160,89,0.18)] group-hover:border-[#C5A059] group-hover:shadow-[0_0_20px_rgba(197,160,89,0.35)] transition-all shrink-0 overflow-hidden">
              <img src="/app-icon-192.png?v=20261021g" alt="AUREUS" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col whitespace-nowrap">
              <span className="font-serif tracking-[0.25em] font-black text-xl text-[#F4F4F6] group-hover:text-[#C5A059] transition-colors uppercase leading-none">
                AUREUS
              </span>
              <span className="font-mono text-[9px] tracking-[0.22em] text-[#C5A059] uppercase leading-none mt-1 whitespace-nowrap">
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
          <div className="flex xl:hidden items-center gap-3">
            <button
              type="button"
              onClick={() => openGatekeeping("Richiesta di Ammissione alla Soglia (Header)")}
              className="hidden sm:inline-flex items-center gap-2 whitespace-nowrap px-4 py-2 rounded-lg border border-[#C5A059] bg-[#C5A059]/10 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0A0A0C] font-mono text-[11px] font-bold tracking-[0.18em] uppercase transition-all"
            >
              <span>VARCA LA SOGLIA</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </button>

            {/* Hamburger Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2.5 rounded-lg border border-[#24242C] text-[#8E8E99] hover:text-[#F4F4F6] bg-[#121216]/60 hover:bg-[#121216] transition-colors focus:outline-none focus:border-[#C5A059]/50"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Dropdown Panel */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-b border-[#24242C] bg-[#080808]/98 backdrop-blur-2xl px-6 py-6 space-y-4">
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
        <section className="relative pt-16 sm:pt-20 lg:pt-24 pb-20 sm:pb-28 lg:pb-36 overflow-hidden border-b border-[#24242C]/70 bg-[#060709]" aria-labelledby="hero-title">
          {/* Immersive Cathedral Atmosphere: Lateral Blender + Nano Banana Columns & Zenith Light */}
          <HeroAtmosphere />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center z-10">
            {/* Top Monospace Protocol Badge with Pulsing Live Singularity */}
            <div className="inline-flex items-center gap-2.5 px-4 sm:px-5 py-2 rounded-[4px] border border-[#C5A059]/45 bg-[#0E0F14]/95 text-[#C5A059] font-mono text-[10px] sm:text-[11px] tracking-[0.24em] uppercase shadow-[0_0_20px_rgba(197,160,89,0.18)] backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C5A059] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C5A059]"></span>
              </span>
              <SigilIcon variant="threshold" size={13} className="text-[#C5A059]" />
              <span>IL CODICE DELLA PRESENZA E DELL'EREDITÀ // CICLO OPERATIVO</span>
            </div>

            {/* Monumental Headline with Clean Unobstructed Center Stage */}
            <div className="relative w-full max-w-4xl mx-auto mt-8 sm:mt-10 lg:mt-12">
              <h1
                id="hero-title"
                className="landing-hero-title font-cinzel text-[1.75rem] sm:text-[2.65rem] lg:text-[3.25rem] font-bold text-[#F4F4F6] text-center leading-[1.18]"
              >
                <span className="block text-[#F4F4F6] sm:whitespace-nowrap drop-shadow-[0_4px_18px_rgba(0,0,0,0.9)]">
                  LA MASSA OFFRE IL TRIBUTO.
                </span>
                <span className="hero-gold-gradient block mt-3 sm:mt-4 font-black tracking-[0.04em] sm:tracking-[0.06em]">
                  GLI ARCHITETTI DISEGNANO IL VARCO.
                </span>
              </h1>
            </div>

            {/* Philosophical-Operational Sub-headline with Generous Margins */}
            <div className="max-w-2xl mx-auto mt-9 sm:mt-11 lg:mt-13 text-center">
              <p className="text-sm sm:text-base lg:text-[17px] text-neutral-300/90 leading-[1.8] font-sans font-normal">
                Nel rumore dei mercati, chi agisce per istinto non è un operatore: è il{" "}
                <strong className="text-[#C44D4D] font-semibold tracking-wide">combustibile della struttura</strong>. Oltre la soglia di{" "}
                <strong className="text-[#C5A059] font-medium tracking-wide">AUREUS</strong> non esistono scommesse, ma solo rito, allineamento geometrico ai volumi istituzionali e silenziosa esecuzione chirurgica.
              </p>
            </div>

            {/* 3-Pillar Institutional Micro-Anchor Bar with Clear Separation */}
            <div className="flex flex-wrap sm:flex-nowrap items-center justify-center gap-2.5 sm:gap-3.5 mt-8 sm:mt-10 lg:mt-12 font-mono text-[10px] sm:text-[11px] tracking-[0.14em] uppercase">
              <span className="px-4 py-2 rounded-[4px] bg-[#101015]/95 border border-[#C5A059]/30 text-[#C5A059] whitespace-nowrap shadow-sm">
                01. DECODIFICA DEI VOLUMI
              </span>
              <span className="text-[#C5A059]/40 hidden sm:inline">•</span>
              <span className="px-4 py-2 rounded-[4px] bg-[#101015]/95 border border-[#C5A059]/30 text-[#C5A059] whitespace-nowrap shadow-sm">
                02. DISCIPLINA CHIRURGICA
              </span>
              <span className="text-[#C5A059]/40 hidden sm:inline">•</span>
              <span className="px-4 py-2 rounded-[4px] bg-[#101015]/95 border border-[#C5A059]/30 text-[#C5A059] whitespace-nowrap shadow-sm">
                03. IMMUNITÀ DAL CAOS
              </span>
            </div>

            {/* CTA Action Area: Monumental Gold Button & Obsidian Glass */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 sm:mt-12 lg:mt-15 w-full">
              <button
                type="button"
                onClick={() => openGatekeeping("Ammissione Diretta - Eroe Principale")}
                className="hero-gold-btn group w-full sm:w-auto h-13 sm:h-14 px-8 sm:px-10 rounded-[6px] text-[#0A0A0C] font-mono text-xs sm:text-sm font-black tracking-[0.18em] uppercase inline-flex items-center justify-center gap-3 whitespace-nowrap cursor-pointer"
              >
                <span>VARCA LA SOGLIA — INIZIA L'ASCESA</span>
                <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
              </button>

              <a
                href="#manifesto"
                className="hero-obsidian-btn w-full sm:w-auto h-13 sm:h-14 px-8 rounded-[6px] text-[#C4C4CD] font-mono text-xs sm:text-sm font-semibold tracking-[0.16em] uppercase inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <span>LEGGI IL MANIFESTO</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-[#C5A059]" />
              </a>
            </div>

            {/* Curated Institutional Trust & Tribute Strip */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2.5 sm:gap-5 mt-9 sm:mt-11 lg:mt-12 px-5 py-2.5 rounded-[4px] bg-[#0D0E12]/90 border border-[#24242C] font-mono text-[10px] sm:text-[11px] text-[#8E8E99] tracking-[0.12em] uppercase backdrop-blur-md">
              <span className="flex items-center gap-1.5 text-[#E4E4EC]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#C5A059] shrink-0" />
                <span>TRIBUTO DI MANTENIMENTO:</span>
                <span className="text-[#C5A059] font-bold">150€ / MESE</span>
              </span>
              <span className="text-[#24242C] hidden sm:inline">|</span>
              <span className="text-[#A8A8B4] flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#C5A059] shrink-0" />
                <span>DISDICI CON UN CLIC // NESSUN VINCOLO</span>
              </span>
            </div>

            {/* Spazio Puro Dedicato al Film Master — Cornice a Filo Sottile Dorato con Respiro Maestoso */}
            <div className="mt-20 sm:mt-28 lg:mt-32 max-w-4xl w-full mx-auto">
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
                  className="absolute bottom-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0A0A0C]/75 hover:bg-[#0A0A0C] border border-[#C5A059]/50 text-[#C5A059] font-mono text-[10px] tracking-widest uppercase backdrop-blur-md transition-all shadow-[0_4px_15px_rgba(0,0,0,0.8)] cursor-pointer"
                  aria-label={isAudioMuted ? "Attiva audio narrazione" : "Disattiva audio"}
                >
                  {isAudioMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5 animate-pulse" />}
                  <span>{isAudioMuted ? "ATTIVA NARRATORE" : "AUDIO ON"}</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Thin vertical line connecting to the Manifesto */}
        <div className="w-[1px] h-20 bg-gradient-to-b from-[#C5A059]/40 via-[#C5A059] to-transparent mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_10px_#C5A059]" />
        </div>

        {/* =====================================================================
            3. SEZIONE STORYTELLING ("LO SPECCHIO DELLA VERITÀ")
            ===================================================================== */}
        <section id="manifesto" className="py-20 sm:py-28 relative" aria-labelledby="manifesto-title">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
            {/* Editorial Heading */}
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <span className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase">
                IL MANIFESTO DELL'ORDINE // LO SPECCHIO DELLA VERITÀ
              </span>
              <h2
                id="manifesto-title"
                className="text-2xl sm:text-4xl lg:text-5xl font-serif font-black text-white tracking-tight leading-tight"
              >
                Il Grafico come Radiografia dell'Anima Umana
              </h2>
              <p className="text-sm sm:text-base text-[#8E8E99] leading-relaxed font-sans">
                Il mercato non è un gioco di numeri o di previsioni magiche. È uno specchio morale inflessibile. Non premia i desideri: punisce l'ingordigia, la fretta e la debolezza interiore. Chi non sa dominare se stesso nel silenzio viene sistematicamente stritolato dalla folla rumorosa che alimenta la liquidità dei market maker.
              </p>
            </div>

            {/* The 3 Cards of the States of Man */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
              {/* Card 1: La Deriva */}
              <div className="rounded-2xl border border-[#24242C] bg-[#121216] p-6 sm:p-7 flex flex-col justify-between space-y-6 hover:border-red-900/50 transition-all duration-300 relative group">
                <div className="space-y-4">
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
                      STATO INCONSCIO // LA MASSA
                    </span>
                    <h3 className="text-xl font-serif font-bold text-white mt-1">
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
                          criterion: "DESTINO: Il 95% funge da carburante e liquidità per gli algoritmi istituzionali.",
                          highlights: scene.highlights,
                        })
                      }
                    />
                  )}

                  <p className="text-xs sm:text-sm text-[#8E8E99] leading-relaxed">
                    Reagire agli impulsi, inseguire i breakout in ritardo, acquistare indicatori miracolosi e cercare vendetta contro il mercato dopo ogni perdita. Assenza di rito, assenza di disciplina.
                  </p>
                </div>

                <div className="pt-4 border-t border-[#24242C] font-mono text-[11px] text-red-400/90 leading-tight">
                  DESTINO: Il 95% funge da carburante e liquidità per gli algoritmi istituzionali.
                </div>
              </div>

              {/* Card 2: Il Varco */}
              <div className="rounded-2xl border border-[#C5A059]/50 bg-[#121216] p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-[0_0_30px_rgba(197,160,89,0.1)] relative group">
                <div className="absolute top-0 right-0 -mt-2 -mr-2 px-3 py-0.5 rounded-full bg-[#C5A059] text-[#0A0A0C] font-mono text-[10px] font-black uppercase tracking-wider">
                  IL MOMENTO CHIAVE
                </div>

                <div className="space-y-4">
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
                      LA DECISIONE // L'INIZIATO
                    </span>
                    <h3 className="text-xl font-serif font-bold text-white mt-1">
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
                          criterion: "DESTINO: Uscita dal rumore. Trasformazione da scommettitore impulsivo a operatore meccanico.",
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
                    Rinuncia al richiamo dell'effimero e sottomissione volontaria alla Regola. Adozione de L'Ordine Giornaliero, rispetto del Custode della Soglia e registrazione inflessibile ne Il Libro della Verità.
                  </p>
                </div>

                <div className="pt-4 border-t border-[#C5A059]/30 font-mono text-[11px] text-[#C5A059] leading-tight">
                  DESTINO: Uscita dal rumore. Trasformazione da scommettitore impulsivo a operatore meccanico.
                </div>
              </div>

              {/* Card 3: Gli Architetti */}
              <div className="rounded-2xl border border-[#24242C] bg-[#121216] p-6 sm:p-7 flex flex-col justify-between space-y-6 hover:border-[#C5A059]/40 transition-all duration-300 relative group">
                <div className="space-y-4">
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
                      SOVRANITÀ OPERATIVA // L'ORDINE
                    </span>
                    <h3 className="text-xl font-serif font-bold text-white mt-1">
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
                          criterion: "DESTINO: Padronanza del tempo e del capitale. Avanzamento nella Gerarchia e Cerchia Interna.",
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
                    Esecuzione al minuto priva di esitazioni dopo validazione dello scenario HTF. Gestione millimetrica del rischio, estrazione sistematica di capitale e costruzione di eredità nel tempo.
                  </p>
                </div>

                <div className="pt-4 border-t border-[#24242C] font-mono text-[11px] text-[#C5A059] leading-tight">
                  DESTINO: Padronanza del tempo e del capitale. Avanzamento nella Gerarchia e Cerchia Interna.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Thin vertical line connecting to L'Ordine */}
        <div className="w-[1px] h-20 bg-gradient-to-b from-[#C5A059]/40 via-[#C5A059] to-transparent mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_10px_#C5A059]" />
        </div>

        {/* =====================================================================
            4. SEZIONE ARCHITETTURA SOFTWARE ("L'ORDINE GIORNALIERO")
            ===================================================================== */}
        <section id="features" className="py-20 sm:py-28 relative border-t border-[#24242C]/40" aria-labelledby="software-title">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <span className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase">
                ARCHITETTURA SOFTWARE // I 6 PILASTRI DELL'ORDINE
              </span>
              <h2
                id="software-title"
                className="text-2xl sm:text-4xl lg:text-5xl font-serif font-black text-white tracking-tight"
              >
                L'Ordine Giornaliero: L'Infrastruttura dell'Architetto
              </h2>
              <p className="text-sm sm:text-base text-[#8E8E99] leading-relaxed font-sans">
                Nessuna azione fuori dal protocollo. L'ecosistema software che trasforma la psicologia caotica in una catena di montaggio rigida, verificata e priva di margini per l'errore emotivo.
              </p>
            </div>

            {/* Bento Grid a 6 Blocchi */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {SOFTWARE_MODULES.map((module) => {
                const has3d = !!module.model3d;

                return (
                  <div
                    key={module.id}
                    className={`rounded-2xl border transition-all duration-300 group flex flex-col justify-between ${
                      has3d
                        ? "border-[#C5A059]/40 bg-gradient-to-b from-[#14141A] to-[#0E0F14] p-5 sm:p-6 shadow-[0_4px_30px_rgba(0,0,0,0.5)] hover:border-[#C5A059]/80 hover:shadow-[0_0_35px_rgba(197,160,89,0.22)]"
                        : "border-[#24242C] bg-[#121216] p-7 hover:border-[#C5A059]/50"
                    }`}
                  >
                    <div className="space-y-4">
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
                          <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1 px-2 py-1 rounded-[4px] bg-[#0E0F14]/90 border border-[#C5A059]/50 text-[#C5A059] hover:bg-[#C5A059] hover:text-[#0A0A0C] transition-colors shadow-lg text-[10px] font-mono font-bold">
                            <Maximize2 className="h-3 w-3" />
                            <span className="hidden sm:inline">ISPEZIONA</span>
                          </div>

                          {/* Subtle bottom fade vignette */}
                          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#14141A] via-[#14141A]/40 to-transparent pointer-events-none z-10" />
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
                        <span className="font-mono text-[10px] tracking-[0.2em] font-bold text-[#C5A059] uppercase">
                          {module.number} // {module.category}
                        </span>
                        <h3 className="text-lg font-serif font-bold text-white mt-1 group-hover:text-[#F5E5C9] transition-colors">
                          {module.title}
                        </h3>
                      </div>

                      <p className="text-xs text-[#8E8E99] leading-relaxed">
                        {module.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#24242C]/60 font-mono text-[11px] text-[#C5A059]">
                      {module.criterion}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Thin vertical line connecting to I 5 Gradi */}
        <div className="w-[1px] h-20 bg-gradient-to-b from-[#C5A059]/40 via-[#C5A059] to-transparent mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_10px_#C5A059]" />
        </div>

        {/* =====================================================================
            5. TIMELINE INTERATTIVA DEI "5 GRADI DI ASCESA"
            ===================================================================== */}
        <section id="how" className="py-20 sm:py-28 relative border-t border-[#24242C]/40" aria-labelledby="ladder-title">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <span className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase">
                SCALA INIZIATICA // MERITOCRAZIA OPERATIVA
              </span>
              <h2
                id="ladder-title"
                className="text-2xl sm:text-4xl lg:text-5xl font-serif font-black text-white tracking-tight"
              >
                I 5 Gradi di Ascesa: Il Rango non si Compra
              </h2>
              <p className="text-sm sm:text-base text-[#8E8E99] leading-relaxed font-sans">
                Nel mondo retail paghi per vantare titoli vuoti. In AUREUS, ogni livello, privilegio avanzato e mandato di espansione si sblocca esclusivamente dimostrando fedeltà assoluta al Codice.
              </p>
            </div>

            {/* Active Grade Detailed View with Integrated Progression & 3D Model */}
            <div className="rounded-2xl border border-[#C5A059]/40 bg-[#121216] p-6 sm:p-8 lg:p-10 shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative">
              {/* Grade Header with Integrated Grade Progression Selector in Top-Right */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-[#24242C] pb-6 mb-8">
                {/* Left: Active Grade Title & Subtitle */}
                <div className="flex items-center gap-4 min-w-0 flex-1 pr-4">
                  <span className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-[#C5A059] border-r border-[#24242C] pr-5 shrink-0">
                    {currentGradeDef.roman}
                  </span>
                  <div className="min-w-0">
                    <div className="font-mono text-xs font-bold tracking-widest text-[#C5A059] uppercase truncate">
                      {currentGradeDef.code}
                    </div>
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-serif font-black text-white mt-0.5 truncate">
                      {currentGradeDef.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#8E8E99] mt-1 line-clamp-2">
                      {currentGradeDef.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right: Integrated Grade Progression Selector (I, II, III, IV, V) */}
                <div className="shrink-0 flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 lg:pb-0">
                  {LIMEN_GRADES.map((gradeDef) => {
                    const isSelected = activeGrade === gradeDef.grade;
                    return (
                      <button
                        key={gradeDef.grade}
                        type="button"
                        onClick={() => setActiveGrade(gradeDef.grade)}
                        className={`min-w-[64px] sm:min-w-[74px] px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl border text-center transition-all shrink-0 ${
                          isSelected
                            ? "border-[#C5A059] bg-[#C5A059]/15 text-[#C5A059] shadow-[0_0_20px_rgba(197,160,89,0.25)]"
                            : "border-[#24242C] bg-[#0A0A0C] text-[#8E8E99] hover:border-[#C5A059]/40 hover:text-white hover:bg-[#141418]"
                        }`}
                        aria-label={`Seleziona ${gradeDef.code} - ${gradeDef.title}`}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-serif text-sm sm:text-base font-bold">
                            {gradeDef.roman}
                          </span>
                          <SigilIcon
                            variant={gradeDef.sigilId}
                            size={13}
                            className={isSelected ? "text-[#C5A059]" : "text-[#8E8E99]/60"}
                          />
                        </div>
                        <div className="text-[9.5px] sm:text-[10px] font-mono tracking-wider font-semibold uppercase mt-0.5 truncate">
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
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
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
                        criterion: `REQUISITO: ${currentGradeDef.requirementSummary}`,
                        highlights: model.highlights,
                      })
                    }
                  />
                </div>

                {/* Right Column: Requirements, Privileges & Action */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Requisito di Merito */}
                  <div className="rounded-xl border border-[#24242C] bg-[#0A0A0C] p-4 sm:p-5 font-mono text-xs space-y-2">
                    <div className="flex items-center justify-between text-[#8E8E99]">
                      <span>REQUISITO DI MERITO INDISPENSABILE:</span>
                      <span className="text-[#C5A059] font-bold">AUDIT D'INTEGRITÀ</span>
                    </div>
                    <div className="text-white font-sans text-xs sm:text-sm leading-relaxed">
                      {currentGradeDef.requirementSummary}
                    </div>
                  </div>

                  {/* Privilegi Sbloccati */}
                  <div className="rounded-xl border border-[#24242C] bg-[#0A0A0C] p-4 sm:p-5 space-y-3.5">
                    <div className="font-mono text-xs font-bold tracking-widest text-[#C5A059] uppercase border-b border-[#24242C] pb-2.5 flex items-center gap-2">
                      <Unlock className="h-4 w-4 text-[#C5A059]" />
                      <span>PRIVILEGI SBLOCCATI AL GRADO {currentGradeDef.roman}:</span>
                    </div>

                    <ul className="space-y-2.5 text-xs text-[#8E8E99]">
                      {currentGradeDef.unlockedPrivileges.map((privilege, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-[#C5A059] shrink-0 mt-0.5" />
                          <span className="text-[#F4F4F6] font-sans">{privilege}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Locked Notice */}
                  {currentGradeDef.lockedNotice && (
                    <div className="flex items-center gap-2 text-xs font-mono text-amber-400 bg-amber-950/20 border border-amber-900/40 rounded-xl p-3 sm:p-3.5">
                      <Lock className="h-4 w-4 shrink-0 text-amber-400" />
                      <span>{currentGradeDef.lockedNotice}</span>
                    </div>
                  )}

                  {/* CTA Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => openGatekeeping(`Ammissione per scalata al ${currentGradeDef.code}`)}
                      className="w-full py-3 rounded-xl border border-[#C5A059]/50 bg-[#C5A059]/15 hover:bg-[#C5A059] text-[#C5A059] hover:text-[#0A0A0C] font-mono text-xs font-bold tracking-wider uppercase transition-all shadow-[0_4px_20px_rgba(197,160,89,0.15)] hover:shadow-[0_0_25px_rgba(197,160,89,0.35)]"
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
        <div className="w-[1px] h-20 bg-gradient-to-b from-[#C5A059]/40 via-[#C5A059] to-transparent mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_10px_#C5A059]" />
        </div>

        {/* =====================================================================
            6. SEZIONE "IL MANDATO DI ESPANSIONE (ROYALTY 20%)"
            ===================================================================== */}
        <section id="espansione" className="py-16 sm:py-24 relative border-t border-[#24242C]/40" aria-labelledby="expansion-title">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
            {/* Section Header */}
            <div className="text-center space-y-3 max-w-3xl mx-auto">
              <span className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase flex items-center justify-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-[#C5A059]" />
                IL MANDATO DI ESPANSIONE // ROYALTY RICORRENTE 20%
              </span>
              <h2
                id="expansion-title"
                className="text-2xl sm:text-3xl lg:text-4xl font-serif font-black text-white tracking-tight"
              >
                Azzeramento del Tributo &amp; Rendita di Merito
              </h2>
              <p className="text-xs sm:text-sm text-[#8E8E99] leading-relaxed font-sans max-w-2xl mx-auto">
                Un mandato cavalleresco di crescita organica. Per ogni iniziato introdotto che supera Il Varco, ricevi una <strong className="text-white">Royalty del 20% (€30/mese a vita)</strong>. Con 5 iniziati, il Tributo mensile è azzerato al 100%.
              </p>
            </div>

            {/* Split Screen Master Cockpit: Artwork + Calculator */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
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
              <div className="lg:col-span-6 rounded-2xl border border-[#C5A059]/40 bg-[#121216] p-6 sm:p-7 shadow-[0_15px_40px_rgba(0,0,0,0.8)] space-y-5">
                {/* 5 Ceremonial Keys Progress Rack */}
                <div className="flex items-center justify-between pb-4 border-b border-[#24242C]">
                  <div className="flex items-center gap-2.5">
                    <Key className="h-4 w-4 text-[#C5A059]" />
                    <span className="font-mono text-xs font-bold text-white tracking-wider uppercase">
                      {invitedMembers >= 5
                        ? "✦ TRIBUTO AZZERATO (5 CHIAVI)"
                        : `${invitedMembers}/5 INIZIATI AL VARCO`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((keyIdx) => {
                      const isActive = invitedMembers >= keyIdx;
                      return (
                        <div
                          key={keyIdx}
                          className={`flex items-center justify-center h-7 w-7 rounded-md border transition-all duration-200 ${
                            isActive
                              ? "border-[#C5A059] bg-[#C5A059]/20 text-[#C5A059] shadow-[0_0_10px_rgba(197,160,89,0.3)] scale-105"
                              : "border-[#24242C] bg-[#0A0A0C] text-[#454552]"
                          }`}
                          title={`Chiave ${keyIdx}${keyIdx === 5 ? " — Azzeramento Tributo" : ""}`}
                        >
                          <Key className={`h-3.5 w-3.5 ${isActive ? "text-[#C5A059]" : "text-[#454552]"}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Slider Input Group */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="member-slider" className="font-mono text-xs font-bold text-[#8E8E99] tracking-wider uppercase flex items-center gap-2">
                      <Users className="h-4 w-4 text-[#C5A059]" />
                      <span>INIZIATI INTRODOTTI AL VARCO:</span>
                    </label>
                    <span className="font-mono text-xl sm:text-2xl font-black text-[#C5A059] bg-[#C5A059]/15 border border-[#C5A059]/30 px-3.5 py-0.5 rounded-lg shadow-[0_0_15px_rgba(197,160,89,0.25)]">
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
                    className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-[#24242C] accent-[#C5A059]"
                  />
                </div>

                {/* Math Breakdown Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono">
                  <div className="p-3.5 rounded-xl border border-[#24242C] bg-[#0A0A0C]">
                    <div className="text-[10px] text-[#8E8E99] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Coins className="h-3 w-3 text-[#C5A059]" />
                      <span>ROYALTY MENSILE</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                      €{monthlyRoyalty} <span className="text-xs text-[#8E8E99] font-normal">/ mese</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-[#8E8E99]">
                      {invitedMembers} iniziati × €30 (20%)
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[#24242C] bg-[#0A0A0C]">
                    <div className="text-[10px] text-[#8E8E99] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Scale className="h-3 w-3 text-[#C5A059]" />
                      <span>COSTO NETTO TRIBUTO</span>
                    </div>
                    {invitedMembers < 5 ? (
                      <div>
                        <div className="text-xl font-bold text-amber-400">
                          €{netTributeCost} <span className="text-xs text-[#8E8E99] font-normal">/ mese</span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-amber-400/80">
                          {5 - invitedMembers} per azzerare ({coveragePercent}%)
                        </div>
                      </div>
                    ) : invitedMembers === 5 ? (
                      <div>
                        <div className="text-xl font-black text-[#C5A059]">
                          €0 / MESE
                        </div>
                        <div className="mt-0.5 text-[10px] font-bold text-[#C5A059]">
                          ✦ AZZERATO AL 100%
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="text-xl font-black text-[#D4AF37]">
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
                  className="w-full py-3.5 rounded-xl border border-[#C5A059] bg-[#C5A059] text-[#0A0A0C] font-mono text-xs font-bold tracking-[0.2em] uppercase hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(197,160,89,0.25)]"
                >
                  <span>RICHIEDI IL MANDATO DI ESPANSIONE</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Thin vertical line connecting to Il Tributo */}
        <div className="w-[1px] h-20 bg-gradient-to-b from-[#C5A059]/40 via-[#C5A059] to-transparent mx-auto relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#C5A059] shadow-[0_0_10px_#C5A059]" />
        </div>

        {/* =====================================================================
            7. SEZIONE FINALE PRICING ("DOTAZIONE PRIME PERSONE 10€ & PROGETTO COMPLETO 150€")
            ===================================================================== */}
        <section id="pricing" className="py-20 sm:py-28 relative border-t border-[#24242C]/40 overflow-hidden bg-[#060709]" aria-labelledby="pricing-title">
          {/* Colonnato Monumentale 3D Laterale & Luce Zenitale */}
          <PricingAtmosphere />

          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10 relative z-10">
            {/* Header d'Ordine */}
            <div className="text-center space-y-4 max-w-3xl mx-auto">
              <span className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase">
                L'AMMISSIONE ALL'ORDINE // SCELTA DELLA DOTAZIONE
              </span>
              <h2
                id="pricing-title"
                className="text-3xl sm:text-5xl font-serif font-black text-white tracking-tight text-center drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)]"
              >
                Configura la Tua Dotazione
              </h2>
              <p className="text-sm sm:text-base text-[#8E8E99] leading-relaxed font-sans max-w-2xl mx-auto text-center [text-wrap:balance]">
                L'ingresso è selettivo. Sblocca la dotazione operativa per testare il tuo rigore a grafico spento, oppure accedi al progetto completo di formazione e finestra temporale bancaria.
              </p>

              {/* Toggle Interattivo Mensile / Annuale */}
              <div className="pt-2 flex justify-center">
                <div className="inline-flex items-center rounded-xl border border-[#C5A059]/40 bg-[#0E0F14] p-1 shadow-[0_0_25px_rgba(197,160,89,0.12)]">
                  <button
                    type="button"
                    onClick={() => setPricingCycle("monthly")}
                    className={`rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap cursor-pointer ${
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
                    className={`rounded-lg px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                      pricingCycle === "yearly"
                        ? "bg-[#C5A059] text-[#07080b] shadow-[0_0_15px_rgba(197,160,89,0.4)]"
                        : "text-[#94a3b8] hover:text-white"
                    }`}
                  >
                    <span>Cadenza Annuale</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider whitespace-nowrap ${
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
              {/* CARD 1: ESCLUSIVA PRIME PERSONE (10€/MESE O 100€/ANNO) */}
              <div
                onClick={() => setSelectedTierId("founders_10")}
                className={`relative rounded-3xl border p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 cursor-pointer ${
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
                      ✦ ESCLUSIVA PRIME PERSONE · BLOCCATO
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
                      Banco di Forgiatura &amp; Fondamenta di Rischio
                    </p>
                  </div>

                  {/* Price Banner */}
                  <div className="rounded-xl border border-[#C5A059]/20 bg-[#07080b]/90 p-4 flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-4xl sm:text-5xl font-black text-[#E8C56A] tracking-tight whitespace-nowrap">
                        {pricingCycle === "yearly" ? "€100" : "€10"}
                      </span>
                      <span className="font-mono text-xs text-[#94a3b8] whitespace-nowrap">
                        {pricingCycle === "yearly" ? "/ anno" : "/ mese"}
                      </span>
                    </div>

                    <div className="text-right">
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

                  {/* Modular Feature Badges (Compact, Zero Walls of Text) */}
                  <div className="space-y-2 pt-1">
                    {[
                      {
                        id: "forgia",
                        icon: <FlaskConical className="h-4 w-4 text-[#C5A059]" />,
                        title: "La Forgia del Passato",
                        badge: "SIMULATORE",
                        detail: "Replay storico candela per candela tick-by-tick senza limiti per allenare la vista a grafico spento.",
                      },
                      {
                        id: "patrimonio",
                        icon: <Coins className="h-4 w-4 text-[#C5A059]" />,
                        title: "Architettura Patrimoniale",
                        badge: "RISCHIO",
                        detail: "Barriere matematiche di drawdown, calcolo della perdita massima ammissibile e salvaguardia del capitale.",
                      },
                      {
                        id: "varco",
                        icon: <ShieldCheck className="h-4 w-4 text-[#10b981]" />,
                        title: "Il Varco & Libro della Verità",
                        badge: "DI DIRITTO",
                        detail: "Centro decisionale con checklist pre-trade anti-overtrading e registro spietato con Indice d'Integrità.",
                      },
                      {
                        id: "fratellanza",
                        icon: <Users className="h-4 w-4 text-[#10b981]" />,
                        title: "La Fratellanza & I 5 Gradi",
                        badge: "DI DIRITTO",
                        detail: "Agorà riservata dell'Ordine e ascesa meritocratica nei ranghi in base alla disciplina dimostrata.",
                      },
                    ].map((item) => (
                      <div
                        key={item.id}
                        onMouseEnter={() => setActiveFeatureHover({ title: item.title, detail: item.detail })}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFeatureHover({ title: item.title, detail: item.detail });
                        }}
                        className="group/feat flex items-center justify-between gap-2 p-2.5 rounded-lg border border-white/5 bg-[#07080b]/60 hover:border-[#C5A059]/40 hover:bg-[#151722] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#C5A059]/30 bg-[#07080b] group-hover/feat:border-[#C5A059]">
                            {item.icon}
                          </span>
                          <span className="font-mono text-xs font-semibold text-[#F4F4F6] truncate group-hover/feat:text-[#E8C56A]">
                            {item.title}
                          </span>
                        </div>
                        <span className="font-mono text-[8.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A] shrink-0 whitespace-nowrap">
                          {item.badge}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Controls: Live Telemetry Inspector & CTA */}
                <div className="mt-5 space-y-4 pt-4 border-t border-[#24242C]">
                  {/* Tactical Micro-Inspector */}
                  <div className="min-h-[44px] rounded-lg border border-[#C5A059]/20 bg-[#07080b]/90 px-3 py-2 flex items-center gap-2.5 text-xs text-[#C0C0C8]">
                    <Info className="h-4 w-4 text-[#C5A059] shrink-0" />
                    <div className="text-[11px] leading-snug">
                      {activeFeatureHover ? (
                        <>
                          <strong className="text-[#E8C56A]">{activeFeatureHover.title}:</strong>{" "}
                          <span>{activeFeatureHover.detail}</span>
                        </>
                      ) : (
                        <span className="text-[#94a3b8] italic">
                          Tocca o passa su un modulo per ispezionarne l'operatività tattica.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clean CTA Button (No text truncation / No overflow) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGatekeeping(
                        `Candidatura Dotazione Prime Persone (${pricingCycle === "yearly" ? "100€/a" : "10€/m"})`,
                        "founders_10",
                      );
                    }}
                    className="w-full py-4 px-4 rounded-xl border border-[#C5A059] bg-[#C5A059]/20 hover:bg-[#C5A059] text-[#E8C56A] hover:text-[#07080b] font-mono text-xs sm:text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(197,160,89,0.2)] group cursor-pointer"
                  >
                    <span>CANDIDATI CON DOTAZIONE PRIME PERSONE</span>
                    <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              {/* CARD 2: PROGETTO COMPLETO FORMAZIONE & FINESTRA (150€/MESE O 1500€/ANNO) */}
              <div
                onClick={() => setSelectedTierId("complete_150")}
                className={`relative rounded-3xl border p-6 sm:p-8 flex flex-col justify-between transition-all duration-300 cursor-pointer ${
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

                <div className="space-y-5">
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
                      Formazione, Finestra Operativa, Concilio &amp; Forgia
                    </p>
                  </div>

                  {/* Price Banner */}
                  <div className="rounded-xl border border-[#C5A059]/30 bg-[#07080b]/90 p-4 flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-4xl sm:text-5xl font-black text-white tracking-tight whitespace-nowrap">
                        {pricingCycle === "yearly" ? "€1.500" : "€150"}
                      </span>
                      <span className="font-mono text-xs text-[#94a3b8] whitespace-nowrap">
                        {pricingCycle === "yearly" ? "/ anno" : "/ mese"}
                      </span>
                    </div>

                    <div className="text-right">
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

                  {/* Modular Feature Badges (Compact, Zero Walls of Text) */}
                  <div className="space-y-2 pt-1">
                    {[
                      {
                        id: "dotazione_totale",
                        icon: <Sparkles className="h-4 w-4 text-[#E8C56A]" />,
                        title: "Tutta la Dotazione Operativa",
                        badge: "FORGIA + PATRIMONIO",
                        detail: "Tutti gli strumenti della Dotazione Prime Persone inclusi senza costi aggiuntivi.",
                      },
                      {
                        id: "dottrina",
                        icon: <GraduationCap className="h-4 w-4 text-[#C5A059]" />,
                        title: "La Dottrina del Tempo",
                        badge: "ACCADEMIA VIDEO",
                        detail: "Libreria video d'Ordine completa: regimi di Assedio (Swing macro) e Duello (Scalp micro).",
                      },
                      {
                        id: "finestra",
                        icon: <Crosshair className="h-4 w-4 text-[#C5A059]" />,
                        title: "La Finestra Operativa",
                        badge: "KILL-ZONE",
                        detail: "Coordinate orarie precise dei cicli di liquidità bancaria e finestre operative ad alta probabilità.",
                      },
                      {
                        id: "concilio",
                        icon: <Flame className="h-4 w-4 text-[#C5A059]" />,
                        title: "Il Concilio della Domenica",
                        badge: "RITO LIVE",
                        detail: "Analisi live settimanale a mercati chiusi per mappare la rotazione monetaria e azzerare i dubbi.",
                      },
                      {
                        id: "tornei",
                        icon: <Trophy className="h-4 w-4 text-[#E8C56A]" />,
                        title: "Prove del Fuoco & Royalty 20%",
                        badge: "TORNEI & ESPANSIONE",
                        detail: "Accesso alle Arene Trimestrali d'Onore e attivazione del Mandato di Espansione dal Grado II.",
                      },
                    ].map((item) => (
                      <div
                        key={item.id}
                        onMouseEnter={() => setActiveFeatureHover({ title: item.title, detail: item.detail })}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveFeatureHover({ title: item.title, detail: item.detail });
                        }}
                        className="group/feat flex items-center justify-between gap-2 p-2.5 rounded-lg border border-white/5 bg-[#07080b]/60 hover:border-[#C5A059]/40 hover:bg-[#151722] transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#C5A059]/30 bg-[#07080b] group-hover/feat:border-[#C5A059]">
                            {item.icon}
                          </span>
                          <span className="font-mono text-xs font-semibold text-[#F4F4F6] truncate group-hover/feat:text-[#E8C56A]">
                            {item.title}
                          </span>
                        </div>
                        <span className="font-mono text-[8.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#E8C56A] shrink-0 whitespace-nowrap">
                          {item.badge}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Controls: Live Telemetry Inspector & CTA */}
                <div className="mt-5 space-y-4 pt-4 border-t border-[#24242C]">
                  {/* Tactical Micro-Inspector */}
                  <div className="min-h-[44px] rounded-lg border border-[#C5A059]/20 bg-[#07080b]/90 px-3 py-2 flex items-center gap-2.5 text-xs text-[#C0C0C8]">
                    <Info className="h-4 w-4 text-[#C5A059] shrink-0" />
                    <div className="text-[11px] leading-snug">
                      {activeFeatureHover ? (
                        <>
                          <strong className="text-[#E8C56A]">{activeFeatureHover.title}:</strong>{" "}
                          <span>{activeFeatureHover.detail}</span>
                        </>
                      ) : (
                        <span className="text-[#94a3b8] italic">
                          Tocca o passa su un modulo per ispezionarne l'operatività tattica.
                        </span>
                      )}
                    </div>
                  </div>

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
                    className="w-full py-4 px-4 rounded-xl border-2 border-[#C5A059] bg-[#C5A059] hover:bg-[#E8C56A] text-[#07080b] font-mono text-xs sm:text-sm font-black tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_35px_rgba(197,160,89,0.45)] group cursor-pointer"
                  >
                    <span>ATTRAVERSA IL VARCO · PROGETTO COMPLETO</span>
                    <ArrowRight className="h-4 w-4 shrink-0 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>

            {/* Interactive Module Comparison Table */}
            <div className="space-y-4 pt-1">
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => setShowComparisonMatrix(!showComparisonMatrix)}
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border border-[#C5A059]/40 bg-[#07080b] hover:bg-[#12141c] hover:border-[#C5A059] text-[#E8C56A] font-mono text-xs font-bold tracking-wider uppercase transition-all shadow-[0_0_20px_rgba(0,0,0,0.6)] cursor-pointer"
                >
                  <Layers className="h-4 w-4 text-[#C5A059]" />
                  <span>{showComparisonMatrix ? "Nascondi Matrice Moduli" : "Confronta Dotazioni a Colpo d'Occhio"}</span>
                  {showComparisonMatrix ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {showComparisonMatrix && (
                <div className="rounded-2xl border border-[#C5A059]/30 bg-[#0d0f14]/95 p-5 sm:p-7 shadow-[0_0_40px_rgba(0,0,0,0.8)] overflow-x-auto animate-in fade-in slide-in-from-top-4 duration-300">
                  <div className="text-center mb-4 space-y-1">
                    <h4 className="font-serif text-lg font-bold text-white">Matrice di Accesso ai Moduli d'Ordine</h4>
                    <p className="font-mono text-xs text-[#94a3b8]">Confronto analitico tra i 3 gradi di dotazione</p>
                  </div>

                  <table className="w-full min-w-[560px] text-xs font-mono text-left">
                    <thead>
                      <tr className="border-b border-[#24242C] text-[#94a3b8]">
                        <th className="py-2.5 px-3">Modulo di Protocollo</th>
                        <th className="py-2.5 px-3 text-center">Soglia Base (0€)</th>
                        <th className="py-2.5 px-3 text-center text-[#E8C56A]">Prime Persone (10€/m)</th>
                        <th className="py-2.5 px-3 text-center text-white">Progetto Completo (150€/m)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#24242C]/60 text-[#D0D0D8]">
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">Il Varco (Cockpit Pre-Trade)</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">Il Libro della Verità &amp; 5 Gradi</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">La Forgia del Passato (Simulatore Replay)</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#E8C56A] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">Architettura Patrimoniale (Rischio)</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#E8C56A] font-bold">✓ Incluso</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">La Dottrina del Tempo (Video Assedio &amp; Duello)</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#555]">—</td>
                        <td className="py-2.5 px-3 text-center text-[#10b981] font-bold">✓ Incluso</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-sans font-medium text-white">La Finestra Operativa (Kill-Zone Bancarie)</td>
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
                        <td className="py-2.5 px-3 font-sans font-medium text-white">Prove del Fuoco (Tornei) &amp; Royalty 20%</td>
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
            <div className="rounded-2xl border border-[#C5A059]/30 bg-[#0d0f14]/90 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-left">
                <ShieldCheck className="h-5 w-5 text-[#C5A059] shrink-0" />
                <p className="text-xs text-[#D0D0D8]">
                  <strong>Soglia Iniziale del Protocollo (0 €):</strong> Puoi inviare la candidatura anche partendo dalla sola dotazione base inclusa (<em>Il Varco, Il Libro della Verità, La Fratellanza e i 5 Gradi di Ascesa</em>) e sbloccare i moduli successivi in ogni momento.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  openGatekeeping("Candidatura Soglia Base (0€)", "base_free")
                }
                className="shrink-0 rounded-lg border border-[#C5A059]/40 bg-[#07080b] px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[#E8C56A] hover:border-[#C5A059] hover:bg-[#C5A059]/10 transition-all whitespace-nowrap cursor-pointer"
              >
                Configura Candidatura Base →
              </button>
            </div>

            {/* Embedded FAQ Accordion Section */}
            <div id="faq" className="pt-16 sm:pt-20 space-y-10 max-w-3xl mx-auto">
              {/* Header with Sigil Emblem & Altar glow */}
              <div className="text-center space-y-3 relative">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-[#C5A059]/40 bg-[#141418] text-[#C5A059] shadow-[0_0_25px_rgba(197,160,89,0.25)] mx-auto mb-1">
                  <SigilIcon variant="threshold" size={24} className="text-[#C5A059]" />
                </div>
                <div className="font-mono text-xs font-bold text-[#C5A059] tracking-[0.25em] uppercase">
                  {t("landing.faq.eyebrow")}
                </div>
                <h3 className="text-2xl sm:text-4xl font-serif font-black text-white tracking-tight">
                  Chiarimenti sull'Ammissione &amp; la Regola
                </h3>
                <p className="text-xs sm:text-sm text-[#8E8E99] font-sans max-w-xl mx-auto leading-relaxed">
                  {t("landing.faq.subheading")}
                </p>
                <div className="w-16 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/60 to-transparent mx-auto pt-1" />
              </div>

              {/* Centered Monolithic Accordion Cards */}
              <div className="space-y-4">
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
                        className="w-full p-6 sm:p-7 text-center flex flex-col items-center justify-center gap-2.5 transition-colors group cursor-pointer"
                        aria-expanded={isOpen}
                      >
                        {/* Roman numeral badge */}
                        <span className="font-mono text-[10px] sm:text-[11px] font-bold text-[#C5A059] tracking-[0.25em] uppercase group-hover:text-amber-300 transition-colors">
                          {t(item.badgeKey)}
                        </span>

                        {/* Centered Question */}
                        <h4 className="font-serif font-bold text-base sm:text-lg text-white group-hover:text-[#F4F4F6] transition-colors leading-snug max-w-2xl px-2">
                          {t(item.questionKey)}
                        </h4>

                        {/* Circular expand indicator */}
                        <div
                          className={`mt-1 w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-300 ${
                            isOpen
                              ? "border-[#C5A059] bg-[#C5A059]/20 text-[#C5A059] rotate-180"
                              : "border-[#24242C] bg-[#16161C] text-[#8E8E99] group-hover:border-[#C5A059]/50 group-hover:text-[#C5A059]"
                          }`}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-6 sm:px-10 pb-7 pt-1 text-center animate-in fade-in duration-300 space-y-4">
                          {/* Delicate Gilded Divider */}
                          <div className="w-24 h-[1px] bg-gradient-to-r from-transparent via-[#C5A059]/40 to-transparent mx-auto" />

                          {/* Centered Answer Text */}
                          <p className="text-xs sm:text-sm text-[#A0A0AA] font-sans leading-relaxed max-w-2xl mx-auto">
                            {t(item.answerKey)}
                          </p>

                          {/* Contextual canon tag */}
                          <div className="pt-2">
                            <span className="inline-block font-mono text-[10px] text-[#C5A059]/80 tracking-[0.2em] uppercase px-3 py-1 rounded-full border border-[#C5A059]/20 bg-[#C5A059]/5">
                              {t(item.tagKey)}
                            </span>
                          </div>
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
        <footer className="py-16 border-t border-[#24242C] bg-[#0A0A0C] text-center space-y-6">
          <div className="max-w-3xl mx-auto px-4 space-y-3">
            <SigilIcon variant="threshold" size={28} className="text-[#C5A059] mx-auto opacity-70" />
            <p className="font-serif italic text-sm sm:text-base text-[#8E8E99]">
              "Aureus non est finis, sed initium virtutis. Chi cerca la scorciatoia trova la rovina; chi rispetta la regola conquista la sovranità."
            </p>
            <div className="font-mono text-[11px] text-[#C5A059] tracking-[0.2em] uppercase">
              AUREUS PROTOCOL // IL CODICE DELLA PRESENZA E DELL'EREDITÀ
            </div>
          </div>

          <div className="pt-6 border-t border-[#24242C]/50 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-[#8E8E99]">
            <Link href="/" className="hover:text-white transition-colors">PORTALE PRINCIPALE</Link>
            <Link href="/protocollo" className="hover:text-white transition-colors">PROTOCOLLO OPERATIVO</Link>
            <Link href="/academy" className="hover:text-white transition-colors">ACCADEMIA SANDBOX</Link>
            <Link href="/sign-in" className="hover:text-white transition-colors">ACCEDI ALL'ORDINE</Link>
          </div>

          <div className="font-mono text-[10px] text-slate-600">
            © 2026 AUREUS PROTOCOL. TUTTI I DIRITTI RISERVATI. ARCHITETTURA E CICLO OPERATIVO.
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
