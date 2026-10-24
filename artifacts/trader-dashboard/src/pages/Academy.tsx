import { useEffect, useState, useMemo } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Play,
  Shield,
  CheckCircle2,
  Download,
  Copy,
  Check,
  BookOpen,
  Layers,
  ChevronRight,
  ArrowRight,
  AlertTriangle,
  Lock,
  FlaskConical,
  Compass,
  Award,
  Plus,
  Terminal,
} from "lucide-react";
import { PageLayout } from "@/components/PageLayout";
import { useLimenEntitlements } from "@/hooks/useLimenEntitlements";
import { LimenServiceLockGate } from "@/components/candidacy/LimenServiceLockGate";
import { SectionTabs, type SectionTab } from "@/components/SectionTabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { academyText, type AcademyCopyKey } from "@/lib/academyCopy";
import * as api from "@/lib/academyApi";
import { validAcademyReferral } from "@/lib/academyReferral";


import {
  type AcademySyllabusItem,
} from "../../../../contracts/academy";
import LandingPage from "./LandingPage";
import { AcademyVideoUpload, ManagedLessonVideo } from "@/components/academy/AcademyVideoUpload";
import { GeneralsBooksReader } from "@/components/academy/GeneralsBooksReader";
import { getLimenSessionInfo } from "@/lib/limenSession";
import { useGetProfile } from "@workspace/api-client-react";
import "./academy.css";

// ─── Canonical Master Data: I Canoni Operativi (Nomenclatura Sovrana LIMEN) ───

export interface CanoneTransmission {
  id: string;
  code: string;
  title: string;
  duration: string;
  timeframe: string;
  summary: string;
  keyDirectives: string[];
  fatalErrors: string[];
  isFreePreview: boolean;
  videoSrc: string;
  streamVideoId?: string | null;
  videoEmbedUrl?: string | null;
  forgiaHint: {
    pair: string;
    timeframe: string;
    notes: string;
  };
}

export interface CanoneGroup {
  id: string;
  roman: string;
  title: string;
  subtitle: string;
  timeframe: string;
  totalDuration: string;
  transmissions: CanoneTransmission[];
}

export const CANONI_MASTER_DATA: CanoneGroup[] = [
  {
    id: "canone-0",
    roman: "CANONE 0",
    title: "L'Anatomia dell'Invalidazione",
    subtitle: "La Meccanica del Prezzo e la Sopravvivenza Statistica",
    timeframe: "M15 → M1",
    totalDuration: "33 min · 2 trasmissioni",
    transmissions: [
      {
        id: "c0-t1",
        code: "0.1",
        title: "Anatomia dello Sweep di Liquidità Istituzionale e Bias Direzionale",
        duration: "18:42",
        timeframe: "M15 / H1",
        summary:
          "Scomposizione chirurgica della presa di liquidità sopra i massimi e minimi di sessione. Perché i trader retail vengono sistematicamente intrappolati dai market maker e come identificare l'impronta reale del grande capitale.",
        keyDirectives: [
          "Lo sweep non è un'inversione garantita: è la condizione necessaria ma NON sufficiente per l'ingaggio.",
          "Verificare sempre che lo sweep si manifesti all'interno della Kill-Zone temporale (London 08:00–10:30 UTC o NY 13:30–16:00 UTC).",
          "Se il prezzo chiude con corpo candela solido oltre il livello, lo sweep è INVALIDATO (si tratta di espansione reale).",
        ],
        fatalErrors: [
          "Inseguire il prezzo sul breakout impulsivo prima che la candela M15 si chiuda.",
          "Entrare senza aver identificato chiaramente da dove è stata estratta la liquidità.",
        ],
        isFreePreview: true,
        videoSrc: "/videos/limen-v2-act1.mp4",
        forgiaHint: {
          pair: "EURUSD",
          timeframe: "M15",
          notes: "Cerca lo sweep del PDH alle 09:15 UTC e verifica se la candela chiude all'interno del range.",
        },
      },
      {
        id: "c0-t2",
        code: "0.2",
        title: "La Regola di Invalidazione Matematica: Quando il Setup è Morto",
        duration: "14:50",
        timeframe: "M15 → M1",
        summary:
          "Criteri rigidi e oggettivi per abbandonare un'idea prima ancora di toccare lo Stop Loss. Come eliminare del tutto le speranze e i bias emotivi dai mercati finanziari.",
        keyDirectives: [
          "Invalidazione Temporale: se l'impulso atteso non si manifesta entro 3 candele M15 dopo il trigger M1, chiudere il trade a pareggio.",
          "Invalidazione Strutturale: la violazione del minimo di swing precedente annulla istantaneamente il setup long.",
          "Nessuna aggiunta su posizioni in perdita: mai mediare un'entrata contro-trend.",
        ],
        fatalErrors: [
          "Spostare lo stop loss all'indietro per evitare di accettare l'errore di valutazione.",
          "Restare a mercato dopo che la finestra temporale della Kill-Zone si è chiusa.",
        ],
        isFreePreview: true,
        videoSrc: "/videos/limen-v2-act2.mp4",
        forgiaHint: {
          pair: "GBPUSD",
          timeframe: "M5",
          notes: "Identifica un setup invalidato entro 3 candele M15 e calcola il capitale preservato grazie all'uscita precoce.",
        },
      },
    ],
  },
  {
    id: "canone-1",
    roman: "CANONE I",
    title: "La Cartografia della Liquidità HTF",
    subtitle: "Identificazione dei Punti di Interesse Reali (Daily · H4 · H1)",
    timeframe: "Daily → H4 → H1",
    totalDuration: "1h 45m · 4 trasmissioni",
    transmissions: [
      {
        id: "c1-t1",
        code: "I.1",
        title: "Cartografia della Liquidità: BSL (Buy-Side) vs SSL (Sell-Side)",
        duration: "24:10",
        timeframe: "Daily / H4",
        summary:
          "Mappatura dei pool di ordini pendenti lasciati dagli operatori retail sopra i massimi e minimi di riferimento (PDH, PDL, PWH, PWL).",
        keyDirectives: [
          "Tracciare i livelli estremi del giorno e della settimana precedente prima dell'apertura europea.",
          "Considerare il centro del range come mero rumore statistico privo di vantaggio asimmetrico.",
        ],
        fatalErrors: ["Cercare setup nel mezzo del range giornaliero."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act1.mp4",
        forgiaHint: { pair: "EURUSD", timeframe: "H1", notes: "Mappa BSL/SSL della sessione asiatica." },
      },
      {
        id: "c1-t2",
        code: "I.2",
        title: "Premium vs Discount Pricing: Il Filtro 50% Equilibrium",
        duration: "28:30",
        timeframe: "H4 / H1",
        summary:
          "Misurazione matematica dell'equilibrio del range. Divieto assoluto di acquisto in zona Premium e di vendita in zona Discount.",
        keyDirectives: [
          "Applicare il ritracciamento 50% dal minimo al massimo del macro-impulso.",
          "Gli acquisti istituzionali si concentrano solo sotto il 50% dell'Equilibrium.",
        ],
        fatalErrors: ["Comprare vicino ai massimi credendo nella prosecuzione infinita."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act2.mp4",
        forgiaHint: { pair: "XAUUSD", timeframe: "H4", notes: "Applica il filtro 50% sul range settimanale." },
      },
      {
        id: "c1-t3",
        code: "I.3",
        title: "Order Block Istituzionali Validi vs Zone Mitigate",
        duration: "26:15",
        timeframe: "H1 / M15",
        summary:
          "Come distinguere una zona ancora carica di ordini algoritmici da un blocco già svuotato e riassorbito.",
        keyDirectives: [
          "Un Order Block è valido solo se ha generato un disequilibrio netto (FVG) e ha violato una struttura precedente.",
          "Se il prezzo è già tornato al 50% dell'Order Block, la zona è MITIGATA e non va riutilizzata.",
        ],
        fatalErrors: ["Riutilizzare vecchi Order Block già testati più volte."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act3.mp4",
        forgiaHint: { pair: "GBPUSD", timeframe: "H1", notes: "Identifica un blocco mitigato vs vergine." },
      },
      {
        id: "c1-t4",
        code: "I.4",
        title: "Costruzione del Bias Giornaliero e Flusso di Liquidità",
        duration: "26:05",
        timeframe: "Daily",
        summary:
          "Dichiarazione scritta dello scenario operativo prima dell'apertura dei mercati per non cadere in balia delle oscillazioni intraday.",
        keyDirectives: [
          "Definire l'obiettivo di liquidità attrattiva (Draw on Liquidity) della sessione odierna.",
          "Se il bias non è netto e confermato su Daily/H4, dichiarare la sessione di pura osservazione.",
        ],
        fatalErrors: ["Cambiare idea a metà sessione per assecondare candele al minuto."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act4.mp4",
        forgiaHint: { pair: "EURUSD", timeframe: "Daily", notes: "Dichiara il Draw on Liquidity per 5 giorni consecutivi." },
      },
    ],
  },
  {
    id: "canone-2",
    roman: "CANONE II",
    title: "Il Punto di Svolta (SMC & Order Flow)",
    subtitle: "Filtri di Inversione e Cambio di Carattere ITF (M15 · H1)",
    timeframe: "M15 → H1",
    totalDuration: "1h 35m · 4 trasmissioni",
    transmissions: [
      {
        id: "c2-t1",
        code: "II.1",
        title: "Fair Value Gap (FVG) e Disequilibri di Volume Istituzionale",
        duration: "22:40",
        timeframe: "M15",
        summary:
          "Rilevazione dei vuoti di liquidità lasciati dall'azione a senso unico dei market maker. Perché il prezzo ritorna a colmare l'inefficienza.",
        keyDirectives: [
          "Un FVG valido si compone di 3 candele con mancata sovrapposizione tra le ombre della 1ª e della 3ª.",
          "Utilizzare la soglia mediana del gap (Consequent Encroachment) come livello primario di reazione.",
        ],
        fatalErrors: ["Considerare ogni piccolo spazio tra candele come FVG significativo."],
        isFreePreview: false,
        videoSrc: "/videos/limen-v2-act3.mp4",
        forgiaHint: { pair: "NAS100", timeframe: "M15", notes: "Testa la reazione al Consequent Encroachment." },
      },
      {
        id: "c2-t2",
        code: "II.2",
        title: "Rottura Strutturale vs Falso Breakout (MSS vs Liquidity Grab)",
        duration: "25:15",
        timeframe: "M15",
        summary:
          "Distinzione rigorosa tra una vera inversione di carattere (Market Structure Shift) e una banale esca per intrappolare il retail.",
        keyDirectives: [
          "Un MSS reale richiede chiusura netta con corpo candela oltre l'ultimo swing point interno.",
          "La rottura deve essere accompagnata da una candela di Displacement con FVG a supporto.",
        ],
        fatalErrors: ["Entrare su semplice violazione dell'ombra (wick) senza chiusura solida."],
        isFreePreview: false,
        videoSrc: "/videos/limen-v2-act4.mp4",
        forgiaHint: { pair: "EURUSD", timeframe: "M15", notes: "Confronta un falso breakout con un MSS confermato." },
      },
      {
        id: "c2-t3",
        code: "II.3",
        title: "Kill-Zone Temporali: Sincronizzazione Londra e New York",
        duration: "20:30",
        timeframe: "Orari Rigidi",
        summary:
          "La scansione algoritmica degli orari. Perché il tempo batte il prezzo e come allineare la propria presenza unicamente durante le aperture.",
        keyDirectives: [
          "London Kill-Zone: 08:00 – 10:30 UTC.",
          "New York Kill-Zone: 13:30 – 16:00 UTC.",
          "Fuori da queste finestre l'operatività a mercato è SEVERAMENTE VIETATA.",
        ],
        fatalErrors: ["Operare durante la pausa pranzo europea o prima delle ore 08:00."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act1.mp4",
        forgiaHint: { pair: "GBPUSD", timeframe: "M5", notes: "Evidenzia solo i movimenti nati dentro la Kill-Zone." },
      },
      {
        id: "c2-t4",
        code: "II.4",
        title: "Algoritmo di Erogazione del Prezzo (IPDA) e OTE (Optimal Trade Entry)",
        duration: "27:10",
        timeframe: "M15 / M5",
        summary:
          "Misurazione dei livelli di sconto ottimali compresi tra il 61.8% e il 79% del ritracciamento per massimizzare il rendimento asimmetrico.",
        keyDirectives: [
          "Attendere il test del box OTE in confluenza con un FVG non mitigato.",
          "Nessun ingresso prima che il ritracciamento abbia superato la soglia del 61.8%.",
        ],
        fatalErrors: ["Comprare a metà ritracciamento senza attendere il livello OTE."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act2.mp4",
        forgiaHint: { pair: "EURUSD", timeframe: "M5", notes: "Trova 3 casi di OTE confluenti con FVG." },
      },
    ],
  },
  {
    id: "canone-3",
    roman: "CANONE III",
    title: "Il Sigillo d'Azione (Trigger & Esecuzione)",
    subtitle: "Convergenza al Minuto ed Esecuzione Chirurgica (M1 · M5)",
    timeframe: "M1 → M5",
    totalDuration: "1h 17m · 4 trasmissioni",
    transmissions: [
      {
        id: "c3-t1",
        code: "III.1",
        title: "Ingresso Chirurgico su Rifiuto dell'Inefficienza M1",
        duration: "19:50",
        timeframe: "M1",
        summary:
          "Discesa sui timeframe al minuto solo dopo la validazione HTF e ITF. Riconoscimento del micro-sweep per ridurre il rischio a pochi pip.",
        keyDirectives: [
          "Non scendere mai su M1 se il contesto M15 non ha convalidato lo sweep e l'MSS.",
          "L'ordine si piazza sul ritracciamento del primo micro-FVG nato dopo il trigger.",
        ],
        fatalErrors: ["Cercare setup su M1 senza allineamento con Daily e H1."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act3.mp4",
        forgiaHint: { pair: "EURUSD", timeframe: "M1", notes: "Esegui il trigger M1 solo dopo conferma su M15." },
      },
      {
        id: "c3-t2",
        code: "III.2",
        title: "Stop Loss Matematico: Posizionamento Oltre l'Ultimo Sweep",
        duration: "17:25",
        timeframe: "M1 / M5",
        summary:
          "Calcolo dell'invalidazione millimetrica: lo Stop Loss protegge l'ordine ponendosi oltre il massimo/minimo dello sweep istituzionale.",
        keyDirectives: [
          "Lo stop non è negoziabile: dista tra 2.5 e 5 pips oltre il livello di invalidazione.",
          "Se il prezzo oltrepassa lo stop, la tesi operativa è fallace e va abbandonata senza rimpianti.",
        ],
        fatalErrors: ["Allargare lo stop loss durante il trade."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act4.mp4",
        forgiaHint: { pair: "GBPUSD", timeframe: "M1", notes: "Calcola la dimensione della posizione per rischiare max 1%." },
      },
      {
        id: "c3-t3",
        code: "III.3",
        title: "Rapporto Rischio/Rendimento (RR) Minimo 1:3 e Gestione Asimmetrica",
        duration: "21:10",
        timeframe: "Matematica Pura",
        summary:
          "Come strutturare l'operatività in modo che anche un win rate del 40% generi espansione patrimoniale solida e costante nel tempo.",
        keyDirectives: [
          "Rifiutare a priori qualunque trade con target inferiore a 3 volte il rischio iniziale (1:3 R).",
          "Proteggere la posizione a Pareggio (Break Even) al raggiungimento del target intermedio 1:2 R.",
        ],
        fatalErrors: ["Accontentarsi di prendere 1:1 R per paura di veder ritracciare il prezzo."],
        isFreePreview: false,
        videoSrc: "/videos/limen-v2-act1.mp4",
        forgiaHint: { pair: "NAS100", timeframe: "M5", notes: "Filtra solo setup con potenziale 1:3 R verificato." },
      },
      {
        id: "c3-t4",
        code: "III.4",
        title: "Esecuzione a Mercato vs Ordini Limite: Eliminare lo Slippage",
        duration: "18:45",
        timeframe: "Esecuzione",
        summary:
          "Scelta tra ordini Limit e ordini Market. Come sfruttare la liquidità passiva per azzerare i costi impliciti e le commissioni di esecuzione.",
        keyDirectives: [
          "Prediligere ordini Limit impostati sul 50% del Fair Value Gap M1.",
          "Evitare ingressi a mercato durante i primi 5 minuti di rilascio di notizie macro ad alto impatto.",
        ],
        fatalErrors: ["Cliccare market per FOMO durante una candela in forte accelerazione."],
        isFreePreview: false,
        videoSrc: "/videos/limen-v2-act2.mp4",
        forgiaHint: { pair: "EURUSD", timeframe: "M1", notes: "Piazza un ordine limite sull'ingresso dell'inefficienza." },
      },
    ],
  },
  {
    id: "canone-4",
    roman: "CANONE IV",
    title: "Il Governo della Posizione & Target Sovrano",
    subtitle: "Dalla Presa di Profitto alla Difesa Rigorosa del Capitale",
    timeframe: "Gestione Attiva",
    totalDuration: "1h 29m · 4 trasmissioni",
    transmissions: [
      {
        id: "c4-t1",
        code: "IV.1",
        title: "Strategia di Uscita Parziale e Break Even Meccanico",
        duration: "23:15",
        timeframe: "Regole Rigide",
        summary:
          "Sistematizzare la monetizzazione del profitto: incasso parziale al primo liquidity pool e de-risking immediato della restante posizione.",
        keyDirectives: [
          "Liquidare il 50% al raggiungimento di 1:2 R e spostare lo Stop Loss a Breakeven (+0 pips).",
          "Lasciare correre il restante 50% verso il Target Sovrano senza più alcun rischio di perdita patrimoniale.",
        ],
        fatalErrors: ["Lasciare correre l'intera posizione senza prendere parziali su livelli chiave."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act1.mp4",
        forgiaHint: { pair: "EURUSD", timeframe: "M15", notes: "Verifica l'esito di un trade gestito a Break Even." },
      },
      {
        id: "c4-t2",
        code: "IV.2",
        title: "Target Sovrano: Liquidità Opposta e Livelli di Confluenza",
        duration: "25:40",
        timeframe: "H1 / Daily",
        summary:
          "Identificare l'esatto punto d'arrivo dove i compratori/venditori opposti dovranno ricoprirsi, garantendo la massima estensione del trade.",
        keyDirectives: [
          "Posizionare il Take Profit finale subito prima dell'opposto pool di Buy-Side o Sell-Side Liquidity.",
          "Non pretendere di prendere l'ultimo pip di estensione: uscire con liquidità abbondante.",
        ],
        fatalErrors: ["Chiudere il trade prima del target per ansia da prestazione."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act2.mp4",
        forgiaHint: { pair: "GBPUSD", timeframe: "H1", notes: "Traccia il target sull'estremo opposto del range." },
      },
      {
        id: "c4-t3",
        code: "IV.3",
        title: "La Regola delle 3 Candele: Chiusura Anticipata per Mancanza di Momentum",
        duration: "16:30",
        timeframe: "M15",
        summary:
          "La salvaguardia del tempo: se il trade non sviluppa espansione entro 3 candele dal trigger, la probabilità volge contro l'operatore.",
        keyDirectives: [
          "Se dopo 45 minuti (3 candele M15) il prezzo ristagna nell'area di ingresso, chiudere la posizione.",
          "Non accettare la congestione prolungata all'interno della Kill-Zone.",
        ],
        fatalErrors: ["Rimanere ore in stallo sperando che il mercato si muova."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act3.mp4",
        forgiaHint: { pair: "EURUSD", timeframe: "M15", notes: "Conta le candele dall'ingresso e osserva il decadimento temporale." },
      },
      {
        id: "c4-t4",
        code: "IV.4",
        title: "Psicologia del Rischio: Dominare la Paura di Perdere e l'Euforia",
        duration: "24:20",
        timeframe: "Assetto Interiore",
        summary:
          "La stoica accettazione dell'incertezza. Come separare il proprio valore personale dall'esito estemporaneo di un singolo trade.",
        keyDirectives: [
          "Accettare che una serie di 3 perdite rientra nella normale varianza statistica del protocollo.",
          "Rispettare il massimo di 2 esecuzioni giornaliere: al secondo stop loss, spegnere la piattaforma.",
        ],
        fatalErrors: ["Fare revenge trading per recuperare una perdita subita nella sessione."],
        isFreePreview: false,
        videoSrc: "/videos/limen-act4.mp4",
        forgiaHint: { pair: "TUTTI", timeframe: "Diario", notes: "Registra ogni emozione ne Il Libro della Verità." },
      },
    ],
  },
  {
    id: "canone-5",
    roman: "CANONE V",
    title: "L'Arte del Duello & L'Arte dell'Assedio",
    subtitle: "I Due Protocolli Operativi di LIMEN: Scalp ad Alta Frequenza e Swing Macro",
    timeframe: "M1 vs Daily",
    totalDuration: "1h 56m · 4 trasmissioni",
    transmissions: [
      {
        id: "c5-t1",
        code: "V.1",
        title: "Protocollo Scalp: Duello ad Alta Frequenza in 45 Minuti di Kill-Zone",
        duration: "31:10",
        timeframe: "M1 / M5",
        summary:
          "La routine dell'affondo rapido: come operare esclusivamente nella prima ora di apertura, monetizzare e liberare la mente per il resto del giorno.",
        keyDirectives: [
          "Presenza attiva solo tra le 08:30 e le 09:30 UTC per Londra, o tra le 14:00 e le 15:00 UTC per New York.",
          "Obiettivo: 1 sola operazione chirurgica ad alta precisione con rapporto minimo 1:3 R.",
        ],
        fatalErrors: ["Trattare lo scalp come un'attività da svolgere tutto il giorno davanti al monitor."],
        isFreePreview: false,
        videoSrc: "/videos/limen-v2-act1.mp4",
        forgiaHint: { pair: "NAS100", timeframe: "M1", notes: "Applica il Protocollo Scalp tra le 15:30 e le 16:30 CET." },
      },
      {
        id: "c5-t2",
        code: "V.2",
        title: "Protocollo Swing: L'Assedio Paziente dei Grandi Cicli Macro",
        duration: "34:25",
        timeframe: "Daily / H4",
        summary:
          "La padronanza della pazienza: posizionarsi sui grandi flussi settimanali e mensili senza subire il rumore intraday.",
        keyDirectives: [
          "Analisi solo a chiusura di candela H4 e Daily: 2 soli controlli al giorno da 10 minuti.",
          "Target macro estesi fino a 1:8 R con posizioni gestite per giorni o settimane.",
        ],
        fatalErrors: ["Guardare il grafico al minuto mentre si è posizionati in un'operazione Swing."],
        isFreePreview: false,
        videoSrc: "/videos/limen-v2-act2.mp4",
        forgiaHint: { pair: "EURUSD", timeframe: "Daily", notes: "Traccia la struttura macro dei minimi trimestrali." },
      },
      {
        id: "c5-t3",
        code: "V.3",
        title: "Transizione tra i Protocolli: Come Scegliere in Base al Ciclo di Vita",
        duration: "22:50",
        timeframe: "Stile di Vita",
        summary:
          "Adattare il metodo al proprio stile di vita professionale e familiare, garantendo che il trading sia servitore e non padrone della propria esistenza.",
        keyDirectives: [
          "Chi lavora full-time deve adottare esclusivamente il Protocollo Swing o la sola Kill-Zone New York serale.",
          "Non forzare mai sessioni di scalping quando la mente è affaticata o deconcentrata.",
        ],
        fatalErrors: ["Cercare di fare scalp sul telefono cellulare durante le ore lavorative."],
        isFreePreview: false,
        videoSrc: "/videos/limen-v2-act3.mp4",
        forgiaHint: { pair: "TUTTI", timeframe: "Profilo", notes: "Compila l'allocazione temporale nelle impostazioni." },
      },
      {
        id: "c5-t4",
        code: "V.4",
        title: "La Conclusione dell'Addestramento: Dalla Dottrina al Libro della Verità",
        duration: "28:15",
        timeframe: "Consacrazione",
        summary:
          "La sintesi finale: come trasferire ogni insegnamento all'interno del Diario Operativo e scalare i 5 Gradi di Ascesa per merito e integrità.",
        keyDirectives: [
          "Nessun grado superiore viene sbloccato senza il 100% di Indice di Integrità verificato.",
          "La Dottrina è il faro; Il Libro della Verità è lo specchio del tuo valore reale.",
        ],
        fatalErrors: ["Dimenticare di registrare una sessione ne Il Libro della Verità."],
        isFreePreview: false,
        videoSrc: "/videos/limen-v2-act4.mp4",
        forgiaHint: { pair: "TUTTI", timeframe: "Integrità", notes: "Mantieni 30 sessioni consecutive al 100% di integrità." },
      },
    ],
  },
];

function useCopy() {
  const { language } = useLanguage();
  return (key: AcademyCopyKey) => academyText(language, key);
}

function useAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => client.invalidateQueries({ queryKey: api.academyKeys.all }),
    meta: { suppressGlobalError: true },
  });
}

export function AcademyWelcome() {
  return <LandingPage />;
}

// ─── Main Component: La Dottrina del Tempo ─────────────────────────────────────

export default function Academy() {
  const _c = useCopy();
  const search = useSearch();
  const [, navigate] = useLocation();
  const { entitlements } = useLimenEntitlements();

  if (!entitlements.doctrineOfTime) {
    return (
      <PageLayout>
        <LimenServiceLockGate serviceId="doctrine_of_time" />
      </PageLayout>
    );
  }
  const params = new URLSearchParams(search);
  const _ref = validAcademyReferral(params.get("ref"));
  const tabParam = params.get("tab") ?? "canoni";
  const lessonIdParam = params.get("lesson") ?? params.get("canone");

  // Determine active tab cleanly
  const activeTab = useMemo<"canoni" | "trattato" | "espansione" | "incisione">(() => {
    if (tabParam === "trattato" || tabParam === "codex") return "trattato";
    if (tabParam === "espansione" || tabParam === "affiliate") return "espansione";
    if (tabParam === "incisione" || tabParam === "teacher") return "incisione";
    return "canoni";
  }, [tabParam]);

  const handleTabChange = (nextTab: string) => {
    const nextParams = new URLSearchParams(search);
    nextParams.set("tab", nextTab);
    if (nextTab !== "canoni") {
      nextParams.delete("lesson");
      nextParams.delete("canone");
    }
    navigate(`/academy?${nextParams.toString()}`);
  };

  // Queries for catalog and billing with safe defaults (zero blocking crash)
  const catalogQuery = useQuery({
    queryKey: api.academyKeys.catalog,
    queryFn: api.fetchAcademyCatalog,
    staleTime: 60_000,
    retry: 1,
  });

  const billingQuery = useQuery({
    queryKey: api.academyKeys.billing,
    queryFn: api.fetchAcademyBilling,
    staleTime: 60_000,
    retry: 1,
  });

  const { data: profile } = useGetProfile();
  const isTeacher = catalogQuery.data?.access.isTeacher ?? false;
  const _hasProtocolAccess = billingQuery.data?.active ?? catalogQuery.data?.access.hasAccess ?? false;

  // Active Session and Kill-Zone telemetry
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const _limenSession = useMemo(() => getLimenSessionInfo(now), [now]);

  // Active Canone and transmission state
  const [selectedCanoneId, setSelectedCanoneId] = useState<string>("canone-0");
  const [selectedTransmissionId, setSelectedTransmissionId] = useState<string>("c0-t1");

  // Sync from query params if specified
  useEffect(() => {
    if (lessonIdParam) {
      for (const group of CANONI_MASTER_DATA) {
        const found = group.transmissions.find(
          (t) => t.id === lessonIdParam || t.code === lessonIdParam,
        );
        if (found) {
          setSelectedCanoneId(group.id);
          setSelectedTransmissionId(found.id);
          break;
        }
      }
    }
  }, [lessonIdParam]);

  // Selected transmission object
  const activeTransmission = useMemo<CanoneTransmission>(() => {
    const group = CANONI_MASTER_DATA.find((g) => g.id === selectedCanoneId) ?? CANONI_MASTER_DATA[0];
    return (
      group.transmissions.find((t) => t.id === selectedTransmissionId) ??
      group.transmissions[0]
    );
  }, [selectedCanoneId, selectedTransmissionId]);

  // Checklist "Il Filtro del Custode" state
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    sessione: true,
    sweep: true,
    mss: false,
    invalidazione: false,
  });

  const toggleChecklist = (key: string) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExportSigillo = () => {
    const allChecked = Object.values(checklist).every(Boolean);
    const text = `LIMEN PROTOCOL // LA DOTTRINA DEL TEMPO // IL FILTRO DEL CUSTODE
Data CET: ${now.toLocaleDateString("it-IT")} ore ${now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
Operatore: ${profile?.name ?? "Operatore Sovrano"} · Grado: ${profile?.level ?? 1}
Canone di Riferimento: ${activeTransmission.code} — ${activeTransmission.title}

1. FINESTRA TEMPORALE KILL-ZONE: ${checklist.sessione ? "VALIDATA (Sessione Consentita)" : "NON VERIFICATA (VIOLAZIONE)"}
2. SWEEP DI LIQUIDITA HTF: ${checklist.sweep ? "RILEVATO & CONFERMATO" : "NON RILEVATO"}
3. CAMBIO DI CARATTERE ITF (MSS): ${checklist.mss ? "CONFERMATO CON FVG" : "IN ATTESA"}
4. INVALIDAZIONE MATEMATICA: ${checklist.invalidazione ? "DEFINITA & STOP RIGIDO" : "NON DICHIARATA"}

STATO DEL SIGILLO: ${allChecked ? "● INGRESSO AUTORIZZATO DAL PROTOCOLLO" : "▲ ESECUZIONE SEVERAMENTE VIETATA"}

REGOLA INVIOLABILE: Se anche un solo elemento risulta non verificato, l'esecuzione a mercato è SEVERAMENTE VIETATA nel Limen Protocol.`;

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `limen-sigillo-${now.toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Sigillo del Custode Esportato",
      description: allChecked
        ? "Tutti i 4 criteri risultano convalidati. Rispetta l'invalidazione matematica."
        : "Attenzione: criteri incompleti. Esecuzione vietata dal protocollo.",
    });
  };

  // Section tabs definition (3 sole sottosezioni chiare)
  const sectionTabs: SectionTab[] = useMemo(
    () => [
      {
        value: "canoni",
        label: "01 · I CANONI OPERATIVI",
        icon: <Layers className="h-4 w-4" />,
      },
      {
        value: "trattato",
        label: "02 · IL TRATTATO DEI GENERALI",
        icon: <BookOpen className="h-4 w-4" />,
      },
      {
        value: "espansione",
        label: "03 · IL MANDATO D'ESPANSIONE",
        icon: <Award className="h-4 w-4" />,
        badge: (
          <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold">
            20%
          </span>
        ),
      },
      ...(isTeacher
        ? [
            {
              value: "incisione",
              label: "BANCO D'INCISIONE",
              icon: <Terminal className="h-4 w-4 text-primary" />,
            },
          ]
        : []),
    ],
    [isTeacher],
  );

  return (
    <PageLayout quiet>
      <div className="flex flex-col lg:h-full lg:min-h-0 lg:overflow-hidden pt-1 max-w-[1760px] w-full mx-auto">
        {/* ─── BARRA DI NAVIGAZIONE COMPATTA (3 SEZIONI SOVRANE & PONTE FORGIA) ─── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-2 shrink-0">
          <div className="lg:hidden">
            <SectionTabs
              ariaLabel="Sezioni della Dottrina del Tempo"
              items={sectionTabs}
              value={activeTab}
              onValueChange={handleTabChange}
            />
          </div>
          <div className="hidden lg:flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-[#C5A059] animate-pulse" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#C5A059]">
              {activeTab === "canoni" && "01 · I CANONI OPERATIVI"}
              {activeTab === "trattato" && "02 · IL TRATTATO DEI GENERALI"}
              {activeTab === "espansione" && "03 · IL MANDATO D'ESPANSIONE"}
              {activeTab === "incisione" && "BANCO D'INCISIONE"}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Link
              href="/backtest"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-xs font-bold text-primary border border-primary/40 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap">La Forgia del Passato</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* ─── SEZIONE 01: I CANONI OPERATIVI (VISORE TATTICO & CONSOLE DIDATTICA) ─── */}
        {activeTab === "canoni" && (
          <div className="limen-scroll-pane flex-1 min-h-0 space-y-6 pt-3 pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Colonna Sinistra / Principale (Visore Tattico, Note & Filtro del Custode) */}
            <div className="lg:col-span-8 space-y-6 min-w-0">
              {/* Il Visore Tattico (Video Player) */}
              <Card className="border-primary/40 bg-card overflow-hidden shadow-2xl">
                <CardHeader className="p-4 border-b border-border/60 bg-gradient-to-r from-card via-background to-card flex flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg border border-primary/40 bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                      <Play className="h-4 w-4 fill-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-bold text-primary uppercase tracking-wider">
                          IL VISORE TATTICO // TRASMISSIONE {activeTransmission.code}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          · {activeTransmission.timeframe}
                        </span>
                      </div>
                      <h2 className="text-sm sm:text-base font-bold text-foreground truncate font-display">
                        {activeTransmission.title}
                      </h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs text-muted-foreground bg-background px-2.5 py-1 rounded border border-border">
                      {activeTransmission.duration}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="p-0 bg-black aspect-video relative flex items-center justify-center overflow-hidden">
                  {/* Player Rendering: Cloudflare Stream, Vimeo/YouTube Embed or Native Limen Cinematic */}
                  {activeTransmission.streamVideoId ? (
                    <ManagedLessonVideo
                      id={activeTransmission.id}
                      title={activeTransmission.title}
                    />
                  ) : activeTransmission.videoEmbedUrl ? (
                    <iframe
                      className="w-full h-full"
                      src={activeTransmission.videoEmbedUrl}
                      title={activeTransmission.title}
                      allow="fullscreen; picture-in-picture; encrypted-media"
                      allowFullScreen
                      sandbox="allow-scripts allow-same-origin allow-presentation"
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  ) : (
                    <video
                      controls
                      playsInline
                      className="w-full h-full object-cover"
                      poster="/images/backgrounds/nero-ossidiana.webp"
                      key={activeTransmission.videoSrc}
                    >
                      <source src={activeTransmission.videoSrc} type="video/mp4" />
                      Il tuo browser non supporta la riproduzione video HTML5.
                    </video>
                  )}
                </CardContent>
              </Card>

              {/* I Punti di Svolta del Canone & Sintesi Operativa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-border bg-card/80 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-primary border-b border-border/50 pb-2">
                    <Compass className="h-4 w-4" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                      LE DIRETTIVE INVIOLABILI DEL CANONE
                    </h3>
                  </div>
                  <ul className="space-y-2 text-xs text-foreground/90 leading-relaxed font-sans">
                    {activeTransmission.keyDirectives.map((dir, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{dir}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="border-border bg-card/80 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-destructive border-b border-border/50 pb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider">
                      ERRORI FATALI DELLA MASSA RETAIL
                    </h3>
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed font-sans">
                    {activeTransmission.fatalErrors.map((err, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive shrink-0 mt-1.5" />
                        <span className="text-destructive/90">{err}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              {/* Il Filtro del Custode (Checklist Pre-Sessione Interattiva) */}
              <Card className="border-primary/50 bg-card/90 shadow-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded border border-primary/40 bg-primary/10 flex items-center justify-center text-primary">
                      <Shield className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                        IL FILTRO DEL CUSTODE // 4 SIGILLI PRE-MERCATO
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Tutti i 4 criteri devono risultare convalidati prima di inserire un qualunque ordine a mercato.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-mono text-xs border-primary/40 hover:bg-primary/10 text-primary"
                    onClick={handleExportSigillo}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Esporta Sigillo (.txt)
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => toggleChecklist("sessione")}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      checklist.sessione
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border/80 bg-background/60 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                        checklist.sessione
                          ? "border-primary bg-primary text-black font-bold"
                          : "border-border"
                      }`}
                    >
                      {checklist.sessione && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold block">
                        I. FINESTRA KILL-ZONE
                      </span>
                      <span className="text-[11px] leading-tight block mt-0.5 text-muted-foreground">
                        Orario attuale compreso tra 08:00–10:30 UTC o 13:30–16:00 UTC. Fuori finestra: vietato.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleChecklist("sweep")}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      checklist.sweep
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border/80 bg-background/60 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                        checklist.sweep
                          ? "border-primary bg-primary text-black font-bold"
                          : "border-border"
                      }`}
                    >
                      {checklist.sweep && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold block">
                        II. SWEEP DI LIQUIDITÀ HTF
                      </span>
                      <span className="text-[11px] leading-tight block mt-0.5 text-muted-foreground">
                        Presa secca dei massimi o minimi (PDH/PDL) senza chiusura candela solida oltre il livello.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleChecklist("mss")}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      checklist.mss
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border/80 bg-background/60 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                        checklist.mss
                          ? "border-primary bg-primary text-black font-bold"
                          : "border-border"
                      }`}
                    >
                      {checklist.mss && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold block">
                        III. CAMBIO DI CARATTERE (MSS)
                      </span>
                      <span className="text-[11px] leading-tight block mt-0.5 text-muted-foreground">
                        Rottura conclamata dello swing interno con candela di displacement e Fair Value Gap.
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => toggleChecklist("invalidazione")}
                    className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                      checklist.invalidazione
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border/80 bg-background/60 text-muted-foreground hover:border-border"
                    }`}
                  >
                    <div
                      className={`h-5 w-5 rounded border mt-0.5 flex items-center justify-center shrink-0 ${
                        checklist.invalidazione
                          ? "border-primary bg-primary text-black font-bold"
                          : "border-border"
                      }`}
                    >
                      {checklist.invalidazione && <Check className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-bold block">
                        IV. INVALIDAZIONE MATEMATICA
                      </span>
                      <span className="text-[11px] leading-tight block mt-0.5 text-muted-foreground">
                        Stop Loss fisso precalcolato oltre la struttura e regola di uscita entro 3 candele M15.
                      </span>
                    </div>
                  </button>
                </div>

                {/* Ponte Diretto con La Forgia del Passato */}
                <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-mono text-primary font-bold">CONSIGLIO FORGIA: </span>
                    Testa questo Canone su {activeTransmission.forgiaHint.pair} ({activeTransmission.forgiaHint.timeframe}).
                  </div>
                  <Button
                    size="sm"
                    className="font-mono text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => navigate("/backtest")}
                  >
                    <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
                    Verifica Canone nella Forgia
                  </Button>
                </div>
              </Card>
            </div>

            {/* Colonna Destra (Il Registro dei 6 Canoni con scrollbar interna) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                  REGISTRO DEI CANONI (0 — V)
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  6 CANONI · 22 TRASMISSIONI
                </span>
              </div>

              <div className="space-y-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                {CANONI_MASTER_DATA.map((group) => {
                  const isGroupActive = group.id === selectedCanoneId;
                  return (
                    <Card
                      key={group.id}
                      className={`border transition-all overflow-hidden ${
                        isGroupActive
                          ? "border-primary/60 bg-card shadow-lg"
                          : "border-border/70 bg-card/60 hover:border-border"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCanoneId(group.id);
                          setSelectedTransmissionId(group.transmissions[0].id);
                        }}
                        className="w-full p-3.5 text-left border-b border-border/40 bg-gradient-to-r from-card to-background/50 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-primary">
                              {group.roman}
                            </span>
                            <span className="font-mono text-[9px] text-muted-foreground">
                              · {group.timeframe}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold uppercase tracking-wide text-foreground truncate font-display">
                            {group.title}
                          </h4>
                        </div>
                        <ChevronRight
                          className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                            isGroupActive ? "rotate-90 text-primary" : ""
                          }`}
                        />
                      </button>

                      <div className="p-1 space-y-1">
                        {group.transmissions.map((t) => {
                          const isTransmissionActive = t.id === selectedTransmissionId;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setSelectedCanoneId(group.id);
                                setSelectedTransmissionId(t.id);
                              }}
                              className={`w-full p-2.5 rounded text-left transition-colors flex items-center justify-between gap-2 ${
                                isTransmissionActive
                                  ? "bg-primary/15 text-foreground font-semibold border border-primary/40"
                                  : "hover:bg-background/80 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[10px] font-bold shrink-0 text-primary">
                                  {t.code}
                                </span>
                                <span className="text-xs truncate">{t.title}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono text-[9px] text-muted-foreground">
                                  {t.duration}
                                </span>
                                {t.isFreePreview ? (
                                  <span className="font-mono text-[8px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    Libero
                                  </span>
                                ) : (
                                  <Lock className="h-3 w-3 text-muted-foreground/60" />
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* ─── SEZIONE 02: IL TRATTATO DEI GENERALI (I TRE LIBRI DEI GENERALI) ─── */}
        {activeTab === "trattato" && (
          <div className="flex-1 min-h-0 flex flex-col justify-center pt-1 pb-1 lg:overflow-hidden">
            <GeneralsBooksReader />
          </div>
        )}

        {/* ─── SEZIONE 03: IL MANDATO D'ESPANSIONE (AFFILIAZIONE SOVRANA SINGLE-TIER) ─── */}
        {activeTab === "espansione" && (
          <div className="limen-scroll-pane flex-1 min-h-0 pt-3 pb-8">
            <div className="space-y-6 max-w-4xl mx-auto">
            <Card className="border-primary/50 bg-card p-6 shadow-2xl space-y-6">
              <div className="space-y-2 border-b border-border/60 pb-4">
                <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-primary">
                  MANDATO D'ESPANSIONE // PATTO D'ONORE SINGLE-TIER
                </span>
                <h2 className="text-2xl font-bold font-display uppercase tracking-tight text-foreground">
                  La Crescita dell'Ordine Sovrano
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Il Limen Protocol rifiuta categoricamente qualsiasi schema multilivello o piramidale.
                  Il Mandato d'Espansione è un patto meritocratico ad <strong>1 solo livello diretto (Single-Tier)</strong>:
                  ogni Operatore guidato tramite il tuo Codice di Chiamata ti riconosce il <strong>20% di royalty perenne (30 € / mese)</strong>.
                </p>
              </div>

              {/* Barra dell'Esenzione Sovrana (5 Confratelli = Canone 0€) */}
              {(() => {
                const membersCount = billingQuery.data?.affiliate.activeGuidedMembersCount ?? 0;
                const pct = Math.min(100, Math.round((membersCount / 5) * 100));
                const royaltyEur = membersCount * 30;
                const surplusEur = Math.max(0, (membersCount - 5) * 30);

                return (
                  <div className="rounded-xl border border-primary/40 bg-background/80 p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                        PROGRESSO ESENZIONE TRIBUTO MENSILE (150 € / MESE)
                      </span>
                      <span className="font-mono text-xs text-foreground font-semibold">
                        Royalty Attiva: <strong className="text-primary">{royaltyEur} € / mese</strong>
                        {surplusEur > 0 ? ` (+${surplusEur} € Rendita Netta)` : ""}
                      </span>
                    </div>

                    <div className="h-3 w-full overflow-hidden rounded-full border border-border bg-card">
                      <div
                        className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-500 shadow-[0_0_12px_rgba(197,160,89,0.5)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1">
                      <span>
                        Confratelli guidati: <strong className="text-foreground">{membersCount} / 5</strong> per l'esenzione totale dal tributo.
                      </span>
                      <span className="font-mono text-primary">
                        {5 - membersCount > 0
                          ? `Ancora ${5 - membersCount} per l'azzeramento canone`
                          : "Esenzione Sovrana Raggiunta (Canone 0 €)"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Codice di Chiamata Box */}
              {(() => {
                const link = billingQuery.data?.affiliate.link
                  ? new URL(billingQuery.data.affiliate.link, window.location.origin).href
                  : `${window.location.origin}/welcome?ref=${profile?.id ?? "LIMEN"}`;

                return (
                  <div className="space-y-3">
                    <label className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                      IL TUO CODICE DI CHIAMATA PERSONALE
                    </label>
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={link}
                        className="font-mono text-xs bg-background text-foreground selection:bg-primary/30"
                        onFocus={(e) => e.target.select()}
                      />
                      <Button
                        variant="outline"
                        className="font-mono text-xs font-bold border-primary/40 hover:bg-primary/10 text-primary shrink-0"
                        onClick={async () => {
                          await navigator.clipboard.writeText(link);
                          toast({
                            title: "Codice di Chiamata Copiato",
                            description: "Condividi il tuo link unicamente con operatori dediti alla disciplina e al metodo.",
                          });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1.5" />
                        Copia Sigillo d'Invito
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Ogni nuovo operatore che accede tramite il tuo codice viene attribuito in modo permanente e matematico al tuo Dossier.
                    </p>
                  </div>
                );
              })()}

              {/* Regola di Merito */}
              <div className="rounded-lg border border-border/80 bg-background/40 p-4 text-xs text-muted-foreground space-y-1">
                <span className="font-mono text-primary font-bold block uppercase tracking-wider">
                  REQUISITO DI MERITO · GRADO II (IL CUSTODE DELLA REGOLA)
                </span>
                <p>
                  Il Mandato d'Espansione è riservato agli Operatori che hanno dimostrato fedeltà al Codice
                  con 30 sessioni consecutive al 100% di integrità ne <em>Il Libro della Verità</em>.
                </p>
              </div>
            </Card>
          </div>
        </div>
        )}

        {/* ─── BANCO D'INCISIONE (GESTIONE AMMINISTRATORE / MAESTRO) ─── */}
        {activeTab === "incisione" && isTeacher && (
          <div className="limen-scroll-pane flex-1 min-h-0 pt-3 pb-8">
            <div className="space-y-6">
              <TeacherStudio />
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

// ─── Studio Docente: Il Banco d'Incisione (Per Utenti Insegnanti/Admin) ─────────

function TeacherStudio() {
  const _c = useCopy();
  const lessons = useQuery({
    queryKey: api.academyKeys.teacher,
    queryFn: api.fetchAcademyTeacherLessons,
  });
  const _submissions = useQuery({
    queryKey: api.academyKeys.submissions,
    queryFn: api.fetchAcademySubmissions,
  });
  const [editing, setEditing] = useState<api.AcademyLesson | AcademySyllabusItem | "new" | null>(
    null,
  );

  return (
    <Card className="border-primary/50 bg-card p-6 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
            IL BANCO D'INCISIONE // AMMINISTRAZIONE
          </span>
          <h2 className="text-xl font-bold font-display uppercase tracking-tight text-foreground">
            Gestione e Pubblicazione Canoni
          </h2>
        </div>
        <Button
          size="sm"
          className="font-mono text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={() => setEditing("new")}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Incidi Nuovo Canone
        </Button>
      </div>

      {editing ? (
        <LessonEditor
          key={typeof editing === "string" ? editing : editing.id}
          lesson={editing}
          close={() => setEditing(null)}
        />
      ) : lessons.isPending ? (
        <p className="font-mono text-xs text-muted-foreground">Caricamento trasmissioni…</p>
      ) : (
        <div className="space-y-3">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
            Canoni Pubblicati a Database
          </h3>
          <ul className="space-y-2">
            {(lessons.data ?? []).map((lesson) => (
              <li
                key={lesson.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-background"
              >
                <div>
                  <strong className="text-sm font-semibold text-foreground block">
                    {lesson.title}
                  </strong>
                  <small className="text-xs text-muted-foreground font-mono">
                    {lesson.published ? "● PUBBLICATO" : "○ BOZZA"} · {lesson.accessLevel}
                  </small>
                </div>
                <Button variant="outline" size="sm" onClick={() => setEditing(lesson)}>
                  Modifica
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function LessonEditor({
  lesson,
  close,
}: {
  lesson: api.AcademyLesson | AcademySyllabusItem | "new";
  close: () => void;
}) {
  const _c = useCopy();
  const existing = typeof lesson === "object" && "published" in lesson ? lesson : null;
  const outline = typeof lesson === "object" && "outline" in lesson ? lesson : null;
  const [form, setForm] = useState<api.AcademyLessonInput>({
    moduleId: existing?.moduleId ?? outline?.moduleId ?? "preparazione",
    syllabusId: existing?.syllabusId ?? outline?.id ?? null,
    title: existing?.title ?? outline?.title ?? "",
    description: existing?.description ?? "",
    videoUrl: existing?.videoUrl ?? "",
    streamVideoId: existing?.streamVideoId ?? null,
    accessLevel: existing?.accessLevel ?? "protocol",
    contentKind: existing?.contentKind ?? "lesson",
    introductionSlot:
      (existing?.introductionSlot as api.AcademyLessonInput["introductionSlot"]) ?? null,
    bodyMarkdown: existing?.bodyMarkdown ?? "",
    exercisePrompt: existing?.exercisePrompt ?? outline?.exercisePrompt ?? "",
    orderIndex: existing?.orderIndex ?? 0,
    published: existing?.published ?? false,
  });
  const action = useAction();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        action.mutate(async () => {
          await api.saveAcademyLesson(existing?.id ?? null, {
            ...form,
            videoUrl: form.videoUrl || null,
          });
          close();
        });
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-mono uppercase text-muted-foreground block mb-1">
            Titolo Canone
          </label>
          <Input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-mono uppercase text-muted-foreground block mb-1">
            Accesso
          </label>
          <select
            className="w-full h-10 px-3 rounded-md border border-input bg-background font-mono text-xs"
            value={form.accessLevel}
            onChange={(e) => setForm({ ...form, accessLevel: e.target.value as "free" | "protocol" })}
          >
            <option value="protocol">Membro (Protocollo)</option>
            <option value="free">Accesso Libero (Sandbox)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-mono uppercase text-muted-foreground block mb-1">
          Descrizione / Punti Chiave
        </label>
        <Textarea
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div className="pt-2">
        <AcademyVideoUpload
          currentId={form.streamVideoId ?? null}
          onConfirm={(id) => setForm({ ...form, streamVideoId: id, videoUrl: null })}
        />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button type="submit" disabled={action.isPending} className="font-mono text-xs font-bold">
          Salva Canone
        </Button>
        <Button type="button" variant="outline" onClick={close} className="font-mono text-xs">
          Annulla
        </Button>
      </div>
    </form>
  );
}
