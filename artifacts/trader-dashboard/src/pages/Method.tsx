import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useGetChecklist, useGetUserSettings } from "@workspace/api-client-react";
import { useBackground } from "@/contexts/BackgroundContext";
import { useTraderProcess, useProcessMutation } from "@/hooks/useTraderProcess";
import { useMethodDraft } from "@/hooks/useMethodDraft";
import { SessionDraftStatus } from "@/components/process/SessionDraftStatus";
import {
  activateProcessMethod,
  addProcessEvidence,
  advanceProcessMethod,
  createProcessMethod,
  fetchProcessHistory,
  type CreateProcessMethod,
  type ProcessMethod,
  type ProcessMethodDraft,
  type ProcessState,
  type AddProcessEvidence,
} from "@/lib/traderProcessApi";
import { processDay, calculateNetR } from "../../../../contracts/trader-process";
import { parseProcessDateTime, processDateTimeInput } from "@/lib/processDateTime";
import {
  ProcessError,
  ProcessField,
  ProcessFrame,
  ProcessLink,
  ProcessLoading,
  ProcessPanel,
  PhaseRail,
  ProgressDetails,
  useProcessCopy,
} from "@/components/process/ProcessUI";
import type { ProcessCopyKey } from "@/lib/processCopy";
import { ProcessNextAction } from "@/components/process/ProcessNextAction";
import { useLanguage } from "@/contexts/LanguageContext";
import { journeyText } from "@/lib/processJourneyCopy";
import { PREPARATION_TOOLS } from "@/lib/workspaceTools";

type Draft = Record<string, string | boolean>;
function methodDraft(method?: ProcessMethod | null): Draft {
  return method
    ? {
        name: method.name,
        ...method.rules,
        markets: method.rules.markets.join(", "),
        checklist: method.rules.checklist.join("\n"),
        tools: (method.rules.tools ?? ["markets", "economic-calendar"]).join(","),
        ...Object.fromEntries(
          Object.entries(method.protocol ?? {}).map(([key, value]) => [key, String(value)]),
        ),
        riskPerTrade: String(method.rules.riskPerTrade),
        maxDailyLoss: String(method.rules.maxDailyLoss),
        maxDailyTrades: String(method.rules.maxDailyTrades),
        periodStart: processDay(),
        periodEnd: "",
        riskConfirmed: false,
      }
    : { periodStart: processDay(), riskConfirmed: false };
}
export function MethodEditor({
  previous,
  stored,
  onDone,
  onCancel,
}: {
  previous: ProcessMethod | null;
  stored: ProcessMethodDraft | null;
  onDone: (created?: ProcessMethod) => void;
  onCancel: () => void;
}) {
  const copy = useProcessCopy();
  const { language, t } = useLanguage();
  const journey = (key: Parameters<typeof journeyText>[1]) => journeyText(language, key);
  const { selectedPairs } = useBackground();
  const settings = useGetUserSettings();
  const checklist = useGetChecklist();
  const defaultChecklist = useRef(copy("defaultChecklist"));
  const checklistLoaded = useRef(Boolean(checklist.data));
  const defaults = useRef<Draft>({
    ...methodDraft(previous),
    ...(!previous
      ? {
          markets: selectedPairs.join(", "),
          tools: "markets,economic-calendar",
          maxDailyLoss:
            settings.data?.maxDailyLoss == null ? "" : String(settings.data.maxDailyLoss),
          checklist:
            (checklist.data ?? []).map((item) => item.text).join("\n") || defaultChecklist.current,
        }
      : {}),
  });
  const draft = useMethodDraft(stored, defaults.current, previous?.id ?? null, onDone);
  const { value: values, setValue: setValues, setStep } = draft;
  const step = Math.min(draft.step, 1);
  useEffect(() => {
    if (previous || stored) return;
    const inheritedChecklist =
      !checklistLoaded.current && checklist.data
        ? checklist.data.map((item) => item.text).join("\n") || defaultChecklist.current
        : null;
    if (checklist.data) checklistLoaded.current = true;
    setValues((v) => ({
      ...v,
      markets: v.markets || selectedPairs.join(", "),
      checklist:
        (inheritedChecklist && v.checklist === defaultChecklist.current
          ? inheritedChecklist
          : v.checklist) ||
        (checklist.data ?? []).map((item) => item.text).join("\n") ||
        defaultChecklist.current,
      maxDailyLoss:
        v.maxDailyLoss ||
        (settings.data?.maxDailyLoss == null ? "" : String(settings.data.maxDailyLoss)),
    }));
  }, [previous, stored, selectedPairs, checklist.data, settings.data?.maxDailyLoss, setValues]);
  const create = useProcessMutation(() => save());
  const requestId = useRef(crypto.randomUUID());
  const previousId = draft.previousVersionId;
  const stepHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    stepHeading.current?.focus();
  }, [step]);
  const field = (key: string, label: ProcessCopyKey, type = "text", min?: string, max?: string) => (
    <ProcessField
      key={key}
      label={copy(label)}
      hint={key === "name" ? copy("optionalName") : undefined}
    >
      {type === "textarea" ? (
        <textarea
          required={key !== "name"}
          rows={2}
          maxLength={4000}
          value={String(values[key] ?? "")}
          onChange={(event) =>
            setValues((v) => ({ ...v, [key]: event.target.value, riskConfirmed: false }))
          }
        />
      ) : (
        <input
          required={key !== "name"}
          type={type}
          min={min}
          max={max}
          step={
            type === "number"
              ? ["minSamples", "maxDailyTrades", "observationDays"].includes(key)
                ? "1"
                : "any"
              : undefined
          }
          maxLength={type === "text" ? 4000 : undefined}
          value={String(values[key] ?? "")}
          onChange={(event) =>
            setValues((v) => ({
              ...v,
              [key]: key === "currency" ? event.target.value.toUpperCase() : event.target.value,
              riskConfirmed: false,
            }))
          }
        />
      )}
    </ProcessField>
  );
  const save = async () => {
    const created = await draft.confirm(async (values, metadata) => {
      if (values.riskConfirmed !== true) throw new Error(copy("checklistConfirm"));
      const n = (key: string) => Number(values[key]);
      const s = (key: string) => String(values[key] ?? "").trim();
      const data: CreateProcessMethod = {
        requestId: requestId.current,
        ...metadata,
        ...(previousId ? { previousVersionId: previousId } : {}),
        name: s("name") || copy("defaultMethodName"),
        riskConfirmed: true,
        rules: {
          markets: [
            ...new Set(
              s("markets")
                .split(",")
                .map((value) => value.trim().toUpperCase())
                .filter(Boolean),
            ),
          ],
          tools: (["markets", "news", "economic-calendar", "sessions", "calculator"] as const).filter(id => s("tools").split(",").includes(id)),
          windows: s("windows"),
          setup: s("setup"),
          entry: s("entry"),
          exit: s("exit"),
          invalidation: s("invalidation"),
          waitConditions: s("waitConditions"),
          currency: s("currency"),
          riskPerTrade: n("riskPerTrade"),
          maxDailyLoss: n("maxDailyLoss"),
          maxDailyTrades: n("maxDailyTrades"),
          checklist: s("checklist")
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean),
        },
      };
      return createProcessMethod(data);
    });
    onDone(created);
    return created;
  };
  return (
    <ProcessPanel
      title={copy(previousId ? "newVersion" : "create")}
      description={copy(step === 0 ? "essentialHint" : "riskHint")}
    >
      <h3
        ref={stepHeading}
        tabIndex={-1}
        className="text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4"
      >
        {step + 1} / 2 · {copy(step === 0 ? "setupTab" : "protectionTab")}
      </h3>
      <details>
        <summary>{copy("methodExamples")}</summary>
        <p className="pt-3 text-sm leading-relaxed text-muted-foreground">
          {copy(
            step === 0 ? "methodRulesHelp" : step === 1 ? "methodRiskHelp" : "methodProtocolHelp",
          )}
        </p>
      </details>
      <form
        className="process-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (step < 1) setStep(1);
          else create.mutate(undefined);
        }}
      >
        <fieldset disabled={create.isPending} className="process-form min-w-0">
          {step === 0 && (
            <>
              <div className="process-form-grid">{field("markets", "markets")}{field("windows", "windows")}</div>
              <div className="process-form-grid">{field("setup", "setup", "textarea")}{field("entry", "entry", "textarea")}</div>
              <div className="process-form-grid">{field("exit", "exit", "textarea")}{field("invalidation", "invalidation", "textarea")}</div>
              {field("waitConditions", "waitConditions", "textarea")}
              <details>
                <summary>{journey("tools")}</summary>
                <p className="py-3 text-sm text-muted-foreground">{journey("toolsHint")}</p>
                {PREPARATION_TOOLS.map(tool => <label key={tool.id} className="process-option">
                  <input type="checkbox" checked={String(values.tools ?? "").split(",").includes(tool.id)}
                    onChange={event => setValues(value => {
                      const selected = new Set(String(value.tools ?? "").split(",").filter(Boolean));
                      if (event.target.checked) selected.add(tool.id); else selected.delete(tool.id);
                      return { ...value, tools: [...selected].join(",") };
                    })} />
                  <span>{t(tool.labelKey)}</span>
                </label>)}
              </details>
              <details><summary>{copy("optionalName")}</summary><div className="pt-3">{field("name", "name")}</div></details>
            </>
          )}
          {step === 1 && (
            <>
              {field("currency", "currency")}
              <div className="process-form-grid">
                {field("riskPerTrade", "riskPerTrade", "number", "0.000001")}
                {field("maxDailyLoss", "maxLoss", "number", "0.000001")}
              </div>
              {field("maxDailyTrades", "maxTrades", "number", "1")}
              {field("checklist", "checklistEditor", "textarea")}
            </>
          )}
          {step === 1 && (
            <>
              <label className="process-option">
                <input
                  type="checkbox"
                  required
                  checked={values.riskConfirmed === true}
                  onChange={(event) =>
                    setValues((v) => ({ ...v, riskConfirmed: event.target.checked }))
                  }
                />
                <span>{copy("checklistConfirm")}</span>
              </label>
            </>
          )}
          <ProcessError error={create.error} />
          <div className="process-actions">
            <Button type="submit" disabled={create.isPending || draft.status === "conflict"}>
              {copy(create.isPending ? "saving" : step < 1 ? "continue" : "saveMethod")}
              <ArrowRight size={16} />
            </Button>
            {step > 0 && (
              <Button type="button" variant="ghost" onClick={() => setStep((step - 1) as 0 | 1)}>
                {copy("back")}
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                void draft
                  .flush()
                  .then(onCancel)
                  .catch(() => undefined);
              }}
            >
              {copy("resumeLater")}
            </Button>
          </div>
        </fieldset>
      </form>
      <SessionDraftStatus {...draft} retry={draft.flush} scope="method" />
    </ProcessPanel>
  );
}
function EvidenceEditor({
  method,
  onDone,
  onCancel,
  userId,
}: {
  method: ProcessMethod;
  onDone: () => void;
  onCancel: () => void;
  userId: string | null | undefined;
}) {
  const copy = useProcessCopy();
  const { language } = useLanguage();
  const journey = (key: Parameters<typeof journeyText>[1]) => journeyText(language, key);
  const [environment, setEnvironment] = useState<NonNullable<AddProcessEvidence["executionEnvironment"]> | "">("");
  const [source, setSource] = useState<AddProcessEvidence["source"]>("manual");
  const [purpose, setPurpose] = useState<AddProcessEvidence["purpose"]>(
    method.phase === "verify" ? "validation" : "development",
  );
  const [tradeId, setTradeId] = useState("");
  const [risk, setRisk] = useState("");
  const [pnl, setPnl] = useState("");
  const [currency, setCurrency] = useState(method.rules.currency);
  const [account, setAccount] = useState("");
  const [costs, setCosts] = useState<AddProcessEvidence["costsStatus"]>("unknown");
  const defaultObservedAt = useRef(new Date());
  const [observedAt, setObservedAt] = useState(processDateTimeInput(defaultObservedAt.current, true));
  const [adherence, setAdherence] = useState<AddProcessEvidence["adherence"]>("unknown");
  const [note, setNote] = useState("");
  const [inputError, setInputError] = useState<unknown>(null);
  const requestId = useRef(crypto.randomUUID());
  const save = useProcessMutation(addProcessEvidence);
  const history = useQuery({
    queryKey: ["process-history", userId],
    queryFn: fetchProcessHistory,
    enabled: source === "account_trade" || source === "replay",
  });
  const annotations = useTraderProcess().data?.evidence ?? [];
  const candidates =
    source === "replay"
      ? (history.data?.replays ?? [])
      : (history.data?.trades ?? []).map((trade) => {
          const rows = annotations.filter(
            (e) => e.methodVersionId === method.id && e.accountTradeId === trade.id,
          );
          const risks = [...new Set(rows.map((e) => e.initialRisk).filter((v) => v != null))];
          const currencies = [...new Set(rows.map((e) => e.currency).filter((v) => v != null))];
          const costs = [...new Set(rows.map((e) => e.costsStatus))];
          return {
            ...trade,
            initialRisk: risks.length === 1 ? risks[0] : undefined,
            currency: currencies.length === 1 ? currencies[0] : undefined,
            costsStatus: costs.length === 1 ? costs[0] : undefined,
          };
        });
  const selected = candidates.find((item) => String(item.id) === tradeId);
  const canonical = Boolean(selected && (source === "account_trade" || source === "replay"));
  const needs = (key: "initialRisk" | "netPnl" | "currency" | "account") =>
    !canonical || (key !== "netPnl" && source !== "replay" && selected?.[key] == null);
  const selectTrade = (id: string) => {
    setTradeId(id);
    const trade = candidates.find((item) => String(item.id) === id);
    if (!trade) return;
    setPnl(trade.netPnl == null ? "" : String(trade.netPnl));
    setAccount(trade.account);
    setRisk(trade.initialRisk == null ? "" : String(trade.initialRisk));
    if (trade.currency) setCurrency(trade.currency);
    if (trade.closedAt) setObservedAt(processDateTimeInput(new Date(trade.closedAt), true));
    setCosts(trade.costsStatus === "included" ? "included" : "unknown");
    setPurpose(method.phase === "verify" && trade.executionEnvironment === "simulation" ? "validation" : ["apply", "consolidate"].includes(method.phase) && trade.executionEnvironment === "real" ? "live" : "development");
  };
  const submit = async () => {
    setInputError(null);
    try {
      await save.mutateAsync({
        requestId: requestId.current,
        methodVersionId: method.id,
        purpose,
        source,
        ...((source === "manual" || source === "external") && environment ? { executionEnvironment: environment } : {}),
        initialRisk: risk === "" ? null : Number(risk),
        netPnl: pnl === "" ? null : Number(pnl),
        costsStatus: costs,
        currency: currency || null,
        account: account || null,
        observedAt: observedAt === processDateTimeInput(defaultObservedAt.current, true) ? defaultObservedAt.current.toISOString() : parseProcessDateTime(observedAt),
        adherence,
        provenance: "declared",
        note,
        ...(source === "account_trade"
          ? { accountTradeId: Number(tradeId) }
          : source === "replay"
            ? { backtestTradeId: Number(tradeId) }
            : {}),
      });
      onDone();
    } catch (error) {
      setInputError(error);
    }
  };
  return (
    <ProcessPanel title={copy("evidenceTitle")} description={copy("evidenceHint")} focusHeading>
      <form
        className="process-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {(source === "manual" || source === "external") ? <ProcessField label={journey("environment")} hint={journey("environmentHint")}>
          <select required value={environment} onChange={event => setEnvironment(event.target.value as typeof environment)}>
            <option value="">—</option>
            {(["simulation", "real", "unknown"] as const).map(value => <option key={value} value={value}>{journey(value)}</option>)}
          </select>
        </ProcessField> : <p className="text-sm text-muted-foreground">{journey("environment")}: {journey(source === "replay" ? "simulation" : selected?.executionEnvironment ?? "unknown")}</p>}
        <div className="process-form-grid">
          <ProcessField label={copy("source")}>
            <select
              value={source}
              onChange={(event) => {
                setSource(event.target.value as AddProcessEvidence["source"]);
                setTradeId("");
              }}
            >
              <option value="manual">{copy("manual")}</option>
              <option value="external">{copy("external")}</option>
              <option value="account_trade">{copy("history")}</option>
              <option value="replay">{copy("replay")}</option>
            </select>
          </ProcessField>
          <details className="self-start"><summary>{copy("purpose")}: {copy(purpose)}</summary>
          <ProcessField label={copy("purpose")}>
            <select
              value={purpose}
              onChange={(event) => setPurpose(event.target.value as AddProcessEvidence["purpose"])}
            >
              <option value="development">{copy("development")}</option>
              <option value="validation">{copy("validation")}</option>
              {["apply", "consolidate"].includes(method.phase) && <option value="live">{copy("live")}</option>}
            </select>
          </ProcessField></details>
        </div>
        {(source === "account_trade" || source === "replay") && (
          <>
            <p className="text-sm text-muted-foreground">{copy("historyHint")}</p>
            <ProcessField label={copy("history")}>
              <select
                required
                value={tradeId}
                onChange={(event) => selectTrade(event.target.value)}
              >
                <option value="">—</option>
                {candidates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.symbol} · {item.closedAt?.slice(0, 10)} · {item.netPnl ?? "—"} · #
                    {item.id}
                  </option>
                ))}
              </select>
            </ProcessField>
            <ProcessError error={history.error} />
            {history.isFetching && <p role="status">{copy("loading")}</p>}
          </>
        )}
        {canonical && (
          <dl className="process-summary">
            <div>
              <dt>{copy("initialRisk")}</dt>
              <dd>
                {risk || "—"} {currency}
              </dd>
            </div>
            <div>
              <dt>{copy("netPnl")}</dt>
              <dd>
                {pnl || "—"} {currency}
              </dd>
            </div>
            <div>
              <dt>{copy("account")}</dt>
              <dd>{account || "—"}</dd>
            </div>
          </dl>
        )}
        <div className="process-form-grid">
          {needs("initialRisk") && (
            <ProcessField label={copy("initialRisk")}>
              <input
                type="number"
                min="0.000001"
                step="any"
                value={risk}
                readOnly={source === "replay"}
                onChange={(event) => setRisk(event.target.value)}
              />
            </ProcessField>
          )}
          {needs("netPnl") && (
            <ProcessField label={copy("netPnl")}>
              <input
                type="number"
                step="any"
                value={pnl}
                readOnly={source === "account_trade" || source === "replay"}
                onChange={(event) => setPnl(event.target.value)}
              />
            </ProcessField>
          )}
          {needs("currency") && (
            <ProcessField label={copy("currency")}>
              <input
                value={currency}
                pattern="[A-Z]{3}"
                maxLength={3}
                onChange={(event) => setCurrency(event.target.value.toUpperCase())}
              />
            </ProcessField>
          )}
          {needs("account") && (
            <ProcessField label={copy("account")}>
              <input
                value={account}
                maxLength={200}
                onChange={(event) => setAccount(event.target.value)}
              />
            </ProcessField>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {copy("netR")}:{" "}
          {risk !== "" && pnl !== ""
            ? (calculateNetR(Number(pnl), Number(risk))?.toFixed(2) ?? "—")
            : "—"}{" "}
          · {copy(source === "replay" ? "replay" : "declared")}
        </p>
        {(!canonical || (source !== "replay" && selected?.costsStatus !== "included")) && (
          <ProcessField label={copy("costs")}>
            <select
              value={costs}
              onChange={(event) =>
                setCosts(event.target.value as AddProcessEvidence["costsStatus"])
              }
            >
              <option value="unknown">{copy("unknown")}</option>
              <option value="included">{copy("included")}</option>
              <option value="excluded">{copy("excluded")}</option>
            </select>
          </ProcessField>
        )}
        {!canonical && (
          <ProcessField label={copy("observedAt")}>
            <input
              required
              type="datetime-local"
              step="1"
              value={observedAt}
              onChange={(event) => setObservedAt(event.target.value)}
            />
          </ProcessField>
        )}
        <ProcessField label={copy("adherence")}>
          <select
            value={adherence}
            onChange={(event) =>
              setAdherence(event.target.value as AddProcessEvidence["adherence"])
            }
          >
            <option value="unknown">{copy("unknown")}</option>
            <option value="conforming">{copy("conforming")}</option>
            <option value="violation">{copy("violation")}</option>
          </select>
        </ProcessField>
        <ProcessField label={copy("evidenceNote")}>
          <textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={4000}
          />
        </ProcessField>
        <ProcessError error={inputError || save.error} />
        <div className="process-actions">
          <Button type="submit" disabled={save.isPending}>
            {copy(save.isPending ? "saving" : "saveEvidence")}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {copy("cancel")}
          </Button>
        </div>
      </form>
    </ProcessPanel>
  );
}
export function VerificationStart({ method, initiallyOpen = false }: { method: ProcessMethod; initiallyOpen?: boolean }) {
  const copy = useProcessCopy();
  const [open, setOpen] = useState(initiallyOpen);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(method.protocol ?? { periodStart: processDay() }).map(([k, v]) => [
        k,
        String(v),
      ]),
    ),
  );
  const save = useProcessMutation(advanceProcessMethod);
  const field = (
    key: string,
    label: ProcessCopyKey,
    type: "date" | "number",
    min?: string,
    max?: string,
  ) => (
    <ProcessField key={key} label={copy(label)}>
      <input
        required
        type={type}
        min={min}
        max={max}
        step={
          type === "number"
            ? ["minSamples", "observationDays"].includes(key)
              ? "1"
              : "any"
            : undefined
        }
        value={values[key] ?? ""}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
      />
    </ProcessField>
  );
  if (!open)
    return (
      <Button className="self-start min-h-11" onClick={() => setOpen(true)}>
        {copy("startVerification")}
        <ArrowRight size={16} />
      </Button>
    );
  return (
    <form
      className="process-form"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          id: method.id,
          expectedPhase: "define",
          review: copy("confirmProtocol"),
          ...(!method.protocol
            ? {
                protocol: {
                  minSamples: Number(values.minSamples),
                  periodStart: values.periodStart,
                  periodEnd: values.periodEnd,
                  minExpectancyR: Number(values.minExpectancyR),
                  maxDrawdownR: Number(values.maxDrawdownR),
                  observationDays: Number(values.observationDays),
                  minAdherencePct: Number(values.minAdherencePct),
                },
              }
            : {}),
        });
      }}
    >
      <h3
        ref={heading}
        tabIndex={-1}
        className={`${initiallyOpen ? "sr-only" : "text-sm font-medium"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-4`}
      >
        {copy("startVerification")}
      </h3>
      <p className="text-sm text-muted-foreground">{copy("protocolHint")}</p>
      <fieldset disabled={save.isPending || Boolean(method.protocol)} className="process-form-grid">
        {field("periodStart", "periodStart", "date", processDay())}
        {field("periodEnd", "periodEnd", "date", values.periodStart || processDay())}
        {field("minSamples", "minSamples", "number", "1")}
        {field("observationDays", "observationDays", "number", "1")}
        {field("minExpectancyR", "minExpectancy", "number")}
        {field("maxDrawdownR", "maxDrawdown", "number", "0.000001")}
        {field("minAdherencePct", "minAdherence", "number", "0", "100")}
      </fieldset>
      <details>
        <summary>{copy("methodExamples")}</summary>
        <p className="text-sm pt-3">{copy("methodProtocolHelp")}</p>
      </details>
      <ProcessError error={save.error} />
      <div className="process-actions">
        <Button type="submit" disabled={save.isPending}>
          {copy(save.isPending ? "saving" : "protocolFinalConfirm")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          {copy("back")}
        </Button>
      </div>
    </form>
  );
}
export function MethodDetails({
  state,
  onEdit,
  readOnly = false,
}: {
  readOnly?: boolean;
  state: ProcessState;
  onEdit: (method: ProcessMethod | null) => void;
}) {
  const copy = useProcessCopy();
  const { language } = useLanguage();
  const journey = (key: Parameters<typeof journeyText>[1]) => journeyText(language, key);
  const method = state.activeMethod!;
  const [review, setReview] = useState("");
  const advance = useProcessMutation(advanceProcessMethod);
  const activate = useProcessMutation(activateProcessMethod);
  const rows = state.evidence.filter((e) => e.methodVersionId === method.id);
  const guidance = state.guidance;
  const canAdvance = guidance?.action === "review_verification" || guidance?.action === "review_application";
  return (
    <>
      <ProcessPanel
        title={`${method.name} · ${copy("version")} ${method.version}`}
        description={copy("progress")}
      >
        {!readOnly && <ProcessNextAction state={state} action={!["confirm_verification", "review_verification", "review_application"].includes(guidance?.action ?? "")} />}
        <details>
          <summary>{copy("progressDetails")}</summary>
          <ProgressDetails progress={state.progress} />
        </details>
        {!readOnly && method.phase === "define" && (
          <>
            {guidance?.action === "confirm_verification" && <VerificationStart method={method} />}
            <Button
              type="button"
              variant={guidance?.action === "revise_method" ? "default" : "ghost"}
              className="self-start"
              onClick={() => onEdit(method)}
            >
              {copy("newVersion")}
            </Button>
          </>
        )}
        {!readOnly && method.phase !== "consolidate" && method.phase !== "define" && (
          <form
            className="process-form"
            onSubmit={(event) => {
              event.preventDefault();
              advance.mutate(
                { id: method.id, expectedPhase: method.phase, review },
                { onSuccess: () => setReview("") },
              );
            }}
          >
            {canAdvance && (
              <ProcessField label={copy("reviewNote")} hint={copy("reviewHint")}>
                <textarea
                  required
                  value={review}
                  maxLength={4000}
                  rows={3}
                  onChange={(event) => setReview(event.target.value)}
                />
              </ProcessField>
            )}
            <ProcessError error={advance.error} />
            <div className="process-actions">
              {canAdvance ? (
                <Button type="submit" disabled={advance.isPending}>
                  {copy(advance.isPending ? "saving" : "advance")}
                  <ArrowRight size={16} />
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => onEdit(method)}>
                {copy("newVersion")}
              </Button>
            </div>
          </form>
        )}
        {!readOnly && method.phase === "consolidate" && (
          <div className="process-actions">
            <Link href="/" className={buttonVariants()}>
              {copy("today")}
              <ArrowRight size={16} />
            </Link>
            <Button type="button" variant="ghost" onClick={() => onEdit(method)}>
              {copy("newVersion")}
            </Button>
          </div>
        )}
        {readOnly && (
          <Link href="/method" className={buttonVariants() + " self-start"}>
            {copy("activeMethod")}
          </Link>
        )}
      </ProcessPanel>
      <details>
        <summary>{copy("rules")}</summary>
        <dl className="process-summary">
          {(["windows", "setup", "entry", "exit", "invalidation", "waitConditions"] as const).map(
            (key) => (
              <div key={key}>
                <dt>{copy(key)}</dt>
                <dd>{method.rules[key]}</dd>
              </div>
            ),
          )}
          <div>
            <dt>{copy("checklist")}</dt>
            <dd>{method.rules.checklist.join("\n")}</dd>
          </div>
          <div>
            <dt>{copy("riskPerTrade")}</dt>
            <dd>
              {method.rules.riskPerTrade} {method.rules.currency}
            </dd>
          </div>
          <div>
            <dt>{copy("maxLoss")}</dt>
            <dd>
              {method.rules.maxDailyLoss} {method.rules.currency}
            </dd>
          </div>
        </dl>
      </details>
      <details>
        <summary>
          {copy("evidenceList")} ({rows.length})
        </summary>
        <div className="process-table-wrap">
          <table className="process-table">
            <thead>
              <tr>
                <th>{copy("purpose")}</th>
                <th>{copy("source")}</th>
                <th>{copy("netR")}</th>
                <th>{copy("provenance")}</th>
                <th>{copy("costs")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td>{copy(e.purpose)}</td>
                  <td>
                    {e.source === "account_trade"
                      ? copy("history")
                      : e.source === "replay"
                        ? copy("replay")
                        : copy(e.source)}
                  </td>
                  <td>{e.netR?.toFixed(2) ?? "—"}{e.purpose === "validation" && method.verificationStartedAt &&
                    (e.observedAt < method.verificationStartedAt || Boolean(method.protocol &&
                      (processDay(new Date(e.observedAt)) < method.protocol.periodStart || processDay(new Date(e.observedAt)) > method.protocol.periodEnd))) &&
                    <span className="mt-1 block text-xs text-muted-foreground">{journey("outsideTest")}</span>}
                    {e.executionEnvironment === "unknown" && <span className="mt-1 block text-xs text-muted-foreground">{journey("environment")}: {journey("unknown")}</span>}
                  </td>
                  <td>{copy(e.provenance)}</td>
                  <td>{copy(e.costsStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!readOnly && (
          <ProcessLink href="/method?section=evidence">{copy("addEvidence")}</ProcessLink>
        )}
        {!readOnly && (
          <ProcessLink href={`/backtest?methodVersionId=${encodeURIComponent(method.id)}`}>
            {copy("replay")}
          </ProcessLink>
        )}
      </details>
      <details>
        <summary>{copy("methods")}</summary>
        <ul className="space-y-3">
          {state.methods.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span>
                {item.name} · {copy("version")} {item.version} · {copy(item.phase)}
              </span>
              <Link
                href={`/method?version=${encodeURIComponent(item.id)}`}
                className={buttonVariants({ variant: "ghost" })}
              >
                {copy("viewVersion")}
              </Link>
              {item.active ? (
                <span className="inline-flex items-center gap-2 text-primary">
                  <Check size={15} />
                  {copy("active")}
                </span>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => activate.mutate(item.id)}
                  disabled={activate.isPending}
                >
                  {copy("activate")}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <ProcessError error={activate.error} />
        <Button variant="ghost" onClick={() => onEdit(null)} className="mt-3">
          {copy("newMethod")}
        </Button>
      </details>
    </>
  );
}
export default function Method() {
  const copy = useProcessCopy();
  const query = useTraderProcess();
  const search = useSearch();
  const [, navigate] = useLocation();
  const [editor, setEditor] = useState<{
    previous: ProcessMethod | null;
    useStored: boolean;
  } | null>(null);
  if (!query.data) return <ProcessLoading error={query.error} retry={() => void query.refetch()} />;
  const state = query.data,
    method =
      state.methods.find((m) => m.id === new URLSearchParams(search).get("version")) ??
      state.activeMethod;
  const readOnly = Boolean(method && !method.active);
  const displayState = method
    ? {
        ...state,
        activeMethod: method,
        progress: state.progressByVersion[method.id] ?? state.progress,
      }
    : state;
  const evidence = new URLSearchParams(search).get("section") === "evidence";
  const finish = (created?: ProcessMethod) => {
    setEditor(null);
    navigate(
      created && !created.active ? `/method?version=${encodeURIComponent(created.id)}` : "/method",
    );
  };
  const reviseId = new URLSearchParams(search).get("revise");
  const revisionMethod = state.methods.find(item => item.id === reviseId);
  const showEditor = editor || (revisionMethod ? { previous: revisionMethod, useStored: true } : !method ? { previous: null, useStored: true } : null);
  return (
    <ProcessFrame
      title={copy("method")}
      subtitle={copy("methodIntro")}
    >
      <PhaseRail phase={displayState.progress.phase} />
      {readOnly && (
        <p role="status" className="text-sm text-muted-foreground">
          {copy("inactiveVersionHint")}
        </p>
      )}
      {showEditor ? (
        <MethodEditor
          key={`${query.userId}:${showEditor.previous?.id ?? "new"}`}
          previous={showEditor.previous}
          stored={state.methodDraft}
          onDone={finish}
          onCancel={() => {
            setEditor(null);
            navigate("/");
          }}
        />
      ) : evidence && method && !readOnly ? (
        <EvidenceEditor method={method} userId={query.userId} onDone={finish} onCancel={finish} />
      ) : method ? (
        <>
          {state.methodDraft && (
            <Button
              variant="outline"
              className="self-start"
              onClick={() =>
                setEditor({
                  previous:
                    state.methods.find((m) => m.id === state.methodDraft?.previousVersionId) ??
                    null,
                  useStored: true,
                })
              }
            >
              {copy("saved")} · {copy("continue")}
            </Button>
          )}
          <MethodDetails
            key={method.id}
            state={displayState}
            readOnly={readOnly}
            onEdit={(previous) =>
              setEditor({
                previous: state.methodDraft
                  ? (state.methods.find((m) => m.id === state.methodDraft?.previousVersionId) ??
                    null)
                  : previous,
                useStored: Boolean(state.methodDraft),
              })
            }
          />
        </>
      ) : null}
    </ProcessFrame>
  );
}
