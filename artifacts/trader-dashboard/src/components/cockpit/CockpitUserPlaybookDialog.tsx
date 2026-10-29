import { useState, useEffect, useRef, useMemo } from "react";
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  Sparkles,
  UploadCloud,
  X,
  Search,
  Lightbulb,
  Target,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
  Copy,
  Maximize2,
  ExternalLink,
  Image as ImageIcon,
  Check,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type TradeOutcome = "win" | "loss" | "breakeven" | "no_trade";

export interface UserPlaybookSetup {
  id: string;
  title: string;
  asset: string;
  outcome: TradeOutcome;
  riskReward: string;
  pnlPoints?: string;
  category: "inversion" | "compression" | "continuation" | "reaccum" | "custom";
  categoryLabel: string;
  trigger: "TEST" | "POC" | "JTC" | "BTI" | "WAIT";
  timeframeHierarchy?: string;
  sessionWindow?: "asia" | "london" | "lunch" | "ny" | "swing_sera" | "other";
  doveHTF: string;
  sinistra: string;
  comeTrigger: string;
  targetPool: string;
  whatWorkedOrFailed: string;
  psychologyNote?: string;
  lesson: string;
  imageUrl: string | null;
  createdAt: string;
}

const STORAGE_KEY = "tl_user_playbook_setups_v2";

export const CURATED_PLAYBOOK_SEEDS: UserPlaybookSetup[] = [
  {
    id: "seed-win-sweep-gold",
    title: "Sweep Asian Low → Reversal M15 → Entry su TEST / POC",
    asset: "XAU/USD",
    outcome: "win",
    riskReward: "+3.8R",
    pnlPoints: "+46 pips",
    category: "inversion",
    categoryLabel: "Inversione (Sweep)",
    trigger: "POC",
    timeframeHierarchy: "H1 / M15 / M1 (Scalping)",
    sessionWindow: "london",
    doveHTF: "Ciclo Daily chiaramente rialzista. Durante l'apertura di Londra il prezzo affonda sotto l'Asian Low effettuando una caccia alla liquidità sell-side.",
    sinistra: "Mitigazione di un blocco d'ordine e FVG H1 vergine a sinistra. Assorbimento immediato dei contratti e reiezione in pinbar.",
    comeTrigger: "Schematica M15 con rottura struttura (CHoCH). Ingresso chirurgico sul re-test del POC volumetrico a 5 candele.",
    targetPool: "Pool opposto di buy-side liquidity sopra il massimo asiatico (Asian High).",
    whatWorkedOrFailed: "Atteso lo sweep completo dell'Asian Low prima di cercare conferme. Reazione violenta e istantanea senza congestione prolungata sulla zona.",
    psychologyNote: "Nessuna fretta di anticipare: la pazienza di attendere la chiusura della candela M15 ha garantito uno stop loss ridotto e r:r eccellente.",
    lesson: "Non entrare mai prima che l'estremo sia stato spazzato. La pazienza crea il margine.",
    imageUrl: "/images/cockpit-schematics/liq-swept.png",
    createdAt: "2026-10-21T08:30:00.000Z",
  },
  {
    id: "seed-loss-no-htf-zone",
    title: "Inversione Cercata su Sola Liquidità Senza Zona HTF Valida",
    asset: "EUR/USD",
    outcome: "loss",
    riskReward: "-1.0R",
    pnlPoints: "-18 pips",
    category: "inversion",
    categoryLabel: "Inversione Fallita",
    trigger: "TEST",
    timeframeHierarchy: "H1 / M15 / M1 (Scalping)",
    sessionWindow: "ny",
    doveHTF: "Trend ribassista H4 intatto. Preso un minimo locale a New York ma senza alcuna zona HTF istituzionale a supporto.",
    sinistra: "Sola presa di liquidità locale; nessuna zona d'ordine HTF mitigata a sinistra.",
    comeTrigger: "Micro-schematica M1 violata violentemente dopo appena due candele: continuazione ribassista immediata e stop colpito.",
    targetPool: "Massimo relativo precedente (mai raggiunto dal prezzo).",
    whatWorkedOrFailed: "ERRORE GRAVE DI ROUTER: Cercata inversione senza zona HTF toccata. La regola stabilisce tassativamente che in assenza di zona HTF sono consentiti esclusivamente JTC o BTI in continuazione!",
    psychologyNote: "Bias da 'prezzo troppo basso per vendere'. Caduto nella tentazione di anticipare il rimbalzo contro il trend H4.",
    lesson: "Sola liquidità, senza zona HTF: inversioni categoricamente vietate. Solo BTI o JTC in continuazione.",
    imageUrl: "/images/cockpit-schematics/scenario-no-zone.png",
    createdAt: "2026-10-20T15:15:00.000Z",
  },
  {
    id: "seed-loss-lunch-chop",
    title: "Ingresso Forzato Durante la Pausa Lunch (11:30–13:30)",
    asset: "USOIL",
    outcome: "loss",
    riskReward: "-1.0R",
    pnlPoints: "-24 pt",
    category: "continuation",
    categoryLabel: "Falso Breakout Lunch",
    trigger: "BTI",
    timeframeHierarchy: "M15 / M5 / M1 (Scalping)",
    sessionWindow: "lunch",
    doveHTF: "Mercato in congestione a ridosso del massimo di Londra. Orario 12:20 italiane.",
    sinistra: "Nessun nuovo sweep strutturale: compressione interna al box mattutino.",
    comeTrigger: "Falsa rottura volumetrica BTI su M5 senza sbilanciamento del 10% né follow-through.",
    targetPool: "Estensione R1 (falsa rottura riassorbita in 10 minuti con stop out).",
    whatWorkedOrFailed: "ERRORE DI FINESTRA OPERATIVA: Apertura di un nuovo trade alle 12:20 durante la pausa Lunch quando l'impulso non era già partito. Basso volume istituzionale, spread allargato e chop brutale.",
    psychologyNote: "Noia e impazienza da monitor acceso post-Londra. Trade forzato senza setup di grado A.",
    lesson: "Finestra Lunch (11:30–13:30): Evita nuovi ingressi se l'impulso non è già partito. Conserva lucidità e capitale per New York.",
    imageUrl: "/images/cockpit-schematics/mgmt-invalidation.png",
    createdAt: "2026-10-19T12:20:00.000Z",
  },
  {
    id: "seed-win-jtc-btc",
    title: "Join The Current (JTC) su Trend H4 Esplosivo & Retest Struttura",
    asset: "BTC/USD",
    outcome: "win",
    riskReward: "+3.2R",
    pnlPoints: "+1,420 pt",
    category: "continuation",
    categoryLabel: "Continuazione (JTC)",
    trigger: "JTC",
    timeframeHierarchy: "Daily + H4 → M15 → M5",
    sessionWindow: "ny",
    doveHTF: "Forte spinta impulsiva H4 dopo la rottura pulita di una resistenza chiave settimanale.",
    sinistra: "Nessun sweep recente di estremi opposti; continuazione fluida del momentum istituzionale.",
    comeTrigger: "Ritracciamento controllato su M15 al livello di rottura (Join The Current). Rifiuto netto e retest del box volumetrico.",
    targetPool: "Pool di liquidità non mitigato a monte sui massimi mensili (estensione 161.8%).",
    whatWorkedOrFailed: "Non cercata l'inversione su un trend parabolico. Rispettata la gerarchia: H4 bias rialzista, M15 ingresso in pullback ordinato con stop sotto il box.",
    psychologyNote: "Nessuna vertigine per i massimi: seguire il flusso degli ordini istituzionali senza cercare minimi o massimi assoluti.",
    lesson: "Nel trend direzionale forte non cercare mai l'inversione: segui il flusso con JTC sul retest del livello.",
    imageUrl: "/images/cockpit-schematics/trigger-jtc.png",
    createdAt: "2026-10-18T16:45:00.000Z",
  },
  {
    id: "seed-notrade-compression",
    title: "Compressione di Liquidità (Inside Range) → Restare Fuori (NO TRADE)",
    asset: "XAU/USD",
    outcome: "no_trade",
    riskReward: "0R",
    pnlPoints: "0 pt (Capitale Protetto)",
    category: "compression",
    categoryLabel: "Compressione (No Trade)",
    trigger: "WAIT",
    timeframeHierarchy: "H1 / M15",
    sessionWindow: "asia",
    doveHTF: "Prezzo intrappolato all'interno del range della candela Daily precedente, con equal highs sopra e equal lows sotto.",
    sinistra: "Nessuna zona estrema raggiunta. Il mercato comprime accumulando ordini da entrambi i lati.",
    comeTrigger: "Falsi breakout intermittenti su M15 e candele sovrapposte senza espansione direzionale. Trigger WAIT tassativo.",
    targetPool: "Nessun ordine autorizzato. Si resta spettatori fino allo sweep accertato di un estremo.",
    whatWorkedOrFailed: "DECISIONE PERFETTA: Liquidità sia sopra sia sotto = NO TRADE. Riconosciuta la compressione prima di farsi tritare dai falsi breakout.",
    psychologyNote: "Miglior trade della giornata: non fare alcun trade. Zero stress, capitale intatto.",
    lesson: "Liquidità sia sopra sia sotto: NO TRADE. Non anticipare il breakout del range.",
    imageUrl: "/images/cockpit-schematics/liq-compression.png",
    createdAt: "2026-10-17T03:15:00.000Z",
  },
  {
    id: "seed-win-reaccum-gold",
    title: "Re-accumulo Wyckoff su Box Intermedio (Rischio Dimezzato)",
    asset: "XAU/USD",
    outcome: "win",
    riskReward: "+2.5R",
    pnlPoints: "+34 pips",
    category: "reaccum",
    categoryLabel: "Re-accumulo Intermedio",
    trigger: "TEST",
    timeframeHierarchy: "H1 / M15 / M1",
    sessionWindow: "ny",
    doveHTF: "Estremo Daily non raggiunto; il contesto HTF consente il percorso Re-accumuli in Fase 2 senza attendere l'estremo.",
    sinistra: "Mitigazione di un box intermedio (area di continuazione non vergine).",
    comeTrigger: "Schematica M15 con sbilanciamento volumetrico ≥ 10%. Ingresso sul re-test del bordo superiore con stop ridotto.",
    targetPool: "Test dei massimi settimanali precedenti.",
    whatWorkedOrFailed: "Percorso Fase 2 seguito alla perfezione: autorizzato solo JTC/TEST di continuazione, nessuna inversione forzata. Rischio dimezzato al 50% come prescritto.",
    psychologyNote: "Adattato il position sizing al box intermedio: disciplina ferrea nel dimezzare il rischio.",
    lesson: "Zona estrema non raggiunta e re-accumuli in corso: autorizzato solo JTC con rischio dimezzato, senza autorizzare inversioni.",
    imageUrl: "/images/cockpit-schematics/scenario-reaccum.png",
    createdAt: "2026-10-16T17:00:00.000Z",
  },
];

interface CockpitUserPlaybookDialogProps {
  currentMarket: string;
  onOpenOperativePlan?: () => void;
}

export function CockpitUserPlaybookDialog({
  currentMarket,
  onOpenOperativePlan,
}: CockpitUserPlaybookDialogProps) {
  const [setups, setSetups] = useState<UserPlaybookSetup[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore
    }
    return CURATED_PLAYBOOK_SEEDS;
  });

  const [activeOutcomeFilter, setActiveOutcomeFilter] = useState<"ALL" | TradeOutcome>("ALL");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [selectedSetupId, setSelectedSetupId] = useState<string>(() => setups[0]?.id ?? "");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [copiedSetupId, setCopiedSetupId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<Omit<UserPlaybookSetup, "id" | "createdAt">>({
    title: "",
    asset: currentMarket,
    outcome: "win",
    riskReward: "+3.0R",
    pnlPoints: "+30 pips",
    category: "inversion",
    categoryLabel: "Inversione (Sweep)",
    trigger: "POC",
    timeframeHierarchy: "H1 / M15 / M1 (Scalping)",
    sessionWindow: "london",
    doveHTF: "",
    sinistra: "",
    comeTrigger: "",
    targetPool: "",
    whatWorkedOrFailed: "",
    psychologyNote: "",
    lesson: "",
    imageUrl: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync to localStorage
  const saveToStorage = (items: UserPlaybookSetup[]) => {
    setSetups(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignore
    }
  };

  // Keyboard listener for Lightbox (Esc to close)
  useEffect(() => {
    if (!lightboxImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxImage(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage]);

  // Paste image listener in Create / Edit mode
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (mode === "list") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
              if (loadEvent.target?.result) {
                setFormData((prev) => ({
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
          setFormData((prev) => ({
            ...prev,
            imageUrl: loadEvent.target!.result as string,
          }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSetup = () => {
    if (!formData.title.trim()) {
      alert("Inserisci un titolo descrittivo per il setup.");
      return;
    }

    if (mode === "create") {
      const newSetup: UserPlaybookSetup = {
        ...formData,
        id: `setup-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      const updated = [newSetup, ...setups];
      saveToStorage(updated);
      setSelectedSetupId(newSetup.id);
    } else if (mode === "edit") {
      const updated = setups.map((s) =>
        s.id === selectedSetupId ? { ...formData, id: s.id, createdAt: s.createdAt } : s
      );
      saveToStorage(updated);
    }

    setMode("list");
  };

  const handleDeleteSetup = (id: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questo esempio dal tuo playbook?")) {
      const updated = setups.filter((s) => s.id !== id);
      saveToStorage(updated);
      if (selectedSetupId === id) {
        setSelectedSetupId(updated[0]?.id ?? "");
      }
    }
  };

  const handleDuplicateSetup = (s: UserPlaybookSetup) => {
    const duplicated: UserPlaybookSetup = {
      ...s,
      id: `setup-${Date.now()}`,
      title: `${s.title} (Copia)`,
      createdAt: new Date().toISOString(),
    };
    const updated = [duplicated, ...setups];
    saveToStorage(updated);
    setSelectedSetupId(duplicated.id);
    setCopiedSetupId(duplicated.id);
    setTimeout(() => setCopiedSetupId(null), 2000);
  };

  const startEdit = (setup: UserPlaybookSetup) => {
    setSelectedSetupId(setup.id);
    setFormData({
      title: setup.title,
      asset: setup.asset,
      outcome: setup.outcome ?? "win",
      riskReward: setup.riskReward ?? "+2.0R",
      pnlPoints: setup.pnlPoints ?? "",
      category: setup.category,
      categoryLabel: setup.categoryLabel,
      trigger: setup.trigger,
      timeframeHierarchy: setup.timeframeHierarchy ?? "H1 / M15 / M1 (Scalping)",
      sessionWindow: setup.sessionWindow ?? "london",
      doveHTF: setup.doveHTF,
      sinistra: setup.sinistra,
      comeTrigger: setup.comeTrigger,
      targetPool: setup.targetPool,
      whatWorkedOrFailed: setup.whatWorkedOrFailed ?? "",
      psychologyNote: setup.psychologyNote ?? "",
      lesson: setup.lesson,
      imageUrl: setup.imageUrl,
    });
    setMode("edit");
  };

  const startCreate = () => {
    setFormData({
      title: "",
      asset: currentMarket,
      outcome: "win",
      riskReward: "+3.0R",
      pnlPoints: "+35 pips",
      category: "inversion",
      categoryLabel: "Inversione (Sweep)",
      trigger: "TEST",
      timeframeHierarchy: "H1 / M15 / M1 (Scalping)",
      sessionWindow: "london",
      doveHTF: "",
      sinistra: "",
      comeTrigger: "",
      targetPool: "",
      whatWorkedOrFailed: "",
      psychologyNote: "",
      lesson: "",
      imageUrl: null,
    });
    setMode("create");
  };

  const handleApplyToOperativePlan = (s: UserPlaybookSetup) => {
    const operativeKey = `tl_cockpit_operative_plan_${currentMarket}`;
    const existing = (() => {
      try {
        const saved = localStorage.getItem(operativeKey);
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    })();

    const updatedPlan = {
      entryPrice: "",
      stopLoss: "",
      invalidation: "",
      takeProfit1: "",
      takeProfit2: "",
      riskAmount: "5€",
      checklist: [false, false, false, false, false],
      ...(existing || {}),
      asset: currentMarket,
      bias: s.category === "inversion" ? "long" : s.trigger === "WAIT" ? "wait" : "long",
      setupName: s.title,
      notes: `[PLAYBOOK AUREUS: ${s.outcome.toUpperCase()}]\n${s.categoryLabel} · TRIGGER: ${s.trigger} (${s.comeTrigger})\nDOVE HTF: ${s.doveHTF}\nSINISTRA: ${s.sinistra}\nTARGET: ${s.targetPool}\nLEZIONE AUREA: ${s.lesson}`,
      imageUrl: s.imageUrl || existing?.imageUrl || null,
      status: "draft",
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(operativeKey, JSON.stringify(updatedPlan));
      window.dispatchEvent(new Event("storage"));
      if (onOpenOperativePlan) {
        onOpenOperativePlan();
      } else {
        alert(`Setup "${s.title}" applicato con successo al Piano Operativo di ${currentMarket}!`);
      }
    } catch {
      // ignore
    }
  };

  // Filtered setups
  const filteredSetups = useMemo(() => {
    return setups.filter((s) => {
      if (activeOutcomeFilter !== "ALL" && s.outcome !== activeOutcomeFilter) return false;
      if (activeCategoryFilter !== "ALL" && s.category !== activeCategoryFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const text = `${s.title} ${s.asset} ${s.categoryLabel} ${s.trigger} ${s.lesson} ${s.doveHTF} ${s.whatWorkedOrFailed}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [setups, activeOutcomeFilter, activeCategoryFilter, searchTerm]);

  const activeSetup = useMemo(() => {
    return setups.find((s) => s.id === selectedSetupId) ?? filteredSetups[0] ?? setups[0];
  }, [setups, selectedSetupId, filteredSetups]);

  // Statistics counts
  const stats = useMemo(() => {
    const total = setups.length;
    const wins = setups.filter((s) => s.outcome === "win").length;
    const losses = setups.filter((s) => s.outcome === "loss").length;
    const noTrades = setups.filter((s) => s.outcome === "no_trade").length;
    return { total, wins, losses, noTrades };
  }, [setups]);

  const getOutcomeBadge = (outcome: TradeOutcome, r: string) => {
    switch (outcome) {
      case "win":
        return {
          label: `WIN · ${r || "+R"}`,
          border: "border-emerald-500/40",
          bg: "bg-emerald-500/10 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]",
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />,
        };
      case "loss":
        return {
          label: `LOSS · ${r || "-1R"}`,
          border: "border-rose-500/40",
          bg: "bg-rose-500/10 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.15)]",
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />,
        };
      case "no_trade":
        return {
          label: `NO TRADE · ${r || "0R"}`,
          border: "border-amber-500/40",
          bg: "bg-amber-500/10 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.15)]",
          icon: <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
        };
      case "breakeven":
        return {
          label: `BE · ${r || "0R"}`,
          border: "border-blue-500/40",
          bg: "bg-blue-500/10 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.15)]",
          icon: <RotateCcw className="w-3.5 h-3.5 text-blue-400 shrink-0" />,
        };
      default:
        return {
          label: r || "SETUP",
          border: "border-white/10",
          bg: "bg-white/5 text-muted-foreground",
          icon: null,
        };
    }
  };

  return (
    <div className="space-y-3.5 text-foreground select-none">
      {/* ── TOP HERO BANNER ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-[#C5A059]/30 bg-gradient-to-r from-[#C5A059]/15 via-[#12131A] to-[#0A0A0E] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#C5A059]/20 border border-[#C5A059]/40 flex items-center justify-center text-[#C5A059] font-bold shadow-[0_0_12px_rgba(197,160,89,0.25)] shrink-0">
            <BookOpen size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground tracking-wide">
                I Miei Esempi Operativi · Playbook Sovrano
              </h3>
              <span className="hidden md:inline-flex px-1.5 py-0.2 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-muted-foreground">
                AUREUS Method
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              Archivio visivo dei setup certificati, trade vinti e persi per imparare dagli errori e schiarirsi la mente
            </p>
          </div>
        </div>

        {mode === "list" && (
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {/* Telemetry pill */}
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-black/40 text-[11px] font-mono">
              <span className="text-emerald-400 font-bold">{stats.wins}V</span>
              <span className="text-white/20">·</span>
              <span className="text-rose-400 font-bold">{stats.losses}P</span>
              <span className="text-white/20">·</span>
              <span className="text-amber-400 font-bold">{stats.noTrades}NT</span>
            </div>

            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const sessionWindow =
                  now.getHours() >= 8 && now.getHours() < 12
                    ? "london"
                    : now.getHours() >= 14 && now.getHours() < 19
                    ? "ny"
                    : "asia";
                setFormData({
                  title: `Setup ${currentMarket} · ${now.toLocaleDateString("it-IT")} (${sessionWindow.toUpperCase()})`,
                  asset: currentMarket,
                  outcome: "win",
                  riskReward: "+3.0R",
                  pnlPoints: "+35 pips",
                  category: "inversion",
                  categoryLabel: "Inversione (Sweep)",
                  trigger: "POC",
                  timeframeHierarchy: "H1 / M15 / M1 (Scalping)",
                  sessionWindow,
                  doveHTF: `Analisi ${currentMarket} in orario ${now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}.`,
                  sinistra: "",
                  comeTrigger: "",
                  targetPool: "",
                  whatWorkedOrFailed: "",
                  psychologyNote: "",
                  lesson: "",
                  imageUrl: null,
                });
                setMode("create");
              }}
              className="text-xs font-mono px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-foreground hover:bg-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Precompila una nuova bozza con l'asset corrente e la data odierna"
            >
              <Zap size={13} className="text-[#C5A059]" />
              <span className="hidden sm:inline">Salva Situazione Attuale</span>
              <span className="sm:hidden">Salva Ora</span>
            </button>

            <button
              type="button"
              onClick={startCreate}
              className="text-xs font-mono px-3.5 py-1.5 rounded-lg bg-[#C5A059] text-black font-bold hover:bg-[#D4AF37] transition-all flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer"
            >
              <Plus size={14} />
              <span>Nuovo Esempio</span>
            </button>
          </div>
        )}
      </div>

      {/* ── CREATE / EDIT MODE ── */}
      {(mode === "create" || mode === "edit") && (
        <div className="space-y-4 p-4 rounded-xl border border-white/10 bg-[#0E0F14]/95 backdrop-blur-md shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-[#C5A059]/20 border border-[#C5A059]/30 flex items-center justify-center text-[#C5A059]">
                <Sparkles size={14} />
              </div>
              <h4 className="text-sm font-bold text-foreground">
                {mode === "create" ? "Nuovo Esempio di Analisi Completa" : "Modifica Esempio Playbook"}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setMode("list")}
              className="text-xs font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-white/10 hover:bg-white/5"
            >
              Annulla
            </button>
          </div>

          {/* Row 1: Title, Asset & Outcome */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Titolo Setup / Sintesi Dinamica
              </label>
              <input
                type="text"
                placeholder="es. Sweep Asian Low → Reversal M15 → Entry su TEST / POC"
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs text-foreground focus:border-[#C5A059]/60 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Asset / Strumento
              </label>
              <input
                type="text"
                placeholder="es. XAU/USD, EUR/USD"
                value={formData.asset}
                onChange={(e) => setFormData((p) => ({ ...p, asset: e.target.value }))}
                className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-[#C5A059]/60 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="text-[11px] font-mono text-muted-foreground block mb-1 font-bold">
                Esito del Trade (Vinto / Perso)
              </label>
              <select
                aria-label="Esito del Trade"
                value={formData.outcome}
                onChange={(e) => {
                  const out = e.target.value as TradeOutcome;
                  setFormData((p) => ({
                    ...p,
                    outcome: out,
                    riskReward: out === "win" ? "+3.0R" : out === "loss" ? "-1.0R" : "0R",
                  }));
                }}
                className={cn(
                  "w-full h-9 rounded-md border px-3 text-xs font-mono font-bold focus:outline-none",
                  formData.outcome === "win"
                    ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-400"
                    : formData.outcome === "loss"
                    ? "border-rose-500/50 bg-rose-950/40 text-rose-400"
                    : "border-amber-500/50 bg-amber-950/40 text-amber-400"
                )}
              >
                <option value="win">🟢 TRADE VINTO (Win)</option>
                <option value="loss">🔴 TRADE PERSO (Loss / Errore)</option>
                <option value="no_trade">🟡 NO TRADE (Compressione / Attesa)</option>
                <option value="breakeven">🔵 BREAK EVEN (BE)</option>
              </select>
            </div>
          </div>

          {/* Row 2: Category, Trigger, R:R & Session */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Categoria Setup
              </label>
              <select
                aria-label="Categoria Setup"
                value={formData.category}
                onChange={(e) => {
                  const cat = e.target.value as UserPlaybookSetup["category"];
                  const labels: Record<string, string> = {
                    inversion: "Inversione (Sweep)",
                    compression: "Compressione (No Trade)",
                    continuation: "Trend Continuation (JTC/BTI)",
                    reaccum: "Re-accumulo Wyckoff",
                    custom: "Personalizzato",
                  };
                  setFormData((p) => ({ ...p, category: cat, categoryLabel: labels[cat] ?? cat }));
                }}
                className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-[#C5A059]/60 focus:outline-none"
              >
                <option value="inversion">Inversione (Sweep)</option>
                <option value="compression">Compressione (No Trade)</option>
                <option value="continuation">Trend Continuation (JTC/BTI)</option>
                <option value="reaccum">Re-accumulo Wyckoff</option>
                <option value="custom">Altro / Personalizzato</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Trigger Esecuzione
              </label>
              <select
                aria-label="Trigger Esecuzione"
                value={formData.trigger}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, trigger: e.target.value as UserPlaybookSetup["trigger"] }))
                }
                className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-[#C5A059]/60 focus:outline-none"
              >
                <option value="TEST">TEST (Re-test Livello)</option>
                <option value="POC">POC (Point of Control)</option>
                <option value="JTC">JTC (Join The Current)</option>
                <option value="BTI">BTI (Break Through Imbalance)</option>
                <option value="WAIT">WAIT (Nessun Ingresso)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Rischio/Rendimento &amp; Punti
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="es. +3.8R"
                  value={formData.riskReward}
                  onChange={(e) => setFormData((p) => ({ ...p, riskReward: e.target.value }))}
                  className="w-1/2 h-9 rounded-md border border-white/10 bg-black/40 px-2.5 text-xs font-mono font-bold text-foreground focus:border-[#C5A059]/60 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="es. +45 pips"
                  value={formData.pnlPoints}
                  onChange={(e) => setFormData((p) => ({ ...p, pnlPoints: e.target.value }))}
                  className="w-1/2 h-9 rounded-md border border-white/10 bg-black/40 px-2.5 text-xs font-mono text-muted-foreground focus:border-[#C5A059]/60 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Finestra Operativa Italiana
              </label>
              <select
                aria-label="Finestra Operativa"
                value={formData.sessionWindow}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    sessionWindow: e.target.value as UserPlaybookSetup["sessionWindow"],
                  }))
                }
                className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs font-mono text-foreground focus:border-[#C5A059]/60 focus:outline-none"
              >
                <option value="london">London (08:00–11:30)</option>
                <option value="ny">New York (14:00–18:30)</option>
                <option value="asia">Asia (00:00–08:00)</option>
                <option value="lunch">Lunch (11:30–13:30)</option>
                <option value="swing_sera">Swing / Sera (18:30–22:00)</option>
                <option value="other">Altra Sessione</option>
              </select>
            </div>
          </div>

          {/* Screenshot Upload / Paste Box */}
          <div className="p-3.5 rounded-xl border border-dashed border-white/20 bg-black/30 text-center">
            {formData.imageUrl ? (
              <div className="relative inline-block max-w-full">
                <img
                  src={formData.imageUrl}
                  alt="Anteprima Screenshot Setup"
                  className="max-h-[220px] rounded-lg border border-[#C5A059]/40 object-contain mx-auto shadow-lg"
                />
                <button
                  type="button"
                  onClick={() => setFormData((p) => ({ ...p, imageUrl: null }))}
                  className="absolute -top-2 -right-2 p-1.5 rounded-full bg-rose-600 text-white hover:bg-rose-500 shadow-lg cursor-pointer"
                  title="Rimuovi immagine"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <div className="py-2">
                <UploadCloud size={26} className="mx-auto text-[#C5A059]/70 mb-1.5" />
                <p className="text-xs text-foreground font-medium">
                  Incolla lo screenshot del trade con <kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-[10px] font-mono">Cmd + V</kbd> oppure carica un file
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Mostra la schematica completa (HTF + LTF con livelli di entry, SL e TP)
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
                  className="mt-2 text-xs px-3 py-1 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-foreground transition-all cursor-pointer font-mono"
                >
                  Seleziona File dal Disco...
                </button>
              </div>
            )}
          </div>

          {/* 4 Sovereign Questions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-2.5 rounded-lg border border-white/10 bg-white/[0.02]">
              <label className="text-[11px] font-mono text-[#C5A059] font-bold block mb-1">
                01 · DOVE (HTF &amp; Assenza Compressione)
              </label>
              <textarea
                rows={2}
                placeholder="Dove ci troviamo nel ciclo grande? (es. Ciclo Daily rialzista, sweep estremo asiatico...)"
                value={formData.doveHTF}
                onChange={(e) => setFormData((p) => ({ ...p, doveHTF: e.target.value }))}
                className="w-full rounded-md border border-white/10 bg-black/40 p-2 text-xs text-foreground focus:border-[#C5A059]/50 focus:outline-none"
              />
            </div>

            <div className="p-2.5 rounded-lg border border-white/10 bg-white/[0.02]">
              <label className="text-[11px] font-mono text-[#C5A059] font-bold block mb-1">
                02 · SINISTRA (Cosa ha Preso?)
              </label>
              <textarea
                rows={2}
                placeholder="Mitigazione blocco d'ordine, FVG vergine, assorbimento o sola liquidità..."
                value={formData.sinistra}
                onChange={(e) => setFormData((p) => ({ ...p, sinistra: e.target.value }))}
                className="w-full rounded-md border border-white/10 bg-black/40 p-2 text-xs text-foreground focus:border-[#C5A059]/50 focus:outline-none"
              />
            </div>

            <div className="p-2.5 rounded-lg border border-white/10 bg-white/[0.02]">
              <label className="text-[11px] font-mono text-[#C5A059] font-bold block mb-1">
                03 · COME (Trigger LTF &amp; Schematica)
              </label>
              <textarea
                rows={2}
                placeholder="Rottura struttura CHoCH, test POC volumetrico, schematica Wyckoff..."
                value={formData.comeTrigger}
                onChange={(e) => setFormData((p) => ({ ...p, comeTrigger: e.target.value }))}
                className="w-full rounded-md border border-white/10 bg-black/40 p-2 text-xs text-foreground focus:border-[#C5A059]/50 focus:outline-none"
              />
            </div>

            <div className="p-2.5 rounded-lg border border-white/10 bg-white/[0.02]">
              <label className="text-[11px] font-mono text-[#C5A059] font-bold block mb-1">
                04 · TARGET (Pool Opposto)
              </label>
              <textarea
                rows={2}
                placeholder="Massimo/minimo opposto, pool di liquidità sell/buy side, sbilanciamento ≥10%..."
                value={formData.targetPool}
                onChange={(e) => setFormData((p) => ({ ...p, targetPool: e.target.value }))}
                className="w-full rounded-md border border-white/10 bg-black/40 p-2 text-xs text-foreground focus:border-[#C5A059]/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Post-Mortem & Learing (Specific to Win vs Loss) */}
          <div
            className={cn(
              "p-3 rounded-lg border",
              formData.outcome === "win"
                ? "border-emerald-500/30 bg-emerald-950/20"
                : formData.outcome === "loss"
                ? "border-rose-500/30 bg-rose-950/20"
                : "border-amber-500/30 bg-amber-950/20"
            )}
          >
            <label
              className={cn(
                "text-[11px] font-mono font-bold block mb-1 flex items-center gap-1.5",
                formData.outcome === "win"
                  ? "text-emerald-400"
                  : formData.outcome === "loss"
                  ? "text-rose-400"
                  : "text-amber-400"
              )}
            >
              {formData.outcome === "win" && <CheckCircle2 size={14} />}
              {formData.outcome === "loss" && <AlertTriangle size={14} />}
              {formData.outcome === "no_trade" && <ShieldAlert size={14} />}
              {formData.outcome === "win"
                ? "Cosa ha Validato il Trade (Fattore Chiave del Successo)"
                : formData.outcome === "loss"
                ? "Analisi dell'Errore / Post-Mortem (Perché è andato a Stop? Cosa Evitare?)"
                : "Motivo di Attesa / Capitale Preservato"}
            </label>
            <textarea
              rows={2}
              placeholder={
                formData.outcome === "loss"
                  ? "es. Entrato prima dello sweep M15, cercata inversione senza zona HTF, o trade aperto a pranzo..."
                  : "es. Attesa paziente dello sweep dell'Asian Low, reiezione pulita e sbilanciamento >10%..."
              }
              value={formData.whatWorkedOrFailed}
              onChange={(e) => setFormData((p) => ({ ...p, whatWorkedOrFailed: e.target.value }))}
              className="w-full rounded-md border border-white/10 bg-black/40 p-2 text-xs text-foreground focus:outline-none"
            />
          </div>

          {/* Golden Mind-Clearing Rule */}
          <div className="p-3 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10">
            <label className="text-[11px] font-mono text-[#C5A059] font-bold block mb-1 flex items-center gap-1.5">
              <Lightbulb size={14} className="text-[#C5A059]" />
              Regola per Schiarirsi la Mente nei Momenti di Confusione
            </label>
            <input
              type="text"
              placeholder="es. Sola liquidità senza zona HTF: inversioni vietate, solo BTI/JTC!"
              value={formData.lesson}
              onChange={(e) => setFormData((p) => ({ ...p, lesson: e.target.value }))}
              className="w-full h-9 rounded-md border border-[#C5A059]/30 bg-black/40 px-3 text-xs font-medium text-foreground focus:border-[#C5A059] focus:outline-none"
            />
          </div>

          {/* Save / Cancel footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setMode("list")}
              className="text-xs px-3.5 py-1.5 rounded-lg border border-white/15 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSaveSetup}
              className="text-xs font-mono px-4 py-1.5 rounded-lg bg-[#C5A059] text-black font-bold hover:bg-[#D4AF37] shadow-md transition-all cursor-pointer"
            >
              Salva Setup nel Playbook
            </button>
          </div>
        </div>
      )}

      {/* ── LIST & INSPECTOR MODE (DUAL SPLIT VIEW) ── */}
      {mode === "list" && (
        <div className="space-y-3">
          {/* Filter Bar: Outcome Pills + Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
            {/* Outcome Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0">
              {[
                { id: "ALL", label: `Tutti (${stats.total})` },
                { id: "win", label: `🟢 Vinti (${stats.wins})` },
                { id: "loss", label: `🔴 Persi (${stats.losses})` },
                { id: "no_trade", label: `🟡 No Trade (${stats.noTrades})` },
              ].map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveOutcomeFilter(filter.id as "ALL" | TradeOutcome)}
                  className={cn(
                    "text-xs font-mono px-2.5 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer",
                    activeOutcomeFilter === filter.id
                      ? "bg-[#C5A059] text-black font-bold shadow-sm"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-white/5"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative sm:w-56 shrink-0">
              <Search size={13} className="absolute left-2.5 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Cerca setup, lezione o errore..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-md border border-white/10 bg-black/40 text-xs text-foreground placeholder:text-muted-foreground/60 w-full focus:border-[#C5A059]/50 focus:outline-none"
              />
            </div>
          </div>

          {/* Dual Split Master Grid: Cards (38%) + Full Visual Dossier (62%) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
            {/* ── LEFT COLUMN: Setup Cards Library (38% on Desktop) ── */}
            <div className="lg:col-span-5 space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {filteredSetups.map((s) => {
                const isSelected = s.id === (activeSetup?.id ?? "");
                const badge = getOutcomeBadge(s.outcome, s.riskReward);

                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSetupId(s.id)}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer text-left relative overflow-hidden group/card",
                      isSelected
                        ? "border-[#C5A059]/70 bg-gradient-to-r from-[#C5A059]/15 via-white/[0.03] to-transparent shadow-[0_0_18px_rgba(197,160,89,0.18)]"
                        : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                    )}
                  >
                    {/* Top Row: Outcome Badge & Asset */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded border uppercase",
                            badge.bg,
                            badge.border
                          )}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                        {s.pnlPoints && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {s.pnlPoints}
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] font-mono text-foreground font-semibold px-1.5 py-0.2 rounded bg-white/5 border border-white/5">
                        {s.asset}
                      </span>
                    </div>

                    {/* Middle: Title & Thumbnail if present */}
                    <div className="flex items-start gap-2.5 my-1">
                      {s.imageUrl && (
                        <div className="w-14 h-11 rounded-md overflow-hidden border border-white/10 shrink-0 bg-black/40">
                          <img
                            src={s.imageUrl}
                            alt=""
                            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform"
                          />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-foreground leading-snug line-clamp-2">
                          {s.title}
                        </h4>
                      </div>
                    </div>

                    {/* Bottom Pill: Category + Trigger + Lesson preview */}
                    <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-white/[0.06] text-[10px] font-mono">
                      <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                        <span className="text-[#C5A059] font-bold">{s.trigger}</span>
                        <span>·</span>
                        <span className="truncate">{s.categoryLabel}</span>
                      </div>
                      {s.sessionWindow && (
                        <span className="uppercase text-[9px] text-white/50 shrink-0">
                          {s.sessionWindow}
                        </span>
                      )}
                    </div>

                    {/* Golden rule preview */}
                    {s.lesson && (
                      <p className="text-[10.5px] text-[#C5A059]/90 mt-1 line-clamp-1 italic">
                        💡 {s.lesson}
                      </p>
                    )}
                  </div>
                );
              })}

              {filteredSetups.length === 0 && (
                <div className="p-8 rounded-xl border border-dashed border-white/15 text-center text-xs text-muted-foreground bg-white/[0.01]">
                  <p>Nessun setup trovato con i filtri correnti.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveOutcomeFilter("ALL");
                      setActiveCategoryFilter("ALL");
                      setSearchTerm("");
                    }}
                    className="mt-2 text-[#C5A059] underline text-xs font-mono"
                  >
                    Resetta filtri
                  </button>
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN: Full Visual Tactical Dossier (62% on Desktop) ── */}
            <div className="lg:col-span-7">
              {activeSetup ? (
                <div className="p-4 rounded-xl border border-white/10 bg-[#0E0F14]/90 backdrop-blur-sm space-y-3.5 shadow-xl">
                  {/* Header Strip with Badges & Actions */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        {/* Outcome Pill */}
                        {(() => {
                          const badge = getOutcomeBadge(activeSetup.outcome, activeSetup.riskReward);
                          return (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-md border",
                                badge.bg,
                                badge.border
                              )}
                            >
                              {badge.icon}
                              <span>{badge.label}</span>
                            </span>
                          );
                        })()}

                        <span className="font-mono text-xs font-bold text-foreground">
                          {activeSetup.asset}
                        </span>

                        <span className="font-mono text-[11px] text-[#C5A059] bg-[#C5A059]/10 border border-[#C5A059]/25 px-2 py-0.5 rounded">
                          {activeSetup.trigger}
                        </span>

                        {activeSetup.pnlPoints && (
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {activeSetup.pnlPoints}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-foreground leading-tight">
                        {activeSetup.title}
                      </h3>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleApplyToOperativePlan(activeSetup)}
                        className="text-xs font-mono px-3 py-1.5 rounded-lg border border-[#C5A059]/60 bg-[#C5A059]/20 hover:bg-[#C5A059]/35 text-[#C5A059] transition-all flex items-center gap-1.5 font-bold shadow-sm cursor-pointer"
                        title="Inietta questo setup nel Piano Operativo del grafico"
                      >
                        <Target size={13} />
                        <span>🎯 Usa nel Piano</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicateSetup(activeSetup)}
                        className="p-1.5 rounded-lg border border-white/10 hover:border-white/30 hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        title="Duplica questo esempio"
                      >
                        {copiedSetupId === activeSetup.id ? (
                          <Check size={14} className="text-emerald-400" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEdit(activeSetup)}
                        className="p-1.5 rounded-lg border border-white/10 hover:border-[#C5A059]/40 hover:bg-[#C5A059]/10 text-muted-foreground hover:text-[#C5A059] transition-colors cursor-pointer"
                        title="Modifica questo esempio"
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSetup(activeSetup.id)}
                        className="p-1.5 rounded-lg border border-white/10 hover:border-rose-500/40 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 transition-colors cursor-pointer"
                        title="Elimina dal playbook"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* ── VISUAL CHART STAGE (Media-First, Zero Muro di Testo) ── */}
                  {activeSetup.imageUrl ? (
                    <div
                      onClick={() => setLightboxImage(activeSetup.imageUrl)}
                      className="group/img relative rounded-xl overflow-hidden border border-[#C5A059]/30 bg-black/60 shadow-lg cursor-zoom-in max-h-[260px] flex items-center justify-center transition-all hover:border-[#C5A059]/70"
                    >
                      <img
                        src={activeSetup.imageUrl}
                        alt={activeSetup.title}
                        className="w-full h-auto max-h-[260px] object-contain group-hover/img:scale-102 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-black/80 backdrop-blur-xs border border-white/20 text-xs font-mono font-medium text-white flex items-center gap-1.5 shadow-xl">
                          <Maximize2 size={13} />
                          Ingrandisci Grafico HD
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-dashed border-white/15 bg-white/[0.01] text-center flex items-center justify-center gap-3">
                      <ImageIcon className="w-5 h-5 text-muted-foreground/60" />
                      <span className="text-xs text-muted-foreground">
                        Nessuno screenshot allegato. Clicca su Modifica per incollare o caricare l'immagine del trade.
                      </span>
                    </div>
                  )}

                  {/* ── THE 4 SOVEREIGN QUESTIONS (Clean Horizontal / 2x2 Matrix) ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {/* 01 DOVE */}
                    <div className="p-2.5 rounded-lg bg-surface-2/60 border border-border-subtle/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#C5A059] font-bold uppercase">
                        <span>01 · DOVE (Ciclo HTF)</span>
                      </div>
                      <p className="text-text-hi leading-relaxed text-[11.5px]">
                        {activeSetup.doveHTF || "—"}
                      </p>
                    </div>

                    {/* 02 SINISTRA */}
                    <div className="p-2.5 rounded-lg bg-surface-2/60 border border-border-subtle/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#C5A059] font-bold uppercase">
                        <span>02 · SINISTRA (Presa di Liquidità)</span>
                      </div>
                      <p className="text-text-hi leading-relaxed text-[11.5px]">
                        {activeSetup.sinistra || "—"}
                      </p>
                    </div>

                    {/* 03 COME */}
                    <div className="p-2.5 rounded-lg bg-surface-2/60 border border-border-subtle/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#C5A059] font-bold uppercase">
                        <span>03 · COME (Trigger &amp; Schematica)</span>
                      </div>
                      <p className="text-text-hi leading-relaxed text-[11.5px]">
                        {activeSetup.comeTrigger || "—"}
                      </p>
                    </div>

                    {/* 04 TARGET */}
                    <div className="p-2.5 rounded-lg bg-surface-2/60 border border-border-subtle/80 space-y-1">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#C5A059] font-bold uppercase">
                        <span>04 · TARGET (Pool Opposto)</span>
                      </div>
                      <p className="text-text-hi leading-relaxed text-[11.5px]">
                        {activeSetup.targetPool || "—"}
                      </p>
                    </div>
                  </div>

                  {/* ── POST-MORTEM & LEZIONI (Specifico Vinto vs Perso) ── */}
                  {activeSetup.whatWorkedOrFailed && (
                    <div
                      className={cn(
                        "p-3 rounded-lg border flex items-start gap-2.5",
                        activeSetup.outcome === "win"
                          ? "border-emerald-500/30 bg-emerald-950/20"
                          : activeSetup.outcome === "loss"
                          ? "border-rose-500/30 bg-rose-950/20"
                          : "border-amber-500/30 bg-amber-950/20"
                      )}
                    >
                      <div className="mt-0.5 shrink-0">
                        {activeSetup.outcome === "win" && (
                          <CheckCircle2 size={16} className="text-emerald-400" />
                        )}
                        {activeSetup.outcome === "loss" && (
                          <AlertTriangle size={16} className="text-rose-400" />
                        )}
                        {activeSetup.outcome === "no_trade" && (
                          <ShieldAlert size={16} className="text-amber-400" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "font-mono text-[10.5px] uppercase font-bold block",
                            activeSetup.outcome === "win"
                              ? "text-emerald-400"
                              : activeSetup.outcome === "loss"
                              ? "text-rose-400"
                              : "text-amber-400"
                          )}
                        >
                          {activeSetup.outcome === "win"
                            ? "Validazione del Metodo (Cosa ha Confermato il Setup)"
                            : activeSetup.outcome === "loss"
                            ? "Post-Mortem Errore (Perché è Andato a Stop? Cosa Evitare)"
                            : "Preservazione del Capitale (Perché è Stato Corretto Attendere)"}
                        </span>
                        <p className="text-xs text-foreground mt-0.5 leading-relaxed font-medium">
                          {activeSetup.whatWorkedOrFailed}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ── GOLDEN LESSON (Regola per Schiarirsi la Mente) ── */}
                  {activeSetup.lesson && (
                    <div className="p-3 rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 flex items-start gap-2.5 shadow-sm">
                      <Lightbulb size={16} className="text-[#C5A059] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-mono text-[10px] uppercase font-bold text-[#C5A059] block tracking-wide">
                          Regola per Schiarirsi la Mente nei Momenti di Confusione
                        </span>
                        <p className="text-xs text-foreground font-semibold mt-0.5 leading-relaxed">
                          {activeSetup.lesson}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-12 rounded-xl border border-dashed border-white/10 text-center text-xs text-muted-foreground bg-white/[0.01]">
                  Seleziona un esempio dal catalogo o clicca su "+ Nuovo Esempio" per aggiungerne uno.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX MODAL FULL HD ── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in select-none"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-6xl max-h-[92vh] overflow-hidden rounded-2xl border border-white/15 bg-[#0E0F14] shadow-2xl flex flex-col items-center justify-center p-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between px-2 pb-2 text-xs font-mono text-muted-foreground border-b border-white/[0.08] mb-2">
              <span className="text-[#C5A059] font-bold">
                {activeSetup?.title ?? "Snapshot Analisi Grafico"}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-white/10 p-1.5 text-muted-foreground hover:text-white transition-colors"
                  title="Apri a dimensione intera"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="rounded-full bg-white/10 p-1.5 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                  title="Chiudi (Esc)"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* High-res Image */}
            <img
              src={lightboxImage}
              alt="Snapshot Trade Ingrandito"
              className="max-h-[82vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
