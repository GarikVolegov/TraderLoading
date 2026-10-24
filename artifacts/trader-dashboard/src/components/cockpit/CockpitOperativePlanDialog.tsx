import { useState, useEffect, useRef, useMemo } from "react";
import {
  Target,
  Shield,
  Save,
  Trash2,
  Edit3,
  ImageIcon,
  CheckCircle2,
  UploadCloud,
  X,
  Zap,
  Calculator,
  CheckCheck,
  BookOpen,
  ArrowRight,
  Clock,
  Compass,
  FileText,
  AlertTriangle,
  Layers,
  Search,
  Copy,
  Check,
  ChevronRight,
  HelpCircle,
  Flame,
  Lock,
  Unlock,
  RefreshCw,
} from "lucide-react";

export interface FourQuestionsAnswers {
  q1Context: string; // es. Rialzista, Ribassista, Range
  q1NoCompression: boolean; // Conferma assenza di compressione sopra e sotto
  q2Structure: "zone_mitigated" | "liquidity_only" | "intermediate_reaccumulation" | "";
  q2Notes: string;
  q3ItfCycleClosed: boolean;
  q3LtfSchematic: boolean;
  q3Trigger: "TEST" | "POC" | "JTC" | "BTI" | "";
  q4OppositePool: string;
  q4TenPercentVerified: boolean;
}

export interface OperativePlanData {
  asset: string;
  bias: "long" | "short" | "wait";
  session: "asia" | "london" | "newyork" | "daily";
  timeframeMode?: "scalping" | "swing";
  setupName: string;
  triggerType?: "TEST" | "POC" | "JTC" | "BTI" | "";
  entryPrice: string;
  stopLoss: string;
  invalidation: string;
  takeProfit1: string;
  takeProfit2: string;
  riskAmount: string; // € o %
  notes: string;
  imageUrl: string | null;
  checklist: boolean[];
  fourQuestions?: FourQuestionsAnswers;
  status: "draft" | "confirmed";
  updatedAt: string;
}

export const PROTOCOL_CHECKLIST_ITEMS = [
  "Gerarchia TF rispettata (Scalping: H1→M15→M1 | Swing: Daily/H4→H1/M15→M5/M1)",
  "Finestra operativa italiana valida (non in Lunch senza impulso, no Scalp dopo 18:00, no Swing dopo 22:00)",
  "Nessuna Red Folder News nei 10 min precedenti o nei 45 min successivi senza nuovo sweep",
  "Assenza di compressione (liquidità non presente contemporaneamente sopra e sotto: NO TRADE)",
  "Sweep confermato a sinistra e Router di Zona verificato (Solo liquidità = solo continuazione JTC/BTI)",
  "Se M15 in area vergine e M1 accumula/distribuisce: verificato sbilanciamento 10% (rottura SOW/SOS)",
  "Pool di liquidità opposto identificato chiaramente prima dell'esecuzione",
  "Rapporto R:R ≥ 1:2.5 e Rischio Massimo per trade rigorosamente rispettato (Max Loss)",
];

const QUICK_SETUP_PRESETS = [
  "Sweep Asian Low + FVG M15",
  "Sweep Asian High + POC",
  "London Reversal + Re-test POC",
  "NY Expansion + FVG Entry",
  "Continuazione JTC (Join The Continuation)",
  "Trappola BTI (Breakout Trap Invalidation)",
  "Break of Structure + Order Block",
  "Inversione Estremo + Pinbar",
];

const QUICK_TRIGGER_PRESETS: Array<"TEST" | "POC" | "JTC" | "BTI"> = [
  "TEST",
  "POC",
  "JTC",
  "BTI",
];

const QUICK_RISK_PRESETS = ["0.5%", "1%", "5€", "10€", "20€", "50€", "80€", "100€"];

// Live Europe/Rome time helper
function getRomeTime(): {
  hour: number;
  minute: number;
  second: number;
  timeString: string;
  dateString: string;
} {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    const second = parseInt(parts.find((p) => p.type === "second")?.value || "0", 10);
    const day = parts.find((p) => p.type === "day")?.value || "01";
    const month = parts.find((p) => p.type === "month")?.value || "01";
    const year = parts.find((p) => p.type === "year")?.value || "2026";
    const timeString = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
    const dateString = `${day}/${month}/${year}`;
    return { hour, minute, second, timeString, dateString };
  } catch {
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    return {
      hour: h,
      minute: m,
      second: s,
      timeString: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      dateString: now.toLocaleDateString("it-IT"),
    };
  }
}

export interface ItalianSessionDetail {
  id: string;
  name: string;
  hours: string;
  isActive: boolean;
  canScalp: boolean;
  canSwing: boolean;
  badgeText: string;
  badgeClass: string;
  summary: string;
  keyRule: string;
}

function getItalianSessions(hour: number, minute: number): {
  currentSession: ItalianSessionDetail;
  sessions: ItalianSessionDetail[];
  canScalpNow: boolean;
  canSwingNow: boolean;
  alertNotice: string;
} {
  const t = hour + minute / 60;

  const isAsia = t >= 0 && t < 8;
  const isAsiaEntryWindow = t >= 1 && t <= 3.5;
  const isLondon = t >= 8 && t < 11.5;
  const isLunch = t >= 11.5 && t < 13.5;
  const isIntervallo = t >= 13.5 && t < 14;
  const isNewYork = t >= 14 && t < 18;
  const isScalpCutoff = t >= 18 && t < 18.5;
  const isSwingEvening = t >= 18.5 && t < 22;
  const isNightClosed = t >= 22 || t < 0;

  const sessions: ItalianSessionDetail[] = [
    {
      id: "asia",
      name: "Asia",
      hours: "00:00–08:00 CET",
      isActive: isAsia,
      canScalp: isAsiaEntryWindow,
      canSwing: false,
      badgeText: isAsia ? (isAsiaEntryWindow ? "FINESTRA INGRESSI APERTA" : "SOLO MAPPATURA") : "CHIUSA",
      badgeClass: isAsia
        ? isAsiaEntryWindow
          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
          : "bg-amber-500/15 text-amber-400 border-amber-500/30"
        : "bg-white/5 text-muted-foreground border-white/10",
      summary: "Mappa Asian High / Low. Ingressi solo 01:00–03:30 con massime conferme, mai in compressione.",
      keyRule: "Mai entrare in compressione. Finestra d'ingresso consentita solo 01:00–03:30.",
    },
    {
      id: "london",
      name: "London",
      hours: "08:00–11:30 CET",
      isActive: isLondon,
      canScalp: true,
      canSwing: true,
      badgeText: isLondon ? "SESSIONE PRIMARIA ATTIVA" : "CHIUSA",
      badgeClass: isLondon
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
        : "bg-white/5 text-muted-foreground border-white/10",
      summary: "Sweep della liquidità asiatica, zona H1/H4 e schematica confermata.",
      keyRule: "Pretendi lo sweep obbligatorio dei massimi o minimi asiatici prima del trigger.",
    },
    {
      id: "lunch",
      name: "Lunch",
      hours: "11:30–13:30 CET",
      isActive: isLunch,
      canScalp: false,
      canSwing: false,
      badgeText: isLunch ? "PAUSA LIQUIDITÀ · ATTENZIONE" : "CHIUSA",
      badgeClass: isLunch
        ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold"
        : "bg-white/5 text-muted-foreground border-white/10",
      summary: "Evita nuovi ingressi se l'impulso non è già partito. Conferma esplicitamente questo requisito.",
      keyRule: "Nuovi ingressi VIETATI a meno che il movimento sia già chiaramente in espansione.",
    },
    {
      id: "intervallo",
      name: "Intervallo",
      hours: "13:30–14:00 CET",
      isActive: isIntervallo,
      canScalp: false,
      canSwing: false,
      badgeText: isIntervallo ? "SOLO ANALISI & GESTIONE" : "CHIUSA",
      badgeClass: isIntervallo
        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
        : "bg-white/5 text-muted-foreground border-white/10",
      summary: "Non è una finestra operativa definita: solo analisi e gestione posizioni.",
      keyRule: "Nessun nuovo ordine. Analizza lo scenario in vista dell'apertura americana.",
    },
    {
      id: "newyork",
      name: "New York",
      hours: "14:00–18:30 CET",
      isActive: isNewYork || isScalpCutoff,
      canScalp: isNewYork,
      canSwing: true,
      badgeText: isNewYork ? "ESPANSIONE ATTIVA (SCALP & SWING)" : isScalpCutoff ? "SCALP STOP · SWING OK" : "CHIUSA",
      badgeClass: isNewYork
        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
        : isScalpCutoff
          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
          : "bg-white/5 text-muted-foreground border-white/10",
      summary: "Sweep dei livelli di Londra, reazione immediata, continuazioni o inversioni valide. Scalping fino alle 18:00; Swing operativo fino alle 22:00.",
      keyRule: "Lo Scalping termina categoricamente alle 18:00 CET.",
    },
    {
      id: "scalp_cutoff",
      name: "Chiusura Scalp",
      hours: "Dalle 18:00 CET",
      isActive: isScalpCutoff,
      canScalp: false,
      canSwing: true,
      badgeText: isScalpCutoff ? "SCALP BLOCCATO" : "ATTIVA ALLE 18:00",
      badgeClass: isScalpCutoff
        ? "bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold"
        : "bg-white/5 text-muted-foreground border-white/10",
      summary: "Nessun nuovo ingresso scalping. La gestione delle posizioni già aperte resta disponibile.",
      keyRule: "Divieto tassativo di nuovi ordini scalping. Conduci i trade aperti a target.",
    },
    {
      id: "swing_evening",
      name: "Swing / Sera",
      hours: "18:30–22:00 CET",
      isActive: isSwingEvening,
      canScalp: false,
      canSwing: true,
      badgeText: isSwingEvening ? "FINESTRA SWING ATTIVA" : "CHIUSA",
      badgeClass: isSwingEvening
        ? "bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold"
        : "bg-white/5 text-muted-foreground border-white/10",
      summary: "Nuovi ingressi Swing consentiti con tutti i filtri del protocollo. Lo Scalping resta bloccato dalle 18:00.",
      keyRule: "Operatività solo Multiday/Swing su Daily/H4. Scalp rigorosamente escluso.",
    },
    {
      id: "swing_cutoff",
      name: "Chiusura Swing",
      hours: "Dalle 22:00 CET",
      isActive: isNightClosed,
      canScalp: false,
      canSwing: false,
      badgeText: isNightClosed ? "TERMINALE CHIUSO" : "ATTIVA ALLE 22:00",
      badgeClass: isNightClosed
        ? "bg-zinc-800 text-zinc-400 border-zinc-700 font-bold"
        : "bg-white/5 text-muted-foreground border-white/10",
      summary: "Nessun nuovo ingresso Swing. Gestione delle posizioni già aperte sempre accessibile.",
      keyRule: "Schermi spenti. Nessun nuovo trade per preservare lucidità e capitale.",
    },
  ];

  const currentSession = sessions.find((s) => s.isActive) || sessions[0];
  const canScalpNow = isAsia ? isAsiaEntryWindow : isLondon || isNewYork;
  const canSwingNow = isLondon || isNewYork || isScalpCutoff || isSwingEvening;

  let alertNotice = "";
  if (isLunch) {
    alertNotice = "⚠️ Finestra Lunch (11:30–13:30): Evita nuovi ingressi se l'impulso non è già partito.";
  } else if (isScalpCutoff) {
    alertNotice = "🛑 Dalle 18:00 CET lo Scalping è categoricamente bloccato. Solo gestione delle posizioni aperte o setup Swing.";
  } else if (isNightClosed) {
    alertNotice = "🌙 Oltre le 22:00 CET: Chiusura totale nuovi ingressi Swing & Scalp. Gestione attiva delle posizioni multiday sempre accessibile.";
  } else if (isIntervallo) {
    alertNotice = "ℹ️ Intervallo 13:30–14:00: Tempo di sola analisi e gestione in attesa della sessione americana.";
  } else if (isAsia && !isAsiaEntryWindow) {
    alertNotice = "🌏 Sessione Asiatica: finestra ingressi consentita solo tra le 01:00 e le 03:30 CET con massime conferme.";
  }

  return { currentSession, sessions, canScalpNow, canSwingNow, alertNotice };
}

function getCurrentSessionFallback(): OperativePlanData["session"] {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 8) return "asia";
  if (hour >= 8 && hour < 14) return "london";
  if (hour >= 14 && hour < 22) return "newyork";
  return "asia";
}

function calculateTakeProfit(
  entryStr: string,
  slStr: string,
  bias: "long" | "short" | "wait",
  ratio: number
): string {
  const e = parseFloat(entryStr);
  const s = parseFloat(slStr);
  if (isNaN(e) || isNaN(s)) return "";
  const distance = Math.abs(e - s);
  if (distance === 0) return "";

  const isLong = bias === "long" || (bias === "wait" && e > s);
  const tp = isLong ? e + distance * ratio : e - distance * ratio;

  const decimals = (entryStr.split(".")[1] || "").length || 2;
  return tp.toFixed(Math.min(Math.max(decimals, 2), 4));
}

interface CockpitOperativePlanDialogProps {
  market: string;
  timeframe?: string;
  cockpitEntry?: string;
  cockpitStop?: string;
  cockpitRisk?: string;
  cockpitBias?: "long" | "short" | "wait";
  onPlanSaved?: () => void;
  onOpenJournal?: () => void;
}

function parseOperativePlan(
  raw: string | null,
  market: string,
  cockpitBias?: "long" | "short" | "wait",
  cockpitEntry?: string,
  cockpitStop?: string,
  cockpitRisk?: string
): OperativePlanData {
  const defaultPlan: OperativePlanData = {
    asset: market,
    bias: cockpitBias || "long",
    session: getCurrentSessionFallback(),
    timeframeMode: "scalping",
    setupName: "Sweep Asian Low + FVG M15",
    triggerType: "TEST",
    entryPrice: cockpitEntry || "",
    stopLoss: cockpitStop || "",
    invalidation: "",
    takeProfit1: "",
    takeProfit2: "",
    riskAmount: cockpitRisk || "5€",
    notes: "",
    imageUrl: null,
    checklist: new Array(8).fill(false),
    fourQuestions: {
      q1Context: "",
      q1NoCompression: true,
      q2Structure: "zone_mitigated",
      q2Notes: "",
      q3ItfCycleClosed: false,
      q3LtfSchematic: false,
      q3Trigger: "TEST",
      q4OppositePool: "",
      q4TenPercentVerified: false,
    },
    status: "draft",
    updatedAt: new Date().toISOString(),
  };

  if (!raw) return defaultPlan;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return defaultPlan;

    const checklist = Array.isArray(parsed.checklist)
      ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => Boolean(parsed.checklist[i]))
      : new Array(8).fill(false);

    return {
      asset: typeof parsed.asset === "string" && parsed.asset ? parsed.asset : market,
      bias:
        parsed.bias === "long" || parsed.bias === "short" || parsed.bias === "wait"
          ? parsed.bias
          : (cockpitBias || "long"),
      session:
        parsed.session === "asia" ||
        parsed.session === "london" ||
        parsed.session === "newyork" ||
        parsed.session === "daily"
          ? parsed.session
          : getCurrentSessionFallback(),
      timeframeMode:
        parsed.timeframeMode === "swing" || parsed.timeframeMode === "scalping"
          ? parsed.timeframeMode
          : "scalping",
      setupName: typeof parsed.setupName === "string" ? parsed.setupName : "",
      triggerType:
        parsed.triggerType === "TEST" ||
        parsed.triggerType === "POC" ||
        parsed.triggerType === "JTC" ||
        parsed.triggerType === "BTI"
          ? parsed.triggerType
          : "TEST",
      entryPrice: typeof parsed.entryPrice === "string" ? parsed.entryPrice : (cockpitEntry || ""),
      stopLoss: typeof parsed.stopLoss === "string" ? parsed.stopLoss : (cockpitStop || ""),
      invalidation: typeof parsed.invalidation === "string" ? parsed.invalidation : "",
      takeProfit1: typeof parsed.takeProfit1 === "string" ? parsed.takeProfit1 : "",
      takeProfit2: typeof parsed.takeProfit2 === "string" ? parsed.takeProfit2 : "",
      riskAmount: typeof parsed.riskAmount === "string" ? parsed.riskAmount : (cockpitRisk || "5€"),
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
      imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : null,
      checklist,
      fourQuestions:
        parsed.fourQuestions && typeof parsed.fourQuestions === "object"
          ? {
              q1Context: typeof parsed.fourQuestions.q1Context === "string" ? parsed.fourQuestions.q1Context : "",
              q1NoCompression: parsed.fourQuestions.q1NoCompression !== false,
              q2Structure:
                parsed.fourQuestions.q2Structure === "zone_mitigated" ||
                parsed.fourQuestions.q2Structure === "liquidity_only" ||
                parsed.fourQuestions.q2Structure === "intermediate_reaccumulation"
                  ? parsed.fourQuestions.q2Structure
                  : "zone_mitigated",
              q2Notes: typeof parsed.fourQuestions.q2Notes === "string" ? parsed.fourQuestions.q2Notes : "",
              q3ItfCycleClosed: Boolean(parsed.fourQuestions.q3ItfCycleClosed),
              q3LtfSchematic: Boolean(parsed.fourQuestions.q3LtfSchematic),
              q3Trigger:
                parsed.fourQuestions.q3Trigger === "TEST" ||
                parsed.fourQuestions.q3Trigger === "POC" ||
                parsed.fourQuestions.q3Trigger === "JTC" ||
                parsed.fourQuestions.q3Trigger === "BTI"
                  ? parsed.fourQuestions.q3Trigger
                  : "TEST",
              q4OppositePool: typeof parsed.fourQuestions.q4OppositePool === "string" ? parsed.fourQuestions.q4OppositePool : "",
              q4TenPercentVerified: Boolean(parsed.fourQuestions.q4TenPercentVerified),
            }
          : defaultPlan.fourQuestions,
      status: parsed.status === "confirmed" ? "confirmed" : "draft",
      updatedAt: typeof parsed.updatedAt === "string" && parsed.updatedAt ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return defaultPlan;
  }
}

type DialogTab = "plan" | "questions" | "strategy" | "windows" | "glossary";

export function CockpitOperativePlanDialog({
  market,
  timeframe = "60",
  cockpitEntry,
  cockpitStop,
  cockpitRisk,
  cockpitBias,
  onPlanSaved,
  onOpenJournal,
}: CockpitOperativePlanDialogProps) {
  const storageKey = `tl_cockpit_operative_plan_${market}`;

  const [activeTab, setActiveTab] = useState<DialogTab>("plan");
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);
  const [glossarySearch, setGlossarySearch] = useState("");

  // Live Rome Time tick every second
  const [romeClock, setRomeClock] = useState(() => getRomeTime());
  useEffect(() => {
    const timer = setInterval(() => {
      setRomeClock(getRomeTime());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const sessionStatus = useMemo(() => {
    return getItalianSessions(romeClock.hour, romeClock.minute);
  }, [romeClock.hour, romeClock.minute]);

  const [plan, setPlan] = useState<OperativePlanData>(() => {
    return parseOperativePlan(
      localStorage.getItem(storageKey),
      market,
      cockpitBias,
      cockpitEntry,
      cockpitStop,
      cockpitRisk
    );
  });

  const [mode, setMode] = useState<"view" | "edit">(() => {
    return plan.entryPrice && plan.stopLoss ? "view" : "edit";
  });

  // Re-sync plan whenever market changes
  useEffect(() => {
    const loaded = parseOperativePlan(
      localStorage.getItem(`tl_cockpit_operative_plan_${market}`),
      market,
      cockpitBias,
      cockpitEntry,
      cockpitStop,
      cockpitRisk
    );
    setPlan(loaded);
    setMode(loaded.entryPrice && loaded.stopLoss ? "view" : "edit");
  }, [market, cockpitBias, cockpitEntry, cockpitStop, cockpitRisk]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Paste image listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (mode !== "edit") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
              if (loadEvent.target?.result) {
                setPlan((prev) => ({
                  ...prev,
                  imageUrl: loadEvent.target!.result as string,
                }));
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [mode]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        if (loadEvent.target?.result) {
          setPlan((prev) => ({
            ...prev,
            imageUrl: loadEvent.target!.result as string,
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    const updated: OperativePlanData = {
      ...plan,
      asset: market,
      status: "confirmed",
      updatedAt: new Date().toISOString(),
    };
    setPlan(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      window.dispatchEvent(new Event("storage"));
    } catch {
      // Ignore
    }
    setMode("view");
    onPlanSaved?.();
  };

  const handleReset = () => {
    if (window.confirm("Sei sicuro di voler azzerare il piano operativo corrente?")) {
      const resetPlan: OperativePlanData = {
        asset: market,
        bias: cockpitBias || "wait",
        session: getCurrentSessionFallback(),
        timeframeMode: "scalping",
        setupName: "",
        triggerType: "TEST",
        entryPrice: "",
        stopLoss: "",
        invalidation: "",
        takeProfit1: "",
        takeProfit2: "",
        riskAmount: cockpitRisk || "5€",
        notes: "",
        imageUrl: null,
        checklist: new Array(8).fill(false),
        fourQuestions: {
          q1Context: "",
          q1NoCompression: true,
          q2Structure: "zone_mitigated",
          q2Notes: "",
          q3ItfCycleClosed: false,
          q3LtfSchematic: false,
          q3Trigger: "TEST",
          q4OppositePool: "",
          q4TenPercentVerified: false,
        },
        status: "draft",
        updatedAt: new Date().toISOString(),
      };
      setPlan(resetPlan);
      localStorage.removeItem(storageKey);
      window.dispatchEvent(new Event("storage"));
      setMode("edit");
      onPlanSaved?.();
    }
  };

  const handleImportFromCockpit = () => {
    setPlan((prev) => {
      const nextEntry = cockpitEntry || prev.entryPrice;
      const nextStop = cockpitStop || prev.stopLoss;
      const nextRisk = cockpitRisk || prev.riskAmount;
      const nextBias = cockpitBias || prev.bias;

      let nextTp1 = prev.takeProfit1;
      if ((!nextTp1 || nextTp1 === "") && nextEntry && nextStop) {
        nextTp1 = calculateTakeProfit(nextEntry, nextStop, nextBias, 3);
      }

      return {
        ...prev,
        entryPrice: nextEntry,
        stopLoss: nextStop,
        riskAmount: nextRisk,
        bias: nextBias,
        takeProfit1: nextTp1,
      };
    });
  };

  const applyTakeProfitRatio = (ratio: number) => {
    if (!plan.entryPrice || !plan.stopLoss) return;
    const computed = calculateTakeProfit(plan.entryPrice, plan.stopLoss, plan.bias, ratio);
    if (computed) {
      setPlan((prev) => ({ ...prev, takeProfit1: computed }));
    }
  };

  const handleCheckAll = () => {
    setPlan((prev) => ({
      ...prev,
      checklist: new Array(8).fill(true),
    }));
  };

  // Inject 4 questions answers into notes
  const handleInjectQuestionsToNotes = () => {
    const fq = plan.fourQuestions;
    if (!fq) return;

    const routerVerdictText =
      fq.q2Structure === "zone_mitigated"
        ? "INVERSIONE AUTORIZZATA (dopo schematica ITF)"
        : fq.q2Structure === "liquidity_only"
          ? "SOLO CONTINUAZIONE BTI/JTC (Inversioni vietate)"
          : fq.q2Structure === "intermediate_reaccumulation"
            ? "BOX JTC IN FASE 2 (Senza attendere estremo mancato)"
            : "Da definire";

    const questionsSummary = `
[LE 4 DOMANDE & ROUTER DI ZONA]
1. DOVE: Ciclo HTF: ${fq.q1Context || "Non specificato"} | Compressione: ${fq.q1NoCompression ? "ASSENTE (OK)" : "PRESENTE (ATTENZIONE NO TRADE)"}
2. SINISTRA: ${
      fq.q2Structure === "zone_mitigated"
        ? "Zona HTF Mitigata"
        : fq.q2Structure === "liquidity_only"
          ? "Sola Liquidità"
          : "Re-accumulo Intermedio"
    } → ROUTER: ${routerVerdictText}
3. COME: Ciclo ITF ${fq.q3ItfCycleClosed ? "Chiuso" : "In attesa"} | Schematica LTF ${fq.q3LtfSchematic ? "Confermata" : "In attesa"} | Trigger: ${fq.q3Trigger || plan.triggerType || "TEST"}
4. TARGET: Pool opposto: ${fq.q4OppositePool || "Identificato"} | Sbilanciamento 10% SOW/SOS: ${fq.q4TenPercentVerified ? "Verificato" : "N/D"}
`.trim();

    setPlan((prev) => ({
      ...prev,
      notes: prev.notes ? `${prev.notes}\n\n${questionsSummary}` : questionsSummary,
    }));

    setCopiedNotice("Risposte delle 4 Domande iniettate con successo nelle Note Operative!");
    setTimeout(() => setCopiedNotice(null), 3500);
  };

  // Calculations
  const entry = parseFloat(plan.entryPrice);
  const sl = parseFloat(plan.stopLoss);
  const tp1 = parseFloat(plan.takeProfit1);
  const slDistance = !isNaN(entry) && !isNaN(sl) ? Math.abs(entry - sl) : 0;
  const tp1Distance = !isNaN(entry) && !isNaN(tp1) ? Math.abs(tp1 - entry) : 0;
  const rrRatio = slDistance > 0 && tp1Distance > 0 ? (tp1Distance / slDistance).toFixed(2) : "—";

  const hasCockpitStep3Data = Boolean(cockpitEntry || cockpitStop || cockpitRisk);

  // Router verdict helper
  const routerVerdict = useMemo(() => {
    const s = plan.fourQuestions?.q2Structure;
    if (s === "zone_mitigated") {
      return {
        type: "success",
        title: "INVERSIONE AUTORIZZATA",
        subtitle: "Zona HTF valida toccata e mitigata a sinistra",
        rule: "Autorizzata la ricerca d'inversione, ma unicamente dopo aver validato una schematica ITF completa sul timeframe intermedio.",
        allowedTriggers: ["TEST", "POC", "JTC", "BTI"],
      };
    }
    if (s === "liquidity_only") {
      return {
        type: "danger",
        title: "INVERSIONI SEVERAMENTE VIETATE",
        subtitle: "Sola liquidità raccolta (Nessuna zona HTF a sinistra)",
        rule: "Inversioni escluse. Autorizzati esclusivamente setup di continuazione del trend dominante: solo BTI (Breakout Trap) o JTC (Join The Continuation).",
        allowedTriggers: ["JTC", "BTI"],
      };
    }
    if (s === "intermediate_reaccumulation") {
      return {
        type: "warning",
        title: "PERCORSO RE-ACCUMULI IN FASE 2",
        subtitle: "Zona estrema non raggiunta e re-accumulo / ri-distribuzione in corso",
        rule: "Adatta la continuazione al box corrente: ingresso JTC consentito senza richiedere né attendere lo sweep dell'estremo mancato. Nessuna inversione permessa.",
        allowedTriggers: ["JTC"],
      };
    }
    return {
      type: "neutral",
      title: "SELEZIONA STRUTTURA A SINISTRA",
      subtitle: "Interroga il grafico per attivare il Router di Zona",
      rule: "Definisci se il prezzo ha toccato una zona HTF mitigata, sola liquidità o un re-accumulo intermedio.",
      allowedTriggers: ["TEST", "POC", "JTC", "BTI"],
    };
  }, [plan.fourQuestions?.q2Structure]);

  // Glossary items
  const GLOSSARY_ITEMS = [
    {
      term: "HTF / ITF / LTF",
      tag: "Gerarchia Frattale",
      desc: "Mappa / validazione / trigger. HTF (Daily/H4/H1) disegna la mappa e individua i pool; ITF (H1/M15) valida la schematica e certifica la chiusura del ciclo; LTF (M5/M1) ospita il trigger d'esecuzione chirurgico.",
    },
    {
      term: "Sweep",
      tag: "Presa di Liquidità",
      desc: "Presa della liquidità sopra massimi evidenti (buy-side) o sotto minimi evidenti (sell-side). Il setup si attiva esclusivamente dopo che lo sweep è confermato a grafico a candela chiusa.",
    },
    {
      term: "Compressione",
      tag: "Filtro Assoluto: NO TRADE",
      desc: "Presenza contemporanea di liquidità sia sopra sia sotto (range / falso equilibrio). È severamente vietato anticipare il breakout del range. Nessun trade consentito finché uno dei lati non viene preso.",
    },
    {
      term: "Area Vergine",
      tag: "Spazio Non Trattato",
      desc: "Area di quotazione senza riferimenti strutturali o mitigazioni recenti a sinistra. Se M15 chiude in area vergine e M1 accumula/distribuisce, è obbligatorio attendere uno sbilanciamento di spinta almeno del 10%.",
    },
    {
      term: "Trigger TEST",
      tag: "Trigger 1 / Mitigazione",
      desc: "Ingresso sulla mitigazione millimetrica dell'estremo o del Fair Value Gap generato dallo shift strutturale della schematica su timeframe di trigger (M1/M5).",
    },
    {
      term: "Trigger POC",
      tag: "Trigger 2 / Baricentro",
      desc: "Point of Control: ingresso sul baricentro volumetrico dell'accumulazione o distribuzione istituzionale conclamata al minuto.",
    },
    {
      term: "Trigger JTC",
      tag: "Trigger 3 / Continuazione",
      desc: "Join The Continuation: ingresso in corsa sul re-test della rottura strutturale nel verso della spinta del trend dominante. È il solo trigger ammesso nei re-accumuli intermedi di Fase 2.",
    },
    {
      term: "Trigger BTI",
      tag: "Trigger 4 / Trappola",
      desc: "Breakout Trap Invalidation: ingresso istantaneo sulla trappola che punisce i breakout trader retail subito dopo la presa di liquidità e l'imbalance creata.",
    },
    {
      term: "Sbilanciamento del 10%",
      tag: "Filtro Spinta Minima",
      desc: "Viene rotto il SOW (Sign of Weakness) o SOS (Sign of Strength) e si crea la zona di BTI / JTC da utilizzare in seguito. Filtro matematico per confermare che l'espansione non è una finta.",
    },
    {
      term: "La Regola del Flip",
      tag: "Gestione Invalidazione",
      desc: "Quando una schematica d'inversione viene violata, cambia immediatamente bias verso la continuazione. La Fase 2 resta compilabile: un nuovo sweep su zona HTF valida con nuova schematica ITF/LTF può autorizzare un nuovo scenario d'inversione sullo stesso mercato nella giornata.",
    },
  ];

  const filteredGlossary = useMemo(() => {
    if (!glossarySearch.trim()) return GLOSSARY_ITEMS;
    const q = glossarySearch.toLowerCase();
    return GLOSSARY_ITEMS.filter(
      (item) =>
        item.term.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q)
    );
  }, [glossarySearch]);

  return (
    <div className="space-y-4 text-foreground">
      {/* ── TOP BAR: Status, Clock, and Quick Actions ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-[#12131A] to-[#0A0A0E]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold shadow-[0_0_15px_rgba(212,175,55,0.25)] shrink-0">
            <Target size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-foreground">
                Piano Operativo · {market}
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground border border-white/10">
                TF {timeframe}m
              </span>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border font-semibold ${
                  plan.status === "confirmed"
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                }`}
              >
                {plan.status === "confirmed" ? "● Piano Confermato & Pronto" : "○ In Preparazione"}
              </span>

              {/* Rome live clock badge */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 border border-white/15 text-primary font-semibold">
                <Clock size={11} className="text-primary animate-pulse" />
                <span>IT {romeClock.timeString}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Protocollo chirurgico pre-mercato con livelli, le 4 domande sovrane e strategia completa
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {mode === "view" ? (
            <>
              {onOpenJournal && (
                <button
                  type="button"
                  onClick={onOpenJournal}
                  className="text-xs font-mono px-3 py-1.5 rounded-lg border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 transition-colors flex items-center gap-1.5 font-bold shadow-sm cursor-pointer"
                  title="Importa questo piano direttamente nel Libro della Verità"
                >
                  <BookOpen size={13} />
                  <span className="hidden sm:inline">Libro della Verità</span>
                  <ArrowRight size={12} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setMode("edit")}
                className="text-xs font-mono px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/15 hover:bg-primary/25 text-primary transition-colors flex items-center gap-1.5 font-semibold cursor-pointer"
              >
                <Edit3 size={13} />
                <span>Modifica</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              className="text-xs font-mono px-3.5 py-1.5 rounded-lg bg-primary text-black hover:bg-primary/90 transition-colors flex items-center gap-1.5 font-bold shadow-md cursor-pointer"
            >
              <Save size={13} />
              <span>Salva Piano</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="text-xs p-1.5 rounded-lg border border-white/10 hover:border-rose-500/30 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
            title="Azzera il piano operativo"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* ── NAVIGATION TAB BAR (5 CORE TABS) ── */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("plan")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer ${
            activeTab === "plan"
              ? "bg-primary text-black font-bold shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          <Target size={13} />
          <span>🎯 Piano del Trade</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("questions")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer ${
            activeTab === "questions"
              ? "bg-primary text-black font-bold shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          <Compass size={13} />
          <span>🧭 Le 4 Domande & Router</span>
          {routerVerdict.type !== "neutral" && (
            <span
              className={`w-2 h-2 rounded-full ${
                routerVerdict.type === "success"
                  ? "bg-emerald-400"
                  : routerVerdict.type === "danger"
                    ? "bg-rose-400"
                    : "bg-amber-400"
              }`}
            />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("strategy")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer ${
            activeTab === "strategy"
              ? "bg-primary text-black font-bold shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          <FileText size={13} />
          <span>📜 Strategia Completa</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("windows")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer ${
            activeTab === "windows"
              ? "bg-primary text-black font-bold shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          <Clock size={13} />
          <span>🕒 Finestre & News</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("glossary")}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-all shrink-0 cursor-pointer ${
            activeTab === "glossary"
              ? "bg-primary text-black font-bold shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          }`}
        >
          <BookOpen size={13} />
          <span>📚 Glossario</span>
        </button>
      </div>

      {/* Copied Notice Banner */}
      {copiedNotice && (
        <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fadeIn">
          <Check size={14} className="text-emerald-400 shrink-0" />
          <span>{copiedNotice}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: PIANO DEL TRADE (EDITOR LIVE & VISTA)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "plan" && (
        <div className="space-y-4">
          {/* Quick Active Window Pill Bar */}
          <div className="p-2.5 rounded-lg bg-gradient-to-r from-black/60 via-[#14151C] to-black/60 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white/10 text-primary border border-primary/30 font-bold">
                Finestra Attiva: {sessionStatus.currentSession.name} ({sessionStatus.currentSession.hours})
              </span>
              <span className="text-muted-foreground text-xs hidden sm:inline">
                {sessionStatus.currentSession.summary}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className={sessionStatus.canScalpNow ? "text-emerald-400" : "text-rose-400"}>
                {sessionStatus.canScalpNow ? "⚡ Scalp: AUTORIZZATO" : "🛑 Scalp: BLOCCATO"}
              </span>
              <span className="text-white/20">|</span>
              <span className={sessionStatus.canSwingNow ? "text-emerald-400" : "text-amber-400"}>
                {sessionStatus.canSwingNow ? "🏛️ Swing: AUTORIZZATO" : "⏸️ Swing: ATTESA"}
              </span>
            </div>
          </div>

          {/* Alert Notice if critical session constraint (e.g. Lunch or Cutoff) */}
          {sessionStatus.alertNotice && (
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center gap-2">
              <AlertTriangle size={14} className="text-amber-400 shrink-0" />
              <span>{sessionStatus.alertNotice}</span>
            </div>
          )}

          {/* Quick Import Banner from Cockpit Step 3 */}
          {mode === "edit" && hasCockpitStep3Data && (
            <div className="p-2.5 rounded-lg bg-gradient-to-r from-primary/15 via-[#1a1c26] to-[#0e1017] border border-primary/40 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-primary animate-pulse shrink-0" />
                <span className="text-xs text-foreground font-medium">
                  Dati presenti nel Cockpit:{" "}
                  {cockpitEntry ? <strong className="font-mono text-primary">Entry {cockpitEntry}</strong> : null}
                  {cockpitStop ? <strong className="font-mono text-rose-400 ml-1.5">SL {cockpitStop}</strong> : null}
                  {cockpitRisk ? <strong className="font-mono text-foreground ml-1.5">Rischio {cockpitRisk}€</strong> : null}
                </span>
              </div>
              <button
                type="button"
                onClick={handleImportFromCockpit}
                className="text-xs font-mono px-2.5 py-1 rounded bg-primary text-black font-bold hover:bg-primary/90 flex items-center gap-1 shadow cursor-pointer transition-all"
              >
                <Zap size={12} />
                <span>⚡ Importa da Cockpit</span>
              </button>
            </div>
          )}

          {/* VIEW MODE */}
          {mode === "view" && (
            <div className="space-y-4">
              {/* Metrics cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Bias & Modalità
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <strong
                      className={`text-sm font-mono font-bold block ${
                        plan.bias === "long"
                          ? "text-emerald-400"
                          : plan.bias === "short"
                            ? "text-rose-400"
                            : "text-amber-400"
                      }`}
                    >
                      {plan.bias === "long" ? "🟢 LONG" : plan.bias === "short" ? "🔴 SHORT" : "🟡 WAIT"}
                    </strong>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-muted-foreground uppercase">
                      {plan.timeframeMode === "swing" ? "Swing" : "Scalp"}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Trigger Selezionato
                  </span>
                  <strong className="text-sm font-mono font-bold text-primary mt-0.5 block">
                    {plan.triggerType || "TEST"}
                  </strong>
                </div>

                <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Rapporto R:R
                  </span>
                  <strong className="text-sm font-mono font-bold text-primary mt-0.5 block">
                    1 : {rrRatio}
                  </strong>
                </div>

                <div className="p-3 rounded-lg border border-white/10 bg-white/[0.02]">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Rischio Max Loss
                  </span>
                  <strong className="text-sm font-mono font-bold text-foreground mt-0.5 block">
                    {plan.riskAmount}
                  </strong>
                </div>
              </div>

              {/* Levels and setup detail */}
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold">
                      Configurazione Istituzionale & Trigger
                    </span>
                    <h4 className="text-sm font-bold text-foreground mt-0.5">
                      {plan.setupName || "Setup Senza Nome"}
                    </h4>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    Aggiornato:{" "}
                    {(() => {
                      try {
                        if (!plan.updatedAt) return "—";
                        const d = new Date(plan.updatedAt);
                        return isNaN(d.getTime())
                          ? "—"
                          : d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
                      } catch {
                        return "—";
                      }
                    })()}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-black/40 border border-white/5">
                    <span className="text-muted-foreground block text-[10px] uppercase">Entry Level</span>
                    <strong className="text-foreground text-sm font-bold mt-0.5 block">
                      {plan.entryPrice || "—"}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded bg-black/40 border border-white/5">
                    <span className="text-rose-400/80 block text-[10px] uppercase">Stop Loss</span>
                    <strong className="text-rose-400 text-sm font-bold mt-0.5 block">
                      {plan.stopLoss || "—"}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded bg-black/40 border border-white/5">
                    <span className="text-emerald-400/80 block text-[10px] uppercase">Take Profit 1</span>
                    <strong className="text-emerald-400 text-sm font-bold mt-0.5 block">
                      {plan.takeProfit1 || "—"}
                    </strong>
                  </div>
                  <div className="p-2.5 rounded bg-black/40 border border-white/5">
                    <span className="text-amber-400/80 block text-[10px] uppercase">Invalidazione</span>
                    <strong className="text-foreground text-sm font-bold mt-0.5 block">
                      {plan.invalidation || "—"}
                    </strong>
                  </div>
                </div>

                {plan.notes && (
                  <div className="pt-2 border-t border-white/10">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">
                      Note Operative & Rationale
                    </span>
                    <div className="p-3 rounded-lg bg-black/30 border border-white/5 text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed font-sans">
                      {plan.notes}
                    </div>
                  </div>
                )}
              </div>

              {/* Chart screenshot attachment */}
              {plan.imageUrl && (
                <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
                  <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold flex items-center gap-1.5">
                    <ImageIcon size={12} />
                    Analisi Grafica Allegata
                  </span>
                  <div className="rounded-lg overflow-hidden border border-white/10 max-h-[380px] flex items-center justify-center bg-black/60">
                    <img
                      src={plan.imageUrl}
                      alt="Analisi Grafica"
                      className="w-full h-auto object-contain max-h-[380px]"
                    />
                  </div>
                </div>
              )}

              {/* Inviolable protocol checklist */}
              <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
                <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <Shield size={12} />
                  Checklist di Validazione Protocollo (8 Regole)
                </span>
                <div className="space-y-1.5">
                  {PROTOCOL_CHECKLIST_ITEMS.map((item, idx) => {
                    const isChecked = Boolean(plan.checklist?.[idx]);
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-2 p-2 rounded text-xs transition-colors ${
                          isChecked
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-white/[0.01] text-muted-foreground opacity-60"
                        }`}
                      >
                        <CheckCircle2 size={14} className={isChecked ? "text-emerald-400" : "text-white/20"} />
                        <span>{item}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* EDIT MODE */}
          {mode === "edit" && (
            <div className="space-y-4">
              {/* Row 1: Timeframe Mode, Bias, Session */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                    Modalità & Gerarchia TF
                  </label>
                  <select
                    aria-label="Modalità Timeframe"
                    value={plan.timeframeMode || "scalping"}
                    onChange={(e) =>
                      setPlan((p) => ({
                        ...p,
                        timeframeMode: e.target.value as "scalping" | "swing",
                      }))
                    }
                    className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-primary/50"
                  >
                    <option value="scalping">⚡ SCALPING (H1 → M15 → M1)</option>
                    <option value="swing">🏛️ SWING / INTRADAY (Daily/H4 → H1/M15 → M5/M1)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                    Bias / Direzione
                  </label>
                  <select
                    aria-label="Bias Direzione"
                    value={plan.bias}
                    onChange={(e) =>
                      setPlan((p) => ({ ...p, bias: e.target.value as OperativePlanData["bias"] }))
                    }
                    className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-primary/50"
                  >
                    <option value="long">🟢 LONG / Rialzista</option>
                    <option value="short">🔴 SHORT / Ribassista</option>
                    <option value="wait">🟡 ATTESA / Restare Fuori</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                    Sessione Target
                  </label>
                  <select
                    aria-label="Sessione Target"
                    value={plan.session}
                    onChange={(e) =>
                      setPlan((p) => ({ ...p, session: e.target.value as OperativePlanData["session"] }))
                    }
                    className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-primary/50"
                  >
                    <option value="asia">Asia (00:00–08:00)</option>
                    <option value="london">Londra (08:00–11:30)</option>
                    <option value="newyork">New York (14:00–18:30)</option>
                    <option value="daily">Daily / Swing (18:30–22:00)</option>
                  </select>
                </div>
              </div>

              {/* Setup name + Trigger selection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                    Nome Setup Istituzionale
                  </label>
                  <input
                    type="text"
                    placeholder="es. Sweep Asian Low + FVG M15"
                    value={plan.setupName}
                    onChange={(e) => setPlan((p) => ({ ...p, setupName: e.target.value }))}
                    className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs text-foreground focus:border-primary/50"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                    Trigger del Metodo (M1/M5)
                  </label>
                  <div className="flex gap-1 h-9">
                    {QUICK_TRIGGER_PRESETS.map((trig) => (
                      <button
                        key={trig}
                        type="button"
                        onClick={() =>
                          setPlan((p) => ({
                            ...p,
                            triggerType: trig,
                            fourQuestions: p.fourQuestions
                              ? { ...p.fourQuestions, q3Trigger: trig }
                              : undefined,
                          }))
                        }
                        className={`flex-1 rounded border text-xs font-mono font-bold transition-all cursor-pointer ${
                          plan.triggerType === trig
                            ? "bg-primary text-black border-primary shadow-sm"
                            : "bg-black/40 border-white/10 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {trig}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Setup Chips */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground/70 uppercase">
                  ⚡ Preset Rapidi di Setup:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_SETUP_PRESETS.map((setup) => (
                    <button
                      key={setup}
                      type="button"
                      onClick={() => setPlan((p) => ({ ...p, setupName: setup }))}
                      className={`text-[11px] px-2 py-0.5 rounded-md border transition-all cursor-pointer ${
                        plan.setupName === setup
                          ? "bg-primary/20 border-primary text-primary font-semibold"
                          : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                      }`}
                    >
                      {setup}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing Levels with Quick R:R Calculator */}
              <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                      Entry Level
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="2664.50"
                      value={plan.entryPrice}
                      onChange={(e) => setPlan((p) => ({ ...p, entryPrice: e.target.value }))}
                      className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-primary/50"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-rose-400/80 block mb-1">
                      Stop Loss
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="2661.00"
                      value={plan.stopLoss}
                      onChange={(e) => setPlan((p) => ({ ...p, stopLoss: e.target.value }))}
                      className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-primary/50"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-emerald-400/80 block mb-1">
                      Take Profit 1
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="2678.00"
                      value={plan.takeProfit1}
                      onChange={(e) => setPlan((p) => ({ ...p, takeProfit1: e.target.value }))}
                      className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-primary/50"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-mono text-amber-400/80 block mb-1">
                      Livello Invalidazione
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="2658.00"
                      value={plan.invalidation}
                      onChange={(e) => setPlan((p) => ({ ...p, invalidation: e.target.value }))}
                      className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-primary/50"
                    />
                  </div>
                </div>

                {/* Smart R:R Calculator Quick-Pills */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-mono text-primary flex items-center gap-1 font-semibold uppercase">
                      <Calculator size={11} />
                      Calcola TP da R:R:
                    </span>
                    {[2, 2.5, 3, 4, 5].map((ratio) => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => applyTakeProfitRatio(ratio)}
                        disabled={!plan.entryPrice || !plan.stopLoss}
                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                      >
                        1:{ratio}
                      </button>
                    ))}
                  </div>

                  <div className="text-xs font-mono">
                    <span className="text-muted-foreground">R:R Effettivo: </span>
                    <strong
                      className={`font-bold ${parseFloat(rrRatio) >= 2.5 ? "text-emerald-400" : "text-amber-400"}`}
                    >
                      1 : {rrRatio}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Risk Selection with Quick Chips */}
              <div className="p-3 rounded-xl border border-white/10 bg-white/[0.02] space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-muted-foreground">
                    Rischio Massimo per Trade (Max Loss)
                  </label>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {plan.riskAmount}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="5€ o 1%"
                    value={plan.riskAmount}
                    onChange={(e) => setPlan((p) => ({ ...p, riskAmount: e.target.value }))}
                    className="w-32 h-8 rounded-md border border-white/10 bg-black/40 px-2.5 text-xs font-mono text-foreground focus:border-primary/50"
                  />
                  <div className="flex flex-wrap gap-1">
                    {QUICK_RISK_PRESETS.map((rk) => (
                      <button
                        key={rk}
                        type="button"
                        onClick={() => setPlan((p) => ({ ...p, riskAmount: rk }))}
                        className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors cursor-pointer ${
                          plan.riskAmount === rk
                            ? "bg-primary/20 border-primary text-primary font-bold"
                            : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {rk}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes with Quick Action to open 4 questions */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-mono text-muted-foreground">
                    Note Operative & Condizioni
                  </label>
                  <button
                    type="button"
                    onClick={() => setActiveTab("questions")}
                    className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Compass size={11} />
                    <span>Compila le 4 Domande per autocompilare le Note ↗</span>
                  </button>
                </div>
                <textarea
                  rows={3}
                  placeholder="Descrivi la schematica: es. attendo chiusura candela M15 sopra il range per confermare lo sweep; pool opposto a 2650; spinta minima 10% verificata..."
                  value={plan.notes}
                  onChange={(e) => setPlan((p) => ({ ...p, notes: e.target.value }))}
                  className="w-full rounded-md border border-white/10 bg-black/40 p-2.5 text-xs text-foreground focus:border-primary/50 font-sans"
                />
              </div>

              {/* Image Upload / Paste */}
              <div className="p-3.5 rounded-xl border border-dashed border-white/15 bg-white/[0.01] space-y-2 text-center">
                {plan.imageUrl ? (
                  <div className="relative inline-block">
                    <img
                      src={plan.imageUrl}
                      alt="Preview"
                      className="max-h-[220px] rounded-lg border border-white/10 object-contain mx-auto"
                    />
                    <button
                      type="button"
                      onClick={() => setPlan((p) => ({ ...p, imageUrl: null }))}
                      className="absolute -top-2 -right-2 p-1 rounded-full bg-rose-600 text-white hover:bg-rose-500 shadow cursor-pointer"
                      title="Rimuovi immagine"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <UploadCloud size={24} className="mx-auto text-primary/60 mb-1" />
                    <p className="text-xs font-medium text-foreground">
                      Trascina qui lo screenshot o premi{" "}
                      <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10 text-[10px] font-mono">
                        Cmd + V
                      </kbd>{" "}
                      per incollare
                    </p>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 text-xs px-3 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-foreground transition-colors cursor-pointer"
                    >
                      Sfoglia File...
                    </button>
                  </div>
                )}
              </div>

              {/* Checklist with "Valida Tutto" */}
              <div className="space-y-2 p-3 rounded-xl border border-white/10 bg-white/[0.01]">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold block">
                    Regole di Validazione Inviolabili (8 Punti)
                  </span>
                  <button
                    type="button"
                    onClick={handleCheckAll}
                    className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck size={13} />
                    <span>⚡ Valida Tutto</span>
                  </button>
                </div>
                <div className="space-y-1.5">
                  {PROTOCOL_CHECKLIST_ITEMS.map((item, idx) => (
                    <label
                      key={idx}
                      className="flex items-start gap-2 text-xs text-foreground cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(plan.checklist?.[idx])}
                        onChange={(e) => {
                          const currentChecklist = Array.isArray(plan.checklist)
                            ? [...plan.checklist]
                            : new Array(8).fill(false);
                          currentChecklist[idx] = e.target.checked;
                          setPlan((p) => ({ ...p, checklist: currentChecklist }));
                        }}
                        className="rounded border-white/20 bg-black/40 text-primary focus:ring-primary h-4 w-4 mt-0.5 shrink-0"
                      />
                      <span className={plan.checklist?.[idx] ? "text-foreground" : "text-muted-foreground"}>
                        {item}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setMode("view")}
                  className="text-xs px-3 py-2 rounded-lg border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/5 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="text-xs font-mono px-4 py-2 rounded-lg bg-primary text-black font-bold hover:bg-primary/90 flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Save size={14} />
                  <span>Salva e Conferma Piano</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: LE 4 DOMANDE & ROUTER DI ZONA
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "questions" && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-black/40 to-black/60 space-y-1">
            <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold flex items-center gap-1.5">
              <Compass size={13} />
              L'Interrogatorio Obbligatorio Pre-Trade
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              «Prima che la mano dell'Operatore tocchi il mouse o imposti una linea d'ordine, la mente deve sottoporre il mercato a quattro interrogativi spietati. Se a una sola di queste domande non corrisponde una risposta oggettiva, l'operazione non esiste.»
            </p>
          </div>

          {/* Domanda 1: Dove ci troviamo? */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono font-bold text-xs">
                  1
                </span>
                <h4 className="text-sm font-bold text-foreground">
                  Dove ci troviamo?
                </h4>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase px-2 py-0.5 rounded bg-white/5">
                Ciclo HTF & Assenza Compressione
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                  Contesto Ciclo HTF (Daily / H4 / H1):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    "Trend Rialzista Strutturato",
                    "Trend Ribassista Strutturato",
                    "Estremo Raggiunto (Esaurimento)",
                    "Range / Re-accumulo Intermedio",
                  ].map((ctx) => (
                    <button
                      key={ctx}
                      type="button"
                      onClick={() =>
                        setPlan((p) => ({
                          ...p,
                          fourQuestions: {
                            ...(p.fourQuestions || {
                              q1Context: "",
                              q1NoCompression: true,
                              q2Structure: "zone_mitigated",
                              q2Notes: "",
                              q3ItfCycleClosed: false,
                              q3LtfSchematic: false,
                              q3Trigger: "TEST",
                              q4OppositePool: "",
                              q4TenPercentVerified: false,
                            }),
                            q1Context: ctx,
                          },
                        }))
                      }
                      className={`p-2 rounded border text-left font-mono transition-all cursor-pointer ${
                        plan.fourQuestions?.q1Context === ctx
                          ? "bg-primary/20 border-primary text-primary font-bold"
                          : "bg-black/30 border-white/10 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {ctx}
                    </button>
                  ))}
                </div>
              </div>

              {/* Compressione Filter Checkbox */}
              <div className="p-3 rounded-lg border border-white/10 bg-black/40 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean(plan.fourQuestions?.q1NoCompression)}
                    onChange={(e) =>
                      setPlan((p) => ({
                        ...p,
                        fourQuestions: {
                          ...(p.fourQuestions || {
                            q1Context: "",
                            q1NoCompression: true,
                            q2Structure: "zone_mitigated",
                            q2Notes: "",
                            q3ItfCycleClosed: false,
                            q3LtfSchematic: false,
                            q3Trigger: "TEST",
                            q4OppositePool: "",
                            q4TenPercentVerified: false,
                          }),
                          q1NoCompression: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-white/20 bg-black text-primary focus:ring-primary h-4 w-4 mt-0.5 shrink-0"
                  />
                  <div>
                    <strong className="text-foreground text-xs block">
                      Certifico la TOTALE ASSENZA DI COMPRESSIONE
                    </strong>
                    <span className="text-[11px] text-muted-foreground leading-relaxed block mt-0.5">
                      Non vi è liquidità evidente contemporaneamente sia sopra sia sotto. Se presente liquidità sopra e sotto: <strong>NO TRADE</strong>. È severamente vietato anticipare il breakout del range.
                    </span>
                  </div>
                </label>

                {!plan.fourQuestions?.q1NoCompression && (
                  <div className="p-2.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle size={15} className="text-rose-400 shrink-0" />
                    <span>
                      🛑 <strong>REGOLA INVIOLABILE: NO TRADE IN COMPRESSIONE!</strong> Attendi che la liquidità esterna venga catturata prima di toccare la piattaforma.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Domanda 2: Cosa ha preso a sinistra? + ROUTER DI ZONA */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono font-bold text-xs">
                  2
                </span>
                <h4 className="text-sm font-bold text-foreground">
                  Cosa ha preso a sinistra?
                </h4>
              </div>
              <span className="text-[10px] font-mono text-primary uppercase px-2 py-0.5 rounded bg-primary/10 border border-primary/20 font-bold">
                Router di Zona Automatico
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground text-xs">
                Seleziona la struttura toccata dal prezzo a sinistra per determinare immediatamente se il setup d'inversione è consentito o se è autorizzata solo la continuazione:
              </p>

              {/* 3 Zone Router Options */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Opzione 1: Zona HTF mitigata */}
                <button
                  type="button"
                  onClick={() =>
                    setPlan((p) => ({
                      ...p,
                      fourQuestions: {
                        ...(p.fourQuestions || {
                          q1Context: "",
                          q1NoCompression: true,
                          q2Structure: "zone_mitigated",
                          q2Notes: "",
                          q3ItfCycleClosed: false,
                          q3LtfSchematic: false,
                          q3Trigger: "TEST",
                          q4OppositePool: "",
                          q4TenPercentVerified: false,
                        }),
                        q2Structure: "zone_mitigated",
                      },
                    }))
                  }
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    plan.fourQuestions?.q2Structure === "zone_mitigated"
                      ? "bg-emerald-500/15 border-emerald-500/50 shadow-sm"
                      : "bg-black/30 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] uppercase font-bold text-emerald-400">
                      BIVIO 1
                    </span>
                    {plan.fourQuestions?.q2Structure === "zone_mitigated" && (
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    )}
                  </div>
                  <strong className="text-foreground text-xs block font-bold">
                    Zona HTF Valida Toccata e Mitigata
                  </strong>
                  <span className="text-[11px] text-muted-foreground mt-1 block leading-relaxed">
                    Livello H1/H4 o Daily testato con successo.
                  </span>
                </button>

                {/* Opzione 2: Sola liquidità */}
                <button
                  type="button"
                  onClick={() =>
                    setPlan((p) => ({
                      ...p,
                      fourQuestions: {
                        ...(p.fourQuestions || {
                          q1Context: "",
                          q1NoCompression: true,
                          q2Structure: "zone_mitigated",
                          q2Notes: "",
                          q3ItfCycleClosed: false,
                          q3LtfSchematic: false,
                          q3Trigger: "TEST",
                          q4OppositePool: "",
                          q4TenPercentVerified: false,
                        }),
                        q2Structure: "liquidity_only",
                      },
                    }))
                  }
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    plan.fourQuestions?.q2Structure === "liquidity_only"
                      ? "bg-rose-500/15 border-rose-500/50 shadow-sm"
                      : "bg-black/30 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] uppercase font-bold text-rose-400">
                      BIVIO 2
                    </span>
                    {plan.fourQuestions?.q2Structure === "liquidity_only" && (
                      <CheckCircle2 size={13} className="text-rose-400" />
                    )}
                  </div>
                  <strong className="text-foreground text-xs block font-bold">
                    Solo Liquidità (Senza Zona HTF)
                  </strong>
                  <span className="text-[11px] text-muted-foreground mt-1 block leading-relaxed">
                    Presa di liquidità su massimi/minimi senza zona HTF di riferimento.
                  </span>
                </button>

                {/* Opzione 3: Re-accumulo intermedio */}
                <button
                  type="button"
                  onClick={() =>
                    setPlan((p) => ({
                      ...p,
                      fourQuestions: {
                        ...(p.fourQuestions || {
                          q1Context: "",
                          q1NoCompression: true,
                          q2Structure: "zone_mitigated",
                          q2Notes: "",
                          q3ItfCycleClosed: false,
                          q3LtfSchematic: false,
                          q3Trigger: "TEST",
                          q4OppositePool: "",
                          q4TenPercentVerified: false,
                        }),
                        q2Structure: "intermediate_reaccumulation",
                      },
                    }))
                  }
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    plan.fourQuestions?.q2Structure === "intermediate_reaccumulation"
                      ? "bg-amber-500/15 border-amber-500/50 shadow-sm"
                      : "bg-black/30 border-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] uppercase font-bold text-amber-400">
                      BIVIO 3
                    </span>
                    {plan.fourQuestions?.q2Structure === "intermediate_reaccumulation" && (
                      <CheckCircle2 size={13} className="text-amber-400" />
                    )}
                  </div>
                  <strong className="text-foreground text-xs block font-bold">
                    Re-accumuli / Ri-distribuzioni Intermedi
                  </strong>
                  <span className="text-[11px] text-muted-foreground mt-1 block leading-relaxed">
                    Zona estrema non raggiunta. Fase 2 attiva nel box corrente.
                  </span>
                </button>
              </div>

              {/* DYNAMIC ROUTER VERDICT CARD */}
              <div
                className={`p-3.5 rounded-lg border space-y-1.5 transition-all ${
                  routerVerdict.type === "success"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
                    : routerVerdict.type === "danger"
                      ? "bg-rose-500/15 border-rose-500/40 text-rose-200"
                      : "bg-amber-500/15 border-amber-500/40 text-amber-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={16} />
                    <span className="font-mono text-xs font-bold tracking-wide uppercase">
                      Verdetto Router: {routerVerdict.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-white/10">
                    Trigger ammessi: {routerVerdict.allowedTriggers.join(" · ")}
                  </span>
                </div>
                <p className="text-xs font-semibold leading-relaxed">
                  {routerVerdict.rule}
                </p>
              </div>
            </div>
          </div>

          {/* Domanda 3: Come ci è arrivato? */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono font-bold text-xs">
                  3
                </span>
                <h4 className="text-sm font-bold text-foreground">
                  Come ci è arrivato?
                </h4>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase px-2 py-0.5 rounded bg-white/5">
                Ciclo ITF & Schematica LTF
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-white/10 bg-black/30 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(plan.fourQuestions?.q3ItfCycleClosed)}
                  onChange={(e) =>
                    setPlan((p) => ({
                      ...p,
                      fourQuestions: {
                        ...(p.fourQuestions || {
                          q1Context: "",
                          q1NoCompression: true,
                          q2Structure: "zone_mitigated",
                          q2Notes: "",
                          q3ItfCycleClosed: false,
                          q3LtfSchematic: false,
                          q3Trigger: "TEST",
                          q4OppositePool: "",
                          q4TenPercentVerified: false,
                        }),
                        q3ItfCycleClosed: e.target.checked,
                      },
                    }))
                  }
                  className="rounded border-white/20 bg-black text-primary focus:ring-primary h-4 w-4 mt-0.5 shrink-0"
                />
                <div>
                  <strong className="text-foreground block font-bold">
                    Ciclo ITF Chiuso Formalmente
                  </strong>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block leading-relaxed">
                    Il ciclo intermedio (M15 per scalping, H1 per swing) ha completato la propria espansione o esaurimento.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-white/10 bg-black/30 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(plan.fourQuestions?.q3LtfSchematic)}
                  onChange={(e) =>
                    setPlan((p) => ({
                      ...p,
                      fourQuestions: {
                        ...(p.fourQuestions || {
                          q1Context: "",
                          q1NoCompression: true,
                          q2Structure: "zone_mitigated",
                          q2Notes: "",
                          q3ItfCycleClosed: false,
                          q3LtfSchematic: false,
                          q3Trigger: "TEST",
                          q4OppositePool: "",
                          q4TenPercentVerified: false,
                        }),
                        q3LtfSchematic: e.target.checked,
                      },
                    }))
                  }
                  className="rounded border-white/20 bg-black text-primary focus:ring-primary h-4 w-4 mt-0.5 shrink-0"
                />
                <div>
                  <strong className="text-foreground block font-bold">
                    Schematica LTF Validata
                  </strong>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block leading-relaxed">
                    Shift strutturale o manipolazione conclamata su M1 (o M5 per swing). Reazione immediata ed aggressiva.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Domanda 4: Cosa deve prendere? */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center font-mono font-bold text-xs">
                  4
                </span>
                <h4 className="text-sm font-bold text-foreground">
                  Cosa deve prendere?
                </h4>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase px-2 py-0.5 rounded bg-white/5">
                Pool Opposto & Soglia 10%
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                  Pool di liquidità opposto identificato (Target obbligatorio prima dell'ingresso):
                </label>
                <input
                  type="text"
                  placeholder="es. Sell-side liquidity sotto i minimi H1 / Buyside liquidity asiatica a 2680"
                  value={plan.fourQuestions?.q4OppositePool || ""}
                  onChange={(e) =>
                    setPlan((p) => ({
                      ...p,
                      fourQuestions: {
                        ...(p.fourQuestions || {
                          q1Context: "",
                          q1NoCompression: true,
                          q2Structure: "zone_mitigated",
                          q2Notes: "",
                          q3ItfCycleClosed: false,
                          q3LtfSchematic: false,
                          q3Trigger: "TEST",
                          q4OppositePool: "",
                          q4TenPercentVerified: false,
                        }),
                        q4OppositePool: e.target.value,
                      },
                    }))
                  }
                  className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs text-foreground focus:border-primary/50"
                />
              </div>

              {/* Area Vergine & 10% Imbalance Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-lg border border-white/10 bg-black/30 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(plan.fourQuestions?.q4TenPercentVerified)}
                  onChange={(e) =>
                    setPlan((p) => ({
                      ...p,
                      fourQuestions: {
                        ...(p.fourQuestions || {
                          q1Context: "",
                          q1NoCompression: true,
                          q2Structure: "zone_mitigated",
                          q2Notes: "",
                          q3ItfCycleClosed: false,
                          q3LtfSchematic: false,
                          q3Trigger: "TEST",
                          q4OppositePool: "",
                          q4TenPercentVerified: false,
                        }),
                        q4TenPercentVerified: e.target.checked,
                      },
                    }))
                  }
                  className="rounded border-white/20 bg-black text-primary focus:ring-primary h-4 w-4 mt-0.5 shrink-0"
                />
                <div>
                  <strong className="text-foreground block font-bold">
                    Area Vergine & Sbilanciamento Minimo del 10%
                  </strong>
                  <span className="text-[11px] text-muted-foreground mt-0.5 block leading-relaxed">
                    Se M15 chiude in area vergine e M1 accumula/distribuisce: confermo di aver atteso uno sbilanciamento di spinta almeno del 10% (viene rotto il SOW/SOS e si crea la zona di BTI/JTC).
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* CTA: INJECT INTO OPERATIVE PLAN NOTES */}
          <div className="p-3.5 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/10 via-[#181922] to-black/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <strong className="text-xs font-bold text-foreground block">
                Sincronizza le 4 Domande con il Piano Operativo
              </strong>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Genera automaticamente il blocco testuale riassuntivo e incollalo nelle Note del Piano e nel Libro della Verità.
              </p>
            </div>
            <button
              type="button"
              onClick={handleInjectQuestionsToNotes}
              className="px-3.5 py-2 rounded-lg bg-primary text-black font-mono text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow cursor-pointer shrink-0"
            >
              <Zap size={13} />
              <span>⚡ Inietta nelle Note Operative</span>
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: STRATEGIA & PROTOCOLLO COMPLETO (VADEMECUM)
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "strategy" && (
        <div className="space-y-4">
          {/* Header banner */}
          <div className="p-3.5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-[#14151C] to-black/60">
            <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold flex items-center gap-1.5">
              <FileText size={13} />
              Il Codice Strategico Integrale · LIMEN PROTOCOL
            </span>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Tutti i tuoi appunti, gerarchie dei timeframe, regole di direzionalità, router di zona, filtri di sbilanciamento e protocollo di reattività consultabili prima e durante ogni operazione.
            </p>
          </div>

          {/* 1. GERARCHIA DEI TIMEFRAME */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                <Layers size={15} />
                1. Gerarchia dei Timeframe (Divieto dell'Azione Isolata)
              </h4>
              <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded bg-white/5">
                Scalping vs Swing
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-white/10 bg-black/40 space-y-1.5">
                <span className="font-mono text-[10px] uppercase font-bold text-amber-400 block">
                  ⚡ SCALPING (Il Duello Rapido)
                </span>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground font-mono">H1:</strong>
                    <span>Zona e pool di liquidità principali</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground font-mono">M15:</strong>
                    <span>Schematica interna e certificazione chiusura ciclo</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground font-mono">M1:</strong>
                    <span>Trigger chirurgico (Test, POC, JTC / BTI)</span>
                  </li>
                </ul>
              </div>

              <div className="p-3 rounded-lg border border-white/10 bg-black/40 space-y-1.5">
                <span className="font-mono text-[10px] uppercase font-bold text-purple-400 block">
                  🏛️ SWING / INTRADAY (L'Assedio Sovrano)
                </span>
                <ul className="space-y-1 text-muted-foreground">
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground font-mono">Daily/H4:</strong>
                    <span>Ciclo Daily + mappatura liquidità e zona H4</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground font-mono">H1 / M15:</strong>
                    <span>Schematica di conferma (inversione o continuazione)</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <strong className="text-foreground font-mono">M5 / M1:</strong>
                    <span>Esecuzione alla conferma formale del ciclo</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-black/50 border border-white/5 text-xs text-muted-foreground space-y-1">
              <p>
                <strong>Vincolo Frattale:</strong> È categoricamente vietato cercare setup su M1 o M5 senza che la struttura H1 o Daily abbia convalidato la direzione e la zona di riferimento.
              </p>
              <p>
                <strong>Regola del Cambio Timeframe:</strong> Le conferme scadono al cambio di giornata italiana. Cambiare timeframe intermedio richiede una nuova schematica; cambiare HTF azzera completamente il contesto.
              </p>
            </div>
          </div>

          {/* 2. DIREZIONALITÀ E LIQUIDITÀ */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2.5 text-xs">
            <h4 className="text-sm font-bold text-foreground border-b border-white/10 pb-2">
              2. Direzionalità e Liquidità
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded bg-black/40 border border-rose-500/20 text-rose-200">
                <strong className="block text-rose-400 font-bold mb-0.5">
                  Liquidità Sopra e Sotto = NO TRADE
                </strong>
                <span>
                  Quando sono presenti pool evidenti sia sui massimi sia sui minimi, il mercato si trova in compressione. È severamente vietato anticipare il breakout del range.
                </span>
              </div>

              <div className="p-2.5 rounded bg-black/40 border border-emerald-500/20 text-emerald-200">
                <strong className="block text-emerald-400 font-bold mb-0.5">
                  Sweep Confermato a Grafico
                </strong>
                <span>
                  Attiva un setup soltanto dopo una presa di liquidità confermata sul grafico a candela chiusa. Nessun ordine prima che la manipolazione si sia consumata.
                </span>
              </div>

              <div className="p-2.5 rounded bg-black/40 border border-white/5 text-muted-foreground">
                <strong className="block text-foreground font-bold mb-0.5">
                  Posizionamento nel Ciclo Grande
                </strong>
                <span>
                  Identifica il posizionamento nel ciclo grande prima di scendere di timeframe. Non invertire mai un flusso HTF privo di esaurimento conclamato.
                </span>
              </div>

              <div className="p-2.5 rounded bg-black/40 border border-amber-500/20 text-amber-200">
                <strong className="block text-amber-400 font-bold mb-0.5">
                  Zona Estrema Non Raggiunta: Fase 2
                </strong>
                <span>
                  Se la zona estrema non è stata toccata e vi sono re-accumuli in corso: il contesto HTF consente il percorso Re-accumuli in Fase 2 senza richiedere lo sweep dell'estremo mancato. Questo percorso consente <strong>esclusivamente JTC</strong>, senza autorizzare inversioni.
                </span>
              </div>
            </div>
          </div>

          {/* 3. IL ROUTER DI ZONA */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2.5 text-xs">
            <h4 className="text-sm font-bold text-primary border-b border-white/10 pb-2">
              3. Il Router di Zona (I 3 Bivi Meccanici)
            </h4>
            <div className="space-y-2">
              <div className="p-2.5 rounded bg-black/40 border border-rose-500/30 flex items-start gap-2">
                <span className="w-5 h-5 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold shrink-0">
                  1
                </span>
                <div>
                  <strong className="text-rose-400 font-bold">Solo liquidità, senza zona HTF:</strong>{" "}
                  <span className="text-foreground/90">
                    Inversioni severamente VIETATE. Autorizzati esclusivamente setup di continuazione del trend dominante: <strong>solo BTI o JTC</strong>.
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded bg-black/40 border border-emerald-500/30 flex items-start gap-2">
                <span className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
                  2
                </span>
                <div>
                  <strong className="text-emerald-400 font-bold">Zona HTF valida toccata e mitigata:</strong>{" "}
                  <span className="text-foreground/90">
                    Autorizzata la ricerca d'inversione, ma unicamente dopo aver validato una schematica ITF completa sul timeframe intermedio.
                  </span>
                </div>
              </div>

              <div className="p-2.5 rounded bg-black/40 border border-amber-500/30 flex items-start gap-2">
                <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold shrink-0">
                  3
                </span>
                <div>
                  <strong className="text-amber-400 font-bold">Re-accumuli / ri-distribuzioni intermedi:</strong>{" "}
                  <span className="text-foreground/90">
                    Adatta la continuazione al box corrente: ingresso <strong>JTC</strong> senza aspettare né pretendere lo sweep dell'estremo mancato.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. CICLO, INGRESSO & SPINTA 10% */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2 text-xs">
            <h4 className="text-sm font-bold text-foreground border-b border-white/10 pb-2">
              4. Ciclo, Ingresso & Soglia del 10%
            </h4>
            <ul className="space-y-1.5 text-muted-foreground list-disc list-inside">
              <li>
                Completa il ciclo ITF e valida la schematica d'ingresso sul LTF previsto dalla matrice.
              </li>
              <li>
                Trigger Test, POC, JTC o BTI: il Router di Zona limita rigorosamente quelli ammessi per scenario.
              </li>
              <li className="text-amber-300">
                <strong>Area Vergine & 10%:</strong> Se M15 chiude in area vergine e M1 accumula o distribuisce, attendi tassativamente uno sbilanciamento di spinta almeno del 10% (viene rotto il SOW/SOS e si crea la zona di BTI / JTC da utilizzare in seguito).
              </li>
              <li>
                <strong>Pool Opposto:</strong> Identifica con precisione millimetrica il pool di liquidità opposto prima dell'esecuzione.
              </li>
            </ul>
          </div>

          {/* 5. REATTIVITÀ, INVALIDAZIONE & FLIP */}
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-2 text-xs">
            <h4 className="text-sm font-bold text-foreground border-b border-white/10 pb-2">
              5. Reattività, Invalidazione e Regola del Flip
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                <strong className="text-foreground font-bold block">Reattività Immediata Post-M1</strong>
                <p className="text-muted-foreground">
                  Dopo la schematica M1, la reazione deve essere immediata ed aggressiva; il tempo di congestione prolungata indebolisce inesorabilmente la zona.
                </p>
              </div>

              <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                <strong className="text-foreground font-bold block">Congestione a Ridosso della Zona</strong>
                <p className="text-muted-foreground">
                  In caso di congestione: cancella immediatamente il pendente oppure riduci/chiudi il rischio. Conferma manualmente l'azione nel cockpit.
                </p>
              </div>

              <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                <strong className="text-foreground font-bold block">Schematica Violata & Flip</strong>
                <p className="text-muted-foreground">
                  Schematica d'inversione violata: cambia subito bias verso la continuazione e cerca una nuova schematica. Nessun nuovo ingresso senza tutte le conferme.
                </p>
              </div>

              <div className="p-2.5 rounded bg-black/40 border border-white/5 space-y-1">
                <strong className="text-foreground font-bold block">Distinzione Pendente ed Eseguito</strong>
                <p className="text-muted-foreground">
                  Ordine pendente ed eseguito sono entità distinte. Prima delle notizie macro, rivaluta e cancella il pendente sul broker; registra manualmente l'annullamento.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: FINESTRE OPERATIVE ITALIANE & RED FOLDER NEWS
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "windows" && (
        <div className="space-y-4">
          {/* Header with live clock */}
          <div className="p-3.5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-[#12131A] to-black/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold flex items-center gap-1.5">
                <Clock size={13} />
                Il Quadrante delle Sessioni Italiane (Europe/Rome)
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Orari, filtri di sessione, limiti di orario per Scalping e Swing e difesa macroeconomica.
              </p>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-primary/40 font-mono text-xs text-primary font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Ora di Roma: {romeClock.timeString} ({romeClock.dateString})</span>
            </div>
          </div>

          {/* List of 8 Italian Windows */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {sessionStatus.sessions.map((sess) => (
              <div
                key={sess.id}
                className={`p-3 rounded-xl border transition-all ${
                  sess.isActive
                    ? "bg-primary/10 border-primary/50 shadow-md ring-1 ring-primary/20"
                    : "bg-white/[0.02] border-white/10"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <strong className="text-foreground text-sm font-bold">{sess.name}</strong>
                    <span className="font-mono text-xs text-muted-foreground font-semibold">
                      · {sess.hours}
                    </span>
                  </div>
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${sess.badgeClass}`}>
                    {sess.badgeText}
                  </span>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed mb-1.5">
                  {sess.summary}
                </p>
                <div className="p-2 rounded bg-black/40 border border-white/5 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                  <span>{sess.keyRule}</span>
                  <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                    <span className={sess.canScalp ? "text-emerald-400 font-bold" : "text-rose-400/80"}>
                      {sess.canScalp ? "Scalp: SI" : "Scalp: NO"}
                    </span>
                    <span>·</span>
                    <span className={sess.canSwing ? "text-purple-400 font-bold" : "text-zinc-500"}>
                      {sess.canSwing ? "Swing: SI" : "Swing: NO"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* RED FOLDER NEWS PROTOCOL */}
          <div className="p-4 rounded-xl border border-rose-500/30 bg-gradient-to-r from-rose-950/20 via-black/40 to-black/60 space-y-3">
            <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
              <h4 className="text-sm font-bold text-rose-300 flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-400" />
                Red Folder News: Il Protocollo di Difesa da Impatto
              </h4>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                Barriera -10 min / +45 min
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs leading-relaxed">
              <div className="p-2.5 rounded-lg bg-black/40 border border-rose-500/20 space-y-1">
                <strong className="text-foreground font-bold block">1. Calendario e Fuso Europe/Rome</strong>
                <p className="text-muted-foreground">
                  Calendario della giornata sincronizzato da <strong>Forex Factory / Fair Economy</strong>, in orario Europe/Rome, con fonte ufficiale e ultimo controllo sempre visibili.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-rose-500/20 space-y-1">
                <strong className="text-rose-300 font-bold block">2. Blocco Preventivo (Default 10 Minuti)</strong>
                <p className="text-muted-foreground">
                  Prima dei rilasci ad alto impatto (Red Folder): stop totale a ordini pendenti e nuovi ingressi con anticipo configurabile di almeno 10 minuti.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-rose-500/20 space-y-1">
                <strong className="text-foreground font-bold block">3. Verifica Post-Rilascio & Termine 45 Min</strong>
                <p className="text-muted-foreground">
                  Dopo l'orario previsto, verifica manualmente spike, nuovo sweep e nuova schematica. Il richiamo post-news termina automaticamente 45 minuti dopo l'evento; il calendario conserva l'evento.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-rose-500/20 space-y-1">
                <strong className="text-rose-400 font-bold block">4. Regola della Fonte Non Verificabile</strong>
                <p className="text-muted-foreground">
                  Se la fonte macro non è verificabile: nuovi ingressi rigorosamente bloccati. Il controllo manuale non può scavalcare un blocco del calendario.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 5: GLOSSARIO DEL METODO
         ───────────────────────────────────────────────────────────── */}
      {activeTab === "glossary" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-[#14151C] to-black/60">
            <div>
              <span className="font-mono text-[10px] text-primary uppercase tracking-widest font-bold flex items-center gap-1.5">
                <BookOpen size={13} />
                Glossario Ufficiale · LIMEN PROTOCOL
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Il dizionario canonico del metodo, i quattro trigger (Test, POC, JTC, BTI) e le leggi di validazione.
              </p>
            </div>

            {/* Search filter */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cerca nel glossario..."
                value={glossarySearch}
                onChange={(e) => setGlossarySearch(e.target.value)}
                className="w-full h-8 pl-8 pr-3 rounded-lg border border-white/10 bg-black/40 text-xs text-foreground focus:border-primary/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {filteredGlossary.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] space-y-1.5 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <h5 className="text-sm font-bold text-foreground font-mono">
                    {item.term}
                  </h5>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-semibold">
                    {item.tag}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
