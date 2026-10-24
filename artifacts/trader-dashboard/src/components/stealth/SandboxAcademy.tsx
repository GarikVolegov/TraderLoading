import { useState, useEffect } from "react";
import {
  Lock,
  Play,
  CheckCircle2,
  FileText,
  Download,
  Clock,
  Sparkles,
  Check,
  ChevronRight,
  Shield,
  Layers,
  Sliders,
  BookOpen,
} from "lucide-react";
import { type UserTier } from "@/lib/stealthTracking";
import { GeneralsCodex } from "./GeneralsCodex";
import { StealthVideoPlayer } from "./StealthVideoPlayer";
import { GatekeepingModal } from "./GatekeepingModal";

export interface Lesson {
  id: string;
  moduleId: number;
  title: string;
  duration: string;
  description: string;
  videoUrl?: string;
  isFreePreview: boolean;
  notes: string[];
}

export interface Module {
  id: number;
  title: string;
  subtitle: string;
  timeframe: string;
  totalDuration: string;
  lessons: Lesson[];
}

const MODULES_DATA: Module[] = [
  {
    id: 0,
    title: "Modulo 0: Fondamenta & Regola di Invalidazione",
    subtitle: "La Meccanica del Prezzo e la Sopravvivenza Statistica (Sandbox Gratuita)",
    timeframe: "M15 -> M1",
    totalDuration: "33 min (2 lezioni sbloccate)",
    lessons: [
      {
        id: "m0-l1",
        moduleId: 0,
        title: "0.1 Anatomia dello Sweep di Liquidità Istituzionale e Bias Direzionale",
        duration: "18:42",
        description:
          "Scomposizione della presa di liquidità sopra i massimi/minimi di sessione. Perché i breakout trader vengono sistematicamente intrappolati dai market maker.",
        isFreePreview: true,
        notes: [
          "Lo sweep non è un'inversione garantita: è la condizione necessaria ma NON sufficiente per l'ingresso.",
          "Verificare sempre se lo sweep avviene all'interno di una Kill-Zone temporale (London 08:00-10:30 UTC o NY 13:30-16:00 UTC).",
          "Se il prezzo chiude con corpo candela solido oltre il livello, lo sweep è INVALIDATO (si tratta di espansione reale).",
        ],
      },
      {
        id: "m0-l2",
        moduleId: 0,
        title: "0.2 La Regola di Invalidazione Matematica: Quando il Setup è Morto",
        duration: "14:50",
        description:
          "Criteri rigidi e oggettivi per abbandonare un'idea prima ancora di toccare lo Stop Loss. Come eliminare del tutto le speranze e i bias emotivi sui mercati.",
        isFreePreview: true,
        notes: [
          "Invalidazione Temporale: se l'impulso atteso non si manifesta entro 3 candele M15 dopo il trigger M1, chiudere il trade a pareggio.",
          "Invalidazione Strutturale: la rottura del minimo di swing precedente annulla istantaneamente il setup long.",
          "Nessuna aggiunta su posizioni in perdita: mai mediare un'entrata contro-trend.",
        ],
      },
    ],
  },
  {
    id: 1,
    title: "Modulo 1: Mappatura & Liquidità HTF",
    subtitle: "Identificazione dei Punti di Interesse Reali (Daily / H4 / H1)",
    timeframe: "Daily / H4 / H1",
    totalDuration: "1h 45m (4 lezioni)",
    lessons: [
      {
        id: "m1-l1",
        moduleId: 1,
        title: "1.1 Cartografia della Liquidità: BSL (Buy-Side) vs SSL (Sell-Side)",
        duration: "24:10",
        description: "Mappatura dei pool di ordini pendenti lasciati dagli operatori retail.",
        isFreePreview: false,
        notes: ["Mappatura Daily & Weekly", "Order flow istituzionale e disequilibri (FVG)"],
      },
      {
        id: "m1-l2",
        moduleId: 1,
        title: "1.2 Premium vs Discount Pricing: Comprare a Sconto sui Grandi Cicli",
        duration: "28:30",
        description: "Misurazione matematica dell'equilibrio del range con algoritmi a ritracciamento 50%.",
        isFreePreview: false,
        notes: ["Filtro 50% di Fibonacci", "Eliminazione degli ingressi a prezzi sfavorevoli"],
      },
      {
        id: "m1-l3",
        moduleId: 1,
        title: "1.3 Order Block Istituzionali Validi vs Zone Mitigate",
        duration: "26:15",
        description: "Come distinguere una zona ancora carica di ordini da una zona già svuotata.",
        isFreePreview: false,
        notes: ["Criteri di mitigazione", "Re-accumulo vs inversione primaria"],
      },
      {
        id: "m1-l4",
        moduleId: 1,
        title: "1.4 Costruzione del Bias Giornaliero e Flusso di Liquidità",
        duration: "26:05",
        description: "Dichiarazione scritta dello scenario operativo prima dell'apertura dei mercati.",
        isFreePreview: false,
        notes: ["Scheda di bias pre-sessione", "Accettare le giornate di non-operatività"],
      },
    ],
  },
  {
    id: 2,
    title: "Modulo 2: Filtri di Inversione ITF",
    subtitle: "Criteri Oggettivi di Conferma e Cambio di Carattere (M15 / H1)",
    timeframe: "M15 / H1",
    totalDuration: "2h 10m (4 lezioni)",
    lessons: [
      {
        id: "m2-l1",
        moduleId: 2,
        title: "2.1 Market Structure Shift (MSS) vs Inducement Trap",
        duration: "32:00",
        description: "Riconoscere la vera rottura di carattere istituzionale ed evitare i falsi rimbalzi.",
        isFreePreview: false,
        notes: ["Displacement con corpi di candela pieni", "Riconoscimento dell'inducement interno"],
      },
      {
        id: "m2-l2",
        moduleId: 2,
        title: "2.2 Il Filtro di Spostamento Energetico (Displacement Candle)",
        duration: "29:45",
        description: "La fisica del grafico: misurazione della velocità e del volume dell'impronta istituzionale.",
        isFreePreview: false,
        notes: ["Fair Value Gap generati con sbilanciamento", "Assenza di sovrapposizioni di code"],
      },
      {
        id: "m2-l3",
        moduleId: 2,
        title: "2.3 Allineamento Multi-Timeframe M15 -> H1",
        duration: "34:10",
        description: "Quando la struttura M15 contraddice H1: regole ferree di attesa e neutralizzazione del trade.",
        isFreePreview: false,
        notes: ["Regola di dominanza HTF", "Sincronizzazione dei cicli di liquidità"],
      },
      {
        id: "m2-l4",
        moduleId: 2,
        title: "2.4 Checklist di Validazione Inversione",
        duration: "34:05",
        description: "Scansione ad albero logico prima di scendere sui timeframe di esecuzione al minuto.",
        isFreePreview: false,
        notes: ["Checklist binaria (Sì/No)", "Se anche un solo filtro manca, vietato scendere su M1"],
      },
    ],
  },
  {
    id: 3,
    title: "Modulo 3: Schematiche di Esecuzione LTF",
    subtitle: "Modelli di Ingresso al Minuto e Trigger di Precisione (M1 Scalp)",
    timeframe: "M1 Scalp",
    totalDuration: "2h 40m (5 lezioni)",
    lessons: [
      {
        id: "m3-l1",
        moduleId: 3,
        title: "3.1 Schematica Tipo A: Sweeptest su Blocco di Ordini M1",
        duration: "31:20",
        description: "Ingresso chirurgico al test dell'estremo con stop loss al di sotto della manipolazione.",
        isFreePreview: false,
        notes: ["Rapporto Rischio/Rendimento minimo 1:3.5", "Stop loss medio 3.0 - 4.5 pips"],
      },
      {
        id: "m3-l2",
        moduleId: 3,
        title: "3.2 Schematica Tipo B: Breaker Block e Sostituzione dei Ruoli",
        duration: "30:40",
        description: "Esecuzione rapida quando il livello di supporto violato diventa resistenza dinamica.",
        isFreePreview: false,
        notes: ["Ingresso su ordine limite", "Nessun rincorrere il prezzo a mercato"],
      },
      {
        id: "m3-l3",
        moduleId: 3,
        title: "3.3 Schematica Tipo C: Continuazione di Trend su Fair Value Gap M1",
        duration: "28:50",
        description: "Come entrare in corsa durante espansioni ad alta volatilità senza farsi travolgere.",
        isFreePreview: false,
        notes: ["Ingresso al 50% del gap", "Invalidazione stretta sul minimo relativo"],
      },
      {
        id: "m3-l4",
        moduleId: 3,
        title: "3.4 Posizionamento Matematico dello Stop Loss",
        duration: "34:15",
        description: "Calcolo dello stop basato sulla struttura e non sul bilancio del conto.",
        isFreePreview: false,
        notes: ["Lo stop loss deve stare dove l'idea è morta, non dove non fa male"],
      },
      {
        id: "m3-l5",
        moduleId: 3,
        title: "3.5 Sessione Pratica Registrata M1: 5 Casi Studio Live",
        duration: "35:00",
        description: "Replay tick-by-tick di 5 operazioni reali con consuntivo metrico completo.",
        isFreePreview: false,
        notes: ["Analisi degli errori d'esecuzione", "Psicologia del click al minuto"],
      },
    ],
  },
  {
    id: 4,
    title: "Modulo 4: Gestione Swing & Target Multipli",
    subtitle: "Trailing Stop Matematico e Massimizzazione del Profitto",
    timeframe: "H4 / Daily",
    totalDuration: "1h 50m (4 lezioni)",
    lessons: [
      {
        id: "m4-l1",
        moduleId: 4,
        title: "4.1 Identificazione del Pool di Liquidità Target (Take Profit)",
        duration: "27:10",
        description: "Chiusura del trade dove gli altri operatori sono costretti a liquidare in panico.",
        isFreePreview: false,
        notes: ["Equal Highs / Equal Lows come calamite del prezzo"],
      },
      {
        id: "m4-l2",
        moduleId: 4,
        title: "4.2 Gestione a Scaglioni (Scaling Out) vs Ride Integrale",
        duration: "26:30",
        description: "Bilanciamento tra tranquillità psicologica e rendimento composto della posizione.",
        isFreePreview: false,
        notes: ["Prelevare il 50% al primo pool di liquidità", "Spostare a Break-Even protetto"],
      },
      {
        id: "m4-l3",
        moduleId: 4,
        title: "4.3 Trailing Stop Strutturale sui Minimi/Massimi Protetti",
        duration: "29:00",
        description: "Regole oggettive per avanzare lo Stop Loss solo a conferma avvenuta di nuovi swing.",
        isFreePreview: false,
        notes: ["Evitare di stringere lo stop troppo presto"],
      },
      {
        id: "m4-l4",
        moduleId: 4,
        title: "4.4 Protocollo di Revisione e Rettifica nel Diario",
        duration: "27:20",
        description: "Come catalogare ogni trade per individuare le inefficienze della propria esecuzione.",
        isFreePreview: false,
        notes: ["Tenuta del registro operativo", "Revisione settimanale dei dati"],
      },
    ],
  },
  {
    id: 5,
    title: "Modulo 5: Weekly Case Studies",
    subtitle: "Laboratorio Continuo a Mercati Chiusi & De-Briefing Operativo",
    timeframe: "Archivio Settimanale",
    totalDuration: "Aggiornato Ogni Weekend",
    lessons: [
      {
        id: "m5-l1",
        moduleId: 5,
        title: "5.1 De-Briefing Settimana Corrente: EURUSD & GBPUSD",
        duration: "45:10",
        description: "Scomposizione di tutti i setup validi e non validi generatisi nella settimana.",
        isFreePreview: false,
        notes: ["Analisi statistica delle Kill-Zone", "Verifica aderenza al protocollo"],
      },
      {
        id: "m5-l2",
        moduleId: 5,
        title: "5.2 Indici USA: Analisi Operativa su Nasdaq e S&P 500",
        duration: "42:30",
        description: "Studio delle manipolazioni all'apertura di Wall Street e reazioni ai dati macro.",
        isFreePreview: false,
        notes: ["Sweep di apertura New York", "Reazione ai rilasci CPI e FOMC"],
      },
    ],
  },
];

export interface SandboxAcademyProps {
  userTier?: UserTier;
  onToggleUserTier?: (tier: UserTier) => void;
  onRequestAccess?: (reason?: string) => void;
  initialLessonId?: string;
  initialSubTab?: "curriculum" | "codex";
}

export function SandboxAcademy({
  userTier: propUserTier,
  onToggleUserTier,
  onRequestAccess,
  initialLessonId,
  initialSubTab = "curriculum",
}: SandboxAcademyProps) {
  const [internalTier, setInternalTier] = useState<UserTier>(propUserTier ?? "sandbox");
  const userTier = propUserTier ?? internalTier;
  const handleToggleTier = (t: UserTier) => {
    if (onToggleUserTier) onToggleUserTier(t);
    setInternalTier(t);
  };

  const [gatekeepingOpen, setGatekeepingOpen] = useState(false);
  const [gatekeepingReason, setGatekeepingReason] = useState<string>("Sblocco completo del Protocollo Limen");

  const handleRequestAccess = (reason?: string) => {
    if (onRequestAccess) {
      onRequestAccess(reason);
    } else {
      setGatekeepingReason(reason || "Sblocco completo del Protocollo Limen");
      setGatekeepingOpen(true);
    }
  };

  const [activeLessonId, setActiveLessonId] = useState<string>(initialLessonId ?? "m0-l1");
  const [activeSubTab, setActiveSubTab] = useState<"curriculum" | "codex">(initialSubTab);

  useEffect(() => {
    if (initialLessonId) {
      setActiveLessonId(initialLessonId);
    }
  }, [initialLessonId]);

  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>({
    "m0-l1": true,
  });

  // Pre-entry checklist interactive states
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    sessione: true,
    sweep: true,
    mss: false,
    invalidazione: false,
  });

  // Find active lesson
  let activeLesson: Lesson | undefined;
  for (const mod of MODULES_DATA) {
    const found = mod.lessons.find((l) => l.id === activeLessonId);
    if (found) {
      activeLesson = found;
      break;
    }
  }

  // Calculate stats for member view
  const totalLessonsCount = MODULES_DATA.reduce((acc, m) => acc + m.lessons.length, 0);
  const completedCount = Object.values(completedLessons).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / totalLessonsCount) * 100);

  const toggleLessonComplete = (id: string) => {
    setCompletedLessons((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleLessonClick = (lesson: Lesson, moduleTitle: string) => {
    if (userTier === "sandbox" && !lesson.isFreePreview) {
      handleRequestAccess(`Modulo bloccato: "${moduleTitle} - ${lesson.title}"`);
      return;
    }
    setActiveLessonId(lesson.id);
  };

  const toggleChecklistItem = (key: string) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const downloadChecklistTemplate = () => {
    const content = `LIMEN PROTOCOL // LA DOTTRINA DEL TEMPO // CHECKLIST PRE-SESSIONE\nData: ${new Date().toLocaleDateString()}\n\n1. FINESTRA TEMPORALE KILL-ZONE: ${checklist.sessione ? "VALIDATA" : "NON VERIFICATA"}\n2. SWEEP DI LIQUIDITA HTF: ${checklist.sweep ? "RILEVATO" : "NON PRESENTE"}\n3. CAMBIO DI CARATTERE ITF (MSS): ${checklist.mss ? "CONFERMATO" : "IN ATTESA"}\n4. INVALIDAZIONE MATEMATICA: ${checklist.invalidazione ? "DEFINITA" : "NON DICHIARATA"}\n\nREGOLA RIGIDA: Se anche un solo elemento risulta non verificato, l'esecuzione a mercato e SEVERAMENTE VIETATA nel Limen Protocol.`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "limen-protocol-checklist-pre-entry.txt";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Testing / Mode Toggle Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#1E2230] bg-[#161922] text-[#10B981]">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wider">
                LIVELLO DI ACCESSO // LIMEN PROTOCOL:
              </span>
              <span
                className={`font-mono text-xs font-bold px-2.5 py-0.5 rounded border ${
                  userTier === "sandbox"
                    ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                    : "border-primary/40 bg-primary/15 text-primary"
                }`}
              >
                {userTier === "sandbox"
                  ? "● SANDBOX DIDATTICA (ACCESSO LIBERO)"
                  : "● MEMBRO EFFETTIVO (TRIBUTO ATTIVO)"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {userTier === "sandbox"
                ? "Capitolo 0 e prime 2 lezioni operative sbloccate. Moduli 1-5 protetti da gatekeeping."
                : "Tutti i 6 moduli sbloccati, tracciamento progresso attivo e note tecniche accessibili."}
            </p>
          </div>
        </div>

        {/* Real-time Switcher Buttons */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-card p-1 font-mono text-xs">
          <button
            type="button"
            onClick={() => handleToggleTier("sandbox")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              userTier === "sandbox"
                ? "bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Vista Sandbox (Free)
          </button>
          <button
            type="button"
            onClick={() => handleToggleTier("member")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              userTier === "member"
                ? "bg-primary/20 text-primary font-bold border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Vista Membro (€150/m)
          </button>
        </div>
      </div>

      {/* Subtab Navigation: Video Library vs Generals Codex */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl border border-border bg-card shadow-md">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab("curriculum")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-mono text-xs transition-all ${
              activeSubTab === "curriculum"
                ? "bg-primary/15 text-primary font-bold border border-primary/30"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-4 w-4 text-primary" />
            <span>01 VIDEO FORMATIVI & SANDBOX</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("codex")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-mono text-xs transition-all ${
              activeSubTab === "codex"
                ? "bg-gradient-to-r from-[#1A1812] to-[#12110D] text-[#D4AF37] font-bold border border-[#D4AF37]/50 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
                : "text-[#C5A059] hover:text-[#D4AF37] hover:bg-[#C5A059]/10"
            }`}
          >
            <BookOpen className="h-4 w-4 text-[#D4AF37]" />
            <span>02 LA DOTTRINA DEI GENERALI (CODEX)</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
          </button>
        </div>
      </div>

      {activeSubTab === "codex" ? (
        <GeneralsCodex
          userTier={userTier}
          onRequestAccess={handleRequestAccess}
          onOpenVideo={(chapterId, moduleId, lessonId) => {
            setActiveLessonId(lessonId);
            setActiveSubTab("curriculum");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      ) : (
        <>
          {/* Member Progress Header (only visible in member tier) */}
      {userTier === "member" && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#10B981]" />
              <span className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                PROGRESSO PROTOCOLLO OPERATIVO: {progressPercent}%
              </span>
            </div>
            <span className="font-mono text-xs text-emerald-400">
              {completedCount} di {totalLessonsCount} lezioni completate
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#181C28] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-[#10B981] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* 2-Column Main Workspace: Player & Lesson Notes (Left) + Curriculum Index (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 Cols): Active Lesson Screen, Player & Notes */}
        <div className="lg:col-span-7 space-y-6">
          {activeLesson ? (
            <div className="rounded-2xl border border-[#1E2230] bg-[#090A0F] p-6 shadow-xl space-y-5">
              {/* Lesson Title Header */}
              <div className="border-b border-[#1E2230] pb-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/30 px-2.5 py-0.5 rounded">
                    LEZIONE OPERATIVA
                  </span>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    <span>DURATA: {activeLesson.duration}</span>
                  </div>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">{activeLesson.title}</h2>
                <p className="text-xs text-slate-400 leading-relaxed">{activeLesson.description}</p>
              </div>

              {/* Lesson Video Frame - Stealth Video Player Limen */}
              <div className="w-full rounded-2xl overflow-hidden border border-border shadow-2xl bg-[#07080C]">
                <StealthVideoPlayer
                  key={activeLesson.id}
                  title={`LIMEN PROTOCOL // ${activeLesson.title}`}
                  initialVideoSrc={activeLesson.videoUrl || undefined}
                />
              </div>

              {/* Completion Toggle */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => toggleLessonComplete(activeLesson!.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-colors ${
                    completedLessons[activeLesson.id]
                      ? "border border-primary bg-primary/20 text-primary"
                      : "border border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {completedLessons[activeLesson.id] ? "LEZIONE COMPLETATA" : "SEGNA COME COMPLETATA"}
                </button>

                {userTier === "sandbox" && (
                  <button
                    type="button"
                    onClick={() => handleRequestAccess("Accesso completo al protocollo e a tutti i moduli")}
                    className="font-mono text-xs text-amber-400 hover:text-amber-300 underline underline-offset-4"
                  >
                    Richiedi sblocco completo →
                  </button>
                )}
              </div>

              {/* Technical Notes Under Video */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-foreground">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>NOTE TECNICHE & REGOLE DI INVALIDAZIONE:</span>
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {activeLesson.notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary font-mono font-bold">[{i + 1}]</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Interactive Pre-Entry Checklist Preview */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-400" />
                    <span className="font-mono text-xs font-bold text-foreground uppercase">
                      CHECKLIST PRE-ENTRY INTERATTIVA // LIMEN PROTOCOL
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={downloadChecklistTemplate}
                    className="flex items-center gap-1.5 text-[11px] font-mono text-primary hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    Scarica Template (.txt)
                  </button>
                </div>

                <div className="space-y-2">
                  {[
                    {
                      key: "sessione",
                      label: "1. Finestra Temporale Kill-Zone Attiva (08:00-10:30 UTC / 13:30-16:00 UTC)",
                      valid: checklist.sessione,
                    },
                    {
                      key: "sweep",
                      label: "2. Sweep di Liquidità HTF confermato senza chiusura solida",
                      valid: checklist.sweep,
                    },
                    {
                      key: "mss",
                      label: "3. Cambio di Carattere M15 (MSS) con candela di displacement",
                      valid: checklist.mss,
                    },
                    {
                      key: "invalidazione",
                      label: "4. Punto matematico di Stop Loss e Invalidazione scritto a diario",
                      valid: checklist.invalidazione,
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      onClick={() => toggleChecklistItem(item.key)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-colors ${
                        item.valid
                          ? "border-[#10B981]/40 bg-[#10B981]/10 text-white"
                          : "border-[#1E2230] bg-[#11131A] text-slate-400"
                      }`}
                    >
                      <span className="text-xs font-mono">{item.label}</span>
                      <span
                        className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ml-2 ${
                          item.valid ? "border-[#10B981] bg-[#10B981] text-[#090A0F]" : "border-slate-600"
                        }`}
                      >
                        {item.valid && <Check className="h-3 w-3" />}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Right Column (5 Cols): Curriculum Index with Elegant Locked State */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              INDICE DIDATTICO · LIMEN PROTOCOL
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              {userTier === "sandbox" ? "2 LEZIONI SBLOCCATE" : "TUTTO SBLOCCATO"}
            </span>
          </div>

          <div className="space-y-3">
            {MODULES_DATA.map((module) => {
              const isModuleLocked = userTier === "sandbox" && module.id !== 0;

              return (
                <div
                  key={module.id}
                  className={`rounded-2xl border transition-all overflow-hidden ${
                    isModuleLocked
                      ? "border-[#1E2230] bg-[#0E1017]/80 opacity-80"
                      : "border-[#1E2230] bg-[#0E1017]"
                  }`}
                >
                  {/* Module Header */}
                  <div className="flex items-center justify-between border-b border-[#1E2230] bg-[#11131A] px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">{module.title}</span>
                        {isModuleLocked && (
                          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-mono text-amber-400">
                            <Lock className="h-3 w-3" />
                            BLOCCATO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">{module.subtitle}</p>
                    </div>

                    <span className="font-mono text-[10px] text-slate-500 shrink-0 ml-2">
                      {module.totalDuration}
                    </span>
                  </div>

                  {/* Lessons list in module */}
                  <div className="divide-y divide-[#1E2230]/60">
                    {module.lessons.map((lesson) => {
                      const isLessonLocked = userTier === "sandbox" && !lesson.isFreePreview;
                      const isActive = activeLessonId === lesson.id;
                      const isCompleted = completedLessons[lesson.id];

                      return (
                        <div
                          key={lesson.id}
                          onClick={() => handleLessonClick(lesson, module.title)}
                          className={`flex items-center justify-between p-3.5 transition-colors cursor-pointer ${
                            isActive
                              ? "bg-[#10B981]/10 text-white"
                              : isLessonLocked
                                ? "hover:bg-[#141722] text-slate-400"
                                : "hover:bg-[#161924] text-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            {isLessonLocked ? (
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#1E2230] bg-[#161924] text-slate-500">
                                <Lock className="h-3.5 w-3.5" />
                              </div>
                            ) : isCompleted ? (
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#10B981]/40 bg-[#10B981]/15 text-[#10B981]">
                                <CheckCircle2 className="h-4 w-4" />
                              </div>
                            ) : (
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#1E2230] bg-[#161924] text-slate-400">
                                <Play className="h-3.5 w-3.5 ml-0.5" />
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-xs truncate">{lesson.title}</span>
                                {lesson.isFreePreview && userTier === "sandbox" && (
                                  <span className="font-mono text-[9px] font-bold text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/30 px-1 rounded">
                                    FREE
                                  </span>
                                )}
                              </div>
                              <span className="font-mono text-[10px] text-slate-500">
                                {lesson.duration} // {module.timeframe}
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 text-slate-500">
                            {isLessonLocked ? (
                              <span className="font-mono text-[10px] text-amber-400/90 underline decoration-amber-400/50">
                                Sblocca
                              </span>
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sandbox Footer CTA Banner */}
          {userTier === "sandbox" && (
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-card to-background p-5 space-y-3">
              <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-400">
                <Sparkles className="h-4 w-4" />
                <span>ACCESSO COMPLETO RISERVATO AI MEMBRI EFFETTIVI</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                I Moduli 1, 2, 3, 4 e 5 contengono i trigger di esecuzione al minuto e l&apos;archivio dei case studies
                settimanali. L&apos;ammissione richiede la revisione del tuo profilo tramite il gatekeeping del Limen Protocol.
              </p>
              <button
                type="button"
                onClick={() => handleRequestAccess("Richiesta di ammissione per sblocco completo dell'Academy")}
                className="w-full py-2.5 rounded-xl border border-amber-400 bg-amber-400/15 text-amber-300 font-bold text-xs tracking-wider uppercase font-mono hover:bg-amber-400 hover:text-black transition-all"
              >
                VERIFICA IDONEITÀ · CANDIDATURA LIMEN
              </button>
            </div>
          )}
        </div>
      </div>
        </>
      )}

      <GatekeepingModal
        isOpen={gatekeepingOpen}
        onClose={() => setGatekeepingOpen(false)}
        initialReason={gatekeepingReason}
      />
    </div>
  );
}
