export interface CockpitSchematic {
  id: string;
  step: 1 | 2 | 3 | 4;
  category: "cycle" | "liquidity" | "scenario" | "trigger" | "area" | "management";
  title: string;
  subtitle: string;
  description: string;
  imageSrc: string;
  fallbackType:
    | "trend_up"
    | "trend_down"
    | "end_up"
    | "end_down"
    | "sweep"
    | "compression"
    | "intermediate"
    | "valid_zone"
    | "no_zone"
    | "reaccum"
    | "itf_schematic"
    | "test"
    | "poc"
    | "jtc"
    | "bti"
    | "area_history"
    | "area_virgin"
    | "be"
    | "tp1"
    | "invalidation";
  keyPoints: string[];
}

export const COCKPIT_SCHEMATICS: Record<string, CockpitSchematic> = {
  // ── STEP 01: CICLI HTF ──
  cycle_up: {
    id: "cycle_up",
    step: 1,
    category: "cycle",
    title: "Impulso / Ciclo Rialzista",
    subtitle: "Legge di Causa ed Effetto · 2/3 Movimenti Daily",
    description: "Ciclo Daily basato sulla Legge di Causa ed Effetto: le cause sono le schematiche di accumulo (box grigi) e gli effetti sono le espansioni di markup (verde). Il ciclo rialzista si compone tipicamente di 2 o 3 movimenti prima del cambio di direzione.",
    imageSrc: "/images/cockpit-schematics/cycle-up.png",
    fallbackType: "trend_up",
    keyPoints: [
      "Grigio = Causa (Schematica di accumulo / re-accumulo)",
      "Verde = Effetto (Espansione / Markup direzionale)",
      "Un ciclo si sviluppa in 2 o 3 movimenti prima del cambio di direzione",
      "Favorisci posizioni long durante la fase di espansione verso i target HTF",
    ],
  },
  cycle_down: {
    id: "cycle_down",
    step: 1,
    category: "cycle",
    title: "Impulso / Ciclo Ribassista",
    subtitle: "Legge di Causa ed Effetto · 2/3 Movimenti Daily",
    description: "Ciclo Daily basato sulla Legge di Causa ed Effetto: le cause sono le schematiche di distribuzione (box grigi) e gli effetti sono le espansioni di markdown (rosso). Il ciclo ribassista si compone tipicamente di 2 o 3 movimenti prima del cambio di direzione.",
    imageSrc: "/images/cockpit-schematics/cycle-down.png",
    fallbackType: "trend_down",
    keyPoints: [
      "Grigio = Causa (Schematica di distribuzione / re-distribuzione)",
      "Rosso = Effetto (Espansione / Markdown ribassista)",
      "Un ciclo si sviluppa in 2 o 3 movimenti prima del cambio di direzione",
      "Favorisci posizioni short durante la fase di espansione verso i target HTF",
    ],
  },
  cycle_end_up: {
    id: "cycle_end_up",
    step: 1,
    category: "cycle",
    title: "Fine Ciclo Rialzista",
    subtitle: "Esaurimento a 2 o 3 Movimenti (Teoria dei Cicli)",
    description: "Come si conclude il ciclo rialzista in teoria: il trend sviluppa 2 o 3 spinte impulsive (onde di markup) verso l'alto prima di esaurire la liquidità e invertire con decisione al ribasso.",
    imageSrc: "/images/cockpit-schematics/cycle-end-up.png",
    fallbackType: "end_up",
    keyPoints: [
      "Variante a 3 movimenti: 3 massimi crescenti prima del climax finale",
      "Variante a 2 movimenti: 2 massimi impulsivi e rapido esaurimento",
      "Freccia di inversione: perdita del momentum e rottura strutturale al ribasso",
      "Regola: non forzare continuazioni long una volta completati i 2/3 movimenti",
    ],
  },
  cycle_end_down: {
    id: "cycle_end_down",
    step: 1,
    category: "cycle",
    title: "Fine Ciclo Ribassista",
    subtitle: "Esaurimento a 2 o 3 Movimenti (Teoria dei Cicli)",
    description: "Come si conclude il ciclo ribassista in teoria: il trend sviluppa 2 o 3 affondi impulsivi (onde di markdown) verso il basso prima di completare la caccia alla liquidità e invertire con decisione al rialzo.",
    imageSrc: "/images/cockpit-schematics/cycle-end-down.png",
    fallbackType: "end_down",
    keyPoints: [
      "Variante a 3 movimenti: 3 minimi decrescenti prima dell'assorbimento finale",
      "Variante a 2 movimenti: 2 affondi impulsivi e rapido esaurimento",
      "Freccia di inversione: reazione decisa e rottura strutturale al rialzo",
      "Regola: non forzare continuazioni short una volta completati i 2/3 movimenti",
    ],
  },

  // ── STEP 01: STRUTTURA LIQUIDITÀ HTF ──
  liq_swept: {
    id: "liq_swept",
    step: 1,
    category: "liquidity",
    title: "Liquidity Swept (Caccia Avvenuta)",
    subtitle: "Estremo cacciato con rifiuto confermato",
    description: "Il prezzo ha spazzato gli stop oltre un estremo chiave (es. Asian Low/High, Previous Day High/Low) ed è rientrato rapidamente.",
    imageSrc: "/images/cockpit-schematics/liq-swept.png",
    fallbackType: "sweep",
    keyPoints: [
      "Caccia agli stop completata oltre un livello chiave",
      "Rapido rifiuto e riassorbimento all'interno del range",
      "Setup ad alta probabilità verso il pool opposto",
    ],
  },
  liq_compression: {
    id: "liq_compression",
    step: 1,
    category: "liquidity",
    title: "Liquidità Sopra e Sotto (Compressione)",
    subtitle: "Compressione attiva · Nessun ingresso",
    description: "Prezzo intrappolato all'interno di un range stretto con equal highs sopra ed equal lows sotto. Volatilità compressa.",
    imageSrc: "/images/cockpit-schematics/liq-compression.png",
    fallbackType: "compression",
    keyPoints: [
      "Range stretto e candele sovrapposte",
      "Nessun estremo ancora cacciato",
      "Regola Limen: disciplina assoluta, zero trade fino allo sweep",
    ],
  },
  liq_intermediate: {
    id: "liq_intermediate",
    step: 1,
    category: "liquidity",
    title: "Zona Estrema Non Raggiunta",
    subtitle: "Box Intermedi di Continuazione (Causa 2)",
    description: "Il prezzo consolida a metà del range all'interno di un box intermedio (CAUSA 2) appoggiandosi sulla fascia della Causa 1, prima di estendere la spinta verso nuovi massimi/minimi.",
    imageSrc: "/images/cockpit-schematics/liq-intermediate.png",
    fallbackType: "intermediate",
    keyPoints: [
      "Transizione tra CAUSA 1 e il target finale attraverso la CAUSA 2",
      "Appoggio ordinato sulla fascia grigia precedente",
      "Favorisci trigger JTC verso la nuova violenta espansione",
    ],
  },

  // ── STEP 02: SCENARI ITF ──
  scenario_valid_zone: {
    id: "scenario_valid_zone",
    step: 2,
    category: "scenario",
    title: "Zona HTF Toccata e Mitigata",
    subtitle: "Reazione a POI / FVG / Order Block",
    description: "Il mercato ha raggiunto e mitigato una zona istituzionale di rilievo. Si cerca un'inversione solo a schematica ITF confermata.",
    imageSrc: "/images/cockpit-schematics/scenario-valid-zone.png",
    fallbackType: "valid_zone",
    keyPoints: [
      "Mitigazione precisa di un blocco d'ordine o FVG HTF",
      "Reazione volumetrica con creazione di nuovo swing",
      "Attendi rottura strutturale (CHoCH) su M15",
    ],
  },
  scenario_no_zone: {
    id: "scenario_no_zone",
    step: 2,
    category: "scenario",
    title: "Solo Liquidità (Nessuna Zona HTF)",
    subtitle: "Sweep isolato o breakout continuativo",
    description: "Nessuna zona HTF mitigata a monte: il movimento è guidato unicamente dalla caccia alla liquidità o dal trend aperto.",
    imageSrc: "/images/cockpit-schematics/scenario-no-zone.png",
    fallbackType: "no_zone",
    keyPoints: [
      "Nessun POI istituzionale alle spalle",
      "Solo continuazione trend, BTI o JTC",
      "Evita reversal forzati senza struttura d'appoggio",
    ],
  },
  scenario_reaccum: {
    id: "scenario_reaccum",
    step: 2,
    category: "scenario",
    title: "Re-accumuli / Ri-distribuzioni (Causa 2)",
    subtitle: "Sequenza CAUSA 1 → 1° Movimento → CAUSA 2 → 2° Movimento HTF",
    description: "Fase di ricarica strutturale Wyckoff (Causa 2): dopo la CAUSA 1 (Distribuzione/Accumulazione primaria) e il 1° movimento direzionale fino al livello 10%, il prezzo forma una CAUSA 2 interna (redistribuzione o riaccumulo con BC, AR, ST, UT, UTAD e Test) per estendere il 2° movimento HTF verso i pool di liquidità opposti.",
    imageSrc: "/images/cockpit-schematics/scenario-reaccum.png",
    fallbackType: "reaccum",
    keyPoints: [
      "CAUSA 1: schematica primaria con BC/SC, AR, ST, UT/UTAD o Spring e test",
      "1° Espansione: movimento impulsivo fino al livello 10% SOW/SOS",
      "CAUSA 2: ricarica volumetrica interna (redistribuzione/riaccumulo)",
      "2° Movimento HTF: estensione finale verso il target istituzionale di fine ciclo",
    ],
  },
  itf_schematic: {
    id: "itf_schematic",
    step: 2,
    category: "scenario",
    title: "Schematica M15 Valida (Wyckoff Geometria)",
    subtitle: "BC/SC, AR, ST, JTC, UT/UTAD o Spring, Test su Ombra e 10%",
    description: "Schematica M15 istituzionale: in distribuzione si articola in Buying Climax (BC), Automatic Reaction (AR), Secondary Test (ST), corridoio JTC tra AR e minimo interno, Upthrust (UT), UTAD (massimo assoluto), zona di TEST ancorata sull'ombra/corpo di UT e 1° Markdown verso il 10% SOW.",
    imageSrc: "/images/cockpit-schematics/itf-schematic.png",
    fallbackType: "itf_schematic",
    keyPoints: [
      "Struttura BC -> AR -> ST -> JTC -> UT -> UTAD confermata",
      "Zona di TEST ancorata sull'ombra/livello di UT (in presenza di UTAD)",
      "Corridoio JTC compreso tra AR e il minimo interno/10%",
      "Transizione da Causa 1 a Causa 2 per il 2° Markdown HTF",
    ],
  },

  // ── STEP 03: TRIGGER LTF ──
  trigger_test: {
    id: "trigger_test",
    step: 3,
    category: "trigger",
    title: "Trigger: TEST",
    subtitle: "Re-test del livello di rottura (visibile su schematica)",
    description: "Re-test pulito del livello appena violato (dopo Upthrust/rottura strutturale). Ingresso sul rigetto confermato con stop stretto.",
    imageSrc: "/images/cockpit-schematics/trigger-test.png",
    fallbackType: "test",
    keyPoints: [
      "Livello rotto testato come resistenza/supporto",
      "Zona viola 'test' identificata con precisione",
      "Ingresso sulla candela di rifiuto a basso rischio",
    ],
  },
  trigger_poc: {
    id: "trigger_poc",
    step: 3,
    category: "trigger",
    title: "Trigger: POC",
    subtitle: "Re-test della linea rossa del Point of Control",
    description: "Come visibile dal Volume Profile a grafico: il prezzo ritraccia esattamente sulla linea orizzontale rossa del POC (4.352 e 4.315) e viene respinto con ombra di assorbimento, innescando l'impulso direzionale.",
    imageSrc: "/images/cockpit-schematics/trigger-poc.png",
    fallbackType: "poc",
    keyPoints: [
      "Istogramma volumetrico orizzontale (Fixed Range Volume Profile)",
      "Re-test millimetrico sulla linea rossa del POC con ombra di rigetto",
      "Assorbimento istituzionale e discesa rapida verso il target",
      "Stop loss chirurgico subito oltre il cluster volumetrico",
    ],
  },
  trigger_jtc: {
    id: "trigger_jtc",
    step: 3,
    category: "trigger",
    title: "Trigger: JTC (Join The Current)",
    subtitle: "Zona viola 'JTC' sul retest della fascia",
    description: "Come mostrato nel grafico (CAUSA 1 e CAUSA 2): ingresso 'JTC' (in viola) sul test controllato della fascia grigia, posizionandosi a favore del flusso istituzionale prima dell'esplosione direzionale.",
    imageSrc: "/images/cockpit-schematics/trigger-jtc.png",
    fallbackType: "jtc",
    keyPoints: [
      "Ingresso sulla zona 'JTC' evidenziata all'interno del box",
      "Appoggio sulla fascia grigia di transizione",
      "Espansione verso la Causa 2 e continuazione fluida del trend",
    ],
  },
  trigger_bti: {
    id: "trigger_bti",
    step: 3,
    category: "trigger",
    title: "Trigger: BTI (Breakout Through Imbalance)",
    subtitle: "Rottura impulsiva con imbalance (zona BTI)",
    description: "Zona viola 'BTI' sulla schematica: rottura impulsiva che squarcia il livello creando imbalance. Ingresso tempestivo in corsa verso il target.",
    imageSrc: "/images/cockpit-schematics/trigger-bti.png",
    fallbackType: "bti",
    keyPoints: [
      "Candela ad alto range che squarcia l'imbalance",
      "Zona 'BTI' confermata con sbilanciamento volumetrico",
      "Ingresso in continuazione fluida verso il minimo del ciclo",
    ],
  },

  // ── STEP 03: TIPO AREA ──
  area_history: {
    id: "area_history",
    step: 3,
    category: "area",
    title: "Storia Passata",
    subtitle: "Mitigazione della fascia grigia precedente",
    description: "La fascia grigia intermedia rappresenta una zona storica: il prezzo ritraccia, mitiga la struttura passata, la valida come supporto e decolla con l'operazione long.",
    imageSrc: "/images/cockpit-schematics/area-history.png",
    fallbackType: "area_history",
    keyPoints: [
      "Fascia grigia: livello di swing precedentemente testato",
      "Re-test controllato e assorbimento della liquidità residua",
      "Operazione long impostata con stop a protezione della fascia",
    ],
  },
  area_virgin: {
    id: "area_virgin",
    step: 3,
    category: "area",
    title: "Area Vergine (Imbalance)",
    subtitle: "Inefficienza volumetrica / FVG aperto",
    description: "Come evidenziato dalla freccia e dall'impulso a candele piene: la spinta iniziale crea un'area vergine con imbalance non colmato. Il prezzo rispetta l'inefficienza e accelera con forza.",
    imageSrc: "/images/cockpit-schematics/area-virgin.png",
    fallbackType: "area_virgin",
    keyPoints: [
      "Freccia orizzontale: delimitazione dell'imbalance aperto",
      "Espansione ad alto momentum senza sovrapposizione di corpi candela",
      "Reattività immediata verso i massimi",
    ],
  },

  // ── STEP 04: GESTIONE TRADE ──
  mgmt_be: {
    id: "mgmt_be",
    step: 4,
    category: "management",
    title: "Stop a Pareggio (Breakeven)",
    subtitle: "Regola Limen: Almeno 1 : 1.5 R:R su presa di liquidità",
    description: "Regola metodologica Limen Protocol: lo stop loss non va mai anticipato a BE prematuramente. Lo spostamento a Pareggio (BE) deve avvenire solo ad almeno 1 : 1.5 di Rischio/Rendimento su una presa di liquidità confermata.",
    imageSrc: "/images/cockpit-schematics/mgmt-be.png",
    fallbackType: "be",
    keyPoints: [
      "Regola Limen: Spostamento a BE solo dopo almeno 1 : 1.5 R:R",
      "Condizione necessaria: Avvenuta presa di liquidità intermedia",
      "Evita di farti buttare fuori dal rumore o dai pullback fisiologici",
      "Preserva l'aspettativa matematica proteggendo il capitale",
    ],
  },
  mgmt_tp1: {
    id: "mgmt_tp1",
    step: 4,
    category: "management",
    title: "Presa Parziale (TP1) & Target Liquidità",
    subtitle: "Primo parziale a 1 : 3 R:R · Altrimenti alla liquidità",
    description: "Regola metodologica Limen Protocol: il primo parziale, se va preso, va preso tassativamente sul rapporto Rischio/Rendimento di 1 : 3; altrimenti la posizione si mantiene integra puntando direttamente al pool di liquidità principale.",
    imageSrc: "/images/cockpit-schematics/mgmt-tp1.png",
    fallbackType: "tp1",
    keyPoints: [
      "Regola Limen: Primo parziale preso esclusivamente sul rapporto 1 : 3 di R:R",
      "Alternativa rigorosa: Se non si monetizza a 1 : 3, si punta direttamente al pool di liquidità",
      "Nessun parziale prematuro sotto a 1 : 3 per preservare l'aspettativa matematica",
      "Garantisce asimmetria statistica favorevole nel lungo periodo",
    ],
  },
  mgmt_invalidation: {
    id: "mgmt_invalidation",
    step: 4,
    category: "management",
    title: "Invalidazione Schematica",
    subtitle: "Uscita anticipata per perdita di validità",
    description: "Se la schematica d'ingresso viene violata prima del raggiungimento dello stop loss completo, esci subito a mercato.",
    imageSrc: "/images/cockpit-schematics/mgmt-invalidation.png",
    fallbackType: "invalidation",
    keyPoints: [
      "Chiusura contraria oltre lo swing di invalidazione",
      "Risparmio prezioso di pip/punti sul rischio massimo",
      "Disciplina totale: il mercato ha negato la tesi",
    ],
  },
};

export function getCockpitSchematic(id: string): CockpitSchematic | undefined {
  return COCKPIT_SCHEMATICS[id];
}
