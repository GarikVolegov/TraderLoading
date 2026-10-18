import { BrandMark } from "@/components/BrandMark";
import { useCockpitCopy } from "@/hooks/useCockpitCopy";
import { useCallback, useEffect, useState, type ReactNode, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  FlaskConical,
  Focus,
  Layers,
  Maximize2,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTraderProcess, useProcessMutation } from "@/hooks/useTraderProcess";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import {
  createProcessMethod,
  type CheckInDraft,
  type ProcessMethod,
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
import { SessionPairContext } from "@/components/process/SessionPairContext";
import { SessionDraftStatus } from "@/components/process/SessionDraftStatus";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dailyProcessRisk } from "@/lib/processGuidance";
import { cockpitImprovement } from "@/lib/cockpitPresentation";
import { PREPARATION_TOOLS } from "@/lib/workspaceTools";
import { processToolHref } from "@/lib/processToolNavigation";
import { useLanguage } from "@/contexts/LanguageContext";
import "./TradingCockpit.css";

const MARKETS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "NAS100", "SPX500", "BTCUSD", "ETHUSD"];
const CYCLES = [
  ["up", "Impulso / ciclo rialzista"],
  ["down", "Impulso / ciclo ribassista"],
  ["end_up", "Fine ciclo rialzista"],
  ["end_down", "Fine ciclo ribassista"],
] as const;
const SCENARIOS = [
  [
    "valid_zone",
    "Zona HTF toccata e mitigata",
    "Cerco un’inversione solo dopo una nuova schematica ITF.",
  ],
  ["no_zone", "Solo liquidità", "Nessuna zona HTF: solo continuazione, BTI o JTC."],
  [
    "reaccum",
    "Re-accumuli / ri-distribuzioni",
    "Box intermedi: esclusivamente JTC verso la zona opposta.",
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
function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <p className="ck-error" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}
function Choice({
  checked,
  children,
  onClick,
  disabled = false,
}: {
  checked: boolean;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="ck-choice"
      aria-pressed={checked}
      onClick={onClick}
      disabled={disabled}
    >
      <span>{children}</span>
      <span className="ck-choice-mark" aria-hidden>
        {checked ? <Check size={14} /> : null}
      </span>
    </button>
  );
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
function CockpitReview({ state }: { state: ProcessState }) {
  const ck = useCockpitCopy();
  const session = state.session!;
  if (session.state === "closed")
    return (
      <div className="ck-notice">
        <strong>{ck("cockpit.ui.ef01cdeec2")}</strong>
        <p>
          {session.closure?.correction ||
            session.closure?.notes ||
            "La revisione è disponibile nella scheda della sessione."}
        </p>
        <Link href={`/journal?t=sessioni&session=${encodeURIComponent(session.id)}`}>
          {ck("cockpit.ui.35f130cd71")}
        </Link>
      </div>
    );
  return <CockpitReviewForm state={state} />;
}
function CockpitReviewForm({ state }: { state: ProcessState }) {
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
        {ck("cockpit.ui.a495e45348")}
        <select
          aria-label={ck("cockpit.ui.a495e45348")}
          required
          value={v.outcome}
          onChange={(e) =>
            draft.setValue((p) => ({ ...p, outcome: e.target.value as typeof v.outcome }))
          }
        >
          <option value="" disabled>
            {ck("cockpit.ui.8c27224586")}
          </option>
          <option value="confirmed">{ck("cockpit.ui.7623ab5ec6")}</option>
          <option value="partial">{ck("cockpit.ui.f9845edc02")}</option>
          <option value="invalidated">{ck("cockpit.ui.1b0ff4c56b")}</option>
          <option value="unassessable">{ck("cockpit.ui.a5aa590d59")}</option>
        </select>
      </label>
      <label>
        {ck("cockpit.ui.8331b7a5f9")}
        <select
          aria-label={ck("cockpit.ui.8331b7a5f9")}
          required
          value={v.assessment}
          onChange={(e) =>
            draft.setValue((p) => ({ ...p, assessment: e.target.value as typeof v.assessment }))
          }
        >
          <option value="" disabled>
            {ck("cockpit.ui.ef6f7d97ee")}
          </option>
          <option value="conforming">{ck("cockpit.ui.637d8e1d12")}</option>
          <option value="deviation">{ck("cockpit.ui.3b26a891cd")}</option>
          <option value="unknown">{ck("cockpit.ui.527f38b844")}</option>
        </select>
      </label>
      {v.assessment === "deviation" && (
        <label>
          {ck("cockpit.ui.558085a990")}
          <textarea
            required
            maxLength={4000}
            value={v.violations}
            onChange={(e) => draft.setValue((p) => ({ ...p, violations: e.target.value }))}
          />
        </label>
      )}
      <label>
        {ck("cockpit.ui.5b8e2e15b6")}
        <textarea
          maxLength={4000}
          value={v.correction}
          onChange={(e) => draft.setValue((p) => ({ ...p, correction: e.target.value }))}
        />
      </label>
      <Tick
        label={ck("cockpit.ui.f923bc6faf")}
        checked={v.reconciled}
        onChange={(reconciled) => draft.setValue((p) => ({ ...p, reconciled }))}
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
function initialDraft(method: ProcessMethod): CheckInDraft {
  return {
    stage: "check_in",
    checklist: method.rules.checklist.map(() => false),
    mood: "",
    focus: "",
    decision: "",
    market: method.rules.markets[0] ?? "XAUUSD",
    entry: "",
    stop: "",
    risk: "",
    reason: "",
    reasonCode: "",
    expectation: "",
    invalidation: "",
    response: "",
    cockpit: freshCockpit(method.rules.markets[0] ?? "XAUUSD"),
  };
}
function PersistedCockpit({ state, seed }: { state: ProcessState; seed: CockpitAnalysis }) {
  if (state.session?.preparedAt)
    return (
      <CockpitView
        state={state}
        analysis={state.session.plan?.guidance?.cockpit ?? freshCockpit(state.session.plan?.market)}
        onAnalysis={() => undefined}
        confirmed
      />
    );
  return <DraftCockpit state={state} seed={seed} />;
}
function DraftCockpit({ state, seed }: { state: ProcessState; seed: CockpitAnalysis }) {
  const method = state.activeMethod!;
  const session = state.session;
  const confirmed = Boolean(session?.preparedAt);
  const draft = useSessionDraft<CheckInDraft>(session, initialDraft(method), method.id);
  const setDraftValue = draft.setValue;
  useEffect(() => {
    if (!session && seed.cycle)
      setDraftValue((v) => ({ ...v, market: seed.market, cockpit: seed }));
  }, [session, seed, setDraftValue]);
  const value = draft.value;
  const analysis = confirmed
    ? (session?.plan?.guidance?.cockpit ?? freshCockpit(session?.plan?.market))
    : (value.cockpit ?? freshCockpit(value.market));
  const setAnalysis = useCallback(
    (next: CockpitAnalysis) => setDraftValue((v) => ({ ...v, market: next.market, cockpit: next })),
    [setDraftValue],
  );
  const save = useProcessMutation(async (decision: "trade" | "wait") =>
    draft.confirm((v, expectedRevision) => {
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
              initialRisk: Number(v.risk),
              invalidation: guidance.invalidation,
              guidance,
            };
      return {
        action: "check_in",
        expectedRevision,
        preparation: { checklist: v.checklist, mood: v.mood, focus: v.focus },
        plan,
      };
    }),
  );
  return (
    <CockpitView
      state={state}
      analysis={analysis}
      onAnalysis={setAnalysis}
      value={value}
      change={(patch) => draft.setValue((v) => ({ ...v, ...patch }))}
      confirmed={confirmed}
      onConfirm={(decision) => save.mutate(decision)}
      busy={save.isPending || draft.status === "conflict"}
      error={save.error}
      status={<SessionDraftStatus {...draft} retry={draft.flush} />}
      flush={draft.flush}
    />
  );
}
export default function TradingCockpit() {
  const ck = useCockpitCopy();
  const query = useTraderProcess();
  const [analysis, setAnalysis] = useState(() => freshCockpit());
  if (!query.data)
    return (
      <main className="ck-boot">
        <ShieldCheck />
        <h1>TraderLoading</h1>
        <p role="status">
          {query.isError ? "Connessione al processo non disponibile." : "Riprendo il tuo cockpit…"}
        </p>
        {query.isError && (
          <button onClick={() => void query.refetch()}>{ck("cockpit.ui.f360775cb8")}</button>
        )}
      </main>
    );
  if (query.data.activeMethod?.rules.setup.startsWith("Cockpit ·"))
    return <PersistedCockpit key={query.data.activeMethod.id} state={query.data} seed={analysis} />;
  return <CockpitView state={query.data} analysis={analysis} onAnalysis={setAnalysis} />;
}
function CockpitView({
  state,
  analysis: a,
  onAnalysis,
  value,
  change,
  confirmed = false,
  onConfirm,
  busy = false,
  error,
  status,
  flush,
}: {
  state: ProcessState;
  analysis: CockpitAnalysis;
  onAnalysis: (s: CockpitAnalysis) => void;
  value?: CheckInDraft;
  change?: (patch: Partial<CheckInDraft>) => void;
  confirmed?: boolean;
  onConfirm?: (decision: "trade" | "wait") => void;
  busy?: boolean;
  error?: unknown;
  status?: ReactNode;
  flush?: () => Promise<unknown>;
}) {
  const ck = useCockpitCopy();
  const query = useTraderProcess();
  const { t } = useLanguage();
  const [now, setNow] = useState(() => new Date());
  const [dialog, setDialog] = useState<
    "protection" | "context" | "notes" | "protocol" | "confirm" | null
  >(null);
  const [chartTF, setChartTF] = useState("60");
  const [chartAllowed, setChartAllowed] = useState(true);
  const [mobileTab, setMobileTab] = useState<"process" | "chart">("process");
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);
  const set = (patch: Partial<CockpitAnalysis>) => {
    if (!confirmed) onAnalysis(changeCockpit(a, patch));
  };
  const win = cockpitWindow(a, now);
  const missing = cockpitRequirements(a, now);
  const market = useQuery({
    queryKey: ["cockpit-market-context", a.market],
    queryFn: () => fetchMarketContext(a.market),
    staleTime: 30000,
    refetchInterval: (q) => (q.state.data?.refreshing ? 1500 : 60000),
  });
  const snapshotId =
    market.data?.snapshotId && Date.now() - Date.parse(market.data.generatedAt) < 90000
      ? market.data.snapshotId
      : null;
  useEffect(() => {
    if (!confirmed && change && snapshotId !== (value?.contextSnapshotId ?? null))
      change({ contextSnapshotId: snapshotId });
  }, [snapshotId, confirmed, change, value?.contextSnapshotId]);
  const [, navigate] = useLocation();
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
  const operativeRules = confirmed ? state.session?.rulesSnapshot : state.activeMethod?.rules;
  const oldSession = Boolean(state.session?.preparedAt && !state.session.plan?.guidance?.cockpit);
  const improvement = cockpitImprovement(state);
  const phase = confirmed ? 4 : a.phase;
  const tfs = a.mode === "scalp" ? ["H1", "M15", "M1"] : ["D1 / H4", "H1 / M15", a.execTF];
  const ready = !missing.length && !limitReached;
  const title = confirmed
    ? "Gestisci ciò che hai preparato."
    : a.context === "compression"
      ? "Liquidità sopra e sotto. Nessun ingresso."
      : win.kind === "closed"
        ? "Prepara la prossima sessione."
        : !cockpitContextReady(a)
          ? "Leggi il ciclo grande."
          : !a.scenario
            ? "Cosa ha preso a sinistra?"
            : ready
              ? "Quattro pilastri documentati."
              : "Aspetta la conferma, non anticiparla.";
  const link = (href: string) => {
    return href;
  };
  const panels = [
    ["Ciclo grande", tfs[0]],
    ["Zona a sinistra", tfs[1]],
    ["Schematica, trigger & target", tfs[2]],
    ["Gestione & consuntivo", "DIARIO"],
  ];
  return (
    <main
      className="trading-cockpit"
      data-testid="trading-cockpit"
      onClickCapture={navigateAfterSave}
    >
      <header className="ck-topbar">
        <Link href="/" className="ck-brand">
          <BrandMark subtitle={ck("cockpit.ui.4e5cc613c5")} />
        </Link>
        <nav aria-label={ck("cockpit.ui.8d0d90a538")}>
          <Link href="/" aria-current="page">
            {ck("cockpit.ui.b56631bc88")}
          </Link>
          <Link href={link("/backtest")}>
            <FlaskConical size={15} />
            {ck("cockpit.ui.c6e3b65510")}
          </Link>
          <Link href={link("/chat?t=competizioni&vista=xp")}>
            <Trophy size={15} />
            {ck("cockpit.ui.e68277a3b5")}
          </Link>
          <Link href={link("/tornei")}>
            <Layers size={15} />
            {ck("cockpit.ui.44f59ec731")}
          </Link>
          <Link href={link("/journal?t=sessioni")}>
            <BookOpen size={15} />
            {ck("cockpit.ui.8006028d66")}
          </Link>
        </nav>
        <button
          className="ck-icon"
          aria-label={ck("cockpit.ui.748635068a")}
          onClick={() => setDialog("protection")}
        >
          <Settings2 size={18} />
        </button>
      </header>
      <div className="ck-mobile-tabs" role="group" aria-label={ck("cockpit.ui.3a0b9c0415")}>
        <button aria-pressed={mobileTab === "process"} onClick={() => setMobileTab("process")}>
          {ck("cockpit.ui.157a305253")}
        </button>
        <button aria-pressed={mobileTab === "chart"} onClick={() => setMobileTab("chart")}>
          {ck("cockpit.ui.8900a11210")}
        </button>
      </div>
      <div className="ck-workspace" data-mobile-view={mobileTab}>
        <aside className="ck-process" aria-label={ck("cockpit.ui.157a305253")}>
          <div className="ck-session-line">
            <div className="ck-segment" role="group" aria-label={ck("cockpit.ui.114e037766")}>
              {(["scalp", "swing"] as const).map((mode) => (
                <button
                  key={mode}
                  aria-pressed={a.mode === mode}
                  disabled={confirmed}
                  onClick={() => set({ mode })}
                >
                  {mode === "scalp" ? "Scalping" : "Swing"}
                </button>
              ))}
            </div>
            <div className="ck-clock">
              <span>
                {win.name}
                {ck("cockpit.ui.29f1c20ee4")}
              </span>
              <strong>
                {now.toLocaleTimeString("it-IT", {
                  timeZone: "Europe/Rome",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
            </div>
          </div>
          <p className="ck-session-hours">
            {win.hours}
            <span>{ck("cockpit.ui.6a5576aeb7")}</span>
          </p>
          <button className="ck-news" onClick={() => setDialog("context")}>
            <span className="ck-overline">
              {ck("cockpit.ui.ba756a50e0")}
              <ArrowUpRight size={13} />
            </span>
            <strong>
              {market.isPending || market.data?.refreshing
                ? "Raccolta delle fonti…"
                : market.data?.calendarStatus === "available"
                  ? market.data.events.length
                    ? `${market.data.events.length} eventi ad alto impatto da valutare`
                    : "Nessun evento ad alto impatto nella prossima finestra"
                  : "Calendario da verificare"}
            </strong>
            <small>
              {a.newsDay === cockpitDay(now) && a.news !== "unchecked"
                ? "Controllo personale registrato"
                : "Apri le fonti e conferma il controllo prima del piano."}
            </small>
          </button>
          <div className="ck-session-status">
            <span className="ck-led" />
            {state.session?.state === "closed"
              ? "SESSIONE CHIUSA"
              : confirmed
                ? "PIANO CONFERMATO"
                : "PREPARAZIONE"}
            <span>
              {state.activeMethod
                ? `${operativeRules?.riskPerTrade} ${operativeRules?.currency} / TRADE`
                : "PROTEZIONE DA CONFERMARE"}
            </span>
          </div>
          <ol className="ck-pillars" aria-label={ck("cockpit.ui.8e5811209f")}>
            {["Dove", "Sinistra", "Come", "Target"].map((label, i) => (
              <li
                key={label}
                data-done={
                  [
                    cockpitContextReady(a),
                    Boolean(a.scenario),
                    Boolean(a.trigger && a.itfSchema && a.ltfSchema),
                    Boolean(a.targetConfirmed && a.target),
                  ][i]
                }
              >
                <span>
                  0{i + 1} / {ck(label)}
                </span>
                <small>{["Ciclo grande", "Zona HTF", "Ciclo piccolo", "Liquidità"][i]}</small>
              </li>
            ))}
          </ol>
          <section className={`ck-verdict ${ready ? "is-ready" : ""}`} role="status">
            <span className="ck-verdict-icon">
              {ready ? <Check size={20} /> : <Focus size={20} />}
            </span>
            <div>
              <span className="ck-overline">
                {limitReached
                  ? "LIMITE DI RISCHIO RAGGIUNTO"
                  : a.context === "compression"
                    ? "NO TRADE / COMPRESSIONE"
                    : win.kind === "closed"
                      ? "PREPARAZIONE / REVISIONE"
                      : "CONTEXT FIRST"}
              </span>
              <h1>{ck(title)}</h1>
              <p>
                {limitReached
                  ? "Pausa e rivalutazione. Le operazioni fuori piano restano documentabili nel diario."
                  : confirmed
                    ? "Il piano resta conservato. Collega i trade effettivi e chiudi con una revisione."
                    : win.kind === "closed"
                      ? "Rivedi gli esiti, mappa le zone HTF e costruisci scenari con invalidazioni chiare."
                      : (missing[0] ??
                        "Conferme dichiarate complete: verifica ancora rischio, ingresso e invalidazione.")}
              </p>
            </div>
          </section>
          {!confirmed && improvement && (
            <div className="ck-notice">
              <strong>{ck("cockpit.ui.ccc7bf41dd")}</strong>
              <p>{improvement.action}</p>
              {improvement.criterion && (
                <small>
                  {ck("cockpit.ui.fe164eea5b")} {improvement.criterion}
                </small>
              )}
            </div>
          )}
          {a.day !== cockpitDay(now) && !confirmed && (
            <button
              className="ck-primary"
              onClick={() => onAnalysis(freshCockpit(a.market, a.mode, now))}
            >
              {ck("cockpit.ui.05d3fce452")}
            </button>
          )}
          <div className="ck-section-heading">
            <span>{ck("cockpit.ui.b9f6853940")}</span>
            <button onClick={() => setDialog("protocol")}>{ck("cockpit.ui.a665abd7d1")}</button>
            {!confirmed && (
              <button
                onClick={() => {
                  onAnalysis(freshCockpit(a.market, a.mode));
                  change?.({
                    expectation: "",
                    invalidation: "",
                    entry: "",
                    stop: "",
                    risk: "",
                    response: "",
                    checklist: state.activeMethod?.rules.checklist.map(() => false) ?? [],
                  });
                }}
              >
                {ck("cockpit.ui.01b019ef71")}
                <RotateCcw size={12} />
              </button>
            )}
          </div>
          {panels.map(([name, tf], i) => {
            const n = i + 1,
              disabled =
                n === 4
                  ? !confirmed
                  : confirmed ||
                    (n === 2 && !cockpitContextReady(a)) ||
                    (n === 3 && (!cockpitContextReady(a) || !a.scenario));
            return (
              <section className="ck-phase" key={name} data-open={phase === n}>
                <button
                  className="ck-phase-header"
                  disabled={disabled}
                  aria-expanded={phase === n}
                  onClick={() => {
                    if (n < 4) {
                      set({ phase: n as 1 | 2 | 3 });
                      setChartTF(
                        n === 1
                          ? a.mode === "scalp"
                            ? "60"
                            : "240"
                          : n === 2
                            ? "15"
                            : a.execTF === "M5"
                              ? "5"
                              : "1",
                      );
                    }
                  }}
                >
                  <span className="ck-phase-number">0{n}</span>
                  <strong>{ck(name)}</strong>
                  <small>{tf}</small>
                  <ChevronDown size={14} />
                </button>
                {phase === n && (
                  <div className="ck-phase-body">
                    {n === 1 && (
                      <>
                        <p>
                          {a.mode === "scalp"
                            ? "Zone H1 e pool principali."
                            : "Ciclo Daily, liquidità e zona H4."}{" "}
                          {ck("cockpit.ui.95a1e69392")}
                        </p>
                        <label className="ck-field">
                          {ck("cockpit.ui.c16cd27959")}
                          <select
                            aria-label={ck("cockpit.ui.c16cd27959")}
                            value={a.cycle}
                            onChange={(e) =>
                              set({ cycle: e.target.value as CockpitAnalysis["cycle"] })
                            }
                          >
                            <option value="">{ck("cockpit.ui.335f21eec4")}</option>
                            {CYCLES.map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                        </label>
                        {(
                          [
                            [
                              "compression",
                              "Liquidità sopra e sotto",
                              "Compressione attiva. Nessun ingresso.",
                            ],
                            [
                              "swept",
                              "Liquidity swept",
                              "Caccia avvenuta e verificata sul grafico.",
                            ],
                            [
                              "intermediate",
                              "Zona estrema non raggiunta",
                              "Re-accumuli in corso: prosegui solo sui box intermedi.",
                            ],
                          ] as const
                        ).map(([v, l, d]) => (
                          <Choice
                            key={v}
                            checked={a.context === v}
                            onClick={() => set({ context: v })}
                          >
                            <strong>{ck(l)}</strong>
                            <small>{ck(d)}</small>
                          </Choice>
                        ))}
                        <button
                          className="ck-primary"
                          disabled={!cockpitContextReady(a)}
                          onClick={() => {
                            set({ phase: 2 });
                            setChartTF("15");
                          }}
                        >
                          {ck("cockpit.ui.def79361e5")}
                          <ArrowUpRight size={15} />
                        </button>
                      </>
                    )}
                    {n === 2 && (
                      <>
                        <p>
                          {a.context === "intermediate"
                            ? "L’estremo non è stato raggiunto: verifica i box intermedi."
                            : "Lo sweep ha toccato una zona HTF valida? Il contesto decide quali trigger cercare."}
                        </p>
                        {SCENARIOS.map(([v, l, d]) => (
                          <Choice
                            key={v}
                            checked={a.scenario === v}
                            disabled={!cockpitScenarios(a).includes(v)}
                            onClick={() => {
                              set({ scenario: v });
                              setChartTF(a.execTF === "M5" ? "5" : "1");
                            }}
                          >
                            <strong>{ck(l)}</strong>
                            <small>{ck(d)}</small>
                          </Choice>
                        ))}
                      </>
                    )}
                    {n === 3 && (
                      <>
                        <p>
                          {a.scenario === "no_zone"
                            ? "Sola liquidità: inversione esclusa. Cerca JTC o BTI a favore dell’impulso."
                            : a.scenario === "reaccum"
                              ? "Box intermedi: solo JTC verso la zona opposta."
                              : `Zona ${tfs[0]} → schematica ${tfs[1]} → ingresso ${tfs[2]}.`}
                        </p>
                        <Tick
                          label={`Ciclo ${tfs[1]} chiuso e schematica confermata`}
                          checked={a.itfSchema}
                          onChange={(itfSchema) => set({ itfSchema })}
                        />
                        {a.mode === "swing" && (
                          <div className="ck-segment">
                            {(["M5", "M1"] as const).map((tf) => (
                              <button
                                key={tf}
                                aria-pressed={a.execTF === tf}
                                onClick={() => {
                                  set({ execTF: tf });
                                  setChartTF(tf === "M5" ? "5" : "1");
                                }}
                              >
                                {ck("cockpit.ui.37cee8e87f")}
                                {tf}
                              </button>
                            ))}
                          </div>
                        )}
                        <Tick
                          label={`Schematica d’ingresso ${tfs[2]} valida`}
                          checked={a.ltfSchema}
                          disabled={!a.itfSchema}
                          onChange={(ltfSchema) => set({ ltfSchema })}
                        />
                        <div
                          className="ck-triggers"
                          role="group"
                          aria-label={ck("cockpit.ui.d3f06a581b")}
                        >
                          {(["TEST", "POC", "JTC", "BTI"] as const).map((trigger) => (
                            <button
                              key={trigger}
                              aria-pressed={a.trigger === trigger}
                              disabled={
                                !a.itfSchema ||
                                !a.ltfSchema ||
                                !cockpitTriggers(a).includes(trigger)
                              }
                              onClick={() => set({ trigger })}
                            >
                              {trigger}
                            </button>
                          ))}
                        </div>
                        <span className="ck-overline">{ck("cockpit.ui.fa35df7049")}</span>
                        <div className="ck-segment">
                          <button
                            aria-pressed={a.area === "history"}
                            onClick={() => set({ area: "history", imbalance: false })}
                          >
                            {ck("cockpit.ui.e6165931a6")}
                          </button>
                          <button
                            aria-pressed={a.area === "virgin"}
                            onClick={() => set({ area: "virgin" })}
                          >
                            {ck("cockpit.ui.f102646728")}
                          </button>
                        </div>
                        {a.area === "virgin" && (
                          <>
                            <Tick
                              label={ck("cockpit.ui.c837e2f8eb")}
                              checked={a.imbalance}
                              onChange={(imbalance) => set({ imbalance })}
                            />
                            <p className="ck-hint">{ck("cockpit.ui.5328ab74f3")}</p>
                          </>
                        )}
                        <label className="ck-field">
                          {ck("cockpit.ui.c1207ecfca")}
                          <input
                            maxLength={4000}
                            value={a.target}
                            placeholder={ck("cockpit.ui.d47fa7cb5a")}
                            onChange={(e) =>
                              set({ target: e.target.value, targetConfirmed: false })
                            }
                          />
                        </label>
                        <Tick
                          label={ck("cockpit.ui.8032c830b2")}
                          checked={a.targetConfirmed}
                          onChange={(targetConfirmed) => set({ targetConfirmed })}
                        />
                        {win.kind === "asia" && (
                          <Tick
                            label={ck("cockpit.ui.a22370544a")}
                            checked={a.asiaConfirmed}
                            onChange={(asiaConfirmed) => set({ asiaConfirmed })}
                          />
                        )}
                        {win.kind === "lunch" && (
                          <Tick
                            label={ck("cockpit.ui.3e0d2d4fbd")}
                            checked={a.impulseStarted}
                            onChange={(impulseStarted) => set({ impulseStarted })}
                          />
                        )}
                        <label className="ck-field">
                          {ck("cockpit.ui.6c25089b54")}
                          <select
                            aria-label={ck("cockpit.ui.6c25089b54")}
                            value={a.news}
                            onChange={(e) =>
                              set({
                                news: e.target.value as CockpitAnalysis["news"],
                                newsDay: cockpitDay(now),
                              })
                            }
                          >
                            <option value="unchecked">{ck("cockpit.ui.d2c1d59faa")}</option>
                            <option value="clear">{ck("cockpit.ui.b77a08ca3a")}</option>
                            <option value="pre">{ck("cockpit.ui.c641c06d81")}</option>
                            <option value="post">{ck("cockpit.ui.1617afbc62")}</option>
                          </select>
                        </label>
                        <button
                          className="ck-primary"
                          onClick={() => setDialog(value ? "confirm" : "protection")}
                        >
                          {value ? "Scenario, rischio e conferma" : "Conferma la tua protezione"}
                          <ArrowUpRight size={15} />
                        </button>
                      </>
                    )}
                    {n === 4 && (
                      <>
                        <p>{ck("cockpit.ui.cf5cba54c7")}</p>
                        <Link
                          className="ck-primary"
                          href={`/journal?t=trades&new=1&fromProcess=1&processSessionId=${encodeURIComponent(state.session?.id ?? "")}&methodVersionId=${encodeURIComponent(state.session?.methodVersionId ?? "")}&pair=${encodeURIComponent(a.market)}`}
                        >
                          {ck("cockpit.ui.7021aa39e1")}
                          <ArrowUpRight size={15} />
                        </Link>
                        <CockpitReview state={state} />
                        <p className="ck-hint">{ck("cockpit.ui.94607e9b67")}</p>
                      </>
                    )}
                  </div>
                )}
              </section>
            );
          })}
          {oldSession && (
            <div className="ck-notice">
              {ck("cockpit.ui.630600b4d9")}
              <Link href="/?process=legacy">
                {ck("cockpit.ui.f8de5118a8")}
                <ArrowUpRight size={13} />
              </Link>
            </div>
          )}
          {!value && (
            <button className="ck-protection" onClick={() => setDialog("protection")}>
              <ShieldCheck size={17} />
              <span>
                {ck("cockpit.ui.915ed19726")}
                <small>{ck("cockpit.ui.824b633944")}</small>
              </span>
              <ArrowUpRight size={15} />
            </button>
          )}
          <section className="ck-edge">
            <div>
              <span className="ck-overline">{ck("cockpit.ui.7a1b29f480")}</span>
              <Link href="/journal?t=panoramica">
                {ck("cockpit.ui.18d0d41dd9")}
                <ArrowUpRight size={12} />
              </Link>
            </div>
            <strong>
              {state.progress.report.closedSessions}
              <small>{ck("cockpit.ui.1bd3b3a142")}</small>
            </strong>
            <p>
              {state.progress.report.eligibleSamples
                ? `${state.progress.report.eligibleSamples} evidenze complete · risultati e aderenza nel diario.`
                : "I risultati compaiono con le operazioni documentate. Nessun dato dimostrativo."}
            </p>
          </section>
          <footer className="ck-process-footer">
            <span className="ck-led" />
            {ck("cockpit.ui.d6f6ca6669")}
            {status ?? <span>{ck("cockpit.ui.9439d10e8e")}</span>}
          </footer>
        </aside>
        <section className="ck-chart-area" aria-label={ck("cockpit.ui.31175df55f")}>
          <div className="ck-chart-heading">
            <label>
              <span className="sr-only">{ck("cockpit.ui.ae63a28a57")}</span>
              <select
                aria-label={ck("cockpit.ui.ae63a28a57")}
                value={a.market}
                disabled={confirmed}
                onChange={(e) => set({ market: e.target.value })}
              >
                {Array.from(
                  new Set([...MARKETS, ...(state.activeMethod?.rules.markets ?? [])]),
                ).map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <span>
              0{Math.min(phase, 3)} /{" "}
              {phase === 1
                ? "CONTESTO HTF"
                : phase === 2
                  ? "ZONA A SINISTRA"
                  : phase === 3
                    ? "TRIGGER & TARGET"
                    : "GESTIONE"}
            </span>
            <button
              className="ck-icon"
              aria-label={ck("cockpit.ui.6623e8c641")}
              onClick={() => setMobileTab("chart")}
            >
              <Maximize2 size={16} />
            </button>
          </div>
          <div className="ck-timeframes" role="group" aria-label={ck("cockpit.ui.c22e911169")}>
            {[
              ["D1", "D"],
              ["H4", "240"],
              ["H1", "60"],
              ["M15", "15"],
              ["M5", "5"],
              ["M1", "1"],
            ].map(([l, v]) => (
              <button key={v} aria-pressed={chartTF === v} onClick={() => setChartTF(v)}>
                {l}
              </button>
            ))}
            <a
              href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(CHART_SYMBOLS[a.market] ?? a.market)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {ck("cockpit.ui.31fe3a8910")}
              <ArrowUpRight size={12} />
            </a>
          </div>
          <div className="ck-chart">
            {chartAllowed ? (
              <iframe
                key={`${a.market}:${chartTF}`}
                title={`Grafico ${a.market} ${chartTF}`}
                src={`https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(CHART_SYMBOLS[a.market] ?? a.market)}&interval=${chartTF}&theme=dark&style=1&timezone=Europe%2FRome&locale=it&hide_side_toolbar=0&allow_symbol_change=0&save_image=1`}
                onError={() => setChartAllowed(false)}
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            ) : (
              <div className="ck-chart-start">
                <div className="ck-chart-grid" aria-hidden />
                <Focus size={45} />
                <span className="ck-overline">
                  {ck("cockpit.ui.929f4b8e5d")}
                  {a.market}
                </span>
                <h2>
                  {ck("cockpit.ui.1136357de3")}
                  <br />
                  {ck("cockpit.ui.cd4af9bb1d")}
                </h2>
                <p>{ck("cockpit.ui.05f0722019")}</p>
                <button className="ck-primary" onClick={() => setChartAllowed(true)}>
                  {ck("cockpit.ui.175b9c22a7")}
                  <ArrowUpRight size={16} />
                </button>
                <a
                  href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(CHART_SYMBOLS[a.market] ?? a.market)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {ck("cockpit.ui.1675068b80")}
                </a>
              </div>
            )}
          </div>
          <div className="ck-chart-dock">
            <button
              onClick={() => {
                setMobileTab("process");
                setDialog(value ? "confirm" : "protection");
              }}
            >
              <Focus size={16} />
              {ck("cockpit.ui.71e5b1f872")}
            </button>
            <button onClick={() => setDialog("context")}>
              <Layers size={16} />
              {ck("cockpit.ui.6b37d2f159")}
            </button>
            <button onClick={() => setDialog("notes")}>
              <BookOpen size={16} />
              {ck("cockpit.ui.9e79d6e7c0")}
            </button>
            <Link href="/backtest">
              <FlaskConical size={16} />
              {ck("cockpit.ui.c6e3b65510")}
            </Link>
            <Link href="/journal?t=sessioni">
              <BookOpen size={16} />
              {ck("cockpit.ui.8006028d66")}
            </Link>
          </div>
          <div className="ck-chart-caption">
            <span>
              <span className="ck-led" />
              {a.mode === "scalp" ? "H1 → M15 → M1" : "Daily / H4 → H1 / M15 → M5 / M1"}
            </span>
            <span>{ck("cockpit.ui.faae915482")}</span>
          </div>
        </section>
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="ck-dialog">
          <DialogHeader>
            <DialogTitle>
              {dialog === "protection"
                ? "Il tuo protocollo. I tuoi limiti."
                : dialog === "context"
                  ? "Contesto e calendario del pair"
                  : dialog === "notes"
                    ? "Appunti sul contesto"
                    : dialog === "confirm"
                      ? "Un contesto. Un piano chiaro."
                      : "Struttura ciclica, liquidità e schematiche"}
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
              <Link href="/method">{ck("cockpit.ui.60bc3a59a4")}</Link>
              <Link href="/settings">{ck("cockpit.ui.6d160e16ca")}</Link>
              <Link href="/resources">{ck("cockpit.ui.10469de821")}</Link>
              <Link href="/chat?t=social">{ck("cockpit.ui.aacb0e2513")}</Link>
            </>
          )}
          {dialog === "context" && (
            <>
              <SessionPairContext pair={a.market} onSnapshot={() => undefined} />
              <nav className="ck-tool-links" aria-label={ck("cockpit.ui.d61be140a5")}>
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
            </>
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
                  ? "Gli appunti vengono salvati con la bozza del processo."
                  : "Conferma la protezione per attivare il salvataggio nell’account."}
              </small>
            </label>
          )}
          {dialog === "protocol" && (
            <div className="ck-protocol">
              <p>{ck("cockpit.ui.268e542ba6")}</p>
              <p>{ck("cockpit.ui.ba2faa29fc")}</p>
              <p>{ck("cockpit.ui.e9c1677acd")}</p>
              <p>{ck("cockpit.ui.6897da65ae")}</p>
              <p>{ck("cockpit.ui.517da75162")}</p>
              <Link href="/method">{ck("cockpit.ui.27175ca7c9")}</Link>
            </div>
          )}
          {dialog === "confirm" && value && change && (
            <form
              className="ck-form"
              onSubmit={(e) => {
                e.preventDefault();
                onConfirm?.(value.decision === "wait" ? "wait" : "trade");
              }}
            >
              <div className="ck-segment">
                <button
                  type="button"
                  aria-pressed={value.decision === "trade"}
                  onClick={() => change({ decision: "trade" })}
                >
                  {ck("cockpit.ui.c8fa66c7ea")}
                </button>
                <button
                  type="button"
                  aria-pressed={value.decision === "wait"}
                  onClick={() => change({ decision: "wait" })}
                >
                  {ck("cockpit.ui.1eed39319f")}
                </button>
              </div>
              {value.decision === "wait" ? (
                <label>
                  {ck("cockpit.ui.5d64297eda")}
                  <textarea
                    required
                    maxLength={4000}
                    value={value.reason}
                    onChange={(e) => change({ reason: e.target.value })}
                  />
                </label>
              ) : (
                <>
                  <label>
                    {ck("cockpit.ui.0955063f7d")}
                    <textarea
                      required
                      maxLength={4000}
                      value={value.expectation ?? ""}
                      onChange={(e) => change({ expectation: e.target.value })}
                    />
                  </label>
                  <label>
                    {ck("cockpit.ui.c8c5fe7a87")}
                    <input
                      required
                      maxLength={4000}
                      value={value.entry}
                      onChange={(e) => change({ entry: e.target.value })}
                    />
                  </label>
                  <label>
                    {ck("cockpit.ui.0158d762d1")}
                    <input
                      required
                      maxLength={4000}
                      value={value.stop}
                      onChange={(e) => change({ stop: e.target.value })}
                    />
                  </label>
                  <label>
                    {ck("cockpit.ui.bc66e67427")}
                    {state.activeMethod?.rules.currency})
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="any"
                      max={state.activeMethod?.rules.riskPerTrade}
                      value={value.risk}
                      onChange={(e) => change({ risk: e.target.value })}
                    />
                  </label>
                </>
              )}
              <label>
                {ck("cockpit.ui.7b1ad36038")}
                <textarea
                  required
                  maxLength={4000}
                  value={value.invalidation ?? ""}
                  onChange={(e) => change({ invalidation: e.target.value })}
                />
              </label>
              <label>
                {ck("cockpit.ui.01ae4d8f00")}
                <select
                  aria-label={ck("cockpit.ui.01ae4d8f00")}
                  required
                  value={value.response ?? ""}
                  onChange={(e) => change({ response: e.target.value as CheckInDraft["response"] })}
                >
                  <option value="" disabled>
                    {ck("cockpit.ui.8d43411ccd")}
                  </option>
                  <option value="wait">{ck("cockpit.ui.9bad1a1ffb")}</option>
                  <option value="reassess">{ck("cockpit.ui.a3e4c8960e")}</option>
                  <option value="exit">{ck("cockpit.ui.5fa4cdf39f")}</option>
                </select>
              </label>
              {state.activeMethod?.rules.checklist.map((c, i) => (
                <Tick
                  key={i}
                  label={c}
                  checked={value.checklist[i] ?? false}
                  onChange={(checked) =>
                    change({
                      checklist: state.activeMethod!.rules.checklist.map((_, j) =>
                        i === j ? checked : (value.checklist[j] ?? false),
                      ),
                    })
                  }
                />
              ))}
              {value.decision === "trade" && missing.length > 0 && (
                <div className="ck-notice">
                  <strong>{ck("cockpit.ui.518cb2759b")}</strong>
                  <ul>
                    {missing.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <p>{ck("cockpit.ui.7744c6062f")}</p>
                </div>
              )}
              <ErrorMessage error={error} />
              <button
                className="ck-primary"
                disabled={
                  busy ||
                  confirmed ||
                  !value.decision ||
                  !value.checklist.length ||
                  !value.checklist.every(Boolean) ||
                  (value.decision === "trade" && (!ready || limitReached))
                }
              >
                {ck("cockpit.ui.93f7dc92e6")}
              </button>
              <p className="ck-hint">{ck("cockpit.ui.c2b966bf4e")}</p>
              {status}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
