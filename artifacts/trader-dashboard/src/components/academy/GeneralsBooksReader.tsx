import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Sliders,
  X,
  Clock,
  Compass,
  Crosshair,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── TYPES ───────────────────────────────────────────────────────────────────

export interface BookPage {
  id: string;
  pageNumber: number;
  imageUrl?: string;
  figureLabel: string;
  figureCaption: string;
  figureIllustrationType:
    | "timeframe_pyramid"
    | "market_clock"
    | "ny_cutoffs"
    | "news_shield"
    | "four_questions"
    | "compression_sweep"
    | "zone_router"
    | "reaccumulation_jtc"
    | "virgin_area_10pct"
    | "four_triggers"
    | "zone_decay_cancellation"
    | "flip_and_glossary";
  title: string;
  subtitle: string;
  dropCap: string;
  storytellingText: string;
  bulletPoints: {
    title: string;
    description: string;
    tag?: string;
  }[];
  finalAxiom: string;
}

export interface GeneralsBook {
  id: 1 | 2 | 3;
  roman: "LIBRO I" | "LIBRO II" | "LIBRO III";
  title: string;
  subtitle: string;
  latinMotto: string;
  coverImage?: string;
  pages: BookPage[];
}

// ─── MASTER CONTENT: I TRE LIBRI DEI GENERALI ─────────────────────────────────

export const GENERALS_BOOKS: GeneralsBook[] = [
  // ─── LIBRO I: IL GOVERNO DEL TEMPO & LA CARTOGRAFIA ────────────────────────
  {
    id: 1,
    roman: "LIBRO I",
    title: "Il Governo del Tempo & La Cartografia",
    subtitle: "Gerarchia dei Timeframe, Finestre Operative Italiane e Protezione da Impatto",
    latinMotto: "Tempus Regit Pretium · L'Allineamento degli Orologi",
    pages: [
      {
        id: "b1-p1",
        pageNumber: 1,
        imageUrl: "/images/books/book1-p1-pyramid.jpg",
        figureLabel: "Fig 1.1",
        figureCaption: "La Gerarchia dell'Esecuzione: Mappatura HTF, Validazione ITF e Trigger LTF.",
        figureIllustrationType: "timeframe_pyramid",
        title: "GERARCHIA DEI TIMEFRAME",
        subtitle: "L'allineamento dei cicli e il divieto dell'azione isolata.",
        dropCap: "N",
        storytellingText:
          "el mercato istituzionale il tempo non scorre in modo lineare ma si muove a onde frattali concentriche. Nessun condottiero scende a duellare sui grafici al minuto senza aver prima interrogato le grandi alture del ciclo Daily e dell'ora: l'azione su timeframe ridotti non è mai autonoma, ma discende dall'ordine stabilito dai gradi superiori.",
        bulletPoints: [
          {
            title: "SCALPING (Il Duello Rapido)",
            description:
              "H1 definisce la zona e i pool di liquidità principali; M15 certifica la schematica interna e la chiusura del ciclo; M1 ospita il trigger millimetrico (Test, POC, JTC o BTI).",
            tag: "H1 → M15 → M1",
          },
          {
            title: "SWING / INTRADAY (L'Assedio Sovrano)",
            description:
              "Ciclo Daily unito alla mappatura della liquidità e della zona H4; H1 / M15 confermano la schematica d'inversione o continuazione; M5 / M1 eseguono alla conferma formale del ciclo.",
            tag: "Daily/H4 → H1/M15 → M5/M1",
          },
          {
            title: "Vincolo Frattale Inviolabile",
            description:
              "È categoricamente vietato cercare setup su M1 o M5 senza che la struttura H1 o Daily abbia convalidato la direzione e la zona di riferimento.",
            tag: "REQUISITO RIGIDO",
          },
        ],
        finalAxiom:
          "«Chi viola la gerarchia dei timeframe scambia il rumore effimero per segnale e diventa carburante per gli algoritmi del sistema.»",
      },
      {
        id: "b1-p2",
        pageNumber: 2,
        imageUrl: "/images/books/book1-p2-clock.jpg",
        figureLabel: "Fig 1.2",
        figureCaption: "Il Quadrante delle Sessioni: Asia, Londra e il Riposo del Mezzodì.",
        figureIllustrationType: "market_clock",
        title: "FINESTRE OPERATIVE ITALIANE (I)",
        subtitle: "Dalla quiete asiatica all'assalto della City di Londra.",
        dropCap: "L",
        storytellingText:
          "e banche centrali e i grandi algoritmi interbancari aprono i propri registri a ore determinate. L'Operatore AUREUS non monitora il grafico a caso: compare sulla soglia solo quando la liquidità si desta e si ritira non appena l'efficienza algoritmica declina nella pausa del mezzodì.",
        bulletPoints: [
          {
            title: "Asia · 00:00–08:00 CET",
            description:
              "Mappatura obbligatoria di Asian High e Asian Low. Ingressi consentiti esclusivamente tra le 01:00 e le 03:30 CET con massime conferme. Divieto assoluto di operare in compressione.",
            tag: "00:00–08:00 CET",
          },
          {
            title: "London · 08:00–11:30 CET",
            description:
              "La finestra europea primaria: sweep obbligatorio della liquidità asiatica, test di una zona H1/H4 valida e schematica conclamata a grafico.",
            tag: "08:00–11:30 CET",
          },
          {
            title: "Lunch · 11:30–13:30 CET",
            description:
              "Pausa di liquidità: evita nuovi ingressi se l'impulso non è già partito. È richiesta la conferma esplicita di questo requisito prima di toccare la piattaforma.",
            tag: "11:30–13:30 CET",
          },
          {
            title: "Intervallo · 13:30–14:00 CET",
            description:
              "Non è una finestra operativa definita: tempo riservato unicamente all'analisi preventiva dello scenario e alla gestione delle posizioni già aperte.",
            tag: "13:30–14:00 CET",
          },
        ],
        finalAxiom:
          "«Operare fuori dalle finestre è debolezza interiore; attendere il suono dell'ora canonica è virtù dell'Ordine.»",
      },
      {
        id: "b1-p3",
        pageNumber: 3,
        figureLabel: "Fig 1.3",
        figureCaption: "L'Espansione di New York e le Barriere Orarie delle 18:00 e 22:00 CET.",
        figureIllustrationType: "ny_cutoffs",
        title: "FINESTRE OPERATIVE ITALIANE (II)",
        subtitle: "L'impatto di Wall Street e i confini serali invalicabili.",
        dropCap: "N",
        storytellingText:
          "el pomeriggio l'energia dei mercati americani entra in collisione con i livelli tracciati dall'Europa. Il protocollo impone due barriere serali invalicabili per impedire che l'affaticamento o la bramosia disperdano il valore conquistato durante la giornata.",
        bulletPoints: [
          {
            title: "New York · 14:00–18:30 CET",
            description:
              "Sweep dei livelli di Londra, reazione immediata del prezzo, continuazioni o inversioni valide. Scalping consentito fino alle 18:00; Swing operativo fino alle 22:00.",
            tag: "14:00–18:30 CET",
          },
          {
            title: "Chiusura Scalp · Dalle ore 18:00 CET",
            description:
              "Nessun nuovo ingresso scalping consentito. La gestione attiva delle posizioni già a mercato resta accessibile fino al target o al breakeven.",
            tag: "STOP SCALP 18:00",
          },
          {
            title: "Swing / Sera · 18:30–22:00 CET",
            description:
              "Nuovi ingressi Swing consentiti con tutti i filtri del protocollo verificati. Lo Scalping resta categoricamente bloccato.",
            tag: "18:30–22:00 CET",
          },
          {
            title: "Chiusura Swing · Dalle ore 22:00 CET",
            description:
              "Nessun nuovo ingresso Swing. Schermi spenti; gestione delle posizioni multiday sempre accessibile.",
            tag: "STOP TOTALE 22:00",
          },
        ],
        finalAxiom:
          "«Chi non sa spegnere il terminale alle 18:00 riconsegna al mercato entro sera i frutti conquistati al pomeriggio.»",
      },
      {
        id: "b1-p4",
        pageNumber: 4,
        figureLabel: "Fig 1.4",
        figureCaption: "La Barriera Macro: Lo Stop Preventivo a 10 Minuti e i 45 Minuti Post-News.",
        figureIllustrationType: "news_shield",
        title: "RED FOLDER NEWS: LA DIFESA DA IMPATTO",
        subtitle: "La salvaguardia del capitale durante il rilascio dei dati macroeconomici.",
        dropCap: "D",
        storytellingText:
          "urante il rilascio di notizie ad alto impatto il mercato non appartiene agli operatori umani ma alla furia dei bot ad alta frequenza che allargano gli spread e violano qualunque stop loss. Il protocollo erige una barriera d'acciaio 10 minuti prima e 45 minuti dopo l'evento.",
        bulletPoints: [
          {
            title: "Calendario e Fuso Europe/Rome",
            description:
              "Calendario della giornata sincronizzato da Forex Factory / Fair Economy, in orario Europe/Rome, con fonte ufficiale e data dell'ultimo controllo sempre visibili.",
            tag: "FONTE UFFICIALE",
          },
          {
            title: "Blocco Preventivo (Default 10 Minuti)",
            description:
              "Prima dei rilasci ad alto impatto (Red Folder): stop totale a ordini pendenti e nuovi ingressi con anticipo configurabile di almeno 10 minuti.",
            tag: "-10 MINUTI",
          },
          {
            title: "Verifica Post-Rilascio & Termine 45 Minuti",
            description:
              "Dopo l'orario previsto, verifica manualmente spike, nuovo sweep e nuova schematica. Il richiamo post-news termina automaticamente 45 minuti dopo l'evento.",
            tag: "+45 MINUTI",
          },
          {
            title: "Regola della Fonte Non Verificabile",
            description:
              "Se la fonte macro non è verificabile, i nuovi ingressi sono bloccati. Il controllo manuale non può scavalcare un blocco automatico del calendario.",
            tag: "BLOCCO DI FERRO",
          },
        ],
        finalAxiom:
          "«Non si sfida la tempesta a viso aperto: ci si ritira dietro le mura finché il vento degli algoritmi non si è placato.»",
      },
    ],
  },

  // ─── LIBRO II: LE LEGGI DELLA LIQUIDITÀ & I PUNTI DI SVOLTA ────────────────
  {
    id: 2,
    roman: "LIBRO II",
    title: "Le Leggi della Liquidità & I Punti di Svolta",
    subtitle: "Le Quattro Domande Sovrane, Direzionalità, Compressione e Router di Zona",
    latinMotto: "Fluctus et Seducens · L'Individuazione dell'Inganno",
    pages: [
      {
        id: "b2-p1",
        pageNumber: 1,
        figureLabel: "Fig 2.1",
        figureCaption: "La Bussola dell'Operatore: Le Quattro Domande prima di toccare la soglia.",
        figureIllustrationType: "four_questions",
        title: "LE QUATTRO DOMANDE SOVRANE",
        subtitle: "L'interrogatorio obbligatorio prima di formulare qualunque tesi operativa.",
        dropCap: "P",
        storytellingText:
          "rima che la mano dell'Operatore tocchi il mouse o imposti una linea d'ordine, la mente deve sottoporre il mercato a quattro interrogativi spietati. Se a una sola di queste domande non corrisponde una risposta oggettiva, chiara e verificabile, l'operazione non esiste.",
        bulletPoints: [
          {
            title: "1. Dove ci troviamo?",
            description:
              "Identificazione del Ciclo HTF dominante e certificazione della totale assenza di compressione sul timeframe maggiore.",
            tag: "CONTESTO HTF",
          },
          {
            title: "2. Cosa ha preso a sinistra?",
            description:
              "Rilevazione della struttura: il prezzo ha toccato e mitigato una Zona HTF valida, oppure ha raccolto sola liquidità?",
            tag: "ZONA VS LIQUIDITÀ",
          },
          {
            title: "3. Come ci è arrivato?",
            description:
              "Certificazione del completamento del ciclo ITF, convalida della schematica d'inversione LTF e coerenza del trigger.",
            tag: "CICLO & SCHEMATICA",
          },
          {
            title: "4. Cosa deve prendere?",
            description:
              "Localizzazione geometrica del pool opposto di liquidità istituzionale e calcolo dello sbilanciamento del 10% quando richiesto.",
            tag: "TARGET & 10%",
          },
        ],
        finalAxiom:
          "«La fretta genera perdite ed autoinganno; l'interrogatorio metodico conduce alla sovranità decisionale.»",
      },
      {
        id: "b2-p2",
        pageNumber: 2,
        figureLabel: "Fig 2.2",
        figureCaption: "La Compressione (No Trade) vs Lo Sweep Istituzionale di Liquidità.",
        figureIllustrationType: "compression_sweep",
        title: "DIREZIONALITÀ E LIQUIDITÀ",
        subtitle: "Riconoscere l'inganno della compressione e pretendere la presa confermata.",
        dropCap: "L",
        storytellingText:
          "a massa retail vive nell'illusione di poter indovinare la direzione all'interno del rumore. Il condottiero AUREUS sa che il mercato è immobile finché non estrae ordini: l'azione scatta unicamente quando la liquidità esterna viene catturata a candela chiusa.",
        bulletPoints: [
          {
            title: "Liquidità Sopra e Sotto = NO TRADE",
            description:
              "Quando sono presenti pool evidenti sia sui massimi sia sui minimi, il mercato si trova in compressione. È severamente vietato anticipare il breakout del range.",
            tag: "NO TRADE",
          },
          {
            title: "Sweep Confermato Obbligatorio",
            description:
              "Attiva un setup soltanto dopo una presa di liquidità confermata sul grafico. Nessun ordine prima che la manipolazione si sia consumata.",
            tag: "SWEEP REALE",
          },
          {
            title: "Posizionamento nel Ciclo Grande",
            description:
              "Identifica sempre la collocazione nel ciclo grande prima di scendere sui timeframe inferiori. Mai invertire un flusso HTF privo di esaurimento.",
            tag: "BIAS MACRO",
          },
        ],
        finalAxiom:
          "«Non anticipare il breakout dell'illusione: attendi che il falso assalto si infranga e raccogli il frutto dello sweep.»",
      },
      {
        id: "b2-p3",
        pageNumber: 3,
        figureLabel: "Fig 2.3",
        figureCaption: "Il Router di Zona: La Matrice dei Bivi Operativi (Inversione vs Continuazione).",
        figureIllustrationType: "zone_router",
        title: "IL ROUTER DI ZONA",
        subtitle: "La classificazione meccanica dello scenario in base alla struttura a sinistra.",
        dropCap: "I",
        storytellingText:
          "l grafico non tollera interpretazioni soggettive o speranze emotive. Il Router di Zona agisce come un deviatoio binario inviolabile: esamina ciò che il prezzo ha toccato a sinistra e stabilisce quali percorsi operativi sono autorizzati e quali sono proibiti.",
        bulletPoints: [
          {
            title: "Solo Liquidità, Senza Zona HTF",
            description:
              "Inversioni severamente VIETATE. Autorizzati esclusivamente setup di continuazione del trend dominante: BTI (Breakout Trap) o JTC (Join The Continuation).",
            tag: "SOLO CONTINUAZIONE",
          },
          {
            title: "Zona HTF Valida Toccata e Mitigata",
            description:
              "Autorizzata la ricerca d'inversione, ma unicamente dopo aver validato una schematica ITF completa sul timeframe intermedio.",
            tag: "INVERSIONE AUTORIZZATA",
          },
          {
            title: "Re-accumuli / Ri-distribuzioni Intermedi",
            description:
              "Adatta la continuazione al box corrente: ingresso JTC senza pretendere né aspettare lo sweep dell'estremo mancato.",
            tag: "BOX JTC",
          },
        ],
        finalAxiom:
          "«Chi cerca un'inversione senza una zona HTF mitigata a sinistra getta il proprio capitale contro una muraglia di lance.»",
      },
      {
        id: "b2-p4",
        pageNumber: 4,
        figureLabel: "Fig 2.4",
        figureCaption: "Il Percorso JTC nei Re-accumuli Intermedi di Fase 2.",
        figureIllustrationType: "reaccumulation_jtc",
        title: "RE-ACCUMULI IN FASE 2 & PROTOCOLLO JTC",
        subtitle: "Gestire la continuazione quando l'estremo macro non viene raggiunto.",
        dropCap: "Q",
        storytellingText:
          "uando l'impulso istituzionale è violento e asimmetrico, il prezzo non compie ritracciamenti profondi fino agli estremi di ciclo, ma costruisce stazioni intermedie di ricarica ordini. Il protocollo codifica questo scenario per non restare a guardare.",
        bulletPoints: [
          {
            title: "Zona Estrema Non Raggiunta",
            description:
              "Se la zona estrema non è stata toccata ma si osservano re-accumuli o ri-distribuzioni intermedie in corso, il contesto HTF autorizza il percorso Re-accumuli in Fase 2.",
            tag: "FASE 2 HTF",
          },
          {
            title: "Esclusività JTC (Join The Continuation)",
            description:
              "Questo percorso consente ESCLUSIVAMENTE ingressi JTC in continuazione. Qualsiasi tentativo di anticipare inversioni rimane severamente vietato.",
            tag: "SOLO JTC",
          },
          {
            title: "Zero Sweep dell'Estremo Mancato",
            description:
              "Non è richiesto lo sweep dell'estremo mancato: l'Operatore cavalca l'efficienza del box intermedio rispettandone la struttura.",
            tag: "NESSUNA ATTESA FANTASMA",
          },
        ],
        finalAxiom:
          "«Quando l'esercito istituzionale avanza con impeto, non attendere il suo ritorno: unisciti alla marcia con il sigillo JTC.»",
      },
    ],
  },

  // ─── LIBRO III: IL SIGILLO D'AZIONE & L'INVALIDAZIONE ──────────────────────
  {
    id: 3,
    roman: "LIBRO III",
    title: "Il Sigillo d'Azione & L'Invalidazione",
    subtitle: "Ciclo e Ingresso, I Quattro Trigger, Reattività, News e Glossario del Metodo",
    latinMotto: "Ictus Unicus et Invalidatio · La Balistica dell'Ingresso",
    pages: [
      {
        id: "b3-p1",
        pageNumber: 1,
        figureLabel: "Fig 3.1",
        figureCaption: "La Rilevazione dell'Area Vergine e la Spinta Minima del 10%.",
        figureIllustrationType: "virgin_area_10pct",
        title: "CICLO, AREA VERGINE E SOGLIA 10%",
        subtitle: "I requisiti matematici per l'armamento del trigger operativo.",
        dropCap: "I",
        storytellingText:
          "l territorio vergine è uno spazio di quotazione privo di riferimenti storici recenti a sinistra. In questo spazio sconosciuto, il protocollo vieta qualsiasi ingresso impulsivo ed esige una prova di forza quantificata prima di autorizzare il rischio.",
        bulletPoints: [
          {
            title: "Convalida Ciclo ITF e Matrice LTF",
            description:
              "Completa il ciclo ITF e valida la schematica d'ingresso sul LTF previsto dalla matrice operativa.",
            tag: "CICLO & MATRICE",
          },
          {
            title: "Area Vergine: Spinta Minima 10%",
            description:
              "Se M15 chiude in area vergine e M1 accumula o distribuisce, attendi tassativamente uno sbilanciamento di spinta almeno del 10% prima di inserire l'ordine.",
            tag: "FILTRO 10%",
          },
          {
            title: "Identificazione del Pool Opposto",
            description:
              "Identifica con precisione millimetrica il pool di liquidità opposto prima dell'esecuzione: l'ordine deve conoscere il proprio porto d'approdo.",
            tag: "TARGET OPPOSTO",
          },
          {
            title: "Scadenza delle Conferme",
            description:
              "Le conferme scadono al cambio di giornata italiana. Cambiare timeframe intermedio richiede una nuova schematica; cambiare HTF azzera del tutto il contesto.",
            tag: "AZZERAMENTO GIORNALIERO",
          },
        ],
        finalAxiom:
          "«Nell'area vergine non si avanza sull'intuito: si pretende il 10% di spinta oggettiva prima di scagliare l'affondo.»",
      },
      {
        id: "b3-p2",
        pageNumber: 2,
        figureLabel: "Fig 3.2",
        figureCaption: "I Quattro Trigger d'Ingresso: Test, POC, JTC, BTI sul Grafico al Minuto.",
        figureIllustrationType: "four_triggers",
        title: "I QUATTRO TRIGGER D'AZIONE",
        subtitle: "La balistica dell'ingresso: Test, POC, JTC e BTI.",
        dropCap: "Q",
        storytellingText:
          "uando la ricognizione è completa e il Router ha convalidato la via, l'azione si condensa in quattro soli modelli balistici di trigger. Ciascuno risponde a una specifica meccanica di erogazione degli ordini algoritmici.",
        bulletPoints: [
          {
            title: "Trigger TEST",
            description:
              "Ingresso sulla mitigazione millimetrica dell'estremo o del Fair Value Gap generato dallo shift strutturale della schematica LTF.",
            tag: "TEST MITIGAZIONE",
          },
          {
            title: "Trigger POC (Point of Control)",
            description:
              "Ingresso sul baricentro volumetrico dell'accumulazione o distribuzione conclamata al minuto.",
            tag: "BARICENTRO POC",
          },
          {
            title: "Trigger JTC (Join The Continuation)",
            description:
              "Ingresso in corsa sul re-test della rottura strutturale nel verso della spinta del trend dominante.",
            tag: "CONTINUAZIONE JTC",
          },
          {
            title: "Trigger BTI (Breakout Trap Invalidation)",
            description:
              "Ingresso istantaneo sulla trappola che punisce i breakout trader retail subito dopo la presa di liquidità.",
            tag: "TRAPPOLA BTI",
          },
        ],
        finalAxiom:
          "«Un solo colpo sul trigger autorizzato dal Router: ogni ingresso improvvisato fuori dai 4 modelli è indisciplina.»",
      },
      {
        id: "b3-p3",
        pageNumber: 3,
        figureLabel: "Fig 3.3",
        figureCaption: "Il Decadimento Temporale della Zona e la Cancellazione Rigorosa dei Pendenti.",
        figureIllustrationType: "zone_decay_cancellation",
        title: "REATTIVITÀ E GESTIONE DEL RISCHIO",
        subtitle: "La velocità del mercato e l'eliminazione preventiva dei pendenti.",
        dropCap: "U",
        storytellingText:
          "na zona di reazione istituzionale non concede esitazioni. Se il prezzo indugia nei pressi del livello senza esplodere, la liquidità si consuma e la probabilità matematica si capovolge contro l'operatore.",
        bulletPoints: [
          {
            title: "Reazione Immediata Post-M1",
            description:
              "Dopo la schematica M1, il prezzo deve manifestare una reazione subito aggressiva; il tempo di congestione prolungata indebolisce inesorabilmente la zona.",
            tag: "VELOCITÀ DISPLACEMENT",
          },
          {
            title: "Congestione a Ridosso della Zona",
            description:
              "In caso di congestione a ridosso della zona: cancella immediatamente l'ordine pendente oppure riduci/chiudi il rischio. Conferma manualmente l'azione nel cockpit.",
            tag: "CANCELLA PENDENTE",
          },
          {
            title: "Distinzione Pendente ed Eseguito",
            description:
              "Ordine pendente ed eseguito sono entità distinte. Prima delle notizie macro, rivaluta e cancella il pendente sul broker; registra manualmente l'annullamento.",
            tag: "REGOLA PRE-NEWS",
          },
        ],
        finalAxiom:
          "«Il tempo logora la forza della zona: chi indugia sul livello perde il vantaggio matematico e deve ritirare l'ordine.»",
      },
      {
        id: "b3-p4",
        pageNumber: 4,
        figureLabel: "Fig 3.4",
        figureCaption: "Il Flip del Bias Operativo e il Glossario Ufficiale dei Termini del Metodo.",
        figureIllustrationType: "flip_and_glossary",
        title: "INVALIDAZIONE, FLIP E GLOSSARIO",
        subtitle: "La gestione della smentita e il dizionario canonico del Protocollo AUREUS.",
        dropCap: "L",
        storytellingText:
          "'Iniziato non si ostina mai contro l'evidenza del mercato. Quando una schematica viene violata, il bias viene capovolto all'istante senza rimpianti e il vocabolario del Codice torna a guidare l'azione.",
        bulletPoints: [
          {
            title: "Schematica d'Inversione Violata",
            description:
              "Cambia subito bias verso la continuazione e cerca una nuova schematica. Nessun nuovo ingresso senza tutte le conferme formali.",
            tag: "CAMBIO BIAS",
          },
          {
            title: "La Regola del Flip",
            description:
              "Dopo un Flip, privilegia la continuazione. La Fase 2 resta compilabile: un nuovo sweep su zona HTF valida, con nuova schematica ITF/LTF, può autorizzare un nuovo scenario d'inversione sullo stesso mercato nella giornata.",
            tag: "FASE 2 FLIP",
          },
          {
            title: "Glossario Canonico",
            description:
              "HTF/ITF/LTF: Mappa/Validazione/Trigger. · Sweep: Presa liquidità su massimi/minimi. · Compressione: Liquidità sopra e sotto (NO TRADE). · Area vergine: Senza riferimenti a sinistra. · Test/POC/JTC/BTI: I 4 trigger del metodo. · Sbilanciamento 10%: Filtro di spinta minima del 10%.",
            tag: "GLOSSARIO UFFICIALE",
          },
        ],
        finalAxiom:
          "«L'invalidazione non è una sconfitta, ma un oracolo matematico che ti salva dal vuoto e svela la direzione autentica.»",
      },
    ],
  },
];

// ─── THEMED ILLUSTRATION COMPONENT (IMMAGINE SCHEMATICA A SINISTRA) ────────────

function PageThemedIllustration({
  type,
  imageUrl,
  figureLabel,
  figureCaption,
}: {
  type: BookPage["figureIllustrationType"];
  imageUrl?: string;
  figureLabel: string;
  figureCaption: string;
}) {
  return (
    <div className="flex flex-col h-full w-full justify-center items-center min-h-0 py-2">
      <div className="relative aspect-square w-full max-w-[260px] sm:max-w-[300px] xl:max-w-[340px] max-h-[340px] rounded-lg border border-[#C5A059]/40 bg-gradient-to-b from-[#14151C] via-[#0E0F14] to-[#0A0A0C] p-2 sm:p-2.5 flex items-center justify-center overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] shrink-0 group">
        {imageUrl ? (
          <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded">
            <img
              src={imageUrl}
              alt={figureCaption}
              className="w-full h-full object-cover rounded filter contrast-[1.05] brightness-[1.02] transition-transform duration-500 group-hover:scale-105"
              loading="eager"
            />
            <div className="absolute inset-0 pointer-events-none rounded border border-[#C5A059]/30 shadow-[inset_0_0_20px_rgba(0,0,0,0.6)]" />
          </div>
        ) : (
          <>
            {/* Background Roman Grid Texture */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#C5A059_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Dynamic Vector Engravings by Illustration Type */}
        {type === "timeframe_pyramid" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px] text-[#C5A059]">
            {/* Pyramid Steps */}
            <polygon points="100,20 180,180 20,180" fill="none" stroke="#C5A059" strokeWidth="1.5" opacity="0.4" />
            {/* Horizontal divisions */}
            <line x1="75" y1="70" x2="125" y2="70" stroke="#C5A059" strokeWidth="1.5" />
            <line x1="50" y1="125" x2="150" y2="125" stroke="#C5A059" strokeWidth="1.5" />
            {/* Labels */}
            <text x="100" y="55" fill="#D4AF37" fontSize="10" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="bold">HTF (DAILY / H1)</text>
            <text x="100" y="105" fill="#C5A059" fontSize="9" textAnchor="middle" fontFamily="Space Grotesk, monospace">ITF (M15)</text>
            <text x="100" y="155" fill="#F4F4F6" fontSize="8.5" textAnchor="middle" fontFamily="Space Grotesk, monospace">LTF (M1 / M5 TRIGGER)</text>
            <circle cx="100" cy="20" r="3" fill="#D4AF37" />
          </svg>
        )}

        {type === "market_clock" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px]">
            <circle cx="100" cy="100" r="80" fill="none" stroke="#C5A059" strokeWidth="1" opacity="0.3" />
            <circle cx="100" cy="100" r="65" fill="none" stroke="#C5A059" strokeWidth="0.8" opacity="0.2" />
            {/* Sectors */}
            <path d="M 100,100 L 100,20 A 80,80 0 0,1 156,44 Z" fill="rgba(197,160,89,0.15)" stroke="#C5A059" strokeWidth="1" />
            <text x="100" y="15" fill="#C5A059" fontSize="8" textAnchor="middle" fontFamily="monospace">00:00 (ASIA)</text>
            <text x="175" y="70" fill="#D4AF37" fontSize="8" textAnchor="start" fontFamily="monospace">08:00 (LONDRA)</text>
            <text x="100" y="195" fill="#8E8E99" fontSize="8" textAnchor="middle" fontFamily="monospace">11:30 (LUNCH)</text>
            <circle cx="100" cy="100" r="4" fill="#C5A059" />
            <line x1="100" y1="100" x2="135" y2="45" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round" />
          </svg>
        )}

        {type === "ny_cutoffs" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px]">
            <rect x="25" y="40" width="150" height="120" rx="4" fill="none" stroke="#C5A059" strokeWidth="1" opacity="0.3" />
            <line x1="25" y1="75" x2="175" y2="75" stroke="#C5A059" strokeWidth="1" strokeDasharray="3 3" />
            <line x1="25" y1="115" x2="175" y2="115" stroke="#ef4444" strokeWidth="1.5" />
            <text x="35" y="60" fill="#D4AF37" fontSize="9" fontFamily="Cinzel, serif">14:00 NEW YORK OPEN</text>
            <text x="35" y="100" fill="#10B981" fontSize="9" fontFamily="Space Grotesk, monospace">18:00 STOP SCALPING</text>
            <text x="35" y="140" fill="#ef4444" fontSize="9" fontFamily="Space Grotesk, monospace">22:00 CHIUSURA SWING</text>
          </svg>
        )}

        {type === "news_shield" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px]">
            <path d="M 100,25 L 160,55 L 160,115 C 160,155 100,185 100,185 C 100,185 40,155 40,115 L 40,55 Z" fill="rgba(239,68,68,0.12)" stroke="#C5A059" strokeWidth="1.5" />
            <text x="100" y="90" fill="#ef4444" fontSize="16" textAnchor="middle" fontWeight="bold" fontFamily="monospace">RED FOLDER</text>
            <text x="100" y="115" fill="#D4AF37" fontSize="9" textAnchor="middle" fontFamily="Space Grotesk, monospace">-10m STOP PENDENTI</text>
            <text x="100" y="135" fill="#F4F4F6" fontSize="8" textAnchor="middle" fontFamily="Space Grotesk, monospace">+45m VERIFICA</text>
          </svg>
        )}

        {type === "four_questions" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px]">
            <circle cx="100" cy="100" r="70" fill="none" stroke="#C5A059" strokeWidth="1" opacity="0.4" />
            <line x1="100" y1="15" x2="100" y2="185" stroke="#C5A059" strokeWidth="1" strokeDasharray="2 2" />
            <line x1="15" y1="100" x2="185" y2="100" stroke="#C5A059" strokeWidth="1" strokeDasharray="2 2" />
            <text x="100" y="45" fill="#D4AF37" fontSize="9" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="bold">I. DOVE?</text>
            <text x="155" y="105" fill="#D4AF37" fontSize="9" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="bold">II. COSA?</text>
            <text x="100" y="165" fill="#D4AF37" fontSize="9" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="bold">III. COME?</text>
            <text x="45" y="105" fill="#D4AF37" fontSize="9" textAnchor="middle" fontFamily="Cinzel, serif" fontWeight="bold">IV. QUANTO?</text>
            <circle cx="100" cy="100" r="14" fill="#14151C" stroke="#C5A059" strokeWidth="1.5" />
            <text x="100" y="104" fill="#C5A059" fontSize="10" textAnchor="middle">IV</text>
          </svg>
        )}

        {type === "compression_sweep" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px]">
            {/* Top Liquidity */}
            <line x1="20" y1="50" x2="180" y2="50" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" />
            <text x="100" y="42" fill="#ef4444" fontSize="8" textAnchor="middle" fontFamily="monospace">LIQUIDITÀ SUPERIORE</text>
            {/* Bottom Liquidity */}
            <line x1="20" y1="150" x2="180" y2="150" stroke="#ef4444" strokeWidth="1" strokeDasharray="4 4" />
            <text x="100" y="165" fill="#ef4444" fontSize="8" textAnchor="middle" fontFamily="monospace">LIQUIDITÀ INFERIORE</text>
            {/* Compression candles */}
            <rect x="50" y="80" width="100" height="40" fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth="1" />
            <text x="100" y="104" fill="#F4F4F6" fontSize="10" textAnchor="middle" fontFamily="Cinzel, serif">NO TRADE (COMPRESSIONE)</text>
            {/* Sweep Wick */}
            <path d="M 120,50 L 120,25 L 122,50" stroke="#D4AF37" strokeWidth="2" />
            <circle cx="120" cy="25" r="3" fill="#10B981" />
            <text x="140" y="30" fill="#10B981" fontSize="8" fontFamily="monospace">SWEEP</text>
          </svg>
        )}

        {type === "zone_router" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px]">
            <rect x="20" y="20" width="160" height="30" rx="3" fill="#181A22" stroke="#C5A059" strokeWidth="1" />
            <text x="100" y="38" fill="#D4AF37" fontSize="9" textAnchor="middle" fontFamily="Cinzel, serif">ROUTER DI ZONA</text>
            {/* Branches */}
            <line x1="100" y1="50" x2="50" y2="90" stroke="#C5A059" strokeWidth="1" />
            <line x1="100" y1="50" x2="150" y2="90" stroke="#C5A059" strokeWidth="1" />
            {/* Left box */}
            <rect x="15" y="90" width="70" height="45" rx="3" fill="#14151C" stroke="#ef4444" strokeWidth="1" />
            <text x="50" y="108" fill="#F4F4F6" fontSize="7.5" textAnchor="middle">SOLO LIQUIDITÀ</text>
            <text x="50" y="123" fill="#10B981" fontSize="8" fontWeight="bold" textAnchor="middle">SOLO JTC / BTI</text>
            {/* Right box */}
            <rect x="115" y="90" width="70" height="45" rx="3" fill="#14151C" stroke="#10B981" strokeWidth="1" />
            <text x="150" y="108" fill="#F4F4F6" fontSize="7.5" textAnchor="middle">ZONA HTF MITIGATA</text>
            <text x="150" y="123" fill="#D4AF37" fontSize="8" fontWeight="bold" textAnchor="middle">INVERSIONE ITF</text>
          </svg>
        )}

        {type === "reaccumulation_jtc" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px]">
            {/* Staged boxes */}
            <rect x="25" y="130" width="40" height="25" fill="rgba(197,160,89,0.15)" stroke="#C5A059" strokeWidth="1" />
            <rect x="80" y="90" width="40" height="25" fill="rgba(197,160,89,0.25)" stroke="#C5A059" strokeWidth="1" />
            <rect x="135" y="50" width="40" height="25" fill="rgba(197,160,89,0.4)" stroke="#10B981" strokeWidth="1.5" />
            {/* JTC arrow */}
            <path d="M 45,130 L 100,90 L 155,50" fill="none" stroke="#D4AF37" strokeWidth="2" strokeDasharray="2 2" />
            <text x="100" y="180" fill="#D4AF37" fontSize="9" textAnchor="middle" fontFamily="Cinzel, serif">PERCORSO FASE 2: SOLO JTC</text>
          </svg>
        )}

        {type === "virgin_area_10pct" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px]">
            {/* Shaded area */}
            <rect x="30" y="30" width="140" height="80" fill="rgba(197,160,89,0.08)" stroke="#C5A059" strokeWidth="1" strokeDasharray="3 3" />
            <text x="100" y="50" fill="#8E8E99" fontSize="8" textAnchor="middle" fontFamily="monospace">AREA VERGINE (NESSUN RIFERIMENTO)</text>
            {/* 10% delta vector */}
            <line x1="60" y1="90" x2="140" y2="60" stroke="#10B981" strokeWidth="2.5" />
            <polygon points="145,58 135,55 137,67" fill="#10B981" />
            <text x="100" y="105" fill="#10B981" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="monospace">SBILANCIAMENTO ≥ 10%</text>
            <text x="100" y="145" fill="#C5A059" fontSize="8" textAnchor="middle">ATTESA IMPULSO PRIMA DI M1</text>
          </svg>
        )}

        {type === "four_triggers" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px]">
            <rect x="20" y="20" width="75" height="70" rx="3" fill="#14151C" stroke="#C5A059" strokeWidth="1" />
            <text x="57" y="45" fill="#D4AF37" fontSize="10" textAnchor="middle" fontWeight="bold">TEST</text>
            <text x="57" y="65" fill="#8E8E99" fontSize="7" textAnchor="middle">Mitigazione Secca</text>

            <rect x="105" y="20" width="75" height="70" rx="3" fill="#14151C" stroke="#C5A059" strokeWidth="1" />
            <text x="142" y="45" fill="#D4AF37" fontSize="10" textAnchor="middle" fontWeight="bold">POC</text>
            <text x="142" y="65" fill="#8E8E99" fontSize="7" textAnchor="middle">Point of Control</text>

            <rect x="20" y="105" width="75" height="70" rx="3" fill="#14151C" stroke="#C5A059" strokeWidth="1" />
            <text x="57" y="130" fill="#D4AF37" fontSize="10" textAnchor="middle" fontWeight="bold">JTC</text>
            <text x="57" y="150" fill="#8E8E99" fontSize="7" textAnchor="middle">Join Continuation</text>

            <rect x="105" y="105" width="75" height="70" rx="3" fill="#14151C" stroke="#C5A059" strokeWidth="1" />
            <text x="142" y="130" fill="#D4AF37" fontSize="10" textAnchor="middle" fontWeight="bold">BTI</text>
            <text x="142" y="150" fill="#8E8E99" fontSize="7" textAnchor="middle">Breakout Trap</text>
          </svg>
        )}

        {type === "zone_decay_cancellation" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px]">
            <line x1="30" y1="160" x2="170" y2="160" stroke="#8E8E99" strokeWidth="1" />
            <line x1="30" y1="160" x2="30" y2="30" stroke="#8E8E99" strokeWidth="1" />
            {/* Decay curve */}
            <path d="M 35,45 Q 60,140 165,155" fill="none" stroke="#ef4444" strokeWidth="2" />
            <text x="100" y="40" fill="#D4AF37" fontSize="9" textAnchor="middle" fontFamily="Cinzel, serif">DECADIMENTO TEMPORALE</text>
            <text x="100" y="90" fill="#ef4444" fontSize="8" textAnchor="middle">CONGESTIONE = ANNULLA PENDENTE</text>
            <circle cx="120" cy="150" r="3" fill="#ef4444" />
          </svg>
        )}

        {type === "flip_and_glossary" && (
          <svg viewBox="0 0 200 200" className="w-full h-full max-w-[220px]">
            <path d="M 40,110 L 80,70 L 120,120 L 160,50" fill="none" stroke="#10B981" strokeWidth="2" />
            <line x1="60" y1="70" x2="140" y2="70" stroke="#ef4444" strokeWidth="1" strokeDasharray="3 3" />
            <text x="100" y="62" fill="#ef4444" fontSize="8" textAnchor="middle">MSS / FLIP</text>
            <rect x="25" y="135" width="150" height="35" rx="3" fill="#181A22" stroke="#C5A059" strokeWidth="0.8" />
            <text x="100" y="157" fill="#D4AF37" fontSize="8.5" textAnchor="middle" fontFamily="monospace">GLOSSARIO CANONICO AUREUS</text>
          </svg>
        )}
          </>
        )}
      </div>

      {/* Elegant Caption Under the Illustration */}
      <p className="mt-2 text-center font-mono text-[10.5px] xl:text-[11px] text-[#C5A059]/80 italic shrink-0 px-2 max-w-[340px] leading-tight">
        <strong>{figureLabel}</strong> — {figureCaption}
      </p>
    </div>
  );
}

// ─── MAIN READER COMPONENT: I LIBRI DEI GENERALI ──────────────────────────────

export function GeneralsBooksReader({
  className = "",
}: {
  className?: string;
}) {
  const [selectedBookId, setSelectedBookId] = useState<1 | 2 | 3 | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(0);
  const [tocOpen, setTocOpen] = useState<boolean>(false);

  // Active book object
  const activeBook = selectedBookId
    ? GENERALS_BOOKS.find((b) => b.id === selectedBookId) ?? null
    : null;

  // Active page object
  const activePage = activeBook ? activeBook.pages[currentPageIndex] : null;

  // Navigation handlers
  const handleNextPage = useCallback(() => {
    if (!activeBook) return;
    if (currentPageIndex < activeBook.pages.length - 1) {
      setCurrentPageIndex((prev) => prev + 1);
    }
  }, [activeBook, currentPageIndex]);

  const handlePrevPage = useCallback(() => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex((prev) => prev - 1);
    }
  }, [currentPageIndex]);

  // Keyboard shortcut navigation (ArrowLeft and ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedBookId) return;
      if (e.key === "ArrowRight") handleNextPage();
      if (e.key === "ArrowLeft") handlePrevPage();
      if (e.key === "Escape") setSelectedBookId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedBookId, handleNextPage, handlePrevPage]);

  // Reset page when book changes
  const handleOpenBook = (bookId: 1 | 2 | 3) => {
    setSelectedBookId(bookId);
    setCurrentPageIndex(0);
    setTocOpen(false);
  };

  const handleCloseBook = () => {
    setSelectedBookId(null);
    setTocOpen(false);
  };

  return (
    <div className={`w-full h-full flex flex-col justify-center min-h-0 ${className}`}>
      <AnimatePresence mode="wait">
        {/* ─── VISTA 1: LE 3 COPERTINE DEI LIBRI (VETRINA 3D) ─── */}
        {!selectedBookId && (
          <motion.div
            key="book-shelf"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative rounded-2xl border border-[#C5A059]/35 bg-[#0C0D12] text-foreground shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col w-full h-[calc(100dvh-130px)] max-h-[740px] min-h-[540px] justify-between"
          >
            {/* Header Superiore fisso */}
            <div className="shrink-0 h-12 flex items-center justify-between px-6 border-b border-[#C5A059]/25 bg-gradient-to-r from-[#14151C] via-[#0E0F14] to-[#14151C]">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#C5A059] block">
                  TRATTATO STRATEGICO // CODEX DEI MAESTRI
                </span>
                <h3 className="text-sm sm:text-base font-bold font-display uppercase tracking-wider text-foreground">
                  I Tre Libri dei Generali
                </h3>
              </div>
              <p className="text-xs text-muted-foreground font-mono hidden sm:block">
                Seleziona un volume per aprire il trattato tattico
              </p>
            </div>

            {/* Grid 3 Copertine */}
            <div className="flex-1 min-h-0 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {GENERALS_BOOKS.map((book) => (
                <motion.div
                  key={book.id}
                  whileHover={{ y: -4, scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  onClick={() => handleOpenBook(book.id)}
                  className="group relative cursor-pointer rounded-xl border border-[#C5A059]/40 bg-gradient-to-b from-[#181922] via-[#12131A] to-[#0A0A0E] p-6 shadow-2xl transition-all hover:border-[#C5A059] hover:shadow-[0_0_35px_rgba(197,160,89,0.22)] flex flex-col justify-between h-full"
                >
                  {/* Filigree corner accents on cover */}
                  <div className="absolute top-2 left-2 text-[#C5A059]/40 text-xs font-serif select-none pointer-events-none">
                    ╔
                  </div>
                  <div className="absolute top-2 right-2 text-[#C5A059]/40 text-xs font-serif select-none pointer-events-none">
                    ╗
                  </div>
                  <div className="absolute bottom-2 left-2 text-[#C5A059]/40 text-xs font-serif select-none pointer-events-none">
                    ╚
                  </div>
                  <div className="absolute bottom-2 right-2 text-[#C5A059]/40 text-xs font-serif select-none pointer-events-none">
                    ╝
                  </div>

                  {/* Top Roman Label */}
                  <div className="text-center space-y-1">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-[#C5A059]">
                      {book.roman}
                    </span>
                    <div className="h-px w-12 mx-auto bg-[#C5A059]/40" />
                  </div>

                  {/* Center Emblem & Title */}
                  <div className="my-auto py-4 text-center space-y-2.5">
                    <div className="mx-auto h-16 w-16 rounded-full border border-[#C5A059]/50 bg-[#C5A059]/10 flex items-center justify-center text-[#D4AF37] shadow-[0_0_20px_rgba(197,160,89,0.15)] group-hover:scale-110 transition-transform">
                      {book.id === 1 && <Clock className="h-8 w-8" />}
                      {book.id === 2 && <Compass className="h-8 w-8" />}
                      {book.id === 3 && <Crosshair className="h-8 w-8" />}
                    </div>
                    <h4 className="text-base font-extrabold uppercase tracking-tight text-foreground font-display leading-tight">
                      {book.title}
                    </h4>
                    <p className="text-xs text-muted-foreground/80 leading-relaxed font-sans line-clamp-2 px-2">
                      {book.subtitle}
                    </p>
                  </div>

                  {/* Bottom Action Pill */}
                  <div className="pt-3 border-t border-[#C5A059]/20 text-center space-y-2">
                    <span className="font-mono text-[10px] text-[#C5A059] italic block">
                      {book.latinMotto}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-[#C5A059]/40 bg-[#C5A059]/15 font-mono text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] group-hover:bg-[#C5A059] group-hover:text-black transition-colors">
                      <BookOpen className="h-3 w-3" />
                      Apri il Volume
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Bottom Status bar for covers view */}
            <div className="shrink-0 h-10 px-6 border-t border-[#C5A059]/20 bg-gradient-to-r from-[#14151C] via-[#0E0F14] to-[#14151C] flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span>CANONE TATTICO UFFICIALE // AUREUS PROTOCOL</span>
              <span className="text-[#C5A059]">3 VOLUMI INTEGRALI · 12 CAPITOLI</span>
            </div>
          </motion.div>
        )}

        {/* ─── VISTA 2: IL TABLET READER (PAGINA MINOIATA A DUE COLONNE) ─── */}
        {selectedBookId && activeBook && activePage && (
          <motion.div
            key={`book-reader-${selectedBookId}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative rounded-2xl border border-[#C5A059]/50 bg-[#0C0D12] text-foreground shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col w-full h-[calc(100dvh-130px)] max-h-[740px] min-h-[540px] justify-between"
          >
            {/* ── Barra Superiore del Reader (Stile Tablet Limen) ── */}
            <div className="shrink-0 h-12 flex items-center justify-between px-4 sm:px-6 border-b border-[#C5A059]/25 bg-gradient-to-r from-[#14151C] via-[#0E0F14] to-[#14151C] z-20">
              {/* Logo e Titolo Sinistra */}
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseBook}
                  className="font-mono text-xs text-[#C5A059] hover:text-[#D4AF37] hover:bg-[#C5A059]/10 gap-1.5 px-2 h-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">I Tre Libri</span>
                </Button>
                <div className="h-4 w-px bg-[#C5A059]/30" />
                <div className="min-w-0">
                  <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#C5A059] block truncate">
                    AUREUS PROTOCOL // {activeBook.roman}
                  </span>
                  <span className="text-xs font-bold text-foreground truncate block font-display">
                    {activeBook.title}
                  </span>
                </div>
              </div>

              {/* Controlli Destra: Indice e Chiudi */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTocOpen(!tocOpen)}
                  className="font-mono text-xs border-[#C5A059]/40 hover:bg-[#C5A059]/10 text-[#C5A059] h-8 px-3"
                >
                  <Sliders className="h-3.5 w-3.5 mr-1.5" />
                  Indice
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseBook}
                  className="text-muted-foreground hover:text-white h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* ── Modal / Dropdown Indice Capitoli (Overlay Assoluto per Non Spostare Nulla) ── */}
            <AnimatePresence>
              {tocOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-12 inset-x-0 border-b border-[#C5A059]/30 bg-[#12131A]/95 backdrop-blur-md px-6 py-3 space-y-2 z-30 shadow-2xl"
                >
                  <div className="flex items-center justify-between pb-1 border-b border-border/50">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#C5A059]">
                      INDICE DEL VOLUME // {activeBook.roman}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      4 CAPITOLI
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                    {activeBook.pages.map((p, idx) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setCurrentPageIndex(idx);
                          setTocOpen(false);
                        }}
                        className={`p-2.5 rounded border text-left transition-colors flex items-center justify-between ${
                          currentPageIndex === idx
                            ? "border-[#C5A059] bg-[#C5A059]/15 text-[#D4AF37]"
                            : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground hover:border-border"
                        }`}
                      >
                        <span className="font-mono text-xs truncate">
                          {p.pageNumber}. {p.title}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground ml-2">
                          p.{p.pageNumber}
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── CORPO DEL READER: AREA FISSA A DUE ANTE AFFIANCATE (FLEX-1 MIN-H-0) ── */}
            <div className="relative flex-1 min-h-0 overflow-hidden">
              {/* Cornici angolari dorate filigranate fisse */}
              <div className="absolute top-2 left-2 text-[#C5A059]/30 text-sm font-serif select-none pointer-events-none z-10">
                ╔══
              </div>
              <div className="absolute top-2 right-2 text-[#C5A059]/30 text-sm font-serif select-none pointer-events-none z-10">
                ══╗
              </div>
              <div className="absolute bottom-2 left-2 text-[#C5A059]/30 text-sm font-serif select-none pointer-events-none z-10">
                ╚══
              </div>
              <div className="absolute bottom-2 right-2 text-[#C5A059]/30 text-sm font-serif select-none pointer-events-none z-10">
                ══╝
              </div>

              {/* Transizione fluida interna tra le pagine senza jump di altezza */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePage.id}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="h-full w-full px-6 py-3 sm:px-8 sm:py-4 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch overflow-hidden"
                >
                  {/* ANTA SINISTRA (COLONNA IMMAGINE SCHEMATICA INCORNICIATA) */}
                  <div className="lg:col-span-5 h-full flex flex-col items-center justify-center min-h-0">
                    <PageThemedIllustration
                      type={activePage.figureIllustrationType}
                      imageUrl={activePage.imageUrl}
                      figureLabel={activePage.figureLabel}
                      figureCaption={activePage.figureCaption}
                    />
                  </div>

                  {/* ANTA DESTRA (COLONNA TITOLO, SOTTOTITOLO, DROPCAP E REGOLE) */}
                  <div className="lg:col-span-7 h-full flex flex-col justify-between min-h-0 overflow-hidden text-left">
                    {/* Header della Pagina fisso */}
                    <div className="border-b border-[#C5A059]/25 pb-2 space-y-0.5 shrink-0">
                      <h3 className="text-lg sm:text-xl xl:text-2xl font-black font-display uppercase tracking-tight text-[#D4AF37] leading-tight">
                        {activePage.title}
                      </h3>
                      <p className="text-xs sm:text-[13px] text-[#C5A059]/80 font-serif italic line-clamp-1">
                        {activePage.subtitle}
                      </p>
                    </div>

                    {/* Area Scorrevole Interna Protetta per Contenuti e Regole */}
                    <div className="flex-1 min-h-0 overflow-y-auto limen-scroll-pane pr-2 space-y-2 py-1 my-1">
                      {/* Paragrafo con Capilettera Miniata (DropCap) */}
                      <div className="text-xs sm:text-[12.5px] leading-relaxed text-foreground/90 font-serif">
                        <span className="float-left font-display text-3xl sm:text-4xl font-bold leading-none pr-2.5 pt-0.5 text-[#D4AF37] select-none">
                          {activePage.dropCap}
                        </span>
                        <span>{activePage.storytellingText}</span>
                      </div>

                      {/* Punti Schematici e Regole Scolpite */}
                      <div className="space-y-1.5 pt-1">
                        {activePage.bulletPoints.map((item, idx) => (
                          <div
                            key={idx}
                            className="p-2 sm:p-2.5 rounded-lg border border-border/80 bg-[#12131A]/90 space-y-0.5 text-left"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <strong className="text-xs font-bold uppercase tracking-wider text-foreground font-mono">
                                {item.title}
                              </strong>
                              {item.tag && (
                                <span className="font-mono text-[9px] uppercase tracking-wider text-[#C5A059] bg-[#C5A059]/10 px-2 py-0.5 rounded border border-[#C5A059]/20 shrink-0">
                                  {item.tag}
                                </span>
                              )}
                            </div>
                            <p className="text-[11.5px] sm:text-xs text-muted-foreground leading-relaxed font-sans">
                              {item.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Assioma Filosofico Conclusivo (Fisso in Fondo alla Colonna Destra) */}
                    <div className="pt-2 border-t border-[#C5A059]/20 shrink-0">
                      <p className="text-xs text-[#D4AF37]/90 font-serif italic leading-relaxed text-center">
                        {activePage.finalAxiom}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Barra Inferiore del Reader (Paginazione & Frecce) ── */}
            <div className="shrink-0 h-12 flex items-center justify-between px-6 border-t border-[#C5A059]/25 bg-gradient-to-r from-[#14151C] via-[#0E0F14] to-[#14151C] z-20">
              {/* Bottone Indietro */}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPageIndex === 0}
                className="font-mono text-xs border-[#C5A059]/40 hover:bg-[#C5A059]/15 text-[#C5A059] disabled:opacity-30 h-8"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Precedente
              </Button>

              {/* Indicatore Pagina (es. PAG. 01 / 04) */}
              <div className="font-mono text-xs text-[#D4AF37] tracking-widest font-semibold">
                PAG. {String(activePage.pageNumber).padStart(2, "0")} /{" "}
                {String(activeBook.pages.length).padStart(2, "0")}
              </div>

              {/* Bottone Avanti */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPageIndex === activeBook.pages.length - 1}
                className="font-mono text-xs border-[#C5A059]/40 hover:bg-[#C5A059]/15 text-[#C5A059] disabled:opacity-30 h-8"
              >
                Successivo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GeneralsBooksReader;
