import type { DrawingToolId } from "./toolRailModel";

export interface ToolKnowledgeEntry {
  id: DrawingToolId;
  title: string;
  breadcrumbTitle: string;
  categoryLabel: string;
  summary: string;
  application: string[];
  howToDraw: string;
  settingsOverview: {
    input: string;
    style: string;
    coordinates: string;
    visibility: string;
  };
  proTip: string;
  previewKind:
    | "infoline"
    | "trend"
    | "fib"
    | "frvp"
    | "avwap"
    | "position_long"
    | "position_short"
    | "rect"
    | "channel"
    | "ruler"
    | "hline"
    | "path"
    | "annotation";
}

export const TOOL_KNOWLEDGE_CATALOG: Record<DrawingToolId, ToolKnowledgeEntry> = {
  cursor: {
    id: "cursor",
    title: "Mirino e Puntatore a Croce (Crosshair)",
    breadcrumbTitle: "Mirino e navigazione del grafico",
    categoryLabel: "Cursori",
    summary: "Modalità di navigazione standard con mirino sincronizzato su prezzo e tempo, selezione rapida dei disegni e ispezione precisa dei valori OHLC.",
    application: [
      "Il Mirino (Crosshair) è lo strumento fondamentale per esplorare il grafico senza tracciare involontariamente nuovi oggetti. Allinea in tempo reale due assi ortogonali tratteggiati sul prezzo esatto (asse destro) e sul timestamp della barra (asse inferiore).",
      "In questa modalità puoi fare clic su qualsiasi strumento già disegnato sul grafico per selezionarlo, trascinarne gli ancoraggi, duplicarlo o fare doppio clic per aprire la finestra completa delle Impostazioni (Input, Stile, Coordinate, Visibilità).",
    ],
    howToDraw: "Seleziona il Mirino dalla barra a sinistra o premi il tasto Esc in qualsiasi momento per uscire dalla modalità disegno attiva e tornare al controllo libero del grafico.",
    settingsOverview: {
      input: "Modalità di aggancio magnetico (Magnete OHLC) e blocco selezione oggetti.",
      style: "Colore del mirino, stile linea (Continuo, Tratteggiato, Punteggiato) e visibilità etichette sugli assi.",
      coordinates: "Lettura istantanea di Apertura (O), Massimo (H), Minimo (L), Chiusura (C) e Volume nella legenda superiore.",
      visibility: "Sempre attivo su tutti i timeframe.",
    },
    proTip: "Tieni premuto Shift e fai clic sul grafico per attivare istantaneamente il Righello di misurazione rapida senza cambiare strumento.",
    previewKind: "hline",
  },
  infoline: {
    id: "infoline",
    title: "Strumento di disegno Infolinea",
    breadcrumbTitle: "Strumento di disegno infolinea",
    categoryLabel: "Linee di tendenza",
    summary: "Linea di tendenza avanzata con finestra informativa annessa che calcola variazione assoluta, variazione %, distanza in barre/tempo e angolo d'inclinazione.",
    application: [
      "Lo strumento per il disegno delle infolinee funziona in modo simile a una linea di tendenza standard, ma con il vantaggio aggiuntivo di generare una finestra informativa annessa. Quando viene tracciata tra due punti su un grafico, questa finestra calcola e visualizza automaticamente dati utili, quali la variazione assoluta del prezzo, la variazione percentuale, la distanza in barre e in tempo, nonché l'angolo della linea.",
      "Ciò lo rende uno strumento eccellente per misurare rapidamente la performance di un asset in un periodo specifico, quantificare l'impulsività di una gamba strutturale (Displacement) e contrassegnare al contempo un trend o livelli dinamici di supporto/resistenza.",
    ],
    howToDraw: "Per tracciare una infolinea, selezionare lo strumento dalla barra degli strumenti a sinistra, fare clic sul grafico per impostare il punto iniziale, trascinare il cursore e fare nuovamente clic per posizionare il secondo punto.",
    settingsOverview: {
      input: "Attivazione/disattivazione di statistiche prezzo, distanza in barre/tempo, angolo in gradi (°) ed etichetta testuale.",
      style: "Colore linea, spessore (1–8px), stile tratto (Continuo, Tratteggiato, Punteggiato), estensione a sinistra o a destra.",
      coordinates: "Impostazione millimetrica di #1 (prezzo e barra) e #2 (prezzo e barra).",
      visibility: "Filtro granulare per Tick, Secondi, Minuti, Ore, Giorni, Settimane e Mesi.",
    },
    proTip: "Usa l'angolo dell'Infolinea per confrontare la velocità di un impulso istituzionale rispetto alla lentezza correttiva del ritracciamento.",
    previewKind: "infoline",
  },
  trend: {
    id: "trend",
    title: "Strumento Linea di Tendenza (Trend Line)",
    breadcrumbTitle: "Strumento linea di tendenza",
    categoryLabel: "Linee di tendenza",
    summary: "Collega due punti di swing (massimi o minimi) per definire la direzione del trend, linee di liquidità dinamica o rotture strutturali.",
    application: [
      "La Linea di Tendenza è uno degli strumenti cardine dell'analisi tecnica e strutturale. Collegando due o più minimi crescenti (in un trend rialzista) o massimi decrescenti (in un trend ribassista), rende immediatamente visibile la pendenza e il ritmo del mercato.",
      "Nell'operatività istituzionale e Smart Money, le trendline vengono utilizzate anche per mappare la 'Trendline Liquidity' (liquidità costruita sopra o sotto una diagonale evidente) prima di uno sweep direzionale.",
    ],
    howToDraw: "Seleziona Linea di tendenza dalla barra laterale o dalla barra dei preferiti, fai clic sul primo swing (usa il Magnete per agganciare esattamente il massimo/minimo della candela) e fai clic sul secondo punto di ancoraggio.",
    settingsOverview: {
      input: "Testo opzionale lungo la linea, mostra etichette prezzo agli estremi, mostra statistiche e angolo.",
      style: "Colore, spessore, stile linea (Continuo, Tratteggiato, Punteggiato), Estendi a sinistra, Estendi a destra.",
      coordinates: "Prezzo e indice barra esatti per il primo (#1) e il secondo (#2) ancoraggio.",
      visibility: "Configurabile per mostrare la trendline solo sui timeframe operativi desiderati (es. H1 e M15).",
    },
    proTip: "Salva diversi modelli nel menu 'Modello' (es. 'BOS Strutturale', 'Trendline Liquidità') per applicare stili e colori con un solo clic.",
    previewKind: "trend",
  },
  ray: {
    id: "ray",
    title: "Strumento Semiretta (Ray)",
    breadcrumbTitle: "Strumento di disegno semiretta",
    categoryLabel: "Linee di tendenza",
    summary: "Linea che parte da un punto di origine preciso e si proietta all'infinito nella direzione del secondo punto di controllo.",
    application: [
      "La Semiretta (Ray) combina la precisione di un punto di partenza ancorato a uno swing storico con la proiezione automatica nel futuro. È ideale per proiettare supporti/resistenze inclinati o livelli chiave senza dover allungare manualmente la linea all'avanzare delle nuove candele.",
      "Viene spesso impiegata per tracciare proiezioni angolari da minimi o massimi di sessione verso le candele successive.",
    ],
    howToDraw: "Fai clic sul punto di origine (#1) e poi fai clic su un secondo punto (#2) che definisce la direzione e l'inclinazione della proiezione infinita.",
    settingsOverview: {
      input: "Etichetta testuale e mostra prezzo sul punto d'origine.",
      style: "Colore, spessore (1–8px) e stile del tratto (Continuo, Tratteggiato, Punteggiato).",
      coordinates: "Coordinate esatte del punto d'origine (#1) e del punto direzionale (#2).",
      visibility: "Visibilità personalizzabile su tutti gli intervalli temporali.",
    },
    proTip: "Attiva il Magnete OHLC per ancorare l'origine della semiretta esattamente allo stoppino (wick) della candela madre.",
    previewKind: "trend",
  },
  hray: {
    id: "hray",
    title: "Strumento Semiretta Orizzontale (Horizontal Ray)",
    breadcrumbTitle: "Strumento semiretta orizzontale",
    categoryLabel: "Linee di tendenza",
    summary: "Proietta un livello di prezzo rigorosamente orizzontale a partire da una candela specifica fino al bordo destro del grafico.",
    application: [
      "A differenza della linea orizzontale classica (che attraversa tutto lo storico passato), la Semiretta Orizzontale parte esattamente dalla candela in cui il livello è nato (es. un massimo/minimo di sessione Asia/Londra, un Equal High/Low o un livello di apertura giornaliero) e si estende solo in avanti.",
      "Questo mantiene il grafico estremamente pulito a sinistra, evidenziando con precisione chirurgica quando e dove ha avuto origine il pool di liquidità.",
    ],
    howToDraw: "Seleziona Semiretta orizzontale e fai un singolo clic esattamente sullo swing o sulla candela da cui vuoi far partire il livello orizzontale.",
    settingsOverview: {
      input: "Testo descrittivo del livello (es. 'Asia High', 'BSL', 'SSL', 'PDH') e visibilità etichetta prezzo.",
      style: "Colore, spessore della linea e stile tratto (Continuo, Tratteggiato, Punteggiato).",
      coordinates: "Prezzo esatto e indice barra (#1) del punto di partenza.",
      visibility: "Configurabile per timeframe (es. visibile solo da M1 a H1 per i livelli intraday).",
    },
    proTip: "È lo strumento preferito dai trader istituzionali per segnare BSL (Buy-Side Liquidity) e SSL (Sell-Side Liquidity) senza sporcare lo storico.",
    previewKind: "hline",
  },
  hline: {
    id: "hline",
    title: "Strumento Linea Orizzontale (Horizontal Line)",
    breadcrumbTitle: "Strumento linea orizzontale",
    categoryLabel: "Linee di tendenza",
    summary: "Traccia un livello di prezzo statico che attraversa l'intero grafico da sinistra a destra per supporti, resistenze e livelli psicologici.",
    application: [
      "La Linea Orizzontale contrassegna un livello di prezzo chiave valido su tutto l'orizzonte temporale del grafico. È perfetta per identificare massimi e minimi settimanali/mensili, soglie istituzionali (numeri tondi / quarter levels) e livelli di rottura strutturale HTF.",
      "Può essere arricchita con un'etichetta testuale personalizzata direttamente sopra la linea.",
    ],
    howToDraw: "Seleziona Linea orizzontale (o usa la scorciatoia Alt+H) e fai un singolo clic al livello di prezzo desiderato.",
    settingsOverview: {
      input: "Testo dell'etichetta e attivazione badge prezzo.",
      style: "Colore, spessore linea (1–8px) e stile (Continuo, Tratteggiato, Punteggiato).",
      coordinates: "Valore numerico esatto del Prezzo.",
      visibility: "Filtro multi-timeframe completo (Tick, Secondi, Minuti, Ore, Giorni, Settimane, Mesi).",
    },
    proTip: "Fai doppio clic sulla linea per digitare il prezzo esatto al centesimo o pip nella scheda Coordinate.",
    previewKind: "hline",
  },
  vline: {
    id: "vline",
    title: "Strumento Linea Verticale (Vertical Line)",
    breadcrumbTitle: "Strumento linea verticale",
    categoryLabel: "Linee di tendenza",
    summary: "Contrassegna un istante temporale preciso (apertura di sessione, rilascio macroeconomico o cambio di ciclo).",
    application: [
      "La Linea Verticale isola una candela o un orario specifico sull'asse temporale. Viene utilizzata per evidenziare l'inizio delle Killzone (Londra 08:00, New York 13:30/14:30), il rilascio di notizie ad alto impatto (CPI, NFP, FOMC) o il punto esatto di inversione temporale.",
    ],
    howToDraw: "Seleziona Linea verticale (Alt+V) e fai un singolo clic sulla candela corrispondente all'orario che desideri marcare.",
    settingsOverview: {
      input: "Etichetta testuale dell'evento temporale.",
      style: "Colore, spessore e stile del tratto verticale.",
      coordinates: "Indice barra (#1) e timestamp esatto.",
      visibility: "Filtro di visibilità per intervallo temporale.",
    },
    proTip: "Usa uno stile tratteggiato sottile per delimitare le finestre temporali operative senza coprire le candele.",
    previewKind: "hline",
  },
  parallelChannel: {
    id: "parallelChannel",
    title: "Strumento Canale Parallelo (Parallel Channel)",
    breadcrumbTitle: "Strumento canale parallelo",
    categoryLabel: "Fibonacci e Canali",
    summary: "Costruisce un canale equidistante con linea mediana del 50% per incanalare trend, flag correttive e fasi di accumulazione/distribuzione.",
    application: [
      "Il Canale Parallelo è composto da due linee di tendenza rigorosamente parallele e da una linea mediana (50% equilibrium) opzionale. Permette di racchiudere il movimento del prezzo all'interno di un corridoio dinamico di offerta e domanda.",
      "La linea mediana del 50% agisce come spartiacque tra zona Premium (metà superiore del canale) e zona Discount (metà inferiore), offrendo confluenze ad altissima precisione.",
    ],
    howToDraw: "Fai clic sul punto #1 e sul punto #2 per tracciare il bordo principale del canale; trascina poi la maniglia centrale per definire l'ampiezza del bordo parallelo opposto.",
    settingsOverview: {
      input: "Ampiezza del canale (offset di prezzo), mostra linea mediana 50%, estensione a sinistra e a destra.",
      style: "Colore bordi, spessore, stile linea, colore e opacità del riempimento interno.",
      coordinates: "Coordinate esatte dei punti #1, #2 e ampiezza verticale del canale.",
      visibility: "Visibilità personalizzabile su ogni timeframe.",
    },
    proTip: "Attiva sempre la linea mediana (50%) per individuare le reazioni intermedie del prezzo prima del test della sponda opposta.",
    previewKind: "channel",
  },
  fib: {
    id: "fib",
    title: "Ritracciamento di Fibonacci (Fib Retracement)",
    breadcrumbTitle: "Ritracciamento di Fibonacci",
    categoryLabel: "Fibonacci e Canali",
    summary: "Misura i livelli matematici di ritracciamento ed estensione (0.5 Equilibrium, 0.618–0.786 Golden Pocket / OTE) lungo un impulso.",
    application: [
      "Il Ritracciamento di Fibonacci suddivide verticalmente un impulso di prezzo (dal minimo allo swing massimo per un movimento rialzista, o dal massimo al minimo per un movimento ribassista) secondo i rapporti aurei chiave: 23.6%, 38.2%, 50% (Equilibrium), 61.8%, 70.5% e 78.6%.",
      "Nell'analisi istituzionale, il livello 0.5 separa l'area Premium (sopra il 50%, ideale per vendere) dall'area Discount (sotto il 50%, ideale per comprare), mentre la fascia 0.618–0.786 individua la Optimal Trade Entry (OTE).",
    ],
    howToDraw: "Seleziona Ritracciamento di Fibonacci, fai clic sull'inizio dell'impulso (Swing Low o Swing High) e trascina fino all'estremo opposto dell'impulso.",
    settingsOverview: {
      input: "Attivazione/disattivazione singola dei livelli (0, 0.236, 0.382, 0.5, 0.618, 0.705, 0.786, 1, 1.272, 1.618) e inversione direzione.",
      style: "Colori per livello, spessore linee, estensione a destra/sinistra, opacità riempimento, mostra prezzi e percentuali.",
      coordinates: "Prezzo e barra di inizio impulso (#1) e fine impulso (#2).",
      visibility: "Filtro multi-timeframe per mantenere visibili i Fib HTF o LTF dove necessario.",
    },
    proTip: "Salva un modello 'AUREUS Equilibrium (0 - 0.5 - 1)' e un modello 'OTE Completa' nel menu Modello per passare da uno all'altro istantaneamente.",
    previewKind: "fib",
  },
  rect: {
    id: "rect",
    title: "Strumento Rettangolo / Zona SMC (FVG, Orderblock, Range)",
    breadcrumbTitle: "Strumento di disegno rettangolo",
    categoryLabel: "Forme e Annotazioni",
    summary: "Evidenzia zone di prezzo e tempo quali Fair Value Gap (FVG), Orderblock (OB), Breaker Block e range di consolidamento asiatico.",
    application: [
      "Il Rettangolo è lo strumento principale per mappare le zone di interesse (POI) sul grafico. Permette di delimitare con chiarezza visiva inefficienze volumetriche (Fair Value Gap / Imbalance), blocchi d'ordine istituzionali (Orderblock) e fasi di compressione.",
      "Include il supporto nativo alla Linea Mediana del 50% (Consequent Encroachment / Mean Threshold), fondamentale per verificare se il prezzo rispetta o invalida la metà esatta della zona.",
    ],
    howToDraw: "Seleziona Rettangolo, fai clic sul primo angolo della zona (es. massimo della 1ª candela di un FVG) e trascina fino al secondo angolo opposto.",
    settingsOverview: {
      input: "Testo interno/etichetta, Preset rapido SMC (FVG, Orderblock, Liquidità, Breaker, Sessione), Linea 50% (Midline) ed Estendi a destra.",
      style: "Colore bordo, spessore, stile tratto, colore e opacità del riempimento (0–100%).",
      coordinates: "Prezzo superiore/inferiore e barre di inizio/fine (#1 e #2).",
      visibility: "Filtro di visibilità per timeframe (es. nascondi le zone M1 quando osservi il grafico D1).",
    },
    proTip: "Attiva 'Linea 50%' e 'Estendi a destra' per monitorare il test del Consequent Encroachment (50% del FVG) sulle candele future.",
    previewKind: "rect",
  },
  highlighter: {
    id: "highlighter",
    title: "Strumento Evidenziatore (Highlighter)",
    breadcrumbTitle: "Strumento evidenziatore",
    categoryLabel: "Forme e Annotazioni",
    summary: "Tratto semitrasparente a mano libera per mettere in risalto aree chiave, accumuli di stop o note visive rapide sul grafico.",
    application: [
      "L'Evidenziatore consente di disegnare a mano libera con un pennarello largo e semitrasparente sopra l'azione del prezzo. È ideale durante le revisioni del diario, la preparazione pre-sessione o il backtest per cerchiare rapidamente zone di manipolazione (Judas Swing) o cluster di candele.",
    ],
    howToDraw: "Seleziona Evidenziatore, tieni premuto il tasto sinistro del mouse sul grafico e trascina liberamente lungo l'area da mettere in risalto.",
    settingsOverview: {
      input: "Spessore del pennarello.",
      style: "Colore del tratto e opacità di riempimento.",
      coordinates: "Punti di ancoraggio iniziale e finale del tratto.",
      visibility: "Configurabile per tutti gli intervalli temporali.",
    },
    proTip: "Usa un'opacità intorno al 25–35% per evidenziare i movimenti senza coprire gli stoppini delle candele sottostanti.",
    previewKind: "annotation",
  },
  path: {
    id: "path",
    title: "Strumento Percorso (Path Multi-Segmento)",
    breadcrumbTitle: "Strumento percorso a segmenti",
    categoryLabel: "Linee di tendenza",
    summary: "Catena di segmenti consecutivi con freccia direzionale finale per mappare la struttura di mercato (HH, HL, LH, LL) e gli scenari futuri.",
    application: [
      "Lo strumento Percorso permette di tracciare una sequenza continua di movimenti swing (impulso → ritracciamento → nuovo impulso). È lo strumento d'elezione per disegnare la mappa strutturale del mercato e ipotizzare il percorso futuro del prezzo (es. presa di liquidità seguita da ingresso nella zona di domanda e ripartenza verso il target).",
    ],
    howToDraw: "Fai clic su ogni vertice consecutivo sul grafico per aggiungere segmenti al percorso. Fai doppio clic (oppure premi Invio) sull'ultimo punto per terminare il disegno.",
    settingsOverview: {
      input: "Punti della polilinea.",
      style: "Colore, spessore della linea e stile tratto (Continuo, Tratteggiato, Punteggiato).",
      coordinates: "Coordinate di tutti i vertici che compongono il percorso.",
      visibility: "Visibilità regolabile per ogni famiglia di timeframe.",
    },
    proTip: "Usa il Percorso tratteggiato per disegnare sulla destra del grafico lo scenario di conferma (re-test + espansione) che attendi prima di entrare a mercato.",
    previewKind: "path",
  },
  arrow: {
    id: "arrow",
    title: "Strumento Freccia Direzionale (Arrow)",
    breadcrumbTitle: "Strumento freccia direzionale",
    categoryLabel: "Linee di tendenza",
    summary: "Vettore lineare con punta a freccia per indicare spinte direzionali, target di liquidità o collegare note esplicative.",
    application: [
      "La Freccia Direzionale traccia un segmento netto terminante con una punta vettoriale. È perfetta per indicare la direzione del bias operativo, puntare a uno specifico massimo/minimo da assorbire o evidenziare una candela di rottura.",
    ],
    howToDraw: "Fai clic sul punto di partenza (#1) e trascina o fai clic sul punto di destinazione (#2) dove apparirà la punta della freccia.",
    settingsOverview: {
      input: "Testo opzionale associato alla freccia.",
      style: "Colore, spessore e stile linea.",
      coordinates: "Coordinate esatte di coda (#1) e punta (#2).",
      visibility: "Filtro multi-timeframe.",
    },
    proTip: "Ottima per collegare visivamente una nota di testo alla candela esatta del trigger d'ingresso.",
    previewKind: "trend",
  },
  arrowUp: {
    id: "arrowUp",
    title: "Segnale Freccia Su (Arrow Mark Up)",
    breadcrumbTitle: "Segnale freccia su",
    categoryLabel: "Forme e Annotazioni",
    summary: "Marcatore direzionale rialzista ancorato a un punto preciso per segnalare ingressi Long, sweep di minimi o conferme rialziste.",
    application: [
      "Posiziona un'icona compatta a freccia rivolta verso l'alto sotto una candela chiave. Permette di contrassegnare con immediatezza visiva candele di manipolazione (Spring / Sweep SSL), trigger d'ingresso rialzisti o cambi di carattere (CHoCH Up).",
    ],
    howToDraw: "Seleziona Freccia su e fai un singolo clic sotto la candela che desideri contrassegnare.",
    settingsOverview: {
      input: "Etichetta testuale opzionale sotto/sopra il segnale.",
      style: "Colore e dimensione del marcatore.",
      coordinates: "Prezzo e barra (#1) del segnale.",
      visibility: "Visibilità per timeframe.",
    },
    proTip: "Aggiungi Freccia Su e Freccia Giù alla barra dei preferiti per marcare al volo i tuoi punti di esecuzione durante il Backtest.",
    previewKind: "annotation",
  },
  arrowDown: {
    id: "arrowDown",
    title: "Segnale Freccia Giù (Arrow Mark Down)",
    breadcrumbTitle: "Segnale freccia giù",
    categoryLabel: "Forme e Annotazioni",
    summary: "Marcatore direzionale ribassista per segnalare ingressi Short, prese di liquidità sui massimi (BSL Sweep) o rotture ribassiste.",
    application: [
      "Posiziona un marcatore rivolto verso il basso sopra una candela specifica. Ideale per evidenziare UTAD, caccia agli stop sopra massimi precedenti o il punto esatto di attivazione di un setup Short.",
    ],
    howToDraw: "Seleziona Freccia giù e fai un singolo clic sopra la candela da marcare.",
    settingsOverview: {
      input: "Etichetta testuale opzionale.",
      style: "Colore e dimensione del marcatore.",
      coordinates: "Prezzo e barra (#1) del segnale.",
      visibility: "Visibilità per timeframe.",
    },
    proTip: "Combina il marcatore con una breve etichetta (es. 'Sweep H1') nelle impostazioni per rendere gli screenshot del Diario autoesplicativi.",
    previewKind: "annotation",
  },
  text: {
    id: "text",
    title: "Strumento Testo (Text Annotation)",
    breadcrumbTitle: "Strumento di annotazione testo",
    categoryLabel: "Forme e Annotazioni",
    summary: "Inserisce etichette testuali ancorate a prezzo e tempo per nominare strutture (BOS, CHoCH, FVG, Asia High) e annotare il piano.",
    application: [
      "Lo strumento Testo consente di scrivere direttamente sul canvas del grafico, ancorando la nota a una coordinata precisa di prezzo e tempo in modo che scorra insieme alle candele.",
      "È indispensabile per mantenere un grafico ordinato e documentato secondo la nomenclatura del tuo protocollo operativo.",
    ],
    howToDraw: "Seleziona Testo, fai clic nel punto desiderato del grafico, digita l'annotazione e premi Invio.",
    settingsOverview: {
      input: "Contenuto del testo e dimensione carattere (8–72pt).",
      style: "Colore del testo, grassetto, sfondo opzionale e bordo.",
      coordinates: "Prezzo e indice barra (#1) dell'ancoraggio.",
      visibility: "Filtro completo di visibilità multi-timeframe.",
    },
    proTip: "Fai doppio clic su qualsiasi testo già presente sul grafico per modificarne rapidamente contenuto, dimensione e colore.",
    previewKind: "annotation",
  },
  callout: {
    id: "callout",
    title: "Strumento Nota Ancorata (Callout)",
    breadcrumbTitle: "Strumento nota ancorata (Callout)",
    categoryLabel: "Forme e Annotazioni",
    summary: "Fumetto descrittivo con puntatore ancorato a una candela specifica per commentare dettagli tecnici senza sovrapporsi al prezzo.",
    application: [
      "La Nota Ancorata (Callout) collega una casella di testo incorniciata a una candela o livello specifico tramite un puntatore. Permette di posizionare il commento in una zona libera del grafico mantenendo un legame visivo inequivocabile con il punto esatto dell'evento.",
    ],
    howToDraw: "Fai clic sulla candela/prezzo da puntare (#1) e trascina o fai clic dove desideri posizionare il riquadro della nota.",
    settingsOverview: {
      input: "Testo della nota e dimensione font.",
      style: "Colore testo/bordo e colore di sfondo del riquadro.",
      coordinates: "Coordinate della punta (#1) e del riquadro (#2).",
      visibility: "Filtro multi-timeframe.",
    },
    proTip: "Perfetto per spiegare il motivo psicologico o tecnico di un'entrata/uscita negli screenshot salvati nel Diario.",
    previewKind: "annotation",
  },
  longPosition: {
    id: "longPosition",
    title: "Strumento Posizione Long (Long Position Risk/Reward)",
    breadcrumbTitle: "Strumento posizione long",
    categoryLabel: "Previsioni",
    summary: "Calcolatore visivo per operazioni d'acquisto (Buy): mostra area di Target, area di Stop Loss, distanza in pips/%, e rapporto Rischio/Rendimento (R:R) con esecuzione ordine diretta.",
    application: [
      "Lo strumento Posizione Long permette di pianificare e visualizzare un'operazione rialzista direttamente sulle candele prima di entrare a mercato. Traccia due rettangoli contrapposti: l'area di profitto (Target) sopra il prezzo d'ingresso e l'area di rischio (Stop Loss) sotto il prezzo d'ingresso.",
      "Calcola istantaneamente i pips di Stop Loss, i pips di Take Profit, la variazione percentuale e il rapporto Rischio:Rendimento (R:R). Inoltre integra il pulsante diretto '⚡ Piazza Ordine' per trasformare il disegno in un ordine operativo reale nel Backtest o nel Piano de Il Varco.",
    ],
    howToDraw: "Seleziona Posizione Long e fai clic sul livello d'ingresso desiderato. Trascina poi la maniglia superiore sul livello di Take Profit e la maniglia inferiore sotto lo swing di Stop Loss.",
    settingsOverview: {
      input: "Prezzo d'ingresso, prezzo Stop Loss, prezzo Take Profit, capitale conto e rischio % per il calcolo lotti.",
      style: "Colore area Target, colore area Stop, opacità di riempimento, modalità etichette compatte/estese.",
      coordinates: "Prezzo d'ingresso, barra d'inizio (#1) e barra finale (#2).",
      visibility: "Filtro di visibilità su tutti i timeframe.",
    },
    proTip: "Premi il pulsante '⚡ Piazza Ordine' direttamente sul disegno per inviare istantaneamente Entry, SL e TP al motore di esecuzione senza doverli copiare a mano!",
    previewKind: "position_long",
  },
  shortPosition: {
    id: "shortPosition",
    title: "Strumento Posizione Short (Short Position Risk/Reward)",
    breadcrumbTitle: "Strumento posizione short",
    categoryLabel: "Previsioni",
    summary: "Calcolatore visivo per operazioni di vendita (Sell): proietta Stop Loss sopra il massimo, Take Profit verso il basso e calcola in tempo reale R:R, pips e %.",
    application: [
      "Lo strumento Posizione Short è il gemello ribassista per la pianificazione delle vendite allo scoperto. Posiziona la zona di protezione (Stop Loss) sopra lo swing high d'invalidazione e proietta la zona di profitto (Take Profit) verso i pool di liquidità inferiori.",
      "Aggiorna dinamicamente il rapporto R:R mentre trascini le maniglie di Stop o Target e permette l'invio immediato dell'ordine con un clic.",
    ],
    howToDraw: "Seleziona Posizione Short e fai clic sul prezzo d'ingresso. Regola la maniglia superiore sullo Stop Loss e quella inferiore sul Take Profit.",
    settingsOverview: {
      input: "Prezzo d'ingresso, Stop Loss, Take Profit, capitale e rischio %.",
      style: "Colore area Target, colore area Stop, opacità riempimento e visibilità etichette.",
      coordinates: "Coordinate esatte di ingresso, SL, TP e durata.",
      visibility: "Filtro multi-timeframe.",
    },
    proTip: "Verifica sempre che il rapporto R:R mostrato sullo strumento rispetti la soglia minima del tuo Protocollo prima di sigillare il trade.",
    previewKind: "position_short",
  },
  frvp: {
    id: "frvp",
    title: "Profilo Volume ad Intervallo Fisso (FRVP)",
    breadcrumbTitle: "Profilo volume ad intervallo fisso (FRVP)",
    categoryLabel: "Basato sul volume",
    summary: "Analizza la distribuzione orizzontale dei volumi scambiati per livello di prezzo in un intervallo scelto, calcolando POC, VAH, VAL e Sviluppo del POC/VA.",
    application: [
      "Il Profilo Volume ad Intervallo Fisso (Fixed Range Volume Profile — FRVP) è uno degli strumenti istituzionali più potenti in assoluto. A differenza del volume tradizionale (che mostra quanto volume è stato scambiato nel tempo), l'FRVP costruisce un istogramma orizzontale che rivela esattamente a quali livelli di prezzo si sono concentrati gli scambi in uno specifico movimento, consolidamento o sessione.",
      "Evidenzia automaticamente tre livelli critici: il POC (Point of Control, il livello di prezzo con il maggior volume scambiato in assoluto), il VAH (Value Area High, limite superiore dell'area del 70% dei volumi) e il VAL (Value Area Low, limite inferiore dell'area di valore), oltre alle curve dinamiche di Sviluppo del POC e Sviluppo della Value Area.",
    ],
    howToDraw: "Seleziona FRVP dalla barra laterale o dai preferiti, fai clic sulla prima candela dell'intervallo da analizzare (es. inizio di un impulso o di una sessione) e fai clic sull'ultima candela dell'intervallo.",
    settingsOverview: {
      input: "Numero di righe dell'istogramma (Dimensione righe, es. 24–64), Modalità Volume (Su/Giù, Totale, Delta) e Percentuale Area di Valore (default 70%).",
      style: "Profilo volume, Valori numerici, Ampiezza (% del box), Posizionamento (Sinistra / Destra), colori separati per Volume acquisti/vendite e Valore area acquisto/vendita, linee VAH, VAL, POC, Sviluppo del POC, Sviluppo VA e colore sfondo Istogramma.",
      coordinates: "Indice barra e timestamp di inizio (#1) e fine (#2) del range analizzato.",
      visibility: "Controllo completo di visibilità da Tick e Secondi fino a Settimane e Mesi.",
    },
    proTip: "Attiva 'Estendi a destra' sul POC per individuare i 'Naked POC' (POC non ancora ritestati dal prezzo), che agiscono come potenti magneti di liquidità e zone di reazione.",
    previewKind: "frvp",
  },
  avwap: {
    id: "avwap",
    title: "Strumento VWAP Ancorato (Anchored VWAP)",
    breadcrumbTitle: "Strumento VWAP ancorato",
    categoryLabel: "Basato sul volume",
    summary: "Calcola il prezzo medio ponderato per i volumi a partire da un evento chiave specifico (minimo/massimo importante, notizia macro, apertura sessione).",
    application: [
      "Il VWAP Ancorato (Anchored Volume-Weighted Average Price) traccia una curva dinamica che mostra il prezzo medio reale pagato dai partecipanti al mercato a partire esattamente dalla candela su cui lo ancori, ponderando ogni prezzo per i volumi scambiati.",
      "Ancorandolo a uno Swing High/Low principale, all'inizio della settimana o alla candela di una notizia FOMC/NFP, rivela chi ha il controllo tra compratori e venditori e offre livelli di supporto/resistenza dinamici istituzionali, completi di bande di deviazione standard opzionali.",
    ],
    howToDraw: "Seleziona VWAP ancorato e fai un singolo clic sulla candela chiave da cui vuoi far partire il calcolo cumulativo.",
    settingsOverview: {
      input: "Sorgente di calcolo (HLC3, OHLC4, Close, HL2), attivazione Bande di Deviazione Standard e moltiplicatore (es. 1.0σ, 2.0σ).",
      style: "Colore e spessore della curva VWAP, stile tratto, colore bande e opacità riempimento.",
      coordinates: "Candela di ancoraggio esatta (#1).",
      visibility: "Filtro multi-timeframe completo.",
    },
    proTip: "Ancora un AVWAP sul minimo impulsivo che ha generato il Break of Structure (BOS): il primo pullback sulla curva AVWAP in confluenza con un FVG offre setup ad altissima probabilità.",
    previewKind: "avwap",
  },
  ruler: {
    id: "ruler",
    title: "Range Data e Prezzo / Righello (Date & Price Range)",
    breadcrumbTitle: "Strumento range data e prezzo",
    categoryLabel: "Misuratori",
    summary: "Misura simultaneamente l'escursione verticale del prezzo (pips, punti, %) e la distanza temporale orizzontale (numero di barre e durata).",
    application: [
      "Lo strumento Range Data e Prezzo (Righello) crea un riquadro di misurazione bidimensionale con frecce interne orizzontali e verticali. Mostra in un badge ad alta leggibilità la variazione di prezzo in pips/punti, la variazione percentuale e il numero di barre trascorse.",
      "È ideale per misurare l'ampiezza di un range asiatico, confrontare la profondità di due correzioni o verificare la durata temporale di una fase di accumulazione.",
    ],
    howToDraw: "Seleziona Righello (oppure tieni premuto Shift + Clic sul grafico), fai clic sul punto iniziale e trascina fino al punto finale.",
    settingsOverview: {
      input: "Visualizzazione di pips, percentuale e conteggio barre.",
      style: "Colore del riquadro e opacità di riempimento.",
      coordinates: "Punto iniziale (#1) e punto finale (#2).",
      visibility: "Visibilità per timeframe.",
    },
    proTip: "A differenza del righello temporaneo (Shift+Click), selezionando lo strumento dal menu Misuratori la misurazione rimane salvata sul grafico finché non decidi di rimuoverla.",
    previewKind: "ruler",
  },
  priceRange: {
    id: "priceRange",
    title: "Strumento Range Prezzo (Price Range)",
    breadcrumbTitle: "Strumento range prezzo",
    categoryLabel: "Misuratori",
    summary: "Misuratore verticale dedicato esclusivamente all'escursione di prezzo (variazione assoluta, pips e percentuale) tra due livelli.",
    application: [
      "Lo strumento Range Prezzo isola la componente verticale del movimento, tracciando due barre orizzontali collegate da una freccia verticale centrale. Mostra con chiarezza l'ampiezza in pips/punti e la variazione % tra il livello di partenza e quello di arrivo.",
    ],
    howToDraw: "Fai clic sul primo livello di prezzo (#1) e trascina fino al secondo livello di prezzo (#2).",
    settingsOverview: {
      input: "Mostra variazione in pips e percentuale.",
      style: "Colore frecce/bordi, spessore e opacità dello sfondo.",
      coordinates: "Coordinate #1 e #2.",
      visibility: "Filtro multi-timeframe.",
    },
    proTip: "Perfetto per misurare e lasciare annotata sul grafico l'ampiezza in pips di uno stop o di una gamba di espansione.",
    previewKind: "ruler",
  },
  dateRange: {
    id: "dateRange",
    title: "Strumento Range Data (Date Range)",
    breadcrumbTitle: "Strumento range data",
    categoryLabel: "Misuratori",
    summary: "Misuratore orizzontale dedicato al conteggio delle barre e alla durata temporale tra due eventi sul grafico.",
    application: [
      "Lo strumento Range Data misura la distanza puramente temporale tra due punti sul grafico, evidenziando il numero esatto di candele (barre) e il tempo trascorso (ore/giorni) insieme al volume totale scambiato nell'intervallo.",
    ],
    howToDraw: "Fai clic sulla barra iniziale (#1) e trascina orizzontalmente fino alla barra finale (#2).",
    settingsOverview: {
      input: "Conteggio barre e durata temporale.",
      style: "Colore linee, spessore e opacità dell'area evidenziata.",
      coordinates: "Barra iniziale (#1) e barra finale (#2).",
      visibility: "Filtro multi-timeframe.",
    },
    proTip: "Utilizzalo per studiare la ciclicità temporale delle fasi di consolidamento prima di un'espansione direzionale.",
    previewKind: "ruler",
  },
};
