import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Compass,
  Crown,
  Play,
  Lock,
  Unlock,
  ChevronDown,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Layers,
  Target,
} from "lucide-react";
import { GatekeepingModal } from "./GatekeepingModal";
import { getStoredUserTier, setStoredUserTier, type UserTier } from "@/lib/stealthTracking";

export interface GeneralCodexLibro1Props {
  userTier?: UserTier;
  className?: string;
  onRequestAccess?: (reason?: string) => void;
  onOpenVideo?: (moduleId: number, lessonId: string) => void;
}

interface WyckoffPillar {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  latinName: string;
  icon: "demand" | "cause" | "effort";
  summary: string;
  deepDive: string;
  tradingApplication: string;
  keyMetrics: { label: string; value: string }[];
}

const WYCKOFF_PILLARS: WyckoffPillar[] = [
  {
    id: "pillar-1",
    number: "I",
    title: "La Legge della Domanda e dell'Offerta",
    subtitle: "Analisi dello Squilibrio Primario del Campo di Battaglia",
    latinName: "Lex Postulandi et Praebendi",
    icon: "demand",
    summary:
      "Il prezzo non si muove per caso: è governato dalla bilancia tra ordini di acquisto e vendita istituzionali.",
    deepDive:
      "Quando l'offerta supera la domanda, il prezzo è matematicamente costretto a scendere in cerca di liquidità a sconto. Quando la domanda prosciuga l'offerta flottante disponibile, l'espansione al rialzo diventa meccanicamente inevitabile. Il retail compra quando il prezzo sale (inseguendo l'impulso tardivo); i grandi condottieri dell'order flow comprano nel silenzio quando l'offerta si esaurisce nell'area di sconto.",
    tradingApplication:
      "Ispezione dell'Order Flow Imbalance su Daily/H4. Divieto assoluto di acquisto se il mercato si trova in zona Premium (sopra il 50% dell'Equilibrium). Ingresso solo dopo la saturazione dell'offerta.",
    keyMetrics: [
      { label: "SOGLIA MATEMATICA", value: "Equilibrium 50.0%" },
      { label: "STATO OFFERTA", value: "Esaurimento / Float Secco" },
      { label: "TIMEFRAME DOMINANTE", value: "Daily → H4" },
    ],
  },
  {
    id: "pillar-2",
    number: "II",
    title: "La Legge della Causa e dell'Effetto",
    subtitle: "Studio delle Fasi di Accumulazione e Distribuzione (Mark Up / Mark Down)",
    latinName: "Lex Causae et Effectus",
    icon: "cause",
    summary:
      "Nessun movimento direzionale esplosivo avviene senza una prolungata fase preparatoria orizzontale.",
    deepDive:
      "La Causa è il tempo e il volume impiegati dalle mani forti per assorbire contratti (Accumulazione) o scaricarli sul retail (Distribuzione). L'Effetto è la corsa direzionale conseguente (Mark Up verso l'alto o Mark Down verso il basso). Maggiore è l'ampiezza orizzontale della causa, maggiore sarà l'estensione dell'effetto. Chi cerca breakout immediati senza una causa solida finisce regolarmente tritato nelle finte rotture.",
    tradingApplication:
      "Riconoscimento delle schematiche Wyckoff di Tipo 1 e 2. Mappatura della fase di accumulazione prima del Mark Up istituzionale. Proiezione dei target di arrivo sui pool di liquidità opposti.",
    keyMetrics: [
      { label: "DURATA DELLA CAUSA", value: "Range Orizzontale H4/Daily" },
      { label: "ESITO ATTESO", value: "Mark Up / Mark Down Violento" },
      { label: "RAPPORTO TEMPO/SPINTA", value: "Proporzionale alla Base" },
    ],
  },
  {
    id: "pillar-3",
    number: "III",
    title: "La Legge dello Sforzo vs Risultato",
    subtitle: "Rilevamento delle Anomalie di Volume per Smascherare le Trappole Istituzionali",
    latinName: "Lex Conatus et Eventus",
    icon: "effort",
    summary:
      "Il volume rappresenta lo sforzo energetico speso; la candela di prezzo rappresenta il risultato ottenuto.",
    deepDive:
      "Se registriamo un volume titanico (enorme sforzo) ma il corpo della candela è compresso con lunghe ombre (scarso risultato), siamo in presenza di un assorbimento nascosto: gli istituzionali stanno bloccando il movimento contro gli ordini della folla. Al contrario, se un massimo viene violato con volume flebile, siamo davanti a una trappola priva di interesse reale (Upthrust / Fakeout) pronta a collassare.",
    tradingApplication:
      "Confronto costante tra delta volumetrico e ampiezza di chiusura della candela. Individuazione dello Spring su minimi e dell'Upthrust su massimi per posizionarsi contro la trappola del retail.",
    keyMetrics: [
      { label: "ANOMALIA PRINCIPALE", value: "Volume Climax + Corpo Corto" },
      { label: "SEGNALE OPERATIVO", value: "Assorbimento / Spring Trap" },
      { label: "CONFERMA OBBLIGATORIA", value: "Displacement Successivo" },
    ],
  },
];

const OPERATIONAL_STEPS = [
  {
    step: "01",
    code: "HTF-BOUNDS",
    title: "Ispezione Confini Daily / H4",
    desc: "Mappatura millimetrica di PDH (Previous Day High), PDL (Previous Day Low), massimi e minimi settimanali (PWH/PWL). Le contrattazioni al centro del range sono scartate come rumore ingannevole.",
    tag: "GEOGRAFIA",
  },
  {
    step: "02",
    code: "CLEAN-LIQUIDITY",
    title: "Individuazione Liquidità Pulita (EQH / EQL)",
    desc: "Marcatura visiva degli Equal Highs ed Equal Lows lasciati scoperti. Dove il retail vede una 'resistenza invalicabile', noi vediamo ordini pendenti e stop loss pronti a essere spazzati via.",
    tag: "BERSAGLI",
  },
  {
    step: "03",
    code: "IMBALANCE-MAP",
    title: "Mappatura delle Inefficienze (FVG Vergini)",
    desc: "Catalogazione dei Fair Value Gap non mitigati su Daily e H4. Il mercato è un algoritmo che cerca sempre la riconciliazione del valore equo: queste aree agiscono come calamite inevitabili.",
    tag: "ATTRAZIONE",
  },
  {
    step: "04",
    code: "BIAS-INVALIDATION",
    title: "Dichiarazione del Bias & Livello Morto",
    desc: "Dichiarazione scritta dello scenario operativo prima dell'apertura della sessione, con fissazione del livello esatto che annulla istantaneamente il piano. Senza invalidazione dichiarata, non esiste trade.",
    tag: "DISCIPLINA",
  },
];

/**
 * Advanced Strategic Map SVG illustration showing Wyckoff Accumulation/Distribution
 * and Higher Timeframe Liquidity Cartography
 */
function StrategicMapWyckoffIllustration() {
  return (
    <div className="relative w-full aspect-[16/10] sm:aspect-[21/9] rounded-xl border border-[#C5A059]/40 bg-[#06070B] overflow-hidden shadow-2xl">
      {/* Holographic Topographic Mesh */}
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="wyckoff-holo-grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M 36 0 L 0 0 0 36" fill="none" stroke="#C5A059" strokeWidth="0.5" strokeDasharray="1,4" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wyckoff-holo-grid)" />
      </svg>

      {/* Holographic Radar Glow Line */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C5A059]/15 to-transparent pointer-events-none"
        style={{
          animation: "holoScan 6s ease-in-out infinite alternate",
          width: "40%",
        }}
      />

      <style>{`
        @keyframes holoScan {
          0% { transform: translateX(-80%); }
          100% { transform: translateX(260%); }
        }
      `}</style>

      {/* Strategic Schematic Vector */}
      <svg className="relative z-10 w-full h-full" viewBox="0 0 880 370" preserveAspectRatio="xMidYMid meet">
        {/* PREMIUM ZONE (DISTRIBUTION PHASE) */}
        <rect x="50" y="25" width="780" height="60" rx="6" fill="#C5A059" fillOpacity="0.08" stroke="#C5A059" strokeWidth="1" strokeDasharray="3,3" />
        <text x="65" y="48" fill="#D4AF37" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="bold" letterSpacing="1.5">
          ▲ FASE DI DISTRIBUZIONE WYCKOFF // BUY-SIDE LIQUIDITY (BSL · MASSIMO SETTIMANALE)
        </text>
        <text x="65" y="66" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
          CAUSA DISTRIBUTIVA: UTP / UTAD (UPTHRUST) · ASSORBIMENTO CONTRATTI IN VENDITA
        </text>
        <rect x="730" y="38" width="85" height="22" rx="4" fill="#141418" stroke="#C5A059" strokeWidth="0.8" />
        <text x="742" y="52" fill="#D4AF37" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          PREMIUM
        </text>

        {/* 50% EQUILIBRIUM LINE */}
        <line x1="50" y1="185" x2="830" y2="185" stroke="#C5A059" strokeWidth="1.5" strokeDasharray="6,4" opacity="0.7" />
        <circle cx="440" cy="185" r="4" fill="#D4AF37" />
        <text x="452" y="181" fill="#E6CA65" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          SOGLIA MEDIANA 50.0% EQUILIBRIUM (SPARTIACQUE TRA CAUSA ED EFFETTO)
        </text>

        {/* DISCOUNT ZONE (ACCUMULATION PHASE) */}
        <rect x="50" y="285" width="780" height="60" rx="6" fill="#10B981" fillOpacity="0.07" stroke="#10B981" strokeWidth="1" strokeDasharray="3,3" />
        <text x="65" y="308" fill="#10B981" fontSize="11" fontFamily="JetBrains Mono, monospace" fontWeight="bold" letterSpacing="1.5">
          ▼ FASE DI ACCUMULAZIONE WYCKOFF // SELL-SIDE LIQUIDITY (SSL · MINIMO SETTIMANALE)
        </text>
        <text x="65" y="326" fill="#94A3B8" fontSize="9.5" fontFamily="JetBrains Mono, monospace">
          CAUSA ACCUMULATIVA: SC (SELLING CLIMAX) · ST · SPRING DI MANIPOLAZIONE
        </text>
        <rect x="730" y="298" width="85" height="22" rx="4" fill="#0A140F" stroke="#10B981" strokeWidth="0.8" />
        <text x="738" y="312" fill="#10B981" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          DISCOUNT
        </text>

        {/* Dynamic Wyckoff Price Path (Spring -> Mark Up -> UTAD -> Mark Down) */}
        <path
          d="M 80 300 Q 130 260 170 305 T 220 325 T 280 270 T 360 185 T 460 110 T 560 50 T 630 38 T 680 90 T 750 185 T 800 270"
          fill="none"
          stroke="url(#wyckoffCurveGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        <defs>
          <linearGradient id="wyckoffCurveGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="25%" stopColor="#34D399" />
            <stop offset="45%" stopColor="#D4AF37" />
            <stop offset="75%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#EF4444" />
          </linearGradient>
        </defs>

        {/* SPRING POINT PIN (Discount Bottom Manipulation) */}
        <g transform="translate(220, 325)">
          <circle cx="0" cy="0" r="10" fill="#10B981" fillOpacity="0.2" stroke="#10B981" strokeWidth="1.8">
            <animate attributeName="r" values="8;16;8" dur="2.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r="3.5" fill="#10B981" />
          <line x1="0" y1="0" x2="0" y2="-20" stroke="#10B981" strokeWidth="1" strokeDasharray="2,2" />
          <rect x="-45" y="-40" width="90" height="18" rx="3" fill="#090A0F" stroke="#10B981" strokeWidth="0.8" />
          <text x="-40" y="-28" fill="#10B981" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            SPRING (TRAP)
          </text>
        </g>

        {/* MARK UP EXPANSION VECTOR */}
        <g transform="translate(390, 140)">
          <rect x="0" y="0" width="130" height="22" rx="4" fill="#141418" stroke="#D4AF37" strokeWidth="1" />
          <text x="8" y="15" fill="#D4AF37" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            MARK UP EFFETTO ▲
          </text>
        </g>

        {/* UTAD / SWEEP PIN (Premium Top Manipulation) */}
        <g transform="translate(630, 38)">
          <circle cx="0" cy="0" r="12" fill="#D4AF37" fillOpacity="0.25" stroke="#D4AF37" strokeWidth="2">
            <animate attributeName="r" values="9;18;9" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r="4" fill="#D4AF37" />
          <line x1="0" y1="0" x2="0" y2="24" stroke="#D4AF37" strokeWidth="1" strokeDasharray="2,2" />
          <rect x="-55" y="26" width="110" height="20" rx="3" fill="#090A0F" stroke="#D4AF37" strokeWidth="1" />
          <text x="-50" y="40" fill="#F4E6B0" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            UTAD // SWEEP BSL
          </text>
        </g>

        {/* EFFORT VS RESULT VOLUME ANOMALY BARS */}
        <g transform="translate(80, 240)">
          <rect x="0" y="0" width="16" height="30" fill="#10B981" opacity="0.8" />
          <rect x="22" y="10" width="16" height="20" fill="#10B981" opacity="0.5" />
          <rect x="44" y="-10" width="16" height="40" fill="#10B981" opacity="0.95" />
          <text x="70" y="10" fill="#10B981" fontSize="9" fontFamily="JetBrains Mono, monospace">
            VOLUME CLIMAX (SFORZO SUL MINIMO = SPRING REALE)
          </text>
        </g>

        <g transform="translate(560, 110)">
          <rect x="0" y="0" width="16" height="15" fill="#EF4444" opacity="0.5" />
          <rect x="22" y="-5" width="16" height="20" fill="#EF4444" opacity="0.6" />
          <rect x="44" y="5" width="16" height="10" fill="#EF4444" opacity="0.4" />
          <text x="70" y="10" fill="#EF4444" fontSize="9" fontFamily="JetBrains Mono, monospace">
            VOLUME ANEMICO (SCARSO SFORZO SUL MASSIMO = UTAD FALSO)
          </text>
        </g>
      </svg>

      {/* Bottom HUD Tactical Bar */}
      <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[10px] font-mono text-slate-300 bg-[#090A0F]/90 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-[#C5A059]/30">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#D4AF37] animate-pulse" />
          <span className="font-bold text-white">CARTOGRAFIA HIGHER TIMEFRAME:</span>
          <span className="text-[#D4AF37]">LE 3 LEGGI DI WYCKOFF ATTIVE // BIAS ROTAZIONALE</span>
        </div>
        <span className="text-[#C5A059] hidden sm:inline">SUN TZU & SCIPIONE L&apos;AFRICANO</span>
      </div>
    </div>
  );
}

export function GeneralCodexLibro1({
  userTier: controlledUserTier,
  className = "",
  onRequestAccess,
  onOpenVideo,
}: GeneralCodexLibro1Props) {
  const [internalTier, setInternalTier] = useState<UserTier>(() => getStoredUserTier());
  const userTier = controlledUserTier ?? internalTier;

  const [expandedPillar, setExpandedPillar] = useState<string>("pillar-1");
  const [activeTab, setActiveTab] = useState<"wyckoff" | "steps" | "map">("wyckoff");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalReason, setModalReason] = useState<string>("");

  const handleTierToggle = (tier: UserTier) => {
    setInternalTier(tier);
    setStoredUserTier(tier);
  };

  const handleStudyClick = () => {
    if (userTier === "member") {
      if (onOpenVideo) {
        onOpenVideo(1, "m1-l1");
      } else {
        window.location.assign("/academy?tab=course&lesson=m1-l1");
      }
    } else {
      const reason =
        "Richiesta di ammissione: Libro I - La Ricognizione e la Mappatura HTF (Leggi di Wyckoff & Liquidità)";
      if (onRequestAccess) {
        onRequestAccess(reason);
      } else {
        setModalReason(reason);
        setIsModalOpen(true);
      }
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl sm:rounded-3xl border border-[#C5A059]/40 bg-[#07080C] text-[#F4F4F6] p-5 sm:p-8 lg:p-10 shadow-[0_0_50px_rgba(197,160,89,0.08)] overflow-hidden ${className}`}
      aria-label="Libro I: La Ricognizione e la Mappatura"
    >
      {/* Texture: Pergamena Olografica Tattica */}
      <div
        className="absolute inset-0 pointer-events-none opacity-35"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 0%, rgba(197, 160, 89, 0.14) 0%, transparent 70%), linear-gradient(to right, rgba(197,160,89,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(197,160,89,0.035) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 36px 36px, 36px 36px",
        }}
      />

      {/* Decorative Antique Brass Corner Flairs */}
      <div className="absolute top-3 left-3 h-4 w-4 border-t-2 border-l-2 border-[#C5A059]/80 pointer-events-none" />
      <div className="absolute top-3 right-3 h-4 w-4 border-t-2 border-r-2 border-[#C5A059]/80 pointer-events-none" />
      <div className="absolute bottom-3 left-3 h-4 w-4 border-b-2 border-l-2 border-[#C5A059]/80 pointer-events-none" />
      <div className="absolute bottom-3 right-3 h-4 w-4 border-b-2 border-r-2 border-[#C5A059]/80 pointer-events-none" />

      {/* Header Section */}
      <header className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#C5A059]/20">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl border border-[#D4AF37]/50 bg-gradient-to-br from-[#1C1A14] to-[#0A0907] text-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.25)] shrink-0">
            <Compass className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] sm:text-xs font-bold tracking-[0.2em] text-[#C5A059] uppercase">
                CODEX TACTICVS // LIBER I
              </span>
              <span className="h-1 w-1 rounded-full bg-[#D4AF37]" />
              <span className="font-mono text-[10px] text-slate-400">
                TIMEFRAME: DAILY · H4 · H1
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              LIBRO I: LA RICOGNIZIONE E LA MAPPATURA
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              La dominazione del campo di battaglia prima del contatto armato: le 3 Leggi di Wyckoff,
              la cartografia della liquidità istituzionale e la fissazione dell&apos;invalidazione oggettiva.
            </p>
          </div>
        </div>

        {/* User Tier Status Badge & Simulation */}
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
                  <Unlock className="h-3.5 w-3.5" />
                  MEMBRO ATTIVO (SBLOCCATO)
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  SANDBOX (PROTETTO)
                </>
              )}
            </span>
          </div>

          {!controlledUserTier && (
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-[#0E1017] p-1 rounded-md border border-[#1E2230]">
              <span className="px-1 text-slate-500">SIMULA:</span>
              <button
                type="button"
                onClick={() => handleTierToggle("sandbox")}
                className={`px-2 py-0.5 rounded ${
                  userTier === "sandbox" ? "bg-amber-500/20 text-amber-300 font-bold" : "hover:text-white"
                }`}
              >
                Sandbox
              </button>
              <button
                type="button"
                onClick={() => handleTierToggle("member")}
                className={`px-2 py-0.5 rounded ${
                  userTier === "member" ? "bg-[#10B981]/20 text-[#10B981] font-bold" : "hover:text-white"
                }`}
              >
                Membro
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Condottiero War Quote Card */}
      <div className="relative z-10 my-6 rounded-2xl border border-[#C5A059]/40 bg-gradient-to-br from-[#12110D] via-[#0E0F14] to-[#0A0A0E] p-6 sm:p-7 shadow-xl overflow-hidden">
        <div className="absolute top-2 right-4 font-serif text-6xl text-[#C5A059]/15 select-none pointer-events-none">
          “
        </div>
        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-[#D4AF37]" />
            <span className="font-mono text-[10px] font-bold text-[#D4AF37] uppercase tracking-[0.2em]">
              ARCHETIPO: SUN TZU & SCIPIONE L&apos;AFRICANO
            </span>
          </div>
          <blockquote className="font-display font-serif text-base sm:text-lg text-slate-100 leading-relaxed italic">
            «Il terreno detta la strategia. Chi non conosce la geografia del campo di battaglia e le leggi
            che muovono le truppe avversarie ha già perso prima di estrarre la spada.»
          </blockquote>
          <cite className="block not-italic font-mono text-xs text-[#C5A059] pt-1">
            — Sun Tzu & Scipione l&apos;Africano · Dottrina di Zama e dell&apos;Arte della Guerra
          </cite>
        </div>
      </div>

      {/* Navigation View Switcher (Wyckoff Pillars vs Practical Steps vs Strategic Map) */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 mb-6 border-b border-[#1E2230] pb-3 font-mono text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("wyckoff")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === "wyckoff"
              ? "bg-[#D4AF37] text-[#0A0A0C] font-black shadow-[0_0_20px_rgba(212,175,55,0.25)]"
              : "text-slate-400 hover:text-white bg-[#0E1017] border border-[#1E2230]"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>I 3 PILASTRI DI WYCKOFF & LIQUIDITÀ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("steps")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === "steps"
              ? "bg-[#D4AF37] text-[#0A0A0C] font-black shadow-[0_0_20px_rgba(212,175,55,0.25)]"
              : "text-slate-400 hover:text-white bg-[#0E1017] border border-[#1E2230]"
          }`}
        >
          <Target className="h-4 w-4" />
          <span>ORDINE OPERATIVO CRUDO (HTF FIELD MANUAL)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("map")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === "map"
              ? "bg-[#D4AF37] text-[#0A0A0C] font-black shadow-[0_0_20px_rgba(212,175,55,0.25)]"
              : "text-slate-400 hover:text-white bg-[#0E1017] border border-[#1E2230]"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>SCHEMA GRAFICO CARTOGRAFICO</span>
        </button>
      </div>

      {/* Main Content Area based on Active Tab */}
      <div className="relative z-10 space-y-6">
        {/* TAB 1: I 3 PILASTRI DI WYCKOFF (ACCORDION INTERATTIVO) */}
        {activeTab === "wyckoff" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
              <span>SCOMPOSIZIONE SCIENTIFICA DELLE FORZE DI MERCATO</span>
              <span className="text-[#D4AF37]">3 LEGGI FONDAMENTALI</span>
            </div>

            <div className="space-y-3">
              {WYCKOFF_PILLARS.map((p) => {
                const isOpen = expandedPillar === p.id;
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                      isOpen
                        ? "border-[#D4AF37] bg-gradient-to-b from-[#13120E] to-[#0A0B10] shadow-[0_0_25px_rgba(212,175,55,0.12)]"
                        : "border-[#C5A059]/25 bg-[#0A0B10]/90 hover:border-[#C5A059]/50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedPillar(isOpen ? "" : p.id)}
                      className="w-full flex items-center justify-between p-5 text-left transition-colors"
                    >
                      <div className="flex items-center gap-3.5">
                        <span
                          className={`font-mono text-xs font-black px-2.5 py-1 rounded ${
                            isOpen
                              ? "bg-[#D4AF37] text-[#0A0A0C]"
                              : "bg-[#C5A059]/20 text-[#C5A059]"
                          }`}
                        >
                          PILASTRO {p.number}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-base sm:text-lg font-bold text-white">
                              {p.title}
                            </h3>
                            <span className="hidden sm:inline font-mono text-[10px] text-slate-500">
                              ({p.latinName})
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{p.subtitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-[#D4AF37] hidden md:inline">
                          {isOpen ? "Chiudi Dottrina" : "Esamina Dettagli"}
                        </span>
                        <div
                          className={`h-7 w-7 rounded-lg border border-[#C5A059]/30 flex items-center justify-center text-[#D4AF37] transition-transform ${
                            isOpen ? "rotate-180 bg-[#C5A059]/20" : ""
                          }`}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="px-5 pb-5 pt-1 space-y-4 border-t border-[#1E2230]"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2">
                            {/* Deep Dive & Summary (7 cols) */}
                            <div className="md:col-span-7 space-y-3">
                              <div className="rounded-xl border border-[#1E2230] bg-[#0E1017] p-4 space-y-1.5">
                                <span className="font-mono text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">
                                  // MECCANICA DI FONDO
                                </span>
                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                                  {p.deepDive}
                                </p>
                              </div>

                              <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 p-4 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#10B981]">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>APPLICAZIONE OPERATIVA HIGHER TIMEFRAME</span>
                                </div>
                                <p className="text-xs text-slate-200 font-sans leading-relaxed">
                                  {p.tradingApplication}
                                </p>
                              </div>
                            </div>

                            {/* Key Parameters HUD (5 cols) */}
                            <div className="md:col-span-5 space-y-2.5">
                              <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                PARAMETRI DI CONTROLLO
                              </span>
                              <div className="space-y-2">
                                {p.keyMetrics.map((km, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between p-3 rounded-xl border border-[#1E2230] bg-[#090A0F] font-mono text-xs"
                                  >
                                    <span className="text-slate-400 text-[11px]">{km.label}:</span>
                                    <span className="text-[#D4AF37] font-bold">{km.value}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: ORDINE OPERATIVO CRUDO (HTF FIELD MANUAL) */}
        {activeTab === "steps" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
              <span>ELENCO DELLE AZIONI TATTICHE OBBLIGATORIE SUL GRAFICO</span>
              <span className="text-[#10B981]">4 STEP INDEROGABILI</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {OPERATIONAL_STEPS.map((step) => (
                <div
                  key={step.step}
                  className="rounded-2xl border border-[#C5A059]/30 bg-[#0E1017] p-5 space-y-2 hover:border-[#D4AF37] transition-colors relative overflow-hidden"
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="px-2 py-0.5 rounded bg-[#C5A059]/15 text-[#C5A059] font-black">
                      STEP {step.step} // {step.code}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300">
                      {step.tag}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-white pt-1">
                    {step.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: SCHEMA GRAFICO CARTOGRAFICO (SVG MAPPA WYCKOFF) */}
        {activeTab === "map" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
              <span>RAPPRESENTAZIONE CARTOGRAFICA STRATEGICA DEI CICLI DI MERCATO</span>
              <span className="text-[#D4AF37]">SCHEDA TATTICA HD</span>
            </div>
            <StrategicMapWyckoffIllustration />
          </div>
        )}

        {/* Always Visible Integrated Tactical Map at the Bottom if not in map tab */}
        {activeTab !== "map" && (
          <div className="pt-2">
            <StrategicMapWyckoffIllustration />
          </div>
        )}
      </div>

      {/* Direct Academy Integration Card & CTA Button */}
      <footer className="relative z-10 mt-8 rounded-2xl border-2 border-[#D4AF37]/50 bg-gradient-to-br from-[#16140E] via-[#100F0A] to-[#0A0B0E] p-6 sm:p-7 shadow-2xl space-y-4 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-[#D4AF37] uppercase tracking-widest">
                // ACADEMY PROTOCOLLO OPERATIVO
              </span>
              <span className="h-1 w-1 rounded-full bg-[#D4AF37]" />
              <span className="font-mono text-[10px] text-slate-400">
                MODULO 1: 4 LEZIONI · 1H 45M
              </span>
            </div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-white">
              Scomposizione Video: Mappatura & Cartografia HTF
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Analisi pratica a mercati aperti, identificazione dei disequilibri Daily/H4 e
              costruzione della scheda di bias pre-sessione.
            </p>
          </div>

          <div className="shrink-0">
            {userTier === "member" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-[#10B981]/40 bg-[#10B981]/15 font-mono text-xs text-[#10B981] font-bold">
                <CheckCircle2 className="h-4 w-4" />
                ACCESSO SBLOCCATO
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 font-mono text-xs text-amber-400 font-bold">
                <Lock className="h-3.5 w-3.5" />
                SOGGETTO AD AMMISSIONE
              </span>
            )}
          </div>
        </div>

        {/* Primary CTA: [ Accedi ai Video di Ricognizione HTF ] */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleStudyClick}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E6CA65] to-[#C5A059] px-6 py-3.5 font-mono text-xs sm:text-sm font-black text-[#0A0A0C] uppercase tracking-wider shadow-[0_0_25px_rgba(212,175,55,0.35)] transition-all hover:scale-[1.01] hover:shadow-[0_0_35px_rgba(212,175,55,0.5)] active:scale-[0.99]"
          >
            <Play className="h-4 w-4 fill-current shrink-0" />
            <span>Accedi ai Video di Ricognizione HTF</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>

          <p className="text-[10px] text-center text-slate-400 mt-2 font-mono">
            {userTier === "member"
              ? "Apre istantaneamente il Modulo 1: Cartografia della Liquidità BSL vs SSL"
              : "Verifica l'idoneità tecnica nel protocollo completando il questionario di candidatura"}
          </p>
        </div>
      </footer>

      {/* Internal Gatekeeping Modal Fallback */}
      <GatekeepingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialReason={modalReason}
      />
    </div>
  );
}

export default GeneralCodexLibro1;
