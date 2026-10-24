import { useCockpitCopy } from "@/hooks/useCockpitCopy";
import { useCallback, useEffect, useState, useRef, type ReactNode, type MouseEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import {
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Crosshair,
  Focus,
  Loader2,
  Maximize2,
  Minimize2,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Star,
  Zap,
  ZoomIn,
  Gamepad2,
  Play,
} from "lucide-react";
import { CockpitGuidanceBox, getStepGuidance } from "@/components/cockpit/CockpitGuidanceBox";
import { CockpitNewsDialog } from "@/components/cockpit/CockpitNewsDialog";
import { CockpitExamplesDialog } from "@/components/cockpit/CockpitExamplesDialog";
import { CockpitVisualChoice } from "@/components/cockpit/CockpitVisualChoice";
import { CockpitSchematicLightbox } from "@/components/cockpit/CockpitSchematicLightbox";
import { COCKPIT_SCHEMATICS, type CockpitSchematic } from "@/lib/cockpitSchematics";
import { CockpitNextSessionPlanner } from "@/components/cockpit/CockpitNextSessionPlanner";
import { CockpitFavoriteTools } from "@/components/cockpit/CockpitFavoriteTools";
import { CockpitOperativePlanDialog } from "@/components/cockpit/CockpitOperativePlanDialog";
import { CockpitUserPlaybookDialog } from "@/components/cockpit/CockpitUserPlaybookDialog";
import { CockpitTradeRegisterModal, type TimeframeSnapshot } from "@/components/cockpit/CockpitTradeRegisterModal";
import { DecompressionChamberModal } from "@/components/decompression/DecompressionChamberModal";
import { JournalEntryModal } from "@/components/JournalEntryModal";
import { useToast } from "@/hooks/use-toast";
import { LimenProprietaryChart } from "@/components/chart/LimenProprietaryChart";
import { CockpitAiSentinelCard } from "@/components/cockpit/CockpitAiSentinelCard";
import { useVarcoVisionSentinel } from "@/hooks/useVarcoVisionSentinel";
import type { VarcoSetupPlan } from "@workspace/api-client-react";
import {
  loadOperativeMemory,
  saveOperativeMemory,
  resetOperativeMemory,
  recordOperativeTradeOutcome,
  recordStep4CareEvent,
  type LimenOperativeMemoryState,
} from "@/lib/replay/limenOperativeMemory";
import {
  CockpitChartPrefsDialog,
  loadChartPreferences,
  buildTradingViewChartUrl,
  type ChartPreferences,
} from "@/components/cockpit/CockpitChartPrefsDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getGetJournalEntriesQueryKey, getGetJournalEdgeQueryKey } from "@workspace/api-client-react";
import { useTraderProcess, useProcessMutation } from "@/hooks/useTraderProcess";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import {
  createProcessMethod,
  traderProcessKey,
  type CheckInDraft,
  type ProcessMethod,
  type ProcessSession,
  type ProcessState,
  type SessionPlan,
} from "@/lib/traderProcessApi";
import {
  freshCockpit,
  changeCockpit,
  cockpitContextReady,
  cockpitDay,
  cockpitRequirements,
  cockpitScenarios,
  cockpitTriggers,
  cockpitWindow,
  type CockpitAnalysis,
} from "../../../../contracts/cockpit";
import { fetchMarketContext } from "@/lib/marketIntelligenceApi";
import { SessionDraftStatus } from "@/components/process/SessionDraftStatus";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { dailyProcessRisk } from "@/lib/processGuidance";
import { cockpitImprovement } from "@/lib/cockpitPresentation";
import { PREPARATION_TOOLS } from "@/lib/workspaceTools";
import { processToolHref } from "@/lib/processToolNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import { FinancialArchitectureBanner } from "@/components/financial/FinancialArchitectureBanner";
import { useFinancialProfile, getReferenceTradingCapital } from "@/lib/financialProfileApi";
import { useFreeTrial } from "@/lib/useFreeTrial";
import { ContextMarketDetail, PriceHistory } from "@/components/ContextMarketDetail";
import { updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import "./TradingCockpit.css";

const MARKETS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "SPX500", "BTCUSD", "ETHUSD"];
const MAIN_PAIRS = ["XAUUSD", "BTCUSD", "EURUSD"] as const;
const CYCLES = [
  ["up", "cockpit.ui.cycle.up"],
  ["down", "cockpit.ui.cycle.down"],
  ["end_up", "cockpit.ui.cycle.end_up"],
  ["end_down", "cockpit.ui.cycle.end_down"],
] as const;
const SCENARIOS = [
  [
    "valid_zone",
    "cockpit.text.b8f507036d",
    "cockpit.ui.scenario.valid_zone_desc",
  ],
  ["no_zone", "cockpit.text.658ab91c09", "cockpit.ui.scenario.no_zone_desc"],
  [
    "reaccum",
    "cockpit.text.1a9c035cf4",
    "cockpit.ui.scenario.reaccum_desc",
  ],
] as const;
const CHART_SYMBOLS: Record<string, string> = {
  XAUUSD: "OANDA:XAUUSD",
  EURUSD: "OANDA:EURUSD",
  GBPUSD: "OANDA:GBPUSD",
  USDJPY: "OANDA:USDJPY",
  NAS100: "OANDA:NAS100USD",
  SPX500: "OANDA:SPX500USD",
  BTCUSD: "BITSTAMP:BTCUSD",
  ETHUSD: "BITSTAMP:ETHUSD",
};
const PROTOCOL_CHECKS = [
  "Contesto HTF e liquidità valutati",
  "Schematica, trigger e attesa verificati",
  "Calendario e limiti personali di rischio verificati",
];

function formatCompactNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <p className="ck-error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}

function Tick({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const ck = useCockpitCopy();
  return (
    <label className="ck-tick">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span>{ck(label)}</span>
    </label>
  );
}

function Protection({
  state,
  market,
  onDone,
}: {
  state: ProcessState;
  market: string;
  onDone: () => void;
}) {
  const ck = useCockpitCopy();
  const method = state.activeMethod;
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useProcessMutation(createProcessMethod);
  const [requestId] = useState(() => crypto.randomUUID());
  return (
    <form
      className="ck-form"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        mutation.mutate(
          {
            name: "Cockpit · struttura ciclica e liquidità",
            requestId,
            previousVersionId: method?.id,
            riskConfirmed: true,
            rules: {
              markets: Array.from(new Set([market, ...MARKETS, ...(method?.rules.markets ?? [])])),
              windows:
                "Europe/Rome · Asia 01:00–03:30; Londra 08:00–11:30; Lunch solo con impulso avviato; NY scalp 14:00–18:00; swing fino alle 22:00.",
              setup:
                "Cockpit · ciclo HTF, sweep o re-accumuli, zona a sinistra, schematica ITF/LTF e pool opposto.",
              entry:
                "Zona HTF valida: TEST/POC/JTC/BTI; sola liquidità: JTC/BTI; re-accumuli: JTC. Due schematiche confermate prima del trigger.",
              exit: "Pool di liquidità opposto definito prima dell’ingresso; gestione secondo invalidazione e rischio personale.",
              invalidation:
                "Schematica violata o congestione: attendo, rivaluto il contesto o chiudo secondo le regole.",
              waitConditions:
                "Compressione, calendario non verificato o pre-news, finestra chiusa, conferme o protezione mancanti.",
              riskPerTrade: Number(f.get("risk")),
              maxDailyLoss: Number(f.get("loss")),
              maxDailyTrades: Number(f.get("trades")),
              currency: String(f.get("currency")),
              checklist: method?.rules.checklist.length ? method.rules.checklist : PROTOCOL_CHECKS,
              tools: ["markets", "news", "economic-calendar", "sessions", "calculator"],
            },
          },
          { onSuccess: onDone },
        );
      }}
    >
      <p>{ck("cockpit.ui.bde1f6f05a")}</p>
      <label>
        {ck("cockpit.ui.04fe77cf1d")}
        <select
          aria-label={ck("cockpit.ui.04fe77cf1d")}
          name="currency"
          required
          defaultValue={method?.rules.currency ?? ""}
        >
          <option value="" disabled>
            {ck("cockpit.ui.f88cbd8c9c")}
          </option>
          {["EUR", "USD", "GBP", "CHF"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label>
        {ck("cockpit.ui.f8c0c86f3b")}
        <input
          name="risk"
          type="number"
          min="0.01"
          step="any"
          max="1000000000000"
          required
          defaultValue={method?.rules.riskPerTrade}
        />
      </label>
      <label>
        {ck("cockpit.ui.6e97e4339e")}
        <input
          name="loss"
          type="number"
          min="0.01"
          step="any"
          max="1000000000000"
          required
          defaultValue={method?.rules.maxDailyLoss}
        />
      </label>
      <label>
        {ck("cockpit.ui.26b5ff4b65")}
        <input
          name="trades"
          type="number"
          min="1"
          max="10000"
          step="1"
          required
          defaultValue={method?.rules.maxDailyTrades}
        />
      </label>
      <Tick label={ck("cockpit.ui.a095ce37a1")} checked={confirmed} onChange={setConfirmed} />
      <ErrorMessage error={mutation.error} />
      <button className="ck-primary" disabled={!confirmed || mutation.isPending}>
        {ck("cockpit.ui.d9157c3894")}
      </button>
    </form>
  );
}

export function CockpitReviewLegacyForm({ state }: { state: ProcessState }) {
  const ck = useCockpitCopy();
  const session = state.session!;
  const rows = state.evidence.filter((e) => e.sessionId === session.id);
  const draft = useSessionDraft(session, {
    stage: "closure" as const,
    open: false as boolean,
    assessment: "" as "" | "conforming" | "deviation" | "unknown",
    outcome: "" as "" | "confirmed" | "partial" | "invalidated" | "unassessable",
    notes: "",
    violations: "",
    correction: "",
    reconciled: false as boolean,
    noTrades: rows.length === 0,
  });
  const v = draft.value;
  const save = useProcessMutation(() =>
    draft.confirm((value, expectedRevision) => ({
      action: "close",
      expectedRevision,
      closure: {
        notes: value.notes,
        assessment: value.assessment || "unknown",
        outcome: value.outcome || "unassessable",
        violations: value.violations
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        correction: value.correction,
        reconciled: true,
        noTrades: rows.length === 0,
      },
    })),
  );
  if (!v.open)
    return (
      <button className="ck-primary" onClick={() => draft.setValue((p) => ({ ...p, open: true }))}>
        {ck("cockpit.ui.0c58fdb76f")}
        <ArrowUpRight size={15} />
      </button>
    );
  return (
    <form
      className="ck-form"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(undefined);
      }}
    >
      <p>
        {rows.length
          ? `${rows.length} evidenze collegate. Verifica esiti e costi nel Diario prima di confermare.`
          : "Nessuna operazione collegata. Una giornata senza trade è un esito valido."}
      </p>
      <label>
        {ck("cockpit.ui.e666a40ef7")}
        <select
          aria-label={ck("cockpit.ui.e666a40ef7")}
          required
          value={v.assessment}
          onChange={(e) =>
            draft.setValue((v) => ({
              ...v,
              assessment: e.target.value as typeof v.assessment,
            }))
          }
        >
          <option value="" disabled>
            {ck("cockpit.ui.e25b1be753")}
          </option>
          <option value="conforming">{ck("cockpit.ui.e8a6094595")}</option>
          <option value="deviation">{ck("cockpit.ui.fefd6d24a9")}</option>
          <option value="unknown">{ck("cockpit.ui.0abfbe2cf6")}</option>
        </select>
      </label>
      <label>
        {ck("cockpit.ui.8f40776b6b")}
        <select
          aria-label={ck("cockpit.ui.8f40776b6b")}
          required
          value={v.outcome}
          onChange={(e) =>
            draft.setValue((v) => ({
              ...v,
              outcome: e.target.value as typeof v.outcome,
            }))
          }
        >
          <option value="" disabled>
            {ck("cockpit.ui.4772d5c31f")}
          </option>
          <option value="confirmed">{ck("cockpit.ui.e82937e0fa")}</option>
          <option value="partial">{ck("cockpit.ui.c2317dc834")}</option>
          <option value="invalidated">{ck("cockpit.ui.deed127d49")}</option>
          <option value="unassessable">{ck("cockpit.ui.7997576a08")}</option>
        </select>
      </label>
      <label>
        {ck("cockpit.ui.412a884be1")}
        <textarea
          rows={3}
          maxLength={4000}
          value={v.notes}
          onChange={(e) => draft.setValue((v) => ({ ...v, notes: e.target.value }))}
        />
      </label>
      <label>
        {ck("cockpit.ui.78652df6e5")}
        <textarea
          rows={2}
          maxLength={4000}
          value={v.violations}
          onChange={(e) => draft.setValue((v) => ({ ...v, violations: e.target.value }))}
        />
      </label>
      <label>
        {ck("cockpit.ui.63be50caee")}
        <textarea
          rows={2}
          maxLength={4000}
          value={v.correction}
          onChange={(e) => draft.setValue((v) => ({ ...v, correction: e.target.value }))}
        />
      </label>
      <Tick
        label={ck("cockpit.ui.64ad0d41f3")}
        checked={v.reconciled}
        onChange={(reconciled) => draft.setValue((v) => ({ ...v, reconciled }))}
      />
      <ErrorMessage error={save.error} />
      <button
        className="ck-primary"
        disabled={!v.reconciled || save.isPending || draft.status === "conflict"}
      >
        {ck("cockpit.ui.6769b87aa2")}
      </button>
      <SessionDraftStatus {...draft} retry={draft.flush} />
    </form>
  );
}

function getSavedCockpitOperativity(market: string): CockpitAnalysis | null {
  try {
    const raw = localStorage.getItem(`tl_cockpit_operativity_${market}_${cockpitDay()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.analysis && parsed.analysis.day === cockpitDay()) {
        return parsed.analysis;
      }
    }
  } catch {
    // Ignore localStorage read errors in SSR/sandboxed storage
  }
  return null;
}

function persistCockpitOperativity(analysis: CockpitAnalysis) {
  try {
    localStorage.setItem(
      `tl_cockpit_operativity_${analysis.market}_${cockpitDay()}`,
      JSON.stringify({ analysis, updatedAt: Date.now() })
    );
  } catch {
    // Ignore localStorage quota or private mode write errors
  }
}

function getSavedCockpitInputs(market: string): { entry?: string; stop?: string; risk?: string } | null {
  try {
    const raw = localStorage.getItem(`tl_cockpit_inputs_${market}_${cockpitDay()}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore localStorage parse errors
  }
  return null;
}

function persistCockpitInputs(market: string, inputs: { entry?: string; stop?: string; risk?: string }) {
  try {
    localStorage.setItem(`tl_cockpit_inputs_${market}_${cockpitDay()}`, JSON.stringify(inputs));
  } catch {
    // Ignore localStorage write errors
  }
}

function initialDraft(method: ProcessMethod, pairHint?: string): CheckInDraft {
  const market = pairHint && MARKETS.includes(pairHint) ? pairHint : (method.rules.markets[0] ?? "XAUUSD");
  const saved = getSavedCockpitOperativity(market);
  const savedInputs = getSavedCockpitInputs(market);
  return {
    stage: "check_in",
    checklist: method.rules.checklist.map(() => false),
    mood: "",
    focus: "",
    decision: "",
    market,
    entry: savedInputs?.entry ?? "",
    stop: savedInputs?.stop ?? "",
    risk: savedInputs?.risk ?? "",
    reason: "",
    reasonCode: "",
    expectation: "",
    invalidation: "",
    response: "",
    cockpit: saved ?? freshCockpit(market),
  };
}

function isMarketTradeActive(market: string, session: ProcessSession | null | undefined): boolean {
  try {
    const flag = localStorage.getItem(`tl_cockpit_trade_active_${market}`);
    if (flag === "1") return true;
    if (flag === "0") return false;
    if (session?.id) {
      const archived = localStorage.getItem(`tl_cockpit_trade_archived_${session.id}_${market}`);
      if (archived === "1") return false;
    }
    const planRaw = localStorage.getItem(`tl_cockpit_operative_plan_${market}`);
    if (planRaw) {
      const p = JSON.parse(planRaw);
      if (p.status === "confirmed" && p.active !== false) return true;
    }
    if (session?.preparedAt && session.state === "operation" && session.plan?.market === market) {
      return true;
    }
  } catch {
    // fallback
  }
  return false;
}

function PersistedCockpit({ state, seed }: { state: ProcessState; seed: CockpitAnalysis }) {
  return <DraftCockpit state={state} seed={seed} />;
}

function DraftCockpit({ state, seed }: { state: ProcessState; seed: CockpitAnalysis }) {
  const method = state.activeMethod!;
  const session = state.session;
  const search = useSearch();
  const searchPair = new URLSearchParams(search).get("pair")?.replace("/", "").toUpperCase();
  const activePair = searchPair && MARKETS.includes(searchPair) ? searchPair : (seed.market || method.rules.markets[0] || "XAUUSD");
  const confirmed = isMarketTradeActive(activePair, session);
  const draft = useSessionDraft<CheckInDraft>(session, initialDraft(method, activePair), method.id);
  const setDraftValue = draft.setValue;

  useEffect(() => {
    if (!session && searchPair && MARKETS.includes(searchPair) && draft.value.market !== searchPair) {
      const saved = getSavedCockpitOperativity(searchPair);
      const savedInputs = getSavedCockpitInputs(searchPair);
      setDraftValue((v) => ({
        ...v,
        market: searchPair,
        entry: savedInputs?.entry ?? v.entry,
        stop: savedInputs?.stop ?? v.stop,
        risk: savedInputs?.risk ?? v.risk,
        cockpit: saved ?? { ...(v.cockpit ?? freshCockpit(searchPair)), market: searchPair },
      }));
    } else if (!session && seed.cycle && !draft.value.cockpit?.cycle) {
      setDraftValue((v) => ({ ...v, market: seed.market, cockpit: seed }));
    }
  }, [session, seed, searchPair, setDraftValue, draft.value.market, draft.value.cockpit?.cycle]);

  const value = draft.value;
  const analysis = confirmed
    ? (value.cockpit ?? session?.plan?.guidance?.cockpit ?? freshCockpit(activePair))
    : (value.cockpit ?? freshCockpit(value.market || activePair));

  const setAnalysis = useCallback(
    (next: CockpitAnalysis) => {
      persistCockpitOperativity(next);
      setDraftValue((v) => ({ ...v, market: next.market, cockpit: next }));
    },
    [setDraftValue],
  );

  const save = useProcessMutation(
    async (
      payload:
        | { decision: "trade" | "wait"; patch?: Partial<CheckInDraft> }
        | "trade"
        | "wait",
    ) => {
      const decision = typeof payload === "string" ? payload : payload.decision;
      const patch = typeof payload === "object" ? payload.patch : undefined;
      return draft.confirm((rawV, expectedRevision) => {
        const v = patch ? { ...rawV, ...patch } : rawV;
        const cockpit = v.cockpit ?? freshCockpit(v.market);
        const guidance = {
          expectation: v.expectation?.trim() || v.reason.trim(),
          invalidation:
            v.invalidation?.trim() || "Rivalutare il contesto prima di considerare un ingresso.",
          response: v.response || ("wait" as const),
          cockpit,
          contextSnapshotId: v.contextSnapshotId ?? null,
        };
        const plan: SessionPlan =
          decision === "wait"
            ? { decision, market: v.market, waitReason: v.reason.trim(), guidance }
            : {
                decision,
                market: v.market,
                setup: `${cockpit.scenario} · ${cockpit.trigger}`,
                entry: v.entry,
                stop: v.stop,
                initialRisk: Number(v.risk) || 5,
                invalidation: guidance.invalidation,
                guidance,
              };
        return {
          action: "check_in",
          expectedRevision,
          preparation: { checklist: v.checklist, mood: v.mood, focus: v.focus },
          plan,
        };
      });
    },
  );

  return (
    <CockpitView
      state={state}
      analysis={analysis}
      onAnalysis={setAnalysis}
      value={value}
      change={(patch) => draft.setValue((v) => ({ ...v, ...patch }))}
      confirmed={confirmed}
      onConfirm={(payload) => save.mutate(payload)}
      busy={save.isPending}
      error={save.error}
      status={<SessionDraftStatus {...draft} retry={draft.flush} />}
      flush={draft.flush}
    />
  );
}

export default function TradingCockpit() {
  const ck = useCockpitCopy();
  const query = useTraderProcess();
  const search = useSearch();
  const searchPair = new URLSearchParams(search).get("pair")?.replace("/", "").toUpperCase();
  const initialMarket = MARKETS.includes(searchPair ?? "") ? searchPair! : "XAUUSD";
  const [analysis, setAnalysis] = useState(() => {
    return getSavedCockpitOperativity(initialMarket) ?? freshCockpit(initialMarket);
  });

  const handleAnalysisChange = useCallback((next: CockpitAnalysis) => {
    persistCockpitOperativity(next);
    setAnalysis(next);
  }, []);

  useEffect(() => {
    if (searchPair && MARKETS.includes(searchPair) && analysis.market !== searchPair) {
      const saved = getSavedCockpitOperativity(searchPair);
      setAnalysis(saved ?? ((prev) => ({ ...prev, market: searchPair })));
    }
  }, [searchPair, analysis.market]);

  if (!query.data)
    return (
      <main className="ck-boot">
        <ShieldCheck />
        <h1>{"LIMEN PROTOCOL"}</h1>
        <p role="status">
          {query.isError
            ? ck("cockpit.ui.boot.error")
            : ck("cockpit.ui.boot.loading")}
        </p>
        {query.isError && (
          <button onClick={() => void query.refetch()}>{ck("cockpit.ui.f360775cb8")}</button>
        )}
      </main>
    );

  if (query.data.activeMethod)
    return <PersistedCockpit key={query.data.activeMethod.id} state={query.data} seed={analysis} />;
  return <CockpitView state={query.data} analysis={analysis} onAnalysis={handleAnalysisChange} />;
}

function CockpitPhaseDoctrineCard({
  phase,
  tfs,
}: {
  phase: 1 | 2 | 3 | 4;
  tfs: string[];
}) {
  return (
    <div className="ck-doctrine-card">
      <div className="ck-doctrine-header">
        <span className="ck-doctrine-badge">
          {phase === 1 && `Fase 1 · HTF ${tfs[0]}`}
          {phase === 2 && `Fase 2 · ITF ${tfs[1]}`}
          {phase === 3 && `Fase 3 · LTF ${tfs[2]}`}
          {phase === 4 && "Fase 4 · Gestione"}
        </span>
        <span className="ck-doctrine-title">
          {phase === 1 && "Direttiva di Contesto"}
          {phase === 2 && "Punto di Svolta"}
          {phase === 3 && "Sigillo & Trigger"}
          {phase === 4 && "Protezione Capitale"}
        </span>
      </div>

      <div className="ck-doctrine-rule">
        {phase === 1 && "Nessun trade senza allineamento di ciclo HTF e caccia di liquidità confermata."}
        {phase === 2 && "Verifica la reazione sulla zona o il re-accumulo sul timeframe intermedio prima di scendere all'esecuzione."}
        {phase === 3 && "Attendi la conferma M1 con pazienza. Se il trigger non compare, il trade non esiste."}
        {phase === 4 && "Proteggi il capitale: Breakeven al TP1 o alla prima resistenza contraria."}
      </div>

      <div className="ck-doctrine-list">
        {phase === 1 && (
          <>
            <div className="ck-doctrine-item">
              <span className="ck-doctrine-dot" />
              <span>Verifica massimi/minimi asiatici e sweep di liquidità esterna.</span>
            </div>
            <div className="ck-doctrine-item">
              <span className="ck-doctrine-dot" />
              <span>Se in compressione centrale, l'operatività è rigorosamente sospesa.</span>
            </div>
          </>
        )}
        {phase === 2 && (
          <>
            <div className="ck-doctrine-item">
              <span className="ck-doctrine-dot" />
              <span>Cerca sweep + rottura strutturale (CHoCH / MSS) su {tfs[1]}.</span>
            </div>
            <div className="ck-doctrine-item">
              <span className="ck-doctrine-dot" />
              <span>Nei reaccumuli intermedi opera solo a favore del ciclo dominante.</span>
            </div>
          </>
        )}
        {phase === 3 && (
          <>
            <div className="ck-doctrine-item">
              <span className="ck-doctrine-dot" />
              <span>Conferma {tfs[2]} non va anticipata: attendi chiusura candela di trigger.</span>
            </div>
            <div className="ck-doctrine-item">
              <span className="ck-doctrine-dot" />
              <span>Stop Loss rigoroso oltre il punto di invalidazione, mai discrezionale.</span>
            </div>
            <div className="ck-doctrine-item">
              <span className="ck-doctrine-dot" />
              <span>Target primario sul pool di liquidità opposto più prossimo.</span>
            </div>
          </>
        )}
        {phase === 4 && (
          <>
            <div className="ck-doctrine-item">
              <span className="ck-doctrine-dot" />
              <span>Sposta a Breakeven al raggiungimento di TP1 per azzerare il rischio.</span>
            </div>
            <div className="ck-doctrine-item">
              <span className="ck-doctrine-dot" />
              <span>In caso di congestione o perdita di volumi, riduci l'esposizione.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CockpitView({
  state,
  analysis: a,
  onAnalysis,
  value,
  change,
  confirmed: confirmedProp = false,
  onConfirm,
  busy = false,
  error,
  status: _status,
  flush,
}: {
  state: ProcessState;
  analysis: CockpitAnalysis;
  onAnalysis: (s: CockpitAnalysis) => void;
  value?: CheckInDraft;
  change?: (patch: Partial<CheckInDraft>) => void;
  confirmed?: boolean;
  onConfirm?: (
    payload:
      | { decision: "trade" | "wait"; patch?: Partial<CheckInDraft> }
      | "trade"
      | "wait",
  ) => void;
  busy?: boolean;
  error?: unknown;
  status?: ReactNode;
  flush?: () => Promise<unknown>;
}) {
  const ck = useCockpitCopy();
  const query = useTraderProcess();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  const [dialog, setDialog] = useState<
    | "protection"
    | "context"
    | "notes"
    | "protocol"
    | "confirm"
    | "news"
    | "examples"
    | "next_session_plan"
    | "chart_prefs"
    | "operative_plan"
    | "user_playbook"
    | "favorite_tools"
    | null
  >(null);
  const [journalModalOpen, setJournalModalOpen] = useState(false);
  const [exampleCategory, setExampleCategory] = useState<string>("ALL");
  const [chartPrefs, setChartPrefs] = useState<ChartPreferences>(() => loadChartPreferences());
  const [chartKey, setChartKey] = useState<number>(0);
  const [plansCount, setPlansCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("tl_cockpit_next_session_plans_v1");
      return saved ? JSON.parse(saved).length : 0;
    } catch {
      return 0;
    }
  });

  const updatePlansCount = useCallback(() => {
    try {
      const saved = localStorage.getItem("tl_cockpit_next_session_plans_v1");
      setPlansCount(saved ? JSON.parse(saved).length : 0);
    } catch {
      setPlansCount(0);
    }
  }, []);

  const [activePlanSummary, setActivePlanSummary] = useState<{
    bias: "long" | "short" | "wait";
    status: "draft" | "confirmed";
    rr: string;
    hasPlan: boolean;
  }>(() => {
    try {
      const raw = localStorage.getItem(`tl_cockpit_operative_plan_${a.market}`);
      if (raw) {
        const p = JSON.parse(raw);
        const e = parseFloat(p.entryPrice);
        const s = parseFloat(p.stopLoss);
        const tp = parseFloat(p.takeProfit1);
        const rr = (!isNaN(e) && !isNaN(s) && !isNaN(tp) && Math.abs(e - s) > 0)
          ? `1:${(Math.abs(tp - e) / Math.abs(e - s)).toFixed(1)}`
          : "";
        return {
          bias: p.bias || "wait",
          status: p.status || "draft",
          rr,
          hasPlan: Boolean(p.entryPrice || p.setupName),
        };
      }
    } catch {
      // ignore
    }
    return { bias: "wait", status: "draft", rr: "", hasPlan: false };
  });

  const [playbookCount, setPlaybookCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("tl_user_playbook_setups_v1");
      return saved ? JSON.parse(saved).length : 2;
    } catch {
      return 2;
    }
  });

  const refreshDockState = useCallback(() => {
    try {
      const raw = localStorage.getItem(`tl_cockpit_operative_plan_${a.market}`);
      if (raw) {
        const p = JSON.parse(raw);
        const e = parseFloat(p.entryPrice);
        const s = parseFloat(p.stopLoss);
        const tp = parseFloat(p.takeProfit1);
        const rr = (!isNaN(e) && !isNaN(s) && !isNaN(tp) && Math.abs(e - s) > 0)
          ? `1:${(Math.abs(tp - e) / Math.abs(e - s)).toFixed(1)}`
          : "";
        setActivePlanSummary({
          bias: p.bias || "wait",
          status: p.status || "draft",
          rr,
          hasPlan: Boolean(p.entryPrice || p.setupName),
        });
      } else {
        setActivePlanSummary({ bias: "wait", status: "draft", rr: "", hasPlan: false });
      }
      const savedPb = localStorage.getItem("tl_user_playbook_setups_v1");
      setPlaybookCount(savedPb ? JSON.parse(savedPb).length : 2);
    } catch {
      // ignore
    }
  }, [a.market]);

  useEffect(() => {
    refreshDockState();
    window.addEventListener("storage", refreshDockState);
    return () => window.removeEventListener("storage", refreshDockState);
  }, [refreshDockState]);

  const [chartTF, setChartTF] = useState("60");
  const [tradeRegisterModalOpen, setTradeRegisterModalOpen] = useState(false);
  const [decompressionModalOpen, setDecompressionModalOpen] = useState(false);
  const [inspectSchematic, setInspectSchematic] = useState<CockpitSchematic | null>(null);
  const [timeframeSnapshots, setTimeframeSnapshots] = useState<TimeframeSnapshot[]>(() => {
    try {
      const raw = localStorage.getItem(`tl_cockpit_tf_snapshots_${a.market}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [chartAllowed, setChartAllowed] = useState(true);
  const [mobileTab, setMobileTab] = useState<"process" | "chart">("process");
  const [, navigate] = useLocation();
  const search = useSearch();

  const { isFreeTrial, remainingTime } = useFreeTrial();

  // Collapsible left panel & Focus mode state for wide chart experience
  const [leftCollapsed, setLeftCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("tl_cockpit_left_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const effectiveLeftCollapsed = isFreeTrial || leftCollapsed;

  useEffect(() => {
    if (isFreeTrial && mobileTab === "process") {
      setMobileTab("chart");
    }
  }, [isFreeTrial, mobileTab]);

  const [focusMode, setFocusMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem("tl_cockpit_focus_mode") === "1";
    } catch {
      return false;
    }
  });

  const sanitizeNumberOrShort = (val: string | undefined) => {
    if (!val) return "";
    if (val.length > 15 && val.includes(" ")) return "";
    return val;
  };

  // Financial Architecture & Risk Presets
  const { data: finProfile } = useFinancialProfile();
  const tradingCapital = getReferenceTradingCapital(finProfile);
  // Limen Risk Architecture: 0.5% (Conservativo), 1.0% (Consigliato Limen), 1.5% (Focus)
  const riskConservative = Math.round(tradingCapital * 0.005) || 40;
  const riskStandard = Math.round(tradingCapital * 0.01) || 80;
  const riskFocus = Math.round(tradingCapital * 0.015) || 120;
  const [showAdvancedLevels, setShowAdvancedLevels] = useState(false);

  // Local state for Step 03 trade inputs (synced with value/draft when present, with persistent localStorage backup)
  const savedInputs = getSavedCockpitInputs(a.market);
  const [localEntry, setLocalEntry] = useState(() => sanitizeNumberOrShort(value?.entry) || savedInputs?.entry || "");
  const [localStop, setLocalStop] = useState(() => sanitizeNumberOrShort(value?.stop) || savedInputs?.stop || "");
  const [localRisk, setLocalRisk] = useState(() => value?.risk ?? savedInputs?.risk ?? String(riskStandard || state.activeMethod?.rules.riskPerTrade || 80));
  const [step3Error, setStep3Error] = useState<string | null>(null);

  useEffect(() => {
    // If localRisk is unset or was defaulting to the legacy placeholder "5", update to the Limen recommended risk based on financial architecture
    if ((!localRisk || localRisk === "5") && riskStandard > 0 && !savedInputs?.risk && !value?.risk) {
      setLocalRisk(String(riskStandard));
    }
  }, [riskStandard, localRisk, savedInputs?.risk, value?.risk]);

  const onEntryChange = (val: string) => {
    setLocalEntry(val);
    persistCockpitInputs(a.market, { entry: val, stop: localStop, risk: localRisk });
    change?.({ entry: val });
  };
  const onStopChange = (val: string) => {
    setLocalStop(val);
    persistCockpitInputs(a.market, { entry: localEntry, stop: val, risk: localRisk });
    change?.({ stop: val });
  };
  const onRiskChange = (val: string) => {
    setLocalRisk(val);
    persistCockpitInputs(a.market, { entry: localEntry, stop: localStop, risk: val });
    change?.({ risk: val });
  };

  // Position maintenance state for Step 04 (stored per session/market)
  const mgmtStorageKey = `tl_cockpit_mgmt_${state.session?.id || a.market}`;
  const [mgmtChecks, setMgmtChecks] = useState<{ be: boolean; tp1: boolean; congestion: boolean; invalidation: boolean }>(() => {
    try {
      const saved = localStorage.getItem(mgmtStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return { be: false, tp1: false, congestion: false, invalidation: false };
  });

  const updateMgmtCheck = (key: "be" | "tp1" | "congestion" | "invalidation", val: boolean) => {
    setMgmtChecks((prev) => {
      const next = { ...prev, [key]: val };
      try {
        localStorage.setItem(mgmtStorageKey, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [mgmtNote, setMgmtNote] = useState<string>(() => {
    try {
      return localStorage.getItem(`${mgmtStorageKey}_note`) || "";
    } catch {
      return "";
    }
  });

  const updateMgmtNote = (text: string) => {
    setMgmtNote(text);
    try {
      localStorage.setItem(`${mgmtStorageKey}_note`, text);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (value) {
      const cleanEntry = sanitizeNumberOrShort(value.entry);
      const cleanStop = sanitizeNumberOrShort(value.stop);
      if (cleanEntry && cleanEntry !== localEntry) setLocalEntry(cleanEntry);
      if (cleanStop && cleanStop !== localStop) setLocalStop(cleanStop);
      if (value.risk && value.risk !== localRisk) setLocalRisk(value.risk);
    }
  }, [value?.entry, value?.stop, value?.risk]);

  const toggleLeft = useCallback(() => {
    if (isFreeTrial) return;
    setLeftCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tl_cockpit_left_collapsed", next ? "1" : "0");
      } catch {
        // localStorage might be restricted
      }
      return next;
    });
  }, [isFreeTrial]);

  const toggleFocus = useCallback(() => {
    setFocusMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("tl_cockpit_focus_mode", next ? "1" : "0");
      } catch {
        // localStorage might be restricted
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(timer);
  }, []);

  const [tradeActive, setTradeActive] = useState(() => confirmedProp || isMarketTradeActive(a.market, state.session));

  useEffect(() => {
    setTradeActive(confirmedProp || isMarketTradeActive(a.market, state.session));
  }, [confirmedProp, a.market, state.session]);

  const confirmed = tradeActive;
  const isConfirmed = tradeActive;

  const set = (patch: Partial<CockpitAnalysis>) => {
    if (!isConfirmed) {
      const updated = changeCockpit(a, patch);
      persistCockpitOperativity(updated);
      onAnalysis(updated);
    }
  };

  const onSelectMarket = (nextMarket: string) => {
    set({ market: nextMarket });
    change?.({ market: nextMarket });
    navigate(updateWorkspaceQuery(search, { pair: nextMarket }));
  };

  const win = cockpitWindow(a, now);
  const missing = cockpitRequirements(a, now);
  const market = useQuery({
    queryKey: ["cockpit-market-context", a.market],
    queryFn: () => fetchMarketContext(a.market),
    staleTime: 30000,
    refetchInterval: (q) => (q.state.data?.refreshing ? 1500 : 60000),
  });

  const snapshotId = market.data?.snapshotId ?? null;

  useEffect(() => {
    if (!isConfirmed && change && snapshotId && snapshotId !== (value?.contextSnapshotId ?? null)) {
      change({ contextSnapshotId: snapshotId });
    }
  }, [snapshotId, isConfirmed, change, value?.contextSnapshotId]);

  const navigateAfterSave = (event: MouseEvent<HTMLElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (
      !flush ||
      !anchor ||
      anchor.target === "_blank" ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      anchor.origin !== window.location.origin
    )
      return;
    event.preventDefault();
    void flush()
      .then(() => navigate(anchor.pathname + anchor.search + anchor.hash))
      .catch(() => undefined);
  };

  const dailyRisk = state.session ? dailyProcessRisk(state.session, state.evidence) : null;
  const limitReached = Boolean(dailyRisk?.pause || state.guidance?.applicationHold);
  const operativeRules = isConfirmed ? state.session?.rulesSnapshot : state.activeMethod?.rules;
  const oldSession = Boolean(state.session?.preparedAt && !state.session.plan?.guidance?.cockpit);
  const improvement = cockpitImprovement(state);
  const [reviewPhase, setReviewPhase] = useState<1 | 2 | 3 | 4 | null>(null);
  const phase = reviewPhase ?? (isConfirmed ? 4 : a.phase);
  const tfs = a.mode === "scalp" ? ["H1", "M15", "M1"] : ["D1 / H4", "H1 / M15", a.execTF];

  // Salva automaticamente lo stato dell'analisi quando cambia fase o timeframe
  const recordTimeframeSnapshot = useCallback((step: 1 | 2 | 3 | 4, tf: string, imgData?: string) => {
    setTimeframeSnapshots((prev) => {
      const stepNames: Record<number, string> = {
        1: `Contesto HTF (${tfs[0]})`,
        2: `Svolta ITF (${tfs[1]})`,
        3: `Sigillo LTF (${tfs[2]})`,
        4: `Gestione Trade`,
      };
      const id = `${a.market}_step${step}_${tf}`;
      const defaultSummary = step === 1
        ? `${a.market} · Ciclo ${a.cycle ? (a.cycle === "up" ? "Rialzista" : "Ribassista") : "Neutro"}`
        : step === 2
        ? `Setup: ${a.scenario || "Reazione"} · Zona: ${a.area || "Key Level"}`
        : step === 3
        ? `Trigger: ${a.trigger || "JTC"} · Entry: ${localEntry || "A Mercato"}`
        : `Gestione attiva`;

      const existing = prev.find((s) => s.id === id);
      const updatedItem: TimeframeSnapshot = {
        id,
        step,
        stepName: stepNames[step] || `Fase ${step}`,
        timeframe: tf,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        summary: existing?.summary ?? defaultSummary,
        imageDataUrl: imgData || existing?.imageDataUrl,
      };

      const filtered = prev.filter((s) => s.id !== id);
      const next = [...filtered, updatedItem].sort((x, y) => x.step - y.step);
      try {
        localStorage.setItem(`tl_cockpit_tf_snapshots_${a.market}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, [a.market, a.cycle, a.scenario, a.area, a.trigger, localEntry, tfs]);

  const executeTradeReset = useCallback(
    (silentToast = false) => {
      try {
        localStorage.setItem(`tl_cockpit_trade_active_${a.market}`, "0");
        if (state.session?.id) {
          localStorage.setItem(`tl_cockpit_trade_archived_${state.session.id}_${a.market}`, "1");
        }
        localStorage.removeItem(`tl_cockpit_operativity_${a.market}_${cockpitDay()}`);
        localStorage.removeItem(`tl_cockpit_inputs_${a.market}_${cockpitDay()}`);
        localStorage.removeItem(mgmtStorageKey);
        localStorage.removeItem(`${mgmtStorageKey}_note`);
        localStorage.removeItem(`tl_cockpit_tf_snapshots_${a.market}`);
        localStorage.removeItem(`tl_cockpit_operative_plan_${a.market}`);
      } catch {
        // ignore
      }

      setTradeActive(false);
      setLocalEntry("");
      setLocalStop("");
      setLocalRisk(String(riskStandard || state.activeMethod?.rules.riskPerTrade || "80"));
      setStep3Error(null);
      setMgmtChecks({ be: false, tp1: false, congestion: false, invalidation: false });
      setMgmtNote("");
      setTimeframeSnapshots([]);
      setReviewPhase(1);

      const fresh = freshCockpit(a.market, a.mode);
      persistCockpitOperativity(fresh);
      onAnalysis(fresh);
      change?.({
        entry: "",
        stop: "",
        risk: String(riskStandard || state.activeMethod?.rules.riskPerTrade || "80"),
        reason: "",
        expectation: "",
        invalidation: "",
        response: "",
        cockpit: fresh,
      });

      queryClient.invalidateQueries({ queryKey: traderProcessKey });
      queryClient.invalidateQueries({ queryKey: getGetJournalEntriesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetJournalEdgeQueryKey() });
      refreshDockState();

      if (!silentToast) {
        toast({
          title: "Operatività Archiviata",
          description: "Cockpit ripristinato allo Step 01 (Contesto HTF) per una nuova analisi.",
        });
      }
    },
    [
      a.market,
      a.mode,
      state.session?.id,
      state.activeMethod?.rules.riskPerTrade,
      riskStandard,
      mgmtStorageKey,
      onAnalysis,
      change,
      queryClient,
      refreshDockState,
      toast,
    ],
  );

  // Aggiorna lo scatto quando cambia il timeframe o la fase
  useEffect(() => {
    recordTimeframeSnapshot(phase as 1 | 2 | 3 | 4, chartTF);
  }, [phase, chartTF, recordTimeframeSnapshot]);
  const _ready = !missing.length && !limitReached;
  const _stepGuidance = getStepGuidance(phase, a.mode);

  const calculatedRR = (() => {
    const entryNum = parseFloat(localEntry || value?.entry || "");
    const stopNum = parseFloat(localStop || value?.stop || "");
    const targetNum = parseFloat(a.target || "");
    if (!isNaN(entryNum) && !isNaN(stopNum) && !isNaN(targetNum)) {
      const riskDist = Math.abs(entryNum - stopNum);
      const rewardDist = Math.abs(targetNum - entryNum);
      if (riskDist > 0 && rewardDist > 0) {
        return (rewardDist / riskDist).toFixed(2);
      }
    }
    return null;
  })();

  // ── Sentinella Visiva IA (Limen Vision Sentinel — Motore Unificato Forgia ↔ Varco) ──
  const {
    isScanning: isAiScanning,
    analysis: aiAnalysis,
    setup: aiSetup,
    showOverlay: showAiOverlay,
    setShowOverlay: setShowAiOverlay,
    scan: scanVarcoAi,
    updateSetup: updateAiSetup,
  } = useVarcoVisionSentinel();

  const [continuousAutoScan, setContinuousAutoScan] = useState(true);
  const [autoAlignCockpit, setAutoAlignCockpit] = useState(true);
  const [operativeMemory, setOperativeMemory] = useState<LimenOperativeMemoryState>(() =>
    loadOperativeMemory(a.market),
  );

  useEffect(() => {
    setOperativeMemory(loadOperativeMemory(a.market));
  }, [a.market]);

  const activeSetupRef = useRef<VarcoSetupPlan | null>(null);
  activeSetupRef.current = aiSetup;
  const operativeMemoryRef = useRef<LimenOperativeMemoryState>(operativeMemory);
  operativeMemoryRef.current = operativeMemory;
  const autoAlignCockpitRef = useRef(autoAlignCockpit);
  autoAlignCockpitRef.current = autoAlignCockpit;

  const chartCandlesRef = useRef<any[]>([]);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastLiveBarTimeRef = useRef<number | null>(null);
  const liveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleResetOperativeMemory = useCallback(() => {
    const fresh = resetOperativeMemory(a.market);
    operativeMemoryRef.current = fresh;
    setOperativeMemory(fresh);
    toast({
      title: "Memoria Operativa Resettata",
      description: `I filtri del Piano Operativo e le statistiche per ${a.market} sono tornati ai valori di partenza.`,
    });
  }, [a.market, toast]);

  const handleAdoptAiSetup = useCallback(
    (setup: VarcoSetupPlan, triggerType?: string, silentAdopt = false) => {
      // 1. Popola livelli di prezzo
      setLocalEntry(String(setup.entryPrice));
      setLocalStop(String(setup.stopLossPrice));
      onEntryChange(String(setup.entryPrice));
      onStopChange(String(setup.stopLossPrice));

      // 2. Allinea tutti i concetti del Piano Operativo (Step 01 -> Step 02 -> Step 03)
      const targetDesc = `TP1 50%: ${setup.takeProfit1Price} (1:3R) / TP2: ${setup.oppositePoolLabel || setup.takeProfit2Price}`;
      const resolvedTrigger = setup.triggerType ?? (triggerType && ["TEST", "POC", "JTC", "BTI"].includes(triggerType) ? (triggerType as any) : "TEST");

      set({
        cycle: setup.cycle ?? (setup.direction === "long" ? "up" : "down"),
        context: setup.liquidityContext ?? "swept",
        scenario: setup.zoneScenario ?? "valid_zone",
        area: setup.areaType ?? "history",
        trigger: resolvedTrigger,
        target: targetDesc,
        targetConfirmed: true,
        ltfSchema: true,
        itfSchema: true,
      });

      // 3. Pre-imposta le regole di gestione Step 04
      updateMgmtCheck("be", true);
      updateMgmtCheck("tp1", true);
      updateMgmtCheck("invalidation", true);
      updateMgmtNote(
        `Setup AI (${setup.direction.toUpperCase()} · ${resolvedTrigger}) R:R 1:${setup.riskRewardRatio}. ` +
        `BE a ${setup.breakEvenPrice} (1:1.5R). Parziale 50% a ${setup.takeProfit1Price} (1:3R). ` +
        `Swing invalidazione: ${setup.invalidationSwingPrice ?? setup.stopLossPrice}.`,
      );

      // 4. Sposta visivamente la fase a Step 03 se non ancora confermato
      if (!confirmed && phase < 3) {
        set({ phase: 3 });
      }

      if (!silentAdopt) {
        toast({
          title: "Setup AI Adottato nel Varco",
          description: `Step 01-04 allineati (${setup.zoneScenario ?? "valid_zone"} · ${resolvedTrigger}). Entry ${setup.entryPrice}, SL ${setup.stopLossPrice}, TP1 ${setup.takeProfit1Price}.`,
        });
      }
    },
    [onEntryChange, onStopChange, set, phase, confirmed, updateMgmtCheck, updateMgmtNote, toast],
  );

  const handleScanVarcoAi = useCallback(
    async (silent = false) => {
      const candles = chartCandlesRef.current;
      if (!candles || candles.length === 0) return;

      const riskVal = Number(localRisk) > 0 ? Number(localRisk) : riskStandard;
      const riskPct = tradingCapital > 0 ? (riskVal / tradingCapital) * 100 : 1.0;
      const mem = operativeMemoryRef.current;

      const res = await scanVarcoAi({
        symbol: a.market,
        interval: chartTF,
        candles: candles.slice(-240),
        chartCanvas: silent ? null : chartCanvasRef.current,
        currentPhase: phase,
        accountCapital: tradingCapital,
        riskPercent: Number(riskPct.toFixed(2)),
        silent,
        activeSetup: activeSetupRef.current,
        enforceSessionWindows: true,
        operativeMemory: {
          flipActive: mem.flipActive,
          flipDirection: mem.flipDirection,
          minImbalancePercent: mem.minImbalancePercent,
          preferPocOnReversal: mem.preferPocOnReversal,
          reaccumRiskMultiplier: mem.reaccumRiskMultiplier,
          quarantinedCombos: mem.quarantinedCombos,
        },
      });

      if (res && res.verdict === "SETUP_READY" && res.setup && autoAlignCockpitRef.current && !confirmed) {
        handleAdoptAiSetup(res.setup, res.checklistAudit.ltfTrigger.triggerType, silent);
      }
    },
    [a.market, chartTF, localRisk, riskStandard, tradingCapital, phase, confirmed, scanVarcoAi, handleAdoptAiSetup],
  );

  const handleSealTrade = (decision: "trade" | "wait" = "trade") => {
    setStep3Error(null);
    if (!value || !change || !onConfirm) {
      setDialog("protection");
      return;
    }

    if (decision === "wait") {
      const waitReason = value.reason?.trim() || "Nessun setup confermato nel contesto odierno. Disciplina rispettata.";
      const checklist = (state.activeMethod?.rules.checklist ?? []).map(() => true);
      onConfirm({
        decision: "wait",
        patch: {
          decision: "wait",
          market: a.market,
          reason: waitReason,
          checklist,
          cockpit: a,
        },
      });
      return;
    }

    // Validation for "trade"
    if (!a.trigger || !a.ltfSchema || !a.target.trim()) {
      setStep3Error("Verifica la schematica (M1/M5), seleziona un Trigger e indica il Target prima di sigillare.");
      return;
    }

    const entryVal = (localEntry || value.entry || "").trim() || "A mercato";
    const stopVal = (localStop || value.stop || "").trim() || "Struttura";
    const riskVal = (localRisk || value.risk || "").trim() || String(riskStandard || state.activeMethod?.rules.riskPerTrade || "80");
    const numChecklist = state.activeMethod?.rules.checklist.length ?? 3;
    const verifiedChecklist = Array.from({ length: numChecklist }, () => true);

    const defaultExpectation = `${a.market} · ${a.scenario || "Setup"} · Trigger ${a.trigger || "TEST"} verso target ${a.target}`;
    const defaultInvalidation = `Rottura schematica ${tfs[2]} o violazione stop di struttura (${stopVal})`;

    const sealedCockpit: CockpitAnalysis = {
      ...a,
      area: a.area || "history",
      targetConfirmed: true,
      itfSchema: a.itfSchema || Boolean(a.scenario),
      news: a.news === "unchecked" ? "clear" : a.news,
      newsDay: a.newsDay || cockpitDay(),
      phase: 3,
    };

    try {
      localStorage.setItem(`tl_cockpit_trade_active_${a.market}`, "1");
      if (state.session?.id) {
        localStorage.removeItem(`tl_cockpit_trade_archived_${state.session.id}_${a.market}`);
      }
    } catch {
      // ignore
    }
    setTradeActive(true);
    setReviewPhase(null);

    set(sealedCockpit);

    onConfirm({
      decision: "trade",
      patch: {
        decision: "trade",
        market: a.market,
        entry: entryVal,
        stop: stopVal,
        risk: riskVal,
        expectation: value.expectation?.trim() || defaultExpectation,
        invalidation: value.invalidation?.trim() || defaultInvalidation,
        response: value.response || "wait",
        checklist: verifiedChecklist,
        cockpit: sealedCockpit,
      },
    });
  };

  const allMarkets = Array.from(new Set([...MARKETS, ...(state.activeMethod?.rules.markets ?? [])]));
  const otherMarkets = allMarkets.filter((m) => !(MAIN_PAIRS as readonly string[]).includes(m));
  const isOtherSelected = !(MAIN_PAIRS as readonly string[]).includes(a.market);

  // Quantitative context values
  const reports = market.data?.cotReports ?? [];
  const latestCot = reports[0]?.nonCommNet;
  const cotFormatted = latestCot != null ? formatCompactNumber(latestCot) : "+207.8K";

  const ranges = market.data?.ranges ?? [];
  const d1Range = ranges.find((r) => r.days === 1 || r.days === 22) ?? ranges[0];
  const _adrFormatted = d1Range?.value != null ? `${d1Range.value.toFixed(1)} pt` : "69.5 pt";

  const events = market.data?.events ?? [];
  const nowMs = now.getTime();

  // Automatically detect imminent high-impact event (happening within next 30 min, or up to 5 min after)
  const imminentEvent = events.find((e) => {
    const t = Date.parse(e.date);
    if (!Number.isFinite(t)) return false;
    const diffMin = (t - nowMs) / (60 * 1000);
    return diffMin >= -5 && diffMin <= 30;
  });

  // Automatically detect recent high-impact event (occurred 5 to 20 minutes ago)
  const recentEvent = !imminentEvent
    ? events.find((e) => {
        const t = Date.parse(e.date);
        if (!Number.isFinite(t)) return false;
        const diffMin = (nowMs - t) / (60 * 1000);
        return diffMin > 5 && diffMin <= 20;
      })
    : undefined;

  const autoNewsStatus: CockpitAnalysis["news"] = imminentEvent
    ? "pre"
    : recentEvent
      ? "post"
      : "clear";

  const macroText = market.isPending
    ? "Verifica..."
    : imminentEvent
      ? `Pre-news: ${imminentEvent.title}`
      : recentEvent
        ? `Post-news: ${recentEvent.title}`
        : events.length === 0
          ? "Nessun evento imminente"
          : `Nessun evento imminente (${events.length} oggi)`;

  // Automatically sync news status with real-time economic calendar intelligence
  useEffect(() => {
    if (!confirmed) {
      const today = cockpitDay(now);
      if (a.news !== autoNewsStatus || a.newsDay !== today) {
        if (!a.ltfSchema && !a.itfSchema && !a.trigger) {
          set({ news: autoNewsStatus, newsDay: today });
        } else {
          // If trader already has active schematic or is waiting for M1, do NOT reset schematics
          const updated = { ...a, news: autoNewsStatus, newsDay: today };
          persistCockpitOperativity(updated);
          onAnalysis(updated);
        }
      }
    }
  }, [autoNewsStatus, confirmed, now, a.news, a.newsDay, a.ltfSchema, a.itfSchema, a.trigger, onAnalysis]);

  const score = market.data?.score != null ? market.data.score : 21;

  // Real-time Risk Threshold values
  const _riskAmount = operativeRules?.riskPerTrade != null ? `${operativeRules.riskPerTrade}${operativeRules.currency ?? "€"}` : "5€";
  const _lossAmount = operativeRules?.maxDailyLoss != null ? `${operativeRules.maxDailyLoss}${operativeRules.currency ?? "€"}` : "10€";
  const _tradesToday = state.evidence.filter((e) => e.sessionId === state.session?.id).length;
  const _maxTrades = operativeRules?.maxDailyTrades ?? 3;

  return (
    <main
      className="trading-cockpit"
      data-testid="trading-cockpit"
      onClickCapture={navigateAfterSave}
    >
      <div className="ck-mobile-tabs" role="group" aria-label={ck("cockpit.ui.3a0b9c0415")}>
        {!isFreeTrial && (
          <button aria-pressed={mobileTab === "process"} onClick={() => setMobileTab("process")}>
            01 · Processo
          </button>
        )}
        <button aria-pressed={mobileTab === "chart"} onClick={() => setMobileTab("chart")}>
          {isFreeTrial ? "01 · Grafico" : "02 · Grafico"}
        </button>
        <button
          aria-pressed={dialog === "protection"}
          onClick={() => {
            setDialog("protection");
          }}
        >
          {isFreeTrial ? "02 · Rischio & Custode" : "03 · Rischio & Custode"}
        </button>
      </div>

      {isFreeTrial && (
        <div className="mx-3 mt-2 mb-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Badge variant="warning" className="text-[10px] uppercase font-bold tracking-wider">
              PROVA GRATUITA (24 ORE)
            </Badge>
            <span>
              Tempo residuo: <strong className="font-mono text-foreground">{remainingTime}</strong>. Colonna operativa e architettura patrimoniale oscurate per la prova.
            </span>
          </div>
          <Link
            href="/pro"
            className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-bold font-mono text-[11px] transition uppercase tracking-wider shrink-0 shadow-sm"
          >
            Attiva Completo (150 €/mese) →
          </Link>
        </div>
      )}

      {!isFreeTrial && <FinancialArchitectureBanner className="mx-3 mt-2 mb-3" />}

      {/* ── COCKPIT A 2 COLONNE: Left Process Wizard + Main Chart Area ── */}
      <div
        className="ck-workspace"
        data-mobile-view={mobileTab}
        data-left-collapsed={effectiveLeftCollapsed}
        data-focus={focusMode}
      >
        {/* COLONNA 1 (SINISTRA): IL FLUSSO GUIDATO (Process Wizard) */}
        {!isFreeTrial && (
          <aside className="ck-process" aria-label={ck("cockpit.ui.157a305253")}>
          {/* Toggle Modalità: Duello · Scalp vs Assedio · Swing + Esempi */}
          <div className="ck-session-line">
            <div className="ck-segment" role="group" aria-label={ck("cockpit.ui.114e037766")}>
              {(["scalp", "swing"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={a.mode === mode}
                  disabled={confirmed}
                  onClick={() => set({ mode })}
                >
                  {mode === "scalp" ? "Duello · Scalp" : "Assedio · Swing"}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ck-col-toggle-btn ml-auto hidden lg:inline-grid"
              title={ck("cockpit.ui.panel.left_hide")}
              aria-label={ck("cockpit.ui.panel.left_hide")}
              onClick={toggleLeft}
            >
              <PanelLeftClose size={15} />
            </button>
          </div>

          {/* Stepper Orizzontale Compatto a 4 step (grid-cols-4 gap-1 text-[11px]) */}
          <div className="ck-stepper-grid" role="tablist" aria-label="Fasi del Protocollo">
            {[
              { step: 1, num: "01", name: "Contesto", ready: cockpitContextReady(a) },
              { step: 2, num: "02", name: "Svolta", ready: Boolean(a.scenario) },
              { step: 3, num: "03", name: "Sigillo", ready: Boolean(a.trigger && a.itfSchema && a.ltfSchema && a.targetConfirmed) },
              { step: 4, num: "04", name: "Target", ready: Boolean(confirmed) },
            ].map(({ step, num, name, ready: isStepReady }) => {
              const isActive = phase === step;
              const isDisabled =
                (step === 2 && !cockpitContextReady(a)) ||
                (step === 3 && (!cockpitContextReady(a) || !a.scenario)) ||
                (step === 4 && !confirmed && !a.targetConfirmed);

              return (
                <button
                  key={step}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  disabled={isDisabled}
                  className={`ck-stepper-btn ${isActive ? "is-active" : ""} ${isStepReady ? "is-done" : ""}`}
                  onClick={() => {
                    if (confirmed) {
                      setReviewPhase(step as 1 | 2 | 3 | 4);
                    }
                    if (step <= 3) {
                      set({ phase: step as 1 | 2 | 3 });
                    }
                    if (step === 1) setChartTF(a.mode === "scalp" ? "60" : "240");
                    else if (step === 2) setChartTF("15");
                    else if (step === 3 || step === 4) setChartTF(a.execTF === "M5" ? "5" : "1");
                  }}
                >
                  <span className="font-mono font-bold text-[11px] block">{num}</span>
                  <span className="text-[10px] tracking-tight block opacity-90">{name}</span>
                </button>
              );
            })}
          </div>

          {/* ── FINESTRA OPERATIVA CHE TI GUIDA ── */}
          <CockpitGuidanceBox
            phase={phase}
            mode={a.mode}
            market={a.market}
            analysis={a}
            confirmed={confirmed}
            onOpenExamples={(cat) => {
              setExampleCategory(cat ?? "ALL");
              setDialog("examples");
            }}
            className="mb-3"
          />

          {/* Sentinella Visiva del Varco (AI Co-Pilot Checklist & Setup — Motore Unificato) */}
          <div className="mb-3">
            <CockpitAiSentinelCard
              isScanning={isAiScanning}
              analysis={aiAnalysis}
              onScan={() => void handleScanVarcoAi(false)}
              onAdoptSetup={handleAdoptAiSetup}
              showOverlay={showAiOverlay}
              onToggleOverlay={() => setShowAiOverlay((prev) => !prev)}
              currentPhase={phase}
              continuousAutoScan={continuousAutoScan}
              onToggleContinuousAutoScan={() => setContinuousAutoScan((prev) => !prev)}
              autoAlignCockpit={autoAlignCockpit}
              onToggleAutoAlignCockpit={() => setAutoAlignCockpit((prev) => !prev)}
              operativeMemory={operativeMemory}
              onResetMemory={handleResetOperativeMemory}
              interval={chartTF}
            />
          </div>

          {/* Contenitore Attivo Step Unificato (eliminata la duplicazione delle card) */}
          <div className="ck-active-step-card">
            {phase === 1 && (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div>
                    <span className="font-mono text-[10px] text-primary uppercase tracking-wider block">
                      Step 01 / 04
                    </span>
                    <h2 className="text-sm font-semibold text-foreground">
                      01 · Contemplazione dello Scenario [{tfs[0]}]
                    </h2>
                  </div>
                  {!confirmed && (
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      onClick={() => {
                        set({ cycle: "", context: undefined });
                      }}
                    >
                      <RotateCcw size={12} />
                      Azzera
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-foreground block">
                      Dove ci troviamo nel ciclo HTF?
                    </label>
                    <span className="text-[10px] text-muted-foreground font-mono">Disegni Schemi</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {CYCLES.map(([v, l]) => {
                      const schId = `cycle_${v}`;
                      const sch = COCKPIT_SCHEMATICS[schId];
                      const isSelected = a.cycle === v;
                      return (
                        <div
                          key={v}
                          role="button"
                          tabIndex={confirmed ? -1 : 0}
                          onClick={confirmed ? undefined : () => set({ cycle: v as CockpitAnalysis["cycle"] })}
                          className={`group p-2 rounded-lg border text-left transition-all cursor-pointer relative select-none ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-[0_0_12px_rgba(197,160,89,0.15)] ring-1 ring-primary/40"
                              : "border-white/10 bg-black/40 hover:border-white/20 hover:bg-white/[0.03]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="text-[11px] font-semibold text-foreground truncate block">
                              {ck(l)}
                            </span>
                            {sch && (
                              <button
                                type="button"
                                title="Ingrandisci schema grafico"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectSchematic(sch);
                                }}
                                className="text-muted-foreground hover:text-primary transition-colors p-0.5 shrink-0 cursor-pointer"
                              >
                                <ZoomIn size={12} />
                              </button>
                            )}
                          </div>
                          {sch && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectSchematic(sch);
                              }}
                              className="w-full h-11 rounded bg-black/60 border border-white/10 overflow-hidden flex items-center justify-center cursor-zoom-in relative group/thumb"
                            >
                              <img
                                src={sch.imageSrc}
                                alt={sch.title}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = "none";
                                }}
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                                <ZoomIn size={12} className="text-primary" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    Struttura di Liquidità HTF
                  </span>
                  {(
                    [
                      [
                        "compression",
                        "liq_compression",
                        "Liquidità sopra e sotto",
                        "Compressione attiva. Nessun ingresso.",
                      ],
                      [
                        "swept",
                        "liq_swept",
                        "Liquidity swept",
                        "Caccia avvenuta e verificata sul grafico.",
                      ],
                      [
                        "intermediate",
                        "liq_intermediate",
                        "Zona estrema non raggiunta",
                        "Re-accumuli in corso: prosegui solo sui box intermedi.",
                      ],
                    ] as const
                  ).map(([v, schId, l, d]) => (
                    <CockpitVisualChoice
                      key={v}
                      schematicId={schId}
                      checked={a.context === v}
                      disabled={confirmed}
                      title={l}
                      subtitle={d}
                      onClick={() => set({ context: v })}
                      onInspect={(sch) => setInspectSchematic(sch)}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="ck-primary w-full mt-3.5"
                  disabled={!cockpitContextReady(a)}
                  onClick={() => {
                    set({ phase: 2 });
                    setChartTF("15");
                  }}
                >
                  <span>Conferma Contesto → Passa a Punto di Svolta</span>
                  <ArrowUpRight size={15} />
                </button>
              </>
            )}

            {phase === 2 && (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div>
                    <span className="font-mono text-[10px] text-primary uppercase tracking-wider block">
                      Step 02 / 04
                    </span>
                    <h2 className="text-sm font-semibold text-foreground">
                      02 · Punto di Svolta [{tfs[1]}]
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      onClick={() => {
                        set({ phase: 1 });
                        setChartTF(a.mode === "scalp" ? "60" : "240");
                      }}
                    >
                      <ChevronLeft size={12} />
                      Indietro
                    </button>
                    {!confirmed && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                        onClick={() => set({ scenario: undefined })}
                      >
                        <RotateCcw size={12} />
                        Azzera
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Cosa ha preso a sinistra sul timeframe intermedio ({tfs[1]})?
                </p>

                <div className="flex flex-col gap-2">
                  {SCENARIOS.map(([v, l, d]) => {
                    const schId = `scenario_${v}`;
                    return (
                      <CockpitVisualChoice
                        key={v}
                        schematicId={schId}
                        checked={a.scenario === v}
                        disabled={confirmed || !cockpitScenarios(a).includes(v)}
                        title={ck(l)}
                        subtitle={ck(d)}
                        onClick={() => {
                          set({ scenario: v, itfSchema: true });
                          setChartTF(a.execTF === "M5" ? "5" : "1");
                        }}
                        onInspect={(sch) => setInspectSchematic(sch)}
                      />
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <Tick
                    label={`Ciclo ${tfs[1]} chiuso con schematica valida`}
                    checked={a.itfSchema}
                    disabled={confirmed}
                    onChange={(itfSchema) => set({ itfSchema })}
                  />
                  {COCKPIT_SCHEMATICS.itf_schematic && (
                    <button
                      type="button"
                      onClick={() => setInspectSchematic(COCKPIT_SCHEMATICS.itf_schematic)}
                      className="text-[10px] font-mono text-primary flex items-center gap-1 hover:underline cursor-pointer shrink-0 bg-primary/10 px-2 py-1 rounded border border-primary/20"
                    >
                      <ZoomIn size={11} />
                      <span>Schema M15 ↗</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  className="ck-primary w-full mt-3.5"
                  disabled={!a.scenario || !a.itfSchema}
                  onClick={() => {
                    set({ phase: 3 });
                    setChartTF(a.execTF === "M5" ? "5" : "1");
                  }}
                >
                  <span>Conferma Punto di Svolta → Passa a Sigillo</span>
                  <ArrowUpRight size={15} />
                </button>
              </>
            )}

            {phase === 3 && (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div>
                    <span className="font-mono text-[10px] text-primary uppercase tracking-wider block">
                      Step 03 / 04
                    </span>
                    <h2 className="text-sm font-semibold text-foreground">
                      03 · Sigillo d'Ingresso & Regole [{tfs[2]}]
                    </h2>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    onClick={() => {
                      set({ phase: 2 });
                      setChartTF("15");
                    }}
                  >
                    <ChevronLeft size={12} />
                    Indietro
                  </button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Verifica la schematica di esecuzione e attendi il trigger prima di sigillare il piano.
                </p>

                <div className="space-y-3">
                  {a.mode === "swing" && (
                    <div className="ck-segment">
                      {(["M5", "M1"] as const).map((tf) => (
                        <button
                          key={tf}
                          type="button"
                          aria-pressed={a.execTF === tf}
                          disabled={confirmed}
                          onClick={() => {
                            set({ execTF: tf });
                            setChartTF(tf === "M5" ? "5" : "1");
                          }}
                        >
                          Timeframe: {tf}
                        </button>
                      ))}
                    </div>
                  )}

                  <Tick
                    label={`Schematica d'ingresso ${tfs[2]} valida`}
                    checked={a.ltfSchema}
                    disabled={confirmed}
                    onChange={(ltfSchema) => set({ ltfSchema })}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                        Trigger Operativo
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground">Schemi M1/M5</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Trigger Operativo">
                      {(["TEST", "POC", "JTC", "BTI"] as const).map((trigger) => {
                        const schId = `trigger_${trigger.toLowerCase()}`;
                        const sch = COCKPIT_SCHEMATICS[schId];
                        const isSelected = a.trigger === trigger;
                        const isDisabled = confirmed || !a.ltfSchema || !cockpitTriggers(a).includes(trigger);
                        return (
                          <div
                            key={trigger}
                            onClick={() => {
                              if (!isDisabled) set({ trigger });
                            }}
                            className={`p-1.5 rounded-md border text-center transition-all flex flex-col justify-between items-center select-none cursor-pointer ${
                              isDisabled
                                ? "opacity-40 cursor-not-allowed border-white/5 bg-white/[0.01]"
                                : isSelected
                                ? "border-primary bg-primary/20 text-primary font-bold shadow-sm ring-1 ring-primary/40"
                                : "border-white/10 bg-black/40 text-muted-foreground hover:border-white/20 hover:text-foreground"
                            }`}
                          >
                            <span className="text-xs font-mono font-bold">{trigger}</span>
                            {sch && (
                              <button
                                type="button"
                                title={`Schema grafico ${trigger}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectSchematic(sch);
                                }}
                                className="text-[9px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5 mt-1 cursor-pointer"
                              >
                                <ZoomIn size={10} />
                                <span>Schema</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block">
                        Tipo di Area
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground">Struttura POI</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div
                        onClick={() => {
                          if (!confirmed) set({ area: "history", imbalance: false });
                        }}
                        className={`p-2 rounded-md border text-left transition-all cursor-pointer flex items-center justify-between gap-1 select-none ${
                          a.area === "history" || !a.area
                            ? "border-primary/60 bg-primary/15 text-primary font-semibold"
                            : "border-white/10 bg-black/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="text-xs">Storia passata</span>
                        {COCKPIT_SCHEMATICS.area_history && (
                          <button
                            type="button"
                            title="Ingrandisci schema storia passata"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectSchematic(COCKPIT_SCHEMATICS.area_history);
                            }}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ZoomIn size={12} />
                          </button>
                        )}
                      </div>

                      <div
                        onClick={() => {
                          if (!confirmed) set({ area: "virgin" });
                        }}
                        className={`p-2 rounded-md border text-left transition-all cursor-pointer flex items-center justify-between gap-1 select-none ${
                          a.area === "virgin"
                            ? "border-primary/60 bg-primary/15 text-primary font-semibold"
                            : "border-white/10 bg-black/40 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="text-xs">Area vergine</span>
                        {COCKPIT_SCHEMATICS.area_virgin && (
                          <button
                            type="button"
                            title="Ingrandisci schema area vergine"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectSchematic(COCKPIT_SCHEMATICS.area_virgin);
                            }}
                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ZoomIn size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {a.area === "virgin" && (
                    <Tick
                      label="Imbalance presente e non colmato"
                      checked={a.imbalance}
                      disabled={confirmed}
                      onChange={(imbalance) => set({ imbalance })}
                    />
                  )}

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-foreground block">
                        Target / Pool di liquidità opposto <span className="text-primary">*</span>
                      </label>
                      <span className="text-[10px] text-muted-foreground font-mono">Richiesto</span>
                    </div>
                    <input
                      className="w-full h-9 rounded-md border border-white/10 bg-black/40 px-3 text-xs text-foreground focus:border-primary/50"
                      maxLength={4000}
                      value={a.target}
                      disabled={confirmed}
                      placeholder="es. Low asiatico, High precedente, Imbalance..."
                      onChange={(e) =>
                        set({ target: e.target.value, targetConfirmed: Boolean(e.target.value.trim()) })
                      }
                    />
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {["Pool Opposto", "High Precedente", "Low Precedente", "Imbalance"].map((poolTag) => (
                        <button
                          key={poolTag}
                          type="button"
                          disabled={confirmed}
                          onClick={() => set({ target: poolTag, targetConfirmed: true })}
                          className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                            a.target === poolTag
                              ? "bg-primary/20 border-primary text-primary font-semibold"
                              : "bg-white/[0.03] border-white/10 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {poolTag}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Avviso Operativo in caso di News Imminente o Recente */}
                  {autoNewsStatus === "pre" && imminentEvent && (
                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <strong className="font-semibold text-rose-200 block">
                          News Imminente: {imminentEvent.title} ({imminentEvent.country})
                        </strong>
                        <p className="text-[11px] text-rose-300/90 leading-snug">
                          Prossimo passo: nessun nuovo ingresso 15 minuti prima e dopo l'uscita (rilascio alle {new Date(imminentEvent.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}). Attendi l'assorbimento dell'impulso.
                        </p>
                      </div>
                    </div>
                  )}

                  {autoNewsStatus === "post" && recentEvent && (
                    <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                      <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <strong className="font-semibold text-amber-200 block">
                          Fase Post-News: {recentEvent.title} ({recentEvent.country})
                        </strong>
                        <p className="text-[11px] text-amber-300/90 leading-snug">
                          Prossimo passo: volatilità in assorbimento. Attendi che la schematica {tfs[2]} si ristabilisca prima di procedere.
                        </p>
                      </div>
                    </div>
                  )}

                  {events.length > 0 && (
                    <button
                      type="button"
                      className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 pt-0.5 cursor-pointer"
                      onClick={() => setDialog("news")}
                    >
                      <Newspaper size={12} />
                      <span>Notizie del giorno ({events.length} eventi) ↗</span>
                    </button>
                  )}

                  {/* Calcolo Rischio da Architettura Patrimoniale */}
                  <div className="space-y-2.5 pt-2.5 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-mono uppercase tracking-wider text-primary font-semibold block">
                          Rischio Patrimoniale
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Capitale Trading: <strong className="text-foreground font-mono">€{tradingCapital.toLocaleString()}</strong>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-mono text-emerald-400/90 block">Consigliato Limen</span>
                        <span className="text-[11px] font-mono font-bold text-emerald-300">1.0% (€{riskStandard})</span>
                      </div>
                    </div>

                    {/* Pill di Selezione Rapida Percentuale Rischio */}
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        disabled={confirmed}
                        onClick={() => onRiskChange(String(riskConservative))}
                        className={`p-1.5 rounded-md border text-center transition-all cursor-pointer ${
                          localRisk === String(riskConservative)
                            ? "bg-primary/20 border-primary text-primary font-bold shadow-sm"
                            : "bg-white/[0.02] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                        }`}
                      >
                        <span className="text-[9px] font-mono block uppercase text-muted-foreground">0.5%</span>
                        <span className="text-[10px] font-mono font-semibold block">€{riskConservative}</span>
                      </button>

                      <button
                        type="button"
                        disabled={confirmed}
                        onClick={() => onRiskChange(String(riskStandard))}
                        className={`p-1.5 rounded-md border text-center transition-all cursor-pointer relative ${
                          localRisk === String(riskStandard)
                            ? "bg-primary/25 border-primary text-primary font-bold shadow-sm ring-1 ring-primary/40"
                            : "bg-primary/[0.04] border-primary/30 text-foreground hover:border-primary/60"
                        }`}
                      >
                        <span className="text-[9px] font-mono block uppercase text-primary/90 font-semibold">1.0% ★</span>
                        <span className="text-[10px] font-mono font-bold block">€{riskStandard}</span>
                      </button>

                      <button
                        type="button"
                        disabled={confirmed}
                        onClick={() => onRiskChange(String(riskFocus))}
                        className={`p-1.5 rounded-md border text-center transition-all cursor-pointer ${
                          localRisk === String(riskFocus)
                            ? "bg-primary/20 border-primary text-primary font-bold shadow-sm"
                            : "bg-white/[0.02] border-white/10 text-muted-foreground hover:border-white/20 hover:text-foreground"
                        }`}
                      >
                        <span className="text-[9px] font-mono block uppercase text-muted-foreground">1.5%</span>
                        <span className="text-[10px] font-mono font-semibold block">€{riskFocus}</span>
                      </button>
                    </div>

                    {/* Input Rischio Monetario Effettivo & R:R */}
                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">
                          Rischio Selezionato ({state.activeMethod?.rules.currency ?? "EUR"})
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">
                            {state.activeMethod?.rules.currency ?? "€"}
                          </span>
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            disabled={confirmed}
                            value={localRisk}
                            placeholder={String(riskStandard)}
                            onChange={(e) => onRiskChange(e.target.value)}
                            className="w-full h-8 rounded-md border border-white/10 bg-black/40 pl-7 pr-2.5 text-xs text-foreground font-mono font-semibold focus:border-primary/50"
                          />
                        </div>
                      </div>
                      <div className="pt-3">
                        {calculatedRR ? (
                          <div className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-center">
                            <span className="text-[9px] text-emerald-400/80 font-mono block">R:R Calcolato</span>
                            <strong className="text-xs font-mono font-bold text-emerald-300">1 : {calculatedRR}</strong>
                          </div>
                        ) : (
                          <div className="p-1.5 rounded-md bg-white/[0.02] border border-white/10 text-center">
                            <span className="text-[9px] text-muted-foreground font-mono block">Target Definito</span>
                            <span className="text-xs font-mono text-muted-foreground truncate block">{a.target || "In attesa"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Livelli Entry & Stop Loss (Automatici con personalizzazione facoltativa) */}
                  <div className="pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span className="text-[10px] font-mono uppercase text-muted-foreground">
                        Livelli Esecuzione (Automatici)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedLevels((prev) => !prev)}
                        className="text-[10px] font-mono text-primary/80 hover:text-primary underline cursor-pointer"
                      >
                        {showAdvancedLevels ? "Nascondi" : "Personalizza prezzi ✎"}
                      </button>
                    </div>

                    {!showAdvancedLevels ? (
                      <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono">
                        <div className="p-1.5 rounded-md bg-white/[0.02] border border-white/5">
                          <span className="text-[8px] text-muted-foreground uppercase block">Entry</span>
                          <span className="text-[10px] text-foreground font-medium">{localEntry || "A Mercato"}</span>
                        </div>
                        <div className="p-1.5 rounded-md bg-white/[0.02] border border-white/5">
                          <span className="text-[8px] text-muted-foreground uppercase block">Stop Loss</span>
                          <span className="text-[10px] text-rose-400 font-medium">{localStop || "Struttura"}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">
                            Prezzo Ingresso (facoltativo)
                          </label>
                          <input
                            type="text"
                            disabled={confirmed}
                            value={localEntry}
                            placeholder="A mercato"
                            onChange={(e) => onEntryChange(e.target.value)}
                            className="w-full h-8 rounded-md border border-white/10 bg-black/40 px-2.5 text-xs text-foreground focus:border-primary/50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-muted-foreground block mb-0.5">
                            Stop Loss (facoltativo)
                          </label>
                          <input
                            type="text"
                            disabled={confirmed}
                            value={localStop}
                            placeholder="Struttura"
                            onChange={(e) => onStopChange(e.target.value)}
                            className="w-full h-8 rounded-md border border-white/10 bg-black/40 px-2.5 text-xs text-foreground focus:border-primary/50"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Finestra Speciale (Lunch / Intervallo / Asia) */}
                  {(win.kind === "lunch" || win.kind === "analysis") && (
                    <Tick
                      label="Impulso già avviato / Ingresso in finestra verificato"
                      checked={a.impulseStarted}
                      disabled={confirmed}
                      onChange={(impulseStarted) => set({ impulseStarted })}
                    />
                  )}
                  {win.kind === "asia" && (
                    <Tick
                      label="Condizioni Asia confermate (01:00–03:30 CET e liquidità verificata)"
                      checked={a.asiaConfirmed}
                      disabled={confirmed}
                      onChange={(asiaConfirmed) => set({ asiaConfirmed })}
                    />
                  )}

                  {Boolean(step3Error || error) && (
                    <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                      <strong className="block font-semibold">Attenzione:</strong>
                      <p>{step3Error || (error instanceof Error ? error.message : String(error))}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    className="ck-primary w-full mt-3.5 cursor-pointer shadow-lg hover:shadow-primary/20 transition-all font-semibold"
                    disabled={busy}
                    onClick={() => handleSealTrade("trade")}
                  >
                    {busy ? (
                      <span className="flex items-center gap-2">
                        <Loader2 size={15} className="animate-spin" />
                        <span>Sigillo in corso...</span>
                      </span>
                    ) : (
                      <>
                        <span>Conferma Piano & Sigilla Ingresso →</span>
                        <ArrowUpRight size={15} />
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground py-1 text-center w-full transition-colors flex items-center justify-center gap-1 cursor-pointer mt-0.5"
                    onClick={() => handleSealTrade("wait")}
                  >
                    <span>Oggi attendo · Nessun setup a mercato</span>
                  </button>
                </div>
              </>
            )}

            {(phase === 4 || confirmed) && (
              <>
                <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div>
                    <span className="font-mono text-[10px] text-primary uppercase tracking-wider block">
                      Step 04 / 04
                    </span>
                    <h2 className="text-sm font-semibold text-foreground">
                      Gestione & Mantenimento Trade
                    </h2>
                  </div>
                </div>

                {/* Scheda Riepilogo Integrale Scelte dei Passaggi Precedenti */}
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {a.market}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          a.cycle === "down" || a.cycle === "end_down"
                            ? "text-rose-400 bg-rose-500/15 border border-rose-500/30"
                            : "text-emerald-400 bg-emerald-500/15 border border-emerald-500/30"
                        }`}
                      >
                        {a.scenario ? (a.cycle === "down" || a.cycle === "end_down" ? "SHORT" : "LONG") : "POSIZIONE"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setReviewPhase(1);
                        set({ phase: 1 });
                        setChartTF(a.mode === "scalp" ? "60" : "240");
                      }}
                      className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1 cursor-pointer bg-primary/10 px-2 py-0.5 rounded border border-primary/20"
                      title="Torna agli step precedenti per cambiare o ripensare l'analisi"
                    >
                      <span>← Ripensa Analisi</span>
                    </button>
                  </div>

                  {/* 3 Fasi Dettagliate */}
                  <div className="space-y-2 text-xs">
                    {/* Fase 1: Contesto */}
                    <div className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-mono text-muted-foreground uppercase block">
                          01 · Contesto [{tfs[0]}]
                        </span>
                        <strong className="text-foreground text-[11px]">
                          {a.cycle ? (a.cycle === "up" ? "Ciclo Rialzista" : a.cycle === "down" ? "Ciclo Ribassista" : a.cycle === "end_up" ? "Fine Rialzo" : "Fine Ribasso") : "Neutro"}
                          {a.context ? (a.context === "swept" ? " · Liq Cacciata" : a.context === "compression" ? " · Compressione" : ` · ${a.context}`) : ""}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setReviewPhase(1); set({ phase: 1 }); setChartTF(a.mode === "scalp" ? "60" : "240"); }}
                        className="text-[10px] text-muted-foreground hover:text-foreground font-mono underline cursor-pointer"
                      >
                        Modifica
                      </button>
                    </div>

                    {/* Fase 2: Svolta */}
                    <div className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-mono text-muted-foreground uppercase block">
                          02 · Svolta [{tfs[1]}]
                        </span>
                        <strong className="text-foreground text-[11px] truncate block max-w-[200px]">
                          {a.scenario || "Reazione Livello Chiave"}
                          {a.area ? ` (${a.area})` : ""}
                        </strong>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setReviewPhase(2); set({ phase: 2 }); setChartTF("15"); }}
                        className="text-[10px] text-muted-foreground hover:text-foreground font-mono underline cursor-pointer"
                      >
                        Modifica
                      </button>
                    </div>

                    {/* Fase 3: Esecuzione */}
                    <div className="p-2 rounded-lg bg-black/40 border border-white/5 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase shrink-0">
                          03 · Esecuzione [{tfs[2]}]
                        </span>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-mono font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 whitespace-nowrap shrink-0">
                            {a.trigger || state.session?.plan?.setup?.split("·")[1]?.trim() || "JTC"}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setReviewPhase(3); set({ phase: 3 }); setChartTF(a.execTF === "M5" ? "5" : "1"); }}
                            className="text-[10px] text-muted-foreground hover:text-foreground font-mono underline cursor-pointer shrink-0"
                          >
                            Modifica
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 pt-1 text-center font-mono">
                        <div className="bg-white/[0.02] p-1 rounded border border-white/5">
                          <span className="text-[8px] text-muted-foreground uppercase block">Entry</span>
                          <span className="text-[10px] text-foreground font-bold">{state.session?.plan?.entry || value?.entry || localEntry || "A Mercato"}</span>
                        </div>
                        <div className="bg-white/[0.02] p-1 rounded border border-white/5">
                          <span className="text-[8px] text-muted-foreground uppercase block">Stop</span>
                          <span className="text-[10px] text-rose-400 font-bold">{state.session?.plan?.stop || value?.stop || localStop || "Struttura"}</span>
                        </div>
                        <div className="bg-white/[0.02] p-1 rounded border border-white/5">
                          <span className="text-[8px] text-muted-foreground uppercase block">Target</span>
                          <span className="text-[10px] text-emerald-400 font-bold truncate block">{state.session?.plan?.guidance?.cockpit?.target || a.target || "Pool"}</span>
                        </div>
                        <div className="bg-white/[0.02] p-1 rounded border border-white/5">
                          <span className="text-[8px] text-muted-foreground uppercase block">Rischio</span>
                          <span className="text-[10px] text-amber-400 font-bold">{state.activeMethod?.rules.currency ?? "€"}{state.session?.plan?.initialRisk || value?.risk || localRisk || String(riskStandard || "80")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Protocollo di Mantenimento Attivo */}
                <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-3 space-y-2.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold block">
                    Mantenimento & Gestione Attiva
                  </span>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={mgmtChecks.be}
                          onChange={(e) => updateMgmtCheck("be", e.target.checked)}
                          className="rounded border-white/20 bg-black/40 text-primary focus:ring-primary h-3.5 w-3.5 mt-0.5"
                        />
                        <span><strong>Stop a Pareggio (BE):</strong> Almeno su 1 : 1.5 R:R su presa di liquidità</span>
                      </label>
                      {COCKPIT_SCHEMATICS.mgmt_be && (
                        <button
                          type="button"
                          title="Vedi schema BE"
                          onClick={() => setInspectSchematic(COCKPIT_SCHEMATICS.mgmt_be)}
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                        >
                          <ZoomIn size={12} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={mgmtChecks.tp1}
                          onChange={(e) => updateMgmtCheck("tp1", e.target.checked)}
                          className="rounded border-white/20 bg-black/40 text-primary focus:ring-primary h-3.5 w-3.5 mt-0.5"
                        />
                        <span><strong>Presa Parziale (TP1):</strong> Se preso su 1 : 3 R:R, altrimenti dritto alla liquidità</span>
                      </label>
                      {COCKPIT_SCHEMATICS.mgmt_tp1 && (
                        <button
                          type="button"
                          title="Vedi regola TP1 e Liquidità"
                          onClick={() => setInspectSchematic(COCKPIT_SCHEMATICS.mgmt_tp1)}
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                        >
                          <ZoomIn size={12} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={mgmtChecks.congestion}
                          onChange={(e) => updateMgmtCheck("congestion", e.target.checked)}
                          className="rounded border-white/20 bg-black/40 text-primary focus:ring-primary h-3.5 w-3.5 mt-0.5"
                        />
                        <span><strong>Gestione Congestione:</strong> Rischio dimezzato su accumulo anomalo</span>
                      </label>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={mgmtChecks.invalidation}
                          onChange={(e) => updateMgmtCheck("invalidation", e.target.checked)}
                          className="rounded border-white/20 bg-black/40 text-primary focus:ring-primary h-3.5 w-3.5 mt-0.5"
                        />
                        <span><strong>Invalidazione Rispettata:</strong> Chiusura se la schematica fallisce</span>
                      </label>
                      {COCKPIT_SCHEMATICS.mgmt_invalidation && (
                        <button
                          type="button"
                          title="Vedi regola invalidazione"
                          onClick={() => setInspectSchematic(COCKPIT_SCHEMATICS.mgmt_invalidation)}
                          className="text-muted-foreground hover:text-primary transition-colors p-1"
                        >
                          <ZoomIn size={12} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="pt-1">
                    <textarea
                      value={mgmtNote}
                      onChange={(e) => updateMgmtNote(e.target.value)}
                      placeholder="Note di gestione live / diario emotivo..."
                      className="w-full h-12 rounded-lg border border-white/10 bg-black/40 p-2 text-xs text-foreground focus:border-primary/50 resize-none"
                    />
                  </div>
                </div>

                {/* Banner Distacco Operativo · Camera di Decompressione */}
                <div className="p-3 rounded-xl bg-gradient-to-r from-[#C5A059]/15 via-[#0d0f14] to-[#0d0f14] border border-[#C5A059]/35 shadow-md flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#E8C56A]">
                      <Gamepad2 size={14} />
                      <span className="whitespace-nowrap">Distacco Operativo (3D)</span>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-wider whitespace-nowrap">
                      Mani dal Book
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Il trade è a mercato. Evita l'iper-monitoraggio delle oscillazioni per non cadere nella Deriva.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDecompressionModalOpen(true)}
                    className="w-full py-2 px-3 rounded-lg bg-[#C5A059]/20 hover:bg-[#C5A059]/35 border border-[#C5A059]/50 text-[#E8C56A] font-mono font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <Play size={13} fill="currentColor" />
                    <span>Entra nella Camera di Decompressione</span>
                  </button>
                </div>

                {/* Azione Principale: Registra Trade nel Diario */}
                <button
                  type="button"
                  onClick={() => setTradeRegisterModalOpen(true)}
                  className="w-full justify-center py-3 px-4 rounded-xl cursor-pointer shadow-lg bg-[#C5A059] hover:bg-[#d8b167] text-black font-bold text-xs flex items-center gap-2 transition-all hover:scale-[1.01]"
                >
                  <CheckCircle2 size={16} />
                  <span>Registra Trade nel Diario</span>
                </button>

                {/* Azione Secondaria: Archivia e Torna a Step 01 (Reset) */}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Vuoi archiviare l'operatività corrente su questo mercato e iniziare una nuova analisi dallo Step 01?")) {
                      executeTradeReset(false);
                    }
                  }}
                  className="w-full justify-center py-2 px-3 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5 text-muted-foreground hover:text-foreground text-[11px] font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Archivia l'operatività corrente e riparti dallo Step 01 senza compilare il diario"
                >
                  <RotateCcw size={13} />
                  <span>Archivia Trade & Torna a Step 01</span>
                </button>
              </>
            )}
          </div>

          {/* Dottrina Operativa Dinamica: riempie lo spazio con regole di fase senza vuoti antiestetici */}
          <CockpitPhaseDoctrineCard phase={phase} tfs={tfs} />

          {!confirmed && improvement && (
            <div className="ck-notice mt-3">
              <strong>{ck("cockpit.ui.ccc7bf41dd")}</strong>
              <p>{improvement.action}</p>
              {improvement.criterion && (
                <small>
                  {ck("cockpit.ui.fe164eea5b")} {improvement.criterion}
                </small>
              )}
            </div>
          )}

          {oldSession && (
            <div className="ck-notice mt-3">
              {ck("cockpit.ui.630600b4d9")}
              <Link href="/?process=legacy">
                {ck("cockpit.ui.f8de5118a8")}
                <ArrowUpRight size={13} />
              </Link>
            </div>
          )}

        </aside>
        )}

        {/* COLONNA 2 (CENTRO/DESTRA): GRAFICO DOMINANTE E ACTION BAR */}
        <section className="ck-chart-area" aria-label={ck("cockpit.ui.31175df55f")}>
          {/* Area Grafico: Motore Proprietario LIMEN (Lightweight Charts v5 + TV Real-Time Feed + Overlay FX Replay) */}
          <div className="ck-chart">
            <LimenProprietaryChart
              symbol={a.market}
              interval={chartTF}
              onSymbolChange={(sym) => set({ market: sym })}
              onIntervalChange={(tf) => setChartTF(tf)}
              leftCollapsed={leftCollapsed && !isFreeTrial}
              onToggleLeft={toggleLeft}
              biasScore={score}
              onOpenContext={() => setDialog("context")}
              macroText={macroText}
              macroStatus={autoNewsStatus}
              onOpenNews={() => setDialog("news")}
              onOpenFavorites={() => setDialog("favorite_tools")}
              isFullscreen={focusMode}
              onToggleFullscreen={() => {
                toggleFocus();
                setMobileTab("chart");
              }}
              aiSetup={aiSetup}
              onUpdateAiSetup={updateAiSetup}
              onAdoptAiSetup={() => aiSetup && handleAdoptAiSetup(aiSetup, aiAnalysis?.checklistAudit.ltfTrigger.triggerType)}
              showAiOverlay={showAiOverlay}
              onToggleAiOverlay={() => setShowAiOverlay((prev) => !prev)}
              isAiScanning={isAiScanning}
              onScanAi={() => void handleScanVarcoAi(false)}
              onCandlesUpdate={(candles) => {
                chartCandlesRef.current = candles;
                const lastBar = candles[candles.length - 1];
                if (continuousAutoScan && lastBar && lastLiveBarTimeRef.current !== lastBar.time) {
                  lastLiveBarTimeRef.current = lastBar.time;
                  if (liveDebounceRef.current) clearTimeout(liveDebounceRef.current);
                  liveDebounceRef.current = setTimeout(() => {
                    void handleScanVarcoAi(true);
                  }, 250);
                }
              }}
              chartCanvasRef={chartCanvasRef}
              onTradePlanned={(trade) => {
                toast({
                  title: `Trade Proiettato (${trade.direction.toUpperCase()})`,
                  description: `Entry: ${trade.entryPrice} · SL: ${trade.stopLoss} · TP: ${trade.takeProfit} · R:R: 1:${trade.riskReward}`,
                });
              }}
            />
          </div>

          {/* Bottom Action Dock (Sotto il grafico) */}
          <div className="ck-chart-dock">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-1">
              {/* 1. Piano Operativo */}
              <button
                type="button"
                className={`ck-dock-btn ${activePlanSummary.hasPlan ? "border-primary/50 bg-primary/10 text-foreground font-semibold" : ""}`}
                onClick={() => setDialog("operative_plan")}
                title="Pianificazione operativa pre-market, livelli chiave, R:R e screenshot grafici allegati"
              >
                <Crosshair size={13} className="text-[#C5A059] shrink-0" />
                <span>Piano Operativo</span>
                {activePlanSummary.hasPlan ? (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                      activePlanSummary.bias === "short"
                        ? "text-rose-400 bg-rose-500/15 border border-rose-500/30"
                        : activePlanSummary.bias === "long"
                          ? "text-emerald-400 bg-emerald-500/15 border border-emerald-500/30"
                          : "text-amber-400 bg-amber-500/15 border border-amber-500/30"
                    }`}
                  >
                    {activePlanSummary.bias === "short" ? "SHORT" : activePlanSummary.bias === "long" ? "LONG" : "WAIT"}
                    {activePlanSummary.rr ? ` ${activePlanSummary.rr}` : ""}
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-muted-foreground/50 ml-0.5">○ Vuoto</span>
                )}
              </button>

              {/* 2. Prossima Sessione */}
              <button
                type="button"
                className="ck-dock-btn"
                onClick={() => setDialog("next_session_plan")}
                title="Appunti per la prossima sessione con notifica attiva all'apertura"
              >
                <Clock size={13} className="text-[#C5A059] shrink-0" />
                <span>Prossima Sessione</span>
                {plansCount > 0 ? (
                  <span className="ml-1 px-1.5 py-0.2 bg-primary/20 text-primary text-[10px] font-mono rounded-full border border-primary/30 font-bold">
                    {plansCount}
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-muted-foreground/50 ml-0.5">0</span>
                )}
              </button>

              {/* 3. I Miei Esempi */}
              <button
                type="button"
                className="ck-dock-btn"
                onClick={() => setDialog("user_playbook")}
                title="I tuoi setup personalizzati, regole inviolabili e schemi per schiarirti la mente"
              >
                <Bookmark size={13} className="text-[#C5A059] shrink-0" />
                <span>I Miei Esempi</span>
                <span className="ml-1 px-1.5 py-0.2 bg-white/10 text-muted-foreground text-[10px] font-mono rounded-full border border-white/10">
                  {playbookCount}
                </span>
              </button>
            </div>

            {/* 4. REGISTRA TRADE · IL LIBRO DELLA VERITÀ */}
            <button
              type="button"
              className="ck-dock-cta cursor-pointer flex items-center gap-2 group"
              onClick={() => setTradeRegisterModalOpen(true)}
              title="Registra il trade eseguito nel Libro della Verità con schematica, metriche e screenshot"
            >
              <BookOpen size={15} className="group-hover:scale-110 transition-transform" />
              <span className="font-bold tracking-wide">REGISTRA TRADE · IL LIBRO DELLA VERITÀ</span>
              {activePlanSummary.hasPlan && (
                <span className="hidden xl:inline-flex items-center gap-1 ml-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary text-black font-extrabold uppercase shadow-sm">
                  <Zap size={10} className="inline" /> Pre-compilato
                </span>
              )}
            </button>
          </div>
        </section>
      </div>

      {/* ── MODALS / DRAWERS ── */}
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className={`ck-dialog ${dialog === "operative_plan" || dialog === "user_playbook" ? "ck-dialog-plan-modal max-w-5xl md:max-w-6xl w-[96vw]" : "max-w-4xl"} max-h-[88vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle>
              {dialog === "protection"
                ? ck("cockpit.ui.dialog.protection")
                : dialog === "context"
                  ? `Sintesi Quantitativa & Catalizzatori · ${a.market}`
                  : dialog === "news"
                    ? `Calendario Economico & Catalizzatori Macro`
                    : dialog === "user_playbook"
                      ? `I Miei Esempi Operativi · LIMEN Playbook`
                      : dialog === "operative_plan"
                        ? `Piano Operativo di Sessione · ${a.market}`
                        : dialog === "favorite_tools"
                          ? `Strumenti Grafico Rapidi & Calcolatore Rischio`
                          : dialog === "examples"
                            ? `Playbook Setup Istituzionali`
                            : dialog === "next_session_plan"
                              ? `Pianificatore Prossima Sessione · Mission Planner`
                              : dialog === "chart_prefs"
                                ? `Strumenti & Preferenze Grafico TradingView`
                                : dialog === "notes"
                                  ? ck("cockpit.ui.dialog.notes")
                                  : dialog === "confirm"
                                    ? "Sigillo del Trade & Inizio Gestione · LIMEN PROTOCOL"
                                    : dialog === "protocol"
                                      ? "Protocollo Operativo & Regole Inviolabili"
                                      : ck("cockpit.ui.dialog.default")}
            </DialogTitle>
          </DialogHeader>

          {dialog === "protection" && (
            <>
              <Protection
                state={state}
                market={a.market}
                onDone={() => {
                  setDialog(null);
                  void query.refetch();
                }}
              />
              <div className="flex flex-wrap gap-2 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                <Link href="/backtest" className="hover:text-primary transition-colors">La Forgia del Passato</Link>
                <span>·</span>
                <Link href="/settings" className="hover:text-primary transition-colors">{ck("cockpit.ui.6d160e16ca")}</Link>
                <span>·</span>
                <Link href="/chat?t=social" className="hover:text-primary transition-colors">{ck("cockpit.ui.aacb0e2513")}</Link>
              </div>
            </>
          )}

          {dialog === "context" && (
            <div className="space-y-6">
              {/* Factor Breakdown cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/10">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">1. Prezzo / Trend</span>
                  <strong className="block text-sm font-semibold mt-1 text-foreground">
                    {market.data?.components?.find((c) => c.id === "price")?.score ?? "+8"}
                  </strong>
                  <small className="text-[10px] text-muted-foreground">Struttura & EMA</small>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/10">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">2. Macro & News</span>
                  <strong className="block text-sm font-semibold mt-1 text-foreground">
                    {market.data?.components?.find((c) => c.id === "news")?.score ?? "+5"}
                  </strong>
                  <small className="text-[10px] text-muted-foreground">{events.length} eventi alto impatto</small>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/10">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">3. Retail Sentiment</span>
                  <strong className="block text-sm font-semibold mt-1 text-foreground">
                    +3
                  </strong>
                  <small className="text-[10px] text-muted-foreground">Contrarian signal</small>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.02] border border-white/10">
                  <span className="text-[10px] font-mono text-muted-foreground uppercase">4. COT Report</span>
                  <strong className="block text-sm font-semibold mt-1 text-foreground">
                    {cotFormatted}
                  </strong>
                  <small className="text-[10px] text-muted-foreground">Non-Commercial Net</small>
                </div>
              </div>

              {/* Price History & Market Depth */}
              <PriceHistory data={market.data} />
              <ContextMarketDetail data={market.data} />

              {/* Preparation Tool Links */}
              <nav className="ck-tool-links" aria-label="Strumenti di Contesto">
                {PREPARATION_TOOLS.map((tool) => (
                  <Link
                    key={tool.id}
                    href={processToolHref(tool.href, {
                      pair: a.market,
                      methodVersionId: state.activeMethod?.id,
                      fromProcess: true,
                    })}
                  >
                    {t(tool.labelKey)} ↗
                  </Link>
                ))}
              </nav>
            </div>
          )}

          {dialog === "notes" && (
            <label className="ck-field">
              {ck("cockpit.ui.b921e781a4")}
              <textarea
                rows={8}
                maxLength={4000}
                value={a.notes}
                disabled={confirmed}
                onChange={(e) => set({ notes: e.target.value })}
              />
              <small>
                {value
                  ? ck("cockpit.ui.notes.saved_draft")
                  : ck("cockpit.ui.notes.confirm_protection")}
              </small>
            </label>
          )}

          {dialog === "protocol" && (
            <div className="ck-protocol space-y-4">
              <div className="border-b border-border/50 pb-2">
                <h3 className="text-base font-semibold text-foreground">Regole del Protocollo Operativo</h3>
                <p className="text-xs text-muted-foreground">I pilastri inviolabili per la protezione del capitale</p>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {PROTOCOL_CHECKS.map((check, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check size={16} className="text-primary mt-0.5 shrink-0" />
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                Nessun ingresso viene eseguito senza previa definizione del pool di liquidità opposto e calcolo del rischio massimo per trade.
              </p>
              <Link href="/protocollo" className="text-primary text-xs font-semibold hover:underline inline-block">
                Consulta il Protocollo Completo ↗
              </Link>
            </div>
          )}

          {dialog === "news" && (
            <CockpitNewsDialog
              market={a.market}
              fallbackEvents={market.data?.events}
            />
          )}

          {dialog === "examples" && (
            <CockpitExamplesDialog
              initialCategory={exampleCategory ?? undefined}
              currentMarket={a.market}
            />
          )}

          {dialog === "operative_plan" && (
            <CockpitOperativePlanDialog
              key={a.market}
              market={a.market}
              timeframe={chartTF}
              cockpitEntry={localEntry}
              cockpitStop={localStop}
              cockpitRisk={localRisk}
              cockpitBias={a.cycle === "up" ? "long" : a.cycle === "down" ? "short" : "wait"}
              onPlanSaved={() => {
                refreshDockState();
              }}
              onOpenJournal={() => {
                setDialog(null);
                setJournalModalOpen(true);
              }}
            />
          )}

          {dialog === "user_playbook" && (
            <CockpitUserPlaybookDialog
              currentMarket={a.market}
              onOpenOperativePlan={() => setDialog("operative_plan")}
            />
          )}

          {dialog === "favorite_tools" && (
            <CockpitFavoriteTools
              market={a.market}
              onReloadChart={() => setChartKey((k) => k + 1)}
              onOpenPlan={() => setDialog("operative_plan")}
              onOpenJournal={() => setJournalModalOpen(true)}
            />
          )}

          {dialog === "next_session_plan" && (
            <CockpitNextSessionPlanner
              currentMarket={a.market}
              currentTimeframe={chartTF}
              onPlanSaved={() => {
                updatePlansCount();
                refreshDockState();
              }}
            />
          )}

          {dialog === "chart_prefs" && (
            <CockpitChartPrefsDialog
              currentPrefs={chartPrefs}
              onSavePrefs={(newPrefs) => setChartPrefs(newPrefs)}
              onReloadChart={() => setChartKey((k) => k + 1)}
            />
          )}

          {dialog === "confirm" && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-primary uppercase block">
                      Riepilogo Ingresso Operativo · {a.market}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {a.mode === "scalp" ? "Duello · Scalp (M1)" : "Assedio · Swing (M5)"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                    Trigger: {a.trigger || "TEST"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-2 rounded bg-black/40 border border-white/5">
                    <span className="text-[9px] font-mono text-muted-foreground uppercase block">Scenario & Zona</span>
                    <strong className="text-foreground font-mono">{a.scenario || "Zona Valida"}</strong>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/5">
                    <span className="text-[9px] font-mono text-muted-foreground uppercase block">Target / Pool Opposto</span>
                    <strong className="text-emerald-400 font-mono truncate block">{a.target || "Pool opposto"}</strong>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/5">
                    <span className="text-[9px] font-mono text-muted-foreground uppercase block">Prezzo Ingresso</span>
                    <strong className="text-foreground font-mono">{localEntry || value?.entry || "A Mercato"}</strong>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-white/5">
                    <span className="text-[9px] font-mono text-muted-foreground uppercase block">Stop Loss</span>
                    <strong className="text-rose-400 font-mono">{localStop || value?.stop || "Struttura"}</strong>
                  </div>
                </div>

                {calculatedRR && (
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-mono text-[11px]">Rapporto Rischio / Rendimento (R:R)</span>
                    <strong className="text-emerald-300 font-mono font-bold">1 : {calculatedRR}</strong>
                  </div>
                )}
              </div>

              {step3Error && (
                <div className="p-2.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                  {step3Error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setDialog(null)}
                  className="px-3.5 py-2 text-xs rounded-lg border border-white/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Modifica Parametri
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    handleSealTrade("trade");
                    setDialog(null);
                  }}
                  className="ck-primary px-5 py-2 text-xs font-semibold cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  {busy ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Sigillo in corso...</span>
                    </span>
                  ) : (
                    <>
                      <span>Sigilla ed Entra in Gestione →</span>
                      <ArrowUpRight size={14} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MODALE LIBRO DELLA VERITÀ (IN-PLACE SENZA LASCIARE IL GRAFICO) ── */}
      <JournalEntryModal
        isOpen={journalModalOpen}
        onClose={() => setJournalModalOpen(false)}
        initialPair={a.market}
        processSessionId={state.session?.id}
        methodVersionId={state.session?.methodVersionId}
      />

      {/* ── MODALE REGISTRAZIONE TRADE SEMPLIFICATA & PRECOMPILATA ── */}
      <CockpitTradeRegisterModal
        isOpen={tradeRegisterModalOpen}
        onClose={() => setTradeRegisterModalOpen(false)}
        market={a.market}
        bias={a.cycle === "down" || a.cycle === "end_down" ? "short" : "long"}
        scenario={a.scenario || state.session?.plan?.setup?.split("·")[0]?.trim() || "Setup Istituzionale"}
        trigger={a.trigger || state.session?.plan?.setup?.split("·")[1]?.trim() || "JTC"}
        entryPrice={state.session?.plan?.entry || value?.entry || localEntry}
        stopLoss={state.session?.plan?.stop || value?.stop || localStop}
        target={state.session?.plan?.guidance?.cockpit?.target || a.target}
        initialRisk={String(state.session?.plan?.initialRisk || value?.risk || localRisk || String(riskStandard || "80"))}
        currency={state.activeMethod?.rules.currency ?? "€"}
        notes={mgmtNote}
        timeframeSnapshots={timeframeSnapshots}
        onAddSnapshotImage={(snapshotId, imageDataUrl) => {
          setTimeframeSnapshots((prev) => {
            const next = prev.map((s) => (s.id === snapshotId ? { ...s, imageDataUrl: imageDataUrl || undefined } : s));
            try {
              localStorage.setItem(`tl_cockpit_tf_snapshots_${a.market}`, JSON.stringify(next));
            } catch {
              // ignore
            }
            return next;
          });
        }}
        processSessionId={state.session?.id}
        methodVersionId={state.session?.methodVersionId}
        onSuccess={() => {
          executeTradeReset(true);
          toast({
            title: "Trade Archiviato nel Diario!",
            description: `${a.market} registrato nel Libro della Verità. Cockpit pronto per la prossima operazione.`,
          });
        }}
      />

      {/* ── MODALE INGRANDIMENTO SCHEMI GRAFICI (LIGHTBOX HD) ── */}
      <CockpitSchematicLightbox
        schematic={inspectSchematic}
        isOpen={Boolean(inspectSchematic)}
        onClose={() => setInspectSchematic(null)}
      />

      {/* ── CAMERA DI DECOMPRESSIONE (GIOCO 3D & DISTACCO OPERATIVO) ── */}
      <DecompressionChamberModal
        open={decompressionModalOpen}
        onOpenChange={setDecompressionModalOpen}
        activeTradeContext={{
          symbol: a.market,
          direction: a.mode,
        }}
      />
    </main>
  );
}
