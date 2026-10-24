import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
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

export interface GeneralsCodexLibro2Props {
  userTier?: UserTier;
  className?: string;
  onRequestAccess?: (reason?: string) => void;
  onOpenVideo?: (moduleId: number, lessonId: string) => void;
}

interface FortressPhase {
  id: string;
  stageCode: string;
  number: string;
  title: string;
  subtitle: string;
  latinName: string;
  acronyms: string;
  summary: string;
  tacticalDescription: string;
  operationalCheck: string;
  keyMetrics: { label: string; value: string }[];
}

const FORTRESS_PHASES: FortressPhase[] = [
  {
    id: "phase-1",
    stageCode: "STAGE-01",
    number: "I",
    title: "L'Arresto e il Climax",
    subtitle: "Assorbimento Iniziale e Panico della Massa Retail",
    latinName: "Obsessio Primaria et Climax Venditionis",
    acronyms: "PS (Preliminary Support) & SC (Selling Climax)",
    summary:
      "Il primo sbarramento della falange: l'ondata di vendita retail capitola contro il muro di ordini limite istituzionali.",
    tacticalDescription:
      "Durante il Selling Climax (SC), la folla vende nel panico più totale, convinta che il prezzo precipiti all'infinito. I grandi condottieri dell'order flow aprono i cancelli della fortezza e assorbono l'intero volume a prezzi scontati. La violenza dell'assorbimento provoca un rimbalzo tecnico immediato, l'Automatic Rally (AR), definendo il tetto superiore del box, seguito dal Secondary Test (ST) che collauda la solidità del fondo.",
    operationalCheck:
      "Tracciamento immediato dell'Ice Line sul minimo di SC e del Creek Line sul massimo di AR. Divieto categorico di intervenire: il range è appena nato e necessita di maturazione.",
    keyMetrics: [
      { label: "PUNTO CHIAVE MINIMO", value: "SC (Supporto Base)" },
      { label: "PUNTO CHIAVE MASSIMO", value: "AR (Resistenza Creek)" },
      { label: "DELTA VOLUMETRICO", value: "Picco Estremo (Climax)" },
    ],
  },
  {
    id: "phase-2",
    stageCode: "STAGE-02",
    number: "II",
    title: "La Trappola della Valle",
    subtitle: "La Pulizia Chirurgica della Liquidità sui Minimi del Box",
    latinName: "Insidiae Vallis et Purgatio Liquoris",
    acronyms: "Spring / ST(b) (Secondary Test in Phase B/C)",
    summary:
      "La falsa rottura ribassista: attirare i venditori allo scoperto per intrappolarli nelle fauci della falange.",
    tacticalDescription:
      "Nelle Termopili di Wyckoff, la falange arretra apparentemente oltre l'Ice Line per simulare una disfatta. Il retail shorta il 'breakout', mentre i possessori di posizioni long vedono scattare i loro Stop Loss. Questa manipolazione genera un massiccio afflusso di liquidità che viene divorato in pochi istanti. Il prezzo rientra a razzo all'interno del box con chiusura netta: la trappola è scattata e i venditori rimangono intrappolati senza via di fuga.",
    operationalCheck:
      "Verifica della chiusura candela M15: se chiude all'interno del box con ombra lunga verso il basso, lo Spring è validato. Se il corpo candela consolida fuori, il setup è INVALIDATO.",
    keyMetrics: [
      { label: "TARGET PREDA", value: "Sell-Side Liquidity (SSL)" },
      { label: "DURATA MANIPOLAZIONE", value: "1 - 3 Candele M15" },
      { label: "SEGNALE DI TRAPPOLA", value: "Re-Entry Veloce nel Box" },
    ],
  },
  {
    id: "phase-3",
    stageCode: "STAGE-03",
    number: "III",
    title: "Il Segnale di Forza e il Salto",
    subtitle: "Rottura dei Livelli Chiave di Conferma e Ripartenza del Trend",
    latinName: "Signum Fortitudinis et Transitus Amnis",
    acronyms: "SOS (Sign of Strength) & JTC (Jump across The Creek)",
    summary:
      "L'uscita trionfale dalla fortezza: rottura conclamata della resistenza (The Creek) e avanzata nel Mark Up.",
    tacticalDescription:
      "Una volta ripuliti i minimi, l'offerta è totalmente esaurita. Gli algoritmi scatenano l'assalto con una sequenza di candele a corpo solido (Displacement) che frantuma la Creek Line (resistenza AR). È il Sign of Strength (SOS). Il salto oltre il torrente (Jump across The Creek - JTC) certifica il cambio di carattere strutturale. Il mercato esegue un rintracciamento gentile sul vecchio tetto trasformato in supporto (LPS - Last Point of Support) prima di galoppare verso i massimi HTF.",
    operationalCheck:
      "Conferma formale di 'long conf' con rottura conclamata del Creek. Posizionamento dell'ordine limite sull'LPS o sul Fair Value Gap generato dal salto.",
    keyMetrics: [
      { label: "TRIGGER DI CONFERMA", value: "Rottura Creek Line (SOS)" },
      { label: "ZONA DI INGRESSO", value: "Retest LPS / FVG di Salto" },
      { label: "ESPANSIONE ATTESA", value: "Mark Up Direzionale HTF" },
    ],
  },
];

const PRACTICAL_ACTIONS = [
  {
    code: "ACT-01 // DELIMITAZIONE BOX",
    title: "Tracciamento Perimetro della Fortezza",
    rule: "Identificare e fissare con linee orizzontali rigide il Selling Climax (minimo assoluto iniziale) e l'Automatic Rally (massimo del primo rimbalzo) su timeframe M15/H1.",
    tag: "CONFINI",
  },
  {
    code: "ACT-02 // VIGILANZA PASSIVA",
    title: "Divieto di Anticipazione nella Terra di Mezzo",
    rule: "Qualsiasi fluttuazione centrale compresa tra SC e AR è terra di nessuno. È vietato aprire operazioni speculative fino a quando il prezzo non testa gli estremi del perimetro.",
    tag: "DISCIPLINA",
  },
  {
    code: "ACT-03 // FILTRO DELLO SPRING",
    title: "Attesa della Presa di Liquidità sui Minimi",
    rule: "Attendere che il prezzo violi l'Ice Line dello SC. Pretendere un riassorbimento istantaneo entro 1-3 candele con corpo rientrato e picco di volume d'assorbimento.",
    tag: "TRAPPOLA",
  },
  {
    code: "ACT-04 // CONVALIDA SOS & JTC",
    title: "Esecuzione Esclusiva al Salto del Creek",
    rule: "Attendere che la candela di Displacement superi la Creek Line confermando il Market Structure Shift (MSS). Ingresso solo al retest dell'LPS con Stop Loss sotto lo swing protetto.",
    tag: "CONFERMA",
  },
];

/**
 * Animated Tactical SVG Box representing the Wyckoff Accumulation Schematic:
 * PS, SC, AR, ST, Spring/ST(b), SOS, JTC (Jump across The Creek)
 */
function AccumulationBoxTacticalIllustration() {
  return (
    <div className="relative w-full aspect-[16/10] sm:aspect-[21/9] rounded-xl border border-[#C5A059]/40 bg-[#06070B] overflow-hidden shadow-2xl">
      {/* Background Military Grid */}
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="wyckoff-acc-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#C5A059" strokeWidth="0.5" strokeDasharray="1,3" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wyckoff-acc-grid)" />
      </svg>

      {/* Holographic Radar Glow */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-[#C5A059]/15 to-transparent pointer-events-none"
        style={{
          animation: "phalanxRadar 5.5s linear infinite",
          width: "35%",
        }}
      />

      <style>{`
        @keyframes phalanxRadar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>

      {/* Schematic Vector Canvas */}
      <svg className="relative z-10 w-full h-full" viewBox="0 0 900 380" preserveAspectRatio="xMidYMid meet">
        {/* UPPER RESISTANCE WALL: THE CREEK LINE (AR) */}
        <line x1="60" y1="120" x2="840" y2="120" stroke="#C5A059" strokeWidth="2" strokeDasharray="6,4" />
        <rect x="70" y="105" width="220" height="22" rx="4" fill="#141418" stroke="#C5A059" strokeWidth="1" />
        <text x="80" y="120" fill="#D4AF37" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          ▲ THE CREEK LINE // RESISTENZA AR
        </text>

        {/* 50% MEDIAN BALANCE LINE */}
        <line x1="60" y1="195" x2="840" y2="195" stroke="#C5A059" strokeWidth="1" strokeDasharray="2,4" opacity="0.4" />
        <text x="730" y="191" fill="#8A6F33" fontSize="9" fontFamily="JetBrains Mono, monospace">
          MEDIANA BOX 50%
        </text>

        {/* LOWER SUPPORT WALL: THE ICE LINE (SC) */}
        <line x1="60" y1="270" x2="840" y2="270" stroke="#10B981" strokeWidth="2" strokeDasharray="6,4" />
        <rect x="70" y="275" width="200" height="22" rx="4" fill="#0A140F" stroke="#10B981" strokeWidth="1" />
        <text x="80" y="290" fill="#10B981" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          ▼ THE ICE LINE // SUPPORTO SC
        </text>

        {/* SHIELD ICONS DECORATING THE FORTRESS WALLS */}
        {[180, 320, 460, 600, 740].map((x) => (
          <g key={x} transform={`translate(${x}, 120)`}>
            <circle cx="0" cy="0" r="8" fill="#11131A" stroke="#C5A059" strokeWidth="1.2" />
            <path d="M -4 0 L 4 0 M 0 -4 L 0 4" stroke="#D4AF37" strokeWidth="1" />
          </g>
        ))}

        {/* DYNAMIC PRICE TRAJECTORY IN THE ACCUMULATION BOX */}
        {/* Downward Crash -> PS -> SC -> AR -> ST -> Inside Churn -> Spring -> Test -> SOS -> LPS -> Mark Up */}
        <path
          d="M 60 70 L 110 220 L 140 200 L 190 270 L 260 120 L 330 240 L 400 170 L 460 270 L 490 320 L 530 250 L 580 230 L 670 90 L 730 125 L 820 45"
          fill="none"
          stroke="url(#phalanxTrajectoryGrad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <defs>
          <linearGradient id="phalanxTrajectoryGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="25%" stopColor="#D4AF37" />
            <stop offset="55%" stopColor="#10B981" />
            <stop offset="85%" stopColor="#34D399" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>

        {/* POINT 1: PS (Preliminary Support) */}
        <g transform="translate(110, 220)">
          <circle cx="0" cy="0" r="4" fill="#EF4444" />
          <text x="-12" y="-10" fill="#EF4444" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            PS
          </text>
        </g>

        {/* POINT 2: SC (Selling Climax) */}
        <g transform="translate(190, 270)">
          <circle cx="0" cy="0" r="5" fill="#EF4444" />
          <circle cx="0" cy="0" r="10" fill="none" stroke="#EF4444" strokeWidth="1" strokeDasharray="2,2" />
          <text x="-10" y="22" fill="#EF4444" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            SC
          </text>
        </g>

        {/* POINT 3: AR (Automatic Rally) */}
        <g transform="translate(260, 120)">
          <circle cx="0" cy="0" r="5" fill="#D4AF37" />
          <text x="-10" y="-12" fill="#D4AF37" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            AR
          </text>
        </g>

        {/* POINT 4: ST (Secondary Test) */}
        <g transform="translate(330, 240)">
          <circle cx="0" cy="0" r="4" fill="#C5A059" />
          <text x="-8" y="18" fill="#C5A059" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            ST
          </text>
        </g>

        {/* POINT 5: SPRING / ST(b) - THE VALLEY TRAP PIN */}
        <g transform="translate(490, 320)">
          <circle cx="0" cy="0" r="12" fill="#10B981" fillOpacity="0.25" stroke="#10B981" strokeWidth="2">
            <animate attributeName="r" values="8;16;8" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="0" r="4" fill="#10B981" />
          <line x1="0" y1="0" x2="0" y2="-45" stroke="#10B981" strokeWidth="1.5" strokeDasharray="2,2" />
          <rect x="-60" y="16" width="120" height="22" rx="4" fill="#090A0F" stroke="#10B981" strokeWidth="1" />
          <text x="-52" y="31" fill="#10B981" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            SPRING / ST(b)
          </text>
        </g>

        {/* POINT 6: SOS (Sign of Strength) */}
        <g transform="translate(670, 90)">
          <circle cx="0" cy="0" r="5" fill="#10B981" />
          <circle cx="0" cy="0" r="11" fill="none" stroke="#10B981" strokeWidth="1.2" strokeDasharray="3,2" />
          <text x="-12" y="-14" fill="#10B981" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            SOS
          </text>
        </g>

        {/* POINT 7: JTC (Jump across The Creek) & LPS */}
        <g transform="translate(730, 125)">
          <circle cx="0" cy="0" r="4" fill="#D4AF37" />
          <rect x="-40" y="14" width="80" height="18" rx="3" fill="#141418" stroke="#D4AF37" strokeWidth="0.8" />
          <text x="-34" y="26" fill="#D4AF37" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            LPS (TEST)
          </text>
        </g>

        {/* FINAL EXPANSION TO MARK UP */}
        <g transform="translate(760, 60)">
          <path d="M 0 20 L 40 -10 M 30 -10 L 40 -10 L 40 0" fill="none" stroke="#10B981" strokeWidth="2.5" />
          <rect x="48" y="-22" width="80" height="22" rx="4" fill="#0A140F" stroke="#10B981" strokeWidth="1" />
          <text x="56" y="-8" fill="#10B981" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
            JTC ▲ MARK UP
          </text>
        </g>

        {/* PHASE BOUNDARIES (A, B, C, D, E) */}
        <line x1="220" y1="95" x2="220" y2="330" stroke="#C5A059" strokeWidth="0.75" strokeDasharray="3,3" opacity="0.3" />
        <line x1="430" y1="95" x2="430" y2="330" stroke="#C5A059" strokeWidth="0.75" strokeDasharray="3,3" opacity="0.3" />
        <line x1="550" y1="95" x2="550" y2="330" stroke="#C5A059" strokeWidth="0.75" strokeDasharray="3,3" opacity="0.3" />
        <line x1="700" y1="95" x2="700" y2="330" stroke="#C5A059" strokeWidth="0.75" strokeDasharray="3,3" opacity="0.3" />

        <text x="130" y="355" fill="#8A6F33" fontSize="9" fontFamily="JetBrains Mono, monospace">
          FASE A (CLIMAX)
        </text>
        <text x="290" y="355" fill="#8A6F33" fontSize="9" fontFamily="JetBrains Mono, monospace">
          FASE B (COSTRUZIONE CAUSA)
        </text>
        <text x="460" y="355" fill="#D4AF37" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          FASE C (SPRING)
        </text>
        <text x="590" y="355" fill="#10B981" fontSize="9" fontFamily="JetBrains Mono, monospace">
          FASE D (SOS)
        </text>
        <text x="730" y="355" fill="#10B981" fontSize="9" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
          FASE E (MARK UP)
        </text>
      </svg>

      {/* Bottom HUD Tactical Bar */}
      <div className="absolute bottom-2 left-4 right-4 flex items-center justify-between text-[10px] font-mono text-slate-300 bg-[#090A0F]/90 backdrop-blur-md px-3.5 py-1.5 rounded-lg border border-[#C5A059]/30">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse" />
          <span className="font-bold text-white">FORTEZZA DI ACCUMULAZIONE:</span>
          <span className="text-[#10B981]">SPRING ASSORBITO // SOS & JTC CONFERMATO</span>
        </div>
        <span className="text-[#C5A059] hidden sm:inline">LEONIDA I & GIULIO CESARE</span>
      </div>
    </div>
  );
}

export function GeneralsCodexLibro2({
  userTier: controlledUserTier,
  className = "",
  onRequestAccess,
  onOpenVideo,
}: GeneralsCodexLibro2Props) {
  const [internalTier, setInternalTier] = useState<UserTier>(() => getStoredUserTier());
  const userTier = controlledUserTier ?? internalTier;

  const [expandedPhase, setExpandedPhase] = useState<string>("phase-2");
  const [activeTab, setActiveTab] = useState<"phases" | "actions" | "schematic">("phases");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalReason, setModalReason] = useState<string>("");

  const handleTierToggle = (tier: UserTier) => {
    setInternalTier(tier);
    setStoredUserTier(tier);
  };

  const handleStudyClick = () => {
    if (userTier === "member") {
      if (onOpenVideo) {
        onOpenVideo(2, "m2-l1");
      } else {
        window.location.assign("/academy?tab=course&lesson=m2-l1");
      }
    } else {
      const reason =
        "Richiesta di ammissione: Libro II - La Falange e le Schematiche di Accumulazione (Leonida & Cesare)";
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
      aria-label="Libro II: La Falange e le Schematiche di Accumulazione"
    >
      {/* Texture Layer: Pergamena Tattica Olografica */}
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
            <Shield className="h-6 w-6 sm:h-7 sm:w-7" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] sm:text-xs font-bold tracking-[0.2em] text-[#C5A059] uppercase">
                CODEX TACTICVS // LIBER II
              </span>
              <span className="h-1 w-1 rounded-full bg-[#D4AF37]" />
              <span className="font-mono text-[10px] text-slate-400">
                TIMEFRAME: M15 · H1 INTERMEDIATE
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              LIBRO II: LA FALANGE E LE SCHEMATICHE DI ACCUMULAZIONE
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              La costruzione della fortezza difensiva prima del contrattacco: l&apos;anatomia del box di Wyckoff
              (PS, SC, AR, ST, Spring, SOS, JTC) e la disciplina ferrea delle linee di sbarramento.
            </p>
          </div>
        </div>

        {/* User Tier Status Badge & Simulation Toggle */}
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
              ARCHETIPO: LEONIDA ALLE TERMOPILI & GIULIO CESARE AD ALESIA
            </span>
          </div>
          <blockquote className="font-display font-serif text-base sm:text-lg text-slate-100 leading-relaxed italic">
            «Il nemico si consuma attaccando le linee difensive. Non si contrattacca finché non si vede il cedimento
            strutturale e la trappola tesa nella valle.»
          </blockquote>
          <cite className="block not-italic font-mono text-xs text-[#C5A059] pt-1">
            — Leonida I & Giulio Cesare · Dottrina delle Termopili e delle Fortificazioni di Alesia
          </cite>
        </div>
      </div>

      {/* Navigation View Switcher (Fortress Phases vs Practical Actions vs Schematic) */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 mb-6 border-b border-[#1E2230] pb-3 font-mono text-xs">
        <button
          type="button"
          onClick={() => setActiveTab("phases")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === "phases"
              ? "bg-[#D4AF37] text-[#0A0A0C] font-black shadow-[0_0_20px_rgba(212,175,55,0.25)]"
              : "text-slate-400 hover:text-white bg-[#0E1017] border border-[#1E2230]"
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>LE FASI DELLA FORTEZZA (SCHEMATICA)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("actions")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === "actions"
              ? "bg-[#D4AF37] text-[#0A0A0C] font-black shadow-[0_0_20px_rgba(212,175,55,0.25)]"
              : "text-slate-400 hover:text-white bg-[#0E1017] border border-[#1E2230]"
          }`}
        >
          <Target className="h-4 w-4" />
          <span>ORDINE OPERATIVO PRATICO (ITF ACTIONS)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("schematic")}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all ${
            activeTab === "schematic"
              ? "bg-[#D4AF37] text-[#0A0A0C] font-black shadow-[0_0_20px_rgba(212,175,55,0.25)]"
              : "text-slate-400 hover:text-white bg-[#0E1017] border border-[#1E2230]"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>BOX DI ACCUMULAZIONE VETTORIALE</span>
        </button>
      </div>

      {/* Main Content Area based on Active Tab */}
      <div className="relative z-10 space-y-6">
        {/* TAB 1: LE FASI DELLA FORTEZZA (ACCORDION INTERATTIVO) */}
        {activeTab === "phases" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
              <span>LE 3 TAPPE CRUCIALI DELLA SCHEMATICA DI ACCUMULAZIONE</span>
              <span className="text-[#D4AF37]">PS · SC · AR · ST · SPRING · SOS · JTC</span>
            </div>

            <div className="space-y-3">
              {FORTRESS_PHASES.map((p) => {
                const isOpen = expandedPhase === p.id;
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
                      onClick={() => setExpandedPhase(isOpen ? "" : p.id)}
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
                          FASE {p.number}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display text-base sm:text-lg font-bold text-white">
                              {p.title}
                            </h3>
                            <span className="hidden sm:inline font-mono text-[10px] text-[#D4AF37]">
                              [{p.acronyms}]
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{p.subtitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-mono text-[#D4AF37] hidden md:inline">
                          {isOpen ? "Chiudi Scheda" : "Esamina Tappa"}
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
                            {/* Deep Dive (7 cols) */}
                            <div className="md:col-span-7 space-y-3">
                              <div className="rounded-xl border border-[#1E2230] bg-[#0E1017] p-4 space-y-1.5">
                                <span className="font-mono text-[10px] font-bold text-[#D4AF37] uppercase tracking-wider">
                                  // MECCANICA DELLA SCHEMATICA ({p.acronyms})
                                </span>
                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
                                  {p.tacticalDescription}
                                </p>
                              </div>

                              <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 p-4 space-y-1">
                                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#10B981]">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>REQUISITO DI CONFERMA SUL GRAFICO</span>
                                </div>
                                <p className="text-xs text-slate-200 font-sans leading-relaxed">
                                  {p.operationalCheck}
                                </p>
                              </div>
                            </div>

                            {/* Key Parameters HUD (5 cols) */}
                            <div className="md:col-span-5 space-y-2.5">
                              <span className="font-mono text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                PUNTI DI CONTROLLO WYCKOFF
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

        {/* TAB 2: ORDINE OPERATIVO PRATICO (ITF ACTIONS) */}
        {activeTab === "actions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
              <span>SEQUENZA OBBLIGATORIA DEL PROTOCOLLO SUI TIMEFRAME M15 / H1</span>
              <span className="text-[#10B981]">4 DIRETTIVE RIGIDE</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRACTICAL_ACTIONS.map((action, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-[#C5A059]/30 bg-[#0E1017] p-5 space-y-2 hover:border-[#D4AF37] transition-colors relative overflow-hidden"
                >
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="px-2 py-0.5 rounded bg-[#C5A059]/15 text-[#C5A059] font-black">
                      {action.code}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-slate-300">
                      {action.tag}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-white pt-1">
                    {action.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    {action.rule}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: BOX DI ACCUMULAZIONE VETTORIALE */}
        {activeTab === "schematic" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
              <span>ILLUSTRAZIONE TATTICA VETTORIALE DEL BOX DI ACCUMULAZIONE WYCKOFF</span>
              <span className="text-[#D4AF37]">MAPPA DI INGAGGIO HD</span>
            </div>
            <AccumulationBoxTacticalIllustration />
          </div>
        )}

        {/* Always visible schematic illustration below if not in schematic tab */}
        {activeTab !== "schematic" && (
          <div className="pt-2">
            <AccumulationBoxTacticalIllustration />
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
                MODULO 2: 4 LEZIONI · 2H 10M
              </span>
            </div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-white">
              Studio Video: Filtri d&apos;Inversione ITF &amp; Schematiche di Accumulazione
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Analisi approfondita della rottura strutturale (MSS), scomposizione dello Spring
              e criteri oggettivi di salto del Creek (SOS / JTC).
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

        {/* Primary CTA Button: [ Accedi ai Video delle Schematiche ITF ] */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleStudyClick}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E6CA65] to-[#C5A059] px-6 py-3.5 font-mono text-xs sm:text-sm font-black text-[#0A0A0C] uppercase tracking-wider shadow-[0_0_25px_rgba(212,175,55,0.35)] transition-all hover:scale-[1.01] hover:shadow-[0_0_35px_rgba(212,175,55,0.5)] active:scale-[0.99]"
          >
            <Play className="h-4 w-4 fill-current shrink-0" />
            <span>Accedi ai Video delle Schematiche ITF</span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>

          <p className="text-[10px] text-center text-slate-400 mt-2 font-mono">
            {userTier === "member"
              ? "Apre istantaneamente il Modulo 2: Market Structure Shift & Schematiche Wyckoff"
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

export default GeneralsCodexLibro2;
