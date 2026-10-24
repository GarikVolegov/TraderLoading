import type { LimenGradeNumber } from "./limenGrades";

export type ArsenalProductCategory = "physical" | "protocol" | "corporate";
export type ArsenalFulfillmentProvider = "lulu" | "printful" | "dropship_manual" | "digital";

export interface ArsenalProductVariant {
  id: string;
  label: string;
  sku?: string;
  inStock?: boolean;
}

export interface ArsenalProductColorway {
  id: string;
  name: string;
  hex: string;
  previewImage?: string;
}

export interface ArsenalProduct {
  id: string;
  category: ArsenalProductCategory;
  sigil: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  priceCents: number; // 0 per protocolli gratuiti o consultazioni
  currency: string;
  requiredGrade: LimenGradeNumber;
  requiredLabel: string;
  specs: string[];
  fulfillmentProvider: ArsenalFulfillmentProvider;
  variants?: ArsenalProductVariant[];
  colorways?: ArsenalProductColorway[];
  images?: string[];
  estimatedDelivery: string;
  isPurchasable: boolean;
  ctaLabel: string;
  editorialHighlights?: string[];
}

export const ARSENAL_PRODUCTS: readonly ArsenalProduct[] = [
  {
    id: "codice-trimestrale",
    category: "physical",
    sigil: "libro",
    eyebrow: "ASSET FISICO · STAMPA ON-DEMAND DI LUSSO",
    title: "Il Codice Trimestrale (Diario Operativo)",
    subtitle: "Volume cartaceo di 90 giorni rilegato in copertina rigida telata ossidiana.",
    description:
      "Lo strumento cardine per l'Operatore che vuole eliminare il rumore cognitivo. Progettato con griglia millimetrica per sincronizzare L'Ordine Giornaliero, Il Custode della Soglia e Il Libro della Verità senza schermi durante la fase riflessiva.",
    priceCents: 4900, // 49.00 EUR
    currency: "eur",
    requiredGrade: 1,
    requiredLabel: "Accessibile dal Grado I — Neofita al Varco",
    specs: [
      "90 Sessioni Giornaliere strutturate (Contemplazione, Punto di Svolta, Sigillo d'Azione)",
      "12 Schede di Revisione per Il Concilio della Domenica",
      "Carta avorio antiriflesso 120g/m² priva di loghi commerciali esterni (apertura piatta a 180°)",
      "Rilegatura rigida casewrap nero ossidiana con nastro segnalibro e sigillo oro antico",
    ],
    editorialHighlights: [
      "Zero distrazioni digitali: fissare i parametri a mano prima dell'apertura del broker riduce l'overtrading del 67%.",
      "Spedito direttamente dallo stampatore al tuo indirizzo con imballo protettivo e tracking prioritario.",
    ],
    fulfillmentProvider: "lulu",
    variants: [
      { id: "standard-a5", label: "Formato Standard A5 (Executive Hardcover)" },
      { id: "deluxe-b5", label: "Formato Studio B5 (Larger Desk Edition)" },
    ],
    estimatedDelivery: "4-7 giorni lavorativi (Spedizione Tracciata UE/Internazionale)",
    isPurchasable: true,
    ctaLabel: "Ordina Diario Cartaceo",
  },
  {
    id: "uniforme-completa",
    category: "physical",
    sigil: "arsenale",
    eyebrow: "SARTORIA D'ORDINE · SET COMPLETO",
    title: "L'Uniforme Completa (Felpa & Pantalone)",
    subtitle: "Set coordinato felpa e pantalone sartoriale con ricami dorati Madeira.",
    description:
      "Completo ufficiale dell'Operatore Limen in cotone pesante, venduto esclusivamente come set coordinato. Taglio dritto minimale privo di marchi commerciali, con ricami dorati su petto, polsino, dorso e fianco.",
    priceCents: 15900, // 159.00 EUR
    currency: "eur",
    requiredGrade: 2,
    requiredLabel: "Riservato al Grado II+ (Il Custode della Regola)",
    images: [
      "/images/merch/uniforme-completa-sportgrey.jpg",
      "/images/merch/hoodie-front-sportgrey.jpg",
      "/images/merch/hoodie-back-trajan.jpg",
      "/images/merch/hoodie-wrist-aureus.jpg",
      "/images/merch/pant-front-sportgrey.jpg",
      "/images/merch/pant-macro-ordo.jpg",
      "/images/merch/uniforme-completa-black.jpg",
      "/images/merch/uniforme-completa-darkheather.jpg",
    ],
    colorways: [
      {
        id: "sport-grey",
        name: "Sport Grey (Titanio)",
        hex: "#C5C7CC",
        previewImage: "/images/merch/uniforme-completa-sportgrey.jpg",
      },
      {
        id: "obsidian-black",
        name: "Obsidian Black (Nero)",
        hex: "#16161A",
        previewImage: "/images/merch/uniforme-completa-black.jpg",
      },
      {
        id: "dark-heather",
        name: "Dark Heather (Grafite)",
        hex: "#38393F",
        previewImage: "/images/merch/uniforme-completa-darkheather.jpg",
      },
    ],
    specs: [
      "Felpa: Firma dorata sul petto, Aureo al polsino, Pilastro Traiano dorsale",
      "Pantalone: Placca Cardo & Decumanus al fianco, fondo dritto senza elastico",
      "Materiale: 100% cotone pettinato pesante prelavato (271 g/m² e 380 g/m²)",
      "Lavorazione: Ricami ad alta densità in filo dorato satinato Madeira",
    ],
    editorialHighlights: [
      "Set coordinato felpa e pantalone venduti esclusivamente assieme.",
      "Spedizione tracciata Printful con packaging d'Ordine.",
    ],
    fulfillmentProvider: "printful",
    variants: [
      { id: "size-s", label: "Taglia S" },
      { id: "size-m", label: "Taglia M" },
      { id: "size-l", label: "Taglia L" },
      { id: "size-xl", label: "Taglia XL" },
      { id: "size-xxl", label: "Taglia XXL" },
    ],
    estimatedDelivery: "5-8 giorni lavorativi (Spedizione Tracciata)",
    isPurchasable: true,
    ctaLabel: "Ordina Set Completo",
  },
  {
    id: "uniforme-hoodie",
    category: "physical",
    sigil: "arsenale",
    eyebrow: "SARTORIA TECNICA D'ORDINE · GILDAN 18500 HEAVY BLEND",
    title: "L'Uniforme — Golden Signature & Trajan Column Hoodie",
    subtitle: "Capo sartoriale non vendibile singolarmente — incluso esclusivamente nell'Uniforme Completa d'Ordine.",
    description:
      "Capo sartoriale d'eccellenza per l'Operatore Limen. Tre punti di ricamo ad altissima densità con filati dorati Madeira Classic Gold: firma calligrafica 'Limen' sul petto sinistro, Aureo Romano numismatico (Aureus Liminis) da 4.5 cm con la Porta Ianua sul polsino sinistro, e grande Pilastro Romano Istoriato (Columna Caelata) sul dorso. Venduto esclusivamente nel set completo.",
    priceCents: 8900,
    currency: "eur",
    requiredGrade: 2,
    requiredLabel: "Riservato al Grado II+ (Il Custode della Regola)",
    images: [
      "/images/merch/hoodie-front-sportgrey.jpg",
      "/images/merch/hoodie-back-trajan.jpg",
      "/images/merch/hoodie-wrist-aureus.jpg",
      "/images/merch/hoodie-front-black.jpg",
      "/images/merch/hoodie-back-black.jpg",
      "/images/merch/hoodie-front-darkheather.jpg",
    ],
    colorways: [
      {
        id: "sport-grey",
        name: "Sport Grey (Mélange Titanio)",
        hex: "#C5C7CC",
        previewImage: "/images/merch/hoodie-front-sportgrey.jpg",
      },
      {
        id: "obsidian-black",
        name: "Obsidian Black (Nero Assoluto)",
        hex: "#16161A",
        previewImage: "/images/merch/hoodie-front-black.jpg",
      },
      {
        id: "dark-heather",
        name: "Dark Heather (Grafite d'Ordine)",
        hex: "#38393F",
        previewImage: "/images/merch/hoodie-front-darkheather.jpg",
      },
    ],
    specs: [
      "Petto Sinistro: Firma Calligrafica 'Limen' dorata ad altissima densità (10 × 5 cm, punto raso Madeira Gold)",
      "Polsino Sinistro: Aureo Romano Numismatico (Aureus Liminis, 4.5 cm) con Porta Ianua a battenti chiusi e corona di 36 perle",
      "Schiena Dorsale: Pilastro Romano Istoriato (Columna Caelata 28 × 14 cm) con capitello corinzio e narrazione a 5 gradi (Zero loghi commerciali)",
      "Blank Ufficiale Gildan 18500 Heavy Blend (50% cotone pettinato / 50% poliestere prelavato, 271 g/m²)",
    ],
    editorialHighlights: [
      "Disponibile esclusivamente acquistando L'Uniforme Completa d'Ordine (Felpa + Pantalone).",
    ],
    fulfillmentProvider: "printful",
    variants: [
      { id: "size-s", label: "Taglia S (Regular Fit)" },
      { id: "size-m", label: "Taglia M (Regular Fit)" },
      { id: "size-l", label: "Taglia L (Regular Fit)" },
      { id: "size-xl", label: "Taglia XL (Regular Fit)" },
      { id: "size-xxl", label: "Taglia XXL (Regular Fit)" },
    ],
    estimatedDelivery: "5-8 giorni lavorativi (Incluso nel Set Completo)",
    isPurchasable: false,
    ctaLabel: "Incluso nel Set Completo",
  },
  {
    id: "uniforme-pantalone",
    category: "physical",
    sigil: "arsenale",
    eyebrow: "SARTORIA TECNICA D'ORDINE · HEAVYWEIGHT RELAXED FIT",
    title: "L'Uniforme — Heavyweight Relaxed Pant (Cardo & Decumanus)",
    subtitle: "Capo sartoriale non vendibile singolarmente — incluso esclusivamente nell'Uniforme Completa d'Ordine.",
    description:
      "Capo sartoriale complementare alla hoodie d'Ordine. Progettato secondo il principio del Minimalismo Architettonico: fronte 100% pulito 'zero-noise', taglio dritto fluido contemporaneo senza elastico alla caviglia, e micro-ricamo 3D modellato in Blender del Cardo & Decumanus in filo dorato satinato Madeira Gold. Venduto esclusivamente nel set completo.",
    priceCents: 7900,
    currency: "eur",
    requiredGrade: 2,
    requiredLabel: "Riservato al Grado II+ (Il Custode della Regola)",
    images: [
      "/images/merch/pant-front-sportgrey.jpg",
      "/images/merch/pant-front-black.jpg",
      "/images/merch/pant-front-darkheather.jpg",
      "/images/merch/pant-macro-ordo.jpg",
    ],
    colorways: [
      {
        id: "sport-grey",
        name: "Sport Grey (Mélange Titanio)",
        hex: "#C5C7CC",
        previewImage: "/images/merch/pant-front-sportgrey.jpg",
      },
      {
        id: "obsidian-black",
        name: "Obsidian Black (Nero Assoluto)",
        hex: "#16161A",
        previewImage: "/images/merch/pant-front-black.jpg",
      },
      {
        id: "dark-heather",
        name: "Dark Heather (Grafite d'Ordine)",
        hex: "#38393F",
        previewImage: "/images/merch/pant-front-darkheather.jpg",
      },
    ],
    specs: [
      "Fianco Sinistro: Placca 3D 'Cardo & Decumanus' (Canone Geometrico Romano) ad alta definizione in filo dorato Madeira",
      "Taglio contemporaneo Heavyweight Relaxed a gamba dritta (Open Leg Hem, caduta fluida senza elastico alla caviglia)",
      "Tessuto heavyweight 380-400 gsm in 100% cotone pettinato biologico prelavato anti-piega",
    ],
    editorialHighlights: [
      "Disponibile esclusivamente acquistando L'Uniforme Completa d'Ordine (Felpa + Pantalone).",
    ],
    fulfillmentProvider: "printful",
    variants: [
      { id: "size-s", label: "Taglia S (Relaxed Fit)" },
      { id: "size-m", label: "Taglia M (Relaxed Fit)" },
      { id: "size-l", label: "Taglia L (Relaxed Fit)" },
      { id: "size-xl", label: "Taglia XL (Relaxed Fit)" },
      { id: "size-xxl", label: "Taglia XXL (Relaxed Fit)" },
    ],
    estimatedDelivery: "5-8 giorni lavorativi (Incluso nel Set Completo)",
    isPurchasable: false,
    ctaLabel: "Incluso nel Set Completo",
  },
  {
    id: "uniforme-tshirt",
    category: "physical",
    sigil: "arsenale",
    eyebrow: "SARTORIA TECNICA D'ORDINE · OVERSIZE 240 GSM",
    title: "L'Uniforme — Technical Zero-Noise T-Shirt",
    subtitle: "Maglia tecnica pesante in cotone biologico nero ossidiana.",
    description:
      "T-shirt tecnica pesante con colletto spesso a costine e taglio oversize. Pensata per il comfort durante le ore di mercato, con micro-ricamo del Sigillo sul colletto posteriore.",
    priceCents: 4500, // 45.00 EUR
    currency: "eur",
    requiredGrade: 2,
    requiredLabel: "Riservato al Grado II+ (Il Custode della Regola)",
    specs: [
      "100% Cotone biologico pesante 240 gsm pre-lavato anti-restringimento",
      "Colletto a costine 1x1 ad alta resistenza privo di etichette graffianti",
      "Micro-ricamo tonale del Sigillo d'Ordine sul retrocollo",
      "Taglio oversize moderno con spalle leggermente scese",
    ],
    fulfillmentProvider: "printful",
    variants: [
      { id: "size-s", label: "Taglia S (Oversize)" },
      { id: "size-m", label: "Taglia M (Oversize)" },
      { id: "size-l", label: "Taglia L (Oversize)" },
      { id: "size-xl", label: "Taglia XL (Oversize)" },
      { id: "size-xxl", label: "Taglia XXL (Oversize)" },
    ],
    estimatedDelivery: "5-8 giorni lavorativi (Produzione & Consegna Tracciata)",
    isPurchasable: true,
    ctaLabel: "Configura Taglia & Ordina",
  },
  {
    id: "tempio-fisico",
    category: "protocol",
    sigil: "grade-2",
    eyebrow: "PROTOCOLLO BIOLOGICO · ACCESSO DIRETTO GRADO II",
    title: "Il Tempio Fisico (Architettura Biologica)",
    subtitle: "Protocollo circadiano, neuro-fisiologico e nutrizionale dell'Operatore.",
    description:
      "Nessuna lucidità decisionale sul Punto di Svolta è sostenibile in un corpo infiammato o in debito di sonno. Il protocollo biologico definisce i rituali di gestione del cortisolo prima della sessione.",
    priceCents: 0,
    currency: "eur",
    requiredGrade: 2,
    requiredLabel: "Riservato al Grado II — Il Custode della Regola",
    specs: [
      "Protocollo di esposizione solare e sincronizzazione circadiana pre-mercato",
      "Gestione della curva del cortisolo e finestra di assunzione caffeina/nootropi",
      "Protocollo nutrizionale ad alta densità cognitiva (Zero picchi glicemici in sessione)",
      "Esercizi di respirazione diaframmatica e visualizzazione tattica",
    ],
    fulfillmentProvider: "digital",
    estimatedDelivery: "Accesso Immediato in-app",
    isPurchasable: false,
    ctaLabel: "Consulta Protocollo del Tempio Fisico",
  },
  {
    id: "divisione-b2b",
    category: "corporate",
    sigil: "grade-4",
    eyebrow: "RETE IMPRENDITORIALE & STRAIGHT LINE · GRADO IV",
    title: "Divisione B2B & Rete Imprenditoriale",
    subtitle: "Infrastruttura per segnalazione, negoziazione e chiusura contratti corporate.",
    description:
      "Per gli Operatori che hanno superato il Grado III e raggiunto la sovranità operativa: accesso alla rete chiusa degli Architetti del Reale e al modulo di negoziazione Straight Line per contratti aziendali ad alto margine.",
    priceCents: 0,
    currency: "eur",
    requiredGrade: 3,
    requiredLabel: "Sbloccata al Grado III e IV — L'Architetto del Reale",
    specs: [
      "Dottrina di Negoziazione Straight Line applicata alle corporate enterprise",
      "Portale di candidatura contratti e revenue sharing verificato",
      "Tavola rotonda mensile chiusa della Cerchia Imprenditoriale",
    ],
    fulfillmentProvider: "dropship_manual",
    estimatedDelivery: "Dossier Riservato & Colloquio con il Garante",
    isPurchasable: false,
    ctaLabel: "Richiedi Dossier Divisione B2B",
  },
] as const;

export interface ArsenalOrderRecord {
  id: string;
  userId: string;
  productId: string;
  productTitle: string;
  variant: string | null;
  amountCents: number;
  currency: string;
  fulfillmentStatus: "paid" | "processing" | "in_production" | "shipped" | "delivered" | "cancelled";
  fulfillmentProvider: ArsenalFulfillmentProvider;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
  shippingCity: string | null;
  shippingCountry: string | null;
  createdAt: string;
  updatedAt: string;
}
