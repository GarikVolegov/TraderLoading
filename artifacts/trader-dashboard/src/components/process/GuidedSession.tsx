import { useLocation, useSearch } from "wouter";
import { useCallback, useEffect, useRef } from "react";
import { useGetChecklist, useGetUserSettings } from "@workspace/api-client-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { useSessionDraft } from "@/hooks/useSessionDraft";
import { useMethodDraft } from "@/hooks/useMethodDraft";
import { useProcessMutation } from "@/hooks/useTraderProcess";
import {
  startGuidedProcess,
  type CheckInDraft,
  type MethodRules,
  type ProcessSession,
  type ProcessState,
  type SessionPlan,
} from "@/lib/traderProcessApi";
import { updateWorkspaceQuery } from "@/lib/workspaceNavigation";
import type { MethodDraftValues } from "@/lib/methodDraftSteps";
import type { ProcessCopyKey } from "@/lib/processCopy";
import { Button } from "@/components/ui/button";
import {
  ProcessChoices,
  ProcessError,
  ProcessField,
  ProcessPanel,
  useProcessCopy,
} from "./ProcessUI";
import { SessionDraftStatus } from "./SessionDraftStatus";
import { SessionPairContext } from "./SessionPairContext";
import type { ReactNode } from "react";
import { DIRECTIONAL_PAIRS } from "@/lib/marketIntelligenceApi";
import { useLanguage } from "@/contexts/LanguageContext";
import { journeyText } from "@/lib/processJourneyCopy";
import { WORKSPACE_TOOLS } from "@/lib/workspaceTools";
import { processToolHref } from "@/lib/processToolNavigation";
import { ProcessLink } from "./ProcessUI";

export function guidedPlan(value: CheckInDraft, rules: MethodRules): SessionPlan {
  if (!value.response) throw new Error("Scegli come reagire all’invalidazione");
  const decisionLink = value.marketDecisionId ? { marketDecisionId: value.marketDecisionId } : {};
  const guidance = {
    expectation: value.expectation?.trim() ?? "",
    invalidation: value.invalidation?.trim() ?? "",
    response: value.response,
    responseNote: value.response === "custom" ? value.responseNote?.trim() || undefined : undefined,
    contextSnapshotId: value.contextSnapshotId ?? null,
  };
  return value.decision === "wait"
    ? {
        decision: "wait",
        market: value.market,
        waitReason: value.reason,
        ...decisionLink,
        guidance,
      }
    : {
        decision: "trade",
        market: value.market,
        setup: rules.setup,
        entry: value.entry,
        stop: value.stop,
        initialRisk: Number(value.risk),
        invalidation: guidance.invalidation,
        ...decisionLink,
        guidance,
      };
}

function SessionBuilder({
  value,
  change,
  criteria,
  pairs,
  rules,
  alreadyPrepared = false,
  busy,
  blocked,
  error,
  onConfirm,
  status,
  initialRules,
  reminder,
  tools,
}: {
  value: CheckInDraft;
  change: (patch: Partial<CheckInDraft>) => void;
  criteria: string[];
  pairs: string[];
  rules?: MethodRules;
  reminder?: string;
  tools?: ReactNode;
  alreadyPrepared?: boolean;
  busy: boolean;
  blocked: boolean;
  error: unknown;
  onConfirm: () => void;
  status: ReactNode;
  initialRules?: ReactNode;
}) {
  const copy = useProcessCopy();
  const [location, navigate] = useLocation();
  const search = useSearch();
  const clearDecision = (market = value.market) => {
    change({ market, contextSnapshotId: null, marketDecisionId: undefined });
    if (new URLSearchParams(search).has("marketDecisionId"))
      navigate(
        `${location}${updateWorkspaceQuery(search, { marketDecisionId: null, pair: null, horizon: null })}`,
        { replace: true },
      );
  };
  const step = value.step ?? (alreadyPrepared ? 1 : 0);
  const onSnapshot = useCallback(
    (contextSnapshotId: string | null) => change({ contextSnapshotId }),
    [change],
  );
  return (
    <ProcessPanel
      title={copy(step === 0 ? "prepareTrader" : step === 1 ? "readPair" : "buildScenario")}
      description={copy(
        step === 0 ? "prepareTraderHint" : step === 1 ? "readPairHint" : "buildScenarioHint",
      )}
      focusHeading
    >
      <ol className="session-builder-steps" aria-label={copy("preTradeSteps")}>
        {(["checklist", "pairContext", "scenario"] as const).map((key, i) => (
          <li key={key} aria-current={i === step ? "step" : undefined}>
            <span>{i + 1}</span>
            {copy(key)}
          </li>
        ))}
      </ol>
      <form
        className="process-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 2) change({ step: (step + 1) as 1 | 2 });
          else onConfirm();
        }}
      >
        <fieldset disabled={busy || blocked} className="process-form min-w-0">
          {step === 0 && (
            <>
              {reminder && (
                <p className="process-plan-summary text-sm">
                  {copy("correctionCarry")}
                  <br />
                  <span className="block">{reminder}</span>
                </p>
              )}
              {rules && (
                <p className="text-sm text-muted-foreground">
                  {copy("riskPerTrade")}: {rules.riskPerTrade} {rules.currency} · {copy("maxLoss")}:{" "}
                  {rules.maxDailyLoss} {rules.currency}
                </p>
              )}
              <fieldset disabled={alreadyPrepared} className="space-y-3">
                <legend className="sr-only">{copy("checklist")}</legend>
                {criteria.map((criterion, index) => (
                  <label key={index} className="process-option">
                    <input
                      type="checkbox"
                      required
                      checked={value.checklist[index] ?? false}
                      onChange={(event) =>
                        change({
                          checklist: criteria.map((_, i) =>
                            i === index ? event.target.checked : (value.checklist[i] ?? false),
                          ),
                        })
                      }
                    />
                    <span>{criterion}</span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {step === 1 && (
            <>
              <ProcessField label={copy("market")}>
                <select
                  required
                  value={value.market}
                  onChange={(event) => clearDecision(event.target.value)}
                >
                  <option value="">—</option>
                  {pairs.map((pair) => (
                    <option key={pair}>{pair}</option>
                  ))}
                </select>
              </ProcessField>
              <SessionPairContext
                pair={value.market}
                decisionId={value.marketDecisionId}
                onRefresh={() => clearDecision()}
                onSnapshot={onSnapshot}
              />
              {tools}
            </>
          )}
          {step === 2 && (
            <>
              <p className="text-sm font-medium">{value.market}</p>
              <ProcessField label={copy("expectation")} hint={copy("expectationHint")}>
                <textarea
                  required
                  maxLength={4000}
                  rows={2}
                  value={value.expectation ?? ""}
                  onChange={(event) => change({ expectation: event.target.value })}
                />
              </ProcessField>
              <ProcessField label={copy("sessionInvalidation")}>
                <textarea
                  required
                  maxLength={4000}
                  rows={2}
                  value={value.invalidation ?? ""}
                  onChange={(event) => change({ invalidation: event.target.value })}
                />
              </ProcessField>
              <ProcessChoices
                label={copy("invalidationResponse")}
                value={value.response ?? ""}
                options={
                  [
                    { value: "wait", label: copy("responseWait") },
                    { value: "reassess", label: copy("responseReassess") },
                    { value: "exit", label: copy("responseExit") },
                    { value: "custom", label: copy("responseCustom") },
                  ] as const
                }
                onChange={(response) => change({ response })}
              />
              {value.response === "custom" && (
                <ProcessField label={copy("responseNote")}>
                  <textarea
                    required
                    rows={2}
                    maxLength={4000}
                    value={value.responseNote ?? ""}
                    onChange={(event) => change({ responseNote: event.target.value })}
                  />
                </ProcessField>
              )}
              <ProcessChoices
                label={copy("plan")}
                value={value.decision}
                options={
                  [
                    { value: "trade", label: copy("preparePlan") },
                    { value: "wait", label: copy("stayOut") },
                  ] as const
                }
                onChange={(decision) => change({ decision })}
              />
              {value.decision === "wait" && (
                <>
                  <ProcessChoices
                    label={copy("waitReason")}
                    value={value.reasonCode}
                    options={
                      [
                        { value: "no_setup", label: copy("waitNoSetup") },
                        { value: "window", label: copy("waitWindow") },
                        { value: "event", label: copy("waitEvent") },
                        { value: "pause", label: copy("waitPause") },
                        { value: "other", label: copy("otherReason") },
                      ] as const
                    }
                    onChange={(reasonCode) => {
                      const labels = {
                        no_setup: "waitNoSetup",
                        window: "waitWindow",
                        event: "waitEvent",
                        pause: "waitPause",
                      } as const;
                      change({
                        reasonCode,
                        reason:
                          reasonCode in labels
                            ? copy(labels[reasonCode as keyof typeof labels])
                            : "",
                      });
                    }}
                  />
                  {value.reasonCode === "other" && (
                    <ProcessField label={copy("waitReason")}>
                      <input
                        required
                        maxLength={4000}
                        value={value.reason}
                        onChange={(event) => change({ reason: event.target.value })}
                      />
                    </ProcessField>
                  )}
                </>
              )}
              {value.decision === "trade" && (
                <div className="process-form-grid">
                  <ProcessField label={copy("stop")}>
                    <input
                      required
                      maxLength={4000}
                      value={value.stop}
                      onChange={(event) => change({ stop: event.target.value })}
                    />
                  </ProcessField>
                  <ProcessField
                    label={`${copy("initialRisk")}${rules ? ` (${rules.currency})` : ""}`}
                  >
                    <input
                      type="number"
                      required
                      min="0.000001"
                      max={rules?.riskPerTrade}
                      step="any"
                      value={value.risk}
                      onChange={(event) => change({ risk: event.target.value })}
                    />
                  </ProcessField>
                </div>
              )}
              {rules && (
                <details>
                  <summary>{copy("rules")}</summary>
                  <p className="text-sm">
                    {copy("entry")}: {rules.entry}
                    <br />
                    {copy("exit")}: {rules.exit}
                  </p>
                </details>
              )}
              {initialRules}
              <p className="text-xs text-muted-foreground">{copy("automaticJournalHint")}</p>
            </>
          )}
          <ProcessError error={error} />
          <div className="process-actions">
            <Button type="submit" disabled={busy || blocked}>
              {copy(
                busy
                  ? "saving"
                  : step === 0
                    ? "toPairContext"
                    : step === 1
                      ? "toScenario"
                      : "confirmCheck",
              )}
            </Button>
            {step > 0 && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => change({ step: (step - 1) as 0 | 1 })}
              >
                {copy("back")}
              </Button>
            )}
          </div>
        </fieldset>
      </form>
      {status}
    </ProcessPanel>
  );
}

export function GuidedCheckIn({
  session,
  state,
}: {
  session: ProcessSession | null;
  state: ProcessState;
}) {
  const { language, t } = useLanguage();
  const params = new URLSearchParams(useSearch());
  const linkedDecision = params.get("marketDecisionId") || undefined;
  const linkedPair = params.get("pair") ?? "";
  const rules = session?.rulesSnapshot ?? state.activeMethod!.rules;
  const previous = session?.draft;
  const preparation = previous?.stage === "preparation" ? previous : null;
  const legacy = previous?.stage === "plan" ? previous : null;
  const draft = useSessionDraft<CheckInDraft>(
    session,
    {
      stage: "check_in",
      step: session?.preparedAt ? 1 : 0,
      checklist: preparation?.checklist ?? session?.checklist ?? rules.checklist.map(() => false),
      mood: preparation?.mood ?? session?.mood ?? "",
      focus: preparation?.focus ?? session?.focus ?? "",
      decision: legacy?.decision ?? "",
      market:
        legacy?.market ??
        (rules.markets.includes(linkedPair)
          ? linkedPair
          : rules.markets.length === 1
            ? rules.markets[0]
            : ""),
      entry: legacy?.entry ?? rules.entry,
      stop: legacy?.stop ?? "",
      risk: legacy?.risk ?? "",
      reason: legacy?.reason ?? "",
      reasonCode: legacy?.reason ? "other" : "",
      expectation: "",
      invalidation: rules.invalidation,
      response: "",
      responseNote: "",
      contextSnapshotId: null,
      marketDecisionId: legacy?.marketDecisionId ?? linkedDecision,
    },
    session?.methodVersionId ?? state.activeMethod!.id,
  );
  const setSessionDraft = draft.setValue;
  const change = useCallback(
    (patch: Partial<CheckInDraft>) => setSessionDraft((value) => ({ ...value, ...patch })),
    [setSessionDraft],
  );
  const save = useProcessMutation(() =>
    draft.confirm((value, expectedRevision) => ({
      action: "check_in",
      expectedRevision,
      preparation: { checklist: value.checklist, mood: value.mood, focus: value.focus },
      plan: guidedPlan(value, rules),
    })),
  );
  const reminder =
    state.improvement &&
    state.improvement.methodVersionId === (session?.methodVersionId ?? state.activeMethod?.id)
      ? `${state.improvement.action} · ${state.improvement.criterion}`
      : (state.sessions ?? [])
          .filter(
            (item) =>
              item.state === "closed" &&
              item.id !== session?.id &&
              item.methodVersionId === (session?.methodVersionId ?? state.activeMethod?.id),
          )
          .sort((a, b) => b.day.localeCompare(a.day))[0]?.closure?.correction;
  return (
    <SessionBuilder
      tools={<details>
        <summary>{journeyText(language, "tools")}</summary>
        <div className="grid gap-2 pt-3 sm:grid-cols-2">
          {WORKSPACE_TOOLS.filter(tool => (rules.tools ?? ["markets", "economic-calendar"]).some(id => id === tool.id) && tool.id !== "calculator").map(tool =>
            <ProcessLink key={tool.id} beforeNavigate={draft.flush} href={processToolHref(tool.href, {
              pair: draft.value.market, methodVersionId: session?.methodVersionId ?? state.activeMethod?.id, fromProcess: true,
            })}>{t(tool.labelKey)}</ProcessLink>)}
        </div>
      </details>}
      reminder={reminder}
      value={draft.value}
      change={change}
      criteria={rules.checklist}
      pairs={rules.markets}
      rules={rules}
      alreadyPrepared={Boolean(session?.preparedAt)}
      busy={save.isPending}
      blocked={draft.status === "conflict"}
      error={save.error}
      onConfirm={() => save.mutate(undefined)}
      status={<SessionDraftStatus {...draft} retry={draft.flush} />}
    />
  );
}

function starterStep(values: MethodDraftValues, requested: number): 0 | 1 | 2 {
  if (values.sessionFlow !== true) return 0;
  try {
    const checks = JSON.parse(String(values.confirmedChecks ?? "[]"));
    if (!Array.isArray(checks) || !checks.length || !checks.every((value) => value === true))
      return 0;
  } catch {
    return 0;
  }
  if (requested < 2 || !values.pair) return requested > 0 ? 1 : 0;
  return 2;
}
export function GuidedStarter({ state }: { state: ProcessState }) {
  const params = new URLSearchParams(useSearch());
  const copy = useProcessCopy();
  const { selectedPairs } = useBackground();
  const checklist = useGetChecklist();
  const settings = useGetUserSettings();
  const defaults = useRef<MethodDraftValues>({
    sessionFlow: true,
    confirmedChecks: "[]",
    pair: params.get("pair") || (selectedPairs.length === 1 ? selectedPairs[0] : ""),
    marketDecisionId: params.get("marketDecisionId") ?? "",
    checklist: copy("defaultChecklist"),
    decision: "",
    reason: "",
    reasonCode: "",
    expectation: "",
    invalidation: "",
    response: "",
    currency: "",
    riskConfirmed: false,
  });
  const draft = useMethodDraft(
    state.methodDraft,
    defaults.current,
    null,
    () => undefined,
    starterStep,
  );
  const values = draft.value;
  const setMethodDraft = draft.setValue;
  useEffect(() => {
    setMethodDraft((value) => ({
      ...value,
      sessionFlow: true,
      pair: value.pair || (selectedPairs.length === 1 ? selectedPairs[0] : ""),
      checklist:
        value.checklist === defaults.current.checklist &&
        value.confirmedChecks === "[]" &&
        checklist.data?.length
          ? checklist.data.map((item) => item.text).join("\n")
          : value.checklist || defaults.current.checklist,
      maxDailyLoss:
        value.maxDailyLoss ||
        (settings.data?.maxDailyLoss == null ? "" : String(settings.data.maxDailyLoss)),
    }));
  }, [checklist.data, settings.data?.maxDailyLoss, selectedPairs, setMethodDraft]);
  const criteria = String(values.checklist ?? "")
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  let checks: boolean[] = [];
  try {
    const parsed = JSON.parse(String(values.confirmedChecks ?? "[]"));
    checks = Array.isArray(parsed) ? parsed : [];
  } catch {
    /* An incomplete draft is not a preparation. */
  }
  const value: CheckInDraft = {
    stage: "check_in",
    marketDecisionId: String(values.marketDecisionId ?? "") || undefined,
    step: draft.step,
    checklist: criteria.map((_, i) => checks[i] === true),
    mood: "",
    focus: "",
    decision: String(values.decision ?? "") as CheckInDraft["decision"],
    market: String(values.pair ?? ""),
    entry: String(values.entry ?? ""),
    stop: String(values.stop ?? ""),
    risk: String(values.risk ?? ""),
    reason: String(values.reason ?? ""),
    reasonCode: String(values.reasonCode ?? ""),
    expectation: String(values.expectation ?? ""),
    invalidation: String(values.invalidation ?? ""),
    response: String(values.response ?? "") as CheckInDraft["response"],
    responseNote: String(values.responseNote ?? ""),
    contextSnapshotId: String(values.contextSnapshotId ?? "") || null,
  };
  const setMethodStep = draft.setStep;
  const change = useCallback(
    (patch: Partial<CheckInDraft>) => {
      if (patch.step != null) setMethodStep(patch.step);
      setMethodDraft((value) => ({
        ...value,
        ...Object.fromEntries(
          Object.entries(patch)
            .filter(([key]) => !["step", "stage", "checklist", "market"].includes(key))
            .map(([key, val]) => [key, val ?? ""]),
        ),
        ...(patch.checklist ? { confirmedChecks: JSON.stringify(patch.checklist) } : {}),
        ...(patch.market !== undefined ? { pair: patch.market } : {}),
        ...(patch.invalidation !== undefined || patch.market !== undefined
          ? { riskConfirmed: false }
          : {}),
      }));
    },
    [setMethodStep, setMethodDraft],
  );
  const requestId = useRef(crypto.randomUUID());
  const save = useProcessMutation(() =>
    draft.confirm(async (values, metadata) => {
      if (values.riskConfirmed !== true) throw new Error(copy("checklistConfirm"));
      const string = (key: string) => String(values[key] ?? "").trim();
      const rules: MethodRules = {
        markets: [string("pair")],
        windows: string("windows"),
        setup: string("setup"),
        entry: string("entry"),
        exit: string("exit"),
        invalidation: string("invalidation"),
        waitConditions: string("waitConditions"),
        currency: string("currency"),
        riskPerTrade: Number(values.riskPerTrade),
        maxDailyLoss: Number(values.maxDailyLoss),
        maxDailyTrades: Number(values.maxDailyTrades),
        checklist: string("checklist").split("\n").filter(Boolean),
      };
      return startGuidedProcess({
        method: {
          ...metadata,
          requestId: requestId.current,
          name: copy("defaultMethodName"),
          rules,
          riskConfirmed: true,
        },
        preparation: { checklist: JSON.parse(string("confirmedChecks")) },
        plan: guidedPlan(
          {
            ...value,
            market: string("pair"),
            decision: string("decision") as CheckInDraft["decision"],
            expectation: string("expectation"),
            invalidation: string("invalidation"),
            response: string("response") as CheckInDraft["response"],
            responseNote: string("responseNote"),
            contextSnapshotId: string("contextSnapshotId") || null,
            marketDecisionId: string("marketDecisionId") || undefined,
            stop: string("stop"),
            risk: string("risk"),
            reason: string("reason"),
            entry: rules.entry,
          },
          rules,
        ),
      });
    }),
  );
  const field = (key: string, label: ProcessCopyKey, type = "text") => (
    <ProcessField key={key} label={copy(label)}>
      <input
        required
        type={type}
        min={type === "number" ? (key === "maxDailyTrades" ? "1" : "0.000001") : undefined}
        step={key === "maxDailyTrades" ? "1" : "any"}
        maxLength={key === "currency" ? 3 : 4000}
        pattern={key === "currency" ? "[A-Z]{3}" : undefined}
        value={String(values[key] ?? "")}
        onChange={(event) =>
          draft.setValue((value) => ({
            ...value,
            [key]: key === "currency" ? event.target.value.toUpperCase() : event.target.value,
            riskConfirmed: false,
          }))
        }
      />
    </ProcessField>
  );
  const initialRules = (
    <div className="process-form">
      <p className="text-sm text-muted-foreground">{copy("firstProtectionHint")}</p>
      {field("windows", "windows")}
      {field("setup", "setup")}
      {field("entry", "entry")}
      {field("exit", "exit")}
      {field("waitConditions", "waitConditions")}
      <div className="process-form-grid">
        {field("currency", "currency")}
        {field("riskPerTrade", "riskPerTrade", "number")}
        {field("maxDailyLoss", "maxLoss", "number")}
        {field("maxDailyTrades", "maxTrades", "number")}
      </div>
      <label className="process-option">
        <input
          type="checkbox"
          required
          checked={values.riskConfirmed === true}
          onChange={(event) =>
            draft.setValue((value) => ({ ...value, riskConfirmed: event.target.checked }))
          }
        />
        <span>{copy("checklistConfirm")}</span>
      </label>
    </div>
  );
  const pairs = [
    ...new Set([
      ...selectedPairs,
      ...String(values.markets ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      ...(value.market ? [value.market] : []),
    ]),
  ];
  if (!pairs.length) pairs.push(...DIRECTIONAL_PAIRS);
  return (
    <SessionBuilder
      value={value}
      change={change}
      criteria={criteria}
      pairs={pairs}
      busy={save.isPending}
      blocked={draft.status === "conflict"}
      error={save.error}
      onConfirm={() => save.mutate(undefined)}
      status={<SessionDraftStatus {...draft} scope="method" retry={draft.flush} />}
      initialRules={initialRules}
    />
  );
}
