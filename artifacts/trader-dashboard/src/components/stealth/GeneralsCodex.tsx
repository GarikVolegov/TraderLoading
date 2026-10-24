import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Shield,
  Crosshair,
  Play,
  Lock,
  Unlock,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  Crown,
  BookOpen,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { GatekeepingModal } from "./GatekeepingModal";
import { GeneralCodexLibro1 } from "./GeneralCodexLibro1";
import { GeneralsCodexLibro2 } from "./GeneralsCodexLibro2";
import { getStoredUserTier, setStoredUserTier, type UserTier } from "@/lib/stealthTracking";

export interface GeneralsCodexProps {
  userTier?: UserTier;
  className?: string;
  onRequestAccess?: (reason?: string) => void;
  onOpenVideo?: (chapterId: 1 | 2 | 3, moduleId: number, lessonId: string) => void;
  defaultChapter?: 1 | 2 | 3;
}

interface ChapterData {
  id: 1 | 2 | 3;
  roman: "I" | "II" | "III";
  title: string;
  subtitle: string;
  archetype: string;
  latinMotto: string;
  epoch: string;
  quote: string;
  quoteAuthor: string;
  tradingParallelTitle: string;
  tradingParallel: string;
  timeframe: string;
  academyModuleId: number;
  academyLessonId: string;
  academyModuleTitle: string;
  academyDuration: string;
  metrics: {
    label: string;
    value: string;
    tag: string;
  }[];
  directives: {
    code: string;
    title: string;
    rule: string;
    type: "neutral" | "warning" | "success";
  }[];
}

const CHAPTERS: ChapterData[] = [
  {
    id: 1,
    roman: "I",
    title: "La Ricognizione",
    subtitle: "Mappatura & Cartografia HTF (Daily · H4 · H1)",
    archetype: "Sun Tzu & Scipione l'Africano",
    latinMotto: "Cognitio ante Proelium",
    epoch: "L'Arte della Guerra & Zama · 500 a.C. - 202 a.C.",
    quote:
      "«Il terreno detta la strategia. Chi non conosce la geografia del campo di battaglia e le leggi che muovono le truppe avversarie ha già perso prima di estrarre la spada.»",
    quoteAuthor: "Sun Tzu & Scipione l'Africano — Trattato di Guerra & Dottrina di Zama",
    tradingParallelTitle: "Dalla Cartografia Bellica alla Liquidità Istituzionale & Leggi di Wyckoff",
    tradingParallel:
      "La mappatura High Timeframe (Daily, H4, H1) è la ricognizione topografica del campo di battaglia prima di schierare l'esercito. Attraverso le 3 Leggi di Wyckoff (Domanda/Offerta, Causa/Effetto, Sforzo/Risultato), individuiamo dove i market maker hanno ammassato le riserve: i pool di liquidità Buy-Side e Sell-Side (BSL/SSL), i vuoti di volume (Fair Value Gap) e la soglia matematica dell'Equilibrium 50%. Nessun soldato scende in campo finché le alture non sono dominate.",
    timeframe: "DAILY → H4 → H1",
    academyModuleId: 1,
    academyLessonId: "m1-l1",
    academyModuleTitle: "Modulo 1: Mappatura & Liquidità HTF",
    academyDuration: "4 lezioni · 1h 45m",
    metrics: [
      { label: "TIMEFRAME DI RICOGNIZIONE", value: "Daily / H4 / H1", tag: "MACRO" },
      { label: "TARGET DI LIQUIDITÀ", value: "BSL & SSL Pool", tag: "SWING" },
      { label: "SOGLIA MATEMATICA", value: "50% Equilibrium", tag: "DISCOUNT" },
      { label: "CONDIZIONE D'AZIONE", value: "Attesa Test Estremo", tag: "ZERO CHASE" },
    ],
    directives: [
      {
        code: "ORD-01 // CARTOGRAFIA PRE-SESSIONE",
        title: "Tracciamento Obbligatorio PDH / PDL",
        rule: "Fissare i massimi e minimi del giorno precedente (PDH/PDL) e della settimana (PWH/PWL) prima dell'apertura delle borse. Le zone centrali sono rumore.",
        type: "neutral",
      },
      {
        code: "ORD-02 // FILTRO MATEMATICO 50%",
        title: "Divieto di Acquisto in Zona Premium",
        rule: "Vietato comprare sopra la mediana del range o vendere in zona Discount. Gli ordini istituzionali si accumulano solo a prezzo fortemente scontato.",
        type: "warning",
      },
      {
        code: "ORD-03 // ZONE D'ATTRITO (POI)",
        title: "Isolamento di Order Block & FVG Vergini",
        rule: "Selezionare esclusivamente disequilibri non ancora mitigati. Una zona già toccata ha esaurito i suoi contratti e non costituisce difesa.",
        type: "neutral",
      },
      {
        code: "ORD-04 // DICHIARAZIONE D'INVALIDAZIONE",
        title: "Fissazione del Livello Morto",
        rule: "Dichiarare per iscritto il livello di prezzo che annulla il bias prima di toccare qualsiasi tasto della piattaforma operativa.",
        type: "success",
      },
    ],
  },
  {
    id: 2,
    roman: "II",
    title: "La Falange e il Contropiede",
    subtitle: "Filtri di Inversione & Cambio di Carattere ITF (M15 · H1)",
    archetype: "Leonida & Giulio Cesare",
    latinMotto: "Murus Aeneus · Contra-Impetus",
    epoch: "Le Termopili & Il Rubicone · 480 a.C. - 49 a.C.",
    quote:
      "«Finché la falange resta unita con scudi serrati e lance tese, nessun'onda nemica potrà spezzare il nostro fronte. Non precipitatevi incontro alla carica dell'avversario: lasciate che si sfoghi nel vuoto, che creda di aver sfondato, e nel momento esatto del suo sbilanciamento sferrate il contropiede letale.»",
    quoteAuthor: "Leonida I & Giulio Cesare — Dottrina della Barriera e dell'Impeto",
    tradingParallelTitle: "Dalla Barriera degli Scudi alla Trappola dello Sweep",
    tradingParallel:
      "Nei timeframe intermedi (M15 / H1), la pazienza è la nostra falange impenetrabile. L'operatore retail cade costantemente nella trappola dell'inducement: confonde una spinta emotiva con un breakout ed entra sui massimi. La nostra dottrina attende che il falso assalto sbatta contro il muro (Sweep di Liquidità) e che gli algoritmi interbancari rispondano con una candela di spostamento violenta (Displacement). Solo quando la struttura interna si infrange (Market Structure Shift) passiamo all'attacco.",
    timeframe: "M15 → H1",
    academyModuleId: 2,
    academyLessonId: "m2-l1",
    academyModuleTitle: "Modulo 2: Filtri di Inversione ITF",
    academyDuration: "4 lezioni · 2h 10m",
    metrics: [
      { label: "TIMEFRAME DI CONFERMA", value: "M15 / H1", tag: "INTERMEDIATE" },
      { label: "FINESTRA TEMPORALE", value: "Kill-Zone London/NY", tag: "TIMING" },
      { label: "CONFERMA ENERGETICA", value: "Displacement Candle", tag: "VOLUMES" },
      { label: "TRIGGER DI CARATTERE", value: "MSS con FVG", tag: "CONFIRMED" },
    ],
    directives: [
      {
        code: "ORD-05 // SBARRAMENTO TEMPORALE",
        title: "Ingaggio Esclusivo in Kill-Zone",
        rule: "Nessuna operazione al di fuori delle finestre di massima efficienza interbancaria (London Open 08:00-10:30 UTC o NY Open 13:30-16:00 UTC).",
        type: "warning",
      },
      {
        code: "ORD-06 // RILEVAZIONE DELLO SWEEP",
        title: "Assorbimento Senza Chiusura Esterna",
        rule: "Se il prezzo chiude con corpo candela solido oltre l'estremo, lo sweep è INVALIDATO (si tratta di espansione reale). Attendere la presa secca.",
        type: "neutral",
      },
      {
        code: "ORD-07 // SPOSTAMENTO ENERGETICO",
        title: "Candela di Displacement Obbligatoria",
        rule: "Esigere un corpo di candela solido, privo di ombre d'indecisione, che generi un Fair Value Gap ITF. È l'impronta indiscutibile del grande capitale.",
        type: "neutral",
      },
      {
        code: "ORD-08 // MARKET STRUCTURE SHIFT",
        title: "Rottura Strutturale Conclamata",
        rule: "Violazione netta dell'ultimo swing point interno. Senza un MSS conclamato su M15, è SEVERAMENTE VIETATO scendere sui grafici al minuto.",
        type: "success",
      },
    ],
  },
  {
    id: 3,
    roman: "III",
    title: "L'Assalto Chirurgico",
    subtitle: "Esecuzione LTF & Regola di Invalidazione (M1 · M5 Scalp)",
    archetype: "Napoleone & Musashi",
    latinMotto: "Ictus Unicus · Celeritas et Exactitudo",
    epoch: "Austerlitz & Il Libro dei Cinque Anelli · 1645 - 1805",
    quote:
      "«La vittoria non risiede nella moltitudine disordinata dei colpi, ma nella concentrazione totale del fuoco nel punto più vulnerabile del fronte nemico, al minuto prestabilito. Nel duello decisivo non vi è spazio per l'esitazione né per la speranza: un solo affondo chirurgico, oppure il fodero si chiude e la ritirata è immediata.»",
    quoteAuthor: "Napoleone Bonaparte & Miyamoto Musashi — La Lama e il Cannone",
    tradingParallelTitle: "Dalla Balistica Militare al Trigger al Minuto",
    tradingParallel:
      "Sul grafico al minuto (M1 e M5), il trading abbandona la teoria e diventa balistica applicata. Quando Sun Tzu ha mappato il terreno e la falange di Cesare ha certificato l'inversione, l'esecutore piazza un ordine limite sul rintracciamento dell'Order Block o al 50% del Fair Value Gap al minuto. Lo Stop Loss non è un'opinione: è una barriera matematica di 2.5 - 4.5 pips oltre la manipolazione. Se il prezzo non esplode entro 3 candele, la posizione viene abortita all'istante senza speranza.",
    timeframe: "M1 → M5 SCALP",
    academyModuleId: 3,
    academyLessonId: "m3-l1",
    academyModuleTitle: "Modulo 3: Schematiche di Esecuzione LTF",
    academyDuration: "5 lezioni · 2h 40m",
    metrics: [
      { label: "TIMEFRAME ESECUTIVO", value: "M1 / M5 Scalp", tag: "SURGICAL" },
      { label: "TIPOLOGIA ORDINE", value: "Limit su Sweeptest", tag: "NO FOMO" },
      { label: "STOP LOSS MEDIO", value: "2.5 - 4.5 Pips", tag: "TIGHT" },
      { label: "RAPPORTO R:R TARGET", value: "1:3.5 - 1:5.0+", tag: "ASYMMETRIC" },
    ],
    directives: [
      {
        code: "ORD-09 // ORDINE LIMITE BALISTICO",
        title: "Ingresso Chirurgico su Rintracciamento",
        rule: "Posizionamento esclusivo su ordini limite al test dell'estremo M1 o del Breaker Block. Vietato rincorrere il prezzo a mercato.",
        type: "neutral",
      },
      {
        code: "ORD-10 // STOP LOSS MATEMATICO",
        title: "Posizionamento Oltre la Manipolazione",
        rule: "Lo Stop Loss risiede esattamente dove l'idea statistica cessa di esistere. Nessuno spostamento difensivo, nessun allargamento, nessuna mediazione.",
        type: "warning",
      },
      {
        code: "ORD-11 // SCALING E BREAK-EVEN",
        title: "Protezione al Primo Pool di Liquidità",
        rule: "Al raggiungimento di Target 1 (TP1), prelievo del 50% della posizione e trailing a Break-Even protetto (+1 pip per commissioni).",
        type: "neutral",
      },
      {
        code: "ORD-12 // INVALIDAZIONE TEMPORALE",
        title: "Regola Ferrea delle 3 Candele",
        rule: "Se l'impulso volumetrico atteso non si manifesta entro 3 barre M15 dall'innesco del trigger, uscire manualmente a mercato senza indugio.",
        type: "success",
      },
    ],
  },
];

/**
 * Animated Tactical Map for Chapter I (Sun Tzu / HTF)
 */
function TacticalMapHTF() {
  return (
    <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-xl border border-[#C5A059]/30 bg-[#06070A] overflow-hidden shadow-2xl">
      {/* Background Military Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="htf-tactical-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#C5A059" strokeWidth="0.5" strokeDasharray="2,2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#htf-tactical-grid)" />
      </svg>

      {/* Military Radar Scan Line */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C5A059]/10 to-transparent pointer-events-none"
        style={{
          animation: "radarSweep 5s linear infinite",
          width: "30%",
        }}
      />

      <style>{`
        @keyframes radarSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }
        @keyframes dashDraw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>

      {/* Tactical Canvas Overlay */}
      <svg className="relative z-10 w-full h-full" viewBox="0 0 800 340" preserveAspectRatio="xMidYMid meet">
        {/* Upper Zone: Buy-Side Liquidity Pool (BSL) */}
        <rect x="60" y="30" width="680" height="40" rx="6" fill="#C5A059" fillOpacity="0.08" stroke="#C5A059" strokeWidth="1" strokeDasharray="4,4" />
        <text x="75" y="55" fill="#D4AF37" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="bold" letterSpacing="2">
          ▲ BUY-SIDE LIQUIDITY POOL (BSL // MASSIMO SETTIMANALE PWH)
        </text>
        <text x="670" y="55" fill="#C5A059" fontSize="10" fontFamily="JetBrains Mono, monospace" opacity="0.8">
          PREMIUM ZONE
        </text>

        {/* 50% Equilibrium Line */}
        <line x1="60" y1="170" x2="740" y2="170" stroke="#C5A059" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.6" />
        <circle cx="400" cy="170" r="4" fill="#C5A059" />
        <text x="412" y="166" fill="#E6CA65" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          MEDIANA 50.0% EQUILIBRIUM · SOGLIA DI FAIR VALUE
        </text>

        {/* Lower Zone: Sell-Side Liquidity Pool (SSL) */}
        <rect x="60" y="270" width="680" height="40" rx="6" fill="#10B981" fillOpacity="0.06" stroke="#10B981" strokeWidth="1" strokeDasharray="4,4" />
        <text x="75" y="295" fill="#10B981" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="bold" letterSpacing="2">
          ▼ SELL-SIDE LIQUIDITY POOL (SSL // MINIMO SETTIMANALE PWL)
        </text>
        <text x="660" y="295" fill="#10B981" fontSize="10" fontFamily="JetBrains Mono, monospace" opacity="0.8">
          DISCOUNT ZONE
        </text>

        {/* Animated Price Trajectory Path */}
        <path
          d="M 90 280 Q 200 240 260 170 T 420 120 T 540 45 T 620 110 T 710 190"
          fill="none"
          stroke="url(#htfTrajectoryGrad)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Gradient for trajectory */}
        <defs>
          <linearGradient id="htfTrajectoryGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="45%" stopColor="#C5A059" />
            <stop offset="70%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>

        {/* Sweep Impact Marker at BSL */}
        <circle cx="540" cy="45" r="10" fill="#D4AF37" fillOpacity="0.2" stroke="#D4AF37" strokeWidth="2">
          <animate attributeName="r" values="8;16;8" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx="540" cy="45" r="4" fill="#D4AF37" />

        {/* Callout Tag: SWEEP EFFETTUATO */}
        <g transform="translate(555, 35)">
          <rect x="0" y="0" width="160" height="24" rx="4" fill="#141418" stroke="#D4AF37" strokeWidth="1" />
          <text x="8" y="16" fill="#F4F4F6" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            SWEEP HTF // PRESA ORDINI
          </text>
        </g>

        {/* HUD Crosshairs */}
        <line x1="540" y1="20" x2="540" y2="70" stroke="#D4AF37" strokeWidth="0.75" strokeDasharray="2,2" opacity="0.7" />
        <line x1="515" y1="45" x2="565" y2="45" stroke="#D4AF37" strokeWidth="0.75" strokeDasharray="2,2" opacity="0.7" />

        {/* Technical Coordinate Stamps */}
        <text x="75" y="125" fill="#8A6F33" fontSize="9" fontFamily="JetBrains Mono, monospace">
          LAT: 44°24&apos;N // HTF-CARTOGRAPHY // RANGE DAILY: 114 PIPS
        </text>
        <text x="75" y="225" fill="#8A6F33" fontSize="9" fontFamily="JetBrains Mono, monospace">
          ACCUMULAZIONE DISCOUNT: VALIDA // PRE-MARKET MAPPED
        </text>
      </svg>

      {/* Bottom HUD Bar */}
      <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[10px] font-mono text-slate-400 bg-[#090A0F]/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#C5A059]/20">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#D4AF37] animate-pulse" />
          <span className="text-slate-200 font-bold">STATUS TATTICO:</span>
          <span className="text-[#D4AF37]">MAPPATURA ESTREMI COMPLETATA // ATTESA REAZIONE BSL</span>
        </div>
        <span className="text-[#C5A059] hidden sm:inline">DOTTRINA SUN TZU · CAPITOLO I</span>
      </div>
    </div>
  );
}

/**
 * Animated Tactical Graphic for Chapter II (Leonida & Cesare / ITF)
 */
function PhalanxCounterITF() {
  return (
    <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-xl border border-[#C5A059]/30 bg-[#06070A] overflow-hidden shadow-2xl">
      {/* Background Military Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="itf-tactical-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#C5A059" strokeWidth="0.5" strokeDasharray="1,3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#itf-tactical-grid)" />
      </svg>

      <svg className="relative z-10 w-full h-full" viewBox="0 0 800 340" preserveAspectRatio="xMidYMid meet">
        {/* Phalanx Shield Wall (Top Resistance Barrier) */}
        <g id="phalanx-wall">
          <line x1="80" y1="75" x2="720" y2="75" stroke="#C5A059" strokeWidth="3" strokeLinecap="round" />
          {/* Decorative Greek Shield Glyphs */}
          {[140, 220, 300, 380, 460, 540, 620].map((x) => (
            <g key={x} transform={`translate(${x}, 75)`}>
              <circle cx="0" cy="0" r="14" fill="#141418" stroke="#C5A059" strokeWidth="1.5" />
              <path d="M -7 0 L 7 0 M 0 -7 L 0 7" stroke="#D4AF37" strokeWidth="1.2" />
            </g>
          ))}
          <text x="100" y="55" fill="#D4AF37" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="bold" letterSpacing="1.5">
            MVRVS AENEVS // BARRIERA STRUTTURALE M15 (FALANGE IMPERFORABILE)
          </text>
        </g>

        {/* Retail Trap Charge (Red dashed line attempting breakout and failing) */}
        <path
          d="M 120 230 L 260 160 L 340 190 L 460 70"
          fill="none"
          stroke="#EF4444"
          strokeWidth="2.5"
          strokeDasharray="4,4"
        />
        {/* Fake Breakout Wick (Inducement Trap) */}
        <line x1="460" y1="70" x2="460" y2="52" stroke="#EF4444" strokeWidth="2" />
        <circle cx="460" cy="52" r="4" fill="#EF4444" />
        <text x="475" y="56" fill="#EF4444" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          TRAPPOLA INDUCEMENT (RETAIL LONGS TRAPPED)
        </text>

        {/* Sudden Violent Displacement Vector (Emerald Strike Downward) */}
        <path
          d="M 460 70 L 485 160 L 520 230 L 550 280"
          fill="none"
          stroke="#10B981"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* Market Structure Shift (MSS) Horizontal Line */}
        <line x1="320" y1="190" x2="720" y2="190" stroke="#D4AF37" strokeWidth="1.5" strokeDasharray="5,3" />
        <circle cx="505" cy="190" r="8" fill="#10B981" fillOpacity="0.25" stroke="#10B981" strokeWidth="2">
          <animate attributeName="r" values="6;12;6" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="505" cy="190" r="3" fill="#10B981" />

        {/* MSS Callout */}
        <g transform="translate(530, 180)">
          <rect x="0" y="0" width="185" height="26" rx="4" fill="#0A0B10" stroke="#10B981" strokeWidth="1.2" />
          <text x="8" y="17" fill="#10B981" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            MSS CONFERMATO // DISPLACEMENT
          </text>
        </g>

        {/* Fair Value Gap (FVG) Imbalance Box */}
        <rect x="475" y="110" width="35" height="45" fill="#D4AF37" fillOpacity="0.15" stroke="#D4AF37" strokeWidth="1" strokeDasharray="2,2" />
        <text x="420" y="136" fill="#C5A059" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          FVG M15 ◄
        </text>

        {/* Kill-Zone Timing Banner */}
        <g transform="translate(100, 265)">
          <rect x="0" y="0" width="280" height="36" rx="6" fill="#11131A" stroke="#C5A059" strokeWidth="1" />
          <circle cx="20" cy="18" r="6" fill="#10B981" />
          <text x="35" y="16" fill="#F4F4F6" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            KILL-ZONE ATTIVA: LONDON 08:00 - 10:30 UTC
          </text>
          <text x="35" y="28" fill="#94A3B8" fontSize="8.5" fontFamily="JetBrains Mono, monospace">
            VOLUME ISTITUZIONALE CONCENTRATO // SPREAD MINIMO
          </text>
        </g>
      </svg>

      {/* Bottom HUD Bar */}
      <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[10px] font-mono text-slate-400 bg-[#090A0F]/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#C5A059]/20">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-slate-200 font-bold">STATUS TATTICO:</span>
          <span className="text-[#10B981]">INDUCEMENT ASSORBITO // CAMBIO DI CARATTERE VALIDATO</span>
        </div>
        <span className="text-[#C5A059] hidden sm:inline">DOTTRINA LEONIDA & CESARE · CAPITOLO II</span>
      </div>
    </div>
  );
}

/**
 * Animated Tactical Graphic for Chapter III (Napoleone & Musashi / LTF)
 */
function SniperAssaultLTF() {
  return (
    <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] rounded-xl border border-[#C5A059]/30 bg-[#06070A] overflow-hidden shadow-2xl">
      {/* Background Military Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="ltf-tactical-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#C5A059" strokeWidth="0.5" strokeDasharray="1,4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ltf-tactical-grid)" />
      </svg>

      <svg className="relative z-10 w-full h-full" viewBox="0 0 800 340" preserveAspectRatio="xMidYMid meet">
        {/* Balistic Crosshair Circles (Concentric Rings) */}
        <g transform="translate(320, 160)" opacity="0.45">
          <circle cx="0" cy="0" r="90" fill="none" stroke="#C5A059" strokeWidth="1" strokeDasharray="4,6" />
          <circle cx="0" cy="0" r="60" fill="none" stroke="#C5A059" strokeWidth="1.2" />
          <circle cx="0" cy="0" r="30" fill="none" stroke="#C5A059" strokeWidth="0.8" strokeDasharray="2,2" />
          <line x1="-120" y1="0" x2="120" y2="0" stroke="#C5A059" strokeWidth="1" />
          <line x1="0" y1="-110" x2="0" y2="110" stroke="#C5A059" strokeWidth="1" />
          {/* Mil-dot indicators */}
          {[-80, -40, 40, 80].map((pos) => (
            <g key={pos}>
              <line x1={pos} y1="-5" x2={pos} y2="5" stroke="#D4AF37" strokeWidth="1" />
              <line x1="-5" y1={pos} x2="5" y2={pos} stroke="#D4AF37" strokeWidth="1" />
            </g>
          ))}
        </g>

        {/* Invalidation Level (Strict Stop Loss Line) */}
        <line x1="160" y1="95" x2="680" y2="95" stroke="#EF4444" strokeWidth="2" strokeDasharray="4,3" />
        <rect x="520" y="82" width="160" height="22" rx="4" fill="#140A0A" stroke="#EF4444" strokeWidth="1" />
        <text x="528" y="97" fill="#EF4444" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          SOGLIA MORTA // SL 3.2 PIPS
        </text>

        {/* Limit Order Trigger (Entry Point) */}
        <line x1="160" y1="160" x2="680" y2="160" stroke="#C5A059" strokeWidth="2" />
        <rect x="520" y="147" width="160" height="22" rx="4" fill="#141418" stroke="#D4AF37" strokeWidth="1" />
        <text x="528" y="162" fill="#D4AF37" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          TRIGGER ENTRY // LIMIT ORD.
        </text>

        {/* Target Level (Take Profit 1:3.8) */}
        <line x1="160" y1="285" x2="680" y2="285" stroke="#10B981" strokeWidth="2.5" />
        <rect x="520" y="272" width="160" height="22" rx="4" fill="#0A140F" stroke="#10B981" strokeWidth="1" />
        <text x="528" y="287" fill="#10B981" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          TARGET TP1 // R:R 1:3.8 (12.2 P)
        </text>

        {/* Dynamic Animated Trajectory Arrow from Entry to TP */}
        <path
          d="M 320 160 L 350 200 L 390 240 L 440 285"
          fill="none"
          stroke="url(#sniperExpGrad)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        <defs>
          <linearGradient id="sniperExpGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        {/* Laser Sight Dot on Entry */}
        <circle cx="320" cy="160" r="5" fill="#D4AF37">
          <animate attributeName="r" values="4;7;4" dur="1.2s" repeatCount="indefinite" />
        </circle>

        {/* Target Impact Marker at TP */}
        <circle cx="440" cy="285" r="9" fill="#10B981" fillOpacity="0.3" stroke="#10B981" strokeWidth="2">
          <animate attributeName="r" values="7;14;7" dur="1.8s" repeatCount="indefinite" />
        </circle>
        <circle cx="440" cy="285" r="4" fill="#10B981" />

        {/* Left Side Execution Metrics HUD */}
        <g transform="translate(50, 60)">
          <rect x="0" y="0" width="180" height="90" rx="6" fill="#090A0F" stroke="#C5A059" strokeWidth="1" opacity="0.9" />
          <text x="12" y="22" fill="#D4AF37" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            ESECUZIONE BALISTICA M1
          </text>
          <line x1="12" y1="28" x2="168" y2="28" stroke="#C5A059" strokeWidth="0.5" opacity="0.5" />
          <text x="12" y="44" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono, monospace">
            RISCHIO: 1.0% FISSO
          </text>
          <text x="12" y="58" fill="#94A3B8" fontSize="9" fontFamily="JetBrains Mono, monospace">
            STOP: 3.2 PIPS
          </text>
          <text x="12" y="72" fill="#10B981" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            RENDIMENTO: +3.81 R
          </text>
        </g>
      </svg>

      {/* Bottom HUD Bar */}
      <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[10px] font-mono text-slate-400 bg-[#090A0F]/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-[#C5A059]/20">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-slate-200 font-bold">STATUS TATTICO:</span>
          <span className="text-[#10B981]">ORDINE ATTIVATO // TRAILING A BREAK-EVEN AL TARGET 1</span>
        </div>
        <span className="text-[#C5A059] hidden sm:inline">DOTTRINA NAPOLEONE & MUSASHI · CAPITOLO III</span>
      </div>
    </div>
  );
}

/**
 * Imperial Golden Wax Seal SVG with subtle pulse
 */
function ImperialSeal() {
  return (
    <div className="relative flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-full border border-[#D4AF37]/50 bg-gradient-to-br from-[#1A1814] via-[#100F0C] to-[#0A0907] shadow-[0_0_25px_rgba(212,175,55,0.2)]">
      {/* Outer Rotating/Pulsing Glow Ring */}
      <div className="absolute inset-0 rounded-full border border-[#D4AF37]/30 animate-pulse pointer-events-none" />
      <svg className="w-10 h-10 sm:w-11 sm:h-11 text-[#D4AF37]" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        {/* Double Inner Circle */}
        <circle cx="50" cy="50" r="44" strokeWidth="1.5" strokeDasharray="3,2" />
        <circle cx="50" cy="50" r="38" strokeWidth="2" />
        {/* Imperial Emblem / Eagle & Gladius */}
        <path d="M 50 18 L 50 82 M 30 36 L 70 36 M 34 50 L 66 50 M 40 64 L 60 64" strokeWidth="2" strokeLinecap="round" />
        <circle cx="50" cy="22" r="4" fill="#D4AF37" />
        {/* Laurel Branches Left & Right */}
        <path d="M 22 50 C 22 32 34 22 50 22 C 66 22 78 32 78 50" strokeWidth="1" strokeDasharray="2,3" />
      </svg>
    </div>
  );
}

export function GeneralsCodex({
  userTier: controlledUserTier,
  className = "",
  onRequestAccess,
  onOpenVideo,
  defaultChapter = 1,
}: GeneralsCodexProps) {
  // Local tier state if not controlled externally
  const [internalTier, setInternalTier] = useState<UserTier>(() => getStoredUserTier());
  const userTier = controlledUserTier ?? internalTier;

  // Active Chapter (1, 2, or 3)
  const [activeChapterId, setActiveChapterId] = useState<1 | 2 | 3>(defaultChapter);
  const [viewingDeepLibro1, setViewingDeepLibro1] = useState(false);
  const [viewingDeepLibro2, setViewingDeepLibro2] = useState(false);

  // Internal Gatekeeping Modal state (fallback when onRequestAccess isn't supplied)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalReason, setModalReason] = useState<string>("");

  const activeChapter = CHAPTERS.find((ch) => ch.id === activeChapterId) ?? CHAPTERS[0];

  const handleTierToggle = (tier: UserTier) => {
    setInternalTier(tier);
    setStoredUserTier(tier);
  };

  const handleStudyChapter = (chapter: ChapterData) => {
    if (userTier === "member") {
      if (onOpenVideo) {
        onOpenVideo(chapter.id, chapter.academyModuleId, chapter.academyLessonId);
      } else {
        // Fallback navigation to Academy
        window.location.assign(`/academy?tab=course&lesson=${encodeURIComponent(chapter.academyLessonId)}`);
      }
    } else {
      // Sandbox tier -> Gatekeeping Protected
      const reason = `Richiesta di Sblocco Dottrina: ${chapter.title} (${chapter.subtitle}) — Archetipo ${chapter.archetype}`;
      if (onRequestAccess) {
        onRequestAccess(reason);
      } else {
        setModalReason(reason);
        setIsModalOpen(true);
      }
    }
  };

  return (
    <section
      className={`relative w-full rounded-2xl sm:rounded-3xl border border-[#C5A059]/40 bg-[#07080C] text-[#F4F4F6] p-4 sm:p-8 lg:p-10 shadow-[0_0_50px_rgba(197,160,89,0.06)] overflow-hidden ${className}`}
      aria-label="La Dottrina dei Generali - Codex Tattico"
    >
      {/* Texture Layer: Subtle Dark Tactical Grid & Gold Vignette */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 0%, rgba(197, 160, 89, 0.12) 0%, transparent 70%), linear-gradient(to right, rgba(197,160,89,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(197,160,89,0.03) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 36px 36px, 36px 36px",
        }}
      />

      {/* Decorative Antique Brass Corner Ornaments */}
      <div className="absolute top-3 left-3 h-4 w-4 border-t-2 border-l-2 border-[#C5A059]/70 pointer-events-none" />
      <div className="absolute top-3 right-3 h-4 w-4 border-t-2 border-r-2 border-[#C5A059]/70 pointer-events-none" />
      <div className="absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-[#C5A059]/70 pointer-events-none" />
      <div className="absolute bottom-3 right-3 h-4 w-4 border-b-2 border-r-2 border-[#C5A059]/70 pointer-events-none" />

      {/* Header Bar: Monospace Eyebrow, Imperial Title, Crest & Tier Pill */}
      <header className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-[#C5A059]/20">
        <div className="flex items-start gap-4 sm:gap-5">
          <ImperialSeal />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] sm:text-xs font-bold tracking-[0.22em] text-[#C5A059] uppercase">
                CODEX GENERALIVM // DOCTRINA MILITARIS ET FINANCIARIA
              </span>
              <span className="hidden sm:inline-block h-1 w-1 rounded-full bg-[#D4AF37]" />
              <span className="hidden sm:inline font-mono text-[10px] text-slate-400">
                ORDINE FRATTALE DI GUERRA
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              La Dottrina dei Generali
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Dall&apos;Assedio alla Lama: i 3 step operativi del metodo (Mappatura HTF, Filtri ITF, Esecuzione LTF)
              reinterpretati attraverso l&apos;arte bellica dei più grandi strateghi della storia.
            </p>
          </div>
        </div>

        {/* User Tier Status Badge & Quick Preview Switcher */}
        <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400 text-[11px]">STATO OPERATORE:</span>
            <span
              className={`px-3 py-1 rounded-lg border font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5 ${
                userTier === "member"
                  ? "border-[#10B981]/50 bg-[#10B981]/15 text-[#10B981] shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                  : "border-amber-500/50 bg-amber-500/10 text-amber-400"
              }`}
            >
              {userTier === "member" ? (
                <>
                  <Unlock className="h-3 w-3" />
                  MEMBRO ATTIVO (ACCESSO TOTALE)
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3" />
                  SANDBOX (ACCESSO LIMITATO)
                </>
              )}
            </span>
          </div>

          {/* Discreet tier toggle helper for demo/testing */}
          {!controlledUserTier && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-[#0E1017] p-1 rounded-md border border-[#1E2230]">
              <span className="px-1.5 text-slate-400">SIMULA:</span>
              <button
                type="button"
                onClick={() => handleTierToggle("sandbox")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  userTier === "sandbox" ? "bg-amber-500/20 text-amber-300 font-bold" : "hover:text-white"
                }`}
              >
                Sandbox
              </button>
              <button
                type="button"
                onClick={() => handleTierToggle("member")}
                className={`px-2 py-0.5 rounded transition-colors ${
                  userTier === "member" ? "bg-[#10B981]/20 text-[#10B981] font-bold" : "hover:text-white"
                }`}
              >
                Membro
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Chapter Navigation Tabs: The 3 Parchment / Brass Folios */}
      <nav
        className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 my-8"
        aria-label="Capitoli della Dottrina dei Generali"
      >
        {CHAPTERS.map((ch) => {
          const isActive = activeChapterId === ch.id;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => {
                setActiveChapterId(ch.id);
                if (ch.id !== 1) setViewingDeepLibro1(false);
                if (ch.id !== 2) setViewingDeepLibro2(false);
              }}
              className={`group relative text-left rounded-xl p-4 sm:p-5 transition-all duration-300 border overflow-hidden ${
                isActive
                  ? "border-[#D4AF37] bg-gradient-to-b from-[#181611] to-[#0D0C0A] shadow-[0_0_30px_rgba(212,175,55,0.18)]"
                  : "border-[#C5A059]/20 bg-[#0C0D12]/80 hover:border-[#C5A059]/50 hover:bg-[#12131A]"
              }`}
            >
              {/* Active Golden Highlight Bar */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#C5A059] via-[#D4AF37] to-[#C5A059]" />
              )}

              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-xs font-black px-2 py-0.5 rounded ${
                      isActive
                        ? "bg-[#D4AF37] text-[#0A0A0C]"
                        : "bg-[#C5A059]/15 text-[#C5A059]"
                    }`}
                  >
                    CAP. {ch.roman}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                    {ch.timeframe}
                  </span>
                </div>

                {/* Chapter Icon */}
                <div
                  className={`h-7 w-7 rounded-lg flex items-center justify-center transition-colors ${
                    isActive
                      ? "border border-[#D4AF37]/50 bg-[#D4AF37]/20 text-[#D4AF37]"
                      : "border border-white/10 bg-white/5 text-slate-400 group-hover:text-[#C5A059]"
                  }`}
                >
                  {ch.id === 1 && <Compass className="h-4 w-4" />}
                  {ch.id === 2 && <Shield className="h-4 w-4" />}
                  {ch.id === 3 && <Crosshair className="h-4 w-4" />}
                </div>
              </div>

              {/* Title & Archetype */}
              <div className="space-y-1">
                <h3 className="font-display text-lg sm:text-xl font-bold text-white group-hover:text-[#F4E6B0] transition-colors">
                  {ch.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs font-mono text-[#D4AF37]">
                  <Crown className="h-3 w-3 text-[#D4AF37]" />
                  <span>{ch.archetype}</span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>{ch.latinMotto}</span>
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform ${
                    isActive ? "rotate-90 text-[#D4AF37]" : "text-slate-600"
                  }`}
                />
              </div>
            </button>
          );
        })}
      </nav>

      {/* Active Chapter Display: "Libro Aperto" with Animated Parchment Unfurl */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeChapter.id}
          initial={{ opacity: 0, y: 16, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.99 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 space-y-8"
        >
          {/* Chapter Banner & Archetype Attribution */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-xl border border-[#C5A059]/30 bg-gradient-to-r from-[#14120D] via-[#16140F] to-[#0F1015]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold text-[#D4AF37] tracking-widest uppercase">
                  LIBER {activeChapter.roman} · {activeChapter.latinMotto}
                </span>
                <span className="text-slate-600">/</span>
                <span className="font-mono text-[10px] text-slate-400">{activeChapter.epoch}</span>
              </div>
              <h3 className="font-display text-xl sm:text-3xl font-black text-white">
                {activeChapter.title} — {activeChapter.subtitle}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 font-mono text-xs font-bold text-[#D4AF37]">
                <Crown className="h-3.5 w-3.5" />
                Archetipo: {activeChapter.archetype}
              </span>
            </div>
          </div>

          {/* If viewing deep Libro 1, show dedicated GeneralCodexLibro1 component */}
          {activeChapter.id === 1 && viewingDeepLibro1 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#D4AF37]/40 bg-gradient-to-r from-[#16140D] to-[#0A0B10]">
                <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] font-bold">
                  <Compass className="h-4 w-4" />
                  <span>VISTA TRATTATO ESTESO // LIBRO I: LA RICOGNIZIONE E LA MAPPATURA</span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingDeepLibro1(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#C5A059] bg-[#C5A059]/15 text-[#C5A059] font-mono text-xs font-bold hover:bg-[#C5A059] hover:text-[#0A0A0C] transition-all"
                >
                  ← Torna al Compendio Tattico
                </button>
              </div>
              <GeneralCodexLibro1
                userTier={userTier}
                onRequestAccess={onRequestAccess}
                onOpenVideo={(mod, les) => onOpenVideo?.(1, mod, les)}
              />
            </div>
          ) : activeChapter.id === 2 && viewingDeepLibro2 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-[#D4AF37]/40 bg-gradient-to-r from-[#16140D] to-[#0A0B10]">
                <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] font-bold">
                  <Shield className="h-4 w-4" />
                  <span>VISTA TRATTATO ESTESO // LIBRO II: LA FALANGE E LE SCHEMATICHE DI ACCUMULAZIONE</span>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingDeepLibro2(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#C5A059] bg-[#C5A059]/15 text-[#C5A059] font-mono text-xs font-bold hover:bg-[#C5A059] hover:text-[#0A0A0C] transition-all"
                >
                  ← Torna al Compendio Tattico
                </button>
              </div>
              <GeneralsCodexLibro2
                userTier={userTier}
                onRequestAccess={onRequestAccess}
                onOpenVideo={(mod, les) => onOpenVideo?.(2, mod, les)}
              />
            </div>
          ) : (
            <>
              {/* Optional Prompt Banner to open Deep Libro 1 */}
              {activeChapter.id === 1 && (
                <div className="rounded-xl border border-[#D4AF37]/50 bg-gradient-to-r from-[#181610] via-[#12110D] to-[#0A0B10] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/15 flex items-center justify-center text-[#D4AF37] shrink-0">
                      <Compass className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-bold text-white">
                        Trattato Completo Libro I: Le 3 Leggi di Wyckoff &amp; Mappatura HTF
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Approfondisci Domanda/Offerta, Causa/Effetto, Sforzo/Risultato e l&apos;ordine operativo pratico.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingDeepLibro1(true)}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D4AF37] bg-[#D4AF37] text-[#0A0A0C] font-mono text-xs font-black shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:bg-[#e2bd47] transition-all"
                  >
                    <span>Apri Trattato Libro I</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Optional Prompt Banner to open Deep Libro 2 */}
              {activeChapter.id === 2 && (
                <div className="rounded-xl border border-[#D4AF37]/50 bg-gradient-to-r from-[#181610] via-[#12110D] to-[#0A0B10] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/15 flex items-center justify-center text-[#D4AF37] shrink-0">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-bold text-white">
                        Trattato Completo Libro II: La Falange &amp; Schematiche di Accumulazione
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Approfondisci PS, SC, AR, ST, Spring / ST(b), SOS e JTC con la mappa vettoriale del box Wyckoff.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewingDeepLibro2(true)}
                    className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D4AF37] bg-[#D4AF37] text-[#0A0A0C] font-mono text-xs font-black shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:bg-[#e2bd47] transition-all"
                  >
                    <span>Apri Trattato Libro II</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* Main 2-Column Content Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column (7 Cols): Quote, Tactical Animated Graphic & Trading Parallel */}
            <div className="lg:col-span-7 space-y-6">
              {/* General's Highlight Quote Card */}
              <div className="relative rounded-2xl border border-[#C5A059]/40 bg-gradient-to-br from-[#12110D] via-[#0D0E13] to-[#0A0B0E] p-6 sm:p-7 shadow-xl overflow-hidden">
                <div className="absolute top-2 right-4 font-serif text-6xl sm:text-7xl text-[#C5A059]/15 select-none pointer-events-none">
                  “
                </div>
                <div className="relative z-10 space-y-3">
                  <span className="inline-block font-mono text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.2em]">
                    // MASSIMA DOTTRINALE DEL CONDOTTIERO
                  </span>
                  <blockquote className="font-display font-serif text-base sm:text-lg lg:text-xl text-slate-100 leading-relaxed italic">
                    {activeChapter.quote}
                  </blockquote>
                  <cite className="block not-italic font-mono text-xs text-[#C5A059] pt-1">
                    — {activeChapter.quoteAuthor}
                  </cite>
                </div>
              </div>

              {/* Animated Tactical Graphic Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#D4AF37] font-bold flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
                    SIMULATORE TATTICO SVG INTERATTIVO
                  </span>
                  <span className="text-slate-400 text-[10px]">RADAR VECTORIALE LIVE</span>
                </div>

                {/* Render Graphic Corresponding to Active Chapter */}
                {activeChapter.id === 1 && <TacticalMapHTF />}
                {activeChapter.id === 2 && <PhalanxCounterITF />}
                {activeChapter.id === 3 && <SniperAssaultLTF />}
              </div>

              {/* Deep Trading Parallel */}
              <div className="rounded-2xl border border-[#1E2230] bg-[#0A0B10] p-6 space-y-3">
                <div className="flex items-center gap-2 text-[#C5A059] font-mono text-xs font-bold uppercase tracking-wider">
                  <BookOpen className="h-4 w-4" />
                  <span>{activeChapter.tradingParallelTitle}</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {activeChapter.tradingParallel}
                </p>
              </div>
            </div>

            {/* Right Column (5 Cols): Raw Operational Orders & Academy CTA */}
            <div className="lg:col-span-5 space-y-6">
              {/* Technical Metrics HUD Card */}
              <div className="rounded-2xl border border-[#C5A059]/30 bg-[#0E1017] p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-[#1E2230] pb-2 font-mono text-[11px]">
                  <span className="text-slate-400">PARAMETRI CRUCIALI</span>
                  <span className="text-[#D4AF37] font-bold">FASE {activeChapter.id} DI 3</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {activeChapter.metrics.map((m, i) => (
                    <div key={i} className="rounded-lg border border-[#1E2230] bg-[#07080C] p-3 space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>{m.label}</span>
                        <span className="text-[9px] text-[#C5A059] font-bold">{m.tag}</span>
                      </div>
                      <div className="font-mono text-xs sm:text-sm font-bold text-white">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Raw Operational Orders (Checklist Dottrinale) */}
              <div className="rounded-2xl border border-[#C5A059]/30 bg-[#0A0B10] p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1E2230] pb-3">
                  <div className="space-y-0.5">
                    <span className="font-mono text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">
                      DIRETTIVA TATTICA OPERATIVA
                    </span>
                    <h4 className="font-bold text-sm text-white">L&apos;Ordine Crudo sul Mercato</h4>
                  </div>
                  <span className="font-mono text-xs px-2 py-0.5 rounded border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#C5A059]">
                    4 REGOLE
                  </span>
                </div>

                <div className="space-y-3 font-mono">
                  {activeChapter.directives.map((dir, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-[#1E2230] bg-[#0F111A] p-3.5 space-y-1.5 hover:border-[#C5A059]/40 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#C5A059] font-bold">{dir.code}</span>
                        {dir.type === "warning" && (
                          <span className="inline-flex items-center gap-1 text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            RIGIDO
                          </span>
                        )}
                        {dir.type === "success" && (
                          <span className="inline-flex items-center gap-1 text-[#10B981]">
                            <CheckCircle2 className="h-3 w-3" />
                            CRUCIALE
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-slate-100">{dir.title}</div>
                      <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                        {dir.rule}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direct Academy Integration Card & CTA Button */}
              <div className="rounded-2xl border-2 border-[#D4AF37]/50 bg-gradient-to-br from-[#18150E] via-[#12110A] to-[#0A0B0E] p-6 space-y-4 shadow-2xl relative overflow-hidden">
                {/* Background Golden Emblem Watermark */}
                <div className="absolute -bottom-6 -right-6 opacity-10 pointer-events-none">
                  <Crown className="w-40 h-40 text-[#D4AF37]" />
                </div>

                <div className="relative z-10 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest">
                      // COLLEGAMENTO DIRETTO ACADEMY
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {activeChapter.academyDuration}
                    </span>
                  </div>
                  <h4 className="font-display text-lg font-bold text-white">
                    {activeChapter.academyModuleTitle}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Scomposizione video analitica, replay tick-by-tick e casi studio reali dedicati al{" "}
                    <strong>Capitolo {activeChapter.roman}</strong>.
                  </p>
                </div>

                {/* Status indicator row */}
                <div className="relative z-10 pt-1">
                  {userTier === "member" ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[#10B981]/40 bg-[#10B981]/15 text-[#10B981] font-mono text-xs">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>ACCESSO MEMBRO: Video lezioni e schede sbloccate</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 font-mono text-xs">
                      <Lock className="h-4 w-4 shrink-0 text-amber-400" />
                      <span>ACCESSO SANDBOX: Modulo avanzato soggetto ad ammissione</span>
                    </div>
                  )}
                </div>

                {/* Direct CTA Button: [ Studia i Video di questo Capitolo ] */}
                <div className="relative z-10 pt-2">
                  <button
                    type="button"
                    onClick={() => handleStudyChapter(activeChapter)}
                    className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E6CA65] to-[#C5A059] px-6 py-3.5 font-mono text-xs sm:text-sm font-black text-[#0A0A0C] uppercase tracking-wider shadow-[0_0_25px_rgba(212,175,55,0.35)] transition-all hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(212,175,55,0.5)] active:scale-[0.99]"
                  >
                    <Play className="h-4 w-4 fill-current shrink-0" />
                    <span>Studia i Video di questo Capitolo</span>
                    <ArrowRight className="h-4 w-4 shrink-0" />
                  </button>

                  <p className="text-[10px] text-center text-slate-400 mt-2 font-mono">
                    {userTier === "member"
                      ? "Apre istantaneamente il player video sul Modulo " + activeChapter.academyModuleId
                      : "Verifica l'idoneità tecnica nel protocollo tramite il modulo di candidatura"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </motion.div>
      </AnimatePresence>

      {/* Internal Fallback Gatekeeping Modal */}
      <GatekeepingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialReason={modalReason}
      />
    </section>
  );
}

export default GeneralsCodex;
