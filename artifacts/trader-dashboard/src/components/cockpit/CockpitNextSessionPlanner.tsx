import { useState, useEffect } from "react";
import {
  CalendarClock,
  Save,
  Trash2,
  CheckCircle2,
  Bell,
  BellRing,
  Volume2,
  Zap,
  ArrowRight,
  Target,
} from "lucide-react";
import { AGENDA_ITEMS_KEY, readAgendaItems, type ManualPlannerItem } from "@/lib/agendaStorage";
import { deliverBrowserNotification, browserNotificationsAvailable } from "@/lib/notifications";

export interface NextSessionPlan {
  id: string;
  session: "asia" | "london" | "newyork" | "week";
  horizon: "session" | "day" | "week";
  asset: string;
  timeframe: string;
  title: string;
  bias: "up" | "down" | "wait";
  levels: string;
  conditionalScenario: string;
  targetAndInvalidation: string;
  notes: string;
  createdAt: string;
  notifyAtSession?: boolean;
  notified?: boolean;
}

const STORAGE_KEY = "tl_cockpit_next_session_plans_v1";

const SESSIONS_CONFIG = {
  asia: { name: "Asia", time: "00:00–08:00", hint: "Mappa il range. Ingresso 01:00–03:30 solo con massime conferme." },
  london: { name: "Londra", time: "08:00–14:00", hint: "Sweep asiatico, zona HTF e schematica d'inversione ITF." },
  newyork: { name: "New York", time: "14:00–22:00", hint: "Rivalida livelli di Londra, notizie e volatilità pomeridiana." },
  week: { name: "Settimana", time: "Daily / H4", hint: "Contesto macro, scenari alternativi e invalidazioni cicliche." },
};

const QUICK_SCENARIO_PRESETS = [
  { label: "Sweep Asian Low → Reversal", desc: "Caccia alla liquidità sotto il minimo asiatico con trigger M15 per Long" },
  { label: "Sweep Asian High → Short", desc: "Caccia sopra il massimo asiatico con reiezione M15 per Short" },
  { label: "Retest POC & Continuazione", desc: "Attendo ritorno sul POC di Londra per cavalcare il trend primario" },
  { label: "Espansione NY su FVG", desc: "Ingresso sul Fair Value Gap vergine all'apertura pomeridiana" },
  { label: "No Trade · Notizie Macro", desc: "Restare flat per alta volatilità economica/NFP" },
];

function getNextPredictedSession(): "asia" | "london" | "newyork" | "week" {
  const hour = new Date().getHours();
  if (hour < 8) return "london";
  if (hour < 14) return "newyork";
  if (hour < 22) return "asia";
  return "asia";
}

interface CockpitNextSessionPlannerProps {
  currentMarket: string;
  currentTimeframe?: string;
  onPlanSaved?: () => void;
  onLoadIntoOperativePlan?: (market: string, setup: string, bias: string) => void;
}

export function CockpitNextSessionPlanner({
  currentMarket,
  currentTimeframe = "H1",
  onPlanSaved,
  onLoadIntoOperativePlan,
}: CockpitNextSessionPlannerProps) {
  const [plans, setPlans] = useState<NextSessionPlan[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState<"new" | "saved">("new");
  const [creationMode, setCreationMode] = useState<"quick" | "full">("quick");

  // Form State
  const [session, setSession] = useState<"asia" | "london" | "newyork" | "week">(getNextPredictedSession);
  const [horizon, setHorizon] = useState<"session" | "day" | "week">("session");
  const [asset, setAsset] = useState<string>(currentMarket);
  const [timeframe, setTimeframe] = useState<string>(currentTimeframe);
  const [title, setTitle] = useState<string>("");
  const [bias, setBias] = useState<"up" | "down" | "wait">("wait");
  const [levels, setLevels] = useState<string>("");
  const [conditionalScenario, setConditionalScenario] = useState<string>("");
  const [targetAndInvalidation, setTargetAndInvalidation] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [notifyAtSession, setNotifyAtSession] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => {
    return typeof Notification !== "undefined" ? Notification.permission : "default";
  });
  const [testNotificationSent, setTestNotificationSent] = useState(false);

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync with localStorage
  const savePlansToStorage = (updatedPlans: NextSessionPlan[]) => {
    setPlans(updatedPlans);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPlans));
      window.dispatchEvent(new Event("storage"));
    } catch {
      // Storage full or restricted
    }
  };

  // Request browser notification permission
  const handleEnableNotifications = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === "granted") {
        await deliverBrowserNotification({
          title: "AUREUS · Notifiche Sessione Attive",
          body: "Riceverai un promemoria operativo all'avvio della sessione con il tuo piano.",
        });
      }
    } catch {
      // Ignore
    }
  };

  const handleTestNotification = async () => {
    if (typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm !== "granted") return;
    }
    await deliverBrowserNotification({
      title: `AUREUS · Prossima Sessione [${SESSIONS_CONFIG[session].name}]`,
      body: `Piano attivo per ${asset}: ${title || "Verifica livelli chiave e piano condizionale prima di entrare."}`,
    });
    setTestNotificationSent(true);
    setTimeout(() => setTestNotificationSent(false), 3000);
  };

  // Monitor session plans for upcoming sessions
  useEffect(() => {
    if (typeof window === "undefined" || !browserNotificationsAvailable()) return;

    const checkInterval = setInterval(() => {
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      const sessionHours: Record<string, number> = {
        asia: 0,
        london: 8,
        newyork: 14,
      };

      let modified = false;
      const updated = plans.map((plan) => {
        if (!plan.notifyAtSession || plan.notified) return plan;
        const targetHour = sessionHours[plan.session];
        if (targetHour !== undefined && currentHour === targetHour && currentMinute <= 5) {
          deliverBrowserNotification({
            title: `AUREUS · Sessione ${SESSIONS_CONFIG[plan.session].name} Avviata!`,
            body: `${plan.asset}: ${plan.title}. Livelli: ${plan.levels || "Verifica il piano condizionale sul Varco."}`,
          });
          modified = true;
          return { ...plan, notified: true };
        }
        return plan;
      });

      if (modified) {
        savePlansToStorage(updated);
      }
    }, 60000);

    return () => clearInterval(checkInterval);
  }, [plans]);

  const handleSavePlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() && !conditionalScenario.trim() && !notes.trim()) return;

    const chosenTitle =
      title.trim() ||
      `Piano ${SESSIONS_CONFIG[session].name} · ${asset.toUpperCase()} (${bias === "up" ? "LONG" : bias === "down" ? "SHORT" : "WAIT"})`;

    const newPlan: NextSessionPlan = {
      id: crypto.randomUUID(),
      session,
      horizon,
      asset: asset.toUpperCase().trim() || currentMarket,
      timeframe,
      title: chosenTitle,
      bias,
      levels: levels.trim(),
      conditionalScenario: conditionalScenario.trim(),
      targetAndInvalidation: targetAndInvalidation.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      notifyAtSession,
      notified: false,
    };

    const updated = [newPlan, ...plans];
    savePlansToStorage(updated);

    // Also sync to agendaStorage so it shows in Calendar / Agenda
    try {
      const existingAgenda = readAgendaItems();
      const agendaItem: ManualPlannerItem = {
        id: newPlan.id,
        type: "trade-plan",
        title: `[${SESSIONS_CONFIG[session].name}] ${newPlan.title}`,
        notes: `${newPlan.conditionalScenario ? `SCENARIO: ${newPlan.conditionalScenario}\n` : ""}${newPlan.levels ? `LIVELLI: ${newPlan.levels}\n` : ""}${newPlan.notes ? `NOTE: ${newPlan.notes}` : ""}`,
        startAt: new Date().toISOString(),
        endAt: null,
        priority: "high",
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(AGENDA_ITEMS_KEY, JSON.stringify([agendaItem, ...existingAgenda]));
    } catch {
      // Ignore agenda sync errors
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    onPlanSaved?.();

    // Reset fields
    setTitle("");
    setLevels("");
    setConditionalScenario("");
    setTargetAndInvalidation("");
    setNotes("");
    setActiveTab("saved");
  };

  const handleDeletePlan = (id: string) => {
    const updated = plans.filter((p) => p.id !== id);
    savePlansToStorage(updated);
    onPlanSaved?.();
  };

  const handleSelectQuickScenario = (preset: (typeof QUICK_SCENARIO_PRESETS)[0]) => {
    setTitle(preset.label);
    setConditionalScenario(preset.desc);
    if (preset.label.includes("Short")) setBias("down");
    else if (preset.label.includes("Long") || preset.label.includes("Reversal")) setBias("up");
    else if (preset.label.includes("No Trade")) setBias("wait");
  };

  // 1-Click transfer to Operative Plan
  const handleApplyToOperativePlan = (p: NextSessionPlan) => {
    const operativeKey = `tl_cockpit_operative_plan_${p.asset}`;
    const operativePlan = {
      asset: p.asset,
      bias: p.bias === "up" ? "long" : p.bias === "down" ? "short" : "wait",
      session: p.session,
      setupName: p.title,
      entryPrice: "",
      stopLoss: "",
      invalidation: p.targetAndInvalidation || "",
      takeProfit1: "",
      takeProfit2: "",
      riskAmount: "5€",
      notes: `${p.conditionalScenario ? `SCENARIO: ${p.conditionalScenario}\n` : ""}${p.levels ? `LIVELLI: ${p.levels}\n` : ""}${p.notes ? `NOTE: ${p.notes}` : ""}`,
      imageUrl: null,
      checklist: [false, false, false, false, false],
      status: "draft",
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(operativeKey, JSON.stringify(operativePlan));
      window.dispatchEvent(new Event("storage"));
      onLoadIntoOperativePlan?.(p.asset, p.title, p.bias);
      alert(`Piano applicato con successo al Piano Operativo di ${p.asset}!`);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4 text-foreground">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-[#12131A] to-[#0A0A0E]">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
            Mission Planner · Appunti Operativi per la Prossima Sessione
          </span>
          <h3 className="text-sm font-semibold text-foreground mt-0.5">
            Pianificazione Rapida & Condizioni di Setup Future
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Prepara in anticipo i livelli e le condizioni (SE... ALLORA) con promemoria attivo.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
              activeTab === "new"
                ? "bg-primary text-black font-bold shadow"
                : "bg-white/5 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("new")}
          >
            ＋ Nuovo Piano
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1 cursor-pointer ${
              activeTab === "saved"
                ? "bg-primary text-black font-bold shadow"
                : "bg-white/5 text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab("saved")}
          >
            <span>Piani Salvati</span>
            {plans.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-black/20 text-black text-[10px] flex items-center justify-center font-bold">
                {plans.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>Piano per la prossima sessione salvato con successo e sincronizzato con l'Agenda!</span>
        </div>
      )}

      {activeTab === "new" ? (
        <form onSubmit={handleSavePlan} className="space-y-4">
          {/* Submode Switcher: Quick 10s vs Full */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCreationMode("quick")}
                className={`text-xs font-mono px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  creationMode === "quick"
                    ? "bg-primary/20 text-primary border border-primary/40 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Zap size={13} />
                <span>⚡ Appunto Rapido (10s)</span>
              </button>
              <button
                type="button"
                onClick={() => setCreationMode("full")}
                className={`text-xs font-mono px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  creationMode === "full"
                    ? "bg-primary/20 text-primary border border-primary/40 font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>📋 Scheda Completa</span>
              </button>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
              Sessione Proposta: <strong className="text-primary">{SESSIONS_CONFIG[session].name}</strong>
            </span>
          </div>

          {/* Session Selector Tiles */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground block font-mono">
              SESSIONE TARGET
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["asia", "london", "newyork", "week"] as const).map((sKey) => {
                const s = SESSIONS_CONFIG[sKey];
                const isSelected = session === sKey;
                return (
                  <button
                    key={sKey}
                    type="button"
                    onClick={() => setSession(sKey)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-primary/15 border-primary text-foreground shadow-[0_0_12px_rgba(212,175,55,0.15)]"
                        : "bg-[#12131A] border-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground"
                    }`}
                  >
                    <b className="block text-xs uppercase font-bold tracking-wider">{s.name}</b>
                    <span className="text-[10px] font-mono opacity-80 block">{s.time}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Scenario Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-muted-foreground/70 uppercase">
              ⚡ Scenari Frequenti (1-Click Fill):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SCENARIO_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => handleSelectQuickScenario(p)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-all cursor-pointer ${
                    title === p.label
                      ? "bg-primary/20 border-primary text-primary font-semibold"
                      : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Asset & Bias & TF Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Asset
              </label>
              <input
                type="text"
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                placeholder="XAUUSD"
                className="w-full h-9 rounded-md border border-white/10 bg-[#12131A] px-3 font-mono text-xs text-foreground focus:border-primary/50"
              />
            </div>

            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Timeframe
              </label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full h-9 rounded-md border border-white/10 bg-[#12131A] px-3 font-mono text-xs text-foreground focus:border-primary/50"
              >
                <option value="D1">D1 (Daily)</option>
                <option value="H4">H4</option>
                <option value="H1">H1</option>
                <option value="M15">M15</option>
                <option value="M5">M5</option>
                <option value="M1">M1</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Orizzonte
              </label>
              <select
                value={horizon}
                onChange={(e) => setHorizon(e.target.value as NextSessionPlan["horizon"])}
                className="w-full h-9 rounded-md border border-white/10 bg-[#12131A] px-3 font-mono text-xs text-foreground focus:border-primary/50"
              >
                <option value="session">Prossima sessione</option>
                <option value="day">Domani</option>
                <option value="week">Prossima settimana</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                Bias Atteso
              </label>
              <select
                value={bias}
                onChange={(e) => setBias(e.target.value as NextSessionPlan["bias"])}
                className="w-full h-9 rounded-md border border-white/10 bg-[#12131A] px-3 font-mono text-xs text-foreground focus:border-primary/50"
              >
                <option value="wait">Attesa / Neutrale (⏸)</option>
                <option value="up">Rialzista / Long (↗)</option>
                <option value="down">Ribassista / Short (↘)</option>
              </select>
            </div>
          </div>

          {/* QUICK MODE (Only 2 inputs) vs FULL MODE */}
          {creationMode === "quick" ? (
            <div className="space-y-3 p-3.5 rounded-xl border border-white/10 bg-white/[0.02]">
              <div>
                <label className="text-[11px] font-mono text-primary font-bold block mb-1">
                  Titolo Setup / Scenario
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Es. Sweep Asian Low → Re-test FVG M15 a Londra"
                  className="w-full h-9 rounded-md border border-white/10 bg-[#12131A] px-3 text-xs text-foreground focus:border-primary/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-mono text-primary font-bold block mb-1">
                  Condizione Operativa Sintetica (SE... ALLORA...) & Livelli
                </label>
                <textarea
                  rows={3}
                  value={conditionalScenario}
                  onChange={(e) => setConditionalScenario(e.target.value)}
                  placeholder="Es. SE spazza il minimo asiatico a 2650 e chiude candela M15 sopra il range → ALLORA entro long con stop a 2645 e target 2670..."
                  className="w-full rounded-md border border-white/10 bg-[#12131A] p-2.5 text-xs text-foreground focus:border-primary/50 leading-relaxed"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-muted-foreground block mb-1">
                  Nome dello Scenario / Setup Previsto
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Es. Sweep Asian Low → Re-test FVG H1 → Entry M15 a Londra"
                  className="w-full h-9 rounded-md border border-white/10 bg-[#12131A] px-3 text-xs text-foreground focus:border-primary/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-primary block font-semibold">
                    01 · Livelli Chiave & Sweep Atteso
                  </label>
                  <textarea
                    rows={3}
                    value={levels}
                    onChange={(e) => setLevels(e.target.value)}
                    placeholder="Quale liquidità o estremo deve spazzare prima del setup? (Es. Asian Low 2640, equal highs sopra 2660...)"
                    className="w-full rounded-md border border-white/10 bg-[#12131A] p-2.5 text-xs text-foreground focus:border-primary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-primary block font-semibold">
                    02 · Piano Condizionale (SE... ALLORA...)
                  </label>
                  <textarea
                    rows={3}
                    value={conditionalScenario}
                    onChange={(e) => setConditionalScenario(e.target.value)}
                    placeholder="SE il prezzo spazza l'estremo e forma schematica M15... ALLORA cerco ingresso su POC."
                    className="w-full rounded-md border border-white/10 bg-[#12131A] p-2.5 text-xs text-foreground focus:border-primary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-primary block font-semibold">
                    03 · Target di Liquidità & Invalidazione
                  </label>
                  <textarea
                    rows={3}
                    value={targetAndInvalidation}
                    onChange={(e) => setTargetAndInvalidation(e.target.value)}
                    placeholder="Target pool opposto (es. Asian High). Livello che invalida lo scenario: chiusura H1 sopra/sotto."
                    className="w-full rounded-md border border-white/10 bg-[#12131A] p-2.5 text-xs text-foreground focus:border-primary/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-primary block font-semibold">
                    04 · Appunti Liberi & Promemoria
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Note psicologiche, orari news da evitare..."
                    className="w-full rounded-md border border-white/10 bg-[#12131A] p-2.5 text-xs text-foreground focus:border-primary/50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notification Reminder Control */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                {notifyAtSession ? <BellRing size={16} /> : <Bell size={16} />}
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <span>Notifica Attiva Durante la Prossima Sessione</span>
                  {notificationPermission === "granted" ? (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Permesso OK
                    </span>
                  ) : (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      Permesso Richiesto
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Avvisa sullo schermo all'apertura della sessione ({SESSIONS_CONFIG[session].time}) con il promemoria.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              {notificationPermission !== "granted" && (
                <button
                  type="button"
                  onClick={handleEnableNotifications}
                  className="px-2.5 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-[11px] font-mono transition-colors cursor-pointer"
                >
                  Abilita Notifiche
                </button>
              )}

              <button
                type="button"
                onClick={handleTestNotification}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Invia subito una notifica di prova"
              >
                <Volume2 size={13} />
                <span>{testNotificationSent ? "Inviata!" : "Prova Notifica"}</span>
              </button>

              <button
                type="button"
                onClick={() => setNotifyAtSession(!notifyAtSession)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  notifyAtSession
                    ? "bg-primary text-black shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                    : "bg-white/10 text-muted-foreground hover:text-foreground"
                }`}
              >
                {notifyAtSession ? "ATTIVA" : "DISATTIVA"}
              </button>
            </div>
          </div>

          {/* Submit Save Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-muted-foreground font-mono">
              I piani vengono salvati nell'Agenda e conservati per la sessione successiva.
            </span>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-primary text-black font-mono font-bold hover:bg-primary/90 transition-all shadow-md cursor-pointer flex items-center gap-2 text-xs"
            >
              <Save size={15} />
              <span>Salva Piano per la Prossima Sessione</span>
            </button>
          </div>
        </form>
      ) : (
        /* Saved Plans List */
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {plans.length === 0 ? (
            <div className="p-8 text-center space-y-2 border border-white/10 rounded-xl bg-black/40">
              <CalendarClock size={32} className="mx-auto text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">Nessun piano salvato</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Non hai ancora registrato scenari o appunti per le prossime sessioni. Usa la scheda "Nuovo Piano" per preparare la prossima sessione.
              </p>
            </div>
          ) : (
            plans.map((p) => {
              const sessionConfig = SESSIONS_CONFIG[p.session] ?? SESSIONS_CONFIG.london;
              return (
                <div
                  key={p.id}
                  className="p-4 rounded-xl border border-white/10 bg-[#12131A] space-y-3 relative group"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30 font-bold uppercase">
                        {sessionConfig.name} ({sessionConfig.time})
                      </span>
                      <span className="text-foreground font-bold">{p.asset}</span>
                      <span className="text-muted-foreground">· {p.timeframe}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          p.bias === "up"
                            ? "text-emerald-400 bg-emerald-500/10"
                            : p.bias === "down"
                              ? "text-rose-400 bg-rose-500/10"
                              : "text-muted-foreground bg-white/5"
                        }`}
                      >
                        {p.bias === "up" ? "Rialzista ↗" : p.bias === "down" ? "Ribassista ↘" : "Neutro ⏸"}
                      </span>
                      {p.notifyAtSession && (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                          <BellRing size={10} />
                          <span>Notifica attiva</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApplyToOperativePlan(p)}
                        className="text-[11px] font-mono px-2.5 py-1 rounded border border-primary/40 bg-primary/15 hover:bg-primary/25 text-primary transition-colors flex items-center gap-1 cursor-pointer font-semibold"
                        title="Applica questo scenario al Piano Operativo del grafico"
                      >
                        <Target size={12} />
                        <span>Carica in Piano Operativo</span>
                        <ArrowRight size={10} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlan(p.id)}
                        className="text-muted-foreground hover:text-rose-400 p-1 transition-colors cursor-pointer"
                        title="Elimina piano"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-foreground">
                    {p.title}
                  </h4>

                  {p.conditionalScenario && (
                    <div className="p-2.5 rounded bg-black/40 border border-white/5 text-xs text-muted-foreground">
                      <strong className="text-primary font-mono text-[10px] uppercase block mb-0.5">
                        Piano Condizionale (SE... ALLORA):
                      </strong>
                      <p className="leading-relaxed">{p.conditionalScenario}</p>
                    </div>
                  )}

                  {p.levels && (
                    <div className="p-2.5 rounded bg-black/40 border border-white/5 text-xs text-muted-foreground">
                      <strong className="text-primary font-mono text-[10px] uppercase block mb-0.5">
                        Livelli Chiave & Sweep Atteso:
                      </strong>
                      <p className="leading-relaxed">{p.levels}</p>
                    </div>
                  )}

                  {p.targetAndInvalidation && (
                    <div className="p-2.5 rounded bg-black/40 border border-white/5 text-xs text-muted-foreground">
                      <strong className="text-primary font-mono text-[10px] uppercase block mb-0.5">
                        Target & Invalidazione:
                      </strong>
                      <p className="leading-relaxed">{p.targetAndInvalidation}</p>
                    </div>
                  )}

                  {p.notes && (
                    <div className="text-xs text-muted-foreground/80 italic font-mono pt-1">
                      Nota: {p.notes}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
