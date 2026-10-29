import { FilterPanel } from "@/components/FilterPanel";
import { useState, useMemo } from "react";
import { Link, useSearch } from "wouter";
import { useCockpitCopy } from "@/hooks/useCockpitCopy";
import { useTraderProcess } from "@/hooks/useTraderProcess";
import { ProcessLoading, useProcessCopy } from "@/components/process/ProcessUI";
import { useLanguage, useDateLocale } from "@/contexts/LanguageContext";
import { SigilIcon } from "@/components/ui/SigilIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeProcessResult } from "@/lib/processGuidance";
import type { IntelligenceContext } from "@/lib/marketIntelligenceApi";
import type { ProcessSession } from "@/lib/traderProcessApi";
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  Compass,
  TrendingUp,
  Target,
  ChevronDown,
  Search,
  BookOpen,
  ArrowRight,
  Sparkles,
  Calendar,
  Zap,
} from "lucide-react";
import "@/components/process/process.css";

/**
 * AUREUS PROTOCOL — Il Libro della Verità (Cronaca delle Sessioni)
 *
 * Restructured with the solemn, surgical aesthetic of AUREUS and maximum operational usability:
 * - Real-time metrics ribbon (sessions, adherence, scenario outcomes, cumulative R)
 * - Live active session spotlight (if today's market session is in progress)
 * - Interactive search & status filter dock (conforming, deviations, trade, wait)
 * - Expand / Collapse all controls
 * - Rich 4-pillar Codex Empty State with guided initiation
 * - Architectural session card layout: Contemplazione HTF, Custode della Soglia, Sigillo d'Azione & Consuntivo Spietato
 */
export function SessionJournal() {
  const ck = useCockpitCopy();
  const query = useTraderProcess();
  const copy = useProcessCopy();
  const { language } = useLanguage();
  const dateLocale = useDateLocale();
  const search = useSearch();
  const selected = new URLSearchParams(search).get("session");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "conforming" | "deviation" | "trade" | "wait">("all");
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean | null>(null);

  const state = query.data;

  // Aggregate and deduplicate sessions
  const allSessions: ProcessSession[] = useMemo(() => {
    if (!state) return [];
    const raw = [
      ...(state.sessions ?? []),
      ...(state.session ? [state.session] : []),
    ];
    const map = new Map<string, ProcessSession>();
    for (const s of raw) {
      if (s?.id) map.set(s.id, s);
    }
    return Array.from(map.values())
      .filter((session) => session.preparedAt && session.plan)
      .sort((a, b) => b.day.localeCompare(a.day));
  }, [state?.sessions, state?.session]);

  // Check if today has an ongoing active session (not closed yet)
  const activeTodaySession = useMemo(() => {
    if (!state?.session) return null;
    if (state.session.state === "closed") return null;
    return state.session;
  }, [state?.session]);

  // Statistics across all archived sessions
  const stats = useMemo(() => {
    const total = allSessions.length;
    const conforming = allSessions.filter((s) => s.closure?.assessment === "conforming").length;
    const deviations = allSessions.filter((s) => s.closure?.assessment === "deviation").length;
    const adherence = total > 0 ? Math.round((conforming / total) * 100) : 100;
    const confirmed = allSessions.filter((s) => s.closure?.outcome === "confirmed").length;
    const partial = allSessions.filter((s) => s.closure?.outcome === "partial").length;
    const invalidated = allSessions.filter((s) => s.closure?.outcome === "invalidated").length;
    const waits = allSessions.filter((s) => s.plan?.decision === "wait").length;
    const trades = allSessions.filter((s) => s.plan?.decision === "trade").length;

    let totalNetR = 0;
    let totalNetPnl = 0;
    for (const ev of state?.evidence ?? []) {
      if (ev.netR != null) totalNetR += ev.netR;
      if (ev.netPnl != null) totalNetPnl += ev.netPnl;
    }

    return {
      total,
      conforming,
      deviations,
      adherence,
      confirmed,
      partial,
      invalidated,
      waits,
      trades,
      totalNetR,
      totalNetPnl,
    };
  }, [allSessions, state?.evidence]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return allSessions.filter((session) => {
      const plan = session.plan;
      const closure = session.closure;
      const market = (plan?.market ?? session.rulesSnapshot?.markets?.join(" ") ?? "").toLowerCase();
      const waitReason = (plan?.waitReason ?? "").toLowerCase();
      const setup = (plan?.setup ?? "").toLowerCase();
      const notes = (closure?.notes ?? "").toLowerCase();
      const correction = (closure?.correction ?? "").toLowerCase();
      const day = (session.day ?? "").toLowerCase();

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          market.includes(q) ||
          waitReason.includes(q) ||
          setup.includes(q) ||
          notes.includes(q) ||
          correction.includes(q) ||
          day.includes(q);
        if (!matches) return false;
      }

      // Filter pills
      if (filterStatus === "conforming") {
        return closure?.assessment === "conforming";
      }
      if (filterStatus === "deviation") {
        return closure?.assessment === "deviation";
      }
      if (filterStatus === "trade") {
        return plan?.decision === "trade";
      }
      if (filterStatus === "wait") {
        return plan?.decision === "wait";
      }

      return true;
    });
  }, [allSessions, searchQuery, filterStatus]);

  if (!state) return <ProcessLoading error={query.error} retry={() => void query.refetch()} />;

  // Toggle all cards
  const toggleAll = (expand: boolean) => {
    setAllExpanded(expand);
    const updated: Record<string, boolean> = {};
    for (const s of allSessions) {
      updated[s.id] = expand;
    }
    setOpenMap(updated);
  };

  const handleCardToggle = (id: string, isOpen: boolean) => {
    setOpenMap((prev) => ({ ...prev, [id]: isOpen }));
  };

  return (
    <section className="process-workspace session-journal space-y-6" aria-label={copy("automaticJournal")}>
      {/* ── METRICHE CHIAVE DI DISCIPLINA ED ESITO ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Sessioni Archiviate */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-b from-[#12131A] to-[#0A0B0E] p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#D4AF37] flex items-center gap-1">
              <BookOpen size={13} />
              Sessioni Sigillate
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/80">Archivio</span>
          </div>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-foreground">
            {stats.total}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats.trades} a mercato · {stats.waits} attese
          </p>
        </div>

        {/* Metric 2: Indice di Integrità / Aderenza */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-b from-[#12131A] to-[#0A0B0E] p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <ShieldCheck size={13} />
              Indice di Integrità
            </span>
            <span className="font-mono text-[10px] text-emerald-500/80">Codice</span>
          </div>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-emerald-400">
            {stats.adherence}%
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats.conforming} conformi · {stats.deviations} scostamenti
          </p>
        </div>

        {/* Metric 3: Esiti Previsioni */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-b from-[#12131A] to-[#0A0B0E] p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#C5A059] flex items-center gap-1">
              <Target size={13} />
              Esito Previsionale
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/80">Scenario</span>
          </div>
          <p className="font-mono text-2xl sm:text-3xl font-bold text-[#C5A059]">
            {stats.confirmed} <span className="text-sm font-normal text-muted-foreground">ok</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats.partial} parziali · {stats.invalidated} invalidati
          </p>
        </div>

        {/* Metric 4: Resa Economica (R-Multiplo Evidenze) */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-b from-[#12131A] to-[#0A0B0E] p-3.5 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#3B82F6] flex items-center gap-1">
              <TrendingUp size={13} />
              R-Multiplo Netto
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/80">Evidenze</span>
          </div>
          <p className={`font-mono text-2xl sm:text-3xl font-bold ${stats.totalNetR > 0 ? "text-emerald-400" : stats.totalNetR < 0 ? "text-red-400" : "text-foreground"}`}>
            {stats.totalNetR > 0 ? `+${stats.totalNetR.toFixed(1)}` : stats.totalNetR.toFixed(1)} R
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats.totalNetPnl.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {state.activeMethod?.rules?.currency ?? "EUR"}
          </p>
        </div>
      </div>

      {/* ── SESSIONE ODIERNA IN CORSO (SPOTLIGHT ATTIVO) ── */}
      {activeTodaySession && (
        <div className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-gradient-to-r from-[#14151F] via-[#10111A] to-[#0A0B0E] p-4 sm:p-5 shadow-[0_0_25px_rgba(212,175,55,0.08)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37]">
                <SigilIcon variant="action-seal" size={20} />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                </span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#D4AF37]">
                    SESSIONE ODIERNA IN CORSO
                  </span>
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
                    {activeTodaySession.state === "operation"
                      ? "Sigillo d'Azione a Mercato"
                      : activeTodaySession.state === "plan"
                      ? "Pianificazione Scenario"
                      : "Contemplazione Pre-Market"}
                  </span>
                </div>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {activeTodaySession.day} · {activeTodaySession.plan?.market ?? activeTodaySession.rulesSnapshot?.markets?.join(", ") ?? "Mercato in analisi"}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {activeTodaySession.plan?.decision === "wait"
                    ? `Attesa programmata: ${activeTodaySession.plan.waitReason || "Attesa condizioni ottimali del metodo"}`
                    : activeTodaySession.plan?.setup
                    ? `Setup: ${activeTodaySession.plan.setup} · Entry: ${activeTodaySession.plan.entry || "—"}`
                    : "Sessione aperta nell'Ordine Giornaliero."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/"
                className="inline-flex h-8 items-center justify-center rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#C5A059] px-3.5 text-xs font-mono font-bold text-black shadow-md hover:brightness-110 transition-all"
              >
                Continua la Sessione <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── BARRA DI CONTROLLO: RICERCA, FILTRI & VISTA ── */}
      {allSessions.length > 0 && (
        <FilterPanel active={Boolean(searchQuery.trim()) || filterStatus !== "all"}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#0C0D12]/90 p-2.5 sm:p-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cerca per mercato, setup, note, o data..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs bg-secondary/30 border-white/10 placeholder:text-muted-foreground/60 focus:border-[#C5A059]/50"
              />
            </div>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Annulla
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="session-filter-pills flex flex-wrap items-center gap-1 rounded-lg border border-white/5 bg-[#12131A] p-1 text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setFilterStatus("all")}
                className={`rounded px-2.5 py-1 font-semibold transition-colors ${filterStatus === "all" ? "bg-[#C5A059]/20 text-[#D4AF37] border border-[#C5A059]/40" : "text-muted-foreground hover:text-foreground"}`}
              >
                Tutte ({allSessions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("conforming")}
                className={`rounded px-2.5 py-1 font-semibold transition-colors ${filterStatus === "conforming" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "text-muted-foreground hover:text-foreground"}`}
              >
                Conformi ({stats.conforming})
              </button>
              {stats.deviations > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterStatus("deviation")}
                  className={`rounded px-2.5 py-1 font-semibold transition-colors ${filterStatus === "deviation" ? "bg-red-500/20 text-red-400 border border-red-500/40" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Scostamenti ({stats.deviations})
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterStatus("trade")}
                className={`rounded px-2.5 py-1 font-semibold transition-colors ${filterStatus === "trade" ? "bg-blue-500/20 text-blue-400 border border-blue-500/40" : "text-muted-foreground hover:text-foreground"}`}
              >
                Trade ({stats.trades})
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus("wait")}
                className={`rounded px-2.5 py-1 font-semibold transition-colors ${filterStatus === "wait" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "text-muted-foreground hover:text-foreground"}`}
              >
                Attesa ({stats.waits})
              </button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleAll(allExpanded !== true)}
              className="h-8 px-2.5 font-mono text-[11px] text-[#C5A059] hover:bg-[#C5A059]/10 shrink-0"
            >
              {allExpanded ? "Comprimi Tutte" : "Espandi Tutte"}
            </Button>
          </div>
        </div>
        </FilterPanel>
      )}

      {/* ── EMPTY STATE LIMEN (NESSUNA SESSIONE ARCHIVIATA) ── */}
      {allSessions.length === 0 ? (
        <div className="relative overflow-hidden rounded-2xl border border-[#C5A059]/30 bg-gradient-to-b from-[#111219] via-[#0E0F15] to-[#08090C] p-6 sm:p-10 shadow-xl">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#D4AF37] shadow-[0_0_30px_rgba(212,175,55,0.2)]">
              <SigilIcon variant="book-of-truth" size={32} />
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-[#D4AF37]">
                IL LIBRO DELLA VERITÀ // IL PRIMO SIGILLO
              </span>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold uppercase tracking-tight text-foreground" style={{ fontFamily: "var(--font-display, serif)" }}>
                {copy("automaticJournal")}
              </h2>
              <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {copy("automaticJournalDescription")}
              </p>
            </div>

            {/* I 4 Pilastri della Cronaca Operativa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-left pt-2">
              <div className="rounded-xl border border-white/5 bg-[#12131A]/70 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-[#D4AF37] font-mono text-[10px] font-bold uppercase">
                  <Compass size={14} />
                  1. Scenario HTF
                </div>
                <h4 className="text-xs font-bold text-foreground">Contemplazione</h4>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Bias, liquidità opposta, aspettativa chiara e soglia di invalidazione prima dell&apos;apertura.
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-[#12131A]/70 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-[10px] font-bold uppercase">
                  <ShieldCheck size={14} />
                  2. Custode
                </div>
                <h4 className="text-xs font-bold text-foreground">Filtro Rischio</h4>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Checklist vincolante e parametri di rischio patrimoniale per impedire l&apos;ingresso impulsivo.
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-[#12131A]/70 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-blue-400 font-mono text-[10px] font-bold uppercase">
                  <Zap size={14} />
                  3. Sigillo
                </div>
                <h4 className="text-xs font-bold text-foreground">Azione o Attesa</h4>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Esecuzione tecnica o attesa disciplinata: evidenze economiche calcolate in R netto.
                </p>
              </div>

              <div className="rounded-xl border border-white/5 bg-[#12131A]/70 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-[#C5A059] font-mono text-[10px] font-bold uppercase">
                  <Sparkles size={14} />
                  4. Verità
                </div>
                <h4 className="text-xs font-bold text-foreground">Consuntivo</h4>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Rendicontazione spietata: confronto con il piano ed eredità della regola per il giorno dopo.
                </p>
              </div>
            </div>

            {/* Azioni di Avvio */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#C5A059] px-6 text-sm font-mono font-bold tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:brightness-110 transition-all"
              >
                <Compass className="w-5 h-5 mr-2" />
                {copy("prepareTrader")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
              <Link
                href="/backtest"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-card/60 px-5 text-xs font-mono font-semibold text-[#D4AF37] hover:bg-[#C5A059]/10 transition-colors"
              >
                <Shield className="w-4 h-4 mr-2" />
                La Forgia del Passato
              </Link>
            </div>
          </div>
        </div>
      ) : filteredSessions.length === 0 ? (
        /* Nessun risultato corrispondente ai filtri */
        <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center space-y-3">
          <Search className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
            Nessuna sessione trovata
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Nessuna sessione corrisponde ai filtri di ricerca applicati ({searchQuery ? `"${searchQuery}"` : filterStatus}).
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery("");
              setFilterStatus("all");
            }}
            className="text-xs font-mono border-white/10"
          >
            Ripristina Filtri
          </Button>
        </div>
      ) : (
        /* ── ELENCO DELLE SCHEDE SESSIONE STRUTTURATE (.session-journal-card) ── */
        <div className="space-y-4">
          {filteredSessions.map((session) => {
            const plan = session.plan!;
            const guidance = plan.guidance;
            const context = guidance?.contextSnapshotId
              ? (state.contextSnapshots?.[guidance.contextSnapshotId] as IntelligenceContext | undefined)
              : undefined;
            const evidence = (state.evidence ?? []).filter((item) => item.sessionId === session.id);
            const closure = session.closure;
            const response = guidance?.response;
            const method = state.methods.find((m) => m.id === session.methodVersionId);

            // Determine if open
            const isManuallyOpen = openMap[session.id];
            const isOpen = isManuallyOpen ?? (selected === session.id || allSessions.length === 1 || allExpanded === true);

            // Calculate card evidence net R & PnL
            let cardR = 0;
            let cardPnl = 0;
            let hasEconomicEvidence = false;
            for (const ev of evidence) {
              if (ev.netR != null) {
                cardR += ev.netR;
                hasEconomicEvidence = true;
              }
              if (ev.netPnl != null) {
                cardPnl += ev.netPnl;
                hasEconomicEvidence = true;
              }
            }

            const isWait = plan.decision === "wait";
            const isConforming = closure?.assessment === "conforming";
            const isDeviation = closure?.assessment === "deviation";

            return (
              <details
                key={session.id}
                open={isOpen}
                onToggle={(e) => handleCardToggle(session.id, e.currentTarget.open)}
                className={`session-journal-card group overflow-hidden rounded-2xl border transition-all ${
                  selected === session.id
                    ? "border-[#D4AF37] shadow-[0_0_20px_rgba(212,175,55,0.15)] bg-[#10111A]"
                    : "border-white/10 hover:border-[#C5A059]/40 bg-gradient-to-b from-[#111219] via-[#0E0F15] to-[#0A0B0E]"
                }`}
                data-session-id={session.id}
              >
                {/* ── CARD HEADER (ALWAYS VISIBLE) ── */}
                <summary className="list-none [&::-webkit-details-marker]:hidden flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 cursor-pointer select-none">
                  {/* Left: Date, Market & Method */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#C5A059]/30 bg-[#C5A059]/10 text-[#D4AF37]">
                      <SigilIcon variant={isWait ? "keeper" : "action-seal"} size={14} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm sm:text-base font-bold text-foreground">
                          {session.day}
                        </span>
                        <span className="rounded border border-[#C5A059]/30 bg-[#C5A059]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#D4AF37]">
                          {plan.market ?? session.rulesSnapshot?.markets?.join(", ") ?? "Mercato"}
                        </span>
                        {method && (
                          <span className="hidden sm:inline-flex rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {method.name} v{method.version}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {copy(closure ? "savedPostTrade" : "savedPreTrade")}
                      </span>
                    </div>
                  </div>

                  {/* Right: Badges & Chevron Toggle */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Decision Badge: Trade vs Wait */}
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${
                      isWait
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border-blue-500/30 bg-blue-500/10 text-blue-400"
                    }`}>
                      {isWait ? <Clock size={11} /> : <Target size={11} />}
                      {isWait ? "ATTESA STRATEGICA" : "TRADE A MERCATO"}
                    </span>

                    {/* Adherence Badge */}
                    {closure && (
                      <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold ${
                        isConforming
                          ? "border-emerald-500/30 bg-emerald-950/30 text-emerald-400"
                          : isDeviation
                          ? "border-red-500/30 bg-red-950/30 text-red-400"
                          : "border-white/10 bg-white/5 text-muted-foreground"
                      }`}>
                        {isConforming ? <ShieldCheck size={11} /> : isDeviation ? <AlertTriangle size={11} /> : null}
                        {copy(
                          closure.assessment === "conforming"
                            ? "planRespected"
                            : closure.assessment === "deviation"
                            ? "planDeviation"
                            : "planReview"
                        )}
                      </span>
                    )}

                    {/* Outcome Badge */}
                    {closure?.outcome && (
                      <span className={`hidden md:inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] ${
                        closure.outcome === "confirmed"
                          ? "border-emerald-500/25 text-emerald-400 bg-emerald-500/5"
                          : closure.outcome === "partial"
                          ? "border-amber-500/25 text-amber-400 bg-amber-500/5"
                          : closure.outcome === "invalidated"
                          ? "border-red-500/25 text-red-400 bg-red-500/5"
                          : "border-white/10 text-muted-foreground"
                      }`}>
                        {copy(
                          closure.outcome === "confirmed"
                            ? "outcomeConfirmed"
                            : closure.outcome === "partial"
                            ? "outcomePartial"
                            : closure.outcome === "invalidated"
                            ? "outcomeInvalidated"
                            : "outcomeUnknown"
                        )}
                      </span>
                    )}

                    {/* Net R / PnL Pill */}
                    {hasEconomicEvidence && (
                      <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${
                        cardR > 0
                          ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-400"
                          : cardR < 0
                          ? "border-red-500/30 bg-red-950/20 text-red-400"
                          : "border-white/10 text-muted-foreground"
                      }`}>
                        {cardR > 0 ? `+${cardR.toFixed(1)}` : cardR.toFixed(1)} R
                      </span>
                    )}

                    {/* Chevron Indicator */}
                    <div className="ml-1 text-muted-foreground group-open:rotate-180 transition-transform duration-200">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </summary>

                {/* ── EXPANDED CONTENT (.process-form) ── */}
                <div className="process-form border-t border-white/5 p-4 sm:p-6 space-y-6 bg-[#0B0C11]/80">
                  {/* Method & Mode Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Protocollo Applicato:
                      </span>
                      <strong className="text-foreground">{method?.name ?? "Metodo Operativo"}</strong>
                      <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[#C5A059]">
                        v{method?.version ?? session.rulesSnapshot?.windows ?? 1}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {copy(session.mode === "practice" ? "practiceHint" : "apply")}
                    </span>
                  </div>

                  {/* 4 LIMEN TACTICAL PILLARS */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* ── PILASTRO I: CONTEMPLAZIONE DELLO SCENARIO & PIANO ── */}
                    <div className="rounded-xl border border-white/5 bg-[#12131A]/70 p-4 space-y-3">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-[#D4AF37]">
                        <Compass size={15} />
                        <h4 className="font-mono text-xs font-bold uppercase tracking-wider">
                          I · Contemplazione & Scenario
                        </h4>
                      </div>

                      <div className="space-y-2.5 text-xs">
                        {/* Decision & Wait Reason / Setup Details */}
                        <div>
                          <span className="text-muted-foreground block text-[10px] font-mono uppercase">
                            {copy("plan")}:
                          </span>
                          <p className="font-medium text-foreground mt-0.5">
                            {plan.decision === "wait"
                              ? plan.waitReason
                              : `${plan.setup} · ${plan.entry}`}
                          </p>
                        </div>

                        {/* Trade Parameters if trade planned */}
                        {plan.decision === "trade" && (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                            <div>
                              <span className="text-muted-foreground block text-[10px] font-mono uppercase">
                                {copy("stop")}:
                              </span>
                              <span className="font-mono text-foreground font-semibold">
                                {plan.stop || "Definito a mercato"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px] font-mono uppercase">
                                {copy("initialRisk")}:
                              </span>
                              <span className="font-mono text-foreground font-semibold">
                                {plan.initialRisk} {session.rulesSnapshot.currency}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Guidance: Expectation & Invalidation */}
                        {guidance && (
                          <div className="space-y-2 pt-2 border-t border-white/5">
                            <div>
                              <span className="text-muted-foreground block text-[10px] font-mono uppercase">
                                {copy("expectation")}:
                              </span>
                              <p className="text-muted-foreground/90 mt-0.5 leading-relaxed">
                                {guidance.expectation}
                              </p>
                            </div>

                            <div>
                              <span className="text-muted-foreground block text-[10px] font-mono uppercase">
                                {copy("sessionInvalidation")}:
                              </span>
                              <p className="text-muted-foreground/90 mt-0.5 leading-relaxed">
                                {guidance.invalidation}
                              </p>
                            </div>

                            <div>
                              <span className="text-muted-foreground block text-[10px] font-mono uppercase">
                                {copy("invalidationResponse")}:
                              </span>
                              <p className="font-medium text-foreground mt-0.5">
                                {response === "custom"
                                  ? guidance.responseNote
                                  : copy(
                                      response === "exit"
                                        ? "responseExit"
                                        : response === "reassess"
                                        ? "responseReassess"
                                        : "responseWait"
                                    )}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Cockpit Analysis if recorded */}
                        {guidance?.cockpit && (
                          <div className="pt-2 border-t border-white/5">
                            <details className="text-xs">
                              <summary className="cursor-pointer text-[#C5A059] hover:underline font-mono text-[11px]">
                                {ck("cockpit.ui.490ee99e18")}
                                {guidance.cockpit.mode === "scalp" ? "Scalping" : "Swing"} (Dettagli Cockpit)
                              </summary>
                              <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-muted-foreground">
                                <div>
                                  <span className="text-muted-foreground/60 block">{ck("cockpit.ui.3740ed43e7")}:</span>
                                  <span className="font-mono text-foreground">{guidance.cockpit.cycle} · {guidance.cockpit.context}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground/60 block">{ck("cockpit.ui.09007a3559")}:</span>
                                  <span className="font-mono text-foreground">{guidance.cockpit.scenario || ck("Attesa")} · {guidance.cockpit.trigger || ck("Non presente")}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground/60 block">{ck("cockpit.ui.e82260fbbe")}:</span>
                                  <span className="font-mono text-foreground">{guidance.cockpit.target || ck("Non definito")}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground/60 block">{ck("cockpit.ui.8d42603460")}:</span>
                                  <span className="font-mono text-foreground">
                                    {guidance.cockpit.itfSchema ? ck("Sì") : ck("No")} / {guidance.cockpit.ltfSchema ? ck("Sì") : ck("No")}
                                  </span>
                                </div>
                              </div>
                            </details>
                          </div>
                        )}

                        {/* Pair Intelligence Context Snapshot */}
                        {context && (
                          <div className="pt-2 border-t border-white/5">
                            <details className="text-xs">
                              <summary className="cursor-pointer text-blue-400 hover:underline font-mono text-[11px]">
                                Contesto Quantitativo · Score {context.score ?? "—"}
                              </summary>
                              <div className="pt-2 space-y-1.5 text-[11px]">
                                <p className="text-muted-foreground">
                                  Pair: <strong className="text-foreground">{context.pair}</strong> · Generato: {context.generatedAt.slice(0, 16).replace("T", " ")}
                                </p>
                                {context.news.length > 0 && (
                                  <ul className="list-disc list-inside space-y-1 text-muted-foreground/80">
                                    {context.news.slice(0, 3).map((item) => (
                                      <li key={item.url} className="truncate">
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                          {item.title}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── PILASTRO II: IL CUSTODE DELLA SOGLIA (CHECKLIST) ── */}
                    <div className="rounded-xl border border-white/5 bg-[#12131A]/70 p-4 space-y-3">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-emerald-400">
                        <ShieldCheck size={15} />
                        <h4 className="font-mono text-xs font-bold uppercase tracking-wider">
                          II · Il Custode della Soglia
                        </h4>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <span className="text-muted-foreground block text-[10px] font-mono uppercase mb-1.5">
                            Checklist Verificata Pre-Market:
                          </span>
                          <ul className="space-y-1.5">
                            {session.rulesSnapshot.checklist.map((criterion, index) => {
                              const checked = session.checklist[index];
                              return (
                                <li key={index} className="flex items-start gap-2 text-xs">
                                  {checked ? (
                                    <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                                  ) : (
                                    <Circle size={14} className="text-muted-foreground/40 shrink-0 mt-0.5" />
                                  )}
                                  <span className={checked ? "text-foreground font-medium" : "text-muted-foreground"}>
                                    {criterion}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>

                        {session.mood && (
                          <div className="pt-2 border-t border-white/5 text-xs">
                            <span className="text-muted-foreground block text-[10px] font-mono uppercase">
                              Stato Emotivo & Focus:
                            </span>
                            <p className="text-foreground mt-0.5">{session.mood} {session.focus ? `· ${session.focus}` : ""}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── PILASTRO III: IL SIGILLO D'AZIONE (EVIDENZE TRADES) ── */}
                    <div className="rounded-xl border border-white/5 bg-[#12131A]/70 p-4 space-y-3">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-blue-400">
                        <Zap size={15} />
                        <h4 className="font-mono text-xs font-bold uppercase tracking-wider">
                          III · Il Sigillo d&apos;Azione (Evidenze)
                        </h4>
                      </div>

                      <div className="space-y-2 text-xs">
                        {closure?.noTrades ? (
                          <div className="rounded-lg border border-white/5 bg-secondary/20 p-3 text-center">
                            <Clock className="w-5 h-5 mx-auto text-amber-400/80 mb-1" />
                            <p className="font-medium text-foreground">
                              {copy("noTrades")}
                            </p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              L&apos;attesa è stata rispettata senza forzare operazioni fuori dalle regole.
                            </p>
                          </div>
                        ) : evidence.length > 0 ? (
                          <div className="space-y-2">
                            {evidence.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-center justify-between rounded-lg border border-white/5 bg-secondary/30 p-2.5 font-mono text-xs"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-foreground">
                                      {item.account ?? "Conto non indicato"}
                                    </span>
                                    <span className="rounded bg-white/5 px-1.5 py-0.2 text-[10px] text-muted-foreground">
                                      {copy(item.provenance)}
                                    </span>
                                  </div>
                                  {item.note && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5 font-sans">
                                      {item.note}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <span className={`font-bold block ${item.netPnl != null && item.netPnl > 0 ? "text-emerald-400" : item.netPnl != null && item.netPnl < 0 ? "text-red-400" : "text-foreground"}`}>
                                    {item.netPnl != null ? `${item.netPnl > 0 ? "+" : ""}${item.netPnl.toFixed(2)} ${item.currency ?? ""}` : "—"}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {completeProcessResult(item)
                                      ? `${item.netR?.toFixed(2) ?? "—"} R`
                                      : copy("incompleteResult")}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-xs italic">
                            Nessun trade registrato per questa sessione.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* ── PILASTRO IV: CONSUNTIVO SPIETATO (POST-MARKET) ── */}
                    <div className="rounded-xl border border-white/5 bg-[#12131A]/70 p-4 space-y-3">
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-[#C5A059]">
                        <Sparkles size={15} />
                        <h4 className="font-mono text-xs font-bold uppercase tracking-wider">
                          IV · Consuntivo Spietato
                        </h4>
                      </div>

                      <div className="space-y-3 text-xs">
                        {closure ? (
                          <>
                            {closure.notes && (
                              <div>
                                <span className="text-muted-foreground block text-[10px] font-mono uppercase mb-0.5">
                                  Note dell&apos;Operatore:
                                </span>
                                <p className="whitespace-pre-wrap text-foreground/90 bg-secondary/20 p-2.5 rounded-lg border border-white/5 leading-relaxed">
                                  {closure.notes}
                                </p>
                              </div>
                            )}

                            {closure.violations.length > 0 && (
                              <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-2.5 text-xs space-y-1">
                                <span className="text-red-400 font-mono text-[10px] font-bold uppercase flex items-center gap-1">
                                  <AlertTriangle size={12} />
                                  Violazioni Registrate:
                                </span>
                                <ul className="list-disc list-inside text-red-300">
                                  {closure.violations.map((violation, index) => (
                                    <li key={index}>{violation}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Correzione Ereditata per la Prossima Seduta */}
                            {closure.correction && (
                              <div className="rounded-lg border border-[#C5A059]/40 bg-[#C5A059]/10 p-3 space-y-1">
                                <span className="text-[#D4AF37] font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                  <Sparkles size={12} />
                                  {copy("correctionCarry")}
                                </span>
                                <p className="text-sm font-semibold text-foreground">
                                  {closure.correction}
                                </p>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="rounded-lg border border-white/5 bg-secondary/20 p-3 text-muted-foreground text-center">
                            Consuntivo non ancora completato per questa sessione.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── CARD FOOTER ACTIONS ── */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/5 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground font-mono text-[11px]">
                      <Calendar size={12} />
                      <span>Sigillato il {session.day}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Link
                        href={
                          session.state === "closed"
                            ? `/journal?t=trades&processSessionId=${session.id}`
                            : "/"
                        }
                        className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#D4AF37] hover:underline"
                      >
                        {copy(session.state === "closed" ? "journal" : "today")}
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
